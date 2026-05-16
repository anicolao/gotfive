import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Deduction Board and Play Again Refinements', async ({ page }, testInfo) => {
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Refinements', 'Verify Deduction Board auto-fill, sync, and Play Again button behavior.');

  // 1. Load the game with deterministic seed
  await page.goto(`/?seed=123&myId=refinement-test-user`);

  // Handle Lobby
  await page.getByLabel('Your Name:').fill('You');
  await page.getByRole('button', { name: 'Join Lobby' }).click();
  await page.getByRole('button', { name: 'Host New Game' }).click();
  await page.getByRole('button', { name: 'Start Hosting' }).click();

  // Add Alice via store to have at least 2 players
  await page.evaluate(() => {
    (window as any).store.dispatch({ 
      type: 'players/addPlayer', 
      payload: { id: 'alice-id', name: 'Alice' } 
    });
  });

  // Start Game
  await page.getByRole('button', { name: 'START GAME' }).click();

  // --- Deduction Board Tests ---

  const canvas = page.locator('.deduction-board canvas');
  const boardCells = page.locator('.deduction-board .cell');
  const guessInputs = page.locator('.deduction-board .guess-inputs input');

  async function clickCell(id: number) {
    const cell = page.locator(`.deduction-board .cell[data-id="${id}"]`);
    const cellBox = await cell.boundingBox();
    const canvasBox = await canvas.boundingBox();
    if (cellBox && canvasBox) {
      await canvas.click({
        position: {
          x: cellBox.x + cellBox.width / 2 - canvasBox.x,
          y: cellBox.y + cellBox.height / 2 - canvasBox.y
        }
      });
    }
  }

  // 2. Test: Marking a tile OK fills the corresponding guess input
  // Tile 1 is Red (color index 0)
  // Toggle Tile 1: ? -> X
  await clickCell(1);
  await expect(page.locator('.deduction-board .cell[data-id="1"] .strike')).toBeVisible();
  
  // Toggle Tile 1: X -> OK
  await clickCell(1);
  await expect(page.locator('.deduction-board .cell[data-id="1"] .check')).toBeVisible();
  
  await tester.step('ok-syncs-to-input', {
    description: 'Marking a tile OK fills the corresponding guess input',
    verifications: [
      {
        spec: 'Guess input 0 is filled with "1"',
        check: async () => {
          await expect(guessInputs.nth(0)).toHaveValue('1');
        }
      }
    ]
  });

  // 3. Test: One OK per color row
  // Tile 6 is also Red (color index 0)
  // Toggle Tile 6: ? -> X -> OK
  await clickCell(6);
  await clickCell(6);
  
  await tester.step('one-ok-per-row-clears-previous', {
    description: 'Marking a second tile OK in the same color row clears the first one',
    verifications: [
      {
        spec: 'Tile 6 is OK',
        check: async () => {
          await expect(page.locator('.deduction-board .cell[data-id="6"] .check')).toBeVisible();
        }
      },
      {
        spec: 'Tile 1 is now clear (neither OK nor X)',
        check: async () => {
          await expect(page.locator('.deduction-board .cell[data-id="1"] .check')).toBeHidden();
          await expect(page.locator('.deduction-board .cell[data-id="1"] .strike')).toBeHidden();
        }
      },
      {
        spec: 'Guess input 0 is updated to "6"',
        check: async () => {
          await expect(guessInputs.nth(0)).toHaveValue('6');
        }
      }
    ]
  });

  // 4. Test: Auto-fill based on remaining tiles
  // For Blue (color index 1), tiles are 2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57
  // Let's mark all but one as X.
  // Actually, some might be in public pool or other players hands (visibleTiles).
  // Let's check which ones are dimmed.
  const blueRowIds = [2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57];
  
  await tester.step('auto-fill-pre-state', {
    description: 'Identify visible tiles in Blue row',
    verifications: []
  });

  for (const id of blueRowIds.slice(0, -1)) {
    const cell = page.locator(`.deduction-board .cell[data-id="${id}"]`);
    const isDimmed = await cell.evaluate(el => el.classList.contains('dimmed'));
    if (!isDimmed) {
      const isX = await cell.locator('.strike').isVisible();
      if (!isX) {
        // Toggle once to make it X
        await clickCell(id);
      }
    }
  }

  // Now only the last one should be possible (or it might have already triggered if only one was possible)
  await tester.step('auto-fill-trigger', {
    description: 'If only one tile is possible, it is automatically marked OK',
    verifications: [
      {
        spec: 'At least one tile in Blue row is OK',
        check: async () => {
          const okCells = page.locator('.deduction-board .row').nth(1).locator('.check');
          await expect(okCells).toHaveCount(1);
        }
      },
      {
        spec: 'Guess input 1 is filled',
        check: async () => {
          await expect(guessInputs.nth(1)).not.toHaveValue('');
        }
      }
    ]
  });

  // --- Play Again Button Tests ---

  // 5. Force a win to show Play Again button
  await page.evaluate(() => {
    const state = (window as any).store.getState();
    const myId = state.ui.myId;
    (window as any).store.dispatch({ type: 'game/setWinner', payload: myId });
  });

  await expect(page.locator('.status-banner.finished')).toBeVisible();
  const playAgainBtn = page.getByRole('button', { name: 'Play Again' });
  await expect(playAgainBtn).toBeVisible();

  await playAgainBtn.click();

  await tester.step('play-again-host', {
    description: 'Clicking Play Again as a host immediately starts a new game',
    verifications: [
      {
        spec: 'Game status is PLAYING (status banner is gone)',
        check: async () => {
          await expect(page.locator('.status-banner.finished')).not.toBeVisible();
        }
      },
      {
        spec: 'Deduction board is reset',
        check: async () => {
          await expect(page.locator('.deduction-board .check')).toHaveCount(0);
          await expect(page.locator('.deduction-board .strike')).toHaveCount(0);
        }
      },
      {
        spec: 'Players have new hands (5 tiles)',
        check: async () => {
           const youStand = page.locator('.stand-container').filter({ hasText: 'You' });
           await expect(youStand.locator('.tile')).toHaveCount(5);
        }
      }
    ]
  });

  // 6. Conclude
  tester.generateDocs();
});
