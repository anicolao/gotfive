<script lang="ts">
	import { T } from '@threlte/core';

	let { value, color = '#fff7df' }: { value: number; color?: string } = $props();

	const SEGMENTS: Record<string, string[]> = {
		'0': ['a', 'b', 'c', 'd', 'e', 'f'],
		'1': ['b', 'c'],
		'2': ['a', 'b', 'g', 'e', 'd'],
		'3': ['a', 'b', 'c', 'd', 'g'],
		'4': ['f', 'g', 'b', 'c'],
		'5': ['a', 'f', 'g', 'c', 'd'],
		'6': ['a', 'f', 'g', 'e', 'c', 'd'],
		'7': ['a', 'b', 'c'],
		'8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
		'9': ['a', 'b', 'c', 'd', 'f', 'g']
	};

	const SEGMENT_LAYOUT: Record<string, { position: [number, number, number]; scale: [number, number, number] }> = {
		a: { position: [0, 0.28, 0], scale: [0.24, 0.045, 0.025] },
		b: { position: [0.145, 0.145, 0], scale: [0.045, 0.18, 0.025] },
		c: { position: [0.145, -0.145, 0], scale: [0.045, 0.18, 0.025] },
		d: { position: [0, -0.28, 0], scale: [0.24, 0.045, 0.025] },
		e: { position: [-0.145, -0.145, 0], scale: [0.045, 0.18, 0.025] },
		f: { position: [-0.145, 0.145, 0], scale: [0.045, 0.18, 0.025] },
		g: { position: [0, 0, 0], scale: [0.24, 0.045, 0.025] }
	};

	let digits = $derived(value.toString().split(''));
</script>

<T.Group position={[0, 0.06, 0.242]}>
	{#each digits as digit, digitIndex}
		<T.Group
			position={[
				digits.length === 1 ? 0 : (digitIndex === 0 ? -0.2 : 0.2),
				0,
				0
			]}
			scale={digits.length === 1 ? 1 : 0.72}
		>
			{#each SEGMENTS[digit] as segment}
				<T.Mesh position={SEGMENT_LAYOUT[segment].position} scale={SEGMENT_LAYOUT[segment].scale}>
					<T.BoxGeometry args={[1, 1, 1]} />
					<T.MeshBasicMaterial {color} toneMapped={false} />
				</T.Mesh>
			{/each}
		</T.Group>
	{/each}
</T.Group>
