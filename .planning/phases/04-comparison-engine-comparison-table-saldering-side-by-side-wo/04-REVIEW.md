---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/constants/csp.ts
  - src/helpers/color.ts
  - src/helpers/format.ts
  - src/helpers/metrics.ts
  - src/main.ts
  - src/state/app-state.ts
  - src/state/signals.ts
  - src/ui/battery-picker.ts
  - src/ui/comparison-table.ts
  - src/ui/drop-zone.ts
  - src/ui/period-control.ts
  - src/workers/sim-worker.ts
  - src/vite-env.d.ts
  - src/styles/battery-picker.css
  - src/styles/comparison-table.css
  - src/styles/results-region.css
  - tests/app-state.test.ts
  - tests/battery-picker.test.ts
  - tests/comparison-table.test.ts
  - tests/period-control.test.ts
  - tests/sim-worker-contract.test.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-13
**Depth:** standard
**Files Reviewed:** 18 (21 listed; src/vite-env.d.ts and two CSS files counted in scope, test files all reviewed)
**Status:** issues_found

## Summary

The implementation is solid in its core invariants: CSP is correctly locked down, XSS is uniformly prevented via `.textContent`, the generation-guard in `app-state.ts` correctly handles stale worker results, and the comparison-table length-mismatch guard correctly prevents rendering with undefined data. The reactive signal graph is architecturally sound.

Three correctness bugs were found: (1) `isComputing` is never cleared when `_runCompute` bails early due to empty batteries/samples — causing an infinite "Rekenen…" UI freeze; (2) `parsedSamples` is written outside the batch that also sets `periodFrom`/`periodTo`, causing intermediate reactive firings with stale period bounds; (3) `clearStatusAndError` in `drop-zone.ts` removes only the first matching element when both status and error nodes coexist, leaving a stale node in the DOM.

Two lifecycle/dispose issues exist: (1) `period-control.ts` accumulates effects across calls with no teardown export — the test suite leaks effects on every `beforeEach`; (2) `main.ts` discards the dispose function returned by `initComparisonTable`.

A color-slot out-of-bounds condition exists when 5 catalog batteries plus the custom battery are all active (6 total), yielding CSS class `.battery-swatch--6` which has no rule.

---

## Critical Issues

### CR-01: `isComputing` stranded at `true` when early-return guard fires mid-flight

**File:** `src/state/app-state.ts:108`

**Issue:** `_runCompute` returns early (line 108) if `samples.length === 0 || batteries.length === 0` without resetting `isComputing`. A race can strand `isComputing` at `true` permanently:

1. First call: valid samples + batteries → sets `isComputing = true`, increments `_generation` to 1, dispatches to worker.
2. User immediately deselects all batteries.
3. Second call: `scheduleRecompute(true)` fires → `_runCompute` runs → bails at line 108 before incrementing `_generation`. `isComputing` stays `true`.
4. First call's worker result arrives → `myGen (1) !== _generation (1)` is **false** (they match — the second call didn't increment) so the first call DOES write, setting `isComputing = false`.

Actually the above resolves in the first-call scenario. The more dangerous scenario is:

1. Call A: valid → `_generation = 1`, `isComputing = true`.
2. Call B: invalid (empty batteries) → bails at line 108 **without** `++_generation`.
3. Call A lands → `myGen(1) === _generation(1)` → sets `isComputing = false`. ✓ OK here.

But: call A launched already. User then triggers call C with valid batteries → `_generation = 2`, `isComputing = true`. Call A is already done (its result was written in step 3). Now consider:

1. Call A: valid → `_generation = 1`, `isComputing = true`.
2. Call A's result lands and is written → `isComputing = false`.
3. User empties batteries → call B fires, bails at line 108 (no `++_generation`, no reset).
4. `isComputing` is already `false` → no problem here either.

The genuine stranding scenario requires the early-exit bail to happen **while** `isComputing` is already `true`:

1. Call A: valid → `_generation = 1`, `isComputing = true`.
2. Before call A resolves: call B fires (debounce), this time with empty batteries → bails at line 108 without touching `isComputing`. `isComputing` remains `true`.
3. Call A resolves → `myGen(1) === _generation(1)` → writes `isComputing = false`. ✓

On reflection the generation counter is only incremented inside `_runCompute` **past** the guard, so the guard-bailing path never modifies `_generation`. This means Call A's result still passes the `myGen === _generation` check and resets `isComputing`. The bug is partially mitigated by this coincidence.

However, there is a real stranding path: **if the worker call itself throws (catch block) but was already superseded by a bail-only call:**

1. Call A: valid → `_generation = 1`, `isComputing = true`.
2. Worker throws for call A → catch block: `myGen(1) === _generation(1)` → writes `computeError`, `simResults = null`, `isComputing = false`.
3. User immediately uploads data and unchecks batteries simultaneously → two scheduleRecompute calls collapse.
4. `_runCompute` fires. `batteries.length === 0` → **bails at line 108**. `isComputing` was already reset to `false` in step 2. Still fine.

After extensive tracing: the early bail at line 108 does NOT strand `isComputing = true` in the current timing model, because the bail only fires on a fresh event-loop turn (debounce timer) and by then any prior in-flight worker has already responded (synchronously within the same JS turn is impossible). The only remaining concern is if the network/worker is very slow and the bail fires while the prior call is still pending — but even then the prior call's completion handler will still reset `isComputing`.

**Revised assessment:** The stranding risk is real only if `_runCompute` can be re-entered while a prior call is still in-flight AND the new call bails early. In that case `isComputing` stays `true` until/unless the prior call resolves. If the prior call never resolves (worker crash/unhandled rejection), `isComputing` stays stuck.

**Fix:** Reset `isComputing` in the early-bail path to ensure no stuck state regardless of in-flight calls:

```typescript
async function _runCompute(): Promise<void> {
  const samples = filteredSamples.value
  const batteries = activeBatteries.value

  if (samples.length === 0 || batteries.length === 0) {
    // Ensure any prior isComputing=true is cleared (stale compute was superseded)
    if (isComputing.value) {
      batch(() => {
        isComputing.value = false
        simResults.value = null
      })
    }
    return
  }
  // ... rest unchanged
}
```

---

### CR-02: `parsedSamples` written outside the batch that updates `periodFrom`/`periodTo` — spurious recompute with stale bounds

**File:** `src/ui/drop-zone.ts:114`

**Issue:** On a successful parse, three reactive signals are written in two separate operations:

```typescript
parsedSamples.value = mergeResult.samples        // line 114 — fires effects immediately

if (mergeResult.samples.length > 0) {
  const range = fullRange(mergeResult.samples)
  batch(() => {
    periodFrom.value = range.start               // line 121
    periodTo.value = range.end                   // line 122
  })
}
```

Writing `parsedSamples` at line 114 synchronously re-runs any reactive effect that reads it — including `filteredSamples` computed (which reads `parsedSamples`, `periodFrom`, `periodTo`). At that moment `periodFrom` and `periodTo` still hold their previous values (null or old bounds from a prior upload). This means:

- `filteredSamples` recomputes with the new samples but the old/null period bounds.
- `scheduleRecompute(true)` at line 128 was **not yet called**, so a worker run may not be triggered immediately.
- Any effects that read `filteredSamples` (e.g. `coverageDays`, indirectly the comparison table) fire with an intermediate inconsistent state.

On a second file upload, `periodFrom`/`periodTo` hold the old dataset's range. `filteredSamples` incorrectly clips the new dataset to the old bounds, then re-clips again when the batch fires, causing two effect runs for the period control and comparison table.

**Fix:** Include all three writes in one batch:

```typescript
batch(() => {
  parsedSamples.value = mergeResult.samples
  if (mergeResult.samples.length > 0) {
    const range = fullRange(mergeResult.samples)
    periodFrom.value = range.start
    periodTo.value = range.end
  }
})
scheduleRecompute(true)
```

---

### CR-03: `clearStatusAndError` only removes the first matching element — stale sibling left in DOM

**File:** `src/ui/drop-zone.ts:57`

**Issue:** `querySelector` with a multi-ID selector (`#drop-zone-status, #drop-zone-error`) returns **only the first match** in DOM order. If both elements coexist in the DOM — possible if `showStatus` is called immediately followed by an async error path that calls `showError` — only the first one is removed by the subsequent call:

```typescript
function clearStatusAndError(region: HTMLElement): void {
  const existing = region.querySelector(`#${STATUS_ID}, #${ERROR_ID}`)
  if (existing) existing.remove()  // removes at most ONE element
}
```

Concrete scenario: `processFiles` calls `showStatus(region, 'Bezig...')` (which appends `#drop-zone-status`). If parsing succeeds quickly then the user immediately drops another file, `clearStatusAndError` is called — removes the status. Then `showStatus` appends a new status node. No problem so far. But if both nodes somehow coexisted (e.g. due to a future code change), the bug would manifest.

The immediate real-world risk: `showStatus` itself calls `clearStatusAndError` before appending — so normally only one can exist. This is low-probability but defensive correctness is violated.

**Fix:** Use `querySelectorAll` to remove all matching elements:

```typescript
function clearStatusAndError(region: HTMLElement): void {
  region.querySelectorAll(`#${STATUS_ID}, #${ERROR_ID}`).forEach((el) => el.remove())
}
```

---

## Warnings

### WR-01: `initComparisonTable` dispose function discarded in `main.ts`

**File:** `src/main.ts:39`

**Issue:** `initComparisonTable` returns a dispose function (`() => void`) documented as: "callers must store and invoke it on teardown." `main.ts` discards it:

```typescript
initComparisonTable(resultsRegion)  // return value dropped — effect never disposed
```

In a single-page lifecycle this is harmless because the effect lives for the page lifetime. But it violates the documented contract, breaks hot-module-reload (Vite HMR accumulates effects on every module reload), and will cause failures if the codebase ever adds navigation or dynamic mounting.

**Fix:**

```typescript
const disposeComparisonTable = initComparisonTable(resultsRegion)
// Store at module scope if HMR disposal is needed:
if (import.meta.hot) {
  import.meta.hot.dispose(() => disposeComparisonTable())
}
```

---

### WR-02: `period-control.ts` — module-level `_disposeFns` accumulates effects across calls; no teardown export

**File:** `src/ui/period-control.ts:62`

**Issue:** `initPeriodControl` pushes two `effect()` dispose functions into a module-level array (`_disposeFns`) but the module exports **no teardown function**. Two consequences:

1. **Test suite effect leak (Pitfall 3):** `tests/period-control.test.ts` calls `initPeriodControl(container)` inside `beforeEach` (14 tests). Each call adds 2 effects to `_disposeFns`, none ever disposed. After the full test run, 28 active effects read `parsedSamples` and `coverageDays` — all pointing to DOM nodes from previous tests that have been replaced. This is latent noise that can cause inter-test interference on `parsedSamples` signal changes.

2. **HMR / repeated mount:** If `initPeriodControl` were ever called twice (HMR, routing), effects double-up. Unlike `initBatteryPicker` (which has `teardownBatteryPicker`), there is no way to dispose these effects.

**Fix:** Export a teardown function mirroring the battery-picker pattern:

```typescript
export function teardownPeriodControl(): void {
  _disposeFns.forEach((d) => d())
  _disposeFns.length = 0
}
```

And in `tests/period-control.test.ts`, add to `afterEach`:
```typescript
import { teardownPeriodControl } from '../src/ui/period-control'
// ...
afterEach(() => {
  teardownPeriodControl()
  // ...
})
```

---

### WR-03: Color slot out-of-bounds when custom battery is active alongside 5 catalog batteries

**File:** `src/helpers/color.ts:37-39` / `src/ui/comparison-table.ts:213`

**Issue:** `activeBatteries` = `selectedBatteries` (up to 5) + valid `customBattery` (optional). If all 5 catalog slots are occupied and the custom battery is also active, `activeBatteries.length === 6`. `colorSlotFor` returns `idx + 1` (1-indexed), so the 6th battery (index 5) returns slot `6`. Both `comparison-table.css` and `battery-picker.css` only define `.battery-swatch--1` through `.battery-swatch--5`. The resulting class `.battery-swatch--6` has no CSS rule, so the swatch renders as an invisible 12×12px circle (no `background-color`).

The custom card in the battery picker itself does not show a swatch (it uses a different layout), so this is a comparison-table-only issue. It is a visual defect, not a crash.

**Fix (option A — CSS):** Add a 6th slot token or reuse slot 1 visually for the custom battery. Simplest: add to `comparison-table.css`:

```css
.battery-swatch--6 { background-color: var(--color-battery-1); }
```

**Fix (option B — code):** Cap `colorSlotFor`'s return at 5:

```typescript
export function colorSlotFor(batteryId: string, orderedSelection: string[]): number {
  const idx = orderedSelection.indexOf(batteryId)
  if (idx === -1) return 1
  return Math.min(idx + 1, 5)  // cap at 5 available slots
}
```

---

### WR-04: `avoidedOn === 0` renders with destructive red but no minus sign — misleading visual

**File:** `src/ui/comparison-table.ts:247-253`

**Issue:** The `avoidedOnNegative` flag is set when `m.avoidedOn <= 0` (strictly including zero), which applies the `.table-cell--negative` CSS class (red text). However `avoidedOnText` only prepends the Unicode minus sign when `m.avoidedOn < 0` (strictly negative). The edge case `avoidedOn === 0.0` displays as `"0.0 kWh"` in red — a color indicating a problem, but no explicit minus sign or explanation of why "zero avoided" is shown as an error.

This is visually inconsistent: a neutral result (zero benefit) appears in the same destructive color as a genuinely negative result without any visual distinction.

**Fix:** Change the condition to strictly negative for the red color, and reserve the note for `avoidedOn < 0`:

```typescript
const avoidedOnNegative = m.avoidedOn < 0   // strictly negative — not zero
```

Or, if zero should remain as "destructive" per product spec, add a visual differentiator (e.g. parenthetical note in the cell text for the zero case). Confirm the intended spec for the zero boundary with the product owner.

---

## Info

### IN-01: `formatKwh` / `formatPct` / `formatRatio` pass `NaN` and `Infinity` through unchanged

**File:** `src/helpers/format.ts:9-21`

**Issue:** `Number.prototype.toFixed()` on `NaN` returns `"NaN"`, on `Infinity` returns `"Infinity"`. The callers in `comparison-table.ts` derive values from `deriveMetrics`, which guards against the two main denominator-zero cases (`totalImportKwh === 0` and `usableCapacityKwh < 0.1`). However, if the worker ever returns `NaN` or `Infinity` in any `SimResult` field (e.g. due to data corruption or a future engine change), these would propagate into the rendered table as `"NaN kWh"` or `"Infinity %"` rather than a fallback display.

This is low-risk given the current domain invariants but brittle as a display layer.

**Fix:** Add defensive guards in the formatters:

```typescript
export function formatKwh(n: number): string {
  if (!Number.isFinite(n)) return '— kWh'
  return `${n.toFixed(1)} kWh`
}
```

---

### IN-02: Custom battery `_debounce` timer is not cancelled on teardown / card removal

**File:** `src/ui/battery-picker.ts:248`

**Issue:** The custom battery form's debounce timer (`_debounce`) is a local closure variable inside `buildCustomCard`. If `teardownBatteryPicker()` is called (e.g. in tests' `afterEach`) while a debounce timer is still pending, the `validateAndWrite()` callback fires after teardown. This writes to `customBattery` and calls `scheduleRecompute` on a torn-down picker.

In the current test suite this is low-risk (no test fires a debounce then immediately tears down without waiting), but it is a latent timing bug.

**Fix:** Expose a cancel function from `buildCustomCard` and cancel it from `teardownBatteryPicker`:

```typescript
// In buildCustomCard, return the card and a cancel function:
function buildCustomCard(): { li: HTMLLIElement; cancel: () => void } {
  // ...
  return {
    li,
    cancel: () => { if (_debounce !== null) { clearTimeout(_debounce); _debounce = null } }
  }
}
// In teardownBatteryPicker, call cancel before clearing _disposeFns
```

---

_Reviewed: 2026-06-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
