import { test, expect } from '@playwright/test';
import { TestStepHelper } from './helpers/test-step-helper';

test('clue tiles should remain dimmed on deduction board', async ({ page }, testInfo) => {
  const tester = new TestStepHelper(page, testInfo);
  
  await page.goto('/?seed=123&myId=repro-user');
  
  // Handle Lobby
  await page.getByLabel('Your Name:').fill('Tester');
  await page.getByRole('button', { name: 'Join Lobby' }).click();
  await page.getByRole('button', { name: 'Host New Game' }).click();
  await page.getByRole('button', { name: 'Start Hosting' }).click();

  // Add Alice via store to have someone to ask clues from
  await page.evaluate(() => {
    (window as any).store.dispatch({ 
      type: 'players/addPlayer', 
      payload: { id: 'alice-id', name: 'Alice' } 
    });
  });

  // Start Game
  await page.getByRole('button', { name: 'START GAME' }).click();

  // Find a tile in the public pool
  const firstPublicTile = page.locator('.pool-tiles .tile-btn').first();
  const firstPublicTileId = await firstPublicTile.locator('.number').innerText();
  console.log(`Testing with tile ID: ${firstPublicTileId}`);
  
  // Verify it is dimmed on the deduction board
  const boardCell = page.locator(`.deduction-board .cell[data-id="${firstPublicTileId}"]`);
  await expect(boardCell).toHaveClass(/dimmed/);

  // Use it for a clue
  await firstPublicTile.click();
  const aliceStand = page.locator('.stand-container').filter({ hasText: 'Alice' });
  await aliceStand.locator('.name-tag').click();

  // Verify it is removed from public pool
  await expect(page.locator(`.pool-tiles .tile-btn:has-text("${firstPublicTileId}")`)).toHaveCount(0);

  // Verify it is STILL dimmed on the deduction board
  // This is expected to FAIL before the fix
  await expect(boardCell).toHaveClass(/dimmed/);
});
