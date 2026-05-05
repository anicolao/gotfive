export type TileColor = 'Red' | 'Blue' | 'Yellow' | 'Green' | 'Purple';

export interface TileData {
	id: number;
	color: TileColor;
	dots: number;
}

const COLORS: TileColor[] = ['Red', 'Blue', 'Yellow', 'Green', 'Purple'];

export function getTileData(id: number): TileData {
	if (id < 1 || id > 60) {
		throw new Error(`Invalid tile ID: ${id}`);
	}

	const colorIndex = (id - 1) % 5;
	const dots = Math.floor((id - 1) / 5) % 3 + 1;

	return {
		id,
		color: COLORS[colorIndex],
		dots
	};
}
