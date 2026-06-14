---
phase: 05-visualizations-polish-transparent-assumptions-ui
plan: "01"
subsystem: domain
tags: [uplot, bucket-by-month, select-representative-week, formatAxisKwh, TZDate, VIZ-01, VIZ-02, VIZ-04]
dependency_graph:
  requires: []
  provides:
    - src/domain/bucket-by-month.ts (bucketByMonth, MonthBucket)
    - src/domain/select-representative-week.ts (selectRepresentativeWeek, RepresentativeWeek)
    - src/helpers/format.ts (formatAxisKwh)
    - uplot ^1.6.32 installed
  affects:
    - src/ui/charts/monthly-bars.ts (Plan 03 consumer)
    - src/ui/charts/flow-chart.ts (Plan 03 consumer)
tech_stack:
  added:
    - uplot: "^1.6.32"
  patterns:
    - TZDate Amsterdam-local month bucketing (Pitfall 3 guard)
    - startOfWeek(TZDate, weekStartsOn:1) for Mon-Sun Amsterdam week boundaries
    - Pure node-safe domain helpers with TDD node-env Vitest fixtures
key_files:
  created:
    - src/domain/bucket-by-month.ts
    - src/domain/select-representative-week.ts
    - tests/bucket-by-month.test.ts
    - tests/select-representative-week.test.ts
  modified:
    - package.json (uplot added)
    - package-lock.json
    - src/helpers/format.ts (formatAxisKwh added)
    - tests/format.test.ts (formatAxisKwh assertions added)
decisions:
  - "Test assertions for startTs use TZDate Amsterdam-local date checks (not UTC ISO string) because Mon 2025-06-09 Amsterdam = 2025-06-08T22:00:00Z UTC (CEST +02:00)"
  - "weekLabel uses en-dash separator and NL full month names (januari..december)"
  - "isPartial computed by checking presence of day 1 AND last day in local-day Set per bucket"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-14"
  tasks: 3
  files: 8
---

# Phase 05 Plan 01: uPlot Install + Pure Domain Helpers Summary

Wave 0 gate: uPlot ^1.6.32 installed; `bucketByMonth`, `selectRepresentativeWeek`, and `formatAxisKwh` land as pure node-safe helpers with green node-env fixtures. Downstream chart adapters (Plan 03) can import all three contracts without exploration.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install uPlot, confirm CSP intact | 00c47c5 | package.json, package-lock.json |
| 2 (RED) | bucketByMonth failing fixtures | 0045446 | tests/bucket-by-month.test.ts |
| 2 (GREEN) | bucketByMonth pure helper | 2592a68 | src/domain/bucket-by-month.ts |
| 3 (RED) | selectRepresentativeWeek + formatAxisKwh failing fixtures | f95b46c | tests/select-representative-week.test.ts, tests/format.test.ts |
| 3 (GREEN) | selectRepresentativeWeek + formatAxisKwh implementation | 17e4587 | src/domain/select-representative-week.ts, src/helpers/format.ts |

## What Was Built

### Task 1: uPlot Install

`npm install uplot@^1.6.32` added uPlot as a runtime dependency. CSP verified unchanged (`connect-src 'none'` and `style-src 'self'` intact). TypeScript resolves the module cleanly (uPlot ships its own `.d.ts`).

### Task 2: bucketByMonth (VIZ-01)

`src/domain/bucket-by-month.ts` — pure function grouping `TraceRow[]` into Amsterdam-local calendar months:

- **TZDate guard (Pitfall 3):** `new TZDate(row.timestamp.getTime(), zone).getMonth()` — never raw `Date.getMonth()` — ensures late-evening UTC timestamps bucket into the correct Amsterdam month across DST transitions.
- **MonthBucket interface:** `monthKey` ("2025-06"), `monthLabel` ("jun '25"), `shiftedKwh` (sum of `chargedKwh` per month), `isPartial` (true if day 1 or last day of month absent from trace).
- **NL abbreviated month labels:** jan, feb, mrt, apr, mei, jun, jul, aug, sep, okt, nov, dec.
- **Sparse case:** Returns all-partial buckets for datasets with <2 full months; never returns empty array.
- **13 node-env fixtures green** covering: full month, partial first/last months, DST boundary (2025-03-31T23:30:00Z = April Amsterdam), sparse <2-full-months, NL labels for all 12 months, and sum reconciliation.

### Task 3: selectRepresentativeWeek + formatAxisKwh (VIZ-02, VIZ-04)

`src/domain/select-representative-week.ts` — pure function selecting the Mon–Sun week with highest `residualExportKwh` (teruglevering):

- **Week boundaries:** `startOfWeek(new TZDate(ts, zone), { weekStartsOn: 1 })` for Monday boundaries in Amsterdam local time.
- **Tie-break:** Earliest week wins when sums are equal.
- **Edge case:** Returns single available span for datasets < 7 days; never returns null.
- **weekLabel:** NL full month names e.g. "9–15 juni 2025".
- **RepresentativeWeek interface:** `startTs` (ms, Monday 00:00 Amsterdam), `endTs` (ms, Sunday end), `weekLabel`.
- **12 node-env fixtures green** covering: best-week selection, tie-break first, <7-day single span.

`src/helpers/format.ts` extended with `formatAxisKwh(n)` — returns `n.toFixed(1)` without kWh suffix for compact uPlot axis ticks.

## Verification

- Full suite: **330 tests, 25 files — all green**
- `npx tsc --noEmit` — clean, no errors
- CSP: `connect-src 'none'` and `style-src 'self'` verified unchanged
- `bucketByMonth` and `selectRepresentativeWeek`: zero imports from `src/ui/` or `uplot` (pure node-safe)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assertion for Amsterdam-local Monday timestamps**

- **Found during:** Task 3 RED-to-GREEN
- **Issue:** Initial test asserted `new Date(result.startTs).toISOString()` contains `'2025-06-09'`, but Monday 2025-06-09 Amsterdam midnight = `2025-06-08T22:00:00Z` UTC (CEST +02:00). The UTC ISO string contains `2025-06-08`, not `2025-06-09`.
- **Fix:** Updated test to use `new TZDate(result.startTs, AMSTERDAM)` and check `.getFullYear()`, `.getMonth()`, `.getDate()` in Amsterdam local time — the canonical way to check local dates, matching the pattern from `dst-fixtures.test.ts`.
- **Files modified:** tests/select-representative-week.test.ts
- **Commit:** 17e4587 (included in GREEN commit)

## Known Stubs

None — all helpers produce real computed values from input data.

## Threat Flags

No new threat surface introduced. Pure functions consuming in-memory TraceRow[]; no DOM, no network, no user-string rendering.

## Self-Check: PASSED

- `src/domain/bucket-by-month.ts` — exists, 100 lines
- `src/domain/select-representative-week.ts` — exists
- `src/helpers/format.ts` — contains `formatAxisKwh`
- `tests/bucket-by-month.test.ts` — exists, 13 tests green
- `tests/select-representative-week.test.ts` — exists, 12 tests green
- `tests/format.test.ts` — 19 tests green (including 5 formatAxisKwh)
- Commits verified: 00c47c5, 0045446, 2592a68, f95b46c, 17e4587
