<script module lang="ts">
	import interBlack from '@fontsource/inter/files/inter-latin-900-normal.woff2?url';

	let fontPromise: Promise<FontFace> | undefined;

	function loadCountFont() {
		if (!fontPromise) {
			const font = new FontFace('GotFivePileCount', `url(${interBlack})`, { weight: '900' });
			document.fonts.add(font);
			fontPromise = font.load();
		}
		return fontPromise;
	}
</script>

<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { onMount } from 'svelte';
	import { CanvasTexture, LinearMipmapLinearFilter } from 'three';

	let { value }: { value: number } = $props();

	const { invalidate } = useThrelte();
	let texture = $state.raw<CanvasTexture>();

	onMount(() => {
		let disposed = false;

		async function createCountTexture() {
			await loadCountFont();
			if (disposed) return;

			const canvas = document.createElement('canvas');
			canvas.width = 256;
			canvas.height = 256;
			const context = canvas.getContext('2d');
			if (!context) return;

			context.font = '900 142px GotFivePileCount';
			context.textAlign = 'center';
			context.textBaseline = 'alphabetic';
			context.lineJoin = 'round';
			context.lineWidth = 24;
			context.strokeStyle = '#050505';
			context.fillStyle = '#ffffff';
			const label = value.toString();
			const metrics = context.measureText(label);
			const x = 128 + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2;
			const y = 128 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
			context.strokeText(label, x, y, 210);
			context.fillText(label, x, y, 210);

			texture = new CanvasTexture(canvas);
			texture.minFilter = LinearMipmapLinearFilter;
			texture.anisotropy = 8;
			texture.generateMipmaps = true;
			texture.needsUpdate = true;
			invalidate();
		}

		void createCountTexture();
		return () => {
			disposed = true;
			texture?.dispose();
		};
	});
</script>

<T.Group position={[-0.38, -0.38, -0.252]} rotation={[0, Math.PI, 0]}>
	<T.Mesh>
		<T.CircleGeometry args={[0.2, 32]} />
		<T.MeshBasicMaterial color="#050505" toneMapped={false} />
	</T.Mesh>
	<T.Mesh position={[0, 0, 0.006]}>
		<T.RingGeometry args={[0.168, 0.195, 32]} />
		<T.MeshBasicMaterial color="#00e5ff" toneMapped={false} />
	</T.Mesh>
	{#if texture}
		<T.Mesh position={[0, 0, 0.012]} renderOrder={3}>
			<T.PlaneGeometry args={[0.31, 0.31]} />
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
