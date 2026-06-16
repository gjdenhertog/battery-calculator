---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
verified: 2026-06-13T21:45:00Z
resolved: 2026-06-16T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
resolution: |
  All five human_verification items were confirmed during Phase 6's blocking live
  human-verify (06-03 Task 3), which the user APPROVED, exercised through the real
  Comlink worker on the current shipped UI: (1) disclaimer 'i' expansion + visual
  hierarchy — confirmed (Phase 6 made saldering opt-in OFF by default, superseding
  the Phase 4 always-side-by-side layout, but the disclaimer/copy and primary-vs-
  muted styling were verified in the ON state); (2) cadence-banner-above-table —
  unchanged from Phase 4 and present; (3) in-flight interactivity (SIM-08) — the
  user verified add/edit/remove + saldering toggle recompute stays responsive with
  no freeze; (4) picker↔table↔chart color consistency (COMP-04) — explicitly
  verified across table AND charts including order-based reflow on removal; (5)
  zero network requests + zero CSP violations — the user confirmed zero console
  errors and zero CSV-bearing requests, backed by CSP connect-src 'none' + the
  green CI privacy guard. Resolved at v1.0 milestone close.
human_verification:
  - test: "Upload a CSV and verify the battery picker shows Sessy 5 pre-selected before upload, the table renders zonder/met saldering side-by-side, and the disclaimer 'i' button expands the correct text"
    expected: "Battery picker visible on load with Sessy 5 checked; after CSV upload the table shows all columns in correct order (zonder saldering primary, met saldering muted); 'i' button reveals COMP-06 disclaimer text mentioning 64%, terugleverkosten, and 50%/2030"
    why_human: "Column ordering, disclaimer expansion, and visual hierarchy (primary vs muted) can only be confirmed by visual inspection in a real browser"
  - test: "Upload a daily-granularity fixture and check coarse-cadence banner placement"
    expected: "A cadence banner appears ABOVE the table (not below) when coarseCadenceWarning is true in the SimResult"
    why_human: "DOM position relative to table is rendered at runtime; the jsdom tests assert the element exists but live browser confirms visual position"
  - test: "Select/deselect batteries rapidly while a compute is in-flight; confirm UI stays interactive"
    expected: "'Rekenen...' indicator appears above the stale (dimmed) table; controls remain clickable; no jank or UI freeze > 200ms; results update correctly after compute"
    why_human: "SIM-08 interactivity requirement requires real browser + Comlink worker timing; jsdom tests do not exercise the live worker roundtrip"
  - test: "Confirm per-battery color is consistent between picker swatch and table row swatch"
    expected: "The first selected battery uses color-battery-1 in both the picker card swatch and the table row swatch; toggling selection order changes swatch assignment consistently"
    why_human: "COMP-04 color consistency between picker and table swatch requires visual confirmation that CSS token values render identically in both contexts"
  - test: "Verify zero network requests and zero CSP violations after CSV upload and compute"
    expected: "DevTools Network tab shows no third-party requests; Console shows zero CSP violation messages after uploading a CSV and triggering a recompute"
    why_human: "Privacy invariant (connect-src 'none') and worker-src CSP correctness in production build can only be confirmed by browser inspection of the emitted HTML + network activity"
---

# Phase 04: Comparison Engine Verification Report

**Phase Goal:** The differentiator — multi-battery side-by-side comparison from the user's own CSV — lands as a working UI on top of the proven simulator. Reactive state (signals), parser worker, simulator worker (Comlink), comparison table with saldering on/off as side-by-side columns per battery, headline metric "kWh grid import avoided", marginal capture rate, per-row leader highlighting, period coverage indicator.

**Verified:** 2026-06-13T21:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can drop a CSV, pick up to 5 batteries (catalog + optional custom), and see a comparison table whose headline column for each battery is "kWh grid import avoided" — placed first, with self-consumption % shown as a secondary column | ✓ VERIFIED | `comparison-table.ts:106-162` builds thead with "kWh netto-import vermeden" as the spanning group header (colspan=2, first column group). `avoidedOff` and `avoidedOn` columns placed first in DOM order (lines 155-168, 234-264). `battery-picker.ts:383-494` renders all `BATTERY_CATALOG` entries as spec cards + custom card; `selectedBatteries` signal capped at 5 (`MAX_SELECTED = 5`, line 21). `signals.ts:38` pre-selects Sessy 5. |
| 2 | The comparison table shows saldering-ON and saldering-OFF scenarios side-by-side as two columns per battery (no re-run, no toggle that re-computes); a short disclaimer near these columns notes the 2026 64% cap, terugleverkosten, and the 50% floor through 2030 | ✓ VERIFIED | Both columns rendered simultaneously in every `renderTable()` call (lines 234-264): `zonder saldering` with class `col-primary`, `met saldering` with class `col-muted`. No toggle that re-triggers compute. Disclaimer text at lines 25-31 verbatim: "64% van het leveringstarief" (line 27), "Terugleverkosten betaal je" (line 28), "50% van het kale leveringstarief blijft gelden tot en met 2030" (line 29). Disclaimer hidden by default (`hidden` attribute), toggled by "i" button (lines 318-328). |
| 3 | The table includes a "marginal capture rate" column (`shiftedKwh / capacityKwh`) so diminishing returns are visible; each metric column highlights the per-row leader without synthesizing a "best battery" verdict | ✓ VERIFIED | `metrics.ts:84-85`: `marginalBenutting = shiftedKwh / usableCapacityKwh` with guard when `usableCapacityKwh < 0.1`. Column rendered at lines 302-309 in comparison-table.ts. `detectLeaders()` in `metrics.ts:111-129` returns per-column best index only; no "overall winner" field. `table-cell--leader` class applied per-column-per-row at line 190. No "beste batterij" string anywhere in the codebase. |
| 4 | While the simulator is running, the UI remains interactive (controls do not lock, no dropped frames > 200ms) and a small "Rekenen…" indicator is visible; the simulator + comparison aggregator execute inside a Web Worker via Comlink, while the same pure functions still pass Vitest unit tests without a worker | ✓ VERIFIED (automated portion) | `sim-worker.ts` (11 lines): Comlink.expose({ runComparison }) wraps the pure function. `app-state.ts:56,62`: worker singleton constructed once at module scope; `simApi = Comlink.wrap(...)` for cross-thread calls. `comparison-table.ts:71-82`: `renderComputeIndicator()` adds `<p class="compute-indicator" aria-live="polite" aria-busy="true">Rekenen...</p>`. `comparison-table.ts:424-431`: `results-stale` class applied to table wrapper while computing (opacity 0.5, pointer-events none per `comparison-table.css:94-96`). No input locking. `tests/sim-worker-contract.test.ts`: imports `runComparison` directly from `../src/domain/compare` — 290 tests pass. Interactive behaviour under real Comlink timing requires human verify. |
| 5 | The results panel displays the dataset's period coverage ("N dagen aan data") alongside the table, and every reported number is framed as "over de periode die je hebt geüpload" — no auto-extrapolation to /year or /month anywhere in the UI | ✓ VERIFIED | `period-control.ts:55`: `updateCoverageIndicator` renders "1 dag aan data" (singular) or "${N} dagen aan data" (plural) from `coverageDays.value`. Framing note at line 143: "Alle getallen gelden over de periode die je hebt geüpload." `comparison-table.ts` contains no "/jaar" or "/maand" string (confirmed by grep; "jaarverrekening" in disclaimer is descriptive of the saldering mechanism, not an extrapolation claim). Period control framing note confirmed no "/jaar"/"/maand" by grep. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/workers/sim-worker.ts` | Comlink worker entry exposing runComparison | ✓ VERIFIED | 11 lines; `Comlink.expose({ runComparison })`; imports from `../domain/compare` |
| `src/state/signals.ts` | 8 writable signals + 3 computeds, worker-free | ✓ VERIFIED | 95 lines; all 8 signals + filteredSamples/coverageDays/activeBatteries computeds |
| `src/state/app-state.ts` | Worker singleton + scheduleRecompute + generation guard | ✓ VERIFIED | Singleton at line 56; `_generation` + `myGen` guard at lines 76,123,134; `scheduleRecompute` exported |
| `src/helpers/metrics.ts` | deriveMetrics, avoidedWithoutSaldering, avoidedWithSaldering, detectLeaders | ✓ VERIFIED | All exports present; D-02 negative avoidedOn computed un-floored (line 29); HIGHER_IS_BETTER Set; detectLeaders with MIN/MAX logic |
| `src/helpers/color.ts` | colorFor + colorSlotFor with 5-slot palette | ✓ VERIFIED | Both functions exported; capped at `Math.min(idx+1, COLOR_SLOTS.length)` (WR-03 fix applied) |
| `src/helpers/format.ts` | formatKwh, formatPct, formatRatio, formatDate, formatCount | ✓ VERIFIED | All 5 functions exported; formatKwh uses `toFixed(1)` |
| `src/ui/comparison-table.ts` | Reactive table renderer with all COMP-01..08 behaviors | ✓ VERIFIED | 474 lines; effect-driven; saldering pair, leaders, negative handling, disclaimer, cadence banner, stale-dim, Rekenen indicator |
| `src/ui/period-control.ts` | Date inputs + coverage indicator (DATA-12) | ✓ VERIFIED | Full-range defaults from `fullRange()`; `coverageDays` reactive indicator; `teardownPeriodControl` exported (WR-02 fix applied) |
| `src/ui/battery-picker.ts` | initBatteryPicker with catalog cards + custom card | ✓ VERIFIED | Renders all BATTERY_CATALOG entries; Sessy 5 pre-selected; custom card with validation; max-5 cap |
| `src/main.ts` | Full Phase 4 init wiring | ✓ VERIFIED | `initBatteryPicker`, `initPeriodControl`, `initComparisonTable` all called; dispose captured with HMR teardown (WR-01 fix applied); all 4 CSS files imported |
| `src/constants/csp.ts` | `worker-src 'self' blob:` directive | ✓ VERIFIED | Line 28: `"worker-src 'self' blob:"` — permits both Comlink asset chunk ('self') and PapaParse blob worker (blob:) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/workers/sim-worker.ts` | `src/domain/compare.ts` | `import { runComparison }` | ✓ WIRED | Line 9: `import { runComparison } from '../domain/compare'` |
| `src/state/app-state.ts` | `src/workers/sim-worker.ts` | `import SimWorker from '...?worker' + Comlink.wrap` | ✓ WIRED | Lines 16-17,56,62: `?worker` import + singleton construction + `Comlink.wrap` |
| `src/state/app-state.ts` | `src/domain/period-filter.ts` | `filterByPeriod in filteredSamples computed` | ✓ WIRED | `signals.ts:27,69-71`: `filterByPeriod` imported and called in `filteredSamples` computed |
| `src/ui/drop-zone.ts` | `src/state/app-state.ts` | `parsedSamples.value = mergeResult.samples` | ✓ WIRED | `drop-zone.ts:116`: atomic batch write of parsedSamples + periodFrom + periodTo (CR-02 fix applied) |
| `src/ui/comparison-table.ts` | `src/helpers/metrics.ts` | `deriveMetrics + detectLeaders per render` | ✓ WIRED | Lines 16,212,344-345: imported and called in `buildBatteryRow` and `renderTable` |
| `src/ui/comparison-table.ts` | `src/state/app-state.ts` | `effect reads simResults/activeBatteries/isComputing/computeError` | ✓ WIRED | Lines 15,417-421: all 4 signals read inside the reactive effect |
| `src/ui/period-control.ts` | `src/state/app-state.ts` | `writes periodFrom/periodTo, reads coverageDays` | ✓ WIRED | Lines 17-20: `periodFrom`, `periodTo`, `coverageDays`, `scheduleRecompute` imported; written in event handlers and read in effects |
| `src/styles/global.css` / `src/main.ts` | Phase 4 CSS files | `import` in main.ts | ✓ WIRED | `main.ts:3-5`: all 3 Phase 4 CSS files imported directly |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `comparison-table.ts` | `simResults` | `simApi.runComparison(filteredSamples.value, activeBatteries.value)` via Comlink | Yes — real worker call, not static return | ✓ FLOWING |
| `period-control.ts` | `coverageDays.value` | `computed(() => Math.ceil(...))` from `filteredSamples` which derives from `parsedSamples` | Yes — real CSV parse → signal chain | ✓ FLOWING |
| `battery-picker.ts` | `selectedBatteries.value` | Signal initialized from `BATTERY_CATALOG[0]`; updated by checkbox events | Yes — reactive; catalog is real bundled data | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (290 tests, 22 files) | `npm test -- --run` | 290 passed, 0 failed | ✓ PASS |
| Production build emits Comlink worker chunk | `npm run build && ls dist/assets/` | `sim-worker-DazZ4rAZ.js` present; `index-dmzvOGC8.js` 63 KB | ✓ PASS |
| Worker chunk name contains "worker" | `ls dist/assets/ \| grep -iE worker` | `sim-worker-DazZ4rAZ.js` | ✓ PASS |
| No `/jaar` or `/maand` in UI source files | `grep -n "jaar\|maand" comparison-table.ts period-control.ts` | Only "jaarverrekening" in disclaimer copy (descriptive, not extrapolation) and comments | ✓ PASS |
| Singleton worker: exactly 1 `new SimWorker()` | `grep -c "new SimWorker()" src/state/app-state.ts` | `1` | ✓ PASS |
| Generation guard present | `grep "_generation\|myGen" app-state.ts` | Both `_generation` declaration and `myGen` capture present | ✓ PASS |
| No inline style assignments | `grep -c '.style.' comparison-table.ts period-control.ts battery-picker.ts` | `0` for each | ✓ PASS |
| Teardown exported from period-control | `grep teardownPeriodControl period-control.ts` | Line 69: `export function teardownPeriodControl()` | ✓ PASS |
| CSP worker-src directive | `grep "worker-src" src/constants/csp.ts` | `"worker-src 'self' blob:"` | ✓ PASS |
| connect-src privacy invariant | `grep "connect-src" src/constants/csp.ts` | `"connect-src 'none'"` | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` probes defined for this phase. Build and test commands above serve as the equivalent confirmation.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SIM-07 | 04-01, 04-03, 04-06 | Simulator + comparison aggregator in Web Worker (Comlink); same pure functions unit-tested without worker | ✓ SATISFIED | `sim-worker.ts` (Comlink expose), `app-state.ts` (singleton + simApi), `sim-worker-contract.test.ts` (290 tests pass) |
| SIM-08 | 04-05, 04-06 | UI interactive while computing; recompute indicator visible | ✓ SATISFIED (code verified; browser behavior human-needed) | `comparison-table.ts`: `compute-indicator` + `results-stale` class; `isComputing` signal; no input locking |
| COMP-01 | 04-02, 04-05 | Per-battery: kWh avoided (headline), self-consumption %, kWh shifted, residual import, residual feed-in, marginal capture rate | ✓ SATISFIED | All 7 columns rendered in `renderTable()` (lines 233-309); `deriveMetrics()` computes all 7 fields |
| COMP-02 | 04-05 | Headline metric "kWh grid import avoided" placed first; self-consumption % secondary | ✓ SATISFIED | "kWh netto-import vermeden" is the first (spanning) column group; avoidedOff/avoidedOn columns 2-3 in DOM order |
| COMP-03 | 04-02, 04-05 | Per metric column, highlight the per-row leader; no "best battery" verdict | ✓ SATISFIED | `detectLeaders()` returns per-column index; `table-cell--leader` class applied per-column; no synthesized winner |
| COMP-04 | 04-02, 04-04, 04-06 | Consistent color per selected battery across table and charts | ✓ SATISFIED (code) / human-needed (visual) | `colorSlotFor()` with `Math.min(idx+1, 5)` cap; same function called in picker and table; picker swatch class matches table row swatch class |
| COMP-05 | 04-05 | Saldering ON and OFF shown side-by-side per battery; no re-run | ✓ SATISFIED | Both columns rendered in single `renderTable()` call from single effect; no separate "saldering toggle" re-trigger |
| COMP-06 | 04-05 | Short disclaimer near saldering columns: 2026 64% cap, terugleverkosten, 50% floor through 2030 | ✓ SATISFIED | `SALDERING_DISCLAIMER_COPY` includes all 3 elements (lines 25-31); hidden by default, toggled by "i" button |
| COMP-07 | 04-05 | All numbers framed as "over the period you uploaded" — no /year or /month extrapolation | ✓ SATISFIED | Framing note at `period-control.ts:143`; no "/jaar" or "/maand" in results DOM (confirmed by grep) |
| COMP-08 | 04-05 | Period coverage indicator ("N dagen aan data") alongside the results | ✓ SATISFIED | `period-control.ts:55`: reactive coverage text from `coverageDays.value`; singular/plural Dutch text |
| DATA-12 | 04-03, 04-05 | User can narrow analysis to a sub-period of the merged data | ✓ SATISFIED | `period-control.ts`: date inputs write `periodFrom`/`periodTo`; `filteredSamples` computed narrows via `filterByPeriod`; defaults to full range (D-19) |

All 11 Phase 4 requirements (SIM-07, SIM-08, COMP-01..COMP-08, DATA-12) are satisfied.

### Anti-Patterns Found

All 7 issues from the code review (3 Critical + 4 Warning) were fixed in commits `792d4d2`, `50807d1`, `b542cf9`, `c89c65e`, `03e56a4`, `31577d4`:

| Fix | Pattern | Severity | Status |
|-----|---------|----------|--------|
| CR-01 | `isComputing` stranded at `true` in early-bail path | Was Blocker | Fixed in `792d4d2`: batch reset in early-bail guard (app-state.ts:112-119) |
| CR-02 | `parsedSamples` written outside the batch with period signals | Was Blocker | Fixed in `50807d1`: single `batch()` wrapping all three signal writes (drop-zone.ts:115-122) |
| CR-03 | `clearStatusAndError` used `querySelector` (removes only first) | Was Blocker | Fixed in `50807d1`: `querySelectorAll(...).forEach(el => el.remove())` (drop-zone.ts:57) |
| WR-01 | `initComparisonTable` dispose discarded in main.ts | Was Warning | Fixed in `b542cf9`: dispose captured; HMR teardown registered (main.ts:40-43) |
| WR-02 | `period-control.ts` no teardown export; effects leaked in tests | Was Warning | Fixed in `c89c65e`: `teardownPeriodControl()` exported; called in test `afterEach` |
| WR-03 | `colorSlotFor` returned slot 6 for custom battery when 5 catalog batteries selected | Was Warning | Fixed in `03e56a4`: `Math.min(idx+1, COLOR_SLOTS.length)` cap (color.ts:44) |
| WR-04 | `avoidedOn === 0.0` rendered in destructive red (misleading) | Was Warning | Fixed in `31577d4`: condition changed to strictly `< 0` for red color (comparison-table.ts:249) |

No remaining debt markers (TBD, FIXME, XXX) found in any Phase 4 modified files.

No unreferenced TODO/PLACEHOLDER/HACK patterns found in Phase 4 modified files.

### Human Verification Required

Phase 04 Plan 06 Task 2 was a blocking human-verify checkpoint. The SUMMARY.md (04-06-SUMMARY.md) records that the walkthrough was approved by the developer during execution with the following items confirmed:

- Zero CSP/network violations on load
- Sessy 5 pre-selected on load before upload
- zonder/met saldering columns in correct order
- Leaders highlighted
- Negatives shown as-is with U+2212 minus
- Cadence banner present on daily data
- "Rekenen..." indicator visible without UI lock
- Consistent per-battery swatch color across picker and table

However, the code review commits (`792d4d2` through `31577d4`) were applied AFTER the human-verify walkthrough. The fixes change behavior visible in the browser (CR-01 prevents UI freeze on deselect-all, WR-04 changes red coloring logic, WR-03 fixes invisible 6th swatch). These behaviors need to be re-confirmed in the browser.

### 1. Interactivity after review fixes (SIM-08 / CR-01)

**Test:** Upload a CSV, start a compute, then immediately deselect all batteries while compute is in-flight.
**Expected:** The "Rekenen..." indicator clears and the table shows the empty state — NOT a permanently frozen "Rekenen..." state. The CR-01 fix ensures `isComputing` is reset in the early-bail path.
**Why human:** The isComputing stranding scenario requires real Comlink timing and the main-thread event loop to reproduce; jsdom worker mock never resolves.

### 2. AvoidedOn zero boundary rendering (WR-04)

**Test:** Run a simulation scenario where any battery's met-saldering value computes to exactly 0.0 kWh (or close to it).
**Expected:** A value of 0.0 kWh is displayed in NEUTRAL color (not red/destructive). Only strictly negative values (< 0) render in red with the U+2212 minus prefix.
**Why human:** The zero boundary case depends on specific CSV data; jsdom tests cover the negative case but the exact-zero case requires real data where it occurs.

### 3. Color consistency picker ↔ table after WR-03 fix

**Test:** Select all 5 catalog batteries plus configure a custom battery (6th active battery). Check the comparison table.
**Expected:** All 6 rows show a swatch. The custom battery row shows swatch color matching slot 1 (the cap fallback), NOT an invisible circle. The picker swatch (which uses the same `colorSlotFor` function) also shows a visible color.
**Why human:** The CSS class `.battery-swatch--6` does not exist; the WR-03 fix caps at slot 5 in code. Visual confirmation that the swatch is visible for the 6th battery is needed.

### 4. End-to-end privacy: zero network requests + zero CSP violations

**Test:** Run `npm run build && npm run preview`, open the app in a browser, open DevTools Network + Console. Upload `tests/fixtures/homewizard-real-sample-15-minutes.csv`. Trigger a full comparison compute.
**Expected:** Network tab shows zero requests during or after CSV upload and compute. Console shows zero CSP violation messages. The Comlink worker operates entirely within the page's CSP sandbox.
**Why human:** Worker-src CSP correctness in the production emitted HTML (`dist/index.html`) can only be confirmed by browser inspection — the meta CSP tag must be present and the worker URL must match `'self'`.

### 5. Column order + visual hierarchy verified after all fixes

**Test:** Upload a CSV, observe the comparison table with at least 2 batteries.
**Expected:** "kWh netto-import vermeden" is the first (leftmost) column group with two sub-columns "zonder saldering" (primary, no special muted styling) and "met saldering" (visually muted). Click the "i" button — the disclaimer panel expands below the table. The period coverage indicator shows "N dagen aan data" with no "/jaar" or "/maand" anywhere on the page.
**Why human:** Visual hierarchy (primary vs muted column styling, disclaimer expansion) requires browser rendering; the jsdom tests verify DOM structure but not rendered visual appearance.

---

## Gaps Summary

No gaps found. All 5 must-have truths are VERIFIED by direct code inspection. All 11 requirements are SATISFIED. All 7 code review issues are fixed. The test suite passes 290 tests and the production build emits the Comlink worker chunk.

Status is `human_needed` because: (a) five human verification items exist from Plan 06's blocking checkpoint, (b) three of those items cover behaviors altered by post-walkthrough review fixes (CR-01, WR-03, WR-04), and (c) runtime browser behaviors (CSP, interactivity, visual hierarchy) are outside the scope of automated verification.

---

_Verified: 2026-06-13T21:45:00Z_
_Verifier: Claude (gsd-verifier)_
