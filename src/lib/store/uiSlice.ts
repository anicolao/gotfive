import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
	myId: string | null;
	isHost: boolean;
	deductionBoard: Record<number, '?' | 'X' | 'OK'>;
	strokes: number[][][]; // [strokeIndex][pointIndex][x, y]
	guessInputs: string[];
	overlay: 'RULES' | 'GUESS' | 'NONE';
	selectedTileId: number | null;
	gameId: string | null;
}

const initialState: UIState = {
	myId: null,
	isHost: false,
	deductionBoard: {},
	strokes: [],
	guessInputs: ['', '', '', '', ''],
	overlay: 'NONE',
	selectedTileId: null,
	gameId: null
};

function isLocalPlayerAction(state: UIState, payload: { playerId?: string | null } | undefined) {
	return !payload?.playerId || !state.myId || payload.playerId === state.myId;
}

export const uiSlice = createSlice({
	name: 'ui',
	initialState,
	reducers: {
		setMyId: (state, action: PayloadAction<string>) => {
			state.myId = action.payload;
		},
		setIsHost: (state, action: PayloadAction<boolean>) => {
			state.isHost = action.payload;
		},
		setGameId: (state, action: PayloadAction<string | null>) => {
			state.gameId = action.payload;
		},
		markDeduction: (state, action: PayloadAction<{ id: number; mark: '?' | 'X' | 'OK'; playerId?: string | null }>) => {
			if (!isLocalPlayerAction(state, action.payload)) return;
			state.deductionBoard[action.payload.id] = action.payload.mark;
		},
		markDeductions: (state, action: PayloadAction<{ marks: Record<number, '?' | 'X' | 'OK'>; playerId?: string | null }>) => {
			if (!isLocalPlayerAction(state, action.payload)) return;
			Object.entries(action.payload.marks).forEach(([id, mark]) => {
				state.deductionBoard[Number(id)] = mark;
			});
		},
		addStroke: (state, action: PayloadAction<number[][] | { stroke?: number[][]; points?: Array<{ x: number; y: number }>; playerId?: string | null }>) => {
			const stroke = Array.isArray(action.payload)
				? action.payload
				: action.payload.stroke || action.payload.points?.map((point) => [point.x, point.y]) || [];
			if (!Array.isArray(action.payload) && !isLocalPlayerAction(state, action.payload)) return;
			state.strokes.push(stroke);
		},
		clearStrokes: (state) => {
			state.strokes = [];
		},
		clearDeductionBoard: (state, action: PayloadAction<{ playerId?: string | null } | undefined>) => {
			if (!isLocalPlayerAction(state, action.payload)) return;
			state.deductionBoard = {};
			state.strokes = [];
			state.guessInputs = ['', '', '', '', ''];
		},
		setGuessInputs: (state, action: PayloadAction<{ values: string[]; playerId?: string | null }>) => {
			if (!isLocalPlayerAction(state, action.payload)) return;
			state.guessInputs = action.payload.values.slice(0, 5);
			while (state.guessInputs.length < 5) state.guessInputs.push('');
		},
		setGuessInput: (state, action: PayloadAction<{ index: number; value: string; playerId?: string | null }>) => {
			if (!isLocalPlayerAction(state, action.payload)) return;
			while (state.guessInputs.length < 5) state.guessInputs.push('');
			if (action.payload.index >= 0 && action.payload.index < 5) {
				state.guessInputs[action.payload.index] = action.payload.value;
			}
		},
		setOverlay: (state, action: PayloadAction<'RULES' | 'GUESS' | 'NONE'>) => {
			state.overlay = action.payload;
		},
		selectTile: (state, action: PayloadAction<number | null>) => {
			state.selectedTileId = action.payload;
		},
		resetUI: (state) => {
			state.deductionBoard = {};
			state.strokes = [];
			state.guessInputs = ['', '', '', '', ''];
			state.overlay = 'NONE';
			state.selectedTileId = null;
		}
	}
});

export const { setMyId, setIsHost, setGameId, markDeduction, markDeductions, addStroke, clearStrokes, clearDeductionBoard, setGuessInputs, setGuessInput, setOverlay, selectTile, resetUI } = uiSlice.actions;
export default uiSlice.reducer;
