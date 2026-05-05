import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface ClueRecord {
	type: 'SORT' | 'COMPARE';
	tileId: number;
	result: number | boolean;
	targetSlot?: number;
}

export interface Player {
	id: string;
	name: string;
	hand: number[]; // Tile IDs
	clues: ClueRecord[];
	isConnected: boolean;
	eliminated: boolean;
}

export interface PlayersState {
	players: Record<string, Player>;
}

const initialState: PlayersState = {
	players: {}
};

export const playersSlice = createSlice({
	name: 'players',
	initialState,
	reducers: {
		addPlayer: (state, action: PayloadAction<{ id: string; name: string }>) => {
			state.players[action.payload.id] = {
				id: action.payload.id,
				name: action.payload.name,
				hand: [],
				clues: [],
				isConnected: true,
				eliminated: false
			};
		},
		setHand: (state, action: PayloadAction<{ id: string; hand: number[] }>) => {
			if (state.players[action.payload.id]) {
				state.players[action.payload.id].hand = action.payload.hand.sort((a, b) => a - b);
			}
		},
		addClue: (state, action: PayloadAction<{ id: string; clue: ClueRecord }>) => {
			if (state.players[action.payload.id]) {
				state.players[action.payload.id].clues.push(action.payload.clue);
			}
		},
		eliminatePlayer: (state, action: PayloadAction<string>) => {
			if (state.players[action.payload]) {
				state.players[action.payload].eliminated = true;
			}
		}
	}
});

export const { addPlayer, setHand, addClue, eliminatePlayer } = playersSlice.actions;
export default playersSlice.reducer;
