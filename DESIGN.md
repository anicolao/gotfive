# Got Five! Design Document

## 1. Overview
Got Five! is a digital implementation of the logic and deduction board game. This document specifies the technical architecture for a SvelteKit-based PWA utilizing Redux for state management and WebRTC for peer-to-peer multiplayer.

## 2. Technical Stack
- **Framework**: SvelteKit (Static Site Generation for PWA compatibility).
- **State Management**: Redux Toolkit (`@reduxjs/toolkit`).
- **P2P Communication**: WebRTC via `RTCPeerConnection` (Host-Client Hub).
- **Styling**: Svelte-scoped CSS with CSS Variables for a 70s-inspired color palette.
- **3D**: Threlte (Future expansion phase).
- **No-Go List**: No React, no Tailwind, no centralized server for game logic.

## 3. Data Structures (Redux State)

To simplify synchronization and implementation, **the full game state is shared across all clients**. We rely on player integrity regarding the inspection of the Redux store.

### 3.1. `game` Slice
```typescript
interface GameState {
  room: {
    id: string;
    hostId: string;
    status: 'LOBBY' | 'SETUP' | 'PLAYING' | 'FINISHED';
  };
  players: Record<string, Player>;
  // Shuffled at start by the Host
  deck: Tile[]; 
  board: {
    publicPool: Tile[];
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
  // All players see these, but the owner should "pretend" not to know the numbers
  hand: Tile[]; 
  stand: {
    sortNotches: (Tile | null)[6]; // 6 slots between/around 5 tiles
    compareNotes: Record<number, CompareNote[]>; // Per-tile-slot notes (index 0-4)
  };
  hasGuessed: boolean;
  isWinner: boolean;
  isReady: boolean;
}

interface Tile {
  id: string; // uuid for identity
  number: number; // 1-60
  // color and dots are derived in the UI:
  // color = colors[(number - 1) % 5] (Red, Blue, Yellow, Green, Purple)
  // dots = Math.floor((number - 1) / 5) % 3 + 1 (1, 2, or 3)
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

## 4. WebRTC Architecture

### 4.1. Host-Client Model
1. **The Host**: The first user to create a room. Responsible for:
   - Initializing the game state.
   - Shuffling the `deck`.
   - Acting as the signaling hub for WebRTC (via a lightweight signaling service or manual link sharing).
   - Broadcasting the authoritative state to all clients.
2. **The Client**: Connects to the Host.
   - Receives the full state.
   - Dispatches actions to the Host.

### 4.2. Action Synchronization
- **Optimistic UI**: Clients can run the reducer locally for immediate feedback, but the Host's state is authoritative.
- **Action Relay**: When a client performs an action, it is sent over the WebRTC Data Channel to the Host.
- **State Broadcast**: The Host applies the action and broadcasts the updated state to all peers.

## 5. Game Logic & Rules Implementation

### 5.1. Tile Properties
- **Colors**: 5 colors (Red, Blue, Yellow, Green, Purple).
- **Numbers**: 1-60.
- **Dots**: 1, 2, or 3.
  - `color = (tile.number - 1) % 5`
  - `dots = (Math.floor((tile.number - 1) / 5) % 3) + 1`

### 5.2. Sorting Logic
- Hidden tiles are always sorted ascending (left-to-right) on a player's stand.
- A "SORT" clue involves placing a tile in one of 6 notches:
  - Notch 0: Tile < Hand[0]
  - Notch 1: Hand[0] < Tile < Hand[1]
  - ...
  - Notch 5: Tile > Hand[4]

### 5.3. Comparison Logic
- A "COMPARE" clue checks if `tile.dots === hand[slotIndex].dots`.

## 6. Aesthetic & UI Design

The UI utilizes a **"70s Modern/Retro-Futurism"** aesthetic: warm "Harvest Gold" and "Avocado Green" tones, chunky plastic textures, and rounded corners.

### 6.1. Visual Mockups (Inspiration)
The following mockups (located in `/mockups/`) define the visual direction:

- **Lobby (`lobby.svg`)**: Retro-styled room selection with a patterned background and chunky "Comic Sans-adjacent" typography for a playful feel.
- **Main Board (`main_board.svg`)**: A top-down view of a wood-grain table with a central avocado-green felt area. Players' stands are arranged around the perimeter.
- **Deduction Board (`deduction_board.svg`)**: A "Top Secret" folder aesthetic with a grid of numbers 1-60 for tracking exclusions and hits.
- **Game Tiles (`game_tiles.svg`)**: Close-up detail of the plastic tiles showing chunky numbers, dot patterns, and the 70s color palette.

### 6.2. UI Components
- `App.svelte`: Root with WebRTC and Redux providers.
- `Tabletop.svelte`: Container for the 3D-ish 2D view.
- `Tile.svelte`: Reusable component with CSS-based "plastic" shading and dot patterns.
- `DeductionGrid.svelte`: Interactive logic grid.

## 7. Action Manifest (Redux)

- `room/join(player)`
- `game/start()`: Shuffles deck, deals tiles.
- `game/draw(tileId)`: Moves tile from deck to public pool.
- `game/requestClue(clueRequest)`
- `game/provideClue(clueResponse)`
- `game/shoutGotFive(guesses)`
- `game/endTurn()`
