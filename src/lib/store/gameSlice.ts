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
	eliminated: string[];
	hasDrawnThisTurn: boolean;
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
	seed: 0,
	eliminated: [],
	hasDrawnThisTurn: false
};

export const gameSlice = createSlice({
	name: 'game',
	initialState,
	reducers: {
		sync: (state, action: PayloadAction<GameState>) => {
			return { ...action.payload };
		},
		start: (state, action: PayloadAction<{ deck: number[]; turnOrder: string[]; initialPublic: number[]; seed: number }>) => {
			state.turnOrder = action.payload.turnOrder;
			state.status = 'PLAYING';
			state.publicPool = action.payload.initialPublic;
			state.currentPlayerIndex = 0;
			state.winnerId = null;
			state.seed = action.payload.seed;
			state.eliminated = [];
			state.hasDrawnThisTurn = false;

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
					state.hasDrawnThisTurn = true;
				}
			}
		},
		nextTurn: (state) => {
			if (state.turnOrder.length === 0) return;
			let nextIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
			const startIndex = nextIndex;
			
			// Loop to skip eliminated players
			while (state.eliminated.includes(state.turnOrder[nextIndex])) {
				nextIndex = (nextIndex + 1) % state.turnOrder.length;
				if (nextIndex === startIndex) break; // Avoid infinite loop if everyone is eliminated
			}
			state.currentPlayerIndex = nextIndex;
			state.hasDrawnThisTurn = false;
		},
		setWinner: (state, action: PayloadAction<string>) => {
			state.winnerId = action.payload;
			state.status = 'FINISHED';
		},
		resetGame: (state) => {
			return { ...initialState, status: 'LOBBY' };
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
		builder.addCase('players/eliminatePlayer', (state, action: any) => {
			if (!state.eliminated.includes(action.payload)) {
				state.eliminated.push(action.payload);
			}
		});
		builder.addCase('players/guess', (state, action: any) => {
			// Note: We need the result of the guess. 
			// For now, we'll rely on the UI to dispatch eliminatePlayer if guess is wrong,
			// or we'll need to update playersSlice to include the result in the action.
			// Re-reading conductor: "Handle players/eliminatePlayer in extraReducers to track eliminations."
			// So I'll stick to that.
		});
	}
});

export const { start, reveal, nextTurn, setWinner, sync, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
