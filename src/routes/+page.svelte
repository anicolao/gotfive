<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/store';
	import { start, reveal, nextTurn, setWinner } from '$lib/store/gameSlice';
	import { addPlayer, setHand, clue_sort, clue_compare, guess } from '$lib/store/playersSlice';
	import { setMyId, selectTile, setOverlay } from '$lib/store/uiSlice';
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
	let guessInputs = $state([0, 0, 0, 0, 0]);

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

	let currentPlayerId = $derived(gameState?.turnOrder[gameState?.currentPlayerIndex]);
	let isMyTurn = $derived(currentPlayerId === uiState?.myId);
	let isHost = $derived(uiState?.myId && gameState?.status === 'LOBBY' && Object.keys(playersState?.players || {}).length > 0); // Simplified host check

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

	function submitGuess() {
		if (!uiState?.myId) return;
		const playerId = uiState.myId;
		store.dispatch(guess({ playerId, guessedHand: guessInputs }));
		
		const player = playersState.players[playerId];
		if (!player.eliminated) {
			store.dispatch(setWinner(playerId));
		}
		store.dispatch(setOverlay('NONE'));
	}

	const version = import.meta.env.VITE_APP_VERSION || 'dev';
	const gitHash = import.meta.env.VITE_GIT_HASH || 'local';
</script>

<svelte:head>
	<title>Got Five!</title>
</svelte:head>

<div class="game-container">
	<header>
		<h1>Got Five!</h1>
		<div class="turn-indicator">
			{#if gameState?.status === 'PLAYING'}
				<span class="turn-label">Current Turn:</span>
				<span class="player-name">{playersState?.players[currentPlayerId]?.name}</span>
				{#if isMyTurn}
					<span class="your-turn-badge">YOUR TURN!</span>
				{/if}
				{:else if gameState?.status === 'FINISHED' && gameState.winnerId}
				<span class="winner-label">Winner: {playersState?.players[gameState.winnerId]?.name}!</span>
				<button onclick={() => window.location.reload()}>Play Again</button>
				{/if}
				</div>
				</header>

				<main>
				{#if gameState?.status === 'LOBBY'}
				<div class="lobby-wrapper">
					<Lobby />
					{#if isHost && Object.keys(playersState?.players || {}).length >= 1}
						<div class="host-actions">
							<button class="got-five-btn" onclick={handleStartGame}>START GAME</button>
						</div>
					{/if}
				</div>				{:else}
				<div class="main-play-area">
				<div class="top-row">
					{#if topPlayerId && playersState?.players[topPlayerId]}
						<PlayerStand
							id={topPlayerId}
							name={playersState.players[topPlayerId].name}
							hand={playersState.players[topPlayerId].hand}
							clues={playersState.players[topPlayerId].clues}
							isCurrentTurn={currentPlayerId === topPlayerId}
							canBeTarget={isMyTurn && uiState?.selectedTileId !== null}
							onSelectTarget={handleAskSort}
							onSelectSlot={handleAskCompare}
						/>
					{/if}
				</div>

				<div class="middle-row">
					<div class="side-col">
						{#if leftPlayerId && playersState?.players[leftPlayerId]}
							<PlayerStand
								id={leftPlayerId}
								name={playersState.players[leftPlayerId].name}
								hand={playersState.players[leftPlayerId].hand}
								clues={playersState.players[leftPlayerId].clues}
								isCurrentTurn={currentPlayerId === leftPlayerId}
								canBeTarget={isMyTurn && uiState?.selectedTileId !== null}
								onSelectTarget={handleAskSort}
								onSelectSlot={handleAskCompare}
							/>
						{/if}
					</div>

					<div class="center-col">
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

					<div class="side-col">
						{#if rightPlayerId && playersState?.players[rightPlayerId]}
							<PlayerStand
								id={rightPlayerId}
								name={playersState.players[rightPlayerId].name}
								hand={playersState.players[rightPlayerId].hand}
								clues={playersState.players[rightPlayerId].clues}
								isCurrentTurn={currentPlayerId === rightPlayerId}
								canBeTarget={isMyTurn && uiState?.selectedTileId !== null}
								onSelectTarget={handleAskSort}
								onSelectSlot={handleAskCompare}
							/>
						{/if}
					</div>
				</div>

				<div class="bottom-row">
					<div class="controls-left">
						<button class="got-five-btn" onclick={() => store.dispatch(setOverlay('GUESS'))}>
							GOT FIVE!
						</button>
					</div>
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
						{#if isMyTurn}
							<button class="next-turn-btn" onclick={() => store.dispatch(nextTurn())}>
								Pass Turn
							</button>
						{/if}
					</div>
				</div>
				</div>

				<aside class="sidebar">
				<DeductionBoard deductions={uiState?.deductionBoard} />
				</aside>
				{/if}
				</main>

				{#if uiState?.overlay === 'GUESS'}
				<div class="overlay">
				<div class="guess-modal">
				<h2>GOT FIVE!</h2>
				<p>Enter your 5 numbers in ascending order:</p>
				<div class="guess-inputs">
					{#each guessInputs as val, i}
						<input type="number" min="1" max="60" bind:value={guessInputs[i]} />
					{/each}
				</div>
				<div class="modal-actions">
					<button onclick={() => store.dispatch(setOverlay('NONE'))}>Cancel</button>
					<button class="primary" onclick={submitGuess}>Submit Guess</button>
				</div>
				</div>
				</div>
				{/if}
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

	header {
		text-align: center;
		padding: 10px;
	}

	h1 {
		margin: 0;
		font-size: 2.5rem;
		text-shadow: 2px 2px #000;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: row;
		padding: 20px;
		gap: 20px;
		overflow: hidden;
	}

	.main-play-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.sidebar {
		width: auto;
		display: flex;
		align-items: center;
		max-height: 100%;
		overflow-y: auto;
	}

	.top-row, .bottom-row {
		display: flex;
		justify-content: center;
		position: relative;
		align-items: center;
		width: 100%;
	}

	.controls-left, .controls-right {
		position: absolute;
		display: flex;
		gap: 10px;
	}

	.controls-left { left: 50px; }
	.controls-right { right: 50px; }

	.got-five-btn {
		background-color: var(--color-gold);
		color: var(--color-wood);
		font-weight: bold;
		font-size: 1.2rem;
		padding: 10px 20px;
		border: 4px solid var(--color-wood);
		border-radius: 8px;
		cursor: pointer;
		box-shadow: 4px 4px 0 var(--color-wood);
	}

	.got-five-btn:hover {
		transform: translate(-2px, -2px);
		box-shadow: 6px 6px 0 var(--color-wood);
	}

	.next-turn-btn {
		background-color: var(--color-cream);
		color: var(--color-wood);
		padding: 8px 16px;
		border: 2px solid var(--color-wood);
		border-radius: 4px;
		cursor: pointer;
	}

	.turn-indicator {
		display: flex;
		align-items: center;
		gap: 10px;
		justify-content: center;
		margin-top: 10px;
		font-family: 'Courier New', Courier, monospace;
	}

	.player-name {
		font-weight: bold;
		color: var(--color-gold);
		font-size: 1.2rem;
	}

	.your-turn-badge {
		background-color: var(--color-avocado);
		color: white;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		animation: blink 1s infinite;
	}

	@keyframes blink {
		50% { opacity: 0; }
	}

	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0,0,0,0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.guess-modal {
		background: var(--color-cream);
		padding: 30px;
		border-radius: 12px;
		border: 8px solid var(--color-gold);
		text-align: center;
		color: var(--color-wood);
	}

	.guess-inputs {
		display: flex;
		gap: 10px;
		margin: 20px 0;
	}

	.guess-inputs input {
		width: 50px;
		height: 50px;
		font-size: 1.5rem;
		text-align: center;
		border: 2px solid var(--color-wood);
		border-radius: 8px;
	}

	.modal-actions {
		display: flex;
		justify-content: center;
		gap: 20px;
	}

	.modal-actions button.primary {
		background-color: var(--color-gold);
		font-weight: bold;
	}

	.middle-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex: 1;
	}

	.side-col {
		width: 200px;
		display: flex;
		justify-content: center;
	}

	.center-col {
		flex: 1;
		display: flex;
		justify-content: center;
	}

	.version-info {
		position: absolute;
		bottom: 5px;
		right: 10px;
		font-size: 0.7rem;
		opacity: 0.5;
		font-family: monospace;
	}

	.lobby-wrapper {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2rem;
	}

	.host-actions {
		display: flex;
		justify-content: center;
	}
</style>
