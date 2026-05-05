import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('User visits homepage', async ({ page }, testInfo) => {
  // 1. Initialize
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Homepage', 'As a user, I want to see the landing page.');

  // 2. Perform Action & Verify
  await page.goto('/');
  await tester.step('initial-load', {
    description: 'Landing page is visible',
    verifications: [
      { spec: 'Heading is visible', check: async () => await expect(page.getByRole('heading', { name: 'Got Five!' })).toBeVisible() }
    ]
  });

  // 3. Conclude
  tester.generateDocs();
});
