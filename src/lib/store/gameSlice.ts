import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { type TileColor } from '../game/tiles';

export interface GameState {
	status: 'LOBBY' | 'SETUP' | 'PLAYING' | 'FINISHED';
	decks: Record<TileColor, number[]>;
	publicPool: number[];
	turnOrder: string[];
	currentPlayerIndex: number;
	winnerId: string | null;
	seed: number;
}

const initialState: GameState = {
	status: 'LOBBY',
	decks: {
		Red: [],
		Blue: [],
		Yellow: [],
		Green: [],
		Purple: []
	},
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
		start: (state, action: PayloadAction<{ deck: number[]; turnOrder: string[]; initialPublic: number[]; seed: number }>) => {
			state.turnOrder = action.payload.turnOrder;
			state.status = 'PLAYING';
			state.publicPool = action.payload.initialPublic;
			state.currentPlayerIndex = 0;
			state.winnerId = null;
			state.seed = action.payload.seed;

			// Partition deck into 5 decks by color
			const COLORS: TileColor[] = ['Red', 'Blue', 'Yellow', 'Green', 'Purple'];
			state.decks = {
				Red: [],
				Blue: [],
				Yellow: [],
				Green: [],
				Purple: []
			};
			action.payload.deck.forEach(id => {
				const colorIndex = (id - 1) % 5;
				const color = COLORS[colorIndex];
				state.decks[color].push(id);
			});
		},
		reveal: (state, action: PayloadAction<TileColor>) => {
			const color = action.payload;
			const deck = state.decks[color];
			if (deck.length > 0) {
				const tileId = deck.shift();
				if (tileId !== undefined) {
					state.publicPool.push(tileId);
				}
			}
		},
		nextTurn: (state) => {
			state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
		},
		setWinner: (state, action: PayloadAction<string>) => {
			state.winnerId = action.payload;
			state.status = 'FINISHED';
		}
	},
	extraReducers: (builder) => {
		builder.addCase('players/clue_sort', (state, action: any) => {
			const { tileId } = action.payload;
			state.publicPool = state.publicPool.filter((id) => id !== tileId);
		});
		builder.addCase('players/clue_compare', (state, action: any) => {
			const { tileId } = action.payload;
			state.publicPool = state.publicPool.filter((id) => id !== tileId);
		});
	}
});

export const { start, reveal, nextTurn, setWinner } = gameSlice.actions;
export default gameSlice.reducer;
