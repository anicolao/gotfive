import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
	myId: string | null;
	isHost: boolean;
	deductionBoard: Record<number, '?' | 'X' | 'OK'>;
	strokes: number[][][]; // [strokeIndex][pointIndex][x, y]
	overlay: 'RULES' | 'GUESS' | 'NONE';
	selectedTileId: number | null;
}

const initialState: UIState = {
	myId: null,
	isHost: false,
	deductionBoard: {},
	strokes: [],
	overlay: 'NONE',
	selectedTileId: null
};

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
		markDeduction: (state, action: PayloadAction<{ id: number; mark: '?' | 'X' | 'OK' }>) => {
			state.deductionBoard[action.payload.id] = action.payload.mark;
		},
		addStroke: (state, action: PayloadAction<number[][]>) => {
			state.strokes.push(action.payload);
		},
		clearStrokes: (state) => {
			state.strokes = [];
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
			state.overlay = 'NONE';
			state.selectedTileId = null;
		}
	}
});

export const { setMyId, setIsHost, markDeduction, addStroke, clearStrokes, setOverlay, selectTile, resetUI } = uiSlice.actions;
export default uiSlice.reducer;
