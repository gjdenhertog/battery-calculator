# Roadmap: Battery Calculator

## Overview

A vertical-but-deliberately-horizontal build of an NL home battery sizing tool. We deploy a static "hello world" first to lock in the GitHub Pages base-path and the no-third-party-script privacy rule before any feature code (Phase 1). Then we build the data layer bottom-up: parser registry + HomeWizard P1 adapter + DST-safe merging produces a fixture-locked canonical `IntervalSample[]` (Phase 2). The pure simulator and curated battery catalog land next — provable correct by hand-computed fixtures without any UI (Phase 3). The differentiator (multi-battery side-by-side comparison) lands on top of that proven core, with reactive state, workers, and the comparison table (Phase 4). Finally, charts, the Dutch copy pass, transparent-assumptions UI, and the honest terminology audit close out v1 (Phase 5). Phases are horizontal technical layers: types and contracts at the bottom, UI at the top, with each layer fully verified before the next is built on it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Setup, Deploy Plumbing, Privacy Rules** - Vite + TS scaffold deployed to GitHub Pages with CSP, no third-party scripts, CI green (completed 2026-06-07)
- [x] **Phase 2: CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series** - HomeWizard P1 parses to canonical `IntervalSample[]`; multi-file merger; period filter; sanity readout; worker parsing (completed 2026-06-09)
- [x] **Phase 3: Battery Simulator and Curated Catalog** - Pure `simulate()` with hand-computed fixture tests; curated NL battery catalog JSON; Sessy 5 kWh default; custom battery support (gap CR-01 mixed-interval residual conservation closed in 03-04) (completed 2026-06-09)
- [x] **Phase 4: Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State** - `runComparison`, signals state, dropzone, parser+simulator workers (Comlink), comparison table with saldering on/off as side-by-side columns (completed 2026-06-13)
- [x] **Phase 5: Visualizations, Polish, Transparent-Assumptions UI** - Monthly self-consumption bars + sample-week step-line flow chart; assumptions panel; "no euros" explainer; Dutch copy pass; mobile layout; honest terminology audit (completed 2026-06-14)
- [x] **Phase 6: Post-v1 UX Enhancements — Multiple Custom Batteries + Optional Saldering** - Add several user-defined batteries (within the max-5 cap); make the saldering column an opt-in mode that is OFF by default (post-v1; from Phase 4 UAT enhancement notes) (completed 2026-06-15)

## Phase Details

### Phase 1: Setup, Deploy Plumbing, Privacy Rules
**Goal**: Working Vite + TS scaffold deployed to GitHub Pages with the privacy and base-path contracts locked in. Hello-world page is reachable, CSP is enforced, CI is green, no third-party scripts ship.
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05, PRIV-01, PRIV-02, PRIV-03
**Success Criteria** (what must be TRUE):
  1. Visiting `https://<user>.github.io/battery-calculator/` in a fresh incognito window renders a hello-world page with no console errors and no asset 404s.
  2. The deployed page's Network tab shows zero third-party requests after the bundle loads (verified by manual + CI grep check); no analytics, no Sentry, no Google Fonts, no CDN scripts.
  3. A CSP `<meta http-equiv>` tag in `index.html` restricts `script-src`/`style-src`/`connect-src` to `'self'`, and the browser reports no CSP violations on load.
  4. Pushing to `main` triggers GitHub Actions that run lint + formatter check + Vitest, and only deploys when CI is green; a deliberately-broken push fails the workflow and does not deploy.
  5. Privacy promise copy ("Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden") is rendered on the page in a location where the future drop zone will sit — not in a footer.
**Plans**: 3 plans
- [x] 01-01-PLAN.md — Vite+TS scaffold, toolchain, build-only CSP plugin, design tokens, 3-region shell
- [x] 01-02-PLAN.md — Contract-locking Vitest suite (CSP directives + shell DOM + verbatim privacy promise)
- [x] 01-03-PLAN.md — GitHub Actions CI + privacy guard + Pages deploy + README; live-deploy human verify


### Phase 2: CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series
**Goal**: A pure data layer that turns one or more uploaded HomeWizard P1 CSVs into a single canonical, DST-safe `IntervalSample[]` with declared series_type, period filter, and a sanity readout — fixture-locked in CI before any UI exists.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09, DATA-10, DATA-11, DATA-12, DATA-13
**Success Criteria** (what must be TRUE):
  1. Dropping a real HomeWizard P1 CSV onto a minimal drop zone (or picking it via the always-visible file-picker button) produces a parsed `IntervalSample[]` with `gridImportKwh ≥ 0` and `gridExportKwh ≥ 0` invariants enforced — never a single signed `net` field.
  2. CI fixtures for the 2026-03-29 spring-forward and 2026-10-25 fall-back days yield exactly 92 and 100 intervals respectively, and the test suite covers UTF-8-with-BOM, `;` delimiter, decimal comma, and DD-MM-YYYY date variants.
  3. After upload, the user sees a sanity readout showing file count, total rows, date range, total import kWh, total export kWh, and count of detected gaps — values match independently calculated totals to within rounding.
  4. Uploading two overlapping files (one 15-min P1, one hourly provider) produces a merged series where every overlapping timestamp's data point comes from the finer-resolution source (asserted by unit test).
  5. A user-chosen sub-period narrows the analysis without re-parsing, and the period defaults to the full range of the merged data on first load.
  6. Parsing a large file (50k+ rows) does not freeze the UI — PapaParse runs with `worker: true`, and a deliberate parse error names the file, row, column, and expected format (never a generic "failed to parse").
  7. A new parser format can be added by creating one file under `src/domain/parsers/` and registering it by import side-effect, with zero edits to a central switch statement (verified by code review + a noop second-parser stub that exercises the registry).
**Plans**: 4 plans
- [x] 02-01-PLAN.md — Deps + CSP worker-src + IntervalSample contract + parser registry + DST fixtures
- [x] 02-02-PLAN.md — Encoding fallback + HomeWizard P1 adapter + parseFile orchestrator (worker:true) + DST/error tests
- [x] 02-03-PLAN.md — Finer-wins merge + DST-aware gap detection + pure period filter
- [x] 02-04-PLAN.md — Minimal drop-zone UI + sanity readout + main.ts wiring + live human-verify
**Research flag**: This phase needs a real HomeWizard P1 CSV sample during `/gsd:plan-phase` to confirm exact column names, unit conventions, and the cumulative-vs-15-min-delta column choice before the concrete adapter is written. Also needs the encoding-fallback decision (UTF-8 → Windows-1252).

### Phase 3: Battery Simulator and Curated Catalog
**Goal**: A pure `simulate(samples, batteryConfig, options) → SimResult` function with verified correctness on hand-computed fixtures, plus a curated catalog of ~6–10 NL batteries with datasheet-cited specs. No UI; proven correct via Vitest only.
**Depends on**: Phase 2
**Requirements**: BATT-01, BATT-02, BATT-03, BATT-04, BATT-05, SIM-01, SIM-02, SIM-03, SIM-04, SIM-05, SIM-06
**Success Criteria** (what must be TRUE):
  1. A one-week hand-computed fixture run through `simulate()` produces `shiftedKwh`, `residualImport`, and `residualExport` values that match the expected fixture values within rounding tolerance (`toBeCloseTo`, 3 decimal places).
  2. The small-battery-can't-catch-the-peak fixture (1.5 kWh export interval into a 2.2 kW Sessy 5 kWh) charges ~0.55 kWh (= 2.2 kW × 0.25 h), not the full 1.5 kWh — proving per-interval power clamping is honored.
  3. A 5 kWh nominal battery with 90% DoD never stores more than 4.5 kWh in any fixture run (asserted across all multi-day fixtures), and round-trip efficiency is applied symmetrically (`sqrt(rte)` each way) so a 6 kWh charge / 6 kWh discharge round-trip returns ~4.25 kWh, not 5 kWh.
  4. Running `npm test` from a clean Node environment (no jsdom, no browser globals) executes the full simulator and parser test suite green — the domain layer has zero browser dependencies.
  5. The catalog JSON loads `~6–10` NL battery entries (Sessy 5 kWh, Sessy 10 kWh, Zonneplan, Tesla Powerwall, Huawei Luna, Victron, plus 1–2 more), each with `nominalCapacityKwh`, usable capacity or `dodFraction`, `roundTripEfficiency`, `maxChargeKw`, `maxDischargeKw`, and a datasheet URL cited in the source file; Sessy 5 kWh is the first/default entry.
  6. A custom battery config built from the same five fields runs through `simulate()` identically to a catalog entry; `runComparison(samples, batteries, options)` over a mixed [catalog, catalog, custom] array returns one `SimResult` per battery in input order.
**Plans**: 4 plans (1 gap-closure)
- [x] 03-01-PLAN.md — Extend types.ts (BatteryConfig/SimResult/TraceRow/SimOptions) + 7-entry NL catalog + catalog test (BATT-01..03)
- [x] 03-02-PLAN.md — Pure simulate() dispatch engine + intervalHoursFor() + hand-computed fixture suite (SIM-01..05, BATT-04, D-04..07)
- [x] 03-03-PLAN.md — runComparison() order-preserving aggregator + mixed catalog/custom test (SIM-06, BATT-05)
- [x] 03-04-PLAN.md — Gap closure (CR-01): fix mixed-interval residual conservation in simulate() + regression fixture (SIM-05)

### Phase 4: Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State
**Goal**: The differentiator — multi-battery side-by-side comparison from the user's own CSV — lands as a working UI on top of the proven simulator. Reactive state (signals), parser worker, simulator worker (Comlink), comparison table with saldering on/off as side-by-side columns per battery, headline metric "kWh grid import avoided", marginal capture rate, per-row leader highlighting, period coverage indicator.
**Depends on**: Phase 3
**Requirements**: SIM-07, SIM-08, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, DATA-12 (folded from Phase 2 per Phase 4 D-19)
**Success Criteria** (what must be TRUE):
  1. User can drop a CSV, pick up to 5 batteries (catalog + optional custom), and see a comparison table whose headline column for each battery is "kWh grid import avoided" — placed first, with self-consumption % shown as a secondary column.
  2. The comparison table shows saldering-ON and saldering-OFF scenarios side-by-side as two columns per battery (no re-run, no toggle that re-computes); a short disclaimer near these columns notes the 2026 64% cap, terugleverkosten, and the 50% floor through 2030.
  3. The table includes a "marginal capture rate" column (`shiftedKwh / capacityKwh`) so diminishing returns are visible at a glance, and each metric column visually highlights the per-row leader without synthesizing a "best battery" verdict.
  4. While the simulator is running, the UI remains interactive (input controls do not lock, no dropped frames > 200 ms on a slider drag) and a small "Rekenen…" indicator is visible; the simulator and comparison aggregator execute inside a Web Worker via Comlink, while the same pure functions still pass Vitest unit tests without a worker.
  5. The results panel displays the dataset's period coverage ("43 dagen aan data") alongside the table, and every reported number is framed as "over de periode die je hebt geüpload" — there is no auto-extrapolation to `/year` or `/month` anywhere in the UI.
  6. A consistent color is assigned per selected battery on the table and is preserved as the same color in every subsequent chart rendered in Phase 5 (verified by manual visual check + a `colorFor(batteryId)` helper covered by a unit test).
**Plans**: 6 plans (5 autonomous, 1 with live human-verify)
- [x] 04-01-PLAN.md — Wave 0 gate: install comlink + @preact/signals-core, fix CSP worker-src 'self' blob:, Comlink sim-worker entry + contract test + build proof
- [x] 04-02-PLAN.md — Pure presentation helpers: colorFor/colorSlotFor (COMP-04), metrics deriveMetrics/saldering framing/detectLeaders (COMP-01..05), 1-decimal formatters
- [x] 04-03-PLAN.md — Signals store + Comlink worker singleton + generation-guarded scheduleRecompute (SIM-07/08); re-wire drop-zone to write parsedSamples + seed period defaults (DATA-12)
- [x] 04-04-PLAN.md — Battery spec-card picker: 7 catalog cards + Sessy 5 default, max-5 cap, inline custom battery (BATT-03/04/05, COMP-04)
- [x] 04-05-PLAN.md — Comparison table (OFF-led saldering pair, leaders, un-floored negative ON, disclaimer, cadence banner, stale-dim) + period control (COMP-01..08, SIM-08, DATA-12)
- [x] 04-06-PLAN.md — Wire main.ts (picker + period + table), CSS imports, re-assert worker chunk build, live human-verify end-to-end + interactivity + color
**UI hint**: yes

### Phase 5: Visualizations, Polish, Transparent-Assumptions UI
**Goal**: The honest, Dutch-language consumer surface — monthly self-consumption bars, sample-week step-line energy flow chart, transparent-assumptions panel, "no euros yet" explainer, mobile-readable layout, terminology audit. Charts consume the result shape from Phase 4 and follow chart-honesty rules.
**Depends on**: Phase 4
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06
**Success Criteria** (what must be TRUE):
  1. A grouped-bar chart shows self-consumption per month per selected battery, using the same per-battery colors as the comparison table; partial months are rendered without an extrapolation cue.
  2. A sample-week energy flow chart renders grid import, grid export, and battery charge/discharge as step lines (never interpolated curves), using a heuristic-selected representative week (highest-export week) labeled with which week was chosen and why.
  3. All numbers in the UI display at most one decimal place (no `1.7432 kWh`); a UI unit-formatter helper enforces this, covered by a test.
  4. A collapsible "Hoe is dit berekend?" panel lists the simulator's assumptions in plain Dutch (round-trip loss, DoD, charge/discharge clamping, saldering simplification, period framing), and a "Waarom geen euro's?" explainer states why v1 reports kWh only and what v2 will add.
  5. The full UI is in Dutch, technical terms have hover/tap tooltips, the results layout is readable on a 375px-wide mobile viewport (no horizontal scroll for headline numbers), and a terminology grep across `src/` finds zero occurrences of "solar production" / "solar generation" / "zonne-opwekking" — only "stroom teruggeleverd aan het net" / "solar surplus" / "teruglevering" are used.
  6. The shipped app contains no email field, no account form, no contact form, and no "vraag offerte aan" CTA (verified by string grep + manual review of every page).
**Plans**: 5 plans (4 autonomous, 1 with live human-verify)
- [x] 05-01-PLAN.md — Wave 0 gate: install uPlot + pure helpers bucketByMonth/selectRepresentativeWeek + formatAxisKwh, node-env fixtures (VIZ-01/02/04)
- [x] 05-02-PLAN.md — Four new CSS files + terminology/no-CTA CI grep audits (UX-04 reflow CSS, UX-05, UX-06)
- [x] 05-03-PLAN.md — uPlot chart DOM adapters: monthly bars + sample-week step-line flow chart with dropdown (VIZ-01/02/03/04)
- [x] 05-04-PLAN.md — Transparency panel + "Waarom geen euro's?" + technical-term tooltips (UX-01/02/03)
- [x] 05-05-PLAN.md — Wire main.ts (CSS imports + chart/panel/tooltip mounts) + live human-verify (charts, colors, step lines, 375px reflow)
**UI hint**: yes

### Phase 6: Post-v1 UX Enhancements — Multiple Custom Batteries + Optional Saldering
**Goal**: Two consumer-requested enhancements surfaced during Phase 4 UAT (see `04-UAT.md` → "Enhancement Notes"), deferred from v1: (1) let users add MORE THAN ONE custom battery to the comparison, and (2) make the saldering treatment an optional mode that is OFF by default so the post-2027 "zonder saldering" reality is the headline.
**Depends on**: Phase 5
**Requirements**: BATT-05, COMP-04, COMP-05, COMP-06 (extended from v1; this phase adds no new requirement IDs — it extends existing ones)
**Success Criteria** (what must be TRUE):
  1. A user can define and add multiple custom batteries (each via the "+ Eigen batterij" flow), all appearing as their own comparison columns, still bounded by the max-5 total selection cap; each custom battery keeps a consistent, distinct swatch color across picker and table.
  2. Saldering is OFF by default: on first render the comparison shows only the "zonder saldering" (post-2027) reality. A clearly-labelled toggle lets the user opt in to also show the "met saldering" column; the corrected policy copy (saldering 100% t/m 2026, volledig afgeschaft 2027-01-01, wettelijk minimum terugleververgoeding 50% t/m 2030) is surfaced when the mode is on.
  3. Both behaviors are covered by tests, introduce no inline styles (style-src 'self' CSP), and the comparison still recomputes correctly through the existing Comlink worker pipeline.
**Source**: Phase 4 UAT enhancement notes — "Multiple custom batteries" (Test 4) and "Saldering optional + off by default" (Test 7). Both were enhancements, not defects (the underlying UAT tests passed).
**Plans**: 3 plans (2 autonomous, 1 with live human-verify)
- [x] 06-01-PLAN.md — State model: customBatteries collection + salderingOn signal + array-aware activeBatteries (D-09, D-03)
- [x] 06-02-PLAN.md — Multi-custom picker: fresh card per click, optional name, per-card remove, valid-only cap, order-based swatches (D-01..D-05)
- [x] 06-03-PLAN.md — Saldering toggle: OFF-default single column / ON pair, ON-only disclaimer, options-row mount, live human-verify (D-06..D-08)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Setup, Deploy Plumbing, Privacy Rules | 3/3 | Complete   | 2026-06-07 |
| 2. CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series | 4/4 | Complete   | 2026-06-09 |
| 3. Battery Simulator and Curated Catalog | 4/4 | Complete   | 2026-06-09 |
| 4. Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State | 8/8 | Complete   | 2026-06-14 |
| 5. Visualizations, Polish, Transparent-Assumptions UI | 5/5 | Complete   | 2026-06-14 |
| 6. Post-v1 UX Enhancements — Multiple Custom Batteries + Optional Saldering | 3/3 | Complete   | 2026-06-15 |
