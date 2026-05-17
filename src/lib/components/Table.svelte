<script lang="ts">
	import Tile from './Tile.svelte';
	import type { TileColor } from '../game/tiles';

	export let publicPool: number[] = [];
	export let selectedTileId: number | null = null;
	export let decks: Record<TileColor, number[]> = {
		Red: [],
		Blue: [],
		Yellow: [],
		Green: [],
		Purple: []
	};
	export let onReveal: (color: TileColor) => void;
	export let onSelectTile: (id: number) => void;

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
		<div class="pool-tiles">
			{#each publicPool as id}
				<button
					class="tile-btn"
					class:selected={id === selectedTileId}
					on:click={() => onSelectTile(id)}
				>
					<Tile {id} />
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
        .table {
                padding: var(--gap-base);
                width: 100%;
                max-width: 800px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
        }

        .decks-area {
                display: flex;
                gap: var(--gap-base);
                margin-bottom: var(--gap-base);
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
                bottom: -4px;
                right: -4px;
                background: rgba(0, 0, 0, 0.8);
                color: var(--color-text-main);
                border-radius: 50%;
                width: calc(var(--tile-size) * 0.3);
                height: calc(var(--tile-size) * 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: calc(var(--tile-size) * 0.15);
                border: 1px solid var(--color-glass-border);
                z-index: 2;
        }

        .pool-area {
                text-align: center;
                width: 100%;
        }

        .pool-tiles {
                display: flex;
                flex-wrap: wrap;
                gap: var(--gap-base);
                justify-content: center;
                min-height: var(--tile-size);
        }

        .tile-btn {
                background: none;
                border: none;
                padding: 0;
                cursor: pointer;
                transition: transform 0.2s;
        }

        .tile-btn:hover {
                transform: scale(1.05);
        }

        .tile-btn.selected {
                outline: 2px solid var(--color-neon-yellow);
                outline-offset: 4px;
                border-radius: 8px;
                transform: scale(1.1);
                box-shadow: 0 0 15px var(--color-neon-yellow);
        }

        .empty-deck {
                width: var(--tile-size);
                height: var(--tile-size);
                border: 1px dashed var(--color-text-muted);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--color-text-muted);
                font-weight: bold;
                background: rgba(255, 255, 255, 0.05);
                font-size: var(--font-size-small);
        }
</style>