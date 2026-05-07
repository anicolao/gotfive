<script lang="ts">
	import Tile from './Tile.svelte';
	import type { TileColor } from '../game/tiles';

	export let publicPool: number[] = [];
	export let decks: Record<TileColor, number[]> = {
		Red: [],
		Blue: [],
		Yellow: [],
		Green: [],
		Purple: []
	};
	export let onReveal: (color: TileColor) => void;

	const COLORS: TileColor[] = ['Red', 'Blue', 'Yellow', 'Green', 'Purple'];
</script>

<div class="table">
	<div class="decks-area">
		{#each COLORS as color}
			<button class="deck-btn {color.toLowerCase()}" on:click={() => onReveal(color)} disabled={decks[color].length === 0}>
				{#if decks[color].length > 0}
					<Tile faceDown={true} {color} />
					<div class="deck-count">{decks[color].length}</div>
				{:else}
					<div class="empty-deck">0</div>
				{/if}
			</button>
		{/each}
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
		border-radius: 40px;
		width: 100%;
		max-width: 600px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border: 8px solid #2e7d32;
		box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.2);
	}

	.decks-area {
		display: flex;
		gap: 10px;
		margin-bottom: 20px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.deck-btn {
		background: none;
		border: none;
		cursor: pointer;
		position: relative;
		padding: 0;
		transition: transform 0.2s;
	}

	.deck-btn:hover:not(:disabled) {
		transform: scale(1.05);
	}

	.deck-btn:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.deck-count {
		position: absolute;
		bottom: -10px;
		right: -10px;
		background: #3e2723;
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
		z-index: 2;
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
		min-height: 100px;
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
		background: rgba(255, 255, 255, 0.1);
	}
</style>
