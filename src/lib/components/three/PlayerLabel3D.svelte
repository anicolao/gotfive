<script lang="ts">
	import { onMount } from 'svelte';
	import { registerPlayerLabel } from './tileSceneRegistry';

	let {
		text,
		current = false
	}: {
		text: string;
		current?: boolean;
	} = $props();

	let element: HTMLDivElement;
	let registration: ReturnType<typeof registerPlayerLabel> | undefined;

	onMount(() => {
		registration = registerPlayerLabel({ element, text, current });
		return () => registration?.unregister();
	});

	$effect(() => {
		registration?.update({ text, current });
	});
</script>

<div bind:this={element} class="player-label-3d" aria-hidden="true"></div>

<style>
	.player-label-3d {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
</style>
