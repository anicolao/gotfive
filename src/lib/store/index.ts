import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './gameSlice';
import playersReducer from './playersSlice';
import uiReducer from './uiSlice';
import { networkMiddleware } from '../network';

export const store = configureStore({
	reducer: {
		game: gameReducer,
		players: playersReducer,
		ui: uiReducer
	},
	middleware: (getDefaultMiddleware) => 
		getDefaultMiddleware().concat(networkMiddleware)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
