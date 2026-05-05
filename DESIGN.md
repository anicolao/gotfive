# Got Five! Design Document

## 1. Overview
Got Five! is a digital implementation of the logic and deduction board game. This document specifies the technical architecture for a SvelteKit-based PWA utilizing Redux for state management and WebRTC for peer-to-peer multiplayer.

## 2. Technical Stack
- **Framework**: SvelteKit (Static Site Generation for PWA compatibility).
- **State**: Redux Toolkit (`@reduxjs/toolkit`).
- **P2P**: WebRTC via `RTCPeerConnection` (Host-Client architecture).
- **Styling**: Svelte-scoped CSS with CSS Variables for the 70s color palette.
- **3D**: Threlte (Future phase).

## 3. Data Structures (Redux State)

### 3.1. `game` Slice (Authoritative on Host)
```typescript
interface GameState {
  room: {
    id: string;
    hostId: string;
    status: 'LOBBY' | 'SETUP' | 'PLAYING' | 'FINISHED';
  };
  config: {
    maxPlayers: number;
    colors: ['red', 'blue', 'yellow', 'green', 'purple'];
    numbersPerColor: 12; // 1-12 in each color = 60 tiles
  };
  players: Record<string, Player>;
  board: {
    publicPool: Tile[];
    supply: Tile[]; // Authoritative shuffled stack (Host only)
    trash: Tile[];
  };
  turn: {
    activePlayerId: string;
    phase: 'DRAW' | 'CLUE' | 'WAIT_CLUE';
    currentClueRequest: ClueRequest | null;
  };
}

interface Player {
  id: string;
  name: string;
  hand: Tile[]; // Your 5 hidden tiles (visible to everyone ELSE)
  stand: {
    sortNotches: (Tile | null)[6]; // 6 slots between/around 5 tiles
    compareNotes: Record<number, CompareNote[]>; // Per-tile-slot notes
  };
  hasGuessed: boolean;
  isWinner: boolean;
}

interface Tile {
  id: string; // uuid
  number: number; // 1-12
  color: string;
  dots: 1 | 2 | 3;
}

interface ClueRequest {
  type: 'SORT' | 'COMPARE';
  requesterId: string;
  targetId: string;
  poolTileId: string;
  slotIndex?: number; // For COMPARE
}
```

### 3.2. `ui` Slice (Local only)
- `myId`: string
- `isHost`: boolean
- `deductionLog`: Record<number, 'KNOWN' | 'POSSIBLE' | 'EXCLUDED'>;
- `overlay`: 'RULES' | 'GUESS' | 'NONE';

## 4. Actions & Transitions

### 4.1. Lifecycle Actions
- `room/create`: Initializes host state.
- `room/join`: Dispatched when a peer connects.
- `game/start`: Host shuffles tiles and assigns 5 to each player.

### 4.2. Turn Actions
- `game/drawTile`: Host pops from `supply` to `publicPool`.
- `game/askClue`: Requester sends `ClueRequest` to Target.
- `game/submitClue`: Target provides answer (Slot index for SORT, Boolean for COMPARE).
- `game/endTurn`: Moves `activePlayerId` to next in sequence.

### 4.3. Victory Actions
- `game/shoutGotFive`: Player submits 5 guesses.
- `game/verifyVictory`: Host checks guesses against `player.hand`. If correct, `status = 'FINISHED'`.

## 5. WebRTC Architecture

### 5.1. Signaling
We use a lightweight signaling relay (e.g., PeerJS or a simple WebSocket server) to exchange SDP and ICE candidates.
1. **Host** creates a Peer ID (Room ID).
2. **Client** joins via `?room=ROOM_ID`.
3. **Handshake**: Client sends Offer -> Host sends Answer -> DataChannel opened.

### 5.2. State Sync Flow
- **Clients** never modify the game state directly. They dispatch **Local Actions**.
- **Local Actions** are intercepted by a middleware and sent to the **Host** via the DataChannel.
- **Host** processes the action, updates its Redux store, and broadcasts a `sync/state` message containing the patched state to all Clients.
- **Middleware**: A custom Redux middleware handles the WebRTC message passing.

## 6. Svelte Component Map

- `App.svelte`: Root provider, WebRTC initialization.
- `Lobby.svelte`: Player list, Invite link, Ready button.
- `Tabletop.svelte`: Main game view.
  - `CenterPool.svelte`: Displays `publicPool` and face-down `supply`.
  - `PlayerScreen.svelte`: (x3) Displays opponents' `hand` and `stand`.
  - `MyStand.svelte`: Displays the player's own `stand` (but not `hand`).
- `DeductionLog.svelte`: Sticky/Bottom-sheet grid for tracking numbers.
- `ClueOverlay.svelte`: UI for selecting SORT/COMPARE options.

## 7. 70s Aesthetic Implementation
- **Palette**: 
  - Avocado Green: `#558B2F`
  - Burnt Orange: `#D84315`
  - Mustard Yellow: `#F9A825`
  - Harvest Gold: `#FFB74D`
  - Deep Brown: `#3E2723`
- **Typography**: "Cooper Black" style headings, "Courier" for deduction logs.
- **UI Elements**: Rounded corners (20px+), thick borders (4px+), heavy drop shadows.

## 8. Threlte Roadmap
1. **Phase 1**: 2D CSS-based tiles with "clacky" animations.
2. **Phase 2**: Replace `Tile.svelte` with `Tile3D.svelte` using `<T.Mesh>`.
3. **Phase 3**: Physics-enabled dice/tile drops using `@threlte/rapier`.

## 9. Mockups
Existing mockups in `/mockups`:
- `main_board.svg`: Tabletop layout.
- `deduction_board.svg`: Player deduction interface.
- `lobby.svg`: Pre-game room management.
