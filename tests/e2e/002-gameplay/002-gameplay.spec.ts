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
  await firstPublicTile.click();
  
  const aliceStand = page.locator('.stand-container').filter({ hasText: 'Alice' });
  await aliceStand.click();

  await tester.step('ask-clue', {
    description: 'Asking for a clue records it on the stand',
    verifications: [
      {
        spec: 'Alice stand has one active sorting notch',
        check: async () => {
          await expect(aliceStand.locator('.notch.active')).toHaveCount(1);
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

  // 5. Use deduction board
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
    description: 'Deduction board cells can be toggled and show automated marking',
    verifications: [
      {
        spec: 'First cell shows a strike (X)',
        check: async () => {
          await expect(boardCell.locator('.strike')).toBeVisible();
        }
      },
      {
        spec: 'Public tiles are dimmed on the deduction board',
        check: async () => {
          const publicTileId = await page.locator('.pool-tiles .number').first().innerText();
          const boardTile = page.locator(`.deduction-board .cell[data-id="${publicTileId}"]`);
          await expect(boardTile).toHaveClass(/dimmed/);
        }
      }
    ]
  });

  // 6. Guessing flow
  await page.locator('.got-five-btn').click();
  await expect(page.locator('.overlay .guess-modal')).toBeVisible();
  
  // Fill some guesses (just for testing the flow)
  const inputs = page.locator('.guess-inputs input');
  await inputs.nth(0).fill('1');
  await inputs.nth(1).fill('2');
  await inputs.nth(2).fill('3');
  await inputs.nth(3).fill('4');
  await inputs.nth(4).fill('5');
  
  await page.locator('.modal-actions .primary').click();
  
  await tester.step('guessing-flow', {
    description: 'Guessing flow shows the modal and processes the guess',
    verifications: [
      {
        spec: 'Guess modal is closed after submission',
        check: async () => {
          await expect(page.locator('.overlay')).toHaveCount(0);
        }
      }
    ]
  });

  // 7. Conclude
  tester.generateDocs();
});
