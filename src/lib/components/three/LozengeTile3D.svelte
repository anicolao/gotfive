<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { onMount } from 'svelte';
	import { Group } from 'three';
	import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
	import { getTileData, type TileColor } from '$lib/game/tiles';
	import PileCount3D from './PileCount3D.svelte';
	import TileDigits3D from './TileDigits3D.svelte';

	type Position = [number, number, number];

	let {
		id = null,
		color = null,
		faceDown = false,
		selected = false,
		correct = false,
		pileCount,
		revealFromFaceDown = false,
		position = [0, 0, 0] as Position,
		scale = 1,
		motionKey = ''
	}: {
		id?: number | null;
		color?: TileColor | null;
		faceDown?: boolean;
		selected?: boolean;
		correct?: boolean;
		pileCount?: number;
		revealFromFaceDown?: boolean;
		position?: Position;
		scale?: number;
		motionKey?: string | number;
	} = $props();

	const COLOR_MAP: Record<TileColor, string> = {
		Red: '#ff003d',
		Blue: '#008cff',
		Yellow: '#ffc400',
		Green: '#00c968',
		Purple: '#8b16ff'
	};

	const geometry = new RoundedBoxGeometry(1.08, 1.08, 0.42, 7, 0.16);
	let data = $derived(id === null ? null : getTileData(id));
	let tileColor = $derived(data?.color ?? color ?? 'Purple');
	let candyColor = $derived(COLOR_MAP[tileColor]);
	let group = $state.raw<Group>();
	let reducedMotion = $state(false);
	let initialized = false;
	let lastMotionKey: string | number | undefined;
	let lastFaceDown: boolean | undefined;
	let lastSelected: boolean | undefined;
	let spinVelocity = 0;
	let bounce = 0;

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});

	function approach(current: number, target: number, amount: number) {
		return current + (target - current) * amount;
	}

	const { start: startAnimation, stop: stopAnimation } = useTask((delta) => {
		if (!group) return;

		const targetRotationY = faceDown ? Math.PI : 0;
		const targetRotationX = -0.08;
		const targetRotationZ = 0;

		if (!initialized) {
			group.position.set(0, reducedMotion ? (selected ? 0.18 : 0) : -0.9, 0);
			group.rotation.set(
				targetRotationX,
				!reducedMotion && revealFromFaceDown && !faceDown ? Math.PI : targetRotationY,
				targetRotationZ
			);
			if (!reducedMotion) {
				spinVelocity = revealFromFaceDown ? 0 : 9;
				bounce = 0.32;
			}
			initialized = true;
		}

		if (
			!reducedMotion &&
			lastMotionKey !== undefined &&
			(lastMotionKey !== motionKey || lastFaceDown !== faceDown || lastSelected !== selected)
		) {
			const selectionChanged = lastSelected !== selected;
			spinVelocity = faceDown !== lastFaceDown ? 11 : selectionChanged ? 0 : 7;
			bounce = selected ? 0.4 : 0.25;
		}
		lastMotionKey = motionKey;
		lastFaceDown = faceDown;
		lastSelected = selected;

		if (reducedMotion) {
			group.position.set(0, selected ? 0.18 : 0, 0);
			group.rotation.set(targetRotationX, targetRotationY, targetRotationZ);
			stopAnimation();
			return;
		}

		const ease = 1 - Math.exp(-delta * 13);
		bounce = Math.max(0, bounce - delta * 1.8);
		spinVelocity *= Math.exp(-delta * 8.5);
		group.position.x = approach(group.position.x, 0, ease);
		group.position.y = approach(group.position.y, (selected ? 0.18 : 0) + Math.sin(bounce * Math.PI * 4) * bounce, ease);
		group.position.z = approach(group.position.z, 0, ease);
		group.rotation.x = approach(group.rotation.x, targetRotationX, ease);
		group.rotation.y = approach(group.rotation.y, targetRotationY, ease) + spinVelocity * delta;
		group.rotation.z = approach(group.rotation.z, targetRotationZ, ease);

		const settled =
			bounce === 0 &&
			spinVelocity < 0.01 &&
			Math.abs(group.position.y - (selected ? 0.18 : 0)) < 0.001 &&
			Math.abs(group.rotation.x - targetRotationX) < 0.001 &&
			Math.abs(group.rotation.y - targetRotationY) < 0.001 &&
			Math.abs(group.rotation.z - targetRotationZ) < 0.001;

		if (settled) {
			group.position.set(0, selected ? 0.18 : 0, 0);
			group.rotation.set(targetRotationX, targetRotationY, targetRotationZ);
			stopAnimation();
		}
	}, { autoStart: false });

	$effect(() => {
		motionKey;
		faceDown;
		selected;
		reducedMotion;
		startAnimation();
	});
</script>


<T.Group {position} scale={[scale, scale, scale]}>
	<T.Group bind:ref={group}>
	<T.Mesh {geometry} castShadow receiveShadow>
		<T.MeshPhysicalMaterial
			color={candyColor}
			roughness={0.1}
			metalness={0}
			transmission={0}
			thickness={1.5}
			attenuationColor={candyColor}
			attenuationDistance={0.72}
			ior={1.5}
			clearcoat={1}
			clearcoatRoughness={0.04}
			envMapIntensity={2}
			emissive={candyColor}
			emissiveIntensity={0.08}
		/>
	</T.Mesh>

	<T.Mesh position={[0, 0, 0.005]} scale={[0.82, 0.82, 0.7]}>
		<T.BoxGeometry args={[1, 1, 0.34]} />
		<T.MeshBasicMaterial color={candyColor} transparent opacity={0.2} toneMapped={false} />
	</T.Mesh>

	{#if data}
		<TileDigits3D value={data.id} />
		<T.Group position={[0, -0.36, 0.245]}>
			{#each Array(data.dots) as _, dotIndex}
				<T.Mesh position={[(dotIndex - (data.dots - 1) / 2) * 0.16, 0, 0]}>
					<T.CircleGeometry args={[0.071, 24]} />
					<T.MeshBasicMaterial color="#050505" toneMapped={false} />
				</T.Mesh>
				<T.Mesh position={[(dotIndex - (data.dots - 1) / 2) * 0.16, 0, 0.004]}>
					<T.CircleGeometry args={[0.043, 24]} />
					<T.MeshBasicMaterial color="#ffffff" toneMapped={false} />
				</T.Mesh>
			{/each}
		</T.Group>
	{/if}

	<T.Group position={[0, 0, -0.225]} rotation={[0, Math.PI, 0]}>
		<T.Mesh>
			<T.TorusGeometry args={[0.27, 0.055, 12, 40]} />
			<T.MeshBasicMaterial color="#fff7df" transparent opacity={0.88} toneMapped={false} />
		</T.Mesh>
		<T.Mesh>
			<T.CircleGeometry args={[0.08, 24]} />
			<T.MeshBasicMaterial color="#fff7df" toneMapped={false} />
		</T.Mesh>
	</T.Group>

	{#if pileCount !== undefined}
		{#key pileCount}
			<PileCount3D value={pileCount} />
		{/key}
	{/if}

	{#if correct}
		<T.Group position={[0.39, 0.39, 0.29]} scale={0.72}>
			<T.Mesh>
				<T.CircleGeometry args={[0.22, 32]} />
				<T.MeshBasicMaterial color="#00f0ff" toneMapped={false} />
			</T.Mesh>
			<T.Mesh position={[-0.055, -0.015, 0.015]} rotation={[0, 0, -0.72]} scale={[0.045, 0.13, 0.03]}>
				<T.BoxGeometry args={[1, 1, 1]} />
				<T.MeshBasicMaterial color="#02171b" toneMapped={false} />
			</T.Mesh>
			<T.Mesh position={[0.055, 0.015, 0.015]} rotation={[0, 0, 0.72]} scale={[0.045, 0.22, 0.03]}>
				<T.BoxGeometry args={[1, 1, 1]} />
				<T.MeshBasicMaterial color="#02171b" toneMapped={false} />
			</T.Mesh>
		</T.Group>
	{/if}
	</T.Group>
</T.Group>
