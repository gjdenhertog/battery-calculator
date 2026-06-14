---
phase: 05-visualizations-polish-transparent-assumptions-ui
plan: 05
status: complete
completed: 2026-06-14
requirements: [VIZ-01, VIZ-02, VIZ-03, VIZ-04, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06]
---

# Plan 05-05 Summary — Integrate Phase 5 surfaces into the live app

## What was built

Wired all Phase 5 surfaces into `src/main.ts` and closed the two manual-only
verifications from `05-VALIDATION.md` (canvas fidelity + 375px reflow) via a live
human-verify checkpoint. The checkpoint surfaced four chart defects, all fixed
before sign-off.

### Task 1 — main.ts wiring (commit 82b909a)
- Imported the four Phase 5 stylesheets (`charts.css`, `tooltips.css`,
  `transparency-panel.css`, `mobile-reflow.css`) alongside the existing style imports.
- Imported `initMonthlyBarsChart`, `initFlowChart`, `renderTransparencyPanel`,
  `initTooltips`.
- Inside the existing `if (resultsRegion)` block, after the comparison-table mount:
  appended `#monthly-chart-mount` (→ `initMonthlyBarsChart`), `#flow-chart-mount`
  (→ `initFlowChart`), the transparency panel element, and called `initTooltips()`.
  Mount order: comparison table → monthly bars → flow chart → transparency panel.
- Extended the HMR `dispose` callback to also call `disposeMonthlyBars()` and
  `disposeFlowChart()`.

### Task 2 — live verification + deviation fixes (commit 6881a53)
Human verification found four issues; all fixed and re-verified:
1. **Grouped bars.** The monthly bars overlapped — `05-RESEARCH.md` incorrectly
   assumed uPlot natively offsets multiple `bars()` series side-by-side. It does
   not. Reimplemented true grouping via the published `disp.x0` + `disp.size`
   facet API (each battery offset within the month slot), with x-scale padding
   and one centered tick per month.
2. **Colored flow legend.** Legend swatches were colorless: CSS `attr()` only
   works for `content`, never `background-color`. Set swatch colors via CSSOM
   (`el.style.backgroundColor`), which `style-src 'self'` does not block. Also
   fixed `resolveCssVar` to fall back to `''` so the hardcoded muted-color
   fallback engages when the CSS var is unavailable.
3. **Hover tooltips.** Added a CSP-safe hover tooltip (new `chart-tooltip.ts`)
   to both charts via a uPlot plugin using only the public `posToIdx`/`posToVal`
   API and CSSOM positioning. Bars tooltip identifies the hovered battery +
   shows every battery's value for that month; flow tooltip shows the time + all
   four series with the nearest emphasized.
4. **Copy.** Dropped the "V1" framing in the no-euros transparency copy to avoid
   implying a future euro feature.

## Key files

- `src/main.ts` — Phase 5 wiring (created mounts, init calls, HMR teardown)
- `src/ui/charts/chart-tooltip.ts` — new CSP-safe hover tooltip module + uPlot plugin
- `src/ui/charts/monthly-bars.ts` — real grouped-bar layout + hover tooltip
- `src/ui/charts/flow-chart.ts` — CSSOM legend colors + hover tooltip + resolveCssVar fix
- `src/ui/transparency-panel.ts` — no-euros copy (V1 removed)
- `src/styles/charts.css` — `.chart-wrapper` positioning context + `.chart-tooltip` styles

## Verification

- `npm run build` — green (uPlot bundled; CSP file unchanged).
- `npm test` — 386 tests across 30 files green, including the terminology
  (UX-05) and no-CTA (UX-06) audits and 4 new regression tests locking the
  grouping (`disp.x0`/`disp.size`), legend colors, and cursor/plugin wiring.
- Live human-verify: bars grouped side-by-side with table-matching colors,
  step lines (no smoothing), honest week caption, colored flow legend, working
  hover tooltips on both charts, transparency panel + tooltips, 375px reflow
  without headline overflow, zero CSP violations, no user-data network requests.

## Deviations

The research's "uPlot natively groups multi-series bars" claim was wrong; the
grouped layout was reimplemented via the documented `disp` facet API instead.
The earlier "no chart cursor/tooltip for CSP safety" decision was relaxed —
CSSOM positioning is genuinely CSP-safe under `style-src 'self'`, so the
user-requested hover tooltips were added without weakening the CSP.

## Self-Check: PASSED
