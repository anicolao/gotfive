# Got Five! - UI Overhaul Design

## 1. Vision and Aesthetics
The goal is to modernize the UI of "Got Five!" for an optimal mobile experience, capturing a vibrant, tactile, and responsive aesthetic. We want to bring the physical game to life on the screen.
- **Color Palette:** Bright, distinct tile colors (Green, Purple, Orange, Blue, Pink) set against a warm, dark background (like a stylish felt table or sleek dark mode) to make the colors pop.
- **Shapes & Typography:** Soft rounded corners (border-radius: 12px to 16px), thick borders, and subtle drop shadows to give a physical, tactile tile feel. Clean, readable sans-serif typography with playful, bold numbers.
- **Character Design:** "Sassy" tiles with expressive faces to add personality without cluttering the gameplay area.
- **Animations:** Bouncy, responsive transitions for drawing, sorting, and flipping tiles.

## 2. Mobile Layout Strategy

### Portrait Mode (Mobile First)
The portrait layout stacks the game zones vertically to maximize vertical space.
1. **Top Zone (Opponents):** Opponents' stands are rendered at the top, slightly scaled down. For a 4-player game, 3 opponents fit horizontally, showing their sorted tiles clearly. 
2. **Center Zone (The Supply & Actions):** A centralized pool showing the 6 face-up tiles. Prominent action buttons: **[REVEAL A TILE]** and **[ASK FOR A CLUE]** sit just below the supply.
3. **Bottom-Mid Zone (My Stand):** The player's 5 hidden tiles (showing `?`) are prominently displayed, with clear "notches" between them for sorting clues and a dedicated space for comparison clues.
4. **Bottom Dock (Deduction Board):** A slide-up "bottom sheet" or persistent toggleable dock for the Deduction Board to allow players to make notes without losing context of the main game.

### Landscape Mode
1. **Left Panel (Game State):** Opponents' stands at the top left, My Stand at the bottom left. Center-left holds the supply and action buttons.
2. **Right Panel (Deduction Board):** The 60-tile deduction grid remains persistently open on the right side of the screen, taking advantage of the wider aspect ratio.

## 3. Core UI Components

### 3.1 The Stand
- **Visuals:** A stylish rack with 5 indented slots.
- **Tiles:** Tiles sit in the slots. The player's tiles show a textured back or `?`. Opponents' tiles show their numbers and dots.
- **Clue Notches:** Below or between the slots are 6 sorting notches. Compared tiles are stacked directly above or below the stand aligned with the referenced tile.

### 3.2 The Deduction Board
- **Layout:** A dense, interactive grid representing the 60 tiles (divided by 5 colors).
- **Interactions:**
  - **Tap once:** Cross out (eliminated).
  - **Tap twice:** Circle/Star (potential/confirmed).
  - **Tap three times:** Reset.
- **Filtering:** Quick filter toggles for colors or dot counts to make it easy to manage on small screens.

### 3.3 Tiles
- **Design:** Each tile needs to clearly display:
  1. Background Color.
  2. Large Number (1-60).
  3. Dots (1, 2, or 3).
  4. Sassy face (integrated into the number or as a watermark).

## 4. Engineering Plan
- **Framework:** SvelteKit utilizing CSS Grid and Flexbox for responsive layouts.
- **Orientation:** Utilize `@media (orientation: landscape)` queries for seamless shifting between portrait and landscape modes.
- **Components:** Modularize the `Stand`, `Tile`, and `DeductionBoard` components to reuse them across different views.