<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import OrbitInspectionControls from './OrbitInspectionControls.svelte';
	import TileFieldGroup3D from './TileFieldGroup3D.svelte';
	import type { TileFieldRegistration } from './tileSceneRegistry';

	export type MeasuredTileField = TileFieldRegistration & {
		x: number;
		y: number;
		width: number;
		height: number;
	};

	let {
		fields = [] as MeasuredTileField[],
		inspect3D = false
	}: {
		fields?: MeasuredTileField[];
		inspect3D?: boolean;
	} = $props();

	const { size } = useThrelte();
	const cameraFov = 10;
	let viewportWidth = $derived(Math.max(1, $size.width));
	let viewportHeight = $derived(Math.max(1, $size.height));
	let cameraDistance = $derived(viewportHeight / (2 * Math.tan((cameraFov * Math.PI) / 360)));

	function metrics(field: MeasuredTileField) {
		const tileSpacingX = field.rack ? 1.28 : 1.22;
		const tileSpacingY = 1.24;
		const effectiveColumns = Math.max(1, Math.min(field.columns, field.tiles.length || field.columns));
		const rows = Math.max(1, Math.ceil(field.tiles.length / effectiveColumns));
		const worldWidth = (effectiveColumns - 1) * tileSpacingX + 1.18;
		const worldHeight = (rows - 1) * tileSpacingY + (field.rack ? 1.24 : 1.18);
		const padding = field.rack ? 0.98 : 0.94;
		return {
			position: [
				field.x + field.width / 2 - viewportWidth / 2,
				viewportHeight / 2 - field.y - field.height / 2,
				0
			] as [number, number, number],
			scale: Math.max(0.01, Math.min(field.width / worldWidth, field.height / worldHeight) * padding)
		};
	}
</script>

<T.PerspectiveCamera
	makeDefault
	fov={cameraFov}
	near={1}
	far={cameraDistance + 4000}
	position={[0, 0, cameraDistance]}
/>

{#if inspect3D}
	<OrbitInspectionControls
		target={[0, 0, 0]}
		minDistance={cameraDistance * 0.35}
		maxDistance={cameraDistance * 2.5}
	/>
{/if}

<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[-600, 900, 1400]} intensity={1.75} color="#e6fbff" />
<T.DirectionalLight position={[800, -300, 1000]} intensity={0.8} color="#ff63d8" />

{#each fields as field (field.id)}
	{@const fieldMetrics = metrics(field)}
	<TileFieldGroup3D
		tiles={field.tiles}
		columns={field.columns}
		rack={field.rack}
		position={fieldMetrics.position}
		scale={fieldMetrics.scale}
	/>
{/each}
