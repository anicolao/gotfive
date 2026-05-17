<script lang="ts">
	import { getTileData, type TileData, type TileColor } from '../game/tiles';

	export let id: number | null = null;
	export let faceDown: boolean = false;
	export let color: TileColor | null = null;

	$: data = id !== null ? getTileData(id) : null;
	$: tileColor = data ? data.color : color;

	const COLOR_MAP: Record<string, string> = {
		Red: '#D84315',
		Blue: '#1565C0',
		Yellow: '#F9A825',
		Green: '#2E7D32',
		Purple: '#6A1B9A'
	};
</script>

<div class="tile" class:face-down={faceDown} style="--tile-color: {tileColor ? COLOR_MAP[tileColor] : '#795548'}">
	{#if !faceDown && data}
		<div class="front-content">
			<div class="number">{data.id}</div>
			<div class="dots">
				{#each Array(data.dots) as _}
					<div class="dot"></div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="back-content">
			{#if tileColor}
				<div class="sassy-face {tileColor.toLowerCase()}">
					{#if tileColor === 'Red'}
						<!-- Winking -->
						<div class="eyes">
							<div class="eye"></div>
							<div class="eye wink"></div>
						</div>
						<div class="mouth smile"></div>
					{:else if tileColor === 'Blue'}
						<!-- Smirking -->
						<div class="eyes">
							<div class="eye"></div>
							<div class="eye"></div>
						</div>
						<div class="mouth smirk"></div>
					{:else if tileColor === 'Yellow'}
						<!-- Star eyes -->
						<div class="eyes">
							<div class="eye star">★</div>
							<div class="eye star">★</div>
						</div>
						<div class="mouth o-mouth"></div>
					{:else if tileColor === 'Green'}
						<!-- Surprised -->
						<div class="eyes">
							<div class="eye large"></div>
							<div class="eye large"></div>
						</div>
						<div class="mouth o-mouth large"></div>
					{:else if tileColor === 'Purple'}
						<!-- Neutral -->
						<div class="eyes">
							<div class="eye"></div>
							<div class="eye"></div>
						</div>
						<div class="mouth neutral"></div>
					{/if}
				</div>
			{:else}
				<div class="back-pattern"></div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.tile {
	        width: var(--tile-size, 60px);
	        height: var(--tile-size, 60px);
	        background-color: var(--tile-color);
	        border: 2px solid rgba(255, 255, 255, 0.3);
	        border-radius: calc(var(--tile-size) * 0.15);
	        display: flex;
	        flex-direction: column;
	        align-items: center;
	        justify-content: center;
	        padding: 2px;
	        box-sizing: border-box;
	        position: relative;
	        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(0, 0, 0, 0.2);
	        user-select: none;
	        color: white;
	}

	.front-content, .back-content {
	        width: 100%;
	        height: 100%;
	        display: flex;
	        flex-direction: column;
	        align-items: center;
	        justify-content: center;
	        padding: calc(var(--tile-size) * 0.05);
	        box-sizing: border-box;
	        gap: calc(var(--tile-size) * 0.05);
	}
	.face-down {
		border-color: rgba(255, 255, 255, 0.1);
	}


	.back-pattern {
		width: 100%;
		height: 100%;
		background-image: radial-gradient(rgba(0,0,0,0.2) 10%, transparent 10%);
		background-size: calc(var(--tile-size) * 0.15) calc(var(--tile-size) * 0.15);
	}

	.number {
		font-family: 'Arial Black', sans-serif;
		font-size: calc(var(--tile-size) * 0.4);
		color: white;
		line-height: 1;
		text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
	}

	.sassy-face {
		width: 100%;
		height: calc(var(--tile-size) * 0.6);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 50%;
		padding: calc(var(--tile-size) * 0.08);
		box-sizing: border-box;
	}

	.eyes {
		display: flex;
		gap: calc(var(--tile-size) * 0.1);
	}

	.eye {
		width: calc(var(--tile-size) * 0.08);
		height: calc(var(--tile-size) * 0.08);
		background: white;
		border-radius: 50%;
		box-shadow: 1px 1px 1px rgba(0,0,0,0.3);
	}

	.eye.large {
		width: calc(var(--tile-size) * 0.12);
		height: calc(var(--tile-size) * 0.12);
	}

	.wink {
		height: 2px;
		border-radius: 0;
		margin-top: calc(var(--tile-size) * 0.04);
	}

	.star {
		background: none;
		font-size: calc(var(--tile-size) * 0.15);
		line-height: 1;
		margin-top: calc(var(--tile-size) * -0.03);
		color: white;
		box-shadow: none;
	}

	.mouth {
		width: calc(var(--tile-size) * 0.2);
		height: calc(var(--tile-size) * 0.1);
		border-bottom: 3px solid white;
		border-radius: 0 0 50% 50%;
		margin-top: calc(var(--tile-size) * 0.05);
	}

	.smirk {
		width: calc(var(--tile-size) * 0.18);
		transform: rotate(-10deg);
	}

	.o-mouth {
		width: calc(var(--tile-size) * 0.12);
		height: calc(var(--tile-size) * 0.12);
		border: 3px solid white;
		border-radius: 50%;
	}

	.o-mouth.large {
		width: calc(var(--tile-size) * 0.15);
		height: calc(var(--tile-size) * 0.15);
	}

	.neutral {
		width: calc(var(--tile-size) * 0.18);
		height: 0;
		border-bottom: 3px solid white;
		border-radius: 0;
		margin-top: calc(var(--tile-size) * 0.1);
	}

	.dots {
		display: flex;
		gap: calc(var(--tile-size) * 0.04);
		margin-bottom: calc(var(--tile-size) * 0.05);
	}

	.dot {
		width: calc(var(--tile-size) * 0.12);
		height: calc(var(--tile-size) * 0.12);
		background-color: white;
		border-radius: 50%;
		box-shadow: 1px 1px 1px rgba(0,0,0,0.3);
	}

	.color-symbol {
		font-weight: bold;
		font-size: calc(var(--tile-size) * 0.2);
		opacity: 0.8;
	}
</style>
