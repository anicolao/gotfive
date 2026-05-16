# E2E Testing Guide

This project uses [Playwright](https://playwright.dev/) for End-to-End testing. Our E2E tests are the primary source of truth for application correctness.

## 1. The Philosophy: "Zero-Pixel Tolerance"

We enforce a strict **Zero-Pixel Tolerance** policy for visual regression. Since visual state is the primary feedback mechanism for the user, any deviation is considered a bug.

*   **Software Rendering**: We use software rendering to ensure 100% consistent snapshots across CI and local environments.
*   **Determinism**: Tests must be perfectly deterministic. Random seeds must be fixed.

## 2. Prohibitions

- **0 pixel tolerance**: We enforce a strict Zero-Pixel Tolerance policy for visual regression.
- **No masking**: Never use the `mask` property in `toHaveScreenshot()`. All non-deterministic components (version numbers, IDs, etc.) must be fixed at the infrastructure or test level.
- **No manual screenshots**: Never use `page.screenshot()`. Always use the `TestStepHelper`.
- **No arbitrary waits**: Never use `page.waitForTimeout()`. Use `locator.waitFor()` or wait for network/animation stabilization via the helper.
- **No timeouts > 2000ms**: No action or expectation timeout should exceed 2000ms.
- **No polling**: Avoid manual polling loops. Use Playwright's built-in auto-waiting and web-first assertions.
- **No retries**: Tests must be deterministic and pass on the first try. Global and per-test retries are prohibited.
- **No ignored tests**: Tests must either pass or be removed.

## 3. Directory Convention

All E2E tests live in `tests/e2e/`. Each test case gets its own directory, prefixed with a three-digit number.

```
tests/e2e/
├── helpers/                   # Shared utilities (TestStepHelper)
├── 001-homepage/              # Scenario Directory
│   ├── 001-homepage.spec.ts   # Main test file
│   ├── README.md              # Auto-generated verification doc
│   └── screenshots/           # Committed baseline images
```

## 4. The "Unified Step Pattern"

To prevent synchronization errors between documentation and screenshots, we use a **Unified Step API**. You must **NEVER** manually manage filenames or counters.

### The `TestStepHelper`

We use a helper class `TestStepHelper` that combines documentation, verification, and capturing into a single atomic operation: `step()`.

#### Usage Pattern

```typescript
import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('User logs food', async ({ page }, testInfo) => {
  // 1. Initialize
  const tester = new TestStepHelper(page, testInfo);
  tester.setMetadata('Feature Name', 'User Story description.');

  // 2. Perform Action & Verify
  await page.goto('/');
  await tester.step('step-id', {
    description: 'Human readable step description',
    verifications: [
      { spec: 'Technical verification description', check: async () => await expect(page).toHaveTitle('...') }
    ]
  });

  // 3. Conclude
  tester.generateDocs();
});
```

## 5. Running Tests

Always run tests through `nix develop` to ensure tool version consistency.

- **Run all tests**: `nix develop --command bun run test:e2e`
- **Update snapshots**: `nix develop --command bun run test:e2e:update-snapshots` (Use this when intentionally changing UI)
