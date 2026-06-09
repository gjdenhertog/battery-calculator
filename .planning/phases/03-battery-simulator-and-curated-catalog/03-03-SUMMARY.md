---
phase: 03-battery-simulator-and-curated-catalog
plan: 03
subsystem: domain
tags: [typescript, compare, aggregator, tdd, vitest, pure-function]

# Dependency graph
requires:
  - phase: 03-battery-simulator-and-curated-catalog
    plan: 02
    provides: "simulate(samples, config, options?) → SimResult in src/domain/simulate.ts"
  - phase: 03-battery-simulator-and-curated-catalog
    plan: 01
    provides: "BatteryConfig, SimResult, SimOptions, IntervalSample types; BATTERY_CATALOG"
provides:
  - "runComparison(samples, batteries, options?) → SimResult[] — order-preserving fan-out over simulate() (SIM-06)"
  - "tests/compare.test.ts — 8 assertions: order-preservation, mixed catalog/custom, empty, no-mutation"
affects:
  - "04 (Phase 4 wraps runComparison in a Comlink worker to drive the comparison table)"
  - "05 (Phase 5 reads SimResult.trace from each battery for charting)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runComparison is a single batteries.map((b) => simulate(samples, b, options)) — order preserved by construction (SIM-06)"
    - "No battery-count cap in domain layer — BATT-05 is a Phase 4 UI concern; documented in compare.ts header"
    - "Custom BatteryConfig mixes freely with BATTERY_CATALOG entries — same shape, same simulate() path (D-10)"
    - "TDD gate: RED commit (test) before GREEN commit (feat) — strict gate order"

key-files:
  created:
    - src/domain/compare.ts
    - tests/compare.test.ts

key-decisions:
  - "runComparison delegates all validation to simulate() — a malformed custom BatteryConfig throws InvalidBatteryConfigError there (T-03-05 delegated)"
  - "No length cap added — BATT-05 cap is enforced in Phase 4 UI only; test asserts engine is uncapped"
  - "Order-preservation verified with distinguishable shiftedKwh values (Sessy-5 vs tiny-1kWh) so trivial all-zeros impl would fail"

requirements-completed: [SIM-06, BATT-05]

# Metrics
duration: 3min
completed: 2026-06-09
---

# Phase 3 Plan 03: runComparison Aggregator Summary

**Thin order-preserving batteries.map() over simulate() with 8-fixture Vitest suite GREEN — completes the Phase 3 domain layer**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-09
- **Completed:** 2026-06-09
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Created `tests/compare.test.ts` in RED state: 8 fixtures covering order-preservation (SIM-06), mixed [catalog, catalog, custom] input (ROADMAP criterion 6), distinguishable shiftedKwh values, empty batteries returns [], empty samples yields all-zero SimResults, and no-mutation assertions for both input arrays
- Created `src/domain/compare.ts`: pure single-line aggregator `return batteries.map((b) => simulate(samples, b, options))` with correct block-comment header including BATT-05-deferred note and "Pure function — no browser globals" tagline
- All 163 project tests pass (155 pre-existing + 8 new); `npx tsc --noEmit` exits 0
- Full Phase 3 domain suite (catalog + simulate + compare) plus all Phase 1/2 suites pass from clean node env (ROADMAP criterion 4)

## Task Commits

Each TDD gate committed atomically:

1. **RED: Add failing runComparison fixture suite** - `ed67e5b` (test)
2. **GREEN: Implement runComparison()** - `bae93aa` (feat)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test(...)) | ed67e5b | PASSED — suite fails with "Cannot find module" before implementation |
| GREEN (feat(...)) | bae93aa | PASSED — all 8 fixtures pass, tsc clean |
| REFACTOR | not needed | N/A — single-expression function, no cleanup required |

## Files Created/Modified

- `src/domain/compare.ts` — New file (32 lines). `runComparison()` implemented as `batteries.map((b) => simulate(samples, b, options))`. Pure-domain block-comment header documents SIM-06, BATT-05-deferred Phase 4 note, and "Pure function — no browser globals" tagline. Imports only from `./simulate` and `./types`.
- `tests/compare.test.ts` — New file (147 lines). 8 fixtures: index-alignment with `toBeCloseTo` precision 9, distinguishable shiftedKwh (Sessy-5 vs custom 1 kWh), mixed [catalog, catalog, custom] array, empty batteries → [], empty samples → all-zero SimResults, no-mutation for samples and batteries arrays, single-battery alignment.

## Decisions Made

- Delegated BatteryConfig validation entirely to `simulate()`: a malformed custom config throws `InvalidBatteryConfigError` there (T-03-05 disposition: delegated)
- No length cap added to `runComparison` — BATT-05 cap is enforced in Phase 4 UI only; the test explicitly asserts the engine is uncapped by exercising arrays of multiple batteries
- Used distinguishable battery specs in fixtures (Sessy-5 kWh vs custom-tiny 1 kWh with 0.5 kW power limits) so per-index alignment is observable via shiftedKwh, not trivially true

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no new dependencies; pure TypeScript.

## Next Phase Readiness

- `runComparison()` is fully implemented and tested; Phase 4 can import it from `src/domain/compare` and wrap it in a Comlink worker
- All Phase 3 domain types remain intact; types.ts and battery-catalog.ts are unchanged
- Full Phase 3 suite (14 test files, 163 tests) passes from clean node env — ROADMAP criterion 4 satisfied

## Known Stubs

None — `runComparison()` is fully implemented; the thin `.map` over a complete `simulate()` engine produces real results. No placeholder values.

## Threat Flags

None — `runComparison` is a pure thin wrapper. It adds no new trust boundaries, network endpoints, auth paths, or file access patterns. The only trust boundary (malformed battery input) is already mitigated by `simulate()`'s `InvalidBatteryConfigError` (T-03-05 delegated, T-03-06 accepted per plan threat register).

## Self-Check: PASSED
- src/domain/compare.ts: FOUND (exports `runComparison`, contains "Pure function — no browser globals, safe to run in a Node environment.", BATT-05 deferred note)
- tests/compare.test.ts: FOUND (8 tests, all passing; contains "runComparison", "ROADMAP criterion 6", no-mutation assertions)
- Commit ed67e5b: FOUND (test(03-03): add failing runComparison fixture suite)
- Commit bae93aa: FOUND (feat(03-03): implement runComparison())
- npm test: 163 tests pass across 14 test files
- npx tsc --noEmit: exits 0

---
*Phase: 03-battery-simulator-and-curated-catalog*
*Completed: 2026-06-09*
