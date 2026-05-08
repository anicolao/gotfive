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

	const COLOR_SYMBOL: Record<string, string> = {
		Red: 'R',
		Blue: 'B',
		Yellow: 'Y',
		Green: 'G',
		Purple: 'P'
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
				<div class="color-symbol">{COLOR_SYMBOL[tileColor]}</div>
			{:else}
				<div class="back-pattern"></div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.tile {
		width: var(--tile-width, 60px);
		height: var(--tile-height, 84px);
		background-color: var(--tile-color);
		border: 2px solid #795548;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4px;
		box-sizing: border-box;
		position: relative;
		box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
		user-select: none;
		color: white;
	}

	@media (max-width: 600px) {
		.tile {
			--tile-width: 45px;
			--tile-height: 63px;
			border-width: 1px;
			border-radius: 4px;
		}

		.number {
			font-size: 16px !important;
		}

		.dot {
			width: 6px !important;
			height: 6px !important;
		}

		.sassy-face {
			height: 30px !important;
		}

		.eyes {
			gap: 4px !important;
		}

		.eye {
			width: 4px !important;
			height: 4px !important;
		}

		.mouth {
			width: 10px !important;
		}
	}

	@media (max-width: 350px) {
		.tile {
			--tile-width: 35px;
			--tile-height: 49px;
		}

		.number {
			font-size: 12px !important;
		}

		.dot {
			width: 4px !important;
			height: 4px !important;
		}
		
		.color-symbol {
			font-size: 10px !important;
		}
	}

	.front-content, .back-content {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 4px;
		box-sizing: border-box;
	}

	.face-down {
		border-color: #3e2723;
	}

	.back-pattern {
		width: 100%;
		height: 100%;
		background-image: radial-gradient(rgba(0,0,0,0.2) 10%, transparent 10%);
		background-size: 10px 10px;
	}

	.number {
		font-family: 'Arial Black', sans-serif;
		font-size: 24px;
		color: white;
		line-height: 1;
		text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
	}

	.sassy-face {
		width: 100%;
		height: 40px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 50%;
		padding: 5px;
		box-sizing: border-box;
	}

	.eyes {
		display: flex;
		gap: 8px;
	}

	.eye {
		width: 6px;
		height: 6px;
		background: white;
		border-radius: 50%;
		box-shadow: 1px 1px 1px rgba(0,0,0,0.3);
	}

	.eye.large {
		width: 8px;
		height: 8px;
	}

	.wink {
		height: 2px;
		border-radius: 0;
		margin-top: 3px;
	}

	.star {
		background: none;
		font-size: 10px;
		line-height: 1;
		margin-top: -2px;
		color: white;
		box-shadow: none;
	}

	.mouth {
		width: 14px;
		height: 7px;
		border-bottom: 3px solid white;
		border-radius: 0 0 50% 50%;
		margin-top: 4px;
	}

	.smirk {
		width: 12px;
		transform: rotate(-10deg);
	}

	.o-mouth {
		width: 8px;
		height: 8px;
		border: 3px solid white;
		border-radius: 50%;
	}

	.o-mouth.large {
		width: 10px;
		height: 10px;
	}

	.neutral {
		width: 12px;
		height: 0;
		border-bottom: 3px solid white;
		border-radius: 0;
		margin-top: 8px;
	}

	.dots {
		display: flex;
		gap: 2px;
		margin-bottom: 4px;
	}

	.dot {
		width: 8px;
		height: 8px;
		background-color: white;
		border-radius: 50%;
		box-shadow: 1px 1px 1px rgba(0,0,0,0.3);
	}

	.color-symbol {
		font-weight: bold;
		font-size: 14px;
		opacity: 0.8;
	}
</style>
