---
phase: 05-visualizations-polish-transparent-assumptions-ui
plan: "03"
subsystem: ui-charts
tags: [uplot, monthly-bars, flow-chart, grouped-bars, step-lines, VIZ-01, VIZ-02, VIZ-03, VIZ-04, jsdom, tdd]
dependency_graph:
  requires:
    - 05-01 (bucketByMonth, selectRepresentativeWeek, formatAxisKwh, uPlot installed)
    - 05-02 (charts.css, tooltips.css — CSS classes referenced by chart adapters)
  provides:
    - src/ui/charts/monthly-bars.ts (initMonthlyBarsChart — grouped-bar adapter)
    - src/ui/charts/flow-chart.ts (initFlowChart — step-line adapter + dropdown)
    - tests/monthly-bars.test.ts (jsdom contract lock)
    - tests/flow-chart.test.ts (jsdom contract lock)
    - tests/setup.ts extended with ResizeObserver mock
  affects:
    - Plan 05 (main.ts wiring — mounts these adapters into #results-region)
tech_stack:
  added: []
  patterns:
    - uPlot.paths.bars() one series per battery, side-by-side grouped per month (native grouping)
    - uPlot.paths.stepped({ align:1 }) for 4-series step-line flow chart
    - disp.fill per-bar opacity keyed off MonthBucket.isPartial (no second series)
    - effect() subscription pattern from comparison-table.ts (create once, setData on update)
    - ResizeObserver once + guarded setSize (Pitfall 7 guard)
    - getComputedStyle CSS var resolution at mount time (Pitfall 2 guard)
    - vi.mock factory-internal mock pattern for uPlot in jsdom tests
key_files:
  created:
    - src/ui/charts/monthly-bars.ts
    - src/ui/charts/flow-chart.ts
    - tests/monthly-bars.test.ts
    - tests/flow-chart.test.ts
  modified:
    - tests/setup.ts (ResizeObserver mock added)
decisions:
  - "Grouped-bar layout: one uPlot.paths.bars() series per battery on shared ordinal x-scale; native multi-series side-by-side (ROADMAP criterion 1 + D-04). No demo seriesBarsPlugin/quadtree/distr."
  - "Partial-month opacity: disp.fill keyed off MonthBucket.isPartial within same series (D-05). No second series, no second pass."
  - "Ordinal month axis labels: axes[0].values index->monthLabel mapping with Math.round guard (Pattern 3a)."
  - "ResizeObserver mock added to tests/setup.ts (Rule 3 auto-fix: blocking issue for jsdom chart tests)."
  - "flow-chart dropdown re-render: destroy+recreate uPlot on battery change (series-1 stroke changes); setData-only on same-battery signal update."
  - "vi.mock factory-internal pattern: all mock setup inline in vi.mock() factory to avoid hoisting trap with module-level vi.fn() variables."
metrics:
  duration: "~10 minutes"
  completed: "2026-06-14"
  tasks: 2
  files: 5
---

# Phase 05 Plan 03: uPlot Chart DOM Adapters Summary

**One-liner:** Two uPlot chart adapters — monthly grouped-bar (one bars() series per battery, grouped side-by-side per month) and sample-week step-line flow chart (4 stepped series, battery dropdown) — both wired via effect() signals and tested in jsdom with 29 new green tests.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | monthly-bars failing tests | 920da24 | tests/monthly-bars.test.ts |
| 1 (GREEN) | initMonthlyBarsChart adapter | f40a646 | src/ui/charts/monthly-bars.ts, tests/monthly-bars.test.ts, tests/setup.ts |
| 2 (RED) | flow-chart failing tests | c8782b2 | tests/flow-chart.test.ts |
| 2 (GREEN) | initFlowChart adapter | f99b8ae | src/ui/charts/flow-chart.ts |

## What Was Built

### Task 1: initMonthlyBarsChart (VIZ-01, VIZ-04)

`src/ui/charts/monthly-bars.ts` — uPlot grouped-bar chart adapter (383 lines):

- **COMMITTED grouped-bar layout (ROADMAP criterion 1 + D-04):** Single chart, one `uPlot.paths.bars()` series per selected battery (2-5), bars drawn side-by-side within each month slot using uPlot's native multi-series bar offsetting. `size: [0.6, 60]`, `align: 0`. No demo plugin (seriesBarsPlugin / quadtree.js / distr.js absent).
- **Ordinal month axis labels (Pattern 3a):** `axes[0].values: (_u, splits) => splits.map(i => monthLabels[Math.round(i)] ?? '')` maps ordinal indices to `MonthBucket.monthLabel`.
- **Partial-month opacity (Pattern 3b / D-05):** `bars()` builder `disp.fill.values` function returns full-alpha (rgba, 80%) for `!isPartial` buckets and lower-alpha (40%) for `isPartial` — within the SAME series, no second pass. `(deels)` label DOM span added.
- **Sparse note (D-06):** When `fullMonthCount < 2`, `.chart-sparse-note` shows "Weinig data — je hebt minder dan twee volledige maanden geupload. Alle staven tonen de werkelijke data, niet een prognose."
- **Colors (COMP-04):** `resolveBatteryColor()` strips `var(...)` and calls `getComputedStyle(document.documentElement).getPropertyValue()` at mount time — hex strings passed to canvas, never CSS vars.
- **Effect pattern (Pitfall 6):** `chart` stored outside effect; `setData()` on signal update; destroy+recreate only when battery count changes.
- **ResizeObserver (Pattern 5):** Created once outside effect, guarded with `if (chart)`, 100ms debounce.
- **XSS:** All battery names via `.textContent`. No `.innerHTML` for variable content. No `.style.` writes.
- **CSS import:** `import 'uplot/dist/uPlot.min.css'` unconditionally at module top.
- **y-axis:** `formatAxisKwh` for tick values (no raw multi-decimal float).

**15 jsdom tests green:** empty state (2), mounted DOM (3), grouped bars (2), legend name (1), sparse-note (3), XSS (1), setData (1), partial-label (1), dispose (1).

### Task 2: initFlowChart (VIZ-02, VIZ-03)

`src/ui/charts/flow-chart.ts` — uPlot 4-series step-line adapter + battery dropdown (481 lines):

- **Four step-line series:** `uPlot.paths.stepped({ align: 1 })` for grid import / teruglevering / laden / ontladen. Never smooth interpolation (VIZ-03).
- **Battery dropdown (D-01):** `<select id="flow-chart-battery">` built via DOM, options via `.textContent`, `addEventListener('change', ...)` wired once when DOM first built.
- **Representative week (D-03):** `selectRepresentativeWeek(trace, 'Europe/Amsterdam')` selects Mon-Sun window with highest `residualExportKwh`. Week caption: "Voorbeeldweek: {weekLabel} — de week met de meeste teruglevering in je data."
- **tzDate (Pattern 4):** `tzDate: (ts) => uPlot.tzDate(ts, 'Europe/Amsterdam')` in opts. x-axis timestamps in SECONDS (`getTime() / 1000` — Pitfall 1 guard).
- **Series colors:** Battery slot color (resolved from CSS var) for grid import; `#71717a` for teruglevering; `#16a34a` for laden; `#d97706` for ontladen.
- **Dropdown change:** Destroys + recreates uPlot for color update on battery change; `setData()` on same-battery signal update.
- **No built-in tooltip:** `cursor: { show: false }`, `legend: { show: false }` — custom DOM legend only (Pitfall 4 / CSP).
- **XSS:** All battery names via `.textContent`. No `.style.` writes. No `setAttribute('style')`.

**14 jsdom tests green:** dispose (1), empty state (1), dropdown (3), stepped-path VIZ-03 (2), week caption (2), section heading (1), dropdown change (1), XSS (1), chart wrapper (1), legend (1).

### tests/setup.ts: ResizeObserver Mock

Added a `ResizeObserverMock` class (no-op stub) to `tests/setup.ts` so that chart adapter tests in jsdom have access to `ResizeObserver` — jsdom does not include it natively. This is a shared setup that benefits any future jsdom chart test.

## Verification

- Full suite: **361 tests, 28 files — all green** (up from 332 / 26 before this plan)
- `npx tsc --noEmit` — clean, no errors
- `grep` checks: `getComputedStyle` in bars adapter, `paths.bars` in bars, `paths.stepped` in flow, `uplot/dist/uPlot.min.css` in both, `monthLabels[` in bars, `isPartial` in bars, `getTime() / 1000` in flow, `Europe/Amsterdam` in flow — all present
- Negative checks: no `seriesBarsPlugin`/`quadtree`/`distr`, no `spline`, no `tooltip: true`, no `.style.` writes, no `setAttribute('style')`, no `Date.getMonth` in adapters — all absent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ResizeObserver mock to tests/setup.ts**

- **Found during:** Task 1 GREEN first test run
- **Issue:** jsdom does not implement `ResizeObserver`. `initMonthlyBarsChart` creates a `ResizeObserver` at function entry (outside the effect, per Pitfall 7 guard), which threw `ReferenceError: ResizeObserver is not defined` in every test.
- **Fix:** Added a `ResizeObserverMock` no-op class to `tests/setup.ts` (the global Vitest setup file), mirroring the existing `WorkerMock` pattern. The mock stubs `observe()`, `unobserve()`, and `disconnect()` as no-ops.
- **Files modified:** tests/setup.ts
- **Commit:** f40a646

**2. [Rule 3 - Blocking] Fixed vi.mock hoisting trap in monthly-bars.test.ts**

- **Found during:** Task 1 GREEN — 8 tests failed after ResizeObserver fix
- **Issue:** The test initially used `const MockUPlot = vi.fn().mockImplementation(...)` at module level, then `vi.mock('uplot', () => ({ default: MockUPlot }))`. Vitest hoists `vi.mock()` calls before variable declarations execute, so `MockUPlot` was `undefined` inside the factory closure. `new uPlot()` returned `undefined`, causing the effect's try/catch to run the error path on every signal update — DOM was never built.
- **Fix:** Moved ALL mock setup inside the `vi.mock('uplot', () => { ... })` factory function. Retrieved the mock reference via `await import('uplot')` after setup. Applied the same pattern to flow-chart.test.ts from the start.
- **Files modified:** tests/monthly-bars.test.ts
- **Commit:** f40a646

## Known Stubs

None — both chart adapters render real computed values from input data. The legend uses actual battery names and colors. The bars use real `shiftedKwh` values from `bucketByMonth`. The flow chart uses real trace data filtered to the representative week.

## Threat Flags

No new threat surface beyond the plan's threat model. Verified:
- T-05-05 (XSS): Battery names via `.textContent` in both legend and dropdown options; tests assert zero `<script>` nodes.
- T-05-06 (inline-style / CSP): No `.style.` property writes in either adapter; no `setAttribute('style')`; no uPlot built-in cursor tooltip; `getComputedStyle` at mount (not runtime); `setSize()` sets canvas attributes (CSP-exempt); `uPlot.min.css` class-only same-origin import.
- T-05-07 (network fetch): `connect-src 'none'` unchanged; uPlot fully bundled; no `url()` or `@import` in `uPlot.min.css`.

## Self-Check: PASSED

- `src/ui/charts/monthly-bars.ts` — exists, 383 lines
- `src/ui/charts/flow-chart.ts` — exists, 481 lines
- `tests/monthly-bars.test.ts` — exists, 15 tests green
- `tests/flow-chart.test.ts` — exists, 14 tests green
- `tests/setup.ts` — ResizeObserver mock present
- Commits verified: 920da24, f40a646, c8782b2, f99b8ae
- Full test suite: 361/361 passing
- TypeScript: clean (`npx tsc --noEmit` exit 0)
