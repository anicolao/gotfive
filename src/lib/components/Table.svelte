<script lang="ts">
	import Tile from './Tile.svelte';

	export let publicPool: number[] = [];
	export let deckSize: number = 0;
	export let onReveal: () => void;
</script>

<div class="table">
	<div class="deck-area">
		<button class="deck" on:click={onReveal} disabled={deckSize === 0}>
			{#if deckSize > 0}
				<Tile faceDown={true} />
				<div class="deck-count">{deckSize}</div>
			{:else}
				<div class="empty-deck">EMPTY</div>
			{/if}
		</button>
	</div>

	<div class="pool-area">
		<h2>Public Pool</h2>
		<div class="pool-tiles">
			{#each publicPool as id}
				<Tile {id} />
			{/each}
		</div>
	</div>
</div>

<style>
	.table {
		background-color: var(--color-avocado);
		padding: 20px;
		border-radius: 50%;
		width: 400px;
		height: 400px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border: 8px solid #2e7d32;
		box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.2);
	}

	.deck-area {
		margin-bottom: 20px;
	}

	.deck {
		background: none;
		border: none;
		cursor: pointer;
		position: relative;
		padding: 0;
	}

	.deck:disabled {
		cursor: default;
	}

	.deck-count {
		position: absolute;
		bottom: -10px;
		right: -10px;
		background: var(--color-orange);
		color: white;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		font-size: 12px;
		border: 2px solid white;
	}

	.pool-area {
		text-align: center;
		width: 100%;
	}

	h2 {
		margin: 0 0 10px 0;
		font-size: 1.2rem;
		color: #2e7d32;
		text-transform: uppercase;
		letter-spacing: 2px;
	}

	.pool-tiles {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: center;
		max-width: 300px;
	}

	.empty-deck {
		width: 60px;
		height: 84px;
		border: 2px dashed #3e2723;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #3e2723;
		font-weight: bold;
	}
</style>
