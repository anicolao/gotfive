# Global Lobby Design Document: Got Five!

## 1. Introduction
This document outlines the design for a decentralized Global Lobby system for "Got Five!". The goal is to allow players to discover each other, see public games, and manage their profiles without a central backend server (other than the PeerJS signaling server).

## 2. Core Problem: Authoritative Source in P2P
The central challenge is determining which browser instance is the authoritative source for the lobby state (the "Lobby Leader"). This instance must manage the list of active players and public games, and this role must be passed smoothly to another instance when the current leader departs.

## 3. Architecture: Dynamic Leader Election

### 3.1. Discovery and Connection
- **Lobby Entry Point**: Upon landing on the homepage, a browser attempts to initialize a PeerJS `Peer` with a fixed ID: `gotfive-lobby-leader`.
- **Role Assignment**:
    - **Success**: If the ID is successfully claimed, this instance becomes the **Lobby Leader**.
    - **Failure**: If the ID is already taken (Error: `id-taken`), this instance becomes a **Lobby Client**. It then generates a random Peer ID and connects to `gotfive-lobby-leader`.

### 3.2. Failover and Continuity
To handle arbitrary departures (tab closing, crashes, network loss):
1. **State Replication**: Every Lobby Client maintains a local Redux state of the current lobby (`players` and `publicGames`). The Lobby Leader broadcasts the full state to all clients whenever it changes.
2. **Disconnect Detection**: Clients listen for the `close` or `error` event on their connection to the Lobby Leader.
3. **Re-election Algorithm**:
    - When a disconnect is detected, clients wait for a jittered delay: `delay = (index_in_peer_list * 200ms) + random(0, 100ms)`.
    - After the delay, the client attempts to claim the `gotfive-lobby-leader` ID.
    - The first client to successfully claim the ID becomes the new Lobby Leader.
    - The new leader immediately broadcasts their last known lobby state to all other clients who are now connecting to it.

## 4. State Management

### 4.1. Redux Schema (`lobby` slice)
```typescript
interface LobbyState {
  players: Record<string, PlayerProfile>;
  publicGames: Record<string, GameInfo>;
  myStatus: 'OFFLINE' | 'CONNECTING' | 'LOBBY_CLIENT' | 'LOBBY_LEADER';
}

interface PlayerProfile {
  id: string;
  name: string;
  avatar: string; // Icon name or SVG
  status: 'visible' | 'lurking';
  lastSeen: number; // Timestamp
}

interface GameInfo {
  hostId: string;
  hostName: string;
  name: string;
  visibility: 'public' | 'hidden';
  playerCount: number;
  maxPlayers: number;
}
```

### 4.2. Network Messages
- `LOBBY_JOIN`: Client -> Leader. Sends `PlayerProfile`.
- `LOBBY_STATE`: Leader -> Client(s). Full broadcast of `LobbyState`.
- `GAME_REGISTER`: Game Host -> Leader. Adds a game to `publicGames`.
- `GAME_UNREGISTER`: Game Host -> Leader. Removes a game.
- `HEARTBEAT`: Bidirectional. Used to prune stale entries if a connection is lost without a clean `close`.

## 5. User Experience Flow

### 5.1. Profile Onboarding
- If no profile is found in `localStorage`:
    1. Show an overlay modal prompting for a Name and Avatar selection.
    2. Offer a toggle for "Visible" vs "Lurking".
    3. Save to `localStorage` (persists as a "cookie").
- If profile exists, automatically join the lobby using the stored data.

### 5.2. Lobby Interface
- **Players List**: Scrollable list of all players in the lobby. Lurkers are included but marked appropriately.
- **Games List**: Cards showing public games currently being hosted. Each card has a "Join" button.
- **Host Game Button**: Opens a modal to set game name and visibility (Public/Hidden).

### 5.3. Joining a Game
- Clicking "Join" on a game card triggers a redirect or navigation to the game route, passing the `hostId` as a PeerJS target (e.g., `/?peerId=HOST_ID`).
- The player then leaves the Global Lobby (disconnects from `gotfive-lobby-leader`) and joins the Game Host's specific peer network.

## 6. Edge Cases & Considerations

- **Leader Bottleneck**: PeerJS connections are limited by the browser (usually ~50-256). If the lobby exceeds this, a hierarchical structure (Lobby Clusters) may be needed. For MVP, a single leader is sufficient.
- **Split Brain**: If two instances both think they are the leader (e.g., network partition), PeerJS's central signaling server will eventually resolve it as only one can hold the ID.
- **Stale Games**: If a Game Host crashes, the Lobby Leader will detect the connection loss via PeerJS `close` event or Heartbeat timeout and remove the game from the list.
