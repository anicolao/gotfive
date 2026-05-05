# Got Five! Design Document

## 1. Overview
Got Five! is a digital adaptation of the logic and deduction board game. This document specifies the technical architecture for a SvelteKit-based PWA utilizing Redux for state management and WebRTC for peer-to-peer multiplayer.

### 1.1 Aesthetic & Theme
- **Retro 70s Groovy**: The UI utilizes a palette of Avocado Green, Harvest Gold, Burnt Orange, and Wood textures.
- **Sassy Tiles**: Game tiles feature expressive "sassy" faces and star-eyes, adding character to the numbers.
- **Analog Feel**: Buttons and panels mimic plastic and paper components from the 1970s.

## 2. Technical Stack
- **Framework**: SvelteKit (Static Site Generation for PWA compatibility).
- **State Management**: Redux Toolkit (`@reduxjs/toolkit`).
- **P2P Communication**: WebRTC via `RTCPeerConnection` (Host-Peer Mesh).
- **Styling**: Svelte-scoped CSS with CSS Variables for a 70s-inspired color palette.
- **3D**: Threlte (Future expansion phase).
- **No-Go List**: No React, no Tailwind, no centralized server for game logic.

## 3. Data Structures (Redux State)

The state is managed in a normalized Redux store. Each client maintains the full game state, including the deck and other players' hidden tiles. The UI is responsible for masking this information from the local player.

### 3.1. `game` Slice
```typescript
interface PlayState {
  status: 'LOBBY' | 'SETUP' | 'PLAYING' | 'FINISHED';
  deck: number[]; // Full shuffled sequence of 60 tiles (IDs 1-60)
  deckIndex: number; // Points to the next tile to be revealed
  publicPool: number[]; // Tile IDs currently face up
  turnOrder: string[]; // List of player IDs
  currentPlayerIndex: number;
  winnerId: string | null;
  seed: number; // Seed for the initial shuffle
}
```

### 3.2. `players` Slice
```typescript
interface Player {
  id: string;
  name: string;
  // Hidden tiles: [Red, Blue, Yellow, Green, Purple]
  // Always sorted ascending. Known to all clients, masked by UI.
  hand: number[]; 
  clues: ClueRecord[];
  isConnected: boolean;
  eliminated: boolean;
}

interface ClueRecord {
  type: 'SORT' | 'COMPARE';
  tileId: number;
  result: number | boolean; // Notch index (0-5) or Yes/No (boolean)
  targetSlot?: number; // For COMPARE (0-4)
}
```

### 3.3. `ui` Slice (Local only)
- `myId`: string
- `deductionBoard`: Record<number, '?' | 'X' | 'OK'>; // Local player's marks for numbers 1-60
- `overlay`: 'RULES' | 'GUESS' | 'NONE';

### 3.4. Tile Derivation Logic
Tiles are identified by an ID from 1 to 60. All properties are derived from this ID:

- **Color**: `(id - 1) % 5`
  - 0: Red, 1: Blue, 2: Yellow, 3: Green, 4: Purple
- **Dots**: `Math.floor((id - 1) / 5) % 3 + 1`
  - Results in a repeating 1-2-3 pattern for each color as numbers increase.
- **Number**: The ID itself is the number printed on the tile.

## 4. WebRTC & Communication Protocol

### 4.1. Fully Transparent Protocol
The Host shuffles the deck once at the start and broadcasts the entire sequence to all peers.

1. **Initial Shuffle**: The Host generates the deck order and shares it during the `game/start` action.
2. **Action Sequencing**: The Host acts as the authoritative sequencer. Every action (Reveal, Clue, Guess) is assigned a monotonically increasing `index` by the Host and broadcasted.
3. **Local Hiding**: While the client state contains all tile positions, the UI component for an opponent's stand will only render face-down tiles unless the game is over.
4. **Immediate Feedback**: Players can see their own results immediately locally, but the "official" state update happens when the Host's broadcasted action is received.

### 4.2. Action Relay Flow
- **Peer Intent**: Peer sends an `INTENT` to the Host.
- **Host Broadcast**: Host validates, assigns an `index`, and broadcasts the `ACTION` to all peers.
- **State Synchronization**: All clients apply the `ACTION` using the same Redux reducers.

## 5. Redux Actions

| Action | Payload | Effect |
| :--- | :--- | :--- |
| `room/join` | `{ id: string, name: string }` | Adds a player to the lobby. |
| `game/start` | `{ deck: number[], turnOrder: string[] }` | Initializes game state with the shuffled deck. |
| `game/reveal` | `void` | Increments `deckIndex` and adds the tile to `publicPool`. |
| `game/clue_sort` | `{ targetId: string, tileId: number, notch: number }` | Adds a SORT clue to a player's record. |
| `game/clue_compare` | `{ targetId: string, tileId: number, slot: number, match: boolean }` | Adds a COMPARE clue to a player's record. |
| `game/guess` | `{ playerId: string, guesses: number[] }` | Checks guesses against the player's `hand`. |

## 6. Svelte Implementation

- **App Structure**:
  - `/`: Landing page, create/join room.
  - `/room/[id]`: The game instance.
- **Components**:
  - `Table.svelte`: Displays the `publicPool` of revealed tiles.
  - `PlayerStand.svelte`: Displays the player's 5 hidden tiles (backs facing player) and received clues.
  - `OpponentStand.svelte`: Displays opponent's tiles (numbers hidden by UI until game over) and their clues.
  - `DeductionBoard.svelte`: A grid for the player to mark off eliminated numbers (local state only).
- **UI Masking Strategy**: 
  ```svelte
  {#if isGameOver || isRevealed}
    <Tile number={tileNumber} />
  {:else}
    <TileBack />
  {/if}
  ```

## 7. Visual Inspiration (AI Mockup Prompts)

Establish the "Retro 70s Groovy" look with these prompts:

### 7.1. The Game Room Vibe
> "A high-angle tabletop view of a 1974 board game called 'Got Five!'. The table is dark wood grain. In the center is an avocado green felt circle. On the felt are chunky cream-colored plastic tiles with orange and blue numbers. Around the table are 1970s interior elements like patterned wallpaper in harvest gold and burnt orange. Warm, analog lighting, high detail, retro-futurism aesthetic."

### 7.2. The Sassy Tiles
> "Close-up of three thick, rounded plastic game tiles. One is red with the number '1', one is blue with '17', and one is purple with '45'. Each tile has a minimalist 'sassy' face drawn in black ink—one winking, one with star-eyes, one with a smirk. 1970s toy photography style."

### 7.3. The Deduction Log
> "A 'Top Secret' manila folder lying on a wooden table. Inside the folder is a grid of numbers from 1 to 60. Some numbers are crossed out with a red marker, others have a green checkmark. A chunky orange plastic pen lies next to the folder. 1970s spy movie aesthetic."

### 7.4. The Player Stand
> "A 3D render of a dark brown plastic stand holding five hidden game tiles. The tiles are facing away from the viewer. The stand has six distinct notches for placing other tiles. Warm and directional lighting, soft shadows on a green felt surface. Retro-modern product design."
