<script lang="ts">
	import Tile from './Tile.svelte';

	export let id: string;
	export let name: string;
	export let hand: number[] = [];
	export let isLocalPlayer: boolean = false;
	export let isCurrentTurn: boolean = false;
	export let clues: any[] = [];
	export let canBeTarget: boolean = false;
	export let onSelectTarget: (id: string) => void = () => {};
	export let onSelectSlot: (id: string, slot: number) => void = () => {};

	$: sortClues = clues.filter((c) => c.type === 'SORT');
	$: compareClues = clues.filter((c) => c.type === 'COMPARE');

	function getSortClueTiles(notch: number) {
		return sortClues.filter((c) => c.result === notch).map((c) => c.tileId);
	}

	function getCompareCluesForSlot(slot: number) {
		return compareClues.filter((c) => c.targetSlot === slot);
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="stand-container" class:can-target={canBeTarget} class:current-turn={isCurrentTurn} on:click={() => canBeTarget && onSelectTarget(id)}>
	<div class="name-tag">{name} {isCurrentTurn ? '★' : ''}</div>
	<div class="stand">
		<div class="tiles-area">
			{#each Array(5) as _, i}
				<div class="notch n{i}" class:active={getSortClueTiles(i).length > 0}>
					{#if getSortClueTiles(i).length > 0}
						<div class="clue-stack">
							{#each getSortClueTiles(i) as tileId}
								<div class="clue-pill">{tileId}</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="slot" on:click|stopPropagation={() => canBeTarget && onSelectSlot(id, i)}>
					{#if hand[i]}
						<Tile id={hand[i]} faceDown={isLocalPlayer} />
					{:else}
						<div class="empty-slot"></div>
					{/if}
					<div class="compare-indicators">
						{#each getCompareCluesForSlot(i) as clue}
							<div class="compare-dot" class:match={clue.result} title="Tile {clue.tileId}"></div>
						{/each}
					</div>
				</div>
			{/each}
			<div class="notch n5" class:active={getSortClueTiles(5).length > 0}>
				{#if getSortClueTiles(5).length > 0}
					<div class="clue-stack">
						{#each getSortClueTiles(5) as tileId}
							<div class="clue-pill">{tileId}</div>
						{/each}
					</div>
				{/if}
			</div>
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
		transition: transform 0.2s, filter 0.2s;
	}

	.current-turn .name-tag {
		background-color: var(--color-avocado);
		animation: pulse 2s infinite;
	}

	.current-turn .stand {
		filter: drop-shadow(0 0 10px var(--color-avocado));
	}

	@keyframes pulse {
		0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); }
		70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
		100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
	}

	.can-target {
		cursor: pointer;
	}

	.can-target:hover {
		transform: scale(1.05);
	}

	.can-target .stand {
		filter: drop-shadow(0 0 15px var(--color-gold));
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

	.tiles-area {
		display: grid;
		grid-template-columns: repeat(5, auto 60px) auto;
		align-items: center;
		background-color: #4e342e;
		padding: 12px 8px 8px 8px;
		border-radius: 8px 8px 0 0;
		gap: 4px;
	}

	.slot {
		width: 60px;
		height: 84px;
		position: relative;
		cursor: inherit;
	}

	.slot:hover {
		filter: brightness(1.2);
	}

	.empty-slot {
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}

	.notch {
		width: 10px;
		height: 10px;
		background: #3e2723;
		border-radius: 50%;
		position: relative;
		display: flex;
		justify-content: center;
		align-self: flex-end;
		margin-bottom: 10px;
	}

	.notch.active {
		background: var(--color-gold);
		box-shadow: 0 0 8px var(--color-gold);
	}

	.clue-stack {
		position: absolute;
		bottom: 15px;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 2px;
	}

	.clue-pill {
		background: var(--color-cream);
		color: var(--color-wood);
		font-size: 9px;
		font-weight: bold;
		padding: 1px 4px;
		border-radius: 4px;
		border: 1px solid var(--color-wood);
		white-space: nowrap;
	}

	.compare-indicators {
		position: absolute;
		top: -8px;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 3px;
	}

	.compare-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-orange);
		border: 1px solid rgba(0, 0, 0, 0.3);
	}

	.compare-dot.match {
		background: var(--color-avocado);
		box-shadow: 0 0 5px var(--color-avocado);
	}

	.base {
		height: 15px;
		background-color: var(--color-wood);
		width: 100%;
		border-radius: 0 0 4px 4px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
	}
</style>
