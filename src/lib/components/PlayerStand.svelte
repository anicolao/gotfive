<script lang="ts">
	import Tile from './Tile.svelte';

	export let name: string;
	export let hand: number[] = [];
	export let isLocalPlayer: boolean = false;
	export let clues: any[] = [];
</script>

<div class="stand-container">
	<div class="name-tag">{name}</div>
	<div class="stand">
		<div class="tiles">
			{#each Array(5) as _, i}
				<div class="slot">
					{#if hand[i]}
						<Tile id={hand[i]} faceDown={isLocalPlayer} />
					{:else}
						<div class="empty-slot"></div>
					{/if}
				</div>
			{/each}
		</div>
		<div class="base"></div>
	</div>
</div>

<style>
	.stand-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.name-tag {
		background-color: var(--color-gold);
		color: var(--color-wood);
		padding: 4px 12px;
		border-radius: 4px;
		font-weight: bold;
		text-transform: uppercase;
		border: 2px solid var(--color-wood);
	}

	.stand {
		position: relative;
		padding-bottom: 20px;
	}

	.tiles {
		display: flex;
		gap: 8px;
		background-color: #4e342e;
		padding: 8px;
		border-radius: 4px 4px 0 0;
	}

	.slot {
		width: 60px;
		height: 84px;
	}

	.empty-slot {
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}

	.base {
		height: 15px;
		background-color: var(--color-wood);
		width: 100%;
		border-radius: 0 0 4px 4px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
	}
</style>
