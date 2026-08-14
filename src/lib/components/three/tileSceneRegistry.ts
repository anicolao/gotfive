import { writable } from 'svelte/store';
import type { TileColor } from '$lib/game/tiles';

export type SceneTile = {
	key: string;
	id?: number | null;
	color?: TileColor | null;
	faceDown?: boolean;
	selected?: boolean;
	correct?: boolean;
	pileCount?: number;
	motionKey?: string | number;
};

export type TileFieldRegistration = {
	id: symbol;
	element: HTMLElement;
	tiles: SceneTile[];
	columns: number;
	rack: boolean;
	background: boolean;
	fit?: number;
	anchors?: HTMLElement[];
	label: string;
};

export type PlayerLabelRegistration = {
	id: symbol;
	element: HTMLElement;
	text: string;
	current: boolean;
};

export const tileSceneFields = writable<TileFieldRegistration[]>([]);
export const playerSceneLabels = writable<PlayerLabelRegistration[]>([]);

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

export function registerPlayerLabel(label: Omit<PlayerLabelRegistration, 'id'>) {
	const id = Symbol(label.text);
	playerSceneLabels.update((labels) => [...labels, { id, ...label }]);

	return {
		update(next: Omit<PlayerLabelRegistration, 'id' | 'element'>) {
			playerSceneLabels.update((labels) => labels.map((current) => (
				current.id === id ? { ...current, ...next } : current
			)));
		},
		unregister() {
			playerSceneLabels.update((labels) => labels.filter((current) => current.id !== id));
		}
	};
}
