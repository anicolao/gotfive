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

The state is managed in a normalized Redux store. To maintain the "thin" protocol, each client maintains its own state by applying actions in the same order.

### 3.1. `game` Slice
```typescript
interface GameState {
  roomId: string;
  hostId: string;
  status: 'LOBBY' | 'SETUP' | 'PLAYING' | 'FINISHED';
  turnIndex: number;
  // Authoritative only on Host for 'SETUP' phase, 
  // but public once revealed.
  supply: number[]; // Tile IDs remaining
  publicPool: number[]; // Tile IDs face up
  actionHistory: ActionLog[];
}

interface ActionLog {
  index: number;
  action: ReduxAction;
  timestamp: number;
}
```

### 3.2. `players` Slice
```typescript
interface Player {
  id: string;
  name: string;
  // Hidden tiles: [Red, Blue, Yellow, Green, Purple]
  // Peer view: numbers are null unless revealed/game over.
  // Host view: all numbers are known.
  hand: (number | null)[]; 
  isConnected: boolean;
  eliminated: boolean;
}
```

### 3.3. `ui` Slice (Local only)
- `myId`: string
- `deductionLog`: Record<number, '?' | 'X' | 'OK'>; // Local player's deductions
- `overlay`: 'RULES' | 'GUESS' | 'NONE';

## 4. WebRTC & Communication Protocol

### 4.1. Thin Communication Model
The Host does not broadcast the full state. Instead, it acts as the authoritative sequencer of actions.

1. **Host Authoritarianism**: The Host is responsible for all non-deterministic events (shuffling, drawing tiles).
2. **Action Sequencing**: Every action is assigned a monotonically increasing `index` by the Host.
3. **Optimistic Local Execution**: Clients can apply actions locally for immediate UI feedback. If the Host's broadcasted action (with index) matches the local intent, it confirms correctness. If not, the client reconciles with the Host's authoritative action.
4. **State Maintenance**: Each client runs the same reducers on the same sequence of actions to reach the same state.

### 4.2. Action Relay Flow
- **Peer Action**: Peer sends `INTENT` (e.g., "Reveal Tile") to Host.
- **Host Confirmation**: Host generates the result (e.g., `tileId: 15`), assigns an `index`, and broadcasts the `ACTION` to all peers.
- **State Update**: All clients apply `ACTION` to their Redux store.

## 5. Redux Actions

| Action | Payload | Effect |
| :--- | :--- | :--- |
| `game/start` | `{ seed: number }` | Initializes deck and deals tiles (Host only). |
| `game/reveal` | `{ tileId: number }` | Moves tile from supply to public pool. |
| `game/clue_sort` | `{ targetId: string, tileId: number, notch: number }` | Records a sort clue on a player's stand. |
| `game/clue_compare` | `{ targetId: string, tileId: number, slot: number, match: boolean }` | Records a dot-comparison clue. |
| `game/guess` | `{ playerId: string, guesses: number[] }` | Validates a player's final guess. |

## 6. Svelte Implementation

- **Scoped CSS**: Components encapsulate their own 70s styles using CSS variables defined in a global theme (e.g., `--color-avocado`, `--color-harvest-gold`).
- **Analog Interactions**: Buttons use CSS `:active` states to mimic physical plastic clicks.
- **Threlte Future**: The 2D component structure (Tabletop -> Stands -> Tiles) is designed to be easily swappable for Threlte 3D components while maintaining the same Redux backing.

## 7. Visual Inspiration (AI Mockup Prompts)

Since the project avoids additional SVGs, use the following prompts in an AI image generator (like Midjourney or DALL-E) to produce visual inspiration for the implementation:

### 7.1. The Game Room Vibe
> "A high-angle tabletop view of a 1974 board game called 'Got Five!'. The table is dark wood grain. In the center is an avocado green felt circle. On the felt are chunky cream-colored plastic tiles with orange and blue numbers. Around the table are 1970s interior elements like patterned wallpaper in harvest gold and burnt orange. Warm, analog lighting, high detail, retro-futurism aesthetic."

### 7.2. The Sassy Tiles
> "Close-up of three thick, rounded plastic game tiles. One is red with the number '1', one is blue with '17', and one is purple with '45'. Each tile has a minimalist 'sassy' face drawn in black ink—one winking, one with star-eyes, one with a smirk. The numbers are in a chunky, 'Cooper Black' inspired font. 1970s toy photography style, soft focus background."

### 7.3. The Deduction Log
> "A 'Top Secret' manila folder lying on a wooden table. Inside the folder is a grid of numbers from 1 to 60. Some numbers are crossed out with a red marker, others have a green checkmark. The paper looks aged and slightly yellowed. A chunky orange plastic pen lies next to the folder. 1970s spy movie aesthetic, macro photography."

### 7.4. The Player Stand (Threlte Inspiration)
> "A 3D render of a dark brown plastic stand holding five hidden game tiles. The tiles are facing away from the viewer. The stand has six distinct notches for placing other tiles. The lighting is warm and directional, casting soft shadows on a green felt surface. Retro-modern product design, high fidelity, 70s colors."

## 8. Existing Mockups (Reference)
- `mockups/lobby.svg`: Lobby and room setup.
- `mockups/main_board.svg`: Table layout.
- `mockups/game_tiles.svg`: Tile color and dot logic.
- `mockups/deduction_board.svg`: Deduction log layout.
