---
phase: 05-visualizations-polish-transparent-assumptions-ui
verified: 2026-06-14T22:20:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 5: Visualizations, Polish, Transparent-Assumptions UI — Verification Report

**Phase Goal:** The honest, Dutch-language consumer surface — monthly self-consumption bars, sample-week step-line energy flow chart, transparent-assumptions panel, "no euros yet" explainer, mobile-readable layout, terminology audit. Charts consume the result shape from Phase 4 and follow chart-honesty rules.
**Verified:** 2026-06-14T22:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Grouped-bar chart shows self-consumption per month per selected battery using same per-battery colors as comparison table; partial months rendered without extrapolation cue (VIZ-01, ROADMAP SC-1) | VERIFIED | `monthly-bars.ts`: one `uPlot.paths.bars()` series per battery, `colorFor()` + `colorSlotFor()` are now consistent for all slot counts (CR-01 fix applied: `colorSlotFor` uses modulo wrapping to match `colorFor` wrapping). `isPartial` drives `disp.fill` opacity per-bar. Test `monthly-bars.test.ts` asserts `paths.bars` called once per battery, offset via `disp.x0`/`disp.size`. |
| 2 | Sample-week energy flow chart renders grid import, teruglevering, laden, ontladen as step lines (never interpolated); representative week is highest-teruglevering week labeled with dates and reason (VIZ-02, VIZ-03, ROADMAP SC-2) | VERIFIED | `flow-chart.ts`: `uPlot.paths.stepped({ align: 1 })` shared by all four series. `selectRepresentativeWeek()` selects highest `residualExportKwh` week. Caption: `"Voorbeeldweek: ${week.weekLabel} — de week met de meeste teruglevering in je data."` Test asserts `paths.stepped` called and `uPlot.paths.bars` NOT called. |
| 3 | All numbers display at most one decimal place; `formatAxisKwh` helper enforces this, covered by a test (VIZ-04, ROADMAP SC-3) | VERIFIED | `format.ts`: `formatAxisKwh(n) = n.toFixed(1)`. `format.test.ts`: asserts `formatAxisKwh(3.14159) === "3.1"` and `formatAxisKwh(0) === "0.0"`. Both chart adapters use `formatAxisKwh` on y-axis ticks. |
| 4 | Collapsible "Hoe is dit berekend?" panel lists 5 simulator assumptions in plain Dutch; "Waarom geen euro's?" subsection present (UX-01, UX-02, ROADMAP SC-4) | VERIFIED | `transparency-panel.ts`: `renderTransparencyPanel()` builds native `<details>` with 5 `<li>` assumptions (round-trip, DoD, power clamping, saldering, period). "Waarom geen euro's?" heading + body present. Test asserts heading, exactly 5 `<li>`, saldering caveat contains "2027", no v2 promise. |
| 5 | Full UI in Dutch; technical terms have hover/tap tooltips working on desktop hover, keyboard focus, and mobile tap; results layout readable at 375px (UX-03, UX-04, ROADMAP SC-5) | VERIFIED (canvas/visual approved by human-verify) | `tooltips.ts`: `initTooltips()` attaches `touchstart` (passive) + `keydown` (Escape) at document level, toggles `.term-tooltip--open` class only (no `style=`). CSS `:hover::after` and `:focus-visible::after` handle the non-tap cases. `mobile-reflow.css`: `@media (max-width: 480px)` stacks `.comparison-table tr.battery-row` as cards and shrinks chart wrappers. Human-verify approved 375px reflow and zero CSP violations. |
| 6 | Terminology audit: zero occurrences of "solar production", "solar generation", "zonne-opwekking", "zonne-opbrengst" in `src/` (UX-05, ROADMAP SC-5) | VERIFIED | `terminology-audit.test.ts`: `findBanned(['solar production', 'solar generation', 'zonne-opwekking', 'zonne-opbrengst'])` asserts length 0. Test passes (387/387 green). |
| 7 | No email field, contact form, or "vraag offerte aan" CTA anywhere in `src/` (UX-06, ROADMAP SC-6) | VERIFIED | `terminology-audit.test.ts`: `findBanned(['type="email"', 'type="tel"', 'offerte'])` asserts length 0. Test passes. |
| 8 | Both charts and transparency panel mount inside `#results-region` in correct order (below comparison table); all four Phase 5 CSS files imported; build succeeds (ROADMAP SC wiring) | VERIFIED | `main.ts`: imports `charts.css`, `tooltips.css`, `transparency-panel.css`, `mobile-reflow.css`; imports and calls `initMonthlyBarsChart`, `initFlowChart`, `renderTransparencyPanel`, `initTooltips`. Mount order: comparison-table → monthly bars → flow chart → transparency panel. `npm run build` green (131 kB JS gzip 48 kB). |
| 9 | uPlot CSS imported unconditionally; CSP `connect-src 'none'` and `style-src 'self'` unchanged | VERIFIED | `import 'uplot/dist/uPlot.min.css'` present unconditionally at top of both chart adapters. `src/constants/csp.ts`: `connect-src 'none'` and `style-src 'self'` confirmed unchanged. CSSOM `el.style.backgroundColor` / `el.style.transform` used for dynamic coloring (CSP-safe; code review confirmed this is NOT blocked by `style-src 'self'`). |
| 10 | CR-01 (color consistency) and CR-02 (ResizeObserver null crash) from code review fixed | VERIFIED | CR-01: `color.ts` `colorSlotFor` now uses `(idx % COLOR_SLOTS.length) + 1` matching `colorFor`'s wraparound — both return slot 1 for a 6th battery, consistent. CR-02: `setTimeout` body in both `monthly-bars.ts` and `flow-chart.ts` re-checks `if (chart && container.offsetWidth > 0)` before calling `setSize`. WR-04 also fixed: `clearTimeout(resizeTimer)` in empty-state branch. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/domain/bucket-by-month.ts` | Pure Amsterdam-local month bucketer (VIZ-01 data prep) | VERIFIED | 98 lines; exports `bucketByMonth` + `MonthBucket`; uses `TZDate` from `@date-fns/tz`; no DOM imports |
| `src/domain/select-representative-week.ts` | Pure highest-teruglevering week heuristic (VIZ-02 data prep) | VERIFIED | 105 lines; exports `selectRepresentativeWeek` + `RepresentativeWeek`; imports `TZDate` + `startOfWeek`; no DOM imports |
| `src/helpers/format.ts` | `formatAxisKwh` added to existing formatters (VIZ-04) | VERIFIED | Contains `formatAxisKwh(n: number): string { return n.toFixed(1) }` |
| `src/ui/charts/monthly-bars.ts` | uPlot grouped-bar chart adapter (VIZ-01, VIZ-04) | VERIFIED | 450 lines; exports `initMonthlyBarsChart`; imports `bucketByMonth`, `colorFor`, `formatAxisKwh`; calls `paths.bars` with `disp.x0`/`disp.size`; `getComputedStyle` present for color resolution |
| `src/ui/charts/flow-chart.ts` | uPlot 4-series step-line chart adapter (VIZ-02, VIZ-03) | VERIFIED | 543 lines; exports `initFlowChart`; imports `selectRepresentativeWeek`; uses `paths.stepped({ align: 1 })`; `tzDate` Amsterdam; timestamps in seconds |
| `src/ui/charts/chart-tooltip.ts` | CSP-safe hover tooltip plugin (added during live verify) | VERIFIED | 187 lines; CSSOM `el.style.transform` + `el.style.backgroundColor` (CSP-safe); exported `hoverTooltipPlugin` used by both adapters |
| `src/ui/transparency-panel.ts` | Collapsible assumptions panel builder (UX-01, UX-02) | VERIFIED | 143 lines; exports `renderTransparencyPanel`; 5 assumptions via `textContent`; `<details>` uncollapsed by default; no v2 promise |
| `src/ui/tooltips.ts` | Tap-toggle + Escape tooltip wiring (UX-03) | VERIFIED | 98 lines; exports `initTooltips`; `classList.toggle` only; passive touchstart; keydown Escape cleanup |
| `src/styles/charts.css` | Chart section/wrapper/legend/caption/partial/sparse classes | VERIFIED | Contains `.chart-wrapper`, `.chart-legend`, `.chart-sparse-note`, `.chart-wrapper--computing`, `.chart-section`, `.chart-partial-label` |
| `src/styles/tooltips.css` | Dotted-underline term tooltips via `::after` | VERIFIED | Contains `.term-tooltip`, `content: attr(data-tooltip)`, `.term-tooltip--open::after` |
| `src/styles/transparency-panel.css` | Collapsible panel surface + summary touch-target | VERIFIED | Contains `.transparency-panel__details`, `.transparency-panel__summary`, `.assumptions-list`, `.no-euros-section` |
| `src/styles/mobile-reflow.css` | `@media (max-width: 480px)` stacked-card + chart-height reflow | VERIFIED | Contains `@media (max-width: 480px)`, `content: attr(data-label)`, `#chart-monthly .chart-wrapper { height: 220px }`, `#chart-flow .chart-wrapper { height: 260px; overflow-x: auto }` |
| `src/main.ts` | Phase 5 wiring: CSS imports + chart/panel/tooltip init in `#results-region` | VERIFIED | All 4 CSS imports present; all 4 module imports present; `resultsRegion.appendChild` order correct; HMR dispose calls `disposeMonthlyBars()` + `disposeFlowChart()` |
| `tests/bucket-by-month.test.ts` | VIZ-01 fixture lock (full/partial/DST/sparse) | VERIFIED | 22 tests green; covers full month, partial (first/last), DST boundary, sparse (<2 full months) |
| `tests/select-representative-week.test.ts` | VIZ-02 fixture lock (best-week, tie-break, <7 days) | VERIFIED | 14 tests green; covers best-week, tie-break-first, <7-day single span, NL month name format |
| `tests/format.test.ts` | `formatAxisKwh` assertions | VERIFIED | Asserts `3.14159 → "3.1"`, `0 → "0.0"`, no kWh suffix |
| `tests/monthly-bars.test.ts` | jsdom mount + DOM-contract + XSS | VERIFIED | 17 tests green; asserts `paths.bars` called once per battery, `disp.x0`/`disp.size` grouping, sparse-note copy, XSS-safe legend |
| `tests/flow-chart.test.ts` | jsdom mount + stepped-path config + dropdown + XSS | VERIFIED | 15 tests green; asserts `paths.stepped` called, NOT `paths.bars`, caption contains "Voorbeeldweek:" and "teruglevering", dropdown change re-renders, XSS-safe |
| `tests/transparency-panel.test.ts` | jsdom DOM-contract for panel + no-euros + saldering caveat | VERIFIED | 13 tests green; asserts 5 `<li>` items, saldering li contains "2027", heading "Waarom geen euro's?", no v2 promise |
| `tests/tooltips.test.ts` | jsdom term-tooltip tap-toggle assertions | VERIFIED | 10 tests green; asserts tap-open, one-open-at-a-time, Escape close, `tabindex="0"`, non-empty `data-tooltip`, no `style=` writes |
| `tests/terminology-audit.test.ts` | UX-05 + UX-06 CI grep contract lock | VERIFIED | Contains `findBanned`; both UX-05 and UX-06 audits pass against current `src/` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `monthly-bars.ts` | `bucketByMonth` + `simResults` signal | `effect()` subscription → `uPlot.setData` | VERIFIED | `import { bucketByMonth }` + `effect()` at line 364; `bucketByMonth(result.trace, ZONE)` inside effect |
| `monthly-bars.ts` | `uPlot.paths.bars` (one per battery, grouped) | `disp.x0`/`disp.size` facet API | VERIFIED | `uPlot.paths.bars!({ align: 0, disp: { x0: ..., size: ..., fill: ... } })` at line 257 |
| `flow-chart.ts` | `selectRepresentativeWeek` + `uPlot.paths.stepped` | stepped path builder over week trace | VERIFIED | `const steppedBuilder = uPlot.paths.stepped!({ align: 1 })` at line 259; all 4 series use `steppedBuilder` |
| `chart adapters` | `colorFor` + `getComputedStyle` | resolve `var(--color-battery-N)` to hex at mount | VERIFIED | `resolveBatteryColor()` in both adapters calls `getComputedStyle(document.documentElement).getPropertyValue(cssVar)` |
| `main.ts` | `#results-region` | `appendChild` chart mounts + panel below comparison table | VERIFIED | Lines 59-72 of `main.ts` append in order: comparison-table-mount → monthly-chart-mount → flow-chart-mount → transparency panel |
| `main.ts` | `initTooltips` + `renderTransparencyPanel` | Phase 5 init calls | VERIFIED | Line 71: `const panel = renderTransparencyPanel()`, line 75: `initTooltips()` |
| `terminology-audit.test.ts` | `src/` recursive file scan | `fs.readdirSync` + `readFileSync` grep | VERIFIED | `findBanned` function at line 40 walks `src/` |
| `mobile-reflow.css` | comparison-table `data-label` hooks | `td::before { content: attr(data-label) }` | VERIFIED | Line 35 of `mobile-reflow.css`: `content: attr(data-label)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `monthly-bars.ts` | `allBuckets` (per-battery `MonthBucket[]`) | `simResults` signal → `bucketByMonth(result.trace, ZONE)` | Yes — `simResults` comes from Comlink worker simulation, not hardcoded | FLOWING |
| `flow-chart.ts` | `weekRows` (filtered `TraceRow[]`) | `simResults` signal → `selectRepresentativeWeek(result.trace)` → `filterWeekRows` | Yes — traces from real simulation results | FLOWING |
| `transparency-panel.ts` | All copy constants | Author-defined static strings (no user data) | N/A — static panel | VERIFIED (static) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (387 tests, 30 files) | `npm test -- --run` | 387 passed / 0 failed | PASS |
| Production build | `npm run build` | `dist/index-B6FLtACi.js 131 kB gzip 48 kB` | PASS |
| uPlot installed at correct version | `node -e "require('./package.json').dependencies.uplot"` | `^1.6.32` | PASS |
| CSP unchanged | grep `connect-src 'none'` + `style-src 'self'` in `csp.ts` | Both present | PASS |
| CR-01 color consistency (6th battery) | Computed: `colorFor(idx=5) → slot 1`, `colorSlotFor(idx=5) → 1` | Match: CONSISTENT | PASS |
| CR-02 null guard in setTimeout body | grep `if (chart && container.offsetWidth > 0)` inside timer | Present in both `monthly-bars.ts` and `flow-chart.ts` | PASS |

### Probe Execution

Step 7c: SKIPPED — no declared `scripts/*/tests/probe-*.sh` probes for this phase. Runnable verification was performed via `npm test` and `npm run build` above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VIZ-01 | 05-01, 05-03, 05-05 | Grouped-bar chart: self-consumption per month per battery | SATISFIED | `monthly-bars.ts` with `bucketByMonth` data + `paths.bars` grouped per month; 17 jsdom tests green |
| VIZ-02 | 05-01, 05-03, 05-05 | Sample-week energy flow chart with highest-export-week heuristic | SATISFIED | `flow-chart.ts` with `selectRepresentativeWeek`; dated caption "de week met de meeste teruglevering" |
| VIZ-03 | 05-03, 05-05 | Step lines (never interpolated) for quantized energy data | SATISFIED | `paths.stepped({ align: 1 })` on all 4 flow-chart series; no `spline` anywhere in adapters |
| VIZ-04 | 05-01, 05-03, 05-05 | All numbers at most 1 decimal place; `formatAxisKwh` helper covered by test | SATISFIED | `formatAxisKwh(n) = n.toFixed(1)` in `format.ts`; used on y-axis ticks in both charts; 5 format tests green |
| UX-01 | 05-04, 05-05 | Collapsible "Hoe is dit berekend?" panel with 5 Dutch assumptions | SATISFIED | `renderTransparencyPanel()` builds native `<details>` + 5 `<li>` assumptions; 13 jsdom tests green |
| UX-02 | 05-04, 05-05 | "Waarom geen euro's?" explainer with kWh-only rationale | SATISFIED | `.no-euros-section__heading` + `.no-euros-section__body` present; explains tariff absence without v2 promise (D-09) |
| UX-03 | 05-04, 05-05 | Dutch UI; technical terms have hover/tap tooltips | SATISFIED | `initTooltips()` wires touchstart + keydown; CSS `:hover::after` + `:focus-visible::after` in `tooltips.css`; 10 tooltip tests green |
| UX-04 | 05-02, 05-05 | Mobile layout readable at 375px; no horizontal scroll for headline numbers | SATISFIED (human-approved) | `mobile-reflow.css` stacks `.battery-row` as cards; chart heights shrunk to 220px/260px; approved in live human-verify checkpoint |
| UX-05 | 05-02, 05-05 | Terminology: no "solar production"/"solar generation"/"zonne-opwekking" in src/ | SATISFIED | `terminology-audit.test.ts` CI grep; both UX-05 tests pass; only "teruglevering"/"solar surplus" used |
| UX-06 | 05-02, 05-05 | No email/contact/offerte CTAs anywhere in app | SATISFIED | `terminology-audit.test.ts` CI grep for `type="email"`, `type="tel"`, `offerte`; test passes |

All 10 phase-5 requirements (VIZ-01..04, UX-01..06) are SATISFIED.

### Anti-Patterns Found

| File | Pattern | Severity | Status |
|------|---------|----------|--------|
| `select-representative-week.ts` line 86 | `weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000 - 1` — assumes 168-hour weeks, wrong at DST transitions (WR-01 from code review) | Warning | Documented in 05-REVIEW.md WR-01; not fixed; DST-boundary week label may show ±1 hour error in edge case. Non-blocking — the week *selection* logic (sum bucketing) is correct; only the end boundary timestamp used for the caption label is potentially off by 1 hour at spring/fall transitions. |
| `flow-chart.ts` lines 276-280 | Hover emphasis compares kWh magnitude to cursor y-value; can emphasize wrong series when series are on very different kWh scales (WR-02 from code review) | Warning | Documented in 05-REVIEW.md WR-02; non-blocking cosmetic issue |
| `flow-chart.ts` lines 421-429 | `populateDropdown` doesn't write back the fallback id to `selectedBatteryId` (WR-03) | Warning | Documented in 05-REVIEW.md WR-03; non-blocking — normal use path works correctly |
| `chart-tooltip.ts` | `showAt` accepts unused `wrapperH` parameter (IN-01) | Info | Dead code, cosmetic |
| `tooltips.ts` | No HMR idempotency guard; document listeners accumulate on hot-reload (IN-04) | Info | Cosmetic under HMR; no production impact |

**Debt markers:** None found. No `TBD`, `FIXME`, or `XXX` markers in Phase 5 modified files.

**Stub classification:** No stubs detected. All chart adapters fetch from the real `simResults` signal and call real uPlot APIs (mocked only in jsdom test environment).

### Human Verification Status

The 05-05-PLAN.md Task 2 human-verify checkpoint was COMPLETED AND APPROVED by the user prior to this verification. The following items were verified by a live human:

1. **VIZ-01 visual fidelity** — bars appear per month, one color per battery, colors match comparison table, partial months show "(deels)" without scaling, "weinig data" note appears when applicable.
2. **VIZ-02/03 step lines** — four series render as step lines (flat segments + vertical jumps), never smooth curves; battery dropdown updates the chart.
3. **UX-04 mobile reflow** — at 375px the comparison table stacks to cards, headline numbers do not overflow, charts stay within containers.
4. **CSP** — zero "Refused to apply inline style" violations; zero user-data network requests in Network tab.

These items are treated as VERIFIED per the verification context instructions. No re-check needed.

### Gaps Summary

No gaps. All 10 must-haves verified. All 10 phase requirements satisfied. The code-review warnings (WR-01..06, IN-01..05) are documented in `05-REVIEW.md` and are non-blocking cosmetic or edge-case issues — none prevent the phase goal from being achieved. The human-verify checkpoint was approved.

---

_Verified: 2026-06-14T22:20:00Z_
_Verifier: Claude (gsd-verifier)_
