# Gameplay

As a user, I want to play through a game with deterministic results.

## Game initializes with correct number of tiles

![Game initializes with correct number of tiles](./screenshots/000-initial-state.png)

**Verifications:**
- [x] Player "You" has 5 tiles
- [x] Public pool has 5 initial tiles
- [x] Deck has 35 tiles remaining (60 - 4*5 players - 5 initial public)

---

## Revealing a tile updates the public pool and deck count

![Revealing a tile updates the public pool and deck count](./screenshots/001-reveal-tile.png)

**Verifications:**
- [x] Public pool now has 6 tiles
- [x] Deck has 34 tiles remaining

---

