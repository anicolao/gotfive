# COMPLETE_MVP_IMPLEMENTATION_PLAN

This plan outlines the logical order for completing the Got Five! MVP.

## Phase 1: Core Logic & Foundation Refinement
*Goal: Ensure the underlying game mechanics are robust and properly synchronized.*

1.  **Refine Turn State Machine**:
    *   Update `gameSlice.ts` to include a `turnPhase` state: `REVEALING`, `ASKING_CLUE`, `DEDUCTING`.
    *   Implement logic to enforce turn order and phase transitions.
2.  **Seed-based Determinism**:
    *   Ensure the `start` action correctly uses the `seed` for all initial shuffles and deals, making the game perfectly reproducible for all peers.
3.  **Action Indexing**:
    *   Add an `index` to all game actions to support the "Host-Peer" sequencing model defined in `DESIGN.md`.

## Phase 2: Single-Player Local Loop (Mechanics)
*Goal: Make the game fully playable in a local/debug mode.*

1.  **Deduction Board Implementation**:
    *   Create `DeductionBoard.svelte`: A 6x10 grid for numbers 1-60.
    *   Support marking numbers with '?' (maybe), 'X' (eliminated), and 'OK' (confirmed).
    *   Ensure the state is persisted in `uiSlice` (local only).
2.  **Clue Interaction (SORT & COMPARE)**:
    *   **UI Interaction**: Allow a player to select a tile from the `Table`'s public pool and "drag" or "click" it onto a target `PlayerStand`.
    *   **SORT Logic**: Implement the visual placement of the public tile into one of the 6 notches on the player's stand.
    *   **COMPARE Logic**: Implement the dot-comparison check against a specific hidden tile slot.
    *   **State Updates**: Dispatch `game/clue_sort` and `game/clue_compare` actions.
3.  **Guessing (GOT FIVE!)**:
    *   Implement `GuessOverlay.svelte`: A high-impact 70s-style modal for entering the final 5-number guess.
    *   Implement validation logic and the "Winner/Loser" end-state transitions.

## Phase 3: Visual Identity & UX (70s Groovy Polish)
*Goal: Realize the "Retro 70s Groovy" aesthetic.*

1.  **Aesthetic Refinement**:
    *   Consolidate global styles and apply the 70s color palette (`avocado`, `harvest gold`, `burnt orange`, `wood`).
    *   Implement "Plastic & Paper" textures for components.
    *   Use retro-styled typography.
2.  **Sassy Tile Polish**:
    *   Refine the SVG/CSS sassy faces on the tile backs.
    *   Add "Material" feel: bevels, drop shadows, and subtle reflections.
3.  **Animations**:
    *   Add Svelte transitions for tile movement, revealing, and modal overlays to give the game a "juicy" analog feel.

## Phase 4: Multiplayer (WebRTC Orchestration)
*Goal: Enable P2P multiplayer as per the design.*

1.  **Connectivity Layer**:
    *   Integrate a WebRTC library (e.g., PeerJS or raw `RTCPeerConnection`).
    *   Implement signaling via a simple URL-based approach (Host shares a link with their Peer ID).
2.  **Host Authority Implementation**:
    *   Implement the `INTENT` -> `HOST` -> `BROADCAST` flow.
    *   Ensure peers only apply actions once confirmed by the Host.
3.  **Lobby & Matchmaking**:
    *   Create a landing page for room creation and joining.
    *   Implement the `LOBBY` state where players wait for the Host to start.

## Phase 5: Final Verification & PWA
*Goal: Production readiness.*

1.  **E2E Test Coverage**:
    *   Add scenarios for multiplayer handshake, full turn loop, and winning conditions.
2.  **PWA Features**:
    *   Finalize manifest and service worker configuration for offline access and "Install" prompts.
3.  **Performance & Cleanup**:
    *   Optimize asset loading and ensure zero-pixel tolerance in visual tests.
