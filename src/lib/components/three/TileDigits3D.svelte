<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { onMount } from 'svelte';
	import { CanvasTexture, LinearFilter } from 'three';
	import interBlack from '@fontsource/inter/files/inter-latin-900-normal.woff2?url';

	let { value }: { value: number } = $props();

	const { invalidate } = useThrelte();
	let texture = $state.raw<CanvasTexture>();

	onMount(() => {
		let disposed = false;

		async function createNumberTexture() {
			const font = new FontFace('GotFiveTileNumber', `url(${interBlack})`, { weight: '900' });
			await font.load();
			document.fonts.add(font);
			if (disposed) return;

			const canvas = document.createElement('canvas');
			canvas.width = 256;
			canvas.height = 256;
			const context = canvas.getContext('2d');
			if (!context) return;

			context.font = '900 148px GotFiveTileNumber';
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.lineJoin = 'round';
			context.miterLimit = 2;
			context.lineWidth = 24;
			context.strokeStyle = '#050505';
			context.fillStyle = '#ffffff';
			context.strokeText(value.toString(), 128, 126, 218);
			context.fillText(value.toString(), 128, 126, 218);

			texture = new CanvasTexture(canvas);
			texture.minFilter = LinearFilter;
			texture.magFilter = LinearFilter;
			texture.generateMipmaps = false;
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
