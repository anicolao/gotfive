import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const basePath = env.PUBLIC_BASE_PATH || '';

	return {
		base: basePath,
		plugins: [
			sveltekit(),
			VitePWA({
				registerType: 'autoUpdate',
				includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
				manifest: {
					name: 'Got Five!',
					short_name: 'GotFive',
					description: 'A game of numbers',
					theme_color: '#ffffff',
					icons: [
						{
							src: 'pwa-192x192.png',
							sizes: '192x192',
							type: 'image/png'
						},
						{
							src: 'pwa-512x512.png',
							sizes: '512x512',
							type: 'image/png'
						}
					]
				}
			})
		]
	};
});
