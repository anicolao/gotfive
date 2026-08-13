<script lang="ts">
	import { useThrelte } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

	let {
		target = [0, 0, 0] as [number, number, number],
		minDistance = 2.4,
		maxDistance = 40
	}: {
		target?: [number, number, number];
		minDistance?: number;
		maxDistance?: number;
	} = $props();

	const { camera, dom, invalidate } = useThrelte();
	const controls = new OrbitControls(camera.current, dom);
	controls.enableDamping = false;
	controls.enablePan = true;
	controls.enableZoom = true;
	controls.minPolarAngle = 0.12;
	controls.maxPolarAngle = Math.PI - 0.12;
	controls.addEventListener('change', invalidate);

	$effect(() => {
		controls.object = camera.current;
		controls.target.set(...target);
		controls.minDistance = minDistance;
		controls.maxDistance = maxDistance;
		controls.update();
		invalidate();
	});

	onDestroy(() => {
		controls.removeEventListener('change', invalidate);
		controls.dispose();
	});
</script>
