# Roadmap: Battery Calculator

## Overview

A vertical-but-deliberately-horizontal build of an NL home battery sizing tool. We deploy a static "hello world" first to lock in the GitHub Pages base-path and the no-third-party-script privacy rule before any feature code (Phase 1). Then we build the data layer bottom-up: parser registry + HomeWizard P1 adapter + DST-safe merging produces a fixture-locked canonical `IntervalSample[]` (Phase 2). The pure simulator and curated battery catalog land next — provable correct by hand-computed fixtures without any UI (Phase 3). The differentiator (multi-battery side-by-side comparison) lands on top of that proven core, with reactive state, workers, and the comparison table (Phase 4). Finally, charts, the Dutch copy pass, transparent-assumptions UI, and the honest terminology audit close out v1 (Phase 5). Phases are horizontal technical layers: types and contracts at the bottom, UI at the top, with each layer fully verified before the next is built on it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Setup, Deploy Plumbing, Privacy Rules** - Vite + TS scaffold deployed to GitHub Pages with CSP, no third-party scripts, CI green
- [ ] **Phase 2: CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series** - HomeWizard P1 parses to canonical `IntervalSample[]`; multi-file merger; period filter; sanity readout; worker parsing
- [ ] **Phase 3: Battery Simulator and Curated Catalog** - Pure `simulate()` with hand-computed fixture tests; curated NL battery catalog JSON; Sessy 5 kWh default; custom battery support
- [ ] **Phase 4: Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State** - `runComparison`, signals state, dropzone, parser+simulator workers (Comlink), comparison table with saldering on/off as side-by-side columns
- [ ] **Phase 5: Visualizations, Polish, Transparent-Assumptions UI** - Monthly self-consumption bars + sample-week step-line flow chart; assumptions panel; "no euros" explainer; Dutch copy pass; mobile layout; honest terminology audit

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
- [ ] 01-01-PLAN.md — Vite+TS scaffold, toolchain, build-only CSP plugin, design tokens, 3-region shell
- [ ] 01-02-PLAN.md — Contract-locking Vitest suite (CSP directives + shell DOM + verbatim privacy promise)
- [ ] 01-03-PLAN.md — GitHub Actions CI + privacy guard + Pages deploy + README; live-deploy human verify


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
**Plans**: TBD
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
**Plans**: TBD

### Phase 4: Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State
**Goal**: The differentiator — multi-battery side-by-side comparison from the user's own CSV — lands as a working UI on top of the proven simulator. Reactive state (signals), parser worker, simulator worker (Comlink), comparison table with saldering on/off as side-by-side columns per battery, headline metric "kWh grid import avoided", marginal capture rate, per-row leader highlighting, period coverage indicator.
**Depends on**: Phase 3
**Requirements**: SIM-07, SIM-08, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08
**Success Criteria** (what must be TRUE):
  1. User can drop a CSV, pick up to 5 batteries (catalog + optional custom), and see a comparison table whose headline column for each battery is "kWh grid import avoided" — placed first, with self-consumption % shown as a secondary column.
  2. The comparison table shows saldering-ON and saldering-OFF scenarios side-by-side as two columns per battery (no re-run, no toggle that re-computes); a short disclaimer near these columns notes the 2026 64% cap, terugleverkosten, and the 50% floor through 2030.
  3. The table includes a "marginal capture rate" column (`shiftedKwh / capacityKwh`) so diminishing returns are visible at a glance, and each metric column visually highlights the per-row leader without synthesizing a "best battery" verdict.
  4. While the simulator is running, the UI remains interactive (input controls do not lock, no dropped frames > 200 ms on a slider drag) and a small "Rekenen…" indicator is visible; the simulator and comparison aggregator execute inside a Web Worker via Comlink, while the same pure functions still pass Vitest unit tests without a worker.
  5. The results panel displays the dataset's period coverage ("43 dagen aan data") alongside the table, and every reported number is framed as "over de periode die je hebt geüpload" — there is no auto-extrapolation to `/year` or `/month` anywhere in the UI.
  6. A consistent color is assigned per selected battery on the table and is preserved as the same color in every subsequent chart rendered in Phase 5 (verified by manual visual check + a `colorFor(batteryId)` helper covered by a unit test).
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Setup, Deploy Plumbing, Privacy Rules | 0/3 | Planned | - |
| 2. CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series | 0/TBD | Not started | - |
| 3. Battery Simulator and Curated Catalog | 0/TBD | Not started | - |
| 4. Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State | 0/TBD | Not started | - |
| 5. Visualizations, Polish, Transparent-Assumptions UI | 0/TBD | Not started | - |
