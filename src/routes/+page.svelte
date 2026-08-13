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
	import { replaceState } from '$app/navigation';
	import '../App.css';

	let gameState = $state(store.getState().game);
	let playersState = $state(store.getState().players);
	let uiState = $state(store.getState().ui);
	let inspect3D = $state(false);

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
				<div class="main-play-area">
					{#if gameState?.status === 'FINISHED'}
						<div class="status-banner finished glass-panel">
							<h2>GAME OVER</h2>
							<p class="winner-msg">Winner: {playersState?.players[gameState.winnerId!]?.name}!</p>
							<div class="status-actions">
								<button class="groovy-button" onclick={handleResetGame}>Play Again</button>
								<button class="groovy-button alt" onclick={handleBackToLobby}>Back to Lobby</button>
								<button
									class="inspect-3d-button compact"
									class:active={inspect3D}
									type="button"
									aria-label={inspect3D ? 'Exit 3D' : 'Inspect 3D'}
									aria-pressed={inspect3D}
									onclick={() => inspect3D = !inspect3D}
								>3D</button>
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
					<div class="opponents-area">
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
									{inspect3D}
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
								{inspect3D}
								onSelectTile={handleSelectTile}
							/>
						{/if}
					</div>

					<div class="player-area">
						<div class="controls-left">
							{#if gameState?.status === 'PLAYING'}
								<button class="lobby-link-button" aria-label="Back to Lobby" onclick={handleBackToLobby}>Lobby</button>
								<button
									class="inspect-3d-button"
									class:active={inspect3D}
									type="button"
									aria-pressed={inspect3D}
									onclick={() => inspect3D = !inspect3D}
								>
									{inspect3D ? 'Exit 3D' : 'Inspect 3D'}
								</button>
							{/if}
						</div>
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
								{inspect3D}
								onSelectTarget={handleAskSort}
								onSelectSlot={handleAskCompare}
							/>
						{/if}
					</div>
				</div>

				<div class="deduction-area">
					<DeductionBoard deductions={uiState?.deductionBoard} {canSubmitGuess} />
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
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: relative;
        }

        main {
                flex: 1;
                display: flex;
                flex-direction: row;
                padding: var(--gap-base);
                gap: var(--gap-base);
                overflow: visible;
                box-sizing: border-box;
                min-width: 0;
                min-height: 0;
        }

        .main-play-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: var(--gap-base);
                overflow: visible;
                min-width: 0;
                position: relative;
        }

        .deduction-area {
                width: auto;
                max-width: 380px;
                flex-shrink: 0;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                min-height: 0;
                -webkit-overflow-scrolling: touch;
        }

        @media (min-width: 1200px) {
                .deduction-area {
                        max-width: 500px;
                }
        }

        .opponents-area {
                display: flex;
                flex-direction: row;
                justify-content: center;
                gap: var(--gap-base);
                flex-wrap: wrap;
                flex-shrink: 0;
        }

        .public-area {
                display: flex;
                justify-content: center;
                flex: 1;
                align-items: center;
                min-height: 80px;
                flex-shrink: 1;
                overflow: visible;
        }

        .player-area {
                display: flex;
                justify-content: center;
                align-items: flex-end;
                position: relative;
                padding-bottom: var(--gap-base);
                min-height: 80px;
                flex-shrink: 0;
        }

        .controls-left {
                position: absolute;
                bottom: 10px;
        }

        .controls-left {
				left: 10px;
				display: flex;
				gap: 6px;
		}

        @media (orientation: portrait) {
                main {
                        flex-direction: column;
                        gap: 8px;
                        padding: 6px;
                        justify-content: flex-start;
                        overflow-y: auto;
                        width: 100%;
                        scroll-padding-bottom: 40vh;
                        -webkit-overflow-scrolling: touch;
                }

                main::after {
                        content: '';
                        flex: 0 0 40vh;
                }

                .main-play-area {
                        flex: 0 0 auto;
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        overflow: visible;
                }

                .status-banner {
                        position: relative;
                        top: 0;
                        left: 0;
                        right: 0;
                        z-index: 20;
                        padding: 8px;
                        margin: 4px auto;
                        width: 95%;
                        box-sizing: border-box;
                }

                .status-banner h2 {
                        font-size: 1rem;
                }

                .opponents-area {
                        min-height: 0;
                        flex: 0 1 auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                }

                .public-area {
                        min-height: 0;
                        flex: 0 0 auto;
                        overflow: visible;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                }

                .player-area {
                        padding-bottom: 2px;
                        min-height: 0;
                        flex: 0 1 auto;
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                }

                .controls-left {
                        position: static;
						flex: 0 0 100%;
                        display: flex;
                        justify-content: center;
						gap: 6px;
                        order: 2;
                }

                .deduction-area {
                        flex: 0 0 auto;
                        width: 100%;
                        min-height: 150px;
                        max-height: none;
                        overflow: visible;
                        border-top: 1px solid var(--color-glass-border);
                        padding-top: 8px;
                }
                }

        @media (orientation: portrait) and (min-width: 600px) {
                .main-play-area {
                        flex: 1.5;
                }
                .deduction-area {
                        flex: 1;
                        max-height: none;
                }
        }
        @media (orientation: landscape) and (max-height: 500px) {
                main {
                        padding: 4px;
                        gap: 6px;
                }

                .main-play-area {
                        overflow-y: visible;
                }

                .deduction-area {
                        width: 230px;
                        max-width: 35vw;
                        flex: 0 0 auto;
                        border-left: 1px solid var(--color-glass-border);
                        padding-left: 6px;
                        box-sizing: border-box;
                        height: calc(100vh - 8px);
                        height: calc(100dvh - 8px);
                        max-height: calc(100vh - 8px);
                        max-height: calc(100dvh - 8px);
                        overflow-y: auto;
                        padding-bottom: 32px;
                }

                .opponents-area {
                        gap: 4px;
                }

                .player-area {
                        padding-bottom: 2px;
                        min-height: 60px;
                        flex-wrap: wrap;
                }

                .controls-left {
                        position: static;
						flex: 0 0 100%;
                        display: flex;
                        justify-content: flex-start;
						gap: 6px;
                        order: 2;
                }

                .public-area {
                        min-height: 100px;
                }
        }

        .lobby-wrapper {
                width: 100%;
                max-width: 500px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                gap: 1rem;
                padding: 1.5rem;
                align-self: center;
                box-sizing: border-box;
                overflow-y: auto;
                max-height: 100%;
        }

        @media (max-width: 600px) {
                .lobby-wrapper {
                        padding: 0.25rem;
                        gap: 0.25rem;
                }
        }

        .host-actions {
                display: flex;
                justify-content: center;
        }

        .status-banner {
                padding: 10px;
                text-align: center;
                border: 1px solid var(--color-neon-magenta);
                box-shadow: 0 0 15px rgba(255, 0, 212, 0.3);
                margin-bottom: 5px;
                flex-shrink: 0;
        }

        .status-banner h2 {
                margin: 0;
                font-size: 1.2rem;
                color: var(--color-neon-magenta);
                text-shadow: 0 0 10px rgba(255, 0, 212, 0.5);
        }

        .status-actions {
                display: flex;
                justify-content: center;
                gap: 12px;
                flex-wrap: wrap;
        }

        .groovy-button.alt {
                background: rgba(0, 229, 255, 0.08);
                border-color: var(--color-neon-cyan);
        }

        .lobby-link-button {
                border: 1px solid var(--color-neon-cyan);
                background: rgba(0, 0, 0, 0.35);
                color: var(--color-text-main);
                border-radius: 6px;
                padding: 4px 8px;
                min-width: 58px;
                min-height: 28px;
                font: inherit;
                font-size: 0.75rem;
                cursor: pointer;
        }

        .lobby-link-button:hover {
                border-color: var(--color-neon-yellow);
                color: var(--color-neon-yellow);
        }

		.inspect-3d-button {
				border: 1px solid var(--color-neon-magenta);
				background: rgba(0, 0, 0, 0.72);
				color: white;
				border-radius: 6px;
				padding: 4px 9px;
				min-height: 28px;
				font: inherit;
				font-size: 0.72rem;
				font-weight: 800;
				text-transform: uppercase;
				cursor: pointer;
				box-shadow: 0 0 8px rgba(255, 0, 212, 0.3);
		}

		.inspect-3d-button.active {
				background: var(--color-neon-magenta);
				color: #050505;
				box-shadow: 0 0 14px var(--color-neon-magenta);
		}

		.inspect-3d-button.compact {
				position: absolute;
				top: 8px;
				right: 8px;
				min-width: 42px;
				padding-inline: 8px;
		}

        .winner-msg {
                font-size: 1.1rem;
                font-weight: bold;
                color: var(--color-neon-yellow);
                margin: 5px 0;
                text-shadow: 0 0 10px rgba(255, 234, 0, 0.5);
        }

        .version-info {
                position: absolute;
                bottom: 5px;
                right: 10px;
                width: 90px;
                color: rgba(240, 240, 240, 0.5);
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 11px;
                font-variant-numeric: tabular-nums;
                line-height: 11px;
                text-align: right;
                letter-spacing: 0;
        }
</style>
