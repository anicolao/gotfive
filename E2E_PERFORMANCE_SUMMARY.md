# E2E Performance Summary

This document summarizes the performance of the E2E test suite after the compliance and optimization pass.

## Key Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Execution Time | ~4m 55s | ~1m 42s | ~65% |
| Parallel Workers | 1 | 1 | - |
| Retries | 2 | 0 | - |
| Max Expect Timeout | 30,000ms | 2,000ms | - |

## Test Breakdown

All tests now run with **0 retries** and a **2,000ms maximum timeout** for all assertions and actions.

| Test Case | Duration (Approx) | Reasoning for Time |
|-----------|-------------------|-------------------|
| 001-homepage | 2s | Simple load and verification. |
| 002-gameplay | 12s | Complex walkthrough of a full game, multiple steps and screenshots. |
| 003-multiplayer | 15s | Multiple browser contexts, PeerJS connection overhead. |
| 004-turn-taking | 15s | Multiple browser contexts, turn rotation logic. |
| 005-mobile-gameplay | 22s | Comprehensive checks on 3 different mobile/tablet viewports. |
| 006-lobby-handoff | 18s | Multiple leader election cycles and seniority handoffs. |

## Optimizations Performed

1.  **Network Timing Acceleration**: Reduced PeerJS watchdog from 10s to 500ms and newcomer delay from 1s to 1s (but now properly sequenced after watchdog).
2.  **Heartbeat Efficiency**: Reduced lobby heartbeat interval from 1000ms to 200ms in test mode, allowing for much shorter watchdog timeouts.
3.  **Election Stability**: Increased election max retries for tests from 2 to 5 to handle PeerJS ID cleanup latency.
4.  **Wait Logic Optimization**: Replaced hardcoded 500ms waits in the app with `reconnectDelay` from config (100ms in tests).
5.  **Strict Compliance**: Eliminated all `waitForTimeout` calls and capped all explicit timeouts at 2000ms.
6.  **Configuration Hardening**: Set global `retries: 0` and `expect: { timeout: 2000 }` to enforce permanent compliance.
