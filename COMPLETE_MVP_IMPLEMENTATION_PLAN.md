# COMPLETE_MVP_IMPLEMENTATION_PLAN

This document outlines the logical order for completing the Got Five! MVP, incorporating Phase I and II requirements with a focus on the deduction board and core game loop.

## Phase I: Core Game & Local Deduction
**Goal:** A fully playable local version of the game where one player can interact with mock opponents and use the deduction board.

1.  **Deduction Board (The "Top Secret" Log)**
    - Implement `DeductionBoard.svelte`.
    - **Grid Layout**: 5 rows (one per color) x 12 columns (numbers 1-60 distributed by color).
    - **Aesthetic**: Grid cells should look like small "Sassy Tiles" (rounded corners, plastic texture, color-coded).
    - **Writing Layer**:
        - SVG or Canvas overlay to allow freehand drawing/marking with mouse or stylus.
        - State for freehand marks should be persisted locally.
    - **Automated Marking**:
        - Logic to automatically dim or mark tiles that are visible on the table or in opponent stands.
        - Structured marks ('X', 'OK', '?') available per cell.

2.  **Advanced Game State**
    - **Turn Management**: Track `currentPlayerIndex` and enforce the "Reveal -> Clue" turn sequence.
    - **Clue Actions**:
        - `game/clue_sort`: Logic to determine which notch (0-5) a tile fits into relative to a player's hand.
        - `game/clue_compare`: Logic to compare dots between a revealed tile and a hand slot.
    - **Guessing**:
        - `game/guess`: Logic to validate a player's guess for all 5 tiles.
        - Win/Loss state handling.

3.  **Enhanced Components**
    - **OpponentStand**: Displays tile backs (sassy faces) and a visual log of clues received by that opponent.
    - **Clue Interaction UI**: A way for the current player to select a revealed tile and a target (opponent or self) to "Ask for a Clue".
    - **Notch Visualization**: Update `PlayerStand` and `OpponentStand` to visually show where "SORT" tiles were placed.

## Phase II: P2P Multiplayer
**Goal:** Connect multiple players via WebRTC to play the same game.

1.  **Connectivity & Signaling**
    - Implement WebRTC Host-Peer mesh.
    - Basic signaling (Copy/Paste of SDP or a simple public relay).
    - Room management (Create/Join).

2.  **State Synchronization**
    - Implement the "Thin Protocol": Host broadcasts actions with indices; peers apply locally.
    - Handle late joiners or reconnections (Host sends full current state).

3.  **Multiplayer UI**
    - Lobby screen with player list and "Ready" buttons.
    - In-game chat (optional, but good for "shouting" GOT FIVE!).

## Phase III: Polish & PWA
**Goal:** Finalize the "Retro 70s Groovy" look and ensure it works offline.

1.  **Visual Polish**
    - Refine CSS variables and styles for consistent 70s aesthetic.
    - Add animations for tile movements and clue placement.

2.  **PWA Features**
    - Service worker for offline asset caching.
    - Web App Manifest for "Add to Home Screen".

3.  **E2E Testing**
    - Full scenario testing for gameplay from start to win.
