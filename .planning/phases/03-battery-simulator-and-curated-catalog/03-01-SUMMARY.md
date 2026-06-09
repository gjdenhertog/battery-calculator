---
phase: 03-battery-simulator-and-curated-catalog
plan: 01
subsystem: domain
tags: [typescript, battery-catalog, types, domain-contracts, vitest]

# Dependency graph
requires:
  - phase: 02-csv-parsers-and-data-pipeline
    provides: "IntervalSample, ParseFileResult, MergeResult types in src/domain/types.ts; pure domain pattern established"
provides:
  - "BatteryConfig, TraceRow, SimResult, SimOptions interfaces exported from src/domain/types.ts (Phase 4/5 contract)"
  - "BATTERY_CATALOG: readonly BatteryConfig[] with 7 NL entries, Sessy 5 kWh first/default"
  - "tests/catalog.test.ts: contract-locking test (5 assertions, BATT-01..03)"
affects:
  - "03-02 (simulate.ts imports BatteryConfig, SimResult, SimOptions, TraceRow from types.ts)"
  - "03-03 (compare.ts imports SimResult; fixtures use BATTERY_CATALOG)"
  - "04 (Phase 4 UI imports BATTERY_CATALOG and SimResult)"
  - "05 (Phase 5 imports same types for charting)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BatteryConfig stores nominalCapacityKwh + dodFraction separately so simulator derives usable = nominal x dod (D-08)"
    - "dodFraction = 1.0 when vendor quotes usable capacity (Sessy/Tesla/Huawei) — no double-discount (Pitfall 2)"
    - "chargedKwh in TraceRow is grid-side (before efficiency loss) to match criterion 2 (A-1)"
    - "coarseCadenceWarning in SimResult flags hourly/daily data where intra-hour peaks cannot be resolved (D-04)"
    - "BATTERY_CATALOG is readonly as const TypeScript export — compile-time BatteryConfig shape validation (BATT-02)"

key-files:
  created:
    - src/domain/battery-catalog.ts
    - tests/catalog.test.ts
  modified:
    - src/domain/types.ts

key-decisions:
  - "chargedKwh is grid-side (not cell-side) to match criterion 2: 2.2 kW x 0.25 h = 0.55 kWh (A-1)"
  - "dodFraction = 1.0 for Sessy/Tesla/Huawei because they quote usable capacity on their datasheets (D-08 Pitfall 2)"
  - "coarseCadenceThresholdMinutes defaults to 60 minutes in SimOptions (SimResult.coarseCadenceWarning fires for hourly or coarser data)"
  - "BATTERY_CATALOG ships as .ts typed export (not .json) for compile-time BatteryConfig shape validation"

patterns-established:
  - "Phase 3 type pattern: four interfaces (BatteryConfig, TraceRow, SimResult, SimOptions) appended to the existing root types.ts, not a new file"
  - "Catalog pattern: readonly as const typed array with pure-data file header documenting usable-vs-DoD convention"

requirements-completed: [BATT-01, BATT-02, BATT-03]

# Metrics
duration: 3min
completed: 2026-06-09
---

# Phase 3 Plan 01: Battery Type Contracts and Curated Catalog Summary

**BatteryConfig/TraceRow/SimResult/SimOptions interfaces exported from types.ts, plus a 7-entry NL battery catalog with Sessy 5 kWh as default, locked by a 5-assertion contract test**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-09T14:44:04Z
- **Completed:** 2026-06-09T14:46:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended src/domain/types.ts with four Phase 3 interfaces (BatteryConfig, TraceRow, SimResult, SimOptions) — the locked contract consumed by plans 02/03 and Phases 4/5
- Created src/domain/battery-catalog.ts with 7 curated NL battery entries (Sessy 5 kWh first/default, per BATT-03), documented usable-vs-DoD convention
- Created tests/catalog.test.ts with 5 assertions covering entry count (6-8), Sessy-first, all physics fields, unique IDs, datasheetUrl URL format
- All 139 tests pass (12 test files); tsc --noEmit exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types.ts with the Phase 3 contract interfaces** - `76b6664` (feat)
2. **Task 2: Create the curated battery catalog and its contract test** - `51b1bf9` (feat)

## Files Created/Modified
- `src/domain/types.ts` — Four new interfaces appended: BatteryConfig (8 fields), TraceRow (6 fields), SimResult (9 fields + trace: TraceRow[]), SimOptions (1 optional field). IntervalSample and all Phase 2 interfaces untouched.
- `src/domain/battery-catalog.ts` — New file. 7-entry BATTERY_CATALOG as const: Sessy 5, Sessy 10, Zonneplan 10, Tesla Powerwall 3, Huawei LUNA2000-5-S0, Victron ESS, Marstek Venus E. Pure data header documents usable-vs-DoD convention and CSP no-fetch constraint.
- `tests/catalog.test.ts` — New file. Contract test: entry count 6-8, Sessy-5 at index 0, all five physics fields + datasheetUrl per entry, unique IDs, dodFraction = 1.0 for usable-quoting vendors.

## Decisions Made
- chargedKwh in TraceRow is grid-side (before cell efficiency loss), matching criterion 2 (A-1): a 2.2 kW charger over 0.25 h = 0.55 kWh from the grid perspective
- dodFraction = 1.0 for Sessy, Tesla Powerwall 3, and Huawei LUNA2000 because those vendors quote usable capacity on their datasheets; no additional DoD reduction (D-08 Pitfall 2)
- Zonneplan (0.95), Victron (0.90), Marstek (0.95) use sub-1.0 dodFraction as they quote gross/nominal capacity
- coarseCadenceThresholdMinutes defaults to 60 min: hourly or coarser data triggers coarseCadenceWarning (D-04)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All Phase 3 type contracts are in place; plans 02 and 03 can import BatteryConfig, SimResult, SimOptions, TraceRow from src/domain/types.ts and BATTERY_CATALOG from src/domain/battery-catalog.ts without exploring the codebase
- No blockers for 03-02 (simulate.ts) or 03-03 (compare.ts)

## Known Stubs
None — all fields are populated with real catalog data; no placeholder values.

## Threat Flags
None — this plan creates only static TypeScript declarations and compile-time data. No network endpoints, auth paths, file access, or trust boundary crossings were introduced.

## Self-Check: PASSED
- src/domain/types.ts: FOUND (contains BatteryConfig, TraceRow, SimResult, SimOptions, IntervalSample)
- src/domain/battery-catalog.ts: FOUND (BATTERY_CATALOG with 7 entries, sessy-5 at index 0)
- tests/catalog.test.ts: FOUND (5 tests, all passing)
- Commit 76b6664: FOUND (feat(03-01): extend types.ts)
- Commit 51b1bf9: FOUND (feat(03-01): add curated NL battery catalog)

---
*Phase: 03-battery-simulator-and-curated-catalog*
*Completed: 2026-06-09*
