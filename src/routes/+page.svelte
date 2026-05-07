<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/store';
	import { start, reveal } from '$lib/store/gameSlice';
	import { addPlayer, setHand, clue_sort, clue_compare } from '$lib/store/playersSlice';
	import { setMyId, selectTile } from '$lib/store/uiSlice';
	import { createRNG } from '$lib/game/rng';
	import { createDeck, shuffle } from '$lib/game/deck';
	import Table from '$lib/components/Table.svelte';
	import PlayerStand from '$lib/components/PlayerStand.svelte';
	import DeductionBoard from '$lib/components/DeductionBoard.svelte';
	import '../App.css';

	let gameState: any;
	let playersState: any;
	let uiState: any;

	store.subscribe(() => {
		const state = store.getState();
		gameState = state.game;
		playersState = state.players;
		uiState = state.ui;
	});

	function initGame() {
		const urlParams = new URLSearchParams(window.location.search);
		const seedParam = urlParams.get('seed');
		const seed = seedParam ? parseInt(seedParam, 10) : Math.floor(Math.random() * 1000000);
		const rng = createRNG(seed);

		const playerIds = ['p1', 'p2', 'p3', 'p4'];
		store.dispatch(setMyId('p1'));

		store.dispatch(addPlayer({ id: 'p1', name: 'You' }));
		store.dispatch(addPlayer({ id: 'p2', name: 'Alice' }));
		store.dispatch(addPlayer({ id: 'p3', name: 'Bob' }));
		store.dispatch(addPlayer({ id: 'p4', name: 'Charlie' }));

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

	onMount(() => {
		initGame();
	});

	function handleSelectTile(id: number) {
		if (uiState.selectedTileId === id) {
			store.dispatch(selectTile(null));
		} else {
			store.dispatch(selectTile(id));
		}
	}

	function handleAskSort(targetId: string) {
		if (uiState.selectedTileId !== null) {
			store.dispatch(clue_sort({ targetId, tileId: uiState.selectedTileId }));
			store.dispatch(selectTile(null));
		}
	}

	function handleAskCompare(targetId: string, slot: number) {
		if (uiState.selectedTileId !== null) {
			store.dispatch(clue_compare({ targetId, tileId: uiState.selectedTileId, targetSlot: slot }));
			store.dispatch(selectTile(null));
		}
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
	</header>

	<main>
		<div class="main-play-area">
			<div class="top-row">
				{#if playersState?.players['p3']}
					<PlayerStand
						id="p3"
						name={playersState.players['p3'].name}
						hand={playersState.players['p3'].hand}
						clues={playersState.players['p3'].clues}
						canBeTarget={uiState?.selectedTileId !== null}
						onSelectTarget={handleAskSort}
						onSelectSlot={handleAskCompare}
					/>
				{/if}
			</div>

			<div class="middle-row">
				<div class="side-col">
					{#if playersState?.players['p2']}
						<PlayerStand
							id="p2"
							name={playersState.players['p2'].name}
							hand={playersState.players['p2'].hand}
							clues={playersState.players['p2'].clues}
							canBeTarget={uiState?.selectedTileId !== null}
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
							onReveal={(color) => store.dispatch(reveal(color))}
							selectedTileId={uiState?.selectedTileId}
							onSelectTile={handleSelectTile}
						/>
					{/if}
				</div>

				<div class="side-col">
					{#if playersState?.players['p4']}
						<PlayerStand
							id="p4"
							name={playersState.players['p4'].name}
							hand={playersState.players['p4'].hand}
							clues={playersState.players['p4'].clues}
							canBeTarget={uiState?.selectedTileId !== null}
							onSelectTarget={handleAskSort}
							onSelectSlot={handleAskCompare}
						/>
					{/if}
				</div>
			</div>

			<div class="bottom-row">
				{#if playersState?.players['p1']}
					<PlayerStand
						id="p1"
						name={playersState.players['p1'].name}
						hand={playersState.players['p1'].hand}
						clues={playersState.players['p1'].clues}
						isLocalPlayer={true}
						canBeTarget={uiState?.selectedTileId !== null}
						onSelectTarget={handleAskSort}
						onSelectSlot={handleAskCompare}
					/>
				{/if}
			</div>
		</div>

		<aside class="sidebar">
			<DeductionBoard deductions={uiState?.deductionBoard} />
		</aside>
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
</style>
