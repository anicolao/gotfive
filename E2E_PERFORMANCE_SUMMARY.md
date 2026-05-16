# E2E Performance Summary

This document summarizes the performance of the E2E test suite after the compliance and optimization pass.

## Key Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Execution Time | ~4m 55s | ~1m 30s | ~70% |
| Parallel Workers | 1 | 1 | - |
| Retries | 2 | 0 | - |
| Max Expect Timeout | 30,000ms | 2,000ms | - |

## Test Breakdown

All tests now run with **0 retries** and a **2,000ms maximum timeout** for all assertions and actions.

| Test Case | Duration (Approx) | Reasoning for Time |
|-----------|-------------------|-------------------|
| 001-homepage | 2s | Simple load and verification. |
| 002-gameplay | 15s | Complex walkthrough of a full game, multiple steps and screenshots. |
| 003-multiplayer | 12s | Multiple browser contexts, PeerJS connection overhead. |
| 004-turn-taking | 10s | Multiple browser contexts, turn rotation logic. |
| 005-mobile-gameplay | 25s | Comprehensive checks on 3 different mobile/tablet viewports. |
| 006-lobby-handoff | 15s | Multiple leader election cycles and seniority handoffs. |

## Optimizations Performed

1.  **Network Timing Acceleration**: Reduced PeerJS watchdog from 5s to 1s and newcomer delay from 6s to 1.5s in test mode.
2.  **Election Efficiency**: Reduced election retry interval from 1000ms to 100ms and max retries from 60 to 2 for tests.
3.  **Strict Compliance**: Eliminated all `waitForTimeout` calls and capped all explicit timeouts at 2000ms.
4.  **TestStepHelper Stabilization**: Injected CSS to disable animations/transitions and optimized clipping/overlap checks.
5.  **Configuration Hardening**: Set global `retries: 0` and `expect: { timeout: 2000 }` to enforce permanent compliance.
