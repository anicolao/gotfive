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

import { getPeerConfig, getLobbyConfig } from './peerConfig';

function getLobbyLeaderId() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('lobbyId') || 'gotfive-lobby-leader';
  }
  return 'gotfive-lobby-leader';
}

export type LobbyMessage =
  | { type: 'LOBBY_JOIN'; payload: PlayerProfile }
  | { type: 'LOBBY_STATE'; payload: { players: Record<string, PlayerProfile>; publicGames: Record<string, GameInfo>; leaderId: string } }
  | { type: 'GAME_REGISTER'; payload: GameInfo }
  | { type: 'GAME_UNREGISTER'; payload: string }
  | { type: 'HEARTBEAT' }
  | { type: 'LEADER_DISCONNECT' };

export class LobbyManager {
  private peer: Peer | null = null;
  public isLeader = false;
  private leaderConnection: DataConnection | null = null;
  private clientConnections: Map<string, DataConnection> = new Map();
  private peerIdToProfileId: Map<string, string> = new Map();
  private profileIdToPeerId: Map<string, string> = new Map();
  private reconnectTimeout: any = null;
  private currentLeaderId: string | null = null;
  private profile: PlayerProfile | null = null;
  private heartbeatInterval: any = null;
  private pruneInterval: any = null;
  private initTimeout: any = null;
  private connectTimeout: any = null;
  private electionRetryCount = 0;

  constructor(profile: PlayerProfile) {
    this.profile = profile;
    this.init();
  }

  private init(isReconnect = false) {
    if (this.initTimeout) clearTimeout(this.initTimeout);
    console.log(`[LobbyManager] Initializing as potential leader (isReconnect: ${isReconnect})...`);
    store.dispatch(setMyStatus('CONNECTING'));
    
    // Newcomers wait a bit to give existing clients a chance to reclaim leader ID if it just became free
    const config = getLobbyConfig();
    const initialDelay = isReconnect ? 0 : config.newcomerDelay;
    
    this.initTimeout = setTimeout(() => {
      this.initTimeout = null;
      if (this.peer) return; // Already initialized by something else?
      
      this.peer = new Peer(getLobbyLeaderId(), getPeerConfig() || {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 1
      });

      this.peer.on('open', (id) => {
        console.log('[LobbyManager] Became LOBBY_LEADER with ID:', id);
        this.isLeader = true;
        this.electionRetryCount = 0;
        store.dispatch(setMyStatus('LOBBY_LEADER'));
        store.dispatch(updatePlayerStatus({ ...this.profile!, lastSeen: Date.now() }));
        
        this.peer!.on('connection', (conn) => this.handleClientConnection(conn));
        
        // Periodically prune dead clients and send heartbeats
        if (this.pruneInterval) clearInterval(this.pruneInterval);
        const isTest = !!import.meta.env.VITE_PEER_HOST;
        const heartbeatInterval = isTest ? 200 : 1000;
        this.pruneInterval = setInterval(() => {
          this.pruneDeadClients();
          this.sendHeartbeatToClients();
        }, heartbeatInterval);
      });

      this.peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
          // If we were trying to reconnect as leader and failed, it means either:
          // 1. The old leader session is still active (ghost)
          // 2. Someone else beat us to it and is now the leader
          // We'll retry a few times if we were already a member, then fall back to client mode.
          const isTest = !!import.meta.env.VITE_PEER_HOST;
          const maxRetries = isTest ? 5 : 60;
          const retryDelay = isTest ? 100 : 1000;

          if (isReconnect && this.electionRetryCount < maxRetries) {
            this.electionRetryCount++;
            console.warn(`[LobbyManager] Leader ID taken during election (attempt ${this.electionRetryCount}), retrying in ${retryDelay}ms...`);
            this.peer?.destroy();
            this.peer = null;
            setTimeout(() => this.init(true), retryDelay);
            return;
          }
          console.log('[LobbyManager] Leader ID taken, starting as client');
          this.electionRetryCount = 0;
          this.peer?.destroy();
          this.peer = null;
          this.startAsClient();
        } else if (err.type === 'network' || err.type === 'server-error') {
          console.warn(`[LobbyManager] Lobby peer ${err.type} error, retrying in 1s...`);
          this.peer?.destroy();
          this.peer = null;
          setTimeout(() => this.init(isReconnect), 1000);
        } else {
          console.error('[LobbyManager] Lobby peer error:', err);
        }
      });    }, initialDelay);
  }

  private startAsClient(retryWithRandom = false) {
    this.isLeader = false;
    const clientPeerId = retryWithRandom ? undefined : `gotfive-lobby-client-${this.profile!.id}`;
    console.log('[LobbyManager] Starting as client with ID:', clientPeerId || '(random)');
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    if (clientPeerId) {
      this.peer = new Peer(clientPeerId, getPeerConfig());
    } else {
      this.peer = new Peer(getPeerConfig());
    }

    this.peer.on('open', (id) => {
      console.log('[LobbyManager] Became LOBBY_CLIENT with ID:', id);
      store.dispatch(setMyStatus('LOBBY_CLIENT'));
      this.connectToLeader();
    });

    this.peer.on('error', (err: any) => {
      if (!retryWithRandom && err.type === 'unavailable-id') {
        console.log('[LobbyManager] Client peer ID taken, retrying with random ID');
        if (this.peer) this.peer.destroy();
        this.peer = null;
        this.startAsClient(true);
      } else {
        console.error('[LobbyManager] Client peer error:', err);
      }
    });
  }

  private leaderHeartbeatTimeout: any = null;
  private connectToLeader() {
    if (!this.peer) return;
    const leaderId = getLobbyLeaderId();
    console.log('[LobbyManager] Connecting to leader:', leaderId);
    
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.connectTimeout = setTimeout(() => {
      console.warn('[LobbyManager] Connection to leader timed out (ghost?)');
      this.handleLeaderDisconnect();
    }, 10000); // 10s connection timeout

    const conn = this.peer.connect(leaderId);
    
    if (!conn) return;

    const resetLeaderWatchdog = () => {
      if (this.leaderHeartbeatTimeout) clearTimeout(this.leaderHeartbeatTimeout);
      this.leaderHeartbeatTimeout = setTimeout(() => {
        console.warn('[LobbyManager] Leader watchdog timeout! Assuming leader is dead.');
        this.handleLeaderDisconnect();
      }, getLobbyConfig().watchdogTimeout);
    };

    conn.on('open', () => {
      if (this.connectTimeout) clearTimeout(this.connectTimeout);
      this.connectTimeout = null;

      console.log('[LobbyManager] Connected to leader');
      this.leaderConnection = conn;
      this.sendToLeader({ type: 'LOBBY_JOIN', payload: { ...this.profile!, lastSeen: Date.now() } });
      
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(() => {
        this.sendToLeader({ type: 'HEARTBEAT' });
      }, 1000); // 1s heartbeat
      resetLeaderWatchdog();
    });

    conn.on('data', (data) => {
      resetLeaderWatchdog();
      
      // Update leader's lastSeen locally since we just got data from them
      const state = store.getState().lobby;
      if (this.currentLeaderId && state.players[this.currentLeaderId]) {
        store.dispatch(updatePlayerStatus({ ...state.players[this.currentLeaderId], lastSeen: Date.now() }));
      }

      try {
        const msg = (typeof data === 'string' ? JSON.parse(data) : data) as LobbyMessage;
        if (msg.type === 'LOBBY_STATE') {
          this.currentLeaderId = msg.payload.leaderId;
          store.dispatch(setLobbyState(msg.payload));
        } else if (msg.type === 'LEADER_DISCONNECT') {
          console.log('[LobbyManager] Received LEADER_DISCONNECT gracefully');
          this.handleLeaderDisconnect();
        }
      } catch(e) {
        console.error('[LobbyManager] Failed parsing lobby msg', e);
      }
    });

    conn.on('close', () => {
      if (this.connectTimeout) clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
      console.log('[LobbyManager] Leader connection closed event');
      this.handleLeaderDisconnect();
    });
    conn.on('error', (err) => {
      if (this.connectTimeout) clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
      console.error('[LobbyManager] Leader connection error event:', err);
      this.handleLeaderDisconnect();
    });
  }

  private isDisconnecting = false;
  private handleLeaderDisconnect() {
    if (this.isDisconnecting) return;
    this.isDisconnecting = true;

    if (this.leaderConnection) {
      this.leaderConnection.close();
      this.leaderConnection = null;
    }
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
    
    const state = store.getState().lobby;
    const now = Date.now();
    
    // Ensure I am in the list of players for election
    const players = { ...state.players };
    if (this.profile && !players[this.profile.id]) {
      players[this.profile.id] = this.profile;
    }

    // EXCLUDE the dead leader
    if (this.currentLeaderId) {
      delete players[this.currentLeaderId];
    }

    const activePlayers = Object.values(players)
      .filter(p => p.id === this.profile?.id || now - p.lastSeen < 60000)
      .map(p => p.id)
      .sort();
      
    const myIndex = this.profile ? activePlayers.indexOf(this.profile.id) : -1;
    console.log('[LobbyManager] Leader disconnected. Active players:', activePlayers, 'My index:', myIndex);
    
    // New senior (index 0) should be very aggressive
    const isTest = !!import.meta.env.VITE_PEER_HOST;
    const delay = isTest 
      ? (myIndex <= 0 ? 50 : myIndex * 150)
      : (myIndex <= 0 ? (100 + Math.random() * 200) : (myIndex * 500 + Math.random() * 200));
    
    console.log(`[LobbyManager] Attempting to reconnect in ${delay}ms`);
    store.dispatch(setMyStatus('CONNECTING'));
    
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.isDisconnecting = false;
      if (this.peer) {
        console.log('[LobbyManager] Destroying old peer before reconnect');
        const oldPeer = this.peer;
        this.peer = null;
        try {
           oldPeer.destroy();
        } catch(e) {
           console.error('[LobbyManager] Error destroying peer:', e);
        }
        setTimeout(() => this.init(true), getLobbyConfig().reconnectDelay);
      } else {
        this.init(true);
      }
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
      payload: { players: state.players, publicGames: state.publicGames, leaderId: this.profile!.id }
    };
    const data = JSON.stringify(msg);
    this.clientConnections.forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }

  private sendHeartbeatToClients() {
    if (!this.isLeader) return;
    const msg = JSON.stringify({ type: 'HEARTBEAT' });
    this.clientConnections.forEach(conn => {
      if (conn.open) conn.send(msg);
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
      } else if (msg.type === 'LOBBY_STATE') {
         // Should not happen on leader, but for completeness
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
    if (this.leaderHeartbeatTimeout) clearTimeout(this.leaderHeartbeatTimeout);
    
    if (this.isLeader) {
      const msg = JSON.stringify({ type: 'LEADER_DISCONNECT' });
      this.clientConnections.forEach(c => {
        if (c.open) {
           c.send(msg);
        }
      });
    }
    
    if (this.leaderConnection) this.leaderConnection.close();
    this.clientConnections.forEach(c => c.close());
    this.clientConnections.clear();
    this.peerIdToProfileId.clear();
    this.profileIdToPeerId.clear();
    if (this.peer) {
      const p = this.peer;
      this.peer = null;
      p.destroy();
    }
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





