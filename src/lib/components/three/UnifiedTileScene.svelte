<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { getTileData } from '$lib/game/tiles';
	import OrbitInspectionControls from './OrbitInspectionControls.svelte';
	import MovingTile3D from './MovingTile3D.svelte';
	import TileFieldGroup3D from './TileFieldGroup3D.svelte';
	import type { SceneTile, TileFieldRegistration } from './tileSceneRegistry';

	export type MeasuredTileField = TileFieldRegistration & {
		x: number;
		y: number;
		width: number;
		height: number;
		anchorRects?: Array<{ x: number; y: number; width: number; height: number }>;
	};

	let {
		fields = [] as MeasuredTileField[],
		inspect3D = false,
		onMotionStart = () => {},
		onMotionEnd = () => {}
	}: {
		fields?: MeasuredTileField[];
		inspect3D?: boolean;
		onMotionStart?: (key: string, from: string, to: string) => void;
		onMotionEnd?: (key: string) => void;
	} = $props();

	const { size } = useThrelte();
	const cameraFov = 10;
	let viewportWidth = $derived(Math.max(1, $size.width));
	let viewportHeight = $derived(Math.max(1, $size.height));
	let cameraDistance = $derived(viewportHeight / (2 * Math.tan((cameraFov * Math.PI) / 360)));
	let cameraNear = $derived(cameraDistance * 0.05);
	let cameraFar = $derived(cameraDistance * 3);

	type FieldMetrics = {
		position: [number, number, number];
		scale: number;
		effectiveColumns: number;
		rows: number;
		tileSpacingX: number;
		tileSpacingY: number;
	};

	type PlacedTile = {
		tile: SceneTile;
		position: [number, number, number];
		scale: number;
		destination: string;
		originPosition?: [number, number, number];
		originScale?: number;
		originLabel?: string;
	};

	function metrics(field: MeasuredTileField): FieldMetrics {
		const tileSpacingX = field.rack ? 1.52 : 1.22;
		const tileSpacingY = 1.24;
		const effectiveColumns = Math.max(1, Math.min(field.columns, field.tiles.length || field.columns));
		const rows = Math.max(1, Math.ceil(field.tiles.length / effectiveColumns));
		const worldWidth = (effectiveColumns - 1) * tileSpacingX + 1.18;
		const worldHeight = (rows - 1) * tileSpacingY + (field.rack ? 1.24 : 1.18);
		const padding = field.anchors ? (field.rack ? 0.98 : 0.94) : (field.fit ?? (field.rack ? 0.98 : 0.94));
		return {
			position: [
				field.x + field.width / 2 - viewportWidth / 2,
				viewportHeight / 2 - field.y - field.height / 2,
				0
			] as [number, number, number],
			scale: Math.max(0.01, Math.min(field.width / worldWidth, field.height / worldHeight) * padding),
			effectiveColumns,
			rows,
			tileSpacingX,
			tileSpacingY
		};
	}

	function placedPosition(field: MeasuredTileField, fieldMetrics: FieldMetrics, index: number): [number, number, number] {
		const anchor = field.anchorRects?.[index];
		if (anchor) {
			return [
				anchor.x + anchor.width / 2 - viewportWidth / 2,
				viewportHeight / 2 - anchor.y - anchor.height / 2,
				0.18 * placedScale(field, fieldMetrics, index)
			];
		}
		const row = Math.floor(index / fieldMetrics.effectiveColumns);
		const itemsInRow = Math.min(
			fieldMetrics.effectiveColumns,
			field.tiles.length - row * fieldMetrics.effectiveColumns
		);
		const column = index % fieldMetrics.effectiveColumns;
		return [
			fieldMetrics.position[0] + (column - (itemsInRow - 1) / 2) * fieldMetrics.tileSpacingX * fieldMetrics.scale,
			fieldMetrics.position[1] + ((fieldMetrics.rows - 1) / 2 - row) * fieldMetrics.tileSpacingY * fieldMetrics.scale + (field.rack ? 0.025 * fieldMetrics.scale : 0),
			0.18 * fieldMetrics.scale
		];
	}

	function placedScale(field: MeasuredTileField, fieldMetrics: FieldMetrics, index: number) {
		const anchor = field.anchorRects?.[index];
		if (!anchor) return fieldMetrics.scale;
		return Math.max(0.01, Math.min(anchor.width / 1.18, anchor.height / 1.18) * (field.fit ?? 0.94));
	}

	let fieldLayouts = $derived(fields.map((field) => ({ field, metrics: metrics(field) })));
	let placedTiles = $derived.by(() => {
		const placements: PlacedTile[] = [];
		const deckOrigins = new Map<string, { position: [number, number, number]; scale: number; label: string }>();

		for (const layout of fieldLayouts) {
			layout.field.tiles.forEach((tile, index) => {
				const deckColor = layout.field.label === 'Five 3D draw decks'
					? (tile.color ?? (tile.id == null ? undefined : getTileData(tile.id).color))
					: undefined;
				const placement = {
					tile,
					position: placedPosition(layout.field, layout.metrics, index),
					scale: placedScale(layout.field, layout.metrics, index),
					destination: deckColor ? `${deckColor} draw deck` : layout.field.label
				};
				placements.push(placement);
				if (deckColor) {
					deckOrigins.set(deckColor, {
						position: placement.position,
						scale: placement.scale,
						label: `${deckColor} draw deck`
					});
				}
			});
		}

		const uniquePlacements = new Map<string, PlacedTile>();
		for (const placement of placements) {
			uniquePlacements.set(placement.tile.key, placement);
		}

		return [...uniquePlacements.values()].map((placement) => {
			if (placement.tile.id == null) return placement;
			const origin = deckOrigins.get(getTileData(placement.tile.id).color);
			return origin ? {
				...placement,
				originPosition: origin.position,
				originScale: origin.scale,
				originLabel: origin.label
			} : placement;
		});
	});
</script>

<T.PerspectiveCamera
	makeDefault
	fov={cameraFov}
	near={cameraNear}
	far={cameraFar}
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

{#each fieldLayouts as layout (layout.field.id)}
	{#if layout.field.background}
		<TileFieldGroup3D
			tiles={layout.field.tiles}
			columns={layout.field.columns}
			rack={layout.field.rack}
			showTiles={false}
			position={layout.metrics.position}
			scale={layout.metrics.scale}
		/>
	{/if}
{/each}

{#each placedTiles as placement (placement.tile.key)}
	<MovingTile3D
		tile={placement.tile}
		position={placement.position}
		scale={placement.scale}
		destination={placement.destination}
		originPosition={placement.originPosition}
		originScale={placement.originScale}
		originLabel={placement.originLabel}
		{onMotionStart}
		{onMotionEnd}
	/>
{/each}
