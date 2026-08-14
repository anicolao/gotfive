<script module lang="ts">
	import interBlack from '@fontsource/inter/files/inter-latin-900-normal.woff2?url';

	let fontPromise: Promise<FontFace> | undefined;

	function loadLabelFont() {
		if (!fontPromise) {
			const font = new FontFace('GotFivePlayerLabel', `url(${interBlack})`, { weight: '900' });
			document.fonts.add(font);
			fontPromise = font.load();
		}
		return fontPromise;
	}
</script>

<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import { CanvasTexture, LinearMipmapLinearFilter } from 'three';
	import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

	let {
		text,
		current = false,
		position,
		width,
		height
	}: {
		text: string;
		current?: boolean;
		position: [number, number, number];
		width: number;
		height: number;
	} = $props();

	const { invalidate } = useThrelte();
	const depth = 4;
	let texture = $state.raw<CanvasTexture>();
	let outerGeometry = $derived(new RoundedBoxGeometry(
		Math.max(1, width),
		Math.max(1, height),
		depth,
		5,
		Math.min(5, height * 0.22)
	));
	let innerGeometry = $derived(new RoundedBoxGeometry(
		Math.max(1, width - 2),
		Math.max(1, height - 2),
		depth,
		5,
		Math.min(4, Math.max(1, height - 2) * 0.2)
	));

	$effect(() => {
		const label = text.toUpperCase();
		const isCurrent = current;
		let disposed = false;

		void loadLabelFont().then(() => {
			if (disposed) return;
			const canvas = document.createElement('canvas');
			canvas.width = 1024;
			canvas.height = 256;
			const context = canvas.getContext('2d');
			if (!context) return;

			context.font = '900 128px GotFivePlayerLabel';
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillStyle = isCurrent ? '#050505' : '#ffea00';
			context.fillText(label, 512, 126, 928);

			const nextTexture = new CanvasTexture(canvas);
			nextTexture.minFilter = LinearMipmapLinearFilter;
			nextTexture.anisotropy = 8;
			nextTexture.generateMipmaps = true;
			nextTexture.needsUpdate = true;
			texture?.dispose();
			texture = nextTexture;
			invalidate();
		});

		return () => {
			disposed = true;
		};
	});

	onDestroy(() => texture?.dispose());
</script>

<T.Group {position}>
	<T.Mesh geometry={outerGeometry}>
		<T.MeshBasicMaterial color="#ffea00" toneMapped={false} />
	</T.Mesh>
	<T.Mesh geometry={innerGeometry} position={[0, 0, 0.55]}>
		<T.MeshPhysicalMaterial
			color={current ? '#00e5ff' : '#070b10'}
			roughness={0.18}
			metalness={0.1}
			clearcoat={1}
			clearcoatRoughness={0.08}
			emissive={current ? '#00e5ff' : '#000000'}
			emissiveIntensity={current ? 0.12 : 0}
		/>
	</T.Mesh>
	{#if texture}
		<T.Mesh position={[0, 0, depth / 2 + 0.62]} renderOrder={1}>
			<T.PlaneGeometry args={[Math.max(1, width - 8), Math.max(1, height - 6)]} />
			<T.MeshBasicMaterial
				map={texture}
				transparent={true}
				alphaTest={0.08}
				depthWrite={false}
				toneMapped={false}
			/>
		</T.Mesh>
	{/if}
</T.Group>
