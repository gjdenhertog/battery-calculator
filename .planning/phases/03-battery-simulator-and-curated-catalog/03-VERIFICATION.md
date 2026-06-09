---
phase: 03-battery-simulator-and-curated-catalog
verified: 2026-06-09T17:05:00Z
status: gaps_found
score: 10/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "simulate() produces correct residualImportKwh and residualExportKwh for mixed intervals (both gridImportKwh > 0 and gridExportKwh > 0 in the same sample)"
    status: failed
    reason: "CR-01 (code review finding): in the charge branch, simulate.ts line 218 hard-sets residualImport = 0 regardless of whether real grid import existed in the interval. In a mixed interval (e.g. import=2, export=3), net=+1 routes to the charge path and the real 2 kWh of grid import is silently deleted from residualImportKwh. Confirmed by a probe test: residualImportKwh is 0 (actual) vs 2 (expected). This breaks the SimResult invariant documented in types.ts lines 250-253 ('residualImportKwh/residualExportKwh are the honest what-would-remain totals'). No test exercises a both-nonzero interval; the default sample() helper in tests uses 0.1/0.05 but no fixture asserts residual conservation on those rows."
    artifacts:
      - path: "src/domain/simulate.ts"
        issue: "Line 218: residualImport = 0 unconditionally in the charge branch; line 229: residualExport = 0 unconditionally in the discharge branch. Both should preserve the non-dominant flow."
      - path: "tests/simulate.test.ts"
        issue: "No test fixture uses a sample with both gridImportKwh > 0 and gridExportKwh > 0 and then asserts residual conservation. The gap is invisible to the suite."
    missing:
      - "Fix simulate.ts: in the charge branch, set residualImport = s.gridImportKwh (preserve real import) and residualExport = s.gridExportKwh - gridSideCharge. In the discharge branch, set residualExport = s.gridExportKwh (preserve real export) and residualImport = s.gridImportKwh - delivered (net demand minus delivered)."
      - "Add a test in tests/simulate.test.ts with a sample where both gridImportKwh > 0 and gridExportKwh > 0, asserting that residualImportKwh + residualExportKwh accounts for all original grid energy minus the battery action (energy conservation)."
---

# Phase 3: Battery Simulator and Curated Catalog — Verification Report

**Phase Goal:** A pure `simulate(samples, batteryConfig, options) → SimResult` function with verified correctness on hand-computed fixtures, plus a curated catalog of ~6–10 NL batteries with datasheet-cited specs. No UI; proven correct via Vitest only.
**Verified:** 2026-06-09T17:05:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `simulate(samples, batteryConfig, options) → SimResult` exists in `src/domain/` with zero browser/DOM dependencies | ✓ VERIFIED | `src/domain/simulate.ts` exports `simulate()`. Single import from `./types`. Header contains "Pure function — no browser globals, safe to run in a Node environment." `npm test` passes in Node env without jsdom. |
| 2 | Power clamping: a 2.2 kW charger over a 0.25 h slot charges 0.55 kWh, not the full 1.5 kWh surplus | ✓ VERIFIED | Test "power clamp — small battery cant catch the peak (criterion 2)" asserts `trace[1].chargedKwh toBeCloseTo(0.55, 3)` and `trace[1].residualExportKwh toBeCloseTo(0.95, 3)`. Passes green. |
| 3 | 5 kWh nominal @ 90% DoD never stores more than 4.5 kWh; sqrt(rte) applied symmetrically each way | ✓ VERIFIED | Test "round-trip — DoD cap + sqrt(rte) each way (criterion 3)" asserts `dischargedKwh toBeCloseTo(4.269, 2)` and `maxSoc <= 4.5 + 1e-9`. "DoD cap — socKwh never exceeds nominal×dod across all intervals" adds CRIT3 invariant check. Both green. |
| 4 | Multi-day no-export dataset shifts 0 kWh (empty-SoC conservatism, D-06) | ✓ VERIFIED | Test "multi-day no-export — battery never discharges phantom energy (D-06)" asserts `shiftedKwh === 0`, all SoC = 0, residualImport = total import. Green. |
| 5 | Daily-cadence data sets coarseCadenceWarning = true; 15-min does not (D-04) | ✓ VERIFIED | Tests "coarse cadence — daily-cadence samples set coarseCadenceWarning true" and "…15-min samples do NOT set coarseCadenceWarning". Both green. |
| 6 | Custom BatteryConfig runs through simulate() identically to a catalog entry (BATT-04) | ✓ VERIFIED | Test "custom — a custom BatteryConfig runs identically to an equivalent catalog entry" compares all aggregates with `toBeCloseTo(_, 6)`. Green. |
| 7 | `runComparison(samples, batteries, options)` returns one SimResult per battery in input order, uncapped (SIM-06) | ✓ VERIFIED | `src/domain/compare.ts` implements `batteries.map((b) => simulate(samples, b, options))`. Tests assert length preservation, per-index alignment, empty→[], and no mutation. Green. |
| 8 | Catalog ships 6–8 NL batteries with Sessy 5 kWh first; all five physics fields + datasheetUrl per entry | ✓ VERIFIED | `src/domain/battery-catalog.ts` has 7 entries, sessy-5 at index 0. Catalog test asserts count (6–8), first id, all physics fields, unique IDs, dodFraction=1.0 for usable-quoting vendors. Green. |
| 9 | Hand-computed one-week fixture matches expected aggregates within toBeCloseTo(_, 3) | ✓ VERIFIED | Test "one-week aggregate — hand-computed shiftedKwh/residualImport/residualExport" with five intervals, all assertions green: shiftedKwh≈1.8, residualImport≈0.5, residualExport≈0.0. |
| 10 | simulate() correctly handles single-sample, 2-sample, and empty inputs without NaN | ✓ VERIFIED | Three "interval duration" tests cover empty, single, and 2-sample inputs. All pass, no NaN. |
| 11 | simulate() produces correct residualImportKwh/residualExportKwh for mixed intervals (both import > 0 and export > 0 in same sample) | ✗ FAILED | CR-01 confirmed live: probe test shows `residualImportKwh = 0` when a mixed interval with import=2, export=3 is fed to simulate(). The charge branch sets `residualImport = 0` unconditionally (line 218), silently deleting real grid import. No test covers this case. |

**Score:** 10/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/domain/types.ts` | BatteryConfig, TraceRow, SimResult, SimOptions interfaces | ✓ VERIFIED | All four interfaces present. BatteryConfig (8 fields), TraceRow (6 fields), SimResult (9 fields + trace), SimOptions (1 optional field). IntervalSample unchanged. |
| `src/domain/battery-catalog.ts` | BATTERY_CATALOG typed array, Sessy 5 first | ✓ VERIFIED | 7-entry `readonly BatteryConfig[]` as const. sessy-5 at index 0. Pure-data header with usable-vs-DoD convention. 93 lines — substantive. |
| `tests/catalog.test.ts` | Catalog shape + Sessy-first + datasheet-URL assertions | ✓ VERIFIED | 5 tests covering count, default, physics fields, unique IDs, dodFraction for usable-quoting vendors. |
| `src/domain/simulate.ts` | simulate() pure dispatch engine + intervalHoursFor() | ✓ VERIFIED (defective for mixed intervals) | 261 lines. Exports `simulate()`, `InvalidBatteryConfigError`. Imports only from `./types`. Correctly implements power clamping, DoD cap, sqrt(rte), empty-SoC start. Defect: residual accounting in mixed intervals (CR-01). |
| `tests/simulate.test.ts` | Hand-computed fixture suite with toBeCloseTo | ✓ VERIFIED (coverage gap) | 413 lines, 16 tests covering all nine required behaviors. All pass. Gap: no test exercises a both-nonzero import/export interval for residual conservation. |
| `src/domain/compare.ts` | runComparison() thin order-preserving map | ✓ VERIFIED | 32 lines. Single-expression implementation. Pure-domain header with BATT-05-deferred note. |
| `tests/compare.test.ts` | Order-preservation + mixed catalog/custom + no-mutation | ✓ VERIFIED | 147 lines, 8 tests. Index alignment, distinguishable shiftedKwh, mixed array, empty→[], no-mutation for both inputs. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/domain/battery-catalog.ts` | `src/domain/types.ts` | `import type { BatteryConfig }` | ✓ WIRED | Line 17: `import type { BatteryConfig } from './types'` |
| `tests/catalog.test.ts` | `src/domain/battery-catalog.ts` | `import { BATTERY_CATALOG }` | ✓ WIRED | Line 17: `import { BATTERY_CATALOG } from '../src/domain/battery-catalog'` |
| `src/domain/simulate.ts` | `src/domain/types.ts` | `import type { ..., SimResult, ... }` | ✓ WIRED | Line 30: `import type { IntervalSample, BatteryConfig, SimResult, SimOptions, TraceRow } from './types'` |
| `tests/simulate.test.ts` | `src/domain/simulate.ts` | `import { simulate }` | ✓ WIRED | Line 19: `import { simulate } from '../src/domain/simulate'` |
| `src/domain/compare.ts` | `src/domain/simulate.ts` | `import { simulate }` | ✓ WIRED | Line 9: `import { simulate } from './simulate'` |
| `tests/compare.test.ts` | `src/domain/compare.ts` | `import { runComparison }` | ✓ WIRED | Line 12: `import { runComparison } from '../src/domain/compare'` |

All six key links verified. No orphaned artifacts.

---

### Data-Flow Trace (Level 4)

Not applicable. Phase 3 is a pure computation layer with no UI components or dynamic data rendering — all outputs are numeric values in test assertions.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` | 163 tests, 14 files, all passed | ✓ PASS |
| TypeScript type check | `npx tsc --noEmit` | No output (exit 0) | ✓ PASS |
| CR-01 mixed-interval probe | Targeted test: mixed sample(import=2, export=3) → residualImportKwh | Got 0, expected 2 | ✗ FAIL |

---

### Probe Execution

No `probe-*.sh` files declared or found for this phase. Behavioral spot-checks above serve as the equivalent verification.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|---------|
| BATT-01 | 03-01 | Catalog ships as bundled JSON with datasheet URL per entry | ✓ SATISFIED | battery-catalog.ts: every entry has `datasheetUrl`. catalog.test.ts asserts URL format `/^https?:\/\//`. |
| BATT-02 | 03-01 | Each catalog entry defines all five physics fields | ✓ SATISFIED | catalog.test.ts verifies all five fields + URL for every entry. All 7 entries pass. |
| BATT-03 | 03-01 | Default selection is "Sessy 5 kWh" (index 0) | ✓ SATISFIED | `BATTERY_CATALOG[0].id === 'sessy-5'` asserted in catalog.test.ts and passes. |
| BATT-04 | 03-02 | Custom battery (same five fields) runs through simulate identically | ✓ SATISFIED | simulate.test.ts "custom" fixture: same physics specs produce matching aggregates to 6 decimal places. |
| BATT-05 | 03-02/03-03 | No battery-count cap in domain layer | ✓ SATISFIED | compare.ts has no cap/slice. compare.test.ts exercises multiple batteries. The plan explicitly documents BATT-05 is discharged by NOT capping. |
| SIM-01 | 03-02 | Pure simulate() in src/domain/, no browser globals | ✓ SATISFIED | simulate.ts: single `./types` import, "Pure function — no browser globals" tagline, passes Node Vitest. |
| SIM-02 | 03-02 | Power clamping: charge = min(surplusKwh, maxChargeKw × h, capacityRemainingKwh) | ✓ SATISFIED | Criterion-2 test asserts 0.55 kWh charged (not 1.5). Discharge clamp test asserts ≤1.7 kWh. Both pass. |
| SIM-03 | 03-02 | sqrt(rte) applied symmetrically each way | ✓ SATISFIED | Criterion-3 fixture: CRIT3 battery (rte=0.90) produces 4.269 kWh discharged = 4.5 × sqrt(0.9). |
| SIM-04 | 03-02 | Usable capacity (DoD) honored; never stores more than nominal × dod | ✓ SATISFIED | DoD cap invariant test checks every trace row for both SESSY_5 and CRIT3. Passes. |
| SIM-05 | 03-02 | Hand-computed fixture tests: one-week, small-battery, no-export edge cases | ✓ SATISFIED | 16 fixtures in simulate.test.ts covering all required cases. See caveat: mixed-interval case missing. |
| SIM-06 | 03-03 | runComparison() aggregates per-battery results into comparable structure | ✓ SATISFIED | compare.ts: `batteries.map((b) => simulate(...))`. compare.test.ts 8 assertions. All pass. |

All 11 Phase 3 requirements traceable and satisfied at the surface level. SIM-05 has a coverage gap (no mixed-interval fixture), which is the same defect as CR-01.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/domain/simulate.ts` | 218 | `residualImport = 0` unconditional in charge branch | 🛑 BLOCKER | Silently deletes real grid import from `residualImportKwh` aggregate when both `gridImportKwh > 0` and `gridExportKwh > 0` in the same interval. Violates the SimResult invariant; real-world P1 data routinely produces such intervals. |
| `src/domain/simulate.ts` | 229 | `residualExport = 0` unconditional in discharge branch | 🛑 BLOCKER (same root cause as above) | Silently deletes real grid export from `residualExportKwh` aggregate in mixed intervals on the discharge side. |
| `tests/simulate.test.ts` | all | No test with both `gridImportKwh > 0` and `gridExportKwh > 0` asserting conservation | ⚠️ WARNING | The CR-01 defect has no regression coverage. The `sample()` helper defaults to `(0.1, 0.05)` but no assertion checks residual conservation on those rows. |

No `TBD`, `FIXME`, or `XXX` debt markers found in any Phase 3 source file.

---

### Human Verification Required

None — this phase is pure computation, Vitest-only, no UI.

---

### Gaps Summary

**One blocker gap exists.**

CR-01 in the code review identified an energy conservation defect in `src/domain/simulate.ts`. This verifier ran a targeted probe confirming the defect is live:

- A mixed-interval sample with `gridImportKwh = 2` and `gridExportKwh = 3` routed to the charge branch (net = +1), the battery charges 1 kWh, and `residualImportKwh` in the trace is **0** instead of 2.
- The real 2 kWh of grid draw is silently discarded.
- The phase goal specifically requires "verified correctness on hand-computed fixtures." The documented invariant in `types.ts:250-253` ("residualImportKwh/residualExportKwh are the what-would-remain totals") is violated for any input with both fields nonzero in the same interval.
- Real HomeWizard P1 exports aggregated over 15-minute buckets **do** produce intervals with both import and export nonzero (e.g., a solar surplus in the morning combined with a brief demand spike within the same bucket). The defect is not a theoretical edge case.

The remaining 10 of 11 must-haves are fully verified. All tests pass. TypeScript is clean. The catalog, type contracts, and structural wiring are all correct and complete.

**Disposition on later phases:** CR-01 is not addressed in Phase 4 or Phase 5 ROADMAP success criteria. Phase 4 wraps `runComparison` in a Comlink worker and adds the UI layer; it does not re-examine or correct the simulator's residual accounting. The defect must be fixed in Phase 3 before Phase 4 consumes these aggregates in the comparison table.

---

_Verified: 2026-06-09T17:05:00Z_
_Verifier: Claude (gsd-verifier)_
