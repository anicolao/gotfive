# Got Five! Detailed Design Document

## 1. Overview and Architecture
Got Five! is a digital adaptation of the deduction board game. The application will be a Progressive Web App (PWA) built with SvelteKit.
- **Frontend Framework**: SvelteKit (Static Site Generation).
- **State Management**: Redux Toolkit for predictable state containers.
- **Networking**: WebRTC for Peer-to-Peer (P2P) communication without a central game server.
- **Styling**: Plain Svelte-scoped CSS. No React, no Tailwind.

## 2. Game Rules & Mechanics Review
Based on the project's rules and human feedback, the following mechanical invariants exist:
- **Components**: 60 tiles total (5 colors: Red, Blue, Yellow, Green, Purple), numbered 1-60.
- **Host Responsibilities**: The host creates the room, acts as the WebRTC signaling coordinator (via link sharing), and generates the initial random seed/shuffled deck.
- **Information Transparency**: To ensure immediate responsiveness, the **entire shuffled deck and all players' hands are sent to all clients** at the start of the game. 
- **Information Hiding**: The UI on each client is strictly responsible for hiding opponent information from the player. While the data exists in memory (accessible via JS console), it is not rendered until a "reveal" action occurs.

## 3. State Management (Redux)
The Redux state must be deterministic. All clients maintain identical state, updated by a synchronized sequence of actions.

### 3.1. Data Structures
```typescript
interface RootState {
  game: GameState;
  players: Record<string, PlayerState>;
  ui: UIState; // Local only
}

interface GameState {
  roomId: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  deck: number[]; // The complete shuffled deck (array of tile IDs 1-60)
  revealIndex: number; // Current index in the deck for the next reveal
  publicPool: number[]; // Tile IDs currently face up
  turnOrder: string[]; // Array of player IDs
  currentTurnIndex: number;
}

interface PlayerState {
  id: string;
  name: string;
  hand: number[]; // Array of 5 tile IDs, sorted ascending
  cluesReceived: Clue[];
}

type Clue = SortClue | CompareClue;

interface SortClue {
  type: 'SORT';
  tileId: number;
  notchIndex: number; // 0-5
}

interface CompareClue {
  type: 'COMPARE';
  tileId: number;
  slotIndex: number; // 0-4
  match: boolean;
}
```

### 3.2. Actions
- `START_GAME`: Payload includes the pre-shuffled `deck` and `turnOrder`.
- `REVEAL_NEXT`: No payload needed. Increments `revealIndex` and moves the tile from `deck[revealIndex]` to `publicPool`.
- `GIVE_SORT_CLUE`: `{ targetPlayerId, tileId, notchIndex }`
- `GIVE_COMPARE_CLUE`: `{ targetPlayerId, tileId, slotIndex, match }`
- `MAKE_GUESS`: `{ playerId, guessArray }`

## 4. WebRTC Communication
Communication relies on a Host-Peer Mesh topology.
1. **Connection**: Host creates an offer. Peers join via a shared link containing connection parameters (or via a lightweight signaling server like a public STUN/TURN).
2. **Sync**: Once connected, the host broadcasts `START_GAME` with the fully initialized state (the shuffled deck).
3. **Action Broadcasting**: When a player takes an action (e.g., asking for a clue), their client broadcasts the action to all other peers.
4. **Resolution**: Because all clients have the full state, action resolution is immediate locally, and peers update their state upon receiving the action broadcast.

## 5. UI Implementation (Svelte)
- **App Structure**:
  - `/`: Landing page, create/join room.
  - `/room/[id]`: The game instance.
- **Components**:
  - `Table.svelte`: Displays the `publicPool` of revealed tiles.
  - `PlayerStand.svelte`: Displays the player's 5 hidden tiles (backs facing player) and received clues.
  - `OpponentStand.svelte`: Displays opponent's tiles (fronts facing player, but numbers hidden by UI until game over) and their clues.
  - `DeductionBoard.svelte`: A grid for the player to mark off eliminated numbers (local state only).
- **Styling**: Scoped CSS using standard CSS variables for a cohesive "Retro 70s" theme.

## 6. Visual Design Mockups
The UI relies on a 70s retro aesthetic ("Got Five!"). 

- **Mockup 1: Game Tiles (SVG Inspiration)**
  - *Description*: Tiles are thick, rounded plastic rectangles in Avocado Green, Harvest Gold, etc. Each tile has a sassy, expressive face (winking, smirking) alongside its number.
  - *Current iteration*: See `mockups/game_tiles.svg` for the base structure.
- **Mockup 2: The Table Layout**
  - *Description*: A warm wood-grain background. The active player's stand is at the bottom, showing the backs of their 5 tiles. Opponents are at the top/sides, showing the fronts of their tiles (numbers obscured). The center holds the public, revealed tiles.
- **Mockup 3: Deduction Log**
  - *Description*: Styled like a retro manila folder or a worn spiral notebook, allowing players to click numbers 1-60 to cycle between neutral, 'X' (eliminated), and 'O' (confirmed).
