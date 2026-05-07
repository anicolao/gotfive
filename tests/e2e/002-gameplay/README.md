# Gameplay

As a user, I want to play through a game with deterministic results.

## Game initializes with correct number of tiles

![Game initializes with correct number of tiles](./screenshots/000-initial-state.png)

**Verifications:**
- [x] Player "You" has 5 tiles
- [x] Public pool has 5 initial tiles
- [x] Each of the 5 colored decks has 7 tiles remaining

---

## Revealing a tile updates the public pool and deck count

![Revealing a tile updates the public pool and deck count](./screenshots/001-reveal-tile.png)

**Verifications:**
- [x] Public pool now has 6 tiles
- [x] Red deck has 6 tiles remaining

---

## Asking for a clue records it on the stand

![Asking for a clue records it on the stand](./screenshots/002-ask-clue.png)

**Verifications:**
- [x] Alice stand has one active sorting notch
- [x] Public tile is deselected after action

---

## Deduction board cells can be toggled

![Deduction board cells can be toggled](./screenshots/003-deduction-board.png)

**Verifications:**
- [x] First cell shows a strike (X)

---

