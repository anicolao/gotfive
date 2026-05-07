# COMPLETE MVP IMPLEMENTATION PLAN

This document outlines the logical order for completing the Got Five! MVP, incorporating Phase I, II, and III requirements with a focus on the deduction board, core game loop, and P2P multiplayer.

## Phase I: Core Game & Local Deduction (✅ COMPLETED)
**Goal:** A fully playable local version of the game where one player can interact with mock opponents and use the deduction board.

- [x] **Deduction Board (The "Top Secret" Log)**
    - [x] Implement `DeductionBoard.svelte`.
    - [x] **Grid Layout**: 5 rows (one per color) x 12 columns (numbers 1-60 distributed by color).
    - [x] **Aesthetic**: Grid cells should look like small "Sassy Tiles" (rounded corners, plastic texture, color-coded).
    - [x] **Writing Layer**: SVG or Canvas overlay to allow freehand drawing/marking with mouse or stylus. Persisted locally.
    - [x] **Automated Marking**: Logic to automatically dim or mark tiles that are visible on the table or in opponent stands.
    - [x] **Structured Marks**: ('X', 'OK', '?') available per cell.
- [x] **Advanced Game State**
    - [x] **Turn Management**: Track `currentPlayerIndex` and enforce the "Reveal -> Clue" turn sequence.
    - [x] **Clue Actions**: `clue_sort` and `clue_compare`.
    - [x] **Guessing**: `guess` action with Win/Loss state handling.
- [x] **Enhanced Components**
    - [x] **OpponentStand**: Displays tile backs (sassy faces) and a visual log of clues received by that opponent.
    - [x] **Clue Interaction UI**: A way for the current player to select a revealed tile and a target (opponent or self) to "Ask for a Clue".
    - [x] **Notch Visualization**: Visually show where "SORT" tiles were placed.

## Phase II: P2P Multiplayer (✅ COMPLETED)
**Goal:** Connect multiple players via WebRTC to play the same game.

- [x] **Connectivity & Signaling**
    - [x] Implement WebRTC Host-Peer mesh using `simple-peer`.
    - [x] Basic signaling (Copy/Paste of SDP).
    - [x] Room management (Create/Join via Lobby).
- [x] **State Synchronization**
    - [x] Implement the "Thin Protocol": Host broadcasts actions with indices; peers apply locally.
    - [x] Handle late joiners or reconnections (Host sends full current state).
- [x] **Multiplayer UI**
    - [x] Lobby screen with player list and "Ready" buttons.

## Phase III: Critical Bug Fixes & Network Reliability (✅ COMPLETED)
**Goal:** Ensure the P2P multiplayer protocol perfectly synchronizes game state across all peers before adding final polish.

- [x] **Network State Fixes**
    - [x] Add `players/setHand` to the `syncableActions` list in `networkMiddleware` so that the Host correctly broadcasts all players' initial hands at the start of the game. Without this, peers cannot compute `clue_sort` or `clue_compare` correctly.
- [x] **Game Flow Resilience**
    - [x] Ensure that a game can be gracefully restarted and that peer connections persist or reset cleanly.

## Phase IV: Polish & PWA (⏳ PENDING)
**Goal:** Finalize the "Retro 70s Groovy" look and ensure it works offline.

- [ ] **Visual Polish**
    - [ ] Refine CSS variables and styles for consistent 70s aesthetic.
    - [ ] Add animations for tile movements, drawing from the public pool, and clue placement.
- [ ] **PWA Features**
    - [ ] Service worker for offline asset caching (using `vite-plugin-pwa`).
    - [ ] Web App Manifest for "Add to Home Screen".
- [ ] **Final QA & E2E Testing**
    - [ ] Full scenario testing for gameplay from start to win.
    - [ ] Visual regression tests for UI consistency.
