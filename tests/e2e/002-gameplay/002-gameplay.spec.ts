import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('User plays the game', async ({ page }, testInfo) => {
  // 1. Initialize with a fixed seed for reproducibility
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Gameplay', 'As a user, I want to play through a game with deterministic results.');

  // 2. Load the game with seed 42
  await page.goto('/?seed=42');
  
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
        spec: 'Each of the 5 colored decks has 7 tiles remaining',
        check: async () => {
          const deckCounts = page.locator('.deck-count');
          await expect(deckCounts).toHaveCount(5);
          for (let i = 0; i < 5; i++) {
            await expect(deckCounts.nth(i)).toHaveText('7');
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
        spec: 'Red deck has 6 tiles remaining',
        check: async () => {
          await expect(page.locator('.deck-btn.red .deck-count')).toHaveText('6');
        }
      }
    ]
  });

  // 4. Conclude
  tester.generateDocs();
});
