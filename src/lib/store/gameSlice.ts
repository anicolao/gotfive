import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface GameState {
	status: 'LOBBY' | 'SETUP' | 'PLAYING' | 'FINISHED';
	deck: number[];
	deckIndex: number;
	publicPool: number[];
	turnOrder: string[];
	currentPlayerIndex: number;
	winnerId: string | null;
	seed: number;
}

const initialState: GameState = {
	status: 'LOBBY',
	deck: [],
	deckIndex: 0,
	publicPool: [],
	turnOrder: [],
	currentPlayerIndex: 0,
	winnerId: null,
	seed: 0
};

export const gameSlice = createSlice({
	name: 'game',
	initialState,
	reducers: {
		start: (state, action: PayloadAction<{ deck: number[]; turnOrder: string[] }>) => {
			state.deck = action.payload.deck;
			state.turnOrder = action.payload.turnOrder;
			state.status = 'PLAYING';
			state.deckIndex = 0;
			state.publicPool = [];
			state.currentPlayerIndex = 0;
			state.winnerId = null;
		},
		reveal: (state) => {
			if (state.deckIndex < state.deck.length) {
				state.publicPool.push(state.deck[state.deckIndex]);
				state.deckIndex++;
			}
		},
		nextTurn: (state) => {
			state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
		},
		setWinner: (state, action: PayloadAction<string>) => {
			state.winnerId = action.payload;
			state.status = 'FINISHED';
		}
	}
});

export const { start, reveal, nextTurn, setWinner } = gameSlice.actions;
export default gameSlice.reducer;
