---
phase: 06-post-v1-ux-enhancements-multiple-custom-batteries-and-option
plan: 01
subsystem: state
tags: [signals, custom-batteries, saldering, tdd, wave-1]
dependency_graph:
  requires: []
  provides:
    - customBatteries collection signal (BatteryConfig[])
    - salderingOn boolean signal
    - array-aware activeBatteries computed
  affects:
    - src/ui/battery-picker.ts (downstream — imports old customBattery, fixed in 06-02)
    - tests/battery-picker.test.ts (downstream — fixed in 06-02)
tech_stack:
  added: []
  patterns:
    - signal<BatteryConfig[]>([]) for collection signals
    - array filter pattern for valid-custom guard (nominalCapacityKwh > 0)
key_files:
  created: []
  modified:
    - src/state/signals.ts
    - src/state/app-state.ts
    - tests/app-state.test.ts
decisions:
  - D-09: customBatteries is a collection signal (array), not a single nullable config
  - D-06: salderingOn defaults to false (post-2027 phase-out context)
  - D-03: only customs with nominalCapacityKwh > 0 appear in activeBatteries
  - D-05: array order is preserved in activeBatteries; no sorting applied
metrics:
  duration_minutes: 5
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_modified: 3
---

# Phase 6 Plan 01: Replace customBattery with customBatteries Collection + salderingOn Signal Summary

**One-liner:** Signal graph refactored to `customBatteries: signal<BatteryConfig[]>([])` collection + `salderingOn: signal<boolean>(false)` toggle, with array-aware `activeBatteries` computed filtering by `nominalCapacityKwh > 0` and preserving array order.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for customBatteries + salderingOn contract | 75cb68b | tests/app-state.test.ts |
| 1 (GREEN) | Replace customBattery with customBatteries collection + salderingOn | d7341dc | src/state/signals.ts, src/state/app-state.ts, tests/app-state.test.ts |
| 2 | Node-env contract tests (included in Task 1 GREEN commit) | d7341dc | tests/app-state.test.ts |

## What Was Built

- **`src/state/signals.ts`**: Removed `customBattery: signal<Partial<BatteryConfig> | null>(null)` and replaced with `customBatteries: signal<BatteryConfig[]>([])` (empty-array initial, typed as full `BatteryConfig[]` per D-09). Added `salderingOn: signal<boolean>(false)`. Rewrote `activeBatteries` computed to filter the collection array and spread into result.

- **`src/state/app-state.ts`**: Updated re-export block: `customBattery` removed, `customBatteries` and `salderingOn` added. Internal `_runCompute` import unchanged (it reads only `filteredSamples` + `activeBatteries` which still exist).

- **`tests/app-state.test.ts`**: Added `describe('customBatteries + salderingOn signal contract')` block with 5 it-cases (saldering default false, empty-collection activeBatteries, one valid custom appended, zero-capacity excluded, two-custom order). Migrated existing `activeBatteries computed` tests from `customBattery` to `customBatteries` API.

## Verification

- `npm test -- app-state`: 27 tests pass
- `grep -n "customBattery\b" src/state/signals.ts`: returns nothing (singular fully removed)
- `npx tsc -p tsconfig.app.json --noEmit`: zero errors in signals.ts and app-state.ts
- T-06-01 mitigated: `nominalCapacityKwh > 0` guard preserved in `activeBatteries` computed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migrated existing activeBatteries tests to new customBatteries API**
- **Found during:** Task 1 GREEN phase
- **Issue:** The existing `activeBatteries computed` describe block (8 tests) imported and used `customBattery` (singular) which was removed from the exported interface. Leaving these tests unchanged would leave them failing.
- **Fix:** Updated imports to remove `customBattery` (singular). Rewrote the `activeBatteries computed` tests to use `customBatteries` array writes instead of `customBattery` single-signal writes. The `customBattery starts as null` initial-value test was removed (the concept no longer exists). The test file's `beforeEach` no longer resets `customBattery.value`.
- **Files modified:** `tests/app-state.test.ts`
- **Commit:** d7341dc

## Downstream TypeScript Errors (Expected — Fixed in 06-02)

Two files reference the old `customBattery` identifier and produce TS errors:

| File | Error |
|------|-------|
| `src/ui/battery-picker.ts` | TS2724: `'../state/app-state'` has no exported member named `customBattery`. Did you mean `customBatteries`? |
| `tests/battery-picker.test.ts` | TS2724: `'../src/state/app-state'` has no exported member named `customBattery`. Did you mean `customBatteries`? |

These are expected at this wave. Plan 06-02 (battery-picker generalization to multi-custom) will resolve both errors by migrating `battery-picker.ts` and its tests to the `customBatteries` collection API.

## Known Stubs

None. This plan is pure signal/state logic — no UI rendering, no hardcoded placeholder data.

## Threat Flags

No new security surface introduced. The `nominalCapacityKwh > 0` guard (T-06-01) is in place in `activeBatteries` computed, identical semantics to the prior T-04-06 guard.

## Self-Check: PASSED

- `src/state/signals.ts` exists and contains `customBatteries` and `salderingOn`: confirmed
- `src/state/app-state.ts` re-exports `customBatteries` and `salderingOn`: confirmed
- `tests/app-state.test.ts` contains new describe block with 5 its: confirmed
- Commits 75cb68b and d7341dc exist in git log: confirmed
- `npm test -- app-state` exits 0 with 27 tests: confirmed
