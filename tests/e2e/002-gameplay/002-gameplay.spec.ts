import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('User plays the game', async ({ page }, testInfo) => {
  // 1. Initialize with a fixed seed for reproducibility
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Gameplay', 'As a user, I want to play through a game with deterministic results.');

  // 2. Load the game
  await page.goto('/?seed=42');

  // Handle Lobby
  await page.getByLabel('Your Name:').fill('You');
  await page.getByRole('button', { name: 'Host Game' }).click();

  // Add Alice via store
  await page.evaluate(() => {
    (window as any).store.dispatch({ 
      type: 'players/addPlayer', 
      payload: { id: 'alice-id', name: 'Alice' } 
    });
  });

  // Start Game
  await page.getByRole('button', { name: 'START GAME' }).click();
  
  await tester.step('initial-state', {
    description: 'Game initializes with correct number of tiles',
    verifications: [
      { 
        spec: 'Player "You" has 5 tiles', 
        check: async () => {
          const youStand = page.locator('.stand-container').filter({ hasText: 'You' });
          await expect(youStand.locator('.tile')).toHaveCount(5);
        }
      },
      { 
        spec: 'Public pool has 5 initial tiles', 
        check: async () => {
          await expect(page.locator('.pool-tiles .tile')).toHaveCount(5);
        }
      },
      {
        spec: 'Each of the 5 colored decks has 9 tiles remaining',
        check: async () => {
          const deckCounts = page.locator('.deck-count');
          await expect(deckCounts).toHaveCount(5);
          for (let i = 0; i < 5; i++) {
            await expect(deckCounts.nth(i)).toHaveText('9');
          }
        }
      }
    ]
  });

  // 3. Reveal a tile from the red deck
  await page.locator('.deck-btn.red').click();

  await tester.step('reveal-tile', {
    description: 'Revealing a tile updates the public pool and deck count',
    verifications: [
      { 
        spec: 'Public pool now has 6 tiles', 
        check: async () => {
          await expect(page.locator('.pool-tiles .tile')).toHaveCount(6);
        }
      },
      {
        spec: 'Red deck has 8 tiles remaining',
        check: async () => {
          await expect(page.locator('.deck-btn.red .deck-count')).toHaveText('8');
        }
      }
    ]
  });

  // 4. Ask for a clue
  const firstPublicTile = page.locator('.pool-tiles .tile-btn').first();
  const firstPublicTileId = await firstPublicTile.locator('.number').innerText();
  await firstPublicTile.click();
  
  const aliceStand = page.locator('.stand-container').filter({ hasText: 'Alice' });
  await aliceStand.locator('.name-tag').click();

  await tester.step('ask-clue', {
    description: 'Asking for a clue records it on the stand and consumes the tile',
    verifications: [
      {
        spec: 'Alice stand has one active sorting notch',
        check: async () => {
          await expect(aliceStand.locator('.notch.active')).toHaveCount(1);
        }
      },
      {
        spec: 'The active notch contains a MiniTile representation of the consumed tile',
        check: async () => {
          const notch = aliceStand.locator('.notch.active');
          await expect(notch.locator('.mini-tile')).toBeVisible();
          await expect(notch.locator('.mini-tile .number')).toHaveText(firstPublicTileId);
        }
      },
      {
        spec: 'The consumed tile is removed from the public pool',
        check: async () => {
          await expect(page.locator(`.pool-tiles .tile-btn:has-text("${firstPublicTileId}")`)).toHaveCount(0);
          await expect(page.locator('.pool-tiles .tile-btn')).toHaveCount(5); // Was 6, now 5
        }
      },
      {
        spec: 'Public tile is deselected after action',
        check: async () => {
          await expect(page.locator('.tile-btn.selected')).toHaveCount(0);
        }
      }
    ]
  });

  // Advance turn back to 'You' to allow another action
  await page.evaluate(() => {
    (window as any).store.dispatch({ type: 'game/nextTurn' });
  });

  // 5. Ask for a compare clue
  const secondPublicTile = page.locator('.pool-tiles .tile-btn').nth(1);
  const secondPublicTileId = await secondPublicTile.locator('.number').innerText();
  await secondPublicTile.click();
  
  // Click on Alice's first slot
  const aliceFirstSlot = aliceStand.locator('.slot').first();
  await aliceFirstSlot.evaluate(el => (el as HTMLElement).click());

  await tester.step('ask-compare-clue', {
    description: 'Asking for a dot clue records it above the slot and consumes the tile',
    verifications: [
      {
        spec: 'Alice stand has a compare clue above the first slot',
        check: async () => {
          const indicator = aliceFirstSlot.locator('.compare-indicators .compare-clue');
          await expect(indicator).toBeVisible();
          await expect(indicator.locator('.mini-tile')).toBeVisible();
          await expect(indicator.locator('.mini-tile .number')).toHaveText(secondPublicTileId);
        }
      },
      {
        spec: 'The consumed tile is removed from the public pool',
        check: async () => {
          await expect(page.locator(`.pool-tiles .tile-btn:has-text("${secondPublicTileId}")`)).toHaveCount(0);
          await expect(page.locator('.pool-tiles .tile-btn')).toHaveCount(4);
        }
      }
    ]
  });

  // 6. Use deduction board
  const canvas = page.locator('.deduction-board canvas');
  const boardCell = page.locator('.deduction-board .cell').first();
  
  const cellBox = await boardCell.boundingBox();
  const canvasBox = await canvas.boundingBox();
  
  if (cellBox && canvasBox) {
    await canvas.click({
      position: {
        x: cellBox.x + cellBox.width / 2 - canvasBox.x,
        y: cellBox.y + cellBox.height / 2 - canvasBox.y
      }
    });
  }
  
  await tester.step('deduction-board', {
    description: 'Deduction board cells show dots and automated marking',
    verifications: [
      {
        spec: 'Cells show dot counts',
        check: async () => {
          await expect(boardCell.locator('.dots .dot')).toHaveCount(1); // Tile 1 has 1 dot
        }
      },
      {
        spec: 'First cell shows a strike (X)',
        check: async () => {
          await expect(boardCell.locator('.strike')).toBeVisible();
        }
      },
      {
        spec: 'Public tiles are dimmed on the deduction board',
        check: async () => {
          // Find a tile that is still in the pool
          const publicTileId = await page.locator('.pool-tiles .number').first().innerText();
          const boardTile = page.locator(`.deduction-board .cell[data-id="${publicTileId}"]`);
          await expect(boardTile).toHaveClass(/dimmed/);
        }
      }
    ]
  });

  // 6. Guessing flow
  const deductionBoard = page.locator('.deduction-board');
  const guessInputs = deductionBoard.locator('.guess-inputs input');
  
  // Fill some guesses
  await guessInputs.nth(0).fill('1');
  await guessInputs.nth(1).fill('2');
  await guessInputs.nth(2).fill('3');
  await guessInputs.nth(3).fill('4');
  await guessInputs.nth(4).fill('5');
  
  await deductionBoard.locator('.got-five-btn').click();
  
  await tester.step('guessing-flow', {
    description: 'Guessing flow processes the guess from the deduction board',
    verifications: [
      {
        spec: 'End game modal is shown (Eliminated or Winner)',
        check: async () => {
          await expect(page.locator('.overlay .end-game-modal')).toBeVisible();
        }
      }
    ]
  });

  // 7. Conclude
  tester.generateDocs();
});
