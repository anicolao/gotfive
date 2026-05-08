import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Mobile Gameplay', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE portrait

  test('User plays on mobile portrait', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);
    tester.setMetadata('Mobile Portrait', 'Verify layout and gameplay on mobile portrait.');

    await page.goto('/?seed=123');

    // 1. Lobby Check
    const lobby = page.locator('.lobby');
    await expect(lobby).toBeVisible();
    
    // Check readability (background vs color)
    const lobbyColor = await lobby.evaluate(el => getComputedStyle(el).color);
    const lobbyBg = await lobby.evaluate(el => getComputedStyle(el).backgroundColor);
    // var(--color-wood) is #5C4033, var(--color-cream) is #F5F5DC
    // We just want to ensure they are set.
    expect(lobbyColor).toBe('rgb(92, 64, 51)'); // #5C4033
    expect(lobbyBg).toBe('rgb(245, 245, 220)'); // #F5F5DC

    await page.getByLabel('Your Name:').fill('MobileUser');
    await page.getByRole('button', { name: 'Host Game' }).click();

    // Add a player via store
    await page.evaluate(() => {
      (window as any).store.dispatch({ 
        type: 'players/addPlayer', 
        payload: { id: 'p2', name: 'Player 2' } 
      });
    });

    await page.getByRole('button', { name: 'START GAME' }).click();

    await tester.step('mobile-portrait-layout', {
      description: 'Main play area and sidebar stack in portrait',
      verifications: [
        {
          spec: 'Main play area is above the sidebar (DeductionBoard)',
          check: async () => {
            const mainBox = await page.locator('.main-play-area').boundingBox();
            const sidebarBox = await page.locator('.sidebar').boundingBox();
            expect(mainBox!.y).toBeLessThan(sidebarBox!.y);
          }
        },
        {
          spec: 'Header title is smaller on mobile',
          check: async () => {
            const fontSize = await page.locator('header h1').evaluate(el => getComputedStyle(el).fontSize);
            // 1.5rem at 16px base is 24px. Original was 2.5rem (40px).
            expect(parseFloat(fontSize)).toBeLessThan(30);
          }
        }
      ]
    });

    // 2. Play Again Flow
    // Force a win for Player 2 to trigger game over
    await page.evaluate(() => {
      (window as any).store.dispatch({ 
        type: 'game/setWinner', 
        payload: 'p2' 
      });
    });

    await tester.step('game-over-mobile', {
      description: 'Game over modal shows on mobile',
      verifications: [
        {
          spec: 'Overlay is visible',
          check: async () => {
            await expect(page.locator('.overlay')).toBeVisible();
          }
        },
        {
          spec: 'Winner message is correct',
          check: async () => {
            await expect(page.locator('.winner-msg')).toContainText('Winner: Player 2');
          }
        }
      ]
    });

    // Click Play Again (the one in the modal)
    await page.locator('.overlay button:has-text("Play Again")').click();

    await tester.step('reset-flow', {
      description: 'Game resets to lobby state without page reload',
      verifications: [
        {
          spec: 'Lobby is visible again',
          check: async () => {
            await expect(page.locator('.lobby')).toBeVisible();
          }
        },
        {
          spec: 'Game status is LOBBY in store',
          check: async () => {
            const status = await page.evaluate(() => (window as any).store.getState().game.status);
            expect(status).toBe('LOBBY');
          }
        },
        {
          spec: 'Connected players are preserved',
          check: async () => {
            const players = await page.evaluate(() => Object.keys((window as any).store.getState().players.players));
            expect(players).toContain('p2');
          }
        }
      ]
    });

    tester.generateDocs();
  });

  test('User plays on mobile landscape', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);
    tester.setMetadata('Mobile Landscape', 'Verify layout on mobile landscape.');

    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/?seed=123');

    await page.getByLabel('Your Name:').fill('LandscapeUser');
    await page.getByRole('button', { name: 'Host Game' }).click();

    await page.evaluate(() => {
      (window as any).store.dispatch({ 
        type: 'players/addPlayer', 
        payload: { id: 'p2', name: 'Player 2' } 
      });
    });

    await page.getByRole('button', { name: 'START GAME' }).click();

    await tester.step('mobile-landscape-layout', {
      description: 'Main play area and sidebar are side-by-side in landscape',
      verifications: [
        {
          spec: 'Main play area and sidebar have similar Y coordinates',
          check: async () => {
            const mainBox = await page.locator('.main-play-area').boundingBox();
            const sidebarBox = await page.locator('.sidebar').boundingBox();
            // In landscape they should be roughly on the same horizontal line
            expect(Math.abs(mainBox!.y - sidebarBox!.y)).toBeLessThan(100);
          }
        }
      ]
    });
    
    tester.generateDocs();
  });
});
