<script lang="ts">
	import Tile from './Tile.svelte';
	import MiniTile from './MiniTile.svelte';
	import TileField3D from './three/TileField3D.svelte';
	import type { ClueRecord } from '../store/playersSlice';

	let { 
		id, 
		name, 
		hand = [], 
		isLocalPlayer = false, 
		revealHand = false,
		correctlyDeducedTileIds = [] as number[],
		isCurrentTurn = false, 
		clues = [] as ClueRecord[], 
		canBeTarget = false, 
		onSelectTarget = () => {}, 
		onSelectSlot = () => {} 
	} = $props();

	let sortClues = $derived(clues.filter((c: ClueRecord) => c.type === 'SORT'));
	let compareClues = $derived(clues.filter((c: ClueRecord) => c.type === 'COMPARE'));
	let sceneTiles = $derived(hand.map((tileId: number, index: number) => ({
		key: `${id}-${tileId}`,
		id: tileId,
		faceDown: isLocalPlayer && !revealHand,
		correct: revealHand && correctlyDeducedTileIds.includes(tileId),
		motionKey: `${clues.length}:${revealHand}:${index}`
	})));

	function getSortClueTiles(notch: number) {
		return sortClues.filter((c: ClueRecord) => c.result === notch).map((c: ClueRecord) => c.tileId);
	}

	function getCompareCluesForSlot(slot: number) {
		return compareClues.filter((c: ClueRecord) => c.targetSlot === slot);
	}

	let pendingSlot = $state<number | null>(null);

	function chooseSort(e?: MouseEvent) {
		e?.stopPropagation();
		pendingSlot = null;
		if (canBeTarget) onSelectTarget(id);
	}

	function chooseMatch(slot: number | null = pendingSlot, e?: MouseEvent) {
		e?.stopPropagation();
		if (slot === null) return;
		pendingSlot = null;
		if (canBeTarget) onSelectSlot(id, slot);
	}

	function chooseTileAction(e: MouseEvent, slot: number) {
		e.stopPropagation();
		if (!canBeTarget) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const tappedLowerThird = e.clientY >= rect.top + rect.height * (2 / 3);
		if (tappedLowerThird) {
			pendingSlot = slot;
		} else {
			chooseMatch(slot);
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="stand-container" class:can-target={canBeTarget} class:current-turn={isCurrentTurn} onclick={chooseSort}>
	<div class="name-tag">{name} {isCurrentTurn ? '★' : ''}</div>
	<div class="stand">
		<TileField3D tiles={sceneTiles} columns={5} rack={true} label={`${name}'s 3D rack`} />
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
				<div class="slot" onclick={(e) => chooseTileAction(e, i)}>
					{#if hand[i]}
						<Tile
							id={hand[i]}
							faceDown={isLocalPlayer && !revealHand}
							correctlyDeduced={revealHand && correctlyDeducedTileIds.includes(hand[i])}
							semanticOnly={true}
						/>
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
		<button class="base" type="button" aria-label="Sort {name}" onclick={chooseSort}></button>
	</div>
	{#if pendingSlot !== null}
		<div class="action-modal" role="dialog" aria-modal="true" aria-label="Choose clue action" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<div class="action-panel">
				<button type="button" class="action-button" onclick={(e) => chooseMatch(pendingSlot, e)}>Match</button>
				<button type="button" class="action-button" onclick={chooseSort}>Sort</button>
				<button type="button" class="action-button secondary" onclick={(e) => { e.stopPropagation(); pendingSlot = null; }}>Cancel</button>
			</div>
		</div>
	{/if}
</div>

<style>
        .stand-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--gap-base);
                transition: transform 0.2s, filter 0.2s;
        }

        .current-turn .name-tag {
                background-color: var(--color-neon-cyan);
                color: #000;
                animation: pulse 2s infinite;
                box-shadow: 0 0 10px var(--color-neon-cyan);
        }

        .current-turn .stand {
                animation: breathing-glow 3s ease-in-out infinite;
        }

        @keyframes breathing-glow {
                0%, 100% { filter: drop-shadow(0 0 5px var(--color-neon-cyan)); }
                50% { filter: drop-shadow(0 0 20px var(--color-neon-cyan)); }
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
                font-size: var(--font-size-small);
        }

        .stand {
                position: relative;
                padding-bottom: 2px;
                max-width: 100%;
				isolation: isolate;
        }

        .tiles-area {
                display: grid;
                grid-template-columns: repeat(5, auto var(--tile-size)) auto;
                align-items: center;
				background: transparent;
				border: 1px solid transparent;
                padding: calc(var(--gap-base) * 1.5) var(--gap-base) var(--gap-base) var(--gap-base);
                border-radius: 12px 12px 0 0;
                gap: var(--gap-base);
				position: relative;
				z-index: 2;
        }

        .slot {
                width: var(--tile-size);
                height: var(--tile-size);
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
                width: calc(var(--tile-size) * 0.15);
                height: calc(var(--tile-size) * 0.15);
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid var(--color-text-muted);
                border-radius: 50%;
                position: relative;
                display: flex;
                justify-content: center;
                align-self: flex-end;
                margin-bottom: calc(var(--tile-size) * 0.1);
        }

        .notch.active {
                background: var(--color-neon-yellow);
                box-shadow: 0 0 8px var(--color-neon-yellow);
                border-color: var(--color-neon-yellow);
        }

        .clue-stack {
                position: absolute;
                bottom: calc(var(--tile-size) * 0.15);
                display: flex;
                flex-direction: column-reverse;
                align-items: center;
                gap: 2px;
                z-index: 10;
        }

        .compare-indicators {
                position: absolute;
                top: calc(var(--tile-size) * -0.6);
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
                display: block;
                height: 16px;
				background: transparent;
				border-left: 1px solid transparent;
				border-right: 1px solid transparent;
				border-bottom: 1px solid transparent;
                border-top: none;
                width: 100%;
                border-radius: 0 0 12px 12px;
				box-shadow: none;
                cursor: inherit;
                padding: 0;
				position: relative;
				z-index: 3;
        }

        .can-target .base {
                border-color: var(--color-neon-yellow);
        }

        .action-modal {
                position: fixed;
                inset: 0;
                z-index: 100;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.55);
        }

        .action-panel {
                display: flex;
                gap: 12px;
                padding: 14px;
                background: var(--color-bg-panel);
                border: 1px solid var(--color-glass-border);
                border-radius: 8px;
                box-shadow: var(--color-glass-shadow);
                backdrop-filter: blur(12px);
        }

        .action-button {
                min-width: 92px;
                min-height: 44px;
                background: rgba(0, 0, 0, 0.7);
                color: var(--color-neon-yellow);
                border: 1px solid var(--color-neon-yellow);
                border-radius: 6px;
                font: inherit;
                font-weight: 700;
                text-transform: uppercase;
                cursor: pointer;
        }

        .action-button.secondary {
                color: var(--color-text-main);
                border-color: var(--color-text-muted);
        }

        @media (orientation: portrait) {
                .stand-container {
                        width: 100%;
                        max-width: 380px;
                }

                .stand {
                        width: 100%;
                }

                .tiles-area {
                        width: 100%;
                        box-sizing: border-box;
                        grid-template-columns:
                                repeat(5, minmax(6px, 0.15fr) minmax(0, 1fr))
                                minmax(6px, 0.15fr);
                        gap: 3px;
                        padding: 4px;
                }

                .slot {
                        width: 100%;
                        height: auto;
                        aspect-ratio: 1;
                }

                .slot :global(.tile) {
                        width: 100%;
                        height: 100%;
                }

                .notch {
                        width: 100%;
                        height: auto;
                        aspect-ratio: 1;
                }

                .base {
                        height: 18px;
                }

                .action-panel {
                        flex-direction: column;
                        width: min(280px, calc(100vw - 32px));
                }
        }
</style>
