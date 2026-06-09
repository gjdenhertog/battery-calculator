---
phase: 03-battery-simulator-and-curated-catalog
plan: 02
subsystem: domain
tags: [typescript, battery-simulator, dispatch-engine, vitest, tdd, pure-function]

# Dependency graph
requires:
  - phase: 03-battery-simulator-and-curated-catalog
    plan: 01
    provides: "BatteryConfig, TraceRow, SimResult, SimOptions interfaces in src/domain/types.ts; BATTERY_CATALOG"
provides:
  - "simulate(samples, config, options?) → SimResult — pure per-interval battery dispatch engine (SIM-01..05)"
  - "intervalHoursFor() — timestamp-delta interval duration helper (D-05)"
  - "InvalidBatteryConfigError — Dutch-message error for out-of-range custom configs (T-03-03)"
  - "tests/simulate.test.ts — 16 hand-computed fixtures locking all arithmetic conventions"
affects:
  - "03-03 (compare.ts imports simulate from ./simulate; fixtures use the same types)"
  - "04 (Phase 4 wraps simulate in a Comlink worker)"
  - "05 (Phase 5 reads SimResult.trace for charting)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convention A: socKwh = energy in cell (post-charge-loss, pre-discharge-loss); sqrt(rte) applied symmetrically each way (SIM-03)"
    - "chargedKwh in TraceRow is grid-side (before cell efficiency loss) — matches criterion 2: 2.2 kW × 0.25 h = 0.55 kWh (A-1)"
    - "intervalHoursFor() mirrors merge.ts inferDominantCadence: median inter-sample delta, first sample uses next delta as fallback (D-05)"
    - "coarseCadenceWarning fires when medianIntervalMinutes > threshold (default 60 min) — D-04 honesty flag"
    - "InvalidBatteryConfigError extends Error with Dutch message + this.name set (T-03-03 threat mitigation)"
    - "Empty initial SoC = 0 (D-06); net-within-interval balance: net = gridExportKwh - gridImportKwh (D-07)"
    - "Hard cap: soc clamped to nominalCapacityKwh × dodFraction (SIM-04); float underrun guard: if soc < 0, soc = 0"

key-files:
  created:
    - src/domain/simulate.ts
    - tests/simulate.test.ts
  modified: []

key-decisions:
  - "Convention A locked: socKwh = energy physically in cell; criterion 3's ~4.269 only falls out when the 4.5 kWh capacity cap pins SoC before discharge applies sqrt(rte)"
  - "chargedKwh is grid-side (A-1): the 2.2 kW clamp applies to the grid flow before efficiency loss, so criterion 2 produces 0.55 kWh exactly"
  - "periodDays computed from (last.timestamp - first.timestamp) / 86_400_000; returns 0 for single-sample and empty inputs"
  - "InvalidBatteryConfigError (Dutch message) replaces NaN propagation for out-of-range custom BatteryConfig (T-03-03)"

patterns-established:
  - "simulate.ts pure-domain header convention followed: filename, requirement IDs, 'Pure function — no browser globals' tagline, numbered Algorithm"
  - "Only imports from './types' — no cadenceMinutes/ParseFileResult/merge coupling (D-05 anti-pattern avoided)"

requirements-completed: [SIM-01, SIM-02, SIM-03, SIM-04, SIM-05, BATT-04, BATT-05]

# Metrics
duration: 4min
completed: 2026-06-09
---

# Phase 3 Plan 02: Battery Dispatch Simulator Summary

**Pure per-interval battery dispatch engine simulate() with Convention A sqrt(rte) physics, DoD cap, power clamping, and 16 hand-computed Vitest fixtures locked GREEN**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-09T14:49:40Z
- **Completed:** 2026-06-09T14:54:01Z
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files modified:** 2

## Accomplishments

- Created `tests/simulate.test.ts` in RED state: 16 hand-computed fixtures covering all nine behaviors from the plan (power clamp, round-trip/DoD, DoD cap invariant, multi-day no-export, coarse cadence, interval duration fallback, discharge clamp independence, custom config, one-week aggregate + malformed-config throws)
- Created `src/domain/simulate.ts`: pure dispatch engine with Convention A physics, `intervalHoursFor()` duration helper, `InvalidBatteryConfigError` for range validation
- All 155 project tests pass (139 pre-existing + 16 new); `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the hand-computed simulate fixture suite (RED)** - `26441ca` (test)
2. **Task 2: Implement simulate() + intervalHoursFor() to make the suite GREEN** - `1a45c4d` (feat)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test(...)) | 26441ca | PASSED — suite fails with "Cannot find module" before implementation |
| GREEN (feat(...)) | 1a45c4d | PASSED — all 16 fixtures pass, tsc clean |
| REFACTOR | not needed | N/A — code is clean as written |

## Files Created/Modified

- `src/domain/simulate.ts` — New file (261 lines). `InvalidBatteryConfigError`, `intervalHoursFor()`, `simulate()`. Imports only from `./types`. Pure function header with Algorithm block.
- `tests/simulate.test.ts` — New file (413 lines). 16 fixtures including criterion-2 (0.55 kWh), criterion-3 (4.269 kWh capacity-clamped), multi-day no-export, coarse-cadence, interval-duration fallback, discharge-clamp independence, custom config identity, one-week aggregate, and invalid-config throws.

## Decisions Made

- Convention A locked: `socKwh` stores energy physically in the cell (post-charge-loss). This is the only interpretation that correctly produces the criterion-3 result (~4.269 kWh delivered) when the 4.5 kWh usable cap pins SoC before the discharge sqrt leg.
- `chargedKwh` in TraceRow is grid-side (before cell efficiency loss). This matches criterion 2: a 2.2 kW charger over 0.25 h draws 0.55 kWh from the grid perspective, even if less lands in the cell.
- `InvalidBatteryConfigError` (Dutch message, `this.name` set) throws on out-of-range custom config fields (nominalCapacityKwh <= 0, dodFraction outside (0,1], roundTripEfficiency outside (0,1], powers < 0) — never propagates NaN (T-03-03).
- `periodDays = (last.timestamp - first.timestamp) / 86_400_000`; returns 0 for empty or single-sample input.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no new dependencies; pure TypeScript.

## Next Phase Readiness

- `simulate()` is fully implemented and tested; plan 03-03 can import it for `runComparison`
- All Phase 3 type contracts still intact; types.ts is unchanged
- No blockers for 03-03 (compare.ts + runComparison)

## Known Stubs

None — `simulate()` is fully implemented; all aggregates and trace fields are computed from real physics. No placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns. The only trust boundary is the custom BatteryConfig input, which is now range-checked at the `simulate()` entry point (T-03-03 mitigated).

## Self-Check: PASSED

- src/domain/simulate.ts: FOUND (contains `export function simulate`, `intervalHoursFor`, `InvalidBatteryConfigError`, "Pure function — no browser globals, safe to run in a Node environment.")
- tests/simulate.test.ts: FOUND (contains `toBeCloseTo`, all required test names: "power clamp", "round-trip", "DoD cap", "coarse cadence", "interval duration", "custom")
- Commit 26441ca: FOUND (test(03-02): add failing simulate fixture suite)
- Commit 1a45c4d: FOUND (feat(03-02): implement simulate())
- npm test: 155 tests pass across 13 test files
- npx tsc --noEmit: exits 0

---
*Phase: 03-battery-simulator-and-curated-catalog*
*Completed: 2026-06-09*
