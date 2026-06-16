---
phase: 06-post-v1-ux-enhancements-multiple-custom-batteries-and-option
plan: 02
subsystem: ui
tags: [battery-picker, custom-batteries, tdd, wave-2, jsdom, xss-safety, csp]
dependency_graph:
  requires:
    - 06-01 (customBatteries collection signal + activeBatteries computed)
  provides:
    - buildCustomCard(id, n) generalized to N cards
    - "+ Eigen batterij" add button with valid-only cap guard
    - per-card remove button (× Verwijderen)
    - per-card order-based swatch effects
    - optional name field with 'Eigen batterij N' default
    - jsdom tests for add/remove/cap/name/swatch-reflow
  affects:
    - src/ui/battery-picker.ts (owned exclusively by this plan)
    - tests/battery-picker.test.ts (migrated from customBattery to customBatteries)
tech_stack:
  added: []
  patterns:
    - buildCustomCard(id, n) closure per card (swatch effect + validateAndWrite + remove)
    - immutable array replace-by-id for customBatteries (filter+spread)
    - per-card effect pushed to _disposeFns for teardown
    - add-button with _customOrdinal counter in initBatteryPicker closure
    - activeBatteries.value.length cap guard driving addBtn.disabled + CSS class
key_files:
  created: []
  modified:
    - src/ui/battery-picker.ts
    - src/styles/battery-picker.css
    - tests/battery-picker.test.ts
decisions:
  - D-01: each add-button click appends a fresh editable card; no separate commit step
  - D-02: optional name field pre-filled 'Eigen batterij N'; empty falls back to default
  - D-03: only valid customs (nominalCapacityKwh > 0) count toward max-5 cap via activeBatteries
  - D-04: per-card remove button removes regardless of fill state; catalog deselect unchanged
  - D-05: per-card swatch effect reads activeBatteries order for colorSlotFor — reflows on removal
  - D-09: unique card ids 'custom-1', 'custom-2', ... from incrementing ordinal counter
  - D-10: CSS class only for swatches; no .style. assignments (style-src 'self' CSP)
metrics:
  duration_minutes: 15
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_modified: 3
---

# Phase 6 Plan 02: Multi-Custom Battery Picker — buildCustomCard(id, n) + Add Button Summary

**One-liner:** `buildCustomCard(id, n)` generalized to N cards with per-card name field, per-card remove button, per-card swatch effect (colorSlotFor order-based), and an add button with valid-only cap guard driving `activeBatteries.value.length >= MAX_SELECTED`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for multi-custom buildCustomCard + add-button | 817e951 | tests/battery-picker.test.ts |
| 1+2 (GREEN) | Generalize buildCustomCard + add-button + CSS | 3bea9f6 | src/ui/battery-picker.ts, src/styles/battery-picker.css |

## What Was Built

### `src/ui/battery-picker.ts`

- **`buildCustomCard(id, n)`**: replaces the old zero-arg `buildCustomCard()`. Takes a unique stable id (e.g. `custom-1`) and ordinal `n` for the default name `Eigen batterij ${n}`. Each call returns an `<li>` with `dataset.batteryId = id`.

- **Name field (D-02)**: first form element is an `<input type="text" class="custom-battery-form__name">` pre-filled with `defaultName`. `validateAndWrite` resolves `nameInput.value.trim() || defaultName` and stores it as `entry.name` (textContent-safe; never assigned to innerHTML). XSS-safe: name is stored in the signal as a string and rendered downstream via textContent.

- **`validateAndWrite` rewritten**: writes immutably into `customBatteries` by id. Invalid/empty path: `customBatteries.value = customBatteries.value.filter((b) => b.id !== id)`. Valid path: `customBatteries.value = [...customBatteries.value.filter((b) => b.id !== id), partial as BatteryConfig]`. Never `.push()` on the signal value.

- **`× Verwijderen` remove button (D-04)**: class `battery-card__remove`, min-height 44px (WCAG 2.5.5). Click: filter customBatteries, `li.remove()`, `scheduleRecompute(true)`. Works regardless of fill state.

- **Per-card swatch effect (D-05)**: each `buildCustomCard` call pushes its own `effect()` to `_disposeFns`. Reads `customBatteries.value` and `activeBatteries.value`; applies `colorSlotFor(id, orderedIds)` as `battery-swatch--${slot}` (CSS class only, no `.style.*`). Hidden when no valid entry for this id.

- **Old module-level single-custom swatch effect removed**: each card now owns its own reactive swatch effect.

- **`+ Eigen batterij` add button (D-01, D-03)**: class `battery-picker__add`. Closure ordinal counter `_customOrdinal`. Click guard: `if (activeBatteries.value.length >= MAX_SELECTED) return`. Creates `custom-${n}` id and appends to the `<ul>`. No `scheduleRecompute` on empty draft (fires when user fills capacity, per D-03).

- **Catalog reactive effect extended**: `atCap` now counts `activeBatteries.value.length` (includes valid customs). Drives both `capNote.hidden` and `addBtn.disabled` + `battery-picker__add--disabled` CSS class.

- **Import updated**: `customBattery` (singular) removed, `customBatteries` (collection) added.

### `src/styles/battery-picker.css`

Added:
- `.battery-card__remove`: min-height 44px touch target, destructive color, focus-visible ring
- `.custom-battery-form__name`: text input styling consistent with `.custom-battery-form__input`
- `.battery-picker__add`: dashed accent border, add-affordance styling, min-height 44px
- `.battery-picker__add--disabled` / `:disabled`: opacity + not-allowed cursor

No inline styles, no new color values (uses `var(--color-destructive)`, `var(--color-accent)`, `var(--color-border)` tokens).

### `tests/battery-picker.test.ts`

- **Imports migrated**: `customBattery` → `customBatteries`; added `BatteryConfig` type import
- **Existing describe block updated**: card-count tests now expect 7 catalog cards (no custom on mount), find custom cards by `data-battery-id^="custom-"`, test add button exists
- **New `describe('multiple custom batteries (D-01..D-05)')` block**: 15 it-cases covering:
  - D-01: add appends unique-id cards (`custom-1`, `custom-2`, `custom-3`)
  - D-02: name field pre-fill + typed name to signal entry + empty fallback
  - D-03: cap disables add at 5 valid; empty draft does not consume slot
  - D-04: remove button removes DOM li + signal entry + frees slot
  - D-05: middle-removal swatch reflow (slot decreases for survivor)
  - T-06-02: XSS — malicious name stored as text, zero `<script>` nodes

## Verification

- `npm test -- battery-picker`: 33 tests pass (0 failures)
- `npm test` (full suite): 404 tests pass across 30 test files
- `npx tsc --noEmit`: zero errors
- `grep -n "'custom'" src/ui/battery-picker.ts`: returns nothing (no bare 'custom' id)
- `grep -n "\.style\." src/ui/battery-picker.ts`: returns nothing (no inline styles)
- `grep -n "customBattery\b" src/ui/battery-picker.ts`: returns nothing (singular fully removed)
- `grep -n "battery-card__remove" src/styles/battery-picker.css`: confirmed present

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing describe block to match new picker API**
- **Found during:** Task 1 RED phase
- **Issue:** The existing tests (card-count, XSS, swatch tests) were written for the old single-custom card architecture (`data-battery-id="custom"`, `customBattery` signal, expand-button flow). After the 06-01 signal migration removed `customBattery`, all 20 existing tests were failing with `TypeError: Cannot set properties of undefined (setting 'value')`.
- **Fix:** Rewrote the existing describe block: switched import to `customBatteries`, updated card-count tests to expect 7 catalog cards + 0 custom on mount (add-button flow), updated swatch tests to click the add button first, changed XSS test to target the add button instead of the old expand button.
- **Files modified:** `tests/battery-picker.test.ts`
- **Commit:** 817e951 (RED phase)

## Known Stubs

None. All form fields render real numeric inputs wired to signal writes. No hardcoded placeholder data flows to rendering.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-06-02 mitigated | src/ui/battery-picker.ts | Custom name stored via `nameInput.value.trim()` — pure string stored in signal; downstream rendering must use textContent (verified in comparison-table, 06-03). XSS test confirmed zero `<script>` nodes. |
| T-06-04 mitigated | src/ui/battery-picker.ts | Swatch colors applied only via `battery-swatch--N` CSS classes; `grep -n ".style." src/ui/battery-picker.ts` returns nothing. |

## Worker-Mock Blind Spot (documented)

As noted in the plan: jsdom tests here exercise signal writes and DOM, but NOT the Comlink round-trip to table re-render. The full live recompute on add/remove is human-verified in 06-03.

## Self-Check: PASSED

- `src/ui/battery-picker.ts` exists and contains `buildCustomCard(id: string, n: number)`: confirmed (line 124)
- `src/styles/battery-picker.css` contains `.battery-card__remove`: confirmed (line 208)
- `tests/battery-picker.test.ts` imports `customBatteries` and contains `describe('multiple custom batteries (D-01..D-05)')`: confirmed
- Commits 817e951 and 3bea9f6 exist in git log: confirmed
- `npm test -- battery-picker` exits 0 with 33 tests: confirmed
- `npm test` (full suite) exits 0 with 404 tests: confirmed
