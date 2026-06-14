---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
plan: "08"
subsystem: battery-picker
tags: [gap-closure, color-consistency, swatch, custom-battery, reactive-effect]
requires: [04-01, 04-02, 04-03, 04-04, 04-05, 04-06]
provides: [custom-card-swatch, COMP-04-picker-table-color-consistency]
affects: [src/ui/battery-picker.ts, tests/battery-picker.test.ts]
tech-stack:
  added: []
  patterns:
    - "@preact/signals-core effect() for reactive DOM class toggling"
    - "battery-swatch--N CSS class (no inline style) for CSP compliance"
key-files:
  modified:
    - src/ui/battery-picker.ts
    - tests/battery-picker.test.ts
decisions:
  - "Swatch element placed before expandBtn in the custom card DOM — mirrors catalog card layout (swatch adjacent to the button/label)"
  - "Separate second effect for custom swatch, not folded into the catalog effect — keeps concerns separate and disposes independently"
  - "activeBatteries computed signal used as the dependency so the effect re-runs on BOTH selection order changes and custom battery changes"
metrics:
  duration: "3 minutes"
  completed: "2026-06-14T08:31:36Z"
  tasks: 2
  files: 2
---

# Phase 04 Plan 08: Custom Battery Card Swatch Summary

**One-liner:** Color swatch added to custom battery card using `colorSlotFor('custom', activeBatteries)` reactive effect, matching the comparison table's slot assignment.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Render and reactively drive a swatch on the custom battery card | 23c23e5 | src/ui/battery-picker.ts |
| 2 | Test — custom card swatch slot matches the table slot | 3c19d95 | tests/battery-picker.test.ts |

## What Was Built

### Task 1: Custom Card Swatch Implementation

Modified `buildCustomCard()` in `src/ui/battery-picker.ts`:

- Added a `.battery-card__swatch` span to the custom card DOM (placed before `expandBtn`, inside the `<li>`)
- Span starts with `hidden = true` (no active custom battery on load)
- No `battery-swatch--N` class set at build time — the reactive effect manages it

Added a second reactive `effect()` in `initBatteryPicker()`:

- Reads `customBattery.value` and `activeBatteries.value` (a computed over `selectedBatteries + customBattery`)
- When `customBattery` is valid (`nominalCapacityKwh > 0`): computes `slot = colorSlotFor('custom', activeBatteries.value.map(b => b.id))`, removes `battery-swatch--1..5`, adds `battery-swatch--${slot}`, sets `hidden = false`
- When invalid/null: strips slot classes, sets `hidden = true`
- Dispose fn pushed to `_disposeFns` (Pitfall 3 — no effect accumulation on hot reload)

Imported `activeBatteries` from `../state/app-state`.

### Task 2: Tests

Added 4 new tests to `tests/battery-picker.test.ts`:

1. `custom card swatch is hidden when no valid custom battery is set` — verifies initial state
2. `custom card swatch slot matches comparison table slot for the same selection (COMP-04)` — asserts `battery-swatch--N` class equals `colorSlotFor('custom', activeBatteries.value.map(b => b.id))`; also verifies no inline style
3. `custom card swatch is hidden again after customBattery is cleared (null)` — verifies reactive cleanup
4. `custom card swatch has no battery-swatch--N class when hidden` — verifies class cleanup when hidden

Added `resetPickerDOM()` helper. Extended `afterEach` and `beforeEach` to reset `customBattery.value = null` for test isolation.

## Verification

- `npm test` — 294 tests passed (22 test files); all existing assertions unbroken
- `npm run build` — static build green; bundle sizes unchanged
- `grep "\.style\." src/ui/battery-picker.ts` — no inline style assignments
- Slot assignment: `colorSlotFor('custom', activeBatteries.value.map(b => b.id))` is identical to the comparison table's slot computation, confirmed by test assertion

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The swatch carries no user-derived text — class-only DOM mutation. T-04-08-01 and T-04-08-02 mitigations verified in implementation:

- T-04-08-01: swatch color via `battery-swatch--N` CSS class only; no `style.backgroundColor`; swatch carries no user text
- T-04-08-02: effect dispose fn pushed to `_disposeFns`; `teardownBatteryPicker()` disposes it (Pitfall 3)

## Self-Check: PASSED

- [x] `src/ui/battery-picker.ts` modified — confirmed (worktree file)
- [x] `tests/battery-picker.test.ts` modified — confirmed (worktree file)
- [x] Commit 23c23e5 exists: `git log --oneline | grep 23c23e5` — confirmed
- [x] Commit 3c19d95 exists: `git log --oneline | grep 3c19d95` — confirmed
- [x] 294 tests pass — confirmed
- [x] Build succeeds — confirmed
