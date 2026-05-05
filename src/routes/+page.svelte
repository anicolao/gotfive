<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/store';
	import { start, reveal } from '$lib/store/gameSlice';
	import { addPlayer, setHand } from '$lib/store/playersSlice';
	import { setMyId } from '$lib/store/uiSlice';
	import Table from '$lib/components/Table.svelte';
	import PlayerStand from '$lib/components/PlayerStand.svelte';
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
		const playerIds = ['p1', 'p2', 'p3', 'p4'];
		store.dispatch(setMyId('p1'));

		store.dispatch(addPlayer({ id: 'p1', name: 'You' }));
		store.dispatch(addPlayer({ id: 'p2', name: 'Alice' }));
		store.dispatch(addPlayer({ id: 'p3', name: 'Bob' }));
		store.dispatch(addPlayer({ id: 'p4', name: 'Charlie' }));

		// Create deck 1-60 and shuffle
		const deck = Array.from({ length: 60 }, (_, i) => i + 1);
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}

		// Deal 5 tiles to each player (1 of each color would be better, but for now just 5 random)
		// Wait, rules say "Each player draws 1 tile of each of the 5 colors at random from the supply."
		// Let's do that.
		
		playerIds.forEach(pid => {
			const hand: number[] = [];
			const colorsTaken = new Set<number>();
			
			// Simple approach: find one of each color in the deck
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

		store.dispatch(start({ deck, turnOrder: playerIds }));
		
		// Add initial public tiles to pool
		// In a real game these are revealed one by one or all at once
		initialPublic.forEach(id => {
			// We need a way to add specific tiles to public pool in the slice
			// For now let's just use reveal multiple times or add a new action
		});
	}

	onMount(() => {
		initGame();
	});

	function handleReveal() {
		store.dispatch(reveal());
	}
</script>

<svelte:head>
	<title>Got Five!</title>
</svelte:head>

<div class="game-container">
	<header>
		<h1>Got Five!</h1>
	</header>

	<main>
		<div class="top-row">
			{#if playersState?.players['p3']}
				<PlayerStand 
					name={playersState.players['p3'].name} 
					hand={playersState.players['p3'].hand} 
				/>
			{/if}
		</div>

		<div class="middle-row">
			<div class="side-col">
				{#if playersState?.players['p2']}
					<PlayerStand 
						name={playersState.players['p2'].name} 
						hand={playersState.players['p2'].hand} 
					/>
				{/if}
			</div>

			<div class="center-col">
				{#if gameState}
					<Table 
						publicPool={gameState.publicPool} 
						deckSize={gameState.deck.length - gameState.deckIndex} 
						onReveal={handleReveal}
					/>
				{/if}
			</div>

			<div class="side-col">
				{#if playersState?.players['p4']}
					<PlayerStand 
						name={playersState.players['p4'].name} 
						hand={playersState.players['p4'].hand} 
					/>
				{/if}
			</div>
		</div>

		<div class="bottom-row">
			{#if playersState?.players['p1']}
				<PlayerStand 
					name={playersState.players['p1'].name} 
					hand={playersState.players['p1'].hand} 
					isLocalPlayer={true}
				/>
			{/if}
		</div>
	</main>
</div>

<style>
	.game-container {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
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
		flex-direction: column;
		justify-content: space-between;
		padding: 20px;
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
</style>
