---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
plan: "05"
subsystem: ui-comparison-table
tags: [comparison-table, period-control, saldering, signals, jsdom, reactive-ui]
dependency_graph:
  requires:
    - src/state/app-state.ts (simResults, activeBatteries, isComputing, computeError, parsedSamples, periodFrom, periodTo, coverageDays, scheduleRecompute — plan 04-03)
    - src/helpers/metrics.ts (deriveMetrics, detectLeaders, DerivedMetrics — plan 04-02)
    - src/helpers/color.ts (colorSlotFor — plan 04-02)
    - src/helpers/format.ts (formatKwh, formatPct, formatRatio — plan 04-02)
    - src/domain/period-filter.ts (fullRange)
    - src/domain/types.ts (SimResult, BatteryConfig)
    - src/shell.ts (renderShell — #results-region mount point)
  provides:
    - src/ui/comparison-table.ts (initComparisonTable — reactive table renderer)
    - src/ui/period-control.ts (initPeriodControl — date inputs + coverage indicator)
    - src/styles/comparison-table.css (table, leader, negative, muted, swatch, disclaimer)
    - src/styles/results-region.css (banner, indicator, empty, error, period styles)
  affects:
    - src/main.ts (Phase 04-06 wires initPeriodControl + initComparisonTable into #results-region)
    - Phase 05 charts (COMP-08 — colorSlotFor contract stable; data-metric hooks for CSS reflow)
tech_stack:
  added: []
  patterns:
    - effect() returning dispose fn (Pitfall 3) — initComparisonTable returns dispose
    - _disposeFns array pattern for multiple effects per module (period-control)
    - DOM rebuilt via container.innerHTML = '' + imperativeCreateElement (readout.ts pattern)
    - .textContent for all user-derived strings (battery name) — XSS safe (T-04-13)
    - classList.toggle('results-stale', computing) — no inline style (T-04-14)
    - U+2212 proper minus sign for negative avoidedOn values (D-02)
    - hidden attribute for disclaimer default state (not display:none)
key_files:
  created:
    - src/ui/comparison-table.ts
    - src/ui/period-control.ts
    - src/styles/comparison-table.css
    - src/styles/results-region.css
    - tests/comparison-table.test.ts
    - tests/period-control.test.ts
  modified: []
decisions:
  - "initComparisonTable returns the effect dispose fn directly (single effect — no _disposeFns array needed)"
  - "toDateInputValue uses UTC components (getUTCFullYear/Month/Date) to avoid timezone offset issues with date input value format"
  - "avoidedOn <= 0 (not just < 0) triggers .table-cell--negative — catches the exact-zero case per D-02 honesty invariant"
  - "td[data-metric] selector (not [data-metric]) used in tests to avoid matching th header elements that also carry data-metric attributes"
  - "Coverage indicator updates via a separate disposed effect from parsedSamples effect — separation of concerns"
metrics:
  duration_minutes: 18
  completed_date: "2026-06-11"
  tasks_completed: 2
  files_created: 6
---

# Phase 04 Plan 05: Comparison Table + Period Control Summary

Reactive comparison table (OFF-led saldering pair, per-column leaders, un-floored negative ON, disclaimer toggle, cadence banner, stale-dim) and period-narrowing control (full-range defaults, live coverage indicator, date-driven recompute); 28 jsdom tests green; build green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | comparison-table.ts — reactive table, leaders, saldering, disclaimer, banner, compute states | 9bb7542 | src/ui/comparison-table.ts, src/styles/comparison-table.css, src/styles/results-region.css, tests/comparison-table.test.ts |
| 2 | period-control.ts — date inputs + live coverage indicator (DATA-12) | 730743c | src/ui/period-control.ts, tests/period-control.test.ts |

## What Was Built

### Task 1: comparison-table.ts (commit 9bb7542)

**`src/ui/comparison-table.ts`** — reactive comparison table driven by `effect()` on `simResults`, `activeBatteries`, `isComputing`, `computeError` signals.

Key behaviors:
- **Column order** (D-10, COMP-02): Batterij | zonder saldering (primary) | met saldering (muted) | Zelfverbruik % | Verschoven kWh | Rest-import kWh | Rest-teruglevering kWh | Marginale benutting
- **Per-column leaders** (COMP-03, D-11): `detectLeaders()` returns best-per-column index; cells receive `.table-cell--leader` (semibold + surface tint) — neutral, not battery identity color
- **Negative saldering-ON** (D-02): `avoidedOn <= 0` renders with U+2212 proper minus + `.table-cell--negative` (destructive color) — never floored to 0; honesty invariant
- **Saldering disclaimer** (COMP-06): `<div id="saldering-disclaimer" hidden>` with verbatim COMP-06 copy; "i" button toggles `hidden` + `aria-expanded`
- **Coarse-cadence banner** (D-13): `<div role="alert" class="cadence-banner">` rendered ABOVE the table when any `coarseCadenceWarning === true`
- **Stale-dim + indicator** (SIM-08): `.results-stale` (opacity 0.5, pointer-events none) on the scroll wrapper while computing; `<p class="compute-indicator" aria-live="polite" aria-busy="true">Rekenen...</p>` shown above the table
- **XSS** (T-04-13): all battery names via `.textContent`; zero `.style.` assignments
- **No extrapolation** (COMP-07): no "/jaar" or "/maand" anywhere in output

**`src/styles/comparison-table.css`**: `.comparison-table`, `.col-primary`, `.col-muted`, `.col-saldering-group__header`, `.table-cell--leader`, `.table-cell--negative`, `.battery-row__name`, `.battery-row__label`, `.battery-swatch--1..5`, `.table-scroll-wrapper`, `.saldering-disclaimer`, `.saldering-info-btn`, `.results-stale`

**`src/styles/results-region.css`**: `.results-section-heading`, `.cadence-banner`, `.cadence-banner__text`, `.compute-indicator`, `.results-empty`, `.results-error`, `.period-coverage`, `.period-input`

**`tests/comparison-table.test.ts`** — 16 jsdom assertions covering all key contracts.

### Task 2: period-control.ts (commit 730743c)

**`src/ui/period-control.ts`** — `<section aria-label="Analyseperiode">` with `<h2>`, two `<input type="date">` fields, coverage indicator, and framing note.

Key behaviors:
- **Full-range defaults** (D-19): reactive effect on `parsedSamples` sets `min`/`max`/`value` on both inputs to `fullRange()` boundaries using `toDateInputValue()` (UTC-safe YYYY-MM-DD formatter)
- **Date change events**: `change` listener parses input value, clamps Tot to Van when Van > Tot (interaction contract), writes `periodFrom.value`/`periodTo.value`, calls `scheduleRecompute(true)` (immediate — discrete event per D-07)
- **Coverage indicator** (COMP-08): separate disposed effect on `coverageDays.value` — "1 dag aan data" (singular) / "{N} dagen aan data" (plural)
- **No extrapolation** (COMP-07): framing note says "de periode die je hebt geüpload" with no "/jaar"/"/maand"

**`tests/period-control.test.ts`** — 12 jsdom assertions covering full-range defaults, coverage text, periodFrom/periodTo signal writes, DOM structure.

## Verification Results

```
grep -c '\.style\.' src/ui/comparison-table.ts  → 0  (T-04-14 gate)
grep -c '\.style\.' src/ui/period-control.ts    → 0  (T-04-14 gate)
npm test -- --run tests/comparison-table.test.ts tests/period-control.test.ts
  → 28 passed (16 + 12)
npm test -- --run                               → 272 passed (21 test files)
npm run build                                   → 0 errors; 47.32 kB index bundle
```

## Deviations from Plan

None — plan executed exactly as written.

The only noteworthy implementation choices:
1. `td[data-metric]` selector in tests (not `[data-metric]`) to avoid matching `<th>` elements that also carry `data-metric` attributes — discovered during test run, fixed immediately.
2. Removed unused `coverageDays` import from test file (TypeScript TS6133 caught it at build time).

Both were minor refinements during the implementation iteration, not plan deviations.

## Known Stubs

None — both modules are fully wired to real signals. `initPeriodControl` reacts to live `parsedSamples` and `coverageDays` signals; `initComparisonTable` reacts to live `simResults` and `activeBatteries` signals.

## Threat Surface Scan

No new threat surface beyond what was modeled in the plan's threat register:

- **T-04-13** (XSS via custom battery name): mitigated — battery name rendered via `.textContent` in `buildBatteryRow()`; jsdom test asserts `querySelectorAll('script').length === 0`
- **T-04-14** (inline style injection): mitigated — 0 `.style.` assignments; all visual state via CSS class swaps; grep gate verified
- **T-04-15** (misleading floored saldering value): mitigated — `avoidedOn <= 0` renders the actual value with `.table-cell--negative`; not floored to "0.0 kWh"; jsdom test asserts cell text differs from "0.0 kWh"
- **T-04-16** (extrapolation): mitigated — no "/jaar" or "/maand" in output; jsdom test asserts both strings absent from container textContent

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/ui/comparison-table.ts exists | FOUND |
| src/ui/period-control.ts exists | FOUND |
| src/styles/comparison-table.css exists | FOUND |
| src/styles/results-region.css exists | FOUND |
| tests/comparison-table.test.ts exists | FOUND |
| tests/period-control.test.ts exists | FOUND |
| commit 9bb7542 exists | FOUND |
| commit 730743c exists | FOUND |
| npm test (28 tests, 2 files) → 0 failures | PASSED |
| npm test -- --run (272 tests, 21 files) → 0 failures | PASSED |
| npm run build → 0 errors | PASSED |
| grep -c '.style.' src/ui/comparison-table.ts → 0 | PASSED |
| grep -c '.style.' src/ui/period-control.ts → 0 | PASSED |
