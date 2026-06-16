---
phase: 02-csv-parsing-format-detection-multi-file-merge-dst-safe-time
plan: "03"
subsystem: domain
tags: [merge, gaps, period-filter, dst, tdd]
dependency_graph:
  requires: ["02-01"]
  provides: ["mergeFiles", "detectGaps", "filterByPeriod", "fullRange"]
  affects: ["03-simulate"]
tech_stack:
  added: ["@date-fns/tz TZDate for DST-aware gap detection"]
  patterns:
    - "Finer-wins Map-based merge keyed by UTC ms"
    - "Local-time TZDate walk for DST-exempt gap counting"
    - "Pure functions, no browser globals, node-env runnable"
key_files:
  created:
    - src/domain/period-filter.ts
    - src/domain/gaps.ts
    - src/domain/merge.ts
    - tests/period-filter.test.ts
    - tests/merge.test.ts
  modified: []
decisions:
  - "Local-time TZDate walk for gap detection: walk UTC ms but generate expected slots via TZDate(utcMs, Europe/Amsterdam). Spring-forward 02:00-02:59 AMS local never appears as an expected slot (nonexistent local time). Fall-back both 02:00 occurrences produce distinct UTC values, both accepted. Avoids tzScan complexity."
  - "Finest file cadence used for gap detection over merged series: sortedResults[0].cadenceMinutes is the most reliable cadence for gap counting, not a median of the mixed merged series."
  - "mergeFiles stub committed as part of Task 2 RED commit to allow the combined test file to compile before full implementation."
metrics:
  duration_seconds: ~120
  completed_date: "2026-06-09"
  tasks_completed: 3
  files_created: 5
  files_modified: 0
---

# Phase 02 Plan 03: Post-Parse Domain Functions Summary

**One-liner:** Finer-wins multi-file merge + DST-aware gap detection (TZDate local-time walk exempts spring/fall transitions) + inclusive period filter, all as pure node-runnable functions with 23 tests.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Period filter (pure, tested) | `d74d390` | `src/domain/period-filter.ts`, `tests/period-filter.test.ts` |
| 2 | DST-aware gap detection | `4213161` | `src/domain/gaps.ts`, `src/domain/merge.ts` (stub), `tests/merge.test.ts` |
| 3 | Finer-wins multi-file merge with per-file stats | `3ec808d` | `src/domain/merge.ts` (full impl) |

## What Was Built

### `src/domain/period-filter.ts`
`filterByPeriod(samples, start, end)` — null bounds default to ±Infinity; inclusive at both ends. `fullRange(samples)` returns the first and last timestamps. Pure functions, no imports beyond types.ts.

### `src/domain/gaps.ts`
`detectGaps(samples, cadenceMinutes)` — walks UTC ms from first to last sample at the given cadence, generating expected slots via `TZDate(utcMs, 'Europe/Amsterdam')`. Because TZDate represents the local Amsterdam time:
- The spring-forward 02:00–02:59 AMS block (which does not exist in local time) is never generated as an expected slot — no false gap count.
- Both fall-back 02:00–02:59 slots produce distinct UTC values; both are in the expected set — no false gap count.
- Missing UTC slots not present in the actual sample set are counted and grouped into contiguous ranges.
- Never fabricates data (D-05 compliance).

### `src/domain/merge.ts`
`mergeFiles(results)` — sorts ParseFileResult[] by cadenceMinutes ascending (finest first), inserts samples into `Map<utcMs, IntervalSample>` (first insert wins = finest wins, DATA-10), tracks per-file `rowsContributed`/`rowsOverridden` (D-08), sorts output ascending, calls `detectGaps` on merged series, and builds `fileStats` carrying all DATA-05 fields.

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| `tests/period-filter.test.ts` | 9 | filterByPeriod (null/null, open-left, open-right, both, empty, single, immutability) + fullRange |
| `tests/merge.test.ts` | 14 | 8 detectGaps + 6 mergeFiles |

Full suite: **46/46 tests green**. `tsc --noEmit` clean.

## Success Criteria Verification

- [x] **DATA-10**: Finer-resolution file wins — test asserts overlapping timestamp value equals fine-file value.
- [x] **DATA-11**: Gap count + per-file stats available — `MergeResult.gapCount`, `gapRanges`, `fileStats`.
- [x] **DATA-12**: Pure period filter defaults to full range and narrows inclusively.
- [x] **DATA-05**: isMonotonic, monotonicity_failRow, firstIntervalAnomalyFlag, softWarnings carried through fileStats.
- [x] **D-04**: Spring-forward and fall-back DST transitions correctly exempt from gap counting.
- [x] **D-05**: detectGaps never fabricates data; input array unchanged after call.
- [x] **D-08**: rowsContributed + rowsOverridden tracked per file.
- [x] merge.ts imports gaps.ts; no imports from src/ui/ (node-runnable).

## Deviations from Plan

### Auto-additions (Rule 2)

**1. [Rule 2 - Missing implementation] Stub merge.ts added during Task 2 RED phase**
- **Found during:** Task 2 (writing `tests/merge.test.ts` which imports both `detectGaps` and `mergeFiles`)
- **Issue:** The test file for Task 2 imports `mergeFiles` from `src/domain/merge` alongside `detectGaps`. The module must exist for the test file to even load (and for the RED phase to actually fail on missing implementation, not on module-not-found).
- **Fix:** Added a stub `merge.ts` that throws "not yet implemented" — this allows the RED phase to correctly show the 8 detectGaps tests passing and 6 mergeFiles tests failing (stub throws).
- **Files modified:** `src/domain/merge.ts`
- **Commit:** `4213161` (stub included in Task 2 commit)

None — plan executed as designed. The stub merge.ts is a natural consequence of the combined test file approach specified in the plan.

## Threat Model Compliance

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-02-07 (Tampering: wrong source wins) | Mitigated — finer-wins Map key uniqueness unit-tested (DATA-10 assertion) |
| T-02-08 (Tampering: gap fabrication) | Mitigated — detectGaps only counts/reports; D-05 immutability test asserts no data added |
| T-02-09 (Information Disclosure) | Accepted — pure functions, no fetch/XHR; connect-src 'none' from Plan 01 unchanged |

## Known Stubs

None. All three modules are fully implemented and tested.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. All functions are pure domain logic operating on in-memory IntervalSample[].

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/domain/period-filter.ts exists | FOUND |
| src/domain/gaps.ts exists | FOUND |
| src/domain/merge.ts exists | FOUND |
| tests/period-filter.test.ts exists | FOUND |
| tests/merge.test.ts exists | FOUND |
| Commit d74d390 exists | FOUND |
| Commit 4213161 exists | FOUND |
| Commit 3ec808d exists | FOUND |
