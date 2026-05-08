# Mobile Portrait

Verify layout and gameplay on mobile portrait.

## Main play area is visible, board is hidden by default

![Main play area is visible, board is hidden by default](./screenshots/000-mobile-portrait-layout.png)

**Verifications:**
- [x] Main play area is visible
- [x] Sidebar is hidden by default
- [x] Toggle button exists

---

## Deduction board opens when toggled

![Deduction board opens when toggled](./screenshots/001-mobile-portrait-board-open.png)

**Verifications:**
- [x] Sidebar is now visible
- [x] Deduction board title is visible

---

## Game over modal shows on mobile

![Game over modal shows on mobile](./screenshots/002-game-over-mobile.png)

**Verifications:**
- [x] Overlay is visible
- [x] Winner message is correct

---

## Game resets to lobby state without page reload

![Game resets to lobby state without page reload](./screenshots/003-reset-flow.png)

**Verifications:**
- [x] Lobby is visible again
- [x] Game status is LOBBY in store
- [x] Connected players are preserved

---

