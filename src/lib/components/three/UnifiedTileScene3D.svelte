<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { onMount } from 'svelte';
	import { WebGLRenderer } from 'three';
	import UnifiedTileScene, { type MeasuredTileField } from './UnifiedTileScene.svelte';
	import { tileSceneFields } from './tileSceneRegistry';

	let { inspect3D = false }: { inspect3D?: boolean } = $props();

	let element: HTMLDivElement;
	let layoutRevision = $state(0);
	let dpr = $state(1);

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

	onMount(() => {
		dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
	});

	$effect(() => {
		const observed = [element, ...$tileSceneFields.map((field) => field.element)].filter(Boolean);
		if (observed.length === 0) return;

		const refresh = () => layoutRevision += 1;
		const resizeObserver = new ResizeObserver(refresh);
		for (const current of observed) resizeObserver.observe(current);
		window.addEventListener('resize', refresh);
		window.addEventListener('scroll', refresh, true);
		const refreshFrame = requestAnimationFrame(refresh);

		return () => {
			cancelAnimationFrame(refreshFrame);
			resizeObserver.disconnect();
			window.removeEventListener('resize', refresh);
			window.removeEventListener('scroll', refresh, true);
		};
	});

	let measuredFields = $derived.by(() => {
		layoutRevision;
		if (!element) return [] as MeasuredTileField[];
		const rootRect = element.getBoundingClientRect();

		return $tileSceneFields
			.filter((field) => field.element.isConnected)
			.map((field) => {
				const rect = field.element.getBoundingClientRect();
				return {
					...field,
					x: rect.left - rootRect.left,
					y: rect.top - rootRect.top,
					width: rect.width,
					height: rect.height
				};
			});
	});
</script>

<div
	bind:this={element}
	class="unified-tile-scene"
	class:inspect={inspect3D}
	data-field-count={measuredFields.length}
	aria-hidden="true"
>
	<Canvas {createRenderer} {dpr} shadows={false} renderMode="on-demand">
		<UnifiedTileScene fields={measuredFields} {inspect3D} />
	</Canvas>
</div>

<style>
	.unified-tile-scene {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.62));
	}

	.unified-tile-scene.inspect {
		z-index: 30;
		pointer-events: auto;
		cursor: grab;
		touch-action: none;
	}

	.unified-tile-scene.inspect:active {
		cursor: grabbing;
	}

	.unified-tile-scene :global(canvas) {
		pointer-events: none;
	}

	.unified-tile-scene.inspect :global(canvas) {
		pointer-events: auto;
	}
</style>
