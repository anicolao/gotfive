import { describe, expect, test } from 'bun:test';
import gameReducer, { nextTurn, reveal, start } from './gameSlice';

describe('game reveal reducer', () => {
	test('ignores a second draw until the turn advances', () => {
		let state = gameReducer(undefined, start({
			deck: [1, 6, 2, 7],
			turnOrder: ['player-1', 'player-2'],
			initialPublic: [],
			seed: 123
		}));

		state = gameReducer(state, reveal('Red'));
		expect(state.publicPool).toEqual([1]);
		expect(state.decks.Red).toEqual([6]);
		expect(state.hasDrawnThisTurn).toBe(true);

		state = gameReducer(state, reveal('Blue'));
		expect(state.publicPool).toEqual([1]);
		expect(state.decks.Blue).toEqual([2, 7]);

		state = gameReducer(state, nextTurn());
		state = gameReducer(state, reveal('Blue'));
		expect(state.publicPool).toEqual([1, 2]);
		expect(state.decks.Blue).toEqual([7]);
	});
});
