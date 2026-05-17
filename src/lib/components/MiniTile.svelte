<script lang="ts">
	import { getTileData, type TileColor } from '../game/tiles';

	let { id, size = 'medium' } = $props();

	let data = $derived(getTileData(id));

	const COLOR_MAP: Record<TileColor, string> = {
		Red: '#D84315',
		Blue: '#1565C0',
		Yellow: '#F9A825',
		Green: '#2E7D32',
		Purple: '#6A1B9A'
	};
</script>

<div 
	class="mini-tile {size}" 
	style="--tile-color: {COLOR_MAP[data.color]}"
	title="Tile {id} ({data.color}, {data.dots} dots)"
>
	<div class="number">{id}</div>
	<div class="dots">
		{#each Array(data.dots) as _}
			<div class="dot"></div>
		{/each}
	</div>
</div>

<style>
        .mini-tile {
                background-color: var(--tile-color);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: calc(var(--mini-tile-size) * 0.2);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
                box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
                user-select: none;
                width: var(--mini-tile-size);
                height: var(--mini-tile-size);
                padding: calc(var(--mini-tile-size) * 0.05);
                box-sizing: border-box;
        }

        .small {
                --mini-tile-size: clamp(16px, 3vw, 24px);
        }
        .number {
                font-weight: bold;
                line-height: 1;
                text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
                font-size: calc(var(--mini-tile-size) * 0.5);
        }

        .dots {
                display: flex;
                gap: 1px;
                margin-top: 1px;
        }

        .dot {
                width: calc(var(--mini-tile-size) * 0.15);
                height: calc(var(--mini-tile-size) * 0.15);
                background-color: white;
                border-radius: 50%;
                box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
        }
</style>
