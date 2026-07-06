import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('User visits homepage', async ({ page }, testInfo) => {
  // 1. Initialize
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Homepage', 'As a user, I want to see the landing page.');

  // 2. Perform Action & Verify
  await page.goto(`/?seed=123&myId=homepage-test-user&lobbyId=lobby-001`);  await tester.step('initial-load', {
    description: 'Landing page is visible',
    verifications: [
      { spec: 'Lobby is visible', check: async () => await expect(page.locator('.lobby-wrapper')).toBeVisible() },
      { spec: 'Name input is visible', check: async () => await expect(page.getByLabel('Your Name:')).toBeVisible() }
    ]
  });

  // 3. Conclude
  tester.generateDocs();
});
