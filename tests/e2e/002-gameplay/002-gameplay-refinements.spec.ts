import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Deduction Board and Play Again Refinements', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Refinements', 'Verify Deduction Board auto-fill, sync, and Play Again button behavior.');

  // 1. Load the game with deterministic seed
  await page.goto(`/?seed=123&myId=refinement-test-user&lobbyId=lobby-002-ref`);

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
	  await expect(page.locator('.stand-container').filter({ hasText: 'You' }).locator('.tile')).toHaveCount(5);
	  await expect(page.locator('.deduction-board .cell.dimmed')).toHaveCount(10);

  async function visibleTileIdsForCurrentStart() {
    return page.evaluate(() => {
      const state = (window as any).store.getState();
      const myId = state.ui.myId;
      const visibleIds = new Set<number>(state.game.publicPool);
      Object.values(state.players.players).forEach((player: any) => {
        if (player.id !== myId) {
          player.hand.forEach((id: number) => visibleIds.add(id));
        }
      });
      return [...visibleIds].sort((a, b) => a - b);
    });
  }

  async function expectVisibleTilesDimmed(ids: number[]) {
    for (const id of ids) {
      await expect(page.locator(`.deduction-board .cell[data-id="${id}"]`)).toHaveClass(/dimmed/);
    }
  }

  const initialVisibleIds = await visibleTileIdsForCurrentStart();
  await expectVisibleTilesDimmed(initialVisibleIds);

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

  // Dynamically determine the colors in the player's hand
  const handTiles = await page.evaluate(() => {
    const state = (window as any).store.getState();
    const myId = state.ui.myId;
    const hand = state.players.players[myId].hand;
    return hand.map((id: number) => {
      const colorIdx = (id - 1) % 5;
      return { id, colorIdx };
    });
  });

  const firstSlotColorIdx = handTiles[0].colorIdx;
  const secondSlotColorIdx = handTiles[1].colorIdx;

  const tile1 = firstSlotColorIdx + 1;
  const tile2 = firstSlotColorIdx + 1 + 5; // next tile in same color

  // 2. Test: Marking a tile OK fills the corresponding guess input
  // Toggle tile1: ? -> X
  await clickCell(tile1);
  await expect(page.locator(`.deduction-board .cell[data-id="${tile1}"] .strike`)).toBeVisible();
  
  // Toggle tile1: X -> OK
  await clickCell(tile1);
  await expect(page.locator(`.deduction-board .cell[data-id="${tile1}"] .check`)).toBeVisible();
  
  await tester.step('ok-syncs-to-input', {
    description: 'Marking a tile OK fills the corresponding guess input based on rack position',
    verifications: [
      {
        spec: `Guess input 0 is filled with "${tile1}"`,
        check: async () => {
          await expect(guessInputs.nth(0)).toHaveValue(tile1.toString());
        }
      }
    ]
  });

  // 3. Test: One OK per color row
  // Toggle tile2: ? -> X -> OK
  await clickCell(tile2);
  await clickCell(tile2);
  
  await tester.step('one-ok-per-row-clears-previous', {
    description: 'Marking a second tile OK in the same color row clears the first one',
    verifications: [
      {
        spec: `Tile ${tile2} is OK`,
        check: async () => {
          await expect(page.locator(`.deduction-board .cell[data-id="${tile2}"] .check`)).toBeVisible();
        }
      },
      {
        spec: `Tile ${tile1} is now clear (neither OK nor X)`,
        check: async () => {
          await expect(page.locator(`.deduction-board .cell[data-id="${tile1}"] .check`)).toBeHidden();
          await expect(page.locator(`.deduction-board .cell[data-id="${tile1}"] .strike`)).toBeHidden();
        }
      },
      {
        spec: `Guess input 0 is updated to "${tile2}"`,
        check: async () => {
          await expect(guessInputs.nth(0)).toHaveValue(tile2.toString());
        }
      }
    ]
  });

  // 4. Test: Auto-fill based on remaining tiles
  const secondColorRowIds = [];
  for (let i = 0; i < 12; i++) {
    secondColorRowIds.push(secondSlotColorIdx + 1 + i * 5);
  }
  
  await tester.step('auto-fill-pre-state', {
    description: 'Identify visible tiles in the second slot color row',
    verifications: []
  });

  for (const id of secondColorRowIds.slice(0, -1)) {
    const cell = page.locator(`.deduction-board .cell[data-id="${id}"]`);
    const isDimmed = await cell.evaluate(el => el.classList.contains('dimmed'));
    if (!isDimmed) {
      const isX = await cell.locator('.strike').isVisible();
      const isOk = await cell.locator('.check').isVisible();
      if (!isX && !isOk) {
        // Toggle once to make it X
        await clickCell(id);
      } else if (isOk) {
        // Toggle twice to clear and then X
        await clickCell(id);
        await clickCell(id);
      }
    }
  }

  // Now only the last one should be possible (or it might have already triggered if only one was possible)
  await tester.step('auto-fill-trigger', {
    description: 'If only one tile is possible, it is automatically marked OK',
    verifications: [
      {
        spec: 'At least one tile in the second slot color row is OK',
        check: async () => {
          const okCells = page.locator('.deduction-board .row').nth(secondSlotColorIdx).locator('.check');
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

  const canvasBox = await canvas.boundingBox();
  if (canvasBox) {
    await page.mouse.move(canvasBox.x + 12, canvasBox.y + 12);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 40, canvasBox.y + 40);
    await page.mouse.up();
  }
  await expect.poll(async () => page.evaluate(() => (window as any).store.getState().ui.strokes.length)).toBeGreaterThan(0);
  await guessInputs.nth(4).fill('42');
  await expect(guessInputs.nth(4)).toHaveValue('42');

  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator('.deduction-board')).toBeVisible();
  await expect(page.locator(`.deduction-board .cell[data-id="${tile2}"] .check`)).toBeVisible();
  await expect(page.locator(`.deduction-board .cell[data-id="${tile1}"] .check`)).toBeHidden();
  await expect(page.locator(`.deduction-board .cell[data-id="${tile1}"] .strike`)).toBeHidden();
  await expect(guessInputs.nth(4)).toHaveValue('42');
  await expect.poll(async () => page.evaluate(() => (window as any).store.getState().ui.strokes.length)).toBeGreaterThan(0);

  // --- Play Again Button Tests ---

  // 5. Record a clue, then force a win to show Play Again button
  await page.evaluate(() => {
    const state = (window as any).store.getState();
    const clueTileId = state.game.publicPool[0];
    (window as any).store.dispatch({
      type: 'players/clue_sort',
      payload: { targetId: 'alice-id', tileId: clueTileId }
    });
  });
  const aliceStand = page.locator('.stand-container').filter({ hasText: 'Alice' });
  await expect(aliceStand.locator('.notch.active')).toHaveCount(1);

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
        spec: 'Old clue markers are cleared',
        check: async () => {
          await expect(aliceStand.locator('.notch.active')).toHaveCount(0);
          await expect(aliceStand.locator('.compare-clue')).toHaveCount(0);
        }
      },
      {
        spec: 'New start visible tiles are dimmed immediately',
        check: async () => {
          await expect(aliceStand.locator('.tile')).toHaveCount(5);
          const visibleIds = await visibleTileIdsForCurrentStart();
          await expect(page.locator('.deduction-board .cell.dimmed')).toHaveCount(visibleIds.length);
          await expectVisibleTilesDimmed(visibleIds);
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
