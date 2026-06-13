---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
plan: 06
subsystem: ui
tags: [preact-signals, comparison-table, saldering, comlink, worker, vite, vitest]

# Dependency graph
requires:
  - phase: 04-01
    provides: Comlink sim-worker setup + app-state signals (simResults, activeBatteries, isComputing, computeError)
  - phase: 04-04
    provides: initBatteryPicker() — battery spec-card picker component
  - phase: 04-05
    provides: initPeriodControl() + initComparisonTable() — period narrowing + reactive table renderer

provides:
  - Full Phase 4 UI integration: picker + period control + comparison table mounted in the correct shell regions
  - Worker-chunk emission confirmed in dist/assets/ (A3 assumption re-asserted with real import graph)
  - Length-mismatch race condition guard in comparison-table effect
  - Human-verified end-to-end browser walkthrough (zero CSP/network violations, interactive compute, consistent color)

affects: [05-charts, phase-5-charts, future-ui-refinement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Null-guarded init calls: resolve shell region by ID, call init only if non-null"
    - "CSS imported in main.ts alongside JS init (not in global.css @import) for explicit co-location"
    - "Effect-level length-mismatch guard: keep stale table + show Rekenen indicator when results.length !== batteries.length"
    - "Defensive renderTable skip: i >= results.length belt-and-suspenders guard"

key-files:
  created: []
  modified:
    - src/main.ts
    - src/ui/comparison-table.ts
    - tests/comparison-table.test.ts

key-decisions:
  - "CSS files imported directly in main.ts (not via global.css @import) to co-locate style imports with their JS init counterparts"
  - "Length-mismatch race handled at effect level (guard + return) rather than in renderTable, keeping renderTable a pure rendering function"
  - "Defensive renderTable per-row guard added as belt-and-suspenders even though the effect-level guard is the primary defence"

patterns-established:
  - "Integration wiring in main.ts: initDropZone + initBatteryPicker share #drop-zone-region; initPeriodControl + initComparisonTable share #results-region"
  - "Worker self-initialization: importing any UI module that touches app-state transitively pulls in the Comlink sim-worker singleton"

requirements-completed: [SIM-07, SIM-08, COMP-04, COMP-08]

# Metrics
duration: approx 45min
completed: 2026-06-13
---

# Phase 4 Plan 06: Full UI Integration Summary

**Phase 4 UI wired end-to-end in main.ts: battery picker + period control + comparison table mounted in the correct shell regions, Comlink sim-worker chunk confirmed in dist/assets/, and a length-mismatch race condition caught and fixed during live verification.**

## Performance

- **Duration:** approx 45 min
- **Started:** 2026-06-13T (estimated)
- **Completed:** 2026-06-13
- **Tasks:** 2 (Task 1 auto + Task 2 human-verify approved)
- **Files modified:** 3

## Accomplishments

- Wired `initBatteryPicker`, `initPeriodControl`, and `initComparisonTable` into `src/main.ts` with null-guards; picker mounts in `#drop-zone-region`, table + period control fill `#results-region`
- Imported all three Phase 4 CSS files (`battery-picker.css`, `comparison-table.css`, `results-region.css`) directly in `main.ts` for explicit co-location with their init calls
- Re-asserted A3 (sim-worker chunk) with `npm run build`: `dist/assets/sim-worker-DazZ4rAZ.js` emits correctly now that the full import graph reaches `new SimWorker()`
- Caught and fixed a length-mismatch render race in `initComparisonTable` during live verification (selecting a second battery crashed with "reading 'shiftedKwh'" before the fix); added effect-level guard + defensive `renderTable` skip + 2 regression tests
- Human-verify checkpoint approved: zero CSP/network violations, Sessy 5 pre-selected on load, zonder/met saldering columns correct, leaders highlighted, negatives shown as-is with U+2212 minus, cadence banner present on daily data, "Rekenen..." indicator visible without UI lock, consistent per-battery swatch color across picker and table

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire main.ts + global.css imports + re-assert worker chunk build** - `75a4bec` (feat)
2. **Task 1 (deviation fix): Guard comparison table against length mismatch race** - `6752a20` (fix)

**Task 2 (human-verify):** No code commit — human walkthrough approved live.

## Files Created/Modified

- `src/main.ts` — Added `initBatteryPicker(dropZoneRegion)` after `initDropZone`; added `initPeriodControl` + `initComparisonTable` against `#results-region`; imported all 3 Phase 4 CSS files
- `src/ui/comparison-table.ts` — Added effect-level `results.length !== batteries.length` guard (keeps stale table + shows "Rekenen..." until simResults catches up); added defensive per-row `i >= results.length` skip in `renderTable`
- `tests/comparison-table.test.ts` — Added 2 regression tests covering the length-mismatch guard: (a) no crash when batteries outnumber results, (b) stale table retained + indicator shown

## Decisions Made

- CSS imported in `main.ts` directly (not via `global.css @import`) so CSS and its corresponding `init*()` call are co-located in the same file — makes the integration boundary obvious
- Length-mismatch race handled at the effect level rather than inside `renderTable` — `renderTable` stays a pure rendering function that asserts its inputs are aligned; the effect is the appropriate layer for signal-timing concerns
- A3 confirmation strategy: run `npm run build && ls dist/assets | grep -iE worker` after wiring, not before — the chunk only emits when the import graph reaches `new SimWorker()`, which required the actual wiring to be in place

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Length-mismatch render race in initComparisonTable**
- **Found during:** Task 2 (live human-verify walkthrough)
- **Issue:** Selecting a second battery caused `activeBatteries` signal to update synchronously, re-running the comparison-table effect with the new battery list BEFORE `simResults` was updated by the worker. The effect called `buildBatteryRow(battery, results[i], ...)` with `results[i]` undefined, crashing with "Cannot read properties of undefined (reading 'shiftedKwh')".
- **Root cause:** Preact signals batch signal reads in the effect, but `selectedBatteries → activeBatteries` and `simResults` are separate signals updated at different times (UI toggle vs. worker postMessage roundtrip). The effect saw the new battery count before the new result array arrived.
- **Fix:** Added a guard at the top of the rendering path: `if (results.length !== batteries.length) { renderComputeIndicator(container); return }`. Also added a defensive per-row guard in `renderTable`: `if (i >= results.length) return`. Two regression tests added.
- **Files modified:** `src/ui/comparison-table.ts`, `tests/comparison-table.test.ts`
- **Verification:** `npm test -- --run` = 290 tests passing; multi-battery rapid select/deselect confirmed stable in live walkthrough
- **Committed in:** `6752a20` (fix(04-06): guard comparison table against a transient results/battery length mismatch)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Fix was necessary for correctness. The race condition is intrinsic to the two-signal architecture (selectedBatteries + simResults); the guard is the correct layer to handle it. No scope creep.

## Issues Encountered

- A3 assumption (worker chunk emitting) had only been asserted in 04-01 when the worker was present-but-unimported. After real wiring in main.ts, the build step was the critical gate — it passed cleanly with `sim-worker-DazZ4rAZ.js` visible in `dist/assets/`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 4 integration complete: all four Phase 4 UI modules mounted, signals wired, worker confirmed, and browser-verified
- Phase 5 (charts) can read `simResults`, `activeBatteries`, and the `colorSlotFor` helper directly — color-slot assignment is stable (selection-order-based, consistent between picker swatch and table row)
- The `data-battery-id` and `data-metric` hooks placed on table rows and cells (D-12) are ready for Phase 5 chart-to-table coordination
- No known blockers

---
*Phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo*
*Completed: 2026-06-13*
