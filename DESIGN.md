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
    colors: ['Red', 'Blue', 'Yellow', 'Green', 'Purple'];
    totalTiles: 60;
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
    compareNotes: Record<number, CompareNote[]>; // Per-tile-slot notes (index 0-4)
  };
  hasGuessed: boolean;
  isWinner: boolean;
}

interface Tile {
  id: string; // uuid for identity
  number: number; // 1-60
  // color and dots are derived in the UI:
  // color = config.colors[(number - 1) % 5]
  // dots = Math.floor((number - 1) / 5) % 3 + 1
}

interface ClueRequest {
  type: 'SORT' | 'COMPARE';
  requesterId: string;
  targetId: string;
  poolTileId: string;
  slotIndex?: number; // For COMPARE (0-4)
}
```

### 3.2. `ui` Slice (Local only)
- `myId`: string
- `isHost`: boolean
- `deductionLog`: Record<number, 'KNOWN' | 'POSSIBLE' | 'EXCLUDED'>;
- `overlay`: 'RULES' | 'GUESS' | 'NONE';

## 4. Actions & Transitions

### 4.1. Lifecycle Actions
- `room/create`: Initializes host state, generates room ID.
- `room/join`: Dispatched when a peer connects via WebRTC.
- `game/start`: Host shuffles tiles (1-60), assigns 1 of each color to each player, sorts them ascending, and sets initial public pool.

### 4.2. Turn Actions
- `game/drawTile`: Host moves a tile from `supply` to `publicPool`.
- `game/askClue`: Requester sends `ClueRequest`.
- `game/submitClue`: Target provides answer.
  - `SORT`: Target determines which notch (0-5) the tile fits in.
  - `COMPARE`: Target compares dots of `poolTile` and `hand[slotIndex]`.
- `game/endTurn`: Cycles to next `activePlayerId`.

### 4.3. Victory Actions
- `game/shoutGotFive`: Player submits 5 number guesses.
- `game/verifyVictory`: Host checks guesses. If correct, game ends.

## 5. WebRTC Architecture

### 5.1. Signaling & Connection
- **Host-Client Model**: The first player is the Host.
- **Connection**: Clients connect to the Host. The Host maintains a list of all peer connections.
- **Data Channels**: Reliable, ordered data channels for state updates and actions.

### 5.2. State Synchronization
- **Host as Authority**: The Host maintains the "true" Redux state.
- **Action Relay**: Clients dispatch actions locally, which are intercepted by middleware and sent to the Host.
- **State Broadcast**: The Host applies the action and broadcasts the updated state (or a patch) to all Clients.
- **Masking**: The Host masks sensitive data (like a player's own `hand` numbers) before broadcasting the state to that specific player.

## 6. Svelte Component Map

- `App.svelte`: WebRTC provider and main router.
- `Lobby.svelte`: Player list, "Start Game" (Host only), and invite link.
- `GameView.svelte`: The main tabletop.
  - `OpponentRacks.svelte`: Displays other players' tiles (numbers visible).
  - `MyRack.svelte`: Displays own tiles (numbers hidden, only colors visible).
  - `PublicPool.svelte`: The pool of tiles available for clues.
  - `DeductionBoard.svelte`: Interactive 1-60 grid for marking off numbers.
  - `ActionMenu.svelte`: Context-sensitive buttons for Draw/Ask Clue.

## 7. Aesthetic & Mockups

The UI follows a "70s modern" aesthetic: warm tones, rounded plastics, and chunky typography.

### 7.1. Mockup Prompts for AI Generation
To maintain visual consistency, the following prompts should be used for UI inspiration:

1. **Tabletop View**: "A high-angle view of a 70s style deduction board game. Round plastic tiles in avocado green, burnt orange, mustard yellow, and deep purple with large chunky white numbers. Wood-grain tabletop. Curved plastic player stands holding tiles. Soft, warm studio lighting, 1970s aesthetic, minimalist but tactile."
2. **Deduction Grid**: "A UI design for a logic game board. A 10x6 grid of numbers 1 to 60. Each row has a distinct retro color theme: harvest gold, earthy brown, moss green. Dry-erase marker marks (X's and circles) on a slightly textured white background. Retro typography similar to Cooper Black. Clean, flat design with soft shadows."
3. **Game Tiles**: "Close up of several rounded rectangular game tiles. Thick plastic material. One tile is bright orange with a large '17' and two small indented dots below the number. Another tile is olive green with '41' and one dot. Tactile feel, slightly reflective surface, 70s product design."

## 8. Threlte Roadmap
- **Phase 1**: Svelte/CSS 2D implementation with heavy focus on shadows and transitions.
- **Phase 2**: 3D scene setup with Threlte, using basic geometries for tiles.
- **Phase 3**: Custom GLTF models for tiles and stands with realistic materials (plastic, wood).
