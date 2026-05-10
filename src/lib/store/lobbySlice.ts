import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string; // Icon name or SVG
  status: 'visible' | 'lurking';
  activity: 'idle' | 'playing';
  lastSeen: number; // Timestamp
}

export interface GameInfo {
  hostId: string;
  hostName: string;
  name: string;
  visibility: 'public' | 'hidden';
  playerCount: number;
  maxPlayers: number;
}

export interface LobbyState {
  players: Record<string, PlayerProfile>;
  publicGames: Record<string, GameInfo>;
  myStatus: 'OFFLINE' | 'CONNECTING' | 'LOBBY_CLIENT' | 'LOBBY_LEADER';
  profile: PlayerProfile | null;
}

const initialState: LobbyState = {
  players: {},
  publicGames: {},
  myStatus: 'OFFLINE',
  profile: null,
};

const lobbySlice = createSlice({
  name: 'lobby',
  initialState,
  reducers: {
    setMyStatus(state, action: PayloadAction<LobbyState['myStatus']>) {
      state.myStatus = action.payload;
    },
    setProfile(state, action: PayloadAction<PlayerProfile>) {
      state.profile = action.payload;
    },
    setLobbyState(state, action: PayloadAction<{ players: Record<string, PlayerProfile>; publicGames: Record<string, GameInfo>; leaderId?: string }>) {
      state.players = action.payload.players;
      state.publicGames = action.payload.publicGames;
    },
    updatePlayerStatus(state, action: PayloadAction<PlayerProfile>) {
      state.players[action.payload.id] = action.payload;
    },
    removePlayer(state, action: PayloadAction<string>) {
      delete state.players[action.payload];
    },
    registerGame(state, action: PayloadAction<GameInfo>) {
      state.publicGames[action.payload.hostId] = action.payload;
    },
    unregisterGame(state, action: PayloadAction<string>) {
      delete state.publicGames[action.payload];
    },
  },
});

export const {
  setMyStatus,
  setProfile,
  setLobbyState,
  updatePlayerStatus,
  removePlayer,
  registerGame,
  unregisterGame,
} = lobbySlice.actions;

export default lobbySlice.reducer;
