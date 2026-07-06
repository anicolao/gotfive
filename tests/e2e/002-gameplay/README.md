# Gameplay

As a user, I want to play through a game with deterministic results.

## Game initializes with correct number of tiles

![Game initializes with correct number of tiles](./screenshots/000-initial-state.png)

**Verifications:**
- [x] Player "You" has 5 tiles
- [x] Public pool has 5 initial tiles
- [x] Each of the 5 colored decks has 9 tiles remaining

---

## Revealing a tile updates the public pool and deck count

![Revealing a tile updates the public pool and deck count](./screenshots/001-reveal-tile.png)

**Verifications:**
- [x] Public pool now has 6 tiles
- [x] Red deck has 8 tiles remaining

---

## Asking for a clue records it on the stand and consumes the tile

![Asking for a clue records it on the stand and consumes the tile](./screenshots/002-ask-clue.png)

**Verifications:**
- [x] Alice stand has one active sorting notch
- [x] The active notch contains a MiniTile representation of the consumed tile
- [x] The consumed tile is removed from the public pool
- [x] Public tile is deselected after action

---

## Asking for a dot clue records it above the slot and consumes the tile

![Asking for a dot clue records it above the slot and consumes the tile](./screenshots/003-ask-compare-clue.png)

**Verifications:**
- [x] Alice stand has a compare clue above the first slot
- [x] The consumed tile is removed from the public pool

---

## Deduction board cells show dots and automated marking

![Deduction board cells show dots and automated marking](./screenshots/004-deduction-board.png)

**Verifications:**
- [x] Cells show dot counts
- [x] First cell shows a strike (X)
- [x] Public tiles are dimmed on the deduction board

---

## Guessing flow processes the guess from the deduction board

![Guessing flow processes the guess from the deduction board](./screenshots/005-guessing-flow.png)

**Verifications:**
- [x] End game status is shown (Eliminated or Winner)

---

