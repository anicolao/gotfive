import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { getTileData } from '../game/tiles';

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
		clue_sort: (state, action: PayloadAction<{ targetId: string; tileId: number }>) => {
			const player = state.players[action.payload.targetId];
			if (!player) return;
			const { tileId } = action.payload;
			let result = 0;
			for (let i = 0; i < player.hand.length; i++) {
				if (tileId > player.hand[i]) {
					result = i + 1;
				} else {
					break;
				}
			}
			player.clues.push({
				type: 'SORT',
				tileId,
				result
			});
		},
		clue_compare: (state, action: PayloadAction<{ targetId: string; tileId: number; targetSlot: number }>) => {
			const player = state.players[action.payload.targetId];
			if (!player || player.hand[action.payload.targetSlot] === undefined) return;
			
			const tileData = getTileData(action.payload.tileId);
			const handTileData = getTileData(player.hand[action.payload.targetSlot]);
			
			player.clues.push({
				type: 'COMPARE',
				tileId: action.payload.tileId,
				targetSlot: action.payload.targetSlot,
				result: tileData.dots === handTileData.dots
			});
		},
		eliminatePlayer: (state, action: PayloadAction<string>) => {
			if (state.players[action.payload]) {
				state.players[action.payload].eliminated = true;
			}
		}
	}
});

export const { addPlayer, setHand, addClue, clue_sort, clue_compare, eliminatePlayer } = playersSlice.actions;
export default playersSlice.reducer;
