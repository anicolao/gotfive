<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { onMount } from 'svelte';
	import { CanvasTexture, LinearMipmapLinearFilter } from 'three';
	import interBlack from '@fontsource/inter/files/inter-latin-900-normal.woff2?url';

	let fontPromise: Promise<FontFace> | undefined;

	function loadNumberFont() {
		if (!fontPromise) {
			const font = new FontFace('GotFiveTileNumber', `url(${interBlack})`, { weight: '900' });
			document.fonts.add(font);
			fontPromise = font.load();
		}
		return fontPromise;
	}

	let { value }: { value: number } = $props();

	const { invalidate } = useThrelte();
	let texture = $state.raw<CanvasTexture>();

	onMount(() => {
		let disposed = false;

		async function createNumberTexture() {
			await loadNumberFont();
			if (disposed) return;

			const canvas = document.createElement('canvas');
			canvas.width = 512;
			canvas.height = 512;
			const context = canvas.getContext('2d');
			if (!context) return;

			context.font = '900 296px GotFiveTileNumber';
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.lineJoin = 'round';
			context.miterLimit = 2;
			context.lineWidth = 48;
			context.strokeStyle = '#050505';
			context.fillStyle = '#ffffff';
			context.strokeText(value.toString(), 256, 252, 436);
			context.fillText(value.toString(), 256, 252, 436);

			texture = new CanvasTexture(canvas);
			texture.minFilter = LinearMipmapLinearFilter;
			texture.anisotropy = 8;
			texture.generateMipmaps = true;
			texture.needsUpdate = true;
			invalidate();
		}

		void createNumberTexture();
		return () => {
			disposed = true;
			texture?.dispose();
		};
	});
</script>

{#if texture}
	<T.Mesh position={[0, 0.065, 0.232]}>
		<T.PlaneGeometry args={[0.89, 0.89]} />
		<T.MeshBasicMaterial
			map={texture}
			transparent={true}
			alphaTest={0.08}
			depthWrite={false}
			toneMapped={false}
		/>
	</T.Mesh>
{/if}
