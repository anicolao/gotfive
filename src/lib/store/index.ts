import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './gameSlice';
import playersReducer from './playersSlice';
import uiReducer from './uiSlice';
import lobbyReducer from './lobbySlice';

export const store = configureStore({
        reducer: {
                game: gameReducer,
                players: playersReducer,
                ui: uiReducer,
                lobby: lobbyReducer
        },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware()
});

if (typeof window !== 'undefined' && import.meta.env.DEV) {
        (window as any).store = store;
}
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
