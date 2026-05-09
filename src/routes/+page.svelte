<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/store';
	import { start, reveal, nextTurn, setWinner, resetGame } from '$lib/store/gameSlice';
	import { addPlayer, setHand, clue_sort, clue_compare, guess, resetPlayers } from '$lib/store/playersSlice';
	import { setMyId, selectTile, setOverlay, resetUI } from '$lib/store/uiSlice';
	import { createRNG } from '$lib/game/rng';
	import { createDeck, shuffle } from '$lib/game/deck';
	import Table from '$lib/components/Table.svelte';
	import PlayerStand from '$lib/components/PlayerStand.svelte';
	import DeductionBoard from '$lib/components/DeductionBoard.svelte';
	import Lobby from '$lib/components/Lobby.svelte';
	import '../App.css';

	let gameState = $state(store.getState().game);
	let playersState = $state(store.getState().players);
	let uiState = $state(store.getState().ui);
	let showSidebar = $state(false);

	store.subscribe(() => {
		const state = store.getState();
		gameState = state.game;
		playersState = state.players;
		uiState = state.ui;
	});

	function handleStartGame() {
		const urlParams = new URLSearchParams(window.location.search);
		const seedParam = urlParams.get('seed');
		const seed = seedParam ? parseInt(seedParam) : Math.floor(Math.random() * 1000000);
		const rng = createRNG(seed);
		const playerIds = Object.keys(playersState.players);

		// Create deck 1-60 and shuffle
		let deck = createDeck();
		deck = shuffle(deck, rng);

		// Deal 5 tiles to each player (1 of each color)
		playerIds.forEach(pid => {
			const hand: number[] = [];
			for (let colorIdx = 0; colorIdx < 5; colorIdx++) {
				const tileIdx = deck.findIndex(id => (id - 1) % 5 === colorIdx);
				if (tileIdx !== -1) {
					hand.push(deck.splice(tileIdx, 1)[0]);
				}
			}
			store.dispatch(setHand({ id: pid, hand }));
		});

		// 5 public tiles (1 of each color)
		const initialPublic: number[] = [];
		for (let colorIdx = 0; colorIdx < 5; colorIdx++) {
			const tileIdx = deck.findIndex(id => (id - 1) % 5 === colorIdx);
			if (tileIdx !== -1) {
				initialPublic.push(deck.splice(tileIdx, 1)[0]);
			}
		}

		store.dispatch(start({ deck, turnOrder: playerIds, initialPublic, seed }));
	}

	function handleResetGame() {
		store.dispatch(resetGame());
		store.dispatch(resetPlayers());
		store.dispatch(resetUI());
		acknowledgedEliminations = new Set();
	}

	let currentPlayerId = $derived(gameState?.turnOrder[gameState?.currentPlayerIndex]);
	let isMyTurn = $derived(currentPlayerId === uiState?.myId);
	let isHost = $derived(uiState?.isHost);

	// Sort other players for display around the table
	let otherPlayerIds = $derived(gameState?.turnOrder.filter((id: string) => id !== uiState?.myId) || []);
	let topPlayerId = $derived(otherPlayerIds[1] || null);
	let leftPlayerId = $derived(otherPlayerIds[0] || null);
	let rightPlayerId = $derived(otherPlayerIds[2] || null);

	function handleSelectTile(id: number) {
		if (!isMyTurn) return;
		if (uiState.selectedTileId === id) {
			store.dispatch(selectTile(null));
		} else {
			store.dispatch(selectTile(id));
		}
	}

	function handleAskSort(targetId: string) {
		if (!isMyTurn || uiState.selectedTileId === null) return;
		store.dispatch(clue_sort({ targetId, tileId: uiState.selectedTileId }));
		store.dispatch(selectTile(null));
		store.dispatch(nextTurn());
	}

	function handleAskCompare(targetId: string, slot: number) {
		if (!isMyTurn || uiState.selectedTileId === null) return;
		store.dispatch(clue_compare({ targetId, tileId: uiState.selectedTileId, targetSlot: slot }));
		store.dispatch(selectTile(null));
		store.dispatch(nextTurn());
	}

	function handleReveal(color: any) {
		if (!isMyTurn) return;
		store.dispatch(reveal(color));
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

	$effect(() => {
		if (gameState?.status === 'PLAYING' && currentPlayerId && playersState?.players[currentPlayerId]?.eliminated) {
			// If it's my turn but I'm eliminated, pass it
			// Or if I'm the host, I'm responsible for advancing the turn if the current player is eliminated
			if (currentPlayerId === uiState?.myId || isHost) {
				store.dispatch(nextTurn());
			}
		}
	});

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
					{#if isHost && Object.keys(playersState?.players || {}).length >= 1}
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
							<button class="groovy-button" onclick={handleResetGame}>Play Again</button>
						</div>
					{:else if (uiState?.myId && playersState?.players[uiState.myId]?.eliminated)}
						<div class="status-banner eliminated glass-panel">
							<h2>ELIMINATED</h2>
							<p>Better luck next time!</p>
							<button class="groovy-button" onclick={handleResetGame}>Back to Lobby</button>
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
									isCurrentTurn={currentPlayerId === id}
									canBeTarget={isMyTurn && uiState?.selectedTileId !== null}
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
								onReveal={handleReveal}
								selectedTileId={uiState?.selectedTileId}
								onSelectTile={handleSelectTile}
							/>
						{/if}
					</div>

					<div class="player-area">
						<div class="controls-left"></div>
						{#if uiState?.myId && playersState?.players[uiState.myId]}
							<PlayerStand
								id={uiState.myId}
								name={playersState.players[uiState.myId].name}
								hand={playersState.players[uiState.myId].hand}
								clues={playersState.players[uiState.myId].clues}
								isLocalPlayer={true}
								isCurrentTurn={currentPlayerId === uiState.myId}
								canBeTarget={isMyTurn && uiState?.selectedTileId !== null}
								onSelectTarget={handleAskSort}
								onSelectSlot={handleAskCompare}
							/>
						{/if}
						<div class="controls-right">
						</div>
					</div>
				</div>

				<div class="deduction-area">
					<DeductionBoard deductions={uiState?.deductionBoard} />
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
		padding: 10px;
		gap: 10px;
		overflow: hidden;
		box-sizing: border-box;
	}

	.main-play-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 10px;
		overflow: hidden;
	}

	.deduction-area {
		width: auto;
		max-width: 400px;
		flex-shrink: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.opponents-area {
		display: flex;
		flex-direction: row;
		justify-content: center;
		gap: 10px;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.public-area {
		display: flex;
		justify-content: center;
		flex: 1;
		align-items: center;
		min-height: 100px;
		flex-shrink: 1;
		overflow: hidden;
	}

	.player-area {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		position: relative;
		padding-bottom: 10px;
		min-height: 80px;
		flex-shrink: 0;
	}

	.controls-left, .controls-right {
		position: absolute;
		bottom: 10px;
	}

	.controls-left { left: 10px; }
	.controls-right { right: 10px; }

	@media (orientation: portrait) {
		main {
			flex-direction: column;
			gap: 8px;
			padding: 8px;
		}

		.main-play-area {
			flex: 1;
			min-height: 0;
			display: grid;
			grid-template-rows: auto auto 1fr auto;
			gap: 8px;
			overflow: hidden;
		}

		.status-banner {
			grid-row: 1;
			z-index: 20;
			padding: 10px;
			margin: 0;
		}

		.opponents-area {
			grid-row: 2;
			max-height: 100px;
			min-height: 0;
			overflow: auto;
		}

		.public-area {
			grid-row: 3;
			min-height: 0;
			overflow: auto;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.player-area {
			grid-row: 4;
			padding-bottom: 10px;
		}

		.deduction-area {
		        flex: 0 0 auto;
		        width: 100%;
		        max-height: 180px;
		        overflow: hidden;
		        border-top: 1px solid var(--color-glass-border);
		}
		}
	@media (orientation: landscape) and (max-height: 500px) {
		main {
			padding: 4px;
			gap: 6px;
		}

		.deduction-area {
			width: 340px;
			max-width: 40vw;
			flex: 0 0 auto;
			border-left: 1px solid var(--color-glass-border);
			padding-left: 6px;
		}

		.opponents-area {
			gap: 4px;
		}

		.player-area {
			padding-bottom: 2px;
			min-height: 50px;
		}

		.public-area {
			min-height: 80px;
		}
	}

	.lobby-wrapper {
		width: 100%;
		max-width: 500px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		padding: 2rem;
		align-self: center;
		box-sizing: border-box;
	}

	@media (max-width: 600px) {
		.lobby-wrapper {
			padding: 0.5rem;
			gap: 1rem;
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
		font-size: 0.7rem;
		opacity: 0.5;
		font-family: monospace;
	}
</style>