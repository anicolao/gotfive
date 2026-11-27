<script lang="ts">
	import { store } from '$lib/store';
	import { resetGame } from '$lib/store/gameSlice';
	import { clearPlayers } from '$lib/store/playersSlice';
	import { selectTile, resetUI, setGameId, setIsHost } from '$lib/store/uiSlice';
	import { createRNG } from '$lib/game/rng';
	import { createDeck, shuffle } from '$lib/game/deck';
	import {
		getLobbyRoster,
		getUserDisplay,
		unsubscribeGame,
		updateUserPresence,
		writeGameEvent,
		writeGameEvents,
		writeLobbyEvent
	} from '$lib/firebase/events';
	import Table from '$lib/components/Table.svelte';
	import PlayerStand from '$lib/components/PlayerStand.svelte';
	import DeductionBoard from '$lib/components/DeductionBoard.svelte';
	import Lobby from '$lib/components/Lobby.svelte';
	import UnifiedTileScene3D from '$lib/components/three/UnifiedTileScene3D.svelte';
	import { replaceState } from '$app/navigation';
	import '../App.css';

	let gameState = $state(store.getState().game);
	let playersState = $state(store.getState().players);
	let uiState = $state(store.getState().ui);

	store.subscribe(() => {
		const state = store.getState();
		gameState = state.game;
		playersState = state.players;
		uiState = state.ui;
	});

	async function handleStartGame() {
		if (!uiState.gameId) return;
		const urlParams = new URLSearchParams(window.location.search);
		const seedParam = urlParams.get('seed');
		const seed = seedParam ? parseInt(seedParam) : Math.floor(Math.random() * 1000000);
		const rng = createRNG(seed);
		const playerIds = [...new Set([...getLobbyRoster(uiState.gameId), ...Object.keys(playersState.players)])];
		if (uiState.myId && !playerIds.includes(uiState.myId)) {
			playerIds.unshift(uiState.myId);
		}
		const turnOrder = shuffle([...playerIds], rng);
		const events: Array<{ type: string; payload: any }> = [];

		// Create deck 1-60 and shuffle
		let deck = createDeck();
		deck = shuffle(deck, rng);

		turnOrder.forEach(pid => {
			events.push({
				type: 'players/addPlayer',
				payload: { id: pid, name: playersState.players[pid]?.name || getUserDisplay(pid).name }
			});
		});

		// Deal 5 tiles to each player (1 of each color)
		turnOrder.forEach(pid => {
			const hand: number[] = [];
			for (let colorIdx = 0; colorIdx < 5; colorIdx++) {
				const tileIdx = deck.findIndex(id => (id - 1) % 5 === colorIdx);
				if (tileIdx !== -1) {
					hand.push(deck.splice(tileIdx, 1)[0]);
				}
			}
			events.push({ type: 'players/setHand', payload: { id: pid, hand } });
		});

		// 5 public tiles (1 of each color)
		const initialPublic: number[] = [];
		for (let colorIdx = 0; colorIdx < 5; colorIdx++) {
			const tileIdx = deck.findIndex(id => (id - 1) % 5 === colorIdx);
			if (tileIdx !== -1) {
				initialPublic.push(deck.splice(tileIdx, 1)[0]);
			}
		}

		events.push({ type: 'game/start', payload: { deck, turnOrder, initialPublic, seed } });
		await writeGameEvents(uiState.gameId, events);
		await writeLobbyEvent('lobby/startGame', { gameId: uiState.gameId });
	}

	async function handleResetGame() {
		store.dispatch(resetUI());
		acknowledgedEliminations = new Set();
		await handleStartGame();
	}

	async function handleBackToLobby() {
		const gameId = uiState.gameId;
		if (gameId) {
			await writeLobbyEvent('lobby/leaveGame', { gameId, uid: uiState.myId });
		}
		unsubscribeGame();
		await updateUserPresence(null);
		const url = new URL(window.location.href);
		url.searchParams.delete('gameId');
		url.searchParams.delete('hostGameId');
		replaceState(url, {});
		store.dispatch(clearPlayers());
		store.dispatch(resetGame());
		store.dispatch(resetUI());
		store.dispatch(setGameId(null));
		store.dispatch(setIsHost(false));
		acknowledgedEliminations = new Set();
	}

	let currentPlayerId = $derived(gameState?.turnOrder[gameState?.currentPlayerIndex]);
	let isMyTurn = $derived(currentPlayerId === uiState?.myId);
	let canDrawThisTurn = $derived(isMyTurn && gameState?.status === 'PLAYING' && !gameState?.hasDrawnThisTurn);
	let canUseDrawnTile = $derived(isMyTurn && gameState?.status === 'PLAYING' && !!gameState?.hasDrawnThisTurn);
	let canSubmitGuess = $derived(
		gameState?.status === 'PLAYING' &&
		!!uiState?.myId &&
		!playersState?.players[uiState.myId]?.eliminated
	);
	let correctlyDeducedTileIds = $derived(
		Object.entries(uiState?.deductionBoard || {})
			.filter(([, mark]) => mark === 'OK')
			.map(([id]) => Number(id))
	);
	let isHost = $derived(uiState?.isHost);

	// Sort other players for display around the table
	let otherPlayerIds = $derived(gameState?.turnOrder.filter((id: string) => id !== uiState?.myId) || []);
	let topPlayerId = $derived(otherPlayerIds[1] || null);
	let leftPlayerId = $derived(otherPlayerIds[0] || null);
	let rightPlayerId = $derived(otherPlayerIds[2] || null);

	function handleSelectTile(id: number) {
		if (!canUseDrawnTile) return;
		if (uiState.selectedTileId === id) {
			store.dispatch(selectTile(null));
		} else {
			store.dispatch(selectTile(id));
		}
	}

	function handleAskSort(targetId: string) {
		if (!canUseDrawnTile || uiState.selectedTileId === null || !uiState.gameId) return;
		writeGameEvent(uiState.gameId, 'players/clue_sort', { targetId, tileId: uiState.selectedTileId });
		store.dispatch(selectTile(null));
		writeGameEvent(uiState.gameId, 'game/nextTurn', undefined);
	}

	function handleAskCompare(targetId: string, slot: number) {
		if (!canUseDrawnTile || uiState.selectedTileId === null || !uiState.gameId) return;
		writeGameEvent(uiState.gameId, 'players/clue_compare', { targetId, tileId: uiState.selectedTileId, targetSlot: slot });
		store.dispatch(selectTile(null));
		writeGameEvent(uiState.gameId, 'game/nextTurn', undefined);
	}

	function handleReveal(color: any) {
		if (!canDrawThisTurn || !uiState.gameId) return;
		writeGameEvent(uiState.gameId, 'game/reveal', color);
	}

	let acknowledgedEliminations = $state(new Set<string>());
	let newlyEliminatedPlayer = $derived.by(() => {
		for (const id in playersState?.players || {}) {
			if (playersState.players[id].eliminated && !acknowledgedEliminations.has(id) && id !== uiState?.myId) {
				return playersState.players[id];
			}
		}
		return null;
	});

	function acknowledgeElimination(id: string) {
		const newSet = new Set(acknowledgedEliminations);
		newSet.add(id);
		acknowledgedEliminations = newSet;
	}

	const version = import.meta.env.VITE_APP_VERSION || 'dev';
	const gitHash = import.meta.env.VITE_GIT_HASH || 'local';
</script>

<svelte:head>
	<title>Got Five!</title>
</svelte:head>

<div class="game-container">
				<main>
				{#if gameState?.status === 'LOBBY'}
				<div class="lobby-wrapper glass-panel">
					<Lobby />
					{#if isHost && uiState?.gameId}
						<div class="host-actions">
							<button class="got-five-btn" onclick={handleStartGame}>START GAME</button>
						</div>
					{/if}
				</div>
				{:else}
				<div class="main-play-area" data-opponents={otherPlayerIds.length}>
					<UnifiedTileScene3D />
					{#if gameState?.status === 'FINISHED'}
						<div class="status-banner finished glass-panel">
							<h2>GAME OVER</h2>
							<p class="winner-msg">Winner: {playersState?.players[gameState.winnerId!]?.name}!</p>
							<div class="status-actions">
								<button class="groovy-button" onclick={handleResetGame}>Play Again</button>
								<button class="groovy-button alt" onclick={handleBackToLobby}>Back to Lobby</button>
							</div>
						</div>
					{:else if (uiState?.myId && playersState?.players[uiState.myId]?.eliminated)}
						<div class="status-banner eliminated glass-panel">
							<h2>ELIMINATED</h2>
							<p>Better luck next time!</p>
							<button class="groovy-button" onclick={handleBackToLobby}>Back to Lobby</button>
						</div>
					{:else if newlyEliminatedPlayer}
						<div class="status-banner newly-eliminated glass-panel">
							<h2>PLAYER ELIMINATED</h2>
							<p class="winner-msg">{newlyEliminatedPlayer.name} guessed incorrectly and was eliminated!</p>
							<button class="groovy-button" onclick={() => acknowledgeElimination(newlyEliminatedPlayer.id)}>Continue</button>
						</div>
					{/if}
					<div class="opponents-area" data-opponents={otherPlayerIds.length}>
						{#each otherPlayerIds as id}
							{#if playersState?.players[id]}
								<PlayerStand
									id={id}
									name={playersState.players[id].name}
									hand={playersState.players[id].hand}
									clues={playersState.players[id].clues}
									revealHand={gameState?.status === 'FINISHED'}
									isCurrentTurn={currentPlayerId === id}
									canBeTarget={canUseDrawnTile && uiState?.selectedTileId !== null}
									onSelectTarget={handleAskSort}
									onSelectSlot={handleAskCompare}
								/>
							{/if}
						{/each}
					</div>

					<div class="public-area">
						{#if gameState}
							<Table
								publicPool={gameState.publicPool}
								decks={gameState.decks}
								canReveal={canDrawThisTurn}
								canSelectTile={canUseDrawnTile}
								onReveal={handleReveal}
								selectedTileId={uiState?.selectedTileId}
								onSelectTile={handleSelectTile}
							/>
						{/if}
					</div>

					<div class="player-area">
						{#if uiState?.myId && playersState?.players[uiState.myId]}
							<PlayerStand
								id={uiState.myId}
								name={playersState.players[uiState.myId].name}
								hand={playersState.players[uiState.myId].hand}
								clues={playersState.players[uiState.myId].clues}
								isLocalPlayer={true}
								revealHand={gameState?.status === 'FINISHED'}
								{correctlyDeducedTileIds}
								isCurrentTurn={currentPlayerId === uiState.myId}
								canBeTarget={canUseDrawnTile && uiState?.selectedTileId !== null}
								onSelectTarget={handleAskSort}
								onSelectSlot={handleAskCompare}
							/>
						{/if}
					</div>
				</div>

				<div class="deduction-area">
					<DeductionBoard
						deductions={uiState?.deductionBoard}
						{canSubmitGuess}
						showLobbyButton={gameState?.status === 'PLAYING'}
						onBackToLobby={handleBackToLobby}
					/>
				</div>
				{/if}
				</main>
	<footer class="version-info">
		{version}@{gitHash}
	</footer>
</div>

<style>
        .game-container {
                width: 100vw;
                height: 100vh;
                height: 100dvh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: relative;
        }

        main {
                flex: 1;
                display: flex;
                flex-direction: row;
                padding: 8px 10px 18px;
                gap: 10px;
                overflow: hidden;
                box-sizing: border-box;
                min-width: 0;
                min-height: 0;
                height: 100%;
        }

        .main-play-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                gap: var(--gap-base);
                overflow: hidden;
                min-width: 0;
                min-height: 0;
                position: relative;
        }

        .deduction-area {
                width: clamp(320px, 34vw, 480px);
                flex: 0 0 auto;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: center;
                min-height: 0;
        }

        .opponents-area {
                display: flex;
                flex-direction: row;
                justify-content: center;
                align-items: flex-start;
                gap: var(--gap-base);
                flex-wrap: wrap;
                flex-shrink: 0;
                padding-top: 2px;
        }

        .opponents-area[data-opponents='2'],
        .opponents-area[data-opponents='3'] {
                --tile-size: clamp(24px, min(4.2vw, 7dvh), 46px);
        }

        .public-area {
                display: flex;
                justify-content: center;
                flex: 1 1 auto;
                align-items: center;
                min-height: 0;
                overflow: visible;
        }

        .player-area {
                display: flex;
                justify-content: center;
                align-items: flex-end;
                position: relative;
                padding-bottom: 2px;
                min-height: 0;
                flex-shrink: 0;
        }

        @media (orientation: portrait) {
                main {
                        flex-direction: column;
                        gap: 6px;
                        padding: 6px 6px 18px;
                        justify-content: space-between;
                        overflow: hidden;
                        width: 100%;
                }

                .main-play-area {
                        flex: 1 1 auto;
                        width: 100%;
                        min-height: 0;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-evenly;
                        gap: 4px;
                        overflow: hidden;
                }

                .opponents-area {
                        min-height: 0;
                        flex: 0 1 auto;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 4px;
                        width: 100%;
                }

                .opponents-area[data-opponents='2'],
                .opponents-area[data-opponents='3'] {
                        --tile-size: clamp(26px, min(8.6vw, 4.4dvh), 44px);
                }

                .main-play-area[data-opponents='3'] .public-area {
                        --tile-size: clamp(30px, min(9.8vw, 5dvh), 48px);
                }

                .main-play-area[data-opponents='3'] .player-area {
                        --tile-size: clamp(30px, min(9.8vw, 5dvh), 48px);
                }

                .public-area {
                        min-height: 0;
                        flex: 0 1 auto;
                        overflow: visible;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                }

                .player-area {
                        padding-bottom: 0;
                        min-height: 0;
                        flex: 0 1 auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                }

                .deduction-area {
                        flex: 0 0 auto;
                        width: 100%;
                        max-width: min(100%, 660px);
                        margin: 0 auto;
                        min-height: 0;
                        overflow: hidden;
                        border-top: 1px solid var(--color-glass-border);
                        padding-top: 6px;
                }
        }

        @media (orientation: landscape) and (max-height: 540px) {
                main {
                        padding: 4px 6px 14px;
                        gap: 6px;
                        overflow: hidden;
                }

                .main-play-area {
                        flex: 1 1 53%;
                        gap: 2px;
                        justify-content: space-between;
                        overflow: hidden;
                }

                .deduction-area {
                        width: clamp(265px, 45vw, 420px);
                        max-width: 47vw;
                        flex: 0 0 auto;
                        border-left: 1px solid var(--color-glass-border);
                        padding-left: 6px;
                        box-sizing: border-box;
                        height: 100%;
                        overflow: hidden;
                        justify-content: center;
                }

                .opponents-area {
                        gap: 3px;
                        padding-top: 0;
                }

                .opponents-area[data-opponents='2'],
                .opponents-area[data-opponents='3'] {
                        --tile-size: clamp(22px, min(4.2vw, 7dvh), 32px);
                }

                .main-play-area[data-opponents='3'] .public-area,
                .main-play-area[data-opponents='3'] .player-area {
                        --tile-size: clamp(24px, min(5vw, 8.2dvh), 34px);
                }

                .player-area {
                        padding-bottom: 0;
                }
        }

        .lobby-wrapper {
                width: 100%;
                max-width: min(560px, 100%);
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                padding: 1.25rem;
                align-self: center;
                box-sizing: border-box;
                overflow: hidden;
                max-height: 100%;
        }

        @media (max-width: 600px) {
                .lobby-wrapper {
                        padding: 0.5rem;
                        gap: 0.5rem;
                }
        }

        @media (orientation: landscape) and (max-height: 540px) {
                .lobby-wrapper {
                        max-width: min(720px, 98vw);
                        padding: 0.45rem 0.75rem;
                        gap: 0.35rem;
                }
        }

        .host-actions {
                display: flex;
                justify-content: center;
        }

        .status-banner {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 30;
                width: min(360px, calc(100% - 16px));
                box-sizing: border-box;
                padding: 12px 16px;
                text-align: center;
                border: 1px solid var(--color-neon-magenta);
                background: rgba(11, 12, 16, 0.92);
                box-shadow: 0 0 24px rgba(255, 0, 212, 0.35);
        }

        .status-banner h2 {
                margin: 0;
                font-size: 1.15rem;
                color: var(--color-neon-magenta);
                text-shadow: 0 0 10px rgba(255, 0, 212, 0.5);
        }

        .status-banner p {
                margin: 4px 0 8px;
        }

        .status-actions {
                display: flex;
                justify-content: center;
                gap: 10px;
                flex-wrap: wrap;
        }

        .status-banner .groovy-button {
                padding: 7px 14px;
                font-size: 0.8rem;
        }

        .groovy-button.alt {
                background: rgba(0, 229, 255, 0.08);
                border-color: var(--color-neon-cyan);
        }

        .winner-msg {
                font-size: 1rem;
                font-weight: bold;
                color: var(--color-neon-yellow);
                margin: 4px 0 8px;
                text-shadow: 0 0 10px rgba(255, 234, 0, 0.5);
        }

        .version-info {
                position: absolute;
                bottom: 3px;
                right: 8px;
                width: 90px;
                color: rgba(240, 240, 240, 0.5);
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 11px;
                font-variant-numeric: tabular-nums;
                line-height: 11px;
                text-align: right;
                letter-spacing: 0;
                pointer-events: none;
        }
</style>
