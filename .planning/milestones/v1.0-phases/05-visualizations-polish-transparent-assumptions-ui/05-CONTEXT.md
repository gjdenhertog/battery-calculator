# Phase 5: Visualizations, Polish, Transparent-Assumptions UI - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The honest, Dutch-language **consumer surface** layered on the working Phase 4 comparison.
No new physics and no new data layer — this phase consumes the already-proven
`SimResult` (aggregates + per-interval `trace`) and the `colorFor()` helper from Phase 4.

This phase delivers:

1. **Monthly self-consumption bars (VIZ-01)** — grouped bars, per month per selected
   battery, reusing the same per-battery colors as the comparison table; partial months
   rendered honestly without an extrapolation cue.
2. **Sample-week energy flow chart (VIZ-02/03)** — grid import, grid export, battery
   charge, and battery discharge as **step lines** (never interpolated) for one selected
   battery, over a heuristic-chosen representative week (highest-teruglevering week),
   labeled with which week and why.
3. **One-decimal number discipline (VIZ-04)** — a UI unit-formatter enforces ≤1 decimal
   everywhere, covered by a test (largely hardens the formatters already shipped in
   Phase 4's `src/helpers/format.ts`).
4. **Transparent-assumptions panel (UX-01)** — collapsible "Hoe is dit berekend?" listing
   the simulator's assumptions in plain Dutch, plus a **"Waarom geen euro's?"** subsection
   (UX-02).
5. **Dutch copy + tooltips (UX-03)** — full Dutch UI; technical terms get hover/tap
   tooltips.
6. **Mobile readability (UX-04)** — the results layout is readable on a 375px viewport
   with no horizontal scroll for headline numbers; a CSS-only reflow of the
   responsive-ready structure Phase 4 already built (Phase 4 D-12).
7. **Honest-terminology audit (UX-05)** and **no-CTA audit (UX-06)** — enforced by
   automated CI grep tests.

Requirements covered: **VIZ-01, VIZ-02, VIZ-03, VIZ-04, UX-01, UX-02, UX-03, UX-04,
UX-05, UX-06** (10 total).

**Out of phase (deferred to Phase 6 / v2):** multiple custom batteries + saldering-OFF-by-default
(Phase 6), terugleverkosten €/kWh input (SALD-02 v2), year-by-year saldering schedule
(SALD-01 v2), dynamic-price dispatch (DYN v2), separate solar-CSV upload, € / payback /
ROI outputs.

**Locked from prior phases — do NOT touch:**
- The pure, saldering-agnostic engine (`simulate()` / `runComparison()`, Phase 3) and the
  Phase 4 saldering value-framing layer. Charts read `SimResult.trace` and aggregates;
  they never re-derive physics.
- `colorFor(batteryId, orderedSelection)` / `colorSlotFor()` (`src/helpers/color.ts`) —
  reused **verbatim** in every chart so chart colors match the table (COMP-04).
- The Phase 4 coarse-cadence banner (D-13) and the co-located saldering disclaimer (D-14)
  remain; this phase's assumptions panel **expands** the disclaimer, it does not remove it.

</domain>

<decisions>
## Implementation Decisions

### Sample-week energy flow chart (VIZ-02/03)
- **D-01: One battery at a time, via a dropdown selector.** Because each battery has its
  own per-interval `trace`, the flow chart shows exactly one battery's flows. Default to
  the **first-selected battery** (Sessy 5 default), with a small dropdown to switch which
  battery's flows are charted. The dropdown's options reuse `colorFor()` for swatch
  consistency.
- **D-02: Show all four series as step lines.** Grid import, grid export (teruglevering),
  battery charge, and battery discharge — exactly what VIZ-02 names. Rendered with uPlot
  stepped paths (VIZ-03: never interpolated curves). No SoC line, no net-grid collapse —
  keep the import/export split the rest of the tool emphasizes.
- **D-03: Week label = dated caption with the reason.** e.g. *"Voorbeeldweek: 8–14 juni —
  de week met de meeste teruglevering in je data."* Full transparency about the heuristic
  (highest-export/teruglevering week), with concrete dates. The heuristic itself is locked
  by VIZ-02; only the labeling wording is discretionary.

### Monthly self-consumption bars (VIZ-01)
- **D-04: Bar height = kWh self-consumed that month.** Each bar is the `shiftedKwh` the
  battery moved from grid to self-use, bucketed by month (Europe/Amsterdam local months —
  reuse the existing `@date-fns/tz` TZDate convention). Same unit as the headline metric;
  not a percentage. Grouped per month, one bar per selected battery, colored via
  `colorFor()`.
- **D-05: Partial months drawn as-is + visually marked.** Render the real (lower)
  partial-month bar with a subtle distinct treatment (e.g. hatched / lighter fill) and a
  **"(deels)"** label. Never scale a partial month up to a full-month estimate (no
  extrapolation cue — VIZ-01 / COMP-07 honesty).
- **D-06: Sparse data (0–1 full months) still shows what exists.** Render the 1–2 partial
  bars with a plain-Dutch **"weinig data"** note rather than hiding the chart. The common
  ~43-day owner dataset must still produce a visible, honest chart.

### Transparency panel (UX-01 / UX-02)
- **D-07: One collapsible "Hoe is dit berekend?" panel, "Waarom geen euro's?" as a
  subsection inside it.** A single transparency block below the results — not two separate
  collapsibles, not modals. Lists the simulator assumptions in plain Dutch: round-trip
  loss (sqrt each way), depth-of-discharge clamping, per-interval charge/discharge power
  clamping, the saldering on/off simplification, and the "over de periode die je hebt
  geüpload" period framing.
- **D-08: Saldering caveat lives in BOTH places.** The short Phase 4 disclaimer stays
  co-located with the two saldering columns (glance-level); the panel **restates saldering
  in full** as one listed assumption — 2026 cap at 64%, terugleverkosten apply regardless,
  50%-of-bare-supply-tariff floor through 2030. Disclaimer = glance, panel = depth.
- **D-09: "Waarom geen euro's?" states only the why — no v2 promise.** Explain that v1
  reports kWh to stay honest (euros need the user's tariff + dynamic prices, which v1 does
  not have). Do **not** promise any v2 euro feature, dates, or guarantees. Avoids
  over-promising; matches the kWh-only v1 boundary (COMP-07, PROJECT Out of Scope).

### Dutch vocabulary & tooltips (UX-03 / UX-05)
- **D-10: "Teruglevering" is the canonical user-facing term for solar surplus to the grid.**
  Use "teruglevering" / "stroom teruggeleverd aan het net" consistently (already used in
  Phase 4 columns). Do **not** introduce "overschot"/"zonne-overschot" as a primary label —
  it drifts toward the banned "zonne-opwekking" family. ("solar surplus" remains an
  allowed *code/internal* identifier per UX-05, but the UI shows Dutch.)
- **D-11: Tooltips = dotted-underline term, hover on desktop + tap-to-toggle on mobile.**
  Discoverable and touch-accessible (satisfies UX-03's hover/tap requirement). Not native
  `title=""` (no touch/keyboard support). Which terms get tooltips: the technical ones
  (zelfverbruik, teruglevering, marginale benutting, round-trip / rendement, DoD, saldering,
  verschoven kWh) — planner's discretion on the exact set.
- **D-12: Honest-terminology audit (UX-05) is enforced by an automated CI test.** A
  Vitest/CI check greps `src/` and fails the build if any banned term appears
  ("solar production", "solar generation", "zonne-opwekking"). Matches the project's
  contract-locking test style (Phase 1/2 privacy guard, DST fixtures). Not a one-time
  manual pass.

### Mobile & CTA audit (UX-04 / UX-06) — decided with defaults
- **D-13: Mobile is a CSS-only reflow of Phase 4's responsive-ready structure (D-12).** At
  375px: the comparison table reflows to stacked per-battery cards (headline avoided pair
  prominent, secondary metrics below); charts shrink to fit or scroll horizontally within
  their own container; headline numbers never overflow the viewport. No table rebuild, no
  new data plumbing.
- **D-14: No-CTA audit (UX-06) is enforced by the same CI grep test as the terminology
  audit (D-12).** The grep also fails the build on email-field / account-form / contact-form
  / "vraag offerte aan" markers, plus a manual review checklist item. One guardrail covers
  both honesty audits.

### Claude's Discretion
- **Charting library integration mechanics** — uPlot is the locked lib (CLAUDE.md); how it
  is initialized, axis/grid/legend styling, the stepped-path config, and resize handling
  are planner/executor calls. (uPlot, ~22 KB gz, is the one new runtime dep this phase
  adds.)
- **Internal file layout** for the new chart/UI modules (e.g. `src/ui/charts/…`) and any
  new CSS files.
- **Exact set of tooltip-ed terms** and the glossary copy (within D-11).
- **Visual treatment specifics** for partial-month bars (hatch vs opacity) and the exact
  empty/sparse/loading copy (functional Dutch — final polish here is in-phase).
- **Panel copy wording** for the assumptions list and "Waarom geen euro's?" (within D-07/
  D-08/D-09 constraints).
- **uPlot resize / responsive behavior** specifics for charts on narrow screens (within
  D-13's "no horizontal scroll for headline numbers" constraint).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (read first)
- `.planning/REQUIREMENTS.md` — **VIZ-01..04, UX-01..06** full text (lines 72–84) plus the
  v2/Phase-6 deferrals these decisions deliberately avoid (SALD-01/02, DYN, FIN).
- `.planning/ROADMAP.md` §"Phase 5: Visualizations, Polish, Transparent-Assumptions UI" —
  goal + 6 success criteria (the acceptance contract). Criterion 1 (monthly bars + same
  colors + partial months), criterion 2 (step lines + heuristic week labeled), criterion 5
  (full Dutch + 375px + terminology grep = zero banned terms), criterion 6 (no email/
  account/contact/offerte) are the sharp ones.
- `.planning/PROJECT.md` — Key Decisions (kWh-only, defer €; output = table + charts;
  saldering on/off v1) and Constraints (client-side only, CSP, modest bundle).

### Locked domain contract & Phase 4 surface (the layer this phase sits on)
- `src/domain/types.ts` — `SimResult` (aggregates + `trace`), `TraceRow`
  (`timestamp`, `socKwh`, `chargedKwh`, `dischargedKwh`, `residualImportKwh`,
  `residualExportKwh`), `IntervalSample`. Charts consume `trace` (1:1 with input samples)
  and the aggregates. **Stable — do not change.**
- `src/helpers/color.ts` — `colorFor(batteryId, orderedSelection)` and
  `colorSlotFor()` (CSS `.battery-swatch--N` slots, `var(--color-battery-1..5)`). Reuse
  **verbatim** in both charts (COMP-04 chart-color consistency).
- `src/helpers/format.ts` — existing 1-decimal formatters from Phase 4; VIZ-04 hardens/
  tests these. Charts must format axis ticks + readouts through this helper.
- `src/domain/period-filter.ts` (`filterByPeriod`) — the period the user narrowed to;
  charts render the active filtered period, not the raw full series.
- `src/domain/battery-catalog.ts` — battery names/ids for the flow-chart dropdown (D-01).
- `.planning/phases/04-comparison-engine-comparison-table-saldering-side-by-side-wo/04-CONTEXT.md`
  — D-11 (color identity vs leader highlight separation; `colorFor` reused in Phase 5),
  D-12 (responsive-ready table structure → UX-04 is CSS-only here → D-13), D-13 (coarse-
  cadence banner stays), D-14 (saldering disclaimer co-located → this phase's panel expands
  it → D-08), D-15 (period framing / no extrapolation — applies to charts too).

### UI/shell & CSP contract (from Phase 1)
- `src/shell.ts` / `.planning/phases/01-.../01-UI-SPEC.md` — `#results-region` (Phase 4
  filled; Phase 5 adds charts + panel within it). Keep `p.privacy-promise` (PRIV-02)
  verbatim.
- `src/styles/tokens.css`, `src/styles/global.css`, `src/styles/comparison-table.css`,
  `src/styles/results-region.css` — design tokens + responsive structure to reuse. **No
  inline `style=`** (style-src 'self' CSP). Partial-month hatch, swatch colors, tooltip
  styling all via CSS classes.
- `src/constants/csp.ts` — current CSP. uPlot is a bundled JS dep (no network, no inline
  style); confirm it needs no CSP change (it renders to canvas; `connect-src 'none'` and
  `style-src 'self'` must remain intact).

### Stack lock (do not re-research / re-version)
- `CLAUDE.md` — LOCKED stack. **uPlot `^1.6.32`** (~22 KB gz) is the charting lib and the
  one new runtime dep this phase adds — purpose-built for time-series + bars, native
  stepped lines (VIZ-03), no React/Vue baggage. Do NOT swap to Chart.js/ECharts/Observable
  Plot/D3. Vite `^8`, TS `~5.6`, Vitest `^4.1.7` (node env for pure logic incl. the
  month-bucketing + week-heuristic helpers; jsdom only for DOM/chart-mount tests).
  `@date-fns/tz` TZDate for month bucketing across DST.

No external ADRs or third-party specs beyond the above — requirements are fully captured in
REQUIREMENTS.md, ROADMAP.md success criteria, and the decisions here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`colorFor()` / `colorSlotFor()`** (`src/helpers/color.ts`) — per-battery color slots;
  reused verbatim so chart colors match the comparison table (D-01/D-04).
- **`SimResult.trace` (`TraceRow[]`)** (`src/domain/types.ts`) — the per-interval data both
  charts read: month bucketing (VIZ-01) and the four-series step lines (VIZ-02).
- **`src/helpers/format.ts`** — Phase 4's 1-decimal formatters; VIZ-04 hardens + tests
  them and routes all chart text through them.
- **`filterByPeriod()`** (`src/domain/period-filter.ts`) — charts render the active
  narrowed period.
- **Signals store** (`src/state/app-state.ts`, `src/state/signals.ts`) — selected
  batteries (ordered), parsed samples, period, and derived `SimResult[]`; charts subscribe
  here and re-render reactively (no new state machinery).
- **`#results-region`** (`src/shell.ts`) — charts + transparency panel mount inside the
  already-populated results region; the comparison table (`src/ui/comparison-table.ts`)
  and its responsive structure are the reflow target for UX-04.

### Established Patterns
- **Pure-core / browser-shell split (Phase 1/3):** the month-bucketing logic and the
  highest-teruglevering week-selection heuristic should be **pure functions** (node-env
  Vitest, no canvas), with uPlot mounting isolated to a thin DOM adapter (jsdom test).
- **Contract-locking CI tests (Phase 1 privacy guard, Phase 2 DST fixtures):** the UX-05
  terminology grep + UX-06 no-CTA grep follow this exact pattern (D-12/D-14) — a failing
  grep fails the build.
- **CSP strictness:** no inline scripts/styles; uPlot renders to canvas and ships bundled
  (no fetch). All swatch/hatch/tooltip styling via CSS classes + `var(--color-battery-N)`.
- **XSS-safe DOM (`drop-zone.ts` convention):** user-derived strings via `.textContent`
  (relevant for the flow-chart battery dropdown labels and any file-derived captions).
- **Honesty-first (Phase 2 sanity readout, Phase 3 warning flag, Phase 4 coarse-cadence
  banner):** partial-month marking (D-05), sparse-data note (D-06), and dated week caption
  (D-03) continue this stance — surface limits, never paper over them.

### Integration Points
- **Input:** signals store → `SimResult[]` (+ `trace`) and ordered selection →
  `colorFor()` → both charts.
- **Charts mount:** inside `#results-region`, below/alongside the comparison table; the
  transparency panel is a collapsible block in the same region.
- **Period reactivity:** narrowing the DATA-12 period re-filters samples → worker
  recompute → new `SimResult[]` → charts re-render with the same color mapping.
- **Audits:** new Vitest specs grep `src/` for banned terminology (UX-05) and CTA/contact
  markers (UX-06); both run in the existing CI gate.

</code_context>

<specifics>
## Specific Ideas

- **The contrast/honesty stance is the product, in charts too.** Partial months show the
  real lower bar with "(deels)" (D-05), the sample week is explicitly the *highest-
  teruglevering* week and labeled as such (D-03), and the assumptions panel restates the
  saldering simplification in full (D-08). Charts must never imply more certainty or more
  energy than the data supports — same discipline as the coarse-cadence banner.
- **"Teruglevering" is the one canonical surplus word** (D-10) — keep it consistent across
  table, charts, tooltips, and panel. Resist synonyms that drift toward implying we measure
  solar production (we infer surplus from P1 net flows).
- **"Waarom geen euro's?" is a boundary statement, not a teaser** (D-09): explain the
  honest reason kWh-only is the right v1 output; do not advertise a future euro feature.
- **One battery on the flow chart, by design** (D-01): the four-line chart stays legible by
  scoping to a single battery + dropdown, rather than overlaying 5 batteries × 4 series.

</specifics>

<deferred>
## Deferred Ideas

- **Multiple custom batteries + saldering-OFF-by-default** — already scoped as **Phase 6**
  (from Phase 4 UAT enhancement notes). Not Phase 5.
- **Terugleverkosten €/kWh input** (SALD-02), **year-by-year saldering schedule** (SALD-01),
  **dynamic-price battery dispatch** (DYN), **€ / payback / ROI outputs** (FIN) — all v2;
  the "Waarom geen euro's?" explainer (D-09) deliberately stops at explaining why these are
  absent in v1.
- **kWh↔% toggle on the monthly bars** — considered (offered as an option), rejected for v1
  as over-built; bars are kWh self-consumed only (D-04). Revisit if users ask.
- **State-of-charge line / net-grid collapse on the flow chart** — considered, rejected to
  keep the four-series import/export split clean (D-02). Could return as an advanced toggle
  later.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned 0 matches for Phase 5.

</deferred>

---

*Phase: 5-Visualizations, Polish, Transparent-Assumptions UI*
*Context gathered: 2026-06-14*
