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
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: white;
		box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
		user-select: none;
	}

	.medium {
	        width: 30px;
	        height: 30px;
	        padding: 2px;
	}

	.small {
	        width: 20px;
	        height: 20px;
	        padding: 1px;
	}
	.number {
		font-weight: bold;
		line-height: 1;
		text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
	}

	.medium .number {
		font-size: 14px;
	}

	.small .number {
		font-size: 10px;
	}

	.dots {
		display: flex;
		gap: 1px;
	}

	.dot {
		width: 4px;
		height: 4px;
		background-color: white;
		border-radius: 50%;
		box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
	}

	.small .dot {
		width: 3px;
		height: 3px;
	}
</style>
