<script lang="ts">
	import { T } from '@threlte/core';
	import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
	import type { TileColor } from '$lib/game/tiles';
	import LozengeTile3D from './LozengeTile3D.svelte';

	export type SceneTile = {
		key: string;
		id?: number | null;
		color?: TileColor | null;
		faceDown?: boolean;
		selected?: boolean;
		correct?: boolean;
		motionKey?: string | number;
	};

	let {
		tiles = [] as SceneTile[],
		columns = 5,
		rack = false
	}: {
		tiles?: SceneTile[];
		columns?: number;
		rack?: boolean;
	} = $props();

	let tileSpacing = $derived(rack ? 1.7 : 2.05);
	let rows = $derived(Math.max(1, Math.ceil(tiles.length / columns)));
	let fieldWidth = $derived(columns * tileSpacing + 0.4);
	let fieldHeight = $derived((rows - 1) * tileSpacing + (rack ? 1.78 : 1.58));
	let baseGeometry = $derived(new RoundedBoxGeometry(fieldWidth, fieldHeight, 0.32, 5, 0.18));

	function tilePosition(index: number): [number, number, number] {
		const row = Math.floor(index / columns);
		const itemsInRow = Math.min(columns, tiles.length - row * columns);
		const column = index % columns;
		return [
			(column - (itemsInRow - 1) / 2) * tileSpacing,
			((rows - 1) / 2 - row) * tileSpacing + (rack ? 0.08 : 0),
			0.2
		];
	}
</script>

<T.PerspectiveCamera
	makeDefault
	fov={14}
	near={0.1}
	far={40}
	position={[0, 0, rack ? 8 : 8 * rows]}
/>

<T.AmbientLight intensity={1.35} />
<T.DirectionalLight position={[-4, 7, 8]} intensity={3.4} color="#d7f8ff" />
<T.DirectionalLight position={[5, -2, 7]} intensity={2.6} color="#ff91e7" />
<T.PointLight position={[0, 2, 5]} intensity={16} color="#fff2c4" distance={14} />

<T.Mesh geometry={baseGeometry} position={[0, rack ? -0.08 : 0, -0.33]} receiveShadow>
	<T.MeshPhysicalMaterial
		color={rack ? '#142a34' : '#101923'}
		roughness={0.34}
		metalness={0.46}
		clearcoat={0.7}
		clearcoatRoughness={0.2}
	/>
</T.Mesh>

{#if rack}
	<T.Mesh position={[0, -fieldHeight / 2 + 0.12, 0.05]} scale={[fieldWidth - 0.45, 0.08, 0.1]}>
		<T.BoxGeometry args={[1, 1, 1]} />
		<T.MeshBasicMaterial color="#00e5ff" toneMapped={false} />
	</T.Mesh>
{/if}

{#each tiles as tile, index (tile.key)}
	<LozengeTile3D
		id={tile.id ?? null}
		color={tile.color ?? null}
		faceDown={tile.faceDown ?? false}
		selected={tile.selected ?? false}
		correct={tile.correct ?? false}
		position={tilePosition(index)}
		motionKey={tile.motionKey ?? tile.key}
	/>
{/each}
