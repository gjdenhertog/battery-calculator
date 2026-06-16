---
phase: 03-battery-simulator-and-curated-catalog
reviewed: 2026-06-09T22:49:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/domain/simulate.ts
  - tests/simulate.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 3: Code Review Report (Gap-Closure Re-Review)

**Reviewed:** 2026-06-09T22:49:00Z
**Depth:** standard
**Files Reviewed:** 2 (`src/domain/simulate.ts`, `tests/simulate.test.ts`)
**Status:** issues_found

## Summary

This is a targeted re-review of the CR-01 fix for mixed import+export intervals.
**CR-01 is genuinely resolved.** The charge branch now preserves `residualImport =
s.gridImportKwh`; the discharge branch sets `residualImport = s.gridImportKwh −
delivered` and preserves `residualExport = s.gridExportKwh`. Energy conservation holds
on mixed intervals, both residuals are provably `>= 0`, and the fix introduces no new
defect. The two new conservation fixtures assert real (non-tautological) values and
pass. The full suite runs green (18/18).

The fix is clean. The remaining findings are all pre-existing warnings/info from the
prior review that still live in these two files and were **not** in CR-01's scope —
re-reported here so the artifact stays current. No new BLOCKER/Critical issues.

### CR-01 verification (RESOLVED)

Traced both branches against the type invariant `residual* >= 0` (`types.ts:225,239-242`):

- **Charge branch** (`simulate.ts:208-218`): `gridSideCharge = min(net, …)` and
  `net = gridExportKwh − gridImportKwh <= gridExportKwh`, so
  `residualExport = gridExportKwh − gridSideCharge >= gridImportKwh >= 0`. `residualImport
  = gridImportKwh` is untouched. Non-dominant import flow is preserved. ✓
- **Discharge branch** (`simulate.ts:219-229`): `delivered = min(demand, soc·eff,
  maxDischargeKw·h)` and `demand = −net = gridImportKwh − gridExportKwh <= gridImportKwh`,
  so `residualImport = gridImportKwh − delivered >= gridExportKwh >= 0`. `residualExport =
  gridExportKwh` is untouched. Non-dominant export flow is preserved. ✓
- **Conservation:** on any row, `residualImport + residualExport =
  gridImport + gridExport − charged − discharged` holds in both branches (and trivially in
  the `net === 0` fall-through where nothing is dispatched). No real grid kWh is deleted. ✓

### New-fixture audit (not tautological, not over-fitted)

`tests/simulate.test.ts:422-465` and `467-506` each (a) pin `residualImportKwh` and
`residualExportKwh` to independently hand-computed targets (2/2 and 3/1 respectively) and
(b) assert the balance identity separately. The identity uses literal `2+3` / `3+1` for
the grid terms but reads `charged`/`discharged` back from the result, so a wrong charge
value would still break it. The probes are correctly designed to fail against the old
(zeroing) implementation. Adequate coverage of the fix.

## Warnings

### WR-01: Invalid/NaN timestamps poison every aggregate with no guard

**File:** `src/domain/simulate.ts:76, 88-91, 247-249`
**Issue:** `intervalHoursFor` and the `periodDays` computation call `timestamp.getTime()`
with no finiteness check. An `Invalid Date` (e.g. from a bad upstream parse) returns `NaN`,
which flows into `hours[i]`, then into every `Math.min(…, maxChargeKw * h, …)`, poisoning
`soc`, `shiftedKwh`, and all totals as `NaN`. The config is range-validated at entry
(T-03-03) but the *samples* are trusted blindly. The "2-sample produces no NaN" test
(`tests/simulate.test.ts:251-263`) only uses valid dates, so it cannot catch this. Still
open after the CR-01 fix.
**Fix:** Validate sample timestamps (and `gridImportKwh`/`gridExportKwh` finiteness +
non-negativity per DATA-06) at entry, mirroring the config guard:
```ts
for (let i = 0; i < samples.length; i++) {
  const t = samples[i].timestamp.getTime()
  if (!Number.isFinite(t)) {
    throw new InvalidBatteryConfigError('sample.timestamp', `ongeldige datum op index ${i}`)
  }
}
```
(Or a dedicated `InvalidSampleError`.)

### WR-02: `periodDays` is off by one interval (fencepost)

**File:** `src/domain/simulate.ts:247-249`
**Issue:** Timestamps mark the *end* of each interval (`types.ts:26`). `periodDays =
(lastTs − firstTs) / 86_400_000` measures the span between the *end of the first* and *end
of the last* interval, undercounting actual coverage by one interval. Five 1-hour intervals
cover 5 h of data but report `4/24 ≈ 0.1667` days; a 7-day 15-min series reports `6 days
23:45`. The `SimResult.periodDays` doc (`types.ts:268`) says "Number of calendar days
covered by the simulation period" — this value is consistently short by one interval. Still
open; CR-01 did not touch it.
**Fix:** Add the first interval's duration, or document the field as "span between first and
last interval-end timestamps":
```ts
const firstH = hours[0]
const periodDays = (lastTs - firstTs + firstH * 3_600_000) / 86_400_000
```

### WR-03: Median uses lower-mid index for even-length arrays

**File:** `src/domain/simulate.ts:84, 106`
**Issue:** Both `intervalHoursFor` and `medianIntervalMinutes` compute the median as
`sorted[Math.floor(len/2)]`, which for an even count returns the upper of the two middle
elements (not the interpolated median). For coarse-cadence detection near the 60-min
threshold this can flip `coarseCadenceWarning` on a series with a 50/50 mix of fine and
coarse intervals. It matches `merge.ts:114` so it is at least *consistent*. Still open.
**Fix:** Accept and document as "midpoint sample, not interpolated median," or compute a true
median for even lengths. Whatever is chosen, keep it identical to `merge.ts` (see WR-05).

### WR-04: `maxChargeKw`/`maxDischargeKw` validation contradicts the type contract

**File:** `src/domain/simulate.ts:145-156`, `src/domain/types.ts:208-211`
**Issue:** The type doc states `maxChargeKw and maxDischargeKw > 0` (`types.ts:188`), but the
runtime guard only rejects `< 0`, so `0` is accepted. A zero-power battery silently
charges/discharges nothing — not a crash, but it diverges from the documented invariant and
would mask a user/UI error (e.g. an unparsed power field defaulting to 0) as a "battery that
does nothing" rather than a clear validation failure. Still open.
**Fix:** Tighten to match the contract: `if (config.maxChargeKw <= 0)` / `<= 0`, with the
message updated to `moet groter zijn dan 0`. Update the corresponding tests
(`tests/simulate.test.ts:409-412` currently uses `-0.1`, which would still pass).

## Info

### IN-01: `medianIntervalMinutes` re-walks deltas already computed in `intervalHoursFor` (WR-05 substrate)

**File:** `src/domain/simulate.ts:81-84, 100-107` and `src/domain/merge.ts:108-115`
**Issue:** The "median of sorted inter-sample deltas with a 15-min small-input fallback" is
implemented three times (`intervalHoursFor`, `medianIntervalMinutes`, and `merge.ts`'s
`inferDominantCadence` fallback). They differ subtly (minutes vs hours) and `simulate.ts`
walks the deltas twice per call. Divergent edits are likely and would desync coarse-cadence
behavior between the merge and sim layers. (Prior WR-05 + IN-03, merged here since only
`simulate.ts`/`tests` are in this re-review's scope.)
**Fix:** Extract a single `medianDeltaMs(samples): number` helper and derive minutes/hours
from it in one place; reuse in `merge.ts`.

### IN-02: `periodDays` doc says "calendar days" but computes elapsed-time days

**File:** `src/domain/types.ts:268`
**Issue:** "Number of calendar days covered" implies a calendar/DST-aware count, but the
implementation divides elapsed milliseconds by a fixed `86_400_000`. Across Europe/Amsterdam
DST transitions a 24 h elapsed span is 23 h or 25 h of wall-clock, so the fractional day
count drifts. Given the project's strong DST emphasis (`@date-fns/tz`), the wording is
misleading. (Compounds with WR-02.)
**Fix:** Rename the doc to "elapsed days (UTC ms / 86.4M)" or compute calendar days via the
TZ layer if calendar semantics are wanted downstream.

### IN-03: No fixture covers the `net === 0` mixed interval (import == export, both nonzero)

**File:** `tests/simulate.test.ts` (all fixtures)
**Issue:** When `gridImportKwh === gridExportKwh > 0`, `net === 0` and neither dispatch
branch runs (`simulate.ts:208,219`). The residuals correctly fall through to the raw
`s.gridImportKwh`/`s.gridExportKwh` initializers (`simulate.ts:205-206`) and nothing is
charged/discharged — behavior is correct and conservation holds — but it is the one
mixed-interval shape the new CR-01 fixtures do not exercise. Low risk; current behavior is
right.
**Fix:** Add a one-row `sample(T1, 2, 2)` fixture asserting `charged === 0`, `discharged
=== 0`, `residualImport === 2`, `residualExport === 2` to lock the fall-through.

---

_Reviewed: 2026-06-09T22:49:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
