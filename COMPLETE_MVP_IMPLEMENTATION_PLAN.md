# Got Five! COMPLETE_MVP_IMPLEMENTATION_PLAN

This plan outlines the logical order to complete the "Got Five!" MVP, incorporating the requirement for a 5x12 deduction grid with freehand drawing capabilities.

## Phase I: Core Game Mechanics & State (Current Focus)
The goal is to move from a "reveal-only" state to a playable local game loop.

### 1.1 Clue Action Reducers
- **Implementation**: Update `playersSlice.ts` and `gameSlice.ts`.
- **Logic**: 
    - `game/clue_sort`: Record the position (notch 0-5) of a public tile relative to a player's hand.
    - `game/clue_compare`: Record if a public tile matches the dot count of a specific slot (0-4) in a player's hand.
- **Validation**: Ensure actions are only taken during the correct turn phase.

### 1.2 Player Stand Enhancements
- **UI**: Update `PlayerStand.svelte`.
- **Features**:
    - Display 6 "notches" for placing `SORT` clues.
    - Display markers for `COMPARE` clues (e.g., a "Yes/No" indicator near the slot).
    - Allow interaction to "drop" a tile from the public pool onto a stand to trigger a clue action.

### 1.3 Turn Flow Integration
- **Logic**: Automatically advance turns or provide a clear "End Turn" signal after a Clue/Guess is made.
- **UI**: Add a `TurnIndicator` and handle `currentPlayerIndex` transitions.

## Phase II: The 5x12 Deduction Grid (Current Focus)
The goal is to provide a high-fidelity deduction tool as requested.

### 2.1 DeductionBoard Component
- **Layout**: 5 rows (one per color), 12 columns (tiles for that color).
- **Aesthetic**: Cells should look like mini `Tile` components (retro 70s style).
- **Data**: Tiles in each row are:
    - Red: 1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56
    - Blue: 2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57
    - ... and so on for Yellow, Green, Purple.

### 2.2 Freehand Drawing Layer
- **Implementation**: Overlay a `<canvas>` element on the `DeductionBoard`.
- **Features**:
    - Support for stylus and mouse input.
    - Tools: Pen (Black/Red), Eraser, Clear All.
    - Persistent local storage for the drawing (so it survives page refreshes).

### 2.3 Formatted Deductions
- **Interaction**: Clicking a tile in the grid toggles its state:
    - `Unknown` (Default)
    - `Eliminated` (X)
    - `Confirmed` (OK/Circle)
- **State**: Sync with `uiSlice.deductionBoard`.

## Phase III: Guessing & Win Conditions
The goal is to enable game completion.

### 3.1 Guessing Mechanism
- **UI**: A prominent "GOT FIVE!" button that opens a guessing modal.
- **Interaction**: Player selects 5 numbers (one of each color) and places them in order.
- **Validation**: Compare against the actual `hand` in `playersSlice`.

### 3.2 End of Game Handling
- **Logic**: Set `winnerId` and change `status` to `FINISHED`.
- **UI**: Reveal ALL players' hidden tiles in an "End Game" view.
- **Elimination**: If a guess is wrong, mark the player as `eliminated`.

## Phase IV: Multiplayer & Connectivity
The goal is to move from local-only to P2P multiplayer.

### 4.1 WebRTC Integration
- **Framework**: Use a simple WebRTC wrapper (e.g., `peerjs` or raw `RTCPeerConnection`).
- **Roles**: Host manages the sequence; Peers sync state via actions.
- **Protocol**: Thin broadcast of actions (`reveal`, `clue`, `guess`).

### 4.2 PWA Polish
- **Features**: Finalize manifest, icons, and ensure high performance on mobile devices.
- **Visuals**: Review and refine 70s Groovy aesthetic across all components.
