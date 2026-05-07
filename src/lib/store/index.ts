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

if (typeof window !== 'undefined' && import.meta.env.DEV) {
        (window as any).store = store;
}
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
