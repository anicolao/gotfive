<script lang="ts">
	import { T } from '@threlte/core';
	import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
	import LozengeTile3D from './LozengeTile3D.svelte';
	import type { SceneTile } from './tileSceneRegistry';

	let {
		tiles = [] as SceneTile[],
		columns = 5,
		rack = false,
		showTiles = true,
		position = [0, 0, 0] as [number, number, number],
		scale = 1
	}: {
		tiles?: SceneTile[];
		columns?: number;
		rack?: boolean;
		showTiles?: boolean;
		position?: [number, number, number];
		scale?: number;
	} = $props();

	let tileSpacingX = $derived(rack ? 1.52 : 1.22);
	let tileSpacingY = $derived(1.24);
	let effectiveColumns = $derived(Math.max(1, Math.min(columns, tiles.length || columns)));
	let rows = $derived(Math.max(1, Math.ceil(tiles.length / effectiveColumns)));
	let fieldWidth = $derived((effectiveColumns - 1) * tileSpacingX + 1.18);
	let fieldHeight = $derived((rows - 1) * tileSpacingY + (rack ? 1.24 : 1.18));
	let baseGeometry = $derived(new RoundedBoxGeometry(fieldWidth, fieldHeight, 0.28, 5, 0.14));

	function tilePosition(index: number): [number, number, number] {
		const row = Math.floor(index / effectiveColumns);
		const itemsInRow = Math.min(effectiveColumns, tiles.length - row * effectiveColumns);
		const column = index % effectiveColumns;
		return [
			(column - (itemsInRow - 1) / 2) * tileSpacingX,
			((rows - 1) / 2 - row) * tileSpacingY + (rack ? 0.025 : 0),
			0.18
		];
	}
</script>

<T.Group {position} scale={[scale, scale, scale]}>
	<T.Mesh geometry={baseGeometry} position={[0, rack ? -0.015 : 0, -0.29]} receiveShadow>
		<T.MeshPhysicalMaterial
			color={rack ? '#142a34' : '#101923'}
			roughness={0.34}
			metalness={0.46}
			clearcoat={0.7}
			clearcoatRoughness={0.2}
		/>
	</T.Mesh>

	{#if rack}
		<T.Mesh position={[0, -fieldHeight / 2 + 0.035, 0.04]} scale={[fieldWidth, 0.055, 0.08]}>
			<T.BoxGeometry args={[1, 1, 1]} />
			<T.MeshBasicMaterial color="#00e5ff" toneMapped={false} />
		</T.Mesh>
	{/if}

	{#if showTiles}
		{#each tiles as tile, index (tile.key)}
			<LozengeTile3D
				id={tile.id ?? null}
				color={tile.color ?? null}
				faceDown={tile.faceDown ?? false}
				selected={tile.selected ?? false}
				correct={tile.correct ?? false}
				pileCount={tile.pileCount}
				position={tilePosition(index)}
				motionKey={tile.motionKey ?? tile.key}
			/>
		{/each}
	{/if}
</T.Group>
