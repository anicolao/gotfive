# Got Five! Design Document

## 1. Overview
Got Five! is a digital implementation of the logic and deduction board game by Blue Orange Games. This document outlines the technical architecture, data structures, and UI/UX design for a Svelte-based PWA featuring WebRTC-powered multiplayer.

## 2. Technical Stack
- **Frontend Framework**: Svelte / SvelteKit
- **State Management**: Redux (via `@reduxjs/toolkit`)
- **Communication**: WebRTC (P2P) for real-time game state synchronization.
- **Styling**: Plain Svelte-scoped CSS.
- **3D Implementation (Future)**: Threlte (Svelte + Three.js).

## 3. Data Structures (Redux State)

### 3.1. Game State (`state.game`)
```typescript
interface GameState {
  roomId: string;
  hostId: string;
  players: Record<string, Player>;
  publicPool: Tile[];
  supplyCount: number; // Only the host knows the actual supply order
  currentTurn: string; // Player ID
  phase: 'LOBBY' | 'SETUP' | 'DRAW' | 'CLUE' | 'GUESS' | 'FINISHED';
  winnerId: string | null;
}

interface Player {
  id: string;
  name: string;
  // Your 5 tiles (hidden from you, visible to others)
  hiddenTiles: Tile[]; 
  // Clues received on your stand
  stand: {
    notches: (Tile | null)[]; // For SORT clues
    comparisons: Record<number, { tile: Tile, match: boolean }[]>; // For COMPARE clues
  };
  isOnline: boolean;
}

interface Tile {
  id: string;
  number: number; // 1-60
  color: 'red' | 'blue' | 'yellow' | 'green' | 'purple';
  dots: 1 | 2 | 3;
}
```

### 3.2. Local State (`state.local`)
- `myId`: The local player's ID.
- `deductionBoard`: A 60-element boolean array or grid tracking crossed-out numbers.

## 4. Actions

### 4.1. Core Actions
- `game/initialize`: Triggered by host to shuffle tiles and distribute.
- `game/drawTile`: Draw a tile from the supply and add to `publicPool`.
- `game/askClue`: 
  - `type`: 'SORT' | 'COMPARE'
  - `targetPlayerId`: string
  - `poolTileId`: string
  - `slotIndex`: number (for COMPARE)
- `game/provideClue`: The neighbor submits the answer (Notch position or Yes/No).
- `game/announceGuess`: Shout "GOT FIVE!" and provide 5 numbers.
- `game/verifyGuess`: Host/Clients verify the guess against the hidden tiles.

## 5. WebRTC Architecture

### 5.1. Host-Client Model
- The first user to create a room becomes the **Host**.
- The Host maintains the authoritative `supply` (the actual numbers on all face-down tiles).
- Clients connect to the Host via WebRTC data channels.

### 5.2. State Synchronization
- The Redux state is mirrored across all peers.
- When an action is dispatched locally, it is encapsulated in a message and sent to the Host.
- The Host validates the action, updates its local state, and broadcasts the updated state (or the action) to all connected Clients.
- **Conflict Resolution**: The Host's timestamp/ordering is final.

### 5.3. Connection Flow
1. **Create Room**: Host initializes a WebRTC signaling listener (using a simple broker or manual SDP exchange).
2. **Join Room**: Client uses the link (containing Room ID/Signaling info) to initiate connection.
3. **Handshake**: Peers establish DataChannels.

## 6. UI/UX Design

### 6.1. Visual Style
- **Aesthetic**: 70s-inspired vibrant colors (avocado green, burnt orange, mustard yellow).
- **Tiles**: "Clacky" look with bold typography and "sassy" faces on the numbers.
- **Responsiveness**: Mobile-first PWA, but optimized for desktop "tabletop" feel.

### 6.2. Mockups
- **Main Board**: A central table view showing the public pool and other players' screens.
- **Deduction View**: A private workspace where the player can cross out numbers on a grid.

*Note: Initial mockups have been generated as SVG files in the `mockups/` directory.*
- `mockups/main_board.svg`: Shows the 70s-style tabletop and tile stands.
- `mockups/deduction_board.svg`: Shows the "Top Secret" deduction log interface.

## 7. Migration Plan
- The current project uses React. The first phase of implementation will involve removing React dependencies and initializing a Svelte/SvelteKit environment.
- Tailwind will be avoided in favor of modular CSS.
