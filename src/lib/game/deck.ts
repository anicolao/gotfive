import { getTileData } from './tiles';

export function createDeck(): number[] {
	// 60 tiles total
	return Array.from({ length: 60 }, (_, i) => i + 1);
}

export function shuffle<T>(array: T[], rng: () => number): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
