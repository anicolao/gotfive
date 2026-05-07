import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

let gitHash = 'unknown';
try {
	gitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
	console.warn('Failed to get git hash', e);
}
export default defineConfig({
	base: (process.env.PUBLIC_BASE_PATH || '').replace(/\/$/, ''),
	define: {
		'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION || pkg.version),
		'import.meta.env.VITE_GIT_HASH': JSON.stringify(process.env.VITE_GIT_HASH || gitHash)
	},
	plugins: [
		nodePolyfills({
			include: ['buffer', 'events', 'util', 'stream'],
			globals: {
				Buffer: true,
				global: true,
				process: true,
			},
		}),
		sveltekit(),
...
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
});
