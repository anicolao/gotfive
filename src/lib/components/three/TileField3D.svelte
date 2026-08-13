<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { WebGLRenderer } from 'three';
	import TileFieldScene, { type SceneTile } from './TileFieldScene.svelte';

	let {
		tiles = [] as SceneTile[],
		columns = 5,
		rack = false,
		label = '3D tile display'
	}: {
		tiles?: SceneTile[];
		columns?: number;
		rack?: boolean;
		label?: string;
	} = $props();

	function createRenderer(canvas: HTMLCanvasElement) {
		const renderer = new WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			preserveDrawingBuffer: true,
			powerPreference: 'high-performance'
		});
		renderer.setClearColor(0x000000, 0);
		return renderer;
	}
</script>

<div class="tile-field-3d" class:rack aria-hidden="true" aria-label={label}>
	<Canvas {createRenderer} dpr={1} shadows={false} renderMode="on-demand">
		<TileFieldScene {tiles} {columns} {rack} />
	</Canvas>
</div>

<style>
	.tile-field-3d {
		position: absolute;
		inset: 0;
		pointer-events: none;
		filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.58));
	}

	.tile-field-3d.rack {
		filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.65));
	}

	.tile-field-3d :global(canvas) {
		pointer-events: none;
	}
</style>
