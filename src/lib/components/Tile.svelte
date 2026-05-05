<script lang="ts">
	import { getTileData, type TileData } from '../game/tiles';

	export let id: number | null = null;
	export let faceDown: boolean = false;

	$: data = id !== null ? getTileData(id) : null;

	const COLOR_MAP: Record<string, string> = {
		Red: '#D84315',
		Blue: '#1565C0',
		Yellow: '#F9A825',
		Green: '#2E7D32',
		Purple: '#6A1B9A'
	};
</script>

<div class="tile" class:face-down={faceDown} style="--tile-color: {data ? COLOR_MAP[data.color] : '#795548'}">
	{#if !faceDown && data}
		<div class="sassy-face">
			{#if data.id % 3 === 0}
				<!-- Winking -->
				<div class="eyes">
					<div class="eye"></div>
					<div class="eye wink"></div>
				</div>
				<div class="mouth smile"></div>
			{:else if data.id % 3 === 1}
				<!-- Smirking -->
				<div class="eyes">
					<div class="eye"></div>
					<div class="eye"></div>
				</div>
				<div class="mouth smirk"></div>
			{:else}
				<!-- Star eyes (simplified) -->
				<div class="eyes">
					<div class="eye star">★</div>
					<div class="eye star">★</div>
				</div>
				<div class="mouth o-mouth"></div>
			{/if}
		</div>
		<div class="number">{data.id}</div>
		<div class="dots">
			{#each Array(data.dots) as _}
				<div class="dot"></div>
			{/each}
		</div>
	{:else}
		<div class="back-pattern"></div>
	{/if}
</div>

<style>
	.tile {
		width: 60px;
		height: 84px;
		background-color: #fff9c4;
		border: 2px solid #795548;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 4px;
		box-sizing: border-box;
		position: relative;
		box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
		user-select: none;
	}

	.face-down {
		background-color: #795548;
		border-color: #3e2723;
	}

	.back-pattern {
		width: 100%;
		height: 100%;
		background-image: radial-gradient(#3e2723 10%, transparent 10%);
		background-size: 10px 10px;
	}

	.number {
		font-family: 'Arial Black', sans-serif;
		font-size: 24px;
		color: var(--tile-color);
		line-height: 1;
	}

	.sassy-face {
		width: 100%;
		height: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.eyes {
		display: flex;
		gap: 8px;
	}

	.eye {
		width: 4px;
		height: 4px;
		background: black;
		border-radius: 50%;
	}

	.wink {
		height: 1px;
		border-radius: 0;
		margin-top: 2px;
	}

	.star {
		background: none;
		font-size: 8px;
		line-height: 1;
		margin-top: -2px;
	}

	.mouth {
		width: 10px;
		height: 5px;
		border-bottom: 2px solid black;
		border-radius: 0 0 50% 50%;
	}

	.smirk {
		width: 8px;
		transform: rotate(-10deg);
	}

	.o-mouth {
		width: 6px;
		height: 6px;
		border: 2px solid black;
		border-radius: 50%;
	}

	.dots {
		display: flex;
		gap: 2px;
		margin-bottom: 4px;
	}

	.dot {
		width: 6px;
		height: 6px;
		background-color: var(--tile-color);
		border-radius: 50%;
	}
</style>
