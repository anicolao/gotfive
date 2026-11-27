import { describe, expect, test } from 'bun:test';
import uiReducer, {
	clearDeductionBoard,
	markDeductions,
	resetUI,
	setGuessInput,
	setMyId,
	syncUI
} from './uiSlice';

describe('uiSlice deduction state', () => {
	test('filters deduction and guess updates to the local player and hydrates cleanly via syncUI', () => {
		let state = uiReducer(undefined, setMyId('player-a'));
		state = uiReducer(state, markDeductions({ marks: { 1: 'X', 6: 'OK' }, playerId: 'player-a' }));
		state = uiReducer(state, markDeductions({ marks: { 2: 'X' }, playerId: 'player-b' }));
		state = uiReducer(state, setGuessInput({ index: 0, value: '6', playerId: 'player-a' }));
		state = uiReducer(state, setGuessInput({ index: 1, value: '7', playerId: 'player-b' }));

		expect(state.deductionBoard).toEqual({ 1: 'X', 6: 'OK' });
		expect(state.guessInputs).toEqual(['6', '', '', '', '']);
		expect('strokes' in state).toBe(false);

		let hydrated = uiReducer(undefined, setMyId('player-a'));
		hydrated = uiReducer(hydrated, syncUI({
			deductionBoard: state.deductionBoard,
			guessInputs: state.guessInputs
		}));
		expect(hydrated.deductionBoard).toEqual({ 1: 'X', 6: 'OK' });
		expect(hydrated.guessInputs).toEqual(['6', '', '', '', '']);

		hydrated = uiReducer(hydrated, clearDeductionBoard({ playerId: 'player-b' }));
		expect(hydrated.deductionBoard).toEqual({ 1: 'X', 6: 'OK' });

		hydrated = uiReducer(hydrated, clearDeductionBoard({ playerId: 'player-a' }));
		expect(hydrated.deductionBoard).toEqual({});
		expect(hydrated.guessInputs).toEqual(['', '', '', '', '']);

		hydrated = uiReducer(
			uiReducer(hydrated, markDeductions({ marks: { 5: 'OK' }, playerId: 'player-a' })),
			resetUI()
		);
		expect(hydrated.deductionBoard).toEqual({});
		expect(hydrated.myId).toBe('player-a');
	});
});
