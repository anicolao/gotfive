import { Peer, type DataConnection } from 'peerjs';
import { store } from '../store';
import {
  setMyStatus,
  setLobbyState,
  updatePlayerStatus,
  removePlayer,
  registerGame,
  unregisterGame,
  type PlayerProfile,
  type GameInfo
} from '../store/lobbySlice';

function getLobbyLeaderId() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('lobbyId') || 'gotfive-lobby-leader';
  }
  return 'gotfive-lobby-leader';
}

export type LobbyMessage =
  | { type: 'LOBBY_JOIN'; payload: PlayerProfile }
  | { type: 'LOBBY_STATE'; payload: { players: Record<string, PlayerProfile>; publicGames: Record<string, GameInfo> } }
  | { type: 'GAME_REGISTER'; payload: GameInfo }
  | { type: 'GAME_UNREGISTER'; payload: string }
  | { type: 'HEARTBEAT' };

export class LobbyManager {
  private peer: Peer | null = null;
  public isLeader = false;
  private leaderConnection: DataConnection | null = null;
  private clientConnections: Map<string, DataConnection> = new Map();
  private peerIdToProfileId: Map<string, string> = new Map();
  private profileIdToPeerId: Map<string, string> = new Map();
  private reconnectTimeout: any = null;
  private profile: PlayerProfile | null = null;
  private heartbeatInterval: any = null;
  private pruneInterval: any = null;

  constructor(profile: PlayerProfile) {
    this.profile = profile;
    this.init();
  }

  private init() {
    store.dispatch(setMyStatus('CONNECTING'));
    this.peer = new Peer(getLobbyLeaderId());

    this.peer.on('open', (id) => {
      this.isLeader = true;
      store.dispatch(setMyStatus('LOBBY_LEADER'));
      store.dispatch(updatePlayerStatus({ ...this.profile!, lastSeen: Date.now() }));
      
      this.peer!.on('connection', (conn) => this.handleClientConnection(conn));
      
      // Periodically prune dead clients
      this.pruneInterval = setInterval(() => this.pruneDeadClients(), 15000);
    });

    this.peer.on('error', (err: any) => {
      if (err.type === 'unavailable-id') {
        this.peer?.destroy();
        this.startAsClient();
      } else {
        console.error('Lobby peer error:', err);
      }
    });
  }

  private startAsClient(retryWithRandom = false) {
    this.isLeader = false;
    this.peer = retryWithRandom ? new Peer() : new Peer(this.profile!.id);

    this.peer.on('open', (id) => {
      store.dispatch(setMyStatus('LOBBY_CLIENT'));
      this.connectToLeader();
    });

    this.peer.on('error', (err: any) => {
      if (!retryWithRandom && err.type === 'unavailable-id') {
        console.log('Profile ID taken, retrying with random ID');
        this.peer?.destroy();
        this.startAsClient(true);
      } else {
        console.error('Client peer error:', err);
      }
    });
  }

  private connectToLeader() {
    if (!this.peer) return;
    const conn = this.peer.connect(getLobbyLeaderId());
    
    if (!conn) return;

    conn.on('open', () => {
      this.leaderConnection = conn;
      this.sendToLeader({ type: 'LOBBY_JOIN', payload: { ...this.profile!, lastSeen: Date.now() } });
      
      this.heartbeatInterval = setInterval(() => {
        this.sendToLeader({ type: 'HEARTBEAT' });
      }, 5000);
    });

    conn.on('data', (data) => {
      try {
        const msg = (typeof data === 'string' ? JSON.parse(data) : data) as LobbyMessage;
        if (msg.type === 'LOBBY_STATE') {
          store.dispatch(setLobbyState(msg.payload));
        }
      } catch(e) {
        console.error('Failed parsing lobby msg', e);
      }
    });

    conn.on('close', () => this.handleLeaderDisconnect());
    conn.on('error', () => this.handleLeaderDisconnect());
  }

  private handleLeaderDisconnect() {
    if (this.leaderConnection) {
      this.leaderConnection.close();
      this.leaderConnection = null;
    }
    clearInterval(this.heartbeatInterval);
    
    const state = store.getState().lobby;
    const allPlayers = Object.keys(state.players).sort();
    const myIndex = allPlayers.indexOf(this.profile!.id);
    
    const delay = (Math.max(0, myIndex) * 200) + Math.random() * 100;
    
    store.dispatch(setMyStatus('CONNECTING'));
    
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      if (this.peer) this.peer.destroy();
      this.init();
    }, delay);
  }

  private handleClientConnection(conn: DataConnection) {
    if (!conn) return;

    conn.on('open', () => {
      this.clientConnections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      try {
        const msg = (typeof data === 'string' ? JSON.parse(data) : data) as LobbyMessage;
        
        if (msg.type === 'LOBBY_JOIN') {
          const profileId = msg.payload.id;
          const oldPeerId = this.profileIdToPeerId.get(profileId);
          
          if (oldPeerId && oldPeerId !== conn.peer) {
            const oldConn = this.clientConnections.get(oldPeerId);
            if (oldConn) {
              oldConn.close();
            }
            this.peerIdToProfileId.delete(oldPeerId);
            this.clientConnections.delete(oldPeerId);
          }
          
          this.peerIdToProfileId.set(conn.peer, profileId);
          this.profileIdToPeerId.set(profileId, conn.peer);

          store.dispatch(updatePlayerStatus({ ...msg.payload, lastSeen: Date.now() }));
          this.broadcastState();
        } else if (msg.type === 'GAME_REGISTER') {
          store.dispatch(registerGame(msg.payload));
          this.broadcastState();
        } else if (msg.type === 'GAME_UNREGISTER') {
          store.dispatch(unregisterGame(msg.payload));
          this.broadcastState();
        } else if (msg.type === 'HEARTBEAT') {
          const profileId = this.peerIdToProfileId.get(conn.peer);
          const state = store.getState().lobby;
          if (profileId && state.players[profileId]) {
             store.dispatch(updatePlayerStatus({ ...state.players[profileId], lastSeen: Date.now() }));
          }
        }
      } catch(e) {
        console.error(e);
      }
    });

    conn.on('close', () => {
      const profileId = this.peerIdToProfileId.get(conn.peer);
      this.clientConnections.delete(conn.peer);
      
      if (profileId) {
        this.peerIdToProfileId.delete(conn.peer);
        
        // Only remove the player if this connection is the one currently associated with the profile
        if (this.profileIdToPeerId.get(profileId) === conn.peer) {
          this.profileIdToPeerId.delete(profileId);
          store.dispatch(removePlayer(profileId));
          
          const state = store.getState().lobby;
          if (state.publicGames[profileId]) {
             store.dispatch(unregisterGame(profileId));
          }
          this.broadcastState();
        }
      }
    });
    
    conn.on('error', () => {
      conn.close();
    });
  }

  private pruneDeadClients() {
    if (!this.isLeader) return;
    const now = Date.now();
    const state = store.getState().lobby;
    let changed = false;
    
    // We update our own lastSeen
    store.dispatch(updatePlayerStatus({ ...this.profile!, lastSeen: now }));

    Object.values(state.players).forEach(p => {
      if (p.id !== this.profile!.id && now - p.lastSeen > 20000) {
        // Assume disconnected if no heartbeat for 20s
        store.dispatch(removePlayer(p.id));
        if (state.publicGames[p.id]) store.dispatch(unregisterGame(p.id));
        
        const peerId = this.profileIdToPeerId.get(p.id);
        if (peerId) {
          const conn = this.clientConnections.get(peerId);
          if (conn) {
            conn.close();
            this.clientConnections.delete(peerId);
          }
          this.peerIdToProfileId.delete(peerId);
          this.profileIdToPeerId.delete(p.id);
        }
        changed = true;
      }
    });
    if (changed) this.broadcastState();
  }

  private broadcastState() {
    if (!this.isLeader) return;
    const state = store.getState().lobby;
    const msg: LobbyMessage = {
      type: 'LOBBY_STATE',
      payload: { players: state.players, publicGames: state.publicGames }
    };
    const data = JSON.stringify(msg);
    this.clientConnections.forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }

  public sendToLeader(msg: LobbyMessage) {
    if (this.isLeader) {
      if (msg.type === 'GAME_REGISTER') {
        store.dispatch(registerGame(msg.payload));
        this.broadcastState();
      } else if (msg.type === 'GAME_UNREGISTER') {
        store.dispatch(unregisterGame(msg.payload));
        this.broadcastState();
      } else if (msg.type === 'LOBBY_JOIN') {
        store.dispatch(updatePlayerStatus({ ...msg.payload, lastSeen: Date.now() }));
        this.broadcastState();
      }
    } else {
      if (this.leaderConnection && this.leaderConnection.open) {
        this.leaderConnection.send(JSON.stringify(msg));
      }
    }
  }
  
  public updateProfile(profile: PlayerProfile) {
    this.profile = profile;
    this.sendToLeader({ type: 'LOBBY_JOIN', payload: { ...profile, lastSeen: Date.now() } });
  }

  public disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.pruneInterval) clearInterval(this.pruneInterval);
    if (this.leaderConnection) this.leaderConnection.close();
    this.clientConnections.forEach(c => c.close());
    this.clientConnections.clear();
    this.peerIdToProfileId.clear();
    this.profileIdToPeerId.clear();
    if (this.peer) this.peer.destroy();
  }
}

export let globalLobbyManager: LobbyManager | null = null;

export function initLobby(profile: PlayerProfile) {
  if (globalLobbyManager) globalLobbyManager.disconnect();
  globalLobbyManager = new LobbyManager(profile);
  return globalLobbyManager;
}

export function getLobbyManager() {
  return globalLobbyManager;
}
