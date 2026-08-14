import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

async function writeRemoteGameEvent(page: Page, type: string, payload?: unknown) {
  await page.evaluate(async (args: { type: string; payload?: unknown }) => {
    const { writeGameEvent } = await (0, eval)('import("/src/lib/firebase/events.ts")');
    const gameId = (window as any).store.getState().ui.gameId;
    await writeGameEvent(gameId, args.type, args.payload);
  }, { type, payload });
}

test('User plays the game', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  // 1. Initialize with a fixed seed for reproducibility
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Gameplay', 'As a user, I want to play through a game with deterministic results.');

  // 2. Load the game
  await page.goto(`/?seed=123&myId=gameplay-test-user&lobbyId=lobby-002`);

  // Handle Lobby
  await page.getByLabel('Your Name:').fill('You');
  await page.getByRole('button', { name: 'Join Lobby' }).click();
  await page.getByRole('button', { name: 'Host New Game' }).click();
  await page.getByRole('button', { name: 'Start Hosting' }).click();

  // Add Alice via store
  await page.evaluate(() => {
    (window as any).store.dispatch({ 
      type: 'players/addPlayer', 
      payload: { id: 'alice-id', name: 'Alice' } 
    });
  });

  // Start Game
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('.deduction-board .got-five-btn')).toBeDisabled();
  
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
          const deckCounts = page.locator('.deck-btn');
          await expect(deckCounts).toHaveCount(5);
          for (let i = 0; i < 5; i++) {
            await expect(deckCounts.nth(i)).toHaveAttribute('data-pile-count', '9');
          }
        }
      }
    ]
  });

  // 3. Reveal a tile from the red deck
  await page.locator('.deck-btn.red').click();
  await expect(page.locator('.deck-btn.red')).toBeDisabled();

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
          await expect(page.locator('.deck-btn.red')).toHaveAttribute('data-pile-count', '8');
        }
      },
      {
        spec: 'The revealed physical tile moves continuously from its deck into the public line',
        check: async () => {
          await expect(page.locator('.unified-tile-scene')).toHaveAttribute(
            'data-last-tile-motion',
            /tile-\d+:Red draw deck>3D public tile pool/
          );
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
        spec: 'Alice stand has one occupied sorting lane',
        check: async () => {
          await expect(aliceStand.locator('.sort-clues')).toHaveCount(1);
        }
      },
      {
        spec: 'The sorting lane contains the consumed tile',
        check: async () => {
          const notch = aliceStand.locator('.notch:has(.sort-clues)');
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
          await expect(page.locator('.tile-btn[aria-pressed="true"]')).toHaveCount(0);
        }
      },
      {
        spec: 'The consumed physical tile flies and shrinks from the public line into its sort clue',
        check: async () => {
          await expect(page.locator('.unified-tile-scene')).toHaveAttribute(
            'data-last-tile-motion',
            /tile-\d+:3D public tile pool>Alice's sort clue/
          );
        }
      }
    ]
  });

  // Advance turn back to 'You' to allow another action
  await expect(aliceStand).toHaveClass(/current-turn/);
  await writeRemoteGameEvent(page, 'game/nextTurn');
  await expect(page.locator('.stand-container.current-turn').filter({ hasText: 'You' })).toBeVisible();
  await page.locator('.deck-btn.blue').click();
  await expect(page.locator('.pool-tiles .tile-btn')).toHaveCount(6);

  // 5. Ask for a compare clue
  const secondPublicTile = page.locator('.pool-tiles .tile-btn').nth(1);
  await expect(secondPublicTile).toBeEnabled();
  const secondPublicTileId = await secondPublicTile.locator('.number').innerText();
  await secondPublicTile.click();
  
  // Use the middle slot so the clue overlaps the player label and exercises 3D depth ordering.
  const aliceMiddleSlot = aliceStand.locator('.slot').nth(2);
  await aliceMiddleSlot.evaluate(el => (el as HTMLElement).click());

  await tester.step('ask-compare-clue', {
    description: 'Asking for a dot clue records it above the slot and consumes the tile',
    verifications: [
      {
        spec: 'Alice stand has a compare clue above the middle slot and in front of its 3D label',
        check: async () => {
          const indicator = aliceMiddleSlot.locator('.compare-indicators .compare-clue');
          await expect(indicator).toBeVisible();
          await expect(indicator).toHaveClass(/no-match/);
          await expect(indicator.locator('.mini-tile')).toBeVisible();
          await expect(indicator.locator('.mini-tile .number')).toHaveText(secondPublicTileId);
          await expect(indicator.locator('.tile-field-3d')).toHaveAttribute('data-tile-orientation', 'tilted');
          await expect(page.locator('.unified-tile-scene')).toHaveAttribute('data-player-label-count', '2');
        }
      },
      {
        spec: 'The consumed tile is removed from the public pool',
        check: async () => {
          await expect(page.locator(`.pool-tiles .tile-btn:has-text("${secondPublicTileId}")`)).toHaveCount(0);
          await expect(page.locator('.pool-tiles .tile-btn')).toHaveCount(5);
        }
      },
      {
        spec: 'The consumed physical tile flies and shrinks from the public line into its compare clue',
        check: async () => {
          await expect(page.locator('.unified-tile-scene')).toHaveAttribute(
            'data-last-tile-motion',
            /tile-\d+:3D public tile pool>Alice's compare clue/
          );
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
  await expect(aliceStand).toHaveClass(/current-turn/);
  await writeRemoteGameEvent(page, 'game/nextTurn');
  await expect(page.locator('.stand-container.current-turn').filter({ hasText: 'You' })).toBeVisible();
  await page.locator('.deck-btn.green').click();
  await expect(page.locator('.deck-btn.green')).toBeDisabled();
  await expect(boardCell.locator('.strike')).toBeVisible();
  
  // Fill some guesses
  await guessInputs.nth(0).fill('1');
  await guessInputs.nth(1).fill('2');
  await guessInputs.nth(2).fill('3');
  await guessInputs.nth(3).fill('4');
  await guessInputs.nth(4).fill('5');
  await expect(deductionBoard.locator('.got-five-btn')).toBeEnabled();
  
  await deductionBoard.locator('.got-five-btn').click();
  
  await tester.step('guessing-flow', {
    description: 'Guessing flow processes the guess from the deduction board',
    verifications: [
      {
        spec: 'End game status is shown (Eliminated or Winner)',
        check: async () => {
          await expect(page.locator('.status-banner')).toBeVisible();
        }
      }
    ]
  });

  // 7. Conclude
  tester.generateDocs();
});
