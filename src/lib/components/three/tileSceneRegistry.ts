import { writable } from 'svelte/store';
import type { TileColor } from '$lib/game/tiles';

export type SceneTile = {
	key: string;
	id?: number | null;
	color?: TileColor | null;
	faceDown?: boolean;
	selected?: boolean;
	correct?: boolean;
	motionKey?: string | number;
};

export type TileFieldRegistration = {
	id: symbol;
	element: HTMLElement;
	tiles: SceneTile[];
	columns: number;
	rack: boolean;
	background: boolean;
	label: string;
};

export const tileSceneFields = writable<TileFieldRegistration[]>([]);

export function registerTileField(field: Omit<TileFieldRegistration, 'id'>) {
	const id = Symbol(field.label);
	tileSceneFields.update((fields) => [...fields, { id, ...field }]);

	return {
		update(next: Omit<TileFieldRegistration, 'id' | 'element'>) {
			tileSceneFields.update((fields) => fields.map((current) => (
				current.id === id ? { ...current, ...next } : current
			)));
		},
		unregister() {
			tileSceneFields.update((fields) => fields.filter((current) => current.id !== id));
		}
	};
}
