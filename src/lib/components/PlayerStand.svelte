<script lang="ts">
	import Tile from './Tile.svelte';
	import MiniTile from './MiniTile.svelte';
	import type { ClueRecord } from '../store/playersSlice';

	let { 
		id, 
		name, 
		hand = [], 
		isLocalPlayer = false, 
		isCurrentTurn = false, 
		clues = [] as ClueRecord[], 
		canBeTarget = false, 
		onSelectTarget = () => {}, 
		onSelectSlot = () => {} 
	} = $props();

	let sortClues = $derived(clues.filter((c: ClueRecord) => c.type === 'SORT'));
	let compareClues = $derived(clues.filter((c: ClueRecord) => c.type === 'COMPARE'));

	function getSortClueTiles(notch: number) {
		return sortClues.filter((c: ClueRecord) => c.result === notch).map((c: ClueRecord) => c.tileId);
	}

	function getCompareCluesForSlot(slot: number) {
		return compareClues.filter((c: ClueRecord) => c.targetSlot === slot);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="stand-container" class:can-target={canBeTarget} class:current-turn={isCurrentTurn} onclick={() => canBeTarget && onSelectTarget(id)}>
	<div class="name-tag">{name} {isCurrentTurn ? '★' : ''}</div>
	<div class="stand">
		<div class="tiles-area">
			{#each Array(5) as _, i}
				<div class="notch n{i}" class:active={getSortClueTiles(i).length > 0}>
					{#if getSortClueTiles(i).length > 0}
						<div class="clue-stack">
							{#each getSortClueTiles(i) as tileId}
								<MiniTile id={tileId} size="small" />
							{/each}
						</div>
					{/if}
				</div>
				<div class="slot" onclick={(e) => { e.stopPropagation(); canBeTarget && onSelectSlot(id, i); }}>
					{#if hand[i]}
						<Tile id={hand[i]} faceDown={isLocalPlayer} />
					{:else}
						<div class="empty-slot"></div>
					{/if}
					<div class="compare-indicators">
						{#each getCompareCluesForSlot(i) as clue}
							<div class="compare-clue" class:no-match={!clue.result}>
								<MiniTile id={clue.tileId} size="small" />
							</div>
						{/each}
					</div>
				</div>
			{/each}
			<div class="notch n5" class:active={getSortClueTiles(5).length > 0}>
				{#if getSortClueTiles(5).length > 0}
					<div class="clue-stack">
						{#each getSortClueTiles(5) as tileId}
							<MiniTile id={tileId} size="small" />
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
		background-color: var(--color-neon-cyan);
		color: #000;
		animation: pulse 2s infinite;
	}

	.current-turn .stand {
		filter: drop-shadow(0 0 10px var(--color-neon-cyan));
	}

	@keyframes pulse {
		0% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0.7); }
		70% { box-shadow: 0 0 0 10px rgba(0, 229, 255, 0); }
		100% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
	}

	.can-target {
		cursor: pointer;
	}

	.can-target:hover {
		transform: scale(1.05);
	}

	.can-target .stand {
		filter: drop-shadow(0 0 15px var(--color-neon-yellow));
	}

	.name-tag {
		background-color: rgba(0, 0, 0, 0.6);
		color: var(--color-neon-yellow);
		padding: 4px 12px;
		border-radius: 4px;
		font-weight: bold;
		text-transform: uppercase;
		border: 1px solid var(--color-neon-yellow);
		box-shadow: 0 0 5px rgba(255, 234, 0, 0.3);
	}

	.stand {
		position: relative;
		padding-bottom: 20px;
		max-width: 100%;
	}

	.tiles-area {
		display: grid;
		grid-template-columns: repeat(5, auto 60px) auto;
		align-items: center;
		background: rgba(31, 40, 51, 0.8);
		backdrop-filter: blur(10px);
		border: 1px solid var(--color-glass-border);
		padding: 12px 8px 8px 8px;
		border-radius: 12px 12px 0 0;
		gap: 4px;
	}

	@media (max-width: 600px) {
		.tiles-area {
			grid-template-columns: repeat(5, auto 45px) auto;
			gap: 2px;
			padding: 8px 4px 4px 4px;
		}

		.slot {
			width: 45px;
			height: 63px;
		}

		.notch {
			width: 8px;
			height: 8px;
			margin-bottom: 5px;
		}
		
		.name-tag {
			font-size: 0.8rem;
			padding: 2px 8px;
		}
	}

	@media (max-width: 350px) {
		.tiles-area {
			grid-template-columns: repeat(5, auto 35px) auto;
			gap: 1px;
		}

		.slot {
			width: 35px;
			height: 49px;
		}
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
		background-color: rgba(0, 0, 0, 0.5);
		border: 1px dashed var(--color-text-muted);
		border-radius: 8px;
	}

	.notch {
		width: 10px;
		height: 10px;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid var(--color-text-muted);
		border-radius: 50%;
		position: relative;
		display: flex;
		justify-content: center;
		align-self: flex-end;
		margin-bottom: 10px;
	}

	.notch.active {
		background: var(--color-neon-yellow);
		box-shadow: 0 0 8px var(--color-neon-yellow);
		border-color: var(--color-neon-yellow);
	}

	.clue-stack {
		position: absolute;
		bottom: 15px;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 2px;
		z-index: 10;
	}

	.compare-indicators {
		position: absolute;
		top: -20px;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 3px;
		z-index: 10;
	}

	.compare-clue {
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.compare-clue.no-match {
		transform: rotate(-15deg) translateY(2px);
	}

	.base {
		height: 15px;
		background: rgba(0, 0, 0, 0.7);
		border-left: 1px solid var(--color-glass-border);
		border-right: 1px solid var(--color-glass-border);
		border-bottom: 1px solid var(--color-glass-border);
		width: 100%;
		border-radius: 0 0 12px 12px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
	}
</style>
