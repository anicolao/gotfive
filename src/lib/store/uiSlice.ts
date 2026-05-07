import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
	myId: string | null;
	deductionBoard: Record<number, '?' | 'X' | 'OK'>;
	overlay: 'RULES' | 'GUESS' | 'NONE';
	selectedTileId: number | null;
}

const initialState: UIState = {
	myId: null,
	deductionBoard: {},
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
		markDeduction: (state, action: PayloadAction<{ id: number; mark: '?' | 'X' | 'OK' }>) => {
			state.deductionBoard[action.payload.id] = action.payload.mark;
		},
		setOverlay: (state, action: PayloadAction<'RULES' | 'GUESS' | 'NONE'>) => {
			state.overlay = action.payload;
		},
		selectTile: (state, action: PayloadAction<number | null>) => {
			state.selectedTileId = action.payload;
		}
	}
});

export const { setMyId, markDeduction, setOverlay, selectTile } = uiSlice.actions;
export default uiSlice.reducer;
