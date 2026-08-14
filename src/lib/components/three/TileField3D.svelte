<script lang="ts">
	import { onMount } from 'svelte';
	import { registerTileField, type SceneTile } from './tileSceneRegistry';

	let {
		tiles = [] as SceneTile[],
		columns = 5,
		rack = false,
		background = true,
		fit,
		anchors,
		label = '3D tile display'
	}: {
		tiles?: SceneTile[];
		columns?: number;
		rack?: boolean;
		background?: boolean;
		fit?: number;
		anchors?: HTMLElement[];
		label?: string;
	} = $props();

	let element: HTMLDivElement;
	let registration: ReturnType<typeof registerTileField> | undefined;

	onMount(() => {
		registration = registerTileField({ element, tiles, columns, rack, background, fit, anchors, label });
		return () => registration?.unregister();
	});

	$effect(() => {
		registration?.update({ tiles, columns, rack, background, fit, anchors, label });
	});
</script>

<div
	bind:this={element}
	class="tile-field-3d"
	class:rack
	data-tile-orientation={tiles.some((tile) => tile.rotationZ) ? 'tilted' : 'upright'}
	aria-hidden="true"
	aria-label={label}
></div>

<style>
	.tile-field-3d {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
</style>
