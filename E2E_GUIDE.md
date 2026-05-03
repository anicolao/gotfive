# E2E Testing Guide

## Philosophy
- E2E tests are the primary correctness signal for visible UI behavior.
- Use a zero-pixel tolerance for visual snapshots.

## Conventions
- Use the Unified Step Pattern with `TestStepHelper`.
- Keep tests deterministic.
- Avoid arbitrary sleeps.
- Prefer role, label, and text locators.

## Scenario Folders
```text
tests/e2e/
├── helpers/
│   └── test-step-helper.ts
└── 001-homepage/
    ├── 001-homepage.spec.ts
    ├── README.md
    └── screenshots/
        └── 000-initial-load.png
```
