---
phase: 03-battery-simulator-and-curated-catalog
reviewed: 2026-06-09T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/domain/types.ts
  - src/domain/battery-catalog.ts
  - src/domain/simulate.ts
  - src/domain/compare.ts
  - tests/catalog.test.ts
  - tests/simulate.test.ts
  - tests/compare.test.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

The Phase 3 domain layer (battery type contracts, curated NL catalog, per-interval
dispatch engine, multi-battery comparison) is well-structured, pure, and free of
network/secret concerns — appropriate for the client-side privacy constraint. The
dispatch math for the *single-flow* case (an interval is either net-import or
net-export) is correct: power clamping, symmetric `sqrt(rte)`, and the DoD hard cap
all match the hand-computed test fixtures.

However, adversarial tracing surfaces a real energy-accounting defect in **mixed
intervals** (an interval carrying *both* `gridImportKwh > 0` and `gridExportKwh > 0`),
which the `IntervalSample` type explicitly permits and which real aggregated P1 data
produces. In those intervals the simulator collapses to a single `net` value and then
**forces the non-dominant residual to zero**, silently deleting real grid energy from
the residual aggregates. This breaks the energy-conservation invariant the `SimResult`
doc claims (`residualImport`/`residualExport` are the "what would remain" totals) and
is not covered by any test. There are also robustness gaps around NaN-valued timestamps
and a fencepost in `periodDays`.

## Critical Issues

### CR-01: Mixed import+export intervals silently delete real grid energy (conservation break)

**File:** `src/domain/simulate.ts:201-230`
**Issue:**
The dispatch reduces each interval to `net = gridExportKwh − gridImportKwh` and branches
on its sign. In the charge branch it unconditionally sets `residualImport = 0`; in the
discharge branch it unconditionally sets `residualExport = 0`. When an interval carries
**both** a nonzero import and a nonzero export, the smaller of the two is erased from the
output aggregates rather than passed through as residual.

`IntervalSample` does not forbid this — its invariants only require both fields `>= 0`
(`types.ts:28-31`), and aggregated/merged P1 data routinely shows both import and export
within the same 15-minute bucket. Traced example with Sessy 5 kWh, `import=2`, `export=3`,
empty SoC, 1 h interval:

```
net = +1  → charge branch
gridSideCharge = min(1, 2.2, headroom) = 1
charged          = 1
residualExport   = 3 − 1 = 2
residualImport   = 0      ← the real 2 kWh of grid import is DELETED
```

`totalResidualImport` loses 2 kWh that the household genuinely drew from the grid. The
`SimResult` doc (`types.ts:250-253`) promises `residualImportKwh`/`residualExportKwh` are
the honest "what would remain" totals; here they understate residual import and the result
is optimistically wrong — exactly the failure mode the project's "honest comparison" value
statement warns against. No test exercises a both-nonzero interval (all fixtures set one
side to 0), so the suite gives false confidence.

**Fix:** Either (a) document and enforce that simultaneous import+export is not allowed and
validate it at entry, or (b) preserve the non-dominant flow in the residual. Preferred (b):

```ts
if (net > 0) {
  const headroomGridSide = (usable - soc) / eff
  const gridSideCharge = Math.min(net, config.maxChargeKw * h, headroomGridSide)
  soc = Math.min(soc + gridSideCharge * eff, usable)
  charged = gridSideCharge
  // Preserve any genuine import; only the net surplus was available to charge.
  residualExport = s.gridExportKwh - gridSideCharge
  residualImport = s.gridImportKwh            // was forced to 0
} else if (net < 0) {
  const demand = -net
  const delivered = Math.min(demand, soc * eff, config.maxDischargeKw * h)
  soc -= delivered / eff
  if (soc < 0) soc = 0
  discharged = delivered
  residualImport = s.gridImportKwh - delivered // net demand already nets out export
  residualExport = s.gridExportKwh             // was forced to 0
}
```

Add a test with `import>0 && export>0` asserting
`residualImport + charged_offset ≈ original import` style conservation. (Confirm the exact
residual algebra against the intended model with the phase author — the key requirement is
that no real grid kWh disappears from the aggregates.)

## Warnings

### WR-01: Invalid/NaN timestamps poison every aggregate with no guard

**File:** `src/domain/simulate.ts:76, 88-91, 247-249`
**Issue:** `intervalHoursFor` and `periodDays` call `timestamp.getTime()` with no finiteness
check. An `Invalid Date` (e.g. produced upstream by a bad parse) returns `NaN`, which flows
into `hours[i]`, then into every `Math.min(..., maxChargeKw * h, ...)`, poisoning `soc`,
`shiftedKwh`, and all totals as `NaN`. The config is range-validated at entry (T-03-03) but
the *samples* are trusted blindly. The "2-sample produces no NaN" test only uses valid dates.
**Fix:** Validate timestamps at entry (mirror the config guard):
```ts
for (let i = 0; i < samples.length; i++) {
  const t = samples[i].timestamp.getTime()
  if (!Number.isFinite(t)) {
    throw new InvalidBatteryConfigError('sample.timestamp', `ongeldige datum op index ${i}`)
  }
}
```
(Or a dedicated `InvalidSampleError`.) Also guard `gridImportKwh`/`gridExportKwh` for
`NaN`/negative, since the DATA-06 invariant is only documented, not enforced here.

### WR-02: `periodDays` is off by one interval (fencepost)

**File:** `src/domain/simulate.ts:247-249`
**Issue:** Timestamps mark the *end* of each interval (`types.ts:26`). `periodDays =
(lastTs − firstTs) / 86_400_000` therefore measures the span between the *end of the first*
and *end of the last* interval, undercounting actual coverage by one interval. Five 1-hour
intervals cover 5 h of data but report `4/24 = 0.1667` days; a 7-day 15-min series reports
`6 days 23:45`. The field doc says "Number of calendar days covered by the simulation
period" — this value is consistently short by one interval.
**Fix:** Add the first interval's duration:
```ts
const firstH = hours[0]                       // hours of the leading interval
const periodDays = (lastTs - firstTs + firstH * 3_600_000) / 86_400_000
```
Or document the field as "span between first and last interval-end timestamps" if that is
the intended semantics.

### WR-03: Median uses lower-mid index for even-length arrays

**File:** `src/domain/simulate.ts:84, 106`
**Issue:** Both `intervalHoursFor` and `medianIntervalMinutes` compute the median as
`sorted[Math.floor(len/2)]`, which for an even count returns the upper of the two middle
elements (and is not the true average-of-two median). For coarse-cadence detection near the
60-min threshold this can flip `coarseCadenceWarning` on a series with a 50/50 mix of fine
and coarse intervals. It matches `merge.ts` so it is consistent, but both are technically
incorrect medians.
**Fix:** Either accept and document as "midpoint sample, not interpolated median," or compute
a true median for even lengths. Consistency with `merge.ts` is the only thing keeping this a
warning rather than a divergence bug.

### WR-04: `maxChargeKw`/`maxDischargeKw` validation contradicts the type contract

**File:** `src/domain/simulate.ts:145-156`, `src/domain/types.ts:208-211`
**Issue:** The type doc states `maxChargeKw and maxDischargeKw > 0`, but the runtime guard
only rejects `< 0`, so `0` is accepted. A zero-power battery silently charges/discharges
nothing — not a crash, but it diverges from the documented invariant and would mask a
user/UI error (e.g. an unparsed power field defaulting to 0) as a "battery that does
nothing" rather than a clear validation failure.
**Fix:** Tighten to match the contract: `if (config.maxChargeKw <= 0)` / `<= 0`, with the
message updated to `moet groter zijn dan 0`. Update the corresponding tests.

### WR-05: Duplicated cadence/median logic across three call sites

**File:** `src/domain/simulate.ts:81-84, 100-107` and `src/domain/merge.ts:108-115`
**Issue:** The "median of sorted inter-sample deltas with a 15-min small-input fallback" is
implemented three times (`intervalHoursFor`, `medianIntervalMinutes`, and `merge.ts`'s
fallback). They already differ subtly (minutes vs hours, and `intervalHoursFor` does the
delta walk a second time that `medianIntervalMinutes` repeats). Divergent edits are likely
and will desync coarse-cadence behavior between the merge layer and the sim layer.
**Fix:** Extract a single `medianDeltaMs(samples): number` helper (with the documented
small-input fallback) and derive minutes/hours from it in one place. Reuse it in `merge.ts`.

## Info

### IN-01: Test fixtures never cover a mixed import+export interval

**File:** `tests/simulate.test.ts` (all fixtures), `tests/compare.test.ts:38-42`
**Issue:** Every fixture sets exactly one of import/export to 0 per interval, so the
conservation defect in CR-01 is invisible to the suite. The default `sample()` helper does
use both (`0.1`/`0.05`) but no assertion checks residual conservation on those rows.
**Fix:** Add a fixture with `import>0 && export>0` and assert that
`totalImport + totalExport` is fully accounted for across `charged`, `discharged`, and the
two residuals (energy-balance assertion).

### IN-02: `periodDays` doc says "calendar days" but computes elapsed-time days

**File:** `src/domain/types.ts:268-269`
**Issue:** "Number of calendar days covered" implies a calendar/DST-aware day count, but the
implementation divides elapsed milliseconds by a fixed `86_400_000`. Across the
Europe/Amsterdam DST transitions a 24 h elapsed span is 23 h or 25 h of wall-clock, so the
fractional day count drifts. Given the project's strong DST emphasis (`@date-fns/tz`), the
wording is misleading.
**Fix:** Rename the doc to "elapsed days (UTC ms / 86.4M)" or compute calendar days via the
TZ layer if calendar semantics are actually wanted downstream.

### IN-03: `medianIntervalMinutes` re-walks deltas already available in `intervalHoursFor`

**File:** `src/domain/simulate.ts:100-107`
**Issue:** `intervalHoursFor` already computes `deltasMs` and a `medianMs`; the separate
`medianIntervalMinutes` recomputes the same sorted-median from scratch a few lines later.
Minor duplicate work and a second place to keep in sync (subsumed by WR-05).
**Fix:** Return the median (or `deltasMs`) from `intervalHoursFor` and derive the
coarse-cadence minutes from it.

### IN-04: `datasheetUrl` reachability is asserted by type doc but only format-checked

**File:** `src/domain/types.ts:212-213`, `tests/catalog.test.ts:38`
**Issue:** The `BatteryConfig` doc says `datasheetUrl is a reachable HTTPS URL`, and the
test only checks `^https?://` (which also permits plain `http`). The Victron entry points at
a wiki landing page (`victronenergy.com/live/ess:start`) rather than a spec sheet. Not a code
defect, but the "cited source" guarantee (BATT-01) is weaker than the doc implies, and an
`http://` URL would pass the regex despite the doc saying HTTPS.
**Fix:** Tighten the test regex to `^https://` and, if feasible, point Victron at a concrete
spec PDF. Reachability cannot be checked offline — soften the doc wording to "HTTPS URL
citing the spec source."

---

_Reviewed: 2026-06-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
