---
phase: 02-csv-parsing-format-detection-multi-file-merge-dst-safe-time
verified: 2026-06-09T12:30:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Drop a real HomeWizard P1 CSV and confirm the sanity readout shows correct totals (file count, rows, date range, import kWh, export kWh, gap count) matching independently calculated values within rounding"
    expected: "All six DATA-11 readout fields render with values that match the source CSV totals to within one decimal place"
    why_human: "Correctness of rendered kWh totals against a real file cannot be verified without a browser and a known-good file; jsdom tests only check labels and structure"
  - test: "Drop a file with a deliberately broken row (non-numeric kWh cell such as '100abc' rather than just a purely non-numeric string like 'NOT-A-NUMBER') and confirm the error names file, row, column, and expected"
    expected: "ParseRowError is shown with all four DATA-09 fields visible; '100abc' is rejected (WR-01 strict-regex fix was applied — verify it works end-to-end)"
    why_human: "E2E error rendering with a real partial-garbage value requires a live browser; jsdom tests use 'NOT-A-NUMBER' which would have passed even under the old parseFloat"
  - test: "Upload a 50k+ row CSV file and confirm the UI stays interactive during parse (no freeze, 'Bezig met verwerken...' status shows)"
    expected: "UI remains interactive; PapaParse worker:true keeps parse off the main thread (DATA-13); DevTools Network tab shows zero requests during parse"
    why_human: "Worker threading behavior and UI responsiveness cannot be asserted in jsdom; requires a real browser + large file"
---

# Phase 2: CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series — Verification Report

**Phase Goal:** A pure data layer that turns one or more uploaded HomeWizard P1 CSVs into a single canonical, DST-safe `IntervalSample[]` with declared series_type, period filter, and a sanity readout — fixture-locked in CI before any UI exists.
**Verified:** 2026-06-09T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dropping a HomeWizard P1 CSV produces IntervalSample[] with gridImportKwh >= 0 and gridExportKwh >= 0 | ✓ VERIFIED | `src/domain/parsers/homewizard-p1.ts` clamps to `Math.max(0, delta)`; all 134 tests pass including homewizard-p1.test.ts non-negative assertions |
| 2 | CI fixtures for 2026-03-29 and 2026-10-25 yield exactly 92 and 100 intervals; UTF-8+BOM, semicolon delimiter, decimal comma, and DD-MM-YYYY covered | ✓ VERIFIED | `tests/dst-fixtures.test.ts` asserts `samples.length === 92` and `samples.length === 100` AND `distinct timestamps === 100` (CR-01 fix). `tests/encoding.test.ts` covers UTF-8/BOM/Windows-1252. Decimal comma covered in `homewizard-p1.test.ts`. |
| 3 | After upload, user sees sanity readout: file count, rows, date range, import kWh, export kWh, gap count — values match real totals within rounding | ? UNCERTAIN (human needed) | `renderReadout` renders all six DATA-11 fields via textContent; jsdom tests verify structure and labels. Correctness of computed totals against a real file requires live browser verification. Human checkpoint in Plan 04 Task 3 was approved but cannot be automatically re-verified. |
| 4 | Two overlapping files produce a merged series where overlapping timestamps come from the finer-resolution source — unit-asserted | ✓ VERIFIED | `tests/merge.test.ts` > "finer-resolution (15-min) file values win on overlapping timestamps" test; `mergeFiles` uses Map keyed by UTC ms, finest cadence sorted first |
| 5 | A user-chosen sub-period narrows the analysis without re-parsing; defaults to full range on first load | ✓ VERIFIED | `src/domain/period-filter.ts` exports `filterByPeriod` (null/null returns all) and `fullRange`; `tests/period-filter.test.ts` 9 tests cover all boundary conditions. NOTE: the interactive date-picker UI is intentionally deferred to Phase 4 (D-02 per PLAN 03); the pure function is complete. |
| 6 | Parsing a large file does not freeze the UI (worker:true); parse errors name file/row/column/expected | ✓ VERIFIED | `grep -c "worker: true" src/domain/parse.ts` returns 1. `ParseRowError` carries all four DATA-09 fields; `tests/parse-errors.test.ts` asserts `.fileName`, `.rowNumber`, `.columnName`, `.expected`. Human checkpoint approved in Plan 04 Task 3 (live). |
| 7 | A new parser format can be added by creating one file + one import line, zero central-switch edits | ✓ VERIFIED | `src/domain/parsers/noop-stub.ts` is the second registered parser (claim always false); `tests/registry.test.ts` proves first-match semantics; `src/domain/parse.ts` has two static side-effect imports; `ParserRegistry` never needs editing |

**Score:** 7/7 truths verified (SC-3 requires human confirmation of live totals)

### Deferred Items

None — all roadmap success criteria are covered in this phase.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/domain/types.ts` | IntervalSample, ParseFileResult, MergeResult, error classes | ✓ VERIFIED | All types present; JSDoc'd; named exports only; `export interface IntervalSample`, `export class ParseRowError` both confirmed |
| `src/domain/parsers/registry.ts` | CsvParser interface + ParserRegistry register/claim | ✓ VERIFIED | Exports both; first-match semantics; singleton |
| `src/constants/csp.ts` | Contains `worker-src blob:` | ✓ VERIFIED | Directive present; `connect-src 'none'` unchanged |
| `src/domain/encoding.ts` | UTF-8/BOM + Windows-1252 fallback | ✓ VERIFIED | `decodeFileWithFallback` throws `UnsupportedEncodingError`; BOM auto-stripped by TextDecoder |
| `src/domain/parsers/homewizard-p1.ts` | HomeWizard P1 adapter, self-registering | ✓ VERIFIED | `ParserRegistry.register` at module level; `export {}` present; `disambiguateFallBackHour()` present (CR-01 fix) |
| `src/domain/parsers/noop-stub.ts` | Second parser proving DATA-03 | ✓ VERIFIED | claim always false; `ParserRegistry.register` at module level; `export {}` present |
| `src/domain/parse.ts` | parseFile() with worker:true | ✓ VERIFIED | `worker: true` in Papa.parse config; static imports of both parsers; fail-fast ParseRowError; unknown-format rejection with Dutch message |
| `src/domain/merge.ts` | mergeFiles() finer-wins with per-file stats | ✓ VERIFIED | Map<utcMs, IntervalSample> pattern; per-file contributed/overridden counters; calls detectGaps |
| `src/domain/gaps.ts` | detectGaps() DST-aware | ✓ VERIFIED | `addDays` for daily cadence (CR-02 fix); range grouping via adjacency in expected-slot sequence |
| `src/domain/period-filter.ts` | filterByPeriod() + fullRange() | ✓ VERIFIED | null bounds = ±Infinity; inclusive both ends |
| `src/ui/readout.ts` | renderReadout(MergeResult) | ✓ VERIFIED | All six DATA-11 labels; per-file D-08 fields; zero innerHTML; returns detached element |
| `src/ui/drop-zone.ts` | initDropZone() drag-drop + picker wired | ✓ VERIFIED | Append-not-replace; privacy promise preserved; parseFile→mergeFiles→renderReadout pipeline; ParseRowError and UnsupportedEncodingError handled |
| `src/styles/drop-zone.css` | State classes + readout layout | ✓ VERIFIED | `drop-zone--dragover` class present; file-picker-label 44px; no hardcoded colors except single dragover tint |
| `tests/fixtures/homewizard-spring-2026-03-29.csv` | Spring DST fixture (92 intervals) | ✓ VERIFIED | File exists; no `2026-03-29 02:` timestamps (grep confirms 0 matches) |
| `tests/fixtures/homewizard-fall-2026-10-25.csv` | Fall DST fixture (100 intervals) | ✓ VERIFIED | File exists; contains two `02:xx` blocks (8 rows with `02:xx` timestamps confirmed) |
| `tests/fixtures/homewizard-real-sample-15-minutes.csv` | Real HomeWizard P1 export (canonical) | ✓ VERIFIED | File present (15-min granularity, 3072 rows, 2026-05). Daily `homewizard-real-sample.csv` was an accidental upload and removed; 15-min is the canonical real fixture. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/csp-plugin.test.ts` | `src/constants/csp.ts` | `import { CSP }` | ✓ WIRED | Test asserts `expect(CSP).toContain("worker-src blob:")` |
| `tests/registry.test.ts` | `src/domain/parsers/registry.ts` | `import { ParserRegistry }` | ✓ WIRED | register/claim semantics asserted |
| `src/domain/parsers/homewizard-p1.ts` | `src/domain/parsers/registry.ts` | `ParserRegistry.register()` on import | ✓ WIRED | Line 235: `ParserRegistry.register(HomeWizardP1Parser)` |
| `src/domain/parse.ts` | `src/domain/parsers/homewizard-p1.ts` | static side-effect import | ✓ WIRED | Line 23: `import './parsers/homewizard-p1'` |
| `src/domain/parse.ts` | `src/domain/parsers/noop-stub.ts` | static side-effect import | ✓ WIRED | Line 24: `import './parsers/noop-stub'` |
| `src/domain/merge.ts` | `src/domain/gaps.ts` | `detectGaps()` call | ✓ WIRED | `detectGaps(mergedSamples, dominantCadence)` called in `mergeFiles()` |
| `src/domain/merge.ts` | `src/domain/types.ts` | MergeResult import | ✓ WIRED | `import type { ..., MergeResult, ... }` |
| `src/ui/drop-zone.ts` | `src/domain/parse.ts` | `parseFile()` call | ✓ WIRED | `parseFile(f)` called in `processFiles()` |
| `src/ui/drop-zone.ts` | `src/domain/merge.ts` | `mergeFiles()` call | ✓ WIRED | `mergeFiles(parseResults)` called after all files parsed |
| `src/main.ts` | `src/ui/drop-zone.ts` | `initDropZone()` call | ✓ WIRED | Line 21: `initDropZone(dropZoneRegion)` |
| `src/domain/parse.ts` | `src/domain/encoding.ts` | `decodeFileWithFallback()` | ✓ WIRED | Line 45: `const { text, encoding } = await decodeFileWithFallback(file)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `src/ui/readout.ts` | `result: MergeResult` | Passed by `drop-zone.ts` after `mergeFiles()` | Yes — from parsed CSV samples, summed in `buildSummaryGroup` | ✓ FLOWING |
| `src/ui/drop-zone.ts` | `mergeResult` | `mergeFiles(parseResults)` where `parseResults` comes from `parseFile()` per file | Yes — live CSV parsing via PapaParse | ✓ FLOWING |
| `src/domain/merge.ts` | `merged Map` | `ParseFileResult[].samples` — from adapter `transform()` | Yes — adapter produces real cumulative-to-delta values | ✓ FLOWING |
| `src/domain/gaps.ts` | `actual Set` | `samples.map(s => s.timestamp.getTime())` | Yes — real UTC ms from parsed timestamps | ✓ FLOWING |

Note on `encoding: 'UTF-8'` placeholder in `homewizard-p1.ts` line 220: this is intentionally a placeholder that `parseFile()` overwrites at line 110 via `resolve({ ...result, encoding })` — the actual detected encoding from `decodeFileWithFallback()` flows correctly.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (134 tests) | `npm test` | 134 tests pass, 11 test files, 0 failures | ✓ PASS |
| TypeScript type check | `npx tsc --noEmit` | 0 errors | ✓ PASS |
| Production build | `npm run build` | 35.77 kB JS (gzip 12.68 kB), 3.33 kB CSS, clean | ✓ PASS |
| DST spring fixture: 92 intervals | `tests/dst-fixtures.test.ts` | PASS — `samples.length === 92` | ✓ PASS |
| DST fall fixture: 100 distinct timestamps | `tests/dst-fixtures.test.ts` | PASS — `Set(timestamps).size === 100` (CR-01 fix verified) | ✓ PASS |
| Daily cadence gap detection across DST | `tests/dst-fixtures.test.ts` > CR-02 suite | PASS — 3 tests: spring 0 gaps, fall 0 gaps, missing day detected | ✓ PASS |
| worker:true in parse.ts | grep | Returns 1 | ✓ PASS |
| innerHTML === 0 in readout.ts | grep | Returns 0 | ✓ PASS |
| innerHTML === 0 in drop-zone.ts | grep | Returns 0 | ✓ PASS |
| .style. === 0 in readout.ts | grep | Returns 0 | ✓ PASS |
| .style. === 0 in drop-zone.ts | grep | Returns 0 | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED (no probe scripts declared; phase produces a browser UI, not a CLI or standalone runnable)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 02-04 | Drop zone + always-visible file picker | ✓ SATISFIED | `input[type=file][multiple]` in drop-zone; drop-zone.test.ts asserts presence; initDropZone appends after privacy promise |
| DATA-02 | 02-02 | Auto-detect CSV source format via parser registry | ✓ SATISFIED | HomeWizard P1 adapter claims by header presence; registry dispatches to first match |
| DATA-03 | 02-01 | New format = one new file + one import; no central switch | ✓ SATISFIED | noop-stub.ts is the proof; parse.ts has two static imports; registry.ts untouched |
| DATA-04 | 02-02 | UTF-8+BOM, Windows-1252, semicolon delimiter, decimal comma | ✓ SATISFIED | encoding.ts handles BOM+fallback; parse.ts uses `delimiter: ''` (auto-detect); parseKwh normalises decimal comma |
| DATA-05 | 02-02, 02-03 | cumulative vs interval; monotonicity; first-interval flag | ✓ SATISFIED | adapter classifies as `cumulative`; `isMonotonic`/`monotonicity_failRow`/`firstIntervalAnomalyFlag` all populated; carried through fileStats in mergeFiles |
| DATA-06 | 02-01, 02-02 | gridImportKwh and gridExportKwh always non-negative | ✓ SATISFIED | `Math.max(0, delta)` clamp in adapter; all test assertions verify >= 0 |
| DATA-07 | 02-01, 02-02 | All timestamps are UTC Date via TZDate | ✓ SATISFIED | `new Date(new TZDate(..., 'Europe/Amsterdam').getTime())` — never `new Date(string)` |
| DATA-08 | 02-01, 02-02 | Spring=92 and fall=100 intervals; CI fixture tests | ✓ SATISFIED | Both fixture files exist; dst-fixtures.test.ts passes; distinct-timestamp assertion added (CR-01) |
| DATA-09 | 02-01, 02-02 | Parse error names file/row/column/expected | ✓ SATISFIED | ParseRowError class has all four fields; Dutch message string; parse-errors.test.ts asserts all fields |
| DATA-10 | 02-03 | Finer-resolution file wins on overlapping timestamps | ✓ SATISFIED | mergeFiles sorts finest-first; Map skips duplicate keys; merge.test.ts asserts 15-min wins over hourly |
| DATA-11 | 02-03, 02-04 | Sanity readout: file count, rows, period, import, export, gaps | ✓ SATISFIED | renderReadout renders all six DATA-11 fields; readout.test.ts asserts all Dutch labels present |
| DATA-12 | 02-03 | Sub-period filter defaulting to full range | ✓ SATISFIED | filterByPeriod(null, null) returns all; filterByPeriod with dates narrows inclusively. Interactive UI deferred to Phase 4 per plan (D-02). |
| DATA-13 | 02-01, 02-02, 02-04 | worker:true keeps UI non-frozen on large files | ✓ SATISFIED (automated portion) / ? UNCERTAIN (live) | `worker: true` in parse.ts; `worker-src blob:` in CSP. Live 50k-row no-freeze requires human confirmation. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/domain/parsers/homewizard-p1.ts` | 55 | `.replace(',', '.')` — single string replace only replaces first comma; `"1,234,567"` → `"1.234,567"` | ⚠️ Warning | Silent two-orders-of-magnitude corruption on grouped-number NL exports (WR-03, unresolved from code review). NL P1 exports use comma-as-decimal so probability is low but corruption is silent. |
| `src/domain/parsers/homewizard-p1.ts` | 59 | `expected: 'non-negative number'` but `[+-]?` in regex accepts negative values | ⚠️ Warning | Misleading error message if negative absolute reading is rejected by other means; negative readings silently accepted at cell level (WR-02, unresolved from code review). |
| `src/domain/merge.ts` | 29 | `mergeFiles(results: ParseFileResult[])` lacks empty-array guard; callers rely on incidental non-crash | ⚠️ Warning | If all files fail the CSV filter upstream, an empty array reaches mergeFiles; inferDominantCadence returns default 15 with no error (WR-06, unresolved from code review). |
| `src/ui/readout.ts` | 110 | `stat.cadenceMinutes === 60 ? 'Uur' : '15 minuten'` — daily cadence (1440) renders as "15 minuten" | ⚠️ Warning | Daily HomeWizard exports are explicitly supported; user would see "15 minuten" for a daily export (IN-04, unresolved from code review). |
| `src/domain/parsers/homewizard-p1.ts` | 220 | `encoding: 'UTF-8', // placeholder` comment | ℹ️ Info | Not a stub — `parseFile()` overwrites this value with actual detected encoding at line 110. The comment is accurate. No impact. |

**Debt marker scan:** No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified source file. No blockers from debt markers.

### Human Verification Required

#### 1. Sanity Readout Total Accuracy

**Test:** Drop a real HomeWizard P1 CSV onto the live app. Inspect the readout and independently verify the totals.
**Expected:** The six summary fields render with correct values — file count matches files uploaded, rows matches data rows, period shows DD-MM-YYYY for first and last timestamp, import kWh and export kWh match the cumulative-to-delta sum across all rows, gap count is 0 for a complete file.
**Why human:** jsdom tests verify that the labels appear and the structure is correct. They cannot verify that `totalImport = result.samples.reduce(...)` produces a value that matches what a human would calculate from the raw CSV. This requires a real browser with a known file.

#### 2. DATA-09 Error with Partial-Garbage Cell Value

**Test:** Create a CSV where one kWh cell contains `100abc` (WR-01 was fixed to reject this). Drop the file and observe the error message.
**Expected:** The error panel shows the file name, row number, column name, and expected format. The value `100abc` is rejected (the strict regex `^[+-]?(\d+\.?\d*|\.\d+)$` does not match `100abc`). The message is in Dutch.
**Why human:** The jsdom parse-errors tests use `NOT-A-NUMBER` as the bad value, which would have failed even under the old `parseFloat` implementation. Verifying that `100abc` is actually rejected (not accepted as 100) requires running the adapter with that specific input via the live UI or a targeted test. The regex is correct (verified by inspection) but the integration path through `parseFile()` with a real file has not been exercised with this specific partial-garbage pattern.

#### 3. DATA-13 — 50k+ Row File Does Not Freeze the UI

**Test:** Run `npm run dev`. Drop a CSV file with 50,000+ rows onto the drop zone. Observe UI responsiveness and DevTools Network tab.
**Expected:** The UI stays interactive during parsing; "Bezig met verwerken..." appears and the page does not freeze. DevTools Network tab shows zero requests during the parse operation.
**Why human:** Worker thread behavior and UI responsiveness under a real large file cannot be asserted in a jsdom test environment. The Plan 04 Task 3 human checkpoint was approved previously, but this is the independent verification pass.

### Gaps Summary

No automated gaps — all 7 ROADMAP success criteria have automated evidence. The three human verification items above are required before final PASS because:
1. Live readout total accuracy (SC-3 of ROADMAP)
2. DATA-09 with partial-garbage value (completeness check of WR-01 fix)
3. DATA-13 worker no-freeze (SC-6 of ROADMAP — live worker behavior)

The four unresolved code-review warnings (WR-02, WR-03, WR-06, IN-04) are advisory-level issues that do not block the phase goal but should be tracked for future cleanup:
- **WR-02/WR-03**: Numeric parsing edge cases (misleading error message and single-comma replace) — unlikely to affect NL P1 data in practice
- **WR-06**: Empty-array guard in mergeFiles — relies on caller guarantee that at least one file was successfully parsed
- **IN-04**: Readout cadence label — "15 minuten" shown for daily exports — cosmetic but factually wrong

---

_Verified: 2026-06-09T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
