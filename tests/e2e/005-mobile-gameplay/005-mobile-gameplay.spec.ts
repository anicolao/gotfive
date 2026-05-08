import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

interface Store {
  dispatch: (action: { type: string; payload?: unknown }) => void;
  getState: () => {
    game: { status: string };
    players: { players: Record<string, unknown> };
  };
}

interface WindowWithStore extends Window {
  store: Store;
}

test.describe('Mobile Gameplay', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE portrait

  test('User plays on mobile portrait', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);
    tester.setMetadata('Mobile Portrait', 'Verify layout and gameplay on mobile portrait.');

    await page.goto('/?seed=123');

    // 1. Lobby Check
    const lobby = page.locator('.lobby-wrapper');
    await expect(lobby).toBeVisible();

    await page.getByLabel('Your Name:').fill('MobileUser');
    await page.getByRole('button', { name: 'Host Game' }).click();

    // Add a player via store
    await page.evaluate(() => {
      (window as unknown as WindowWithStore).store.dispatch({ 
        type: 'players/addPlayer', 
        payload: { id: 'p2', name: 'Player 2' } 
      });
    });

    await page.getByRole('button', { name: 'START GAME' }).click();

    await tester.step('mobile-portrait-layout', {
      description: 'Main play area and deduction board are visible together',
      verifications: [
        {
          spec: 'Main play area is visible',
          check: async () => {
            await expect(page.locator('.main-play-area')).toBeVisible();
          }
        },
        {
          spec: 'Deduction area is visible without toggling',
          check: async () => {
            await expect(page.locator('.deduction-area')).toBeVisible();
          }
        },
        {
          spec: 'Opponents are in viewport',
          check: async () => {
            await expect(page.locator('.opponents-area')).toBeInViewport();
          }
        },
        {
          spec: 'Table is in viewport',
          check: async () => {
            await expect(page.locator('.public-area')).toBeInViewport();
          }
        },
        {
          spec: 'Player stand is in viewport',
          check: async () => {
            await expect(page.locator('.player-area')).toBeInViewport();
          }
        },
        {
          spec: 'Deduction area is in viewport',
          check: async () => {
            await expect(page.locator('.deduction-area')).toBeInViewport();
          }
        }
      ]
    });

    // 2. Play Again Flow
    // Force a win for Player 2 to trigger game over
    await page.evaluate(() => {
      (window as unknown as WindowWithStore).store.dispatch({ 
        type: 'game/setWinner', 
        payload: 'p2' 
      });
    });

    await tester.step('game-over-mobile', {
      description: 'Game over status shows on mobile',
      verifications: [
        {
          spec: 'Status banner is visible',
          check: async () => {
            await expect(page.locator('.status-banner')).toBeVisible();
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

    // Click Play Again (the one in the banner)
    await page.locator('.status-banner button:has-text("Play Again")').click();

    await tester.step('reset-flow', {
      description: 'Game resets to lobby state without page reload',
      verifications: [
        {
          spec: 'Lobby is visible again',
          check: async () => {
            await expect(page.locator('.lobby-wrapper')).toBeVisible();
          }
        },
        {
          spec: 'Game status is LOBBY in store',
          check: async () => {
            const status = await page.evaluate(() => (window as unknown as WindowWithStore).store.getState().game.status);
            expect(status).toBe('LOBBY');
          }
        },
        {
          spec: 'Connected players are preserved',
          check: async () => {
            const players = await page.evaluate(() => Object.keys((window as unknown as WindowWithStore).store.getState().players.players));
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
      (window as unknown as WindowWithStore).store.dispatch({ 
        type: 'players/addPlayer', 
        payload: { id: 'p2', name: 'Player 2' } 
      });
    });

    await page.getByRole('button', { name: 'START GAME' }).click();

    await tester.step('mobile-landscape-layout', {
      description: 'Main play area and deduction board are both visible horizontally',
      verifications: [
        {
          spec: 'Main play area is visible',
          check: async () => {
            await expect(page.locator('.main-play-area')).toBeVisible();
          }
        },
        {
          spec: 'Deduction board is visible horizontally',
          check: async () => {
            await expect(page.locator('.deduction-area')).toBeVisible();
            await expect(page.locator('.deduction-area')).toBeInViewport();
          }
        }
      ]
    });

    tester.generateDocs();
  });
});
