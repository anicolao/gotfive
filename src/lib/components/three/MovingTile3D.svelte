<script module lang="ts">
	type MotionSnapshot = {
		position: [number, number, number];
		scale: number;
		destination: string;
		updatedAt: number;
	};

	const motionSnapshots = new Map<string, MotionSnapshot>();
	const snapshotLifetimeMs = 4000;
</script>

<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { onDestroy, onMount } from 'svelte';
	import { Group } from 'three';
	import LozengeTile3D from './LozengeTile3D.svelte';
	import type { SceneTile } from './tileSceneRegistry';

	type Position = [number, number, number];
	type MotionHandler = (key: string, from: string, to: string) => void;

	let {
		tile,
		position,
		scale,
		destination,
		originPosition,
		originScale,
		originLabel,
		onMotionStart = () => {},
		onMotionEnd = () => {}
	}: {
		tile: SceneTile;
		position: Position;
		scale: number;
		destination: string;
		originPosition?: Position;
		originScale?: number;
		originLabel?: string;
		onMotionStart?: MotionHandler;
		onMotionEnd?: (key: string) => void;
	} = $props();

	let group = $state.raw<Group>();
	let reducedMotion = $state(false);
	let revealFromFaceDown = $state(false);
	let initialized = false;
	let active = false;
	let progress = 1;
	let duration = 0.7;
	let arcHeight = 0;
	let fromPosition: Position = [0, 0, 0];
	let targetPosition: Position = [0, 0, 0];
	let fromScale = 1;
	let targetScale = 1;
	let currentDestination = '';

	function copyPosition(value: Position): Position {
		return [value[0], value[1], value[2]];
	}

	function distance(a: Position, b: Position) {
		return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	}

	function remember(currentPosition: Position, currentScale: number, currentDestinationLabel: string) {
		motionSnapshots.set(tile.key, {
			position: copyPosition(currentPosition),
			scale: currentScale,
			destination: currentDestinationLabel,
			updatedAt: Date.now()
		});
	}

	function finishMotion() {
		if (!group) return;
		group.position.set(...targetPosition);
		group.scale.setScalar(targetScale);
		remember(targetPosition, targetScale, currentDestination);
		if (active) {
			active = false;
			onMotionEnd(tile.key);
		}
		stopAnimation();
	}

	function beginMotion(nextPosition: Position, nextScale: number, nextDestination: string, sourceLabel: string) {
		if (!group) return;
		fromPosition = [group.position.x, group.position.y, group.position.z];
		fromScale = group.scale.x;
		targetPosition = copyPosition(nextPosition);
		targetScale = nextScale;
		currentDestination = nextDestination;
		const travelDistance = distance(fromPosition, targetPosition);
		duration = Math.min(1.2, Math.max(0.78, 0.68 + travelDistance / 1100));
		arcHeight = Math.min(150, Math.max(24, travelDistance * 0.22, Math.max(fromScale, targetScale) * 0.8));
		progress = 0;

		if (sourceLabel !== nextDestination) {
			active = true;
			onMotionStart(tile.key, sourceLabel, nextDestination);
		}
		startAnimation();
	}

	const { start: startAnimation, stop: stopAnimation } = useTask((delta) => {
		if (!group) return;
		if (reducedMotion) {
			finishMotion();
			return;
		}

		progress = Math.min(1, progress + delta / duration);
		const eased = 1 - Math.pow(1 - progress, 3);
		const lift = Math.sin(progress * Math.PI) * arcHeight;
		const currentPosition: Position = [
			fromPosition[0] + (targetPosition[0] - fromPosition[0]) * eased,
			fromPosition[1] + (targetPosition[1] - fromPosition[1]) * eased,
			fromPosition[2] + (targetPosition[2] - fromPosition[2]) * eased + lift
		];
		const currentScale = fromScale + (targetScale - fromScale) * eased;
		group.position.set(...currentPosition);
		group.scale.setScalar(currentScale);
		remember(currentPosition, currentScale, currentDestination);

		if (progress >= 1) finishMotion();
	}, { autoStart: false });

	onMount(() => {
		if (!group) return;
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const snapshot = motionSnapshots.get(tile.key);
		const freshSnapshot = snapshot && Date.now() - snapshot.updatedAt <= snapshotLifetimeMs ? snapshot : undefined;
		const startingPosition = freshSnapshot?.position ?? originPosition ?? position;
		const startingScale = freshSnapshot?.scale ?? originScale ?? scale;
		const sourceLabel = freshSnapshot?.destination ?? originLabel ?? destination;
		revealFromFaceDown =
			tile.id != null &&
			!tile.faceDown &&
			(
				freshSnapshot?.destination.endsWith('draw deck') === true ||
				(!freshSnapshot && !!originPosition)
			);
		group.position.set(...startingPosition);
		group.scale.setScalar(startingScale);
		targetPosition = copyPosition(position);
		targetScale = scale;
		currentDestination = destination;
		initialized = true;

		if (
			distance(startingPosition, position) > 0.25 ||
			Math.abs(startingScale - scale) > 0.005 ||
			sourceLabel !== destination
		) {
			beginMotion(position, scale, destination, sourceLabel);
		} else {
			finishMotion();
		}
	});

	$effect(() => {
		const nextPosition: Position = [position[0], position[1], position[2]];
		const nextScale = scale;
		const nextDestination = destination;
		if (!initialized || !group) return;
		if (
			distance(targetPosition, nextPosition) <= 0.25 &&
			Math.abs(targetScale - nextScale) <= 0.005 &&
			currentDestination === nextDestination
		) return;
		beginMotion(nextPosition, nextScale, nextDestination, currentDestination);
	});

	onDestroy(() => {
		if (group) {
			remember([group.position.x, group.position.y, group.position.z], group.scale.x, currentDestination);
		}
		if (active) onMotionEnd(tile.key);
	});
</script>

<T.Group bind:ref={group}>
	<LozengeTile3D
		id={tile.id ?? null}
		color={tile.color ?? null}
		faceDown={tile.faceDown ?? false}
		selected={tile.selected ?? false}
		correct={tile.correct ?? false}
		pileCount={tile.pileCount}
		motionKey={tile.motionKey ?? tile.key}
		{revealFromFaceDown}
	/>
</T.Group>
