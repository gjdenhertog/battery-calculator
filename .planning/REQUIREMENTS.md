# Requirements: Battery Calculator

**Defined:** 2026-05-26
**Core Value:** The user uploads their own real CSV data and gets back a clear, honest comparison of which battery size makes sense for their house — without sending any data anywhere.

## v1 Requirements

Requirements for the initial release. Each maps to a roadmap phase.

### Setup (SETUP)

- [x] **SETUP-01**: Vite + TypeScript project scaffold builds to static output suitable for GitHub Pages (`base: '/battery-calculator/'`)
- [ ] **SETUP-02**: A "hello world" page is reachable at `https://<user>.github.io/battery-calculator/` via GitHub Actions deploy (`actions/checkout@v6` + `setup-node@v6` + `configure-pages@v6` + `upload-pages-artifact@v5` + `deploy-pages@v5`)
- [ ] **SETUP-03**: CI runs lint, formatter check, and Vitest on every push; deploy only runs after CI is green on the main branch
- [ ] **SETUP-04**: No third-party scripts ship in the bundle (no analytics, no Sentry, no Google Fonts, no CDN-loaded libraries) — verified by a CI grep / Network-tab inspection note in the README
- [x] **SETUP-05**: A CSP `<meta http-equiv>` tag in `index.html` restricts script/style/connect sources to `'self'` (GitHub Pages cannot set HTTP headers)

### Privacy (PRIV)

- [x] **PRIV-01**: Uploaded CSV files are read and processed entirely in the browser; no network request includes user data
- [x] **PRIV-02**: The privacy promise ("Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden") is visible *at the drop zone*, not buried in a footer
- [ ] **PRIV-03**: Parse errors are shown to the user but never sent off-device (no error-reporting library)

### Data Ingestion (DATA)

- [ ] **DATA-01**: User can drop one or more files onto a drop zone (drag-and-drop) and also pick files via a button (file-picker fallback always visible)
- [ ] **DATA-02**: The app auto-detects the source format of each uploaded CSV via a parser-registry pattern; v1 ships with at least one concrete parser (HomeWizard P1 export)
- [ ] **DATA-03**: Adding a new format in the future is a single-file change (a new parser registered via import side-effect — no central switch statement to edit)
- [ ] **DATA-04**: Parsing handles NL CSV variants: UTF-8 with optional BOM, `;` delimiter, decimal comma, DD-MM-YYYY date format
- [ ] **DATA-05**: Parsing correctly classifies a series as `cumulative` vs `interval` (declared per adapter; monotonicity-checked at parse time); first-interval anomalies are flagged, not silently propagated
- [ ] **DATA-06**: Energy is represented internally as two non-negative fields per interval — `gridImportKwh` and `gridExportKwh` — never as a single signed `net` (prevents sign-flip bugs)
- [ ] **DATA-07**: All internal timestamps are UTC `Date` instances; Europe/Amsterdam ↔ UTC conversion happens only inside the parser, using `@date-fns/tz`'s `TZDate`
- [ ] **DATA-08**: DST transitions are handled correctly — a CSV crossing 2026-03-29 yields 92 intervals for that day; a CSV crossing 2026-10-25 yields 100 intervals; both are covered by CI fixtures
- [ ] **DATA-09**: A specific parse error names the file, row, column, and what was expected (no generic "failed to parse")
- [ ] **DATA-10**: When two uploaded files cover the same timestamp, the data point from the file with the finer interval resolution wins
- [ ] **DATA-11**: After parse + merge, the user sees a sanity readout: file count, total rows, date range, total import kWh, total export kWh, count of any gaps detected
- [ ] **DATA-12**: User can narrow the analysis to a sub-period of the merged data (defaults to the full range)
- [ ] **DATA-13**: CSV parsing runs off the main thread (PapaParse `worker: true`) so dropping a large file never freezes the UI

### Battery Catalog & Model (BATT)

- [ ] **BATT-01**: A curated catalog of ~6–10 NL-popular home batteries ships as bundled JSON; each entry cites a datasheet URL in the source file
- [ ] **BATT-02**: Each catalog entry defines: nominal capacity (kWh), usable capacity or depth-of-discharge fraction, round-trip efficiency, max charge power (kW), max discharge power (kW)
- [ ] **BATT-03**: Default selection on first run is "Sessy 5 kWh" (NL-made, modular, sized for typical row-house consumption)
- [ ] **BATT-04**: User can configure a custom battery by entering the same five fields (capacity, DoD, RTE, max charge kW, max discharge kW)
- [ ] **BATT-05**: User can select multiple batteries (catalog entries and/or one custom) to compare in the same run; the UI caps the visible comparison at 5 batteries

### Simulation Engine (SIM)

- [ ] **SIM-01**: A pure `simulate(samples, batteryConfig, options) → SimResult` function exists in `src/domain/` with zero browser/DOM dependencies — runnable in plain Node Vitest
- [ ] **SIM-02**: The simulator clamps charge per interval by `min(surplusKwh, maxChargeKw × intervalHours, capacityRemainingKwh)` and discharge symmetrically (a 5 kWh battery with 2.2 kW max charge cannot absorb a 4 kWh interval)
- [ ] **SIM-03**: Round-trip efficiency is applied symmetrically (`sqrt(rte)` each way) so charge and discharge each carry half the loss
- [ ] **SIM-04**: Usable capacity (depth-of-discharge) is honored — a "5 kWh nominal" battery with 90% DoD never stores more than 4.5 kWh
- [ ] **SIM-05**: The simulator is covered by hand-computed fixture tests: a known one-week dataset produces a known SimResult; edge cases include the small-battery-can't-catch-the-peak case and a multi-day dataset with no export
- [ ] **SIM-06**: `runComparison(samples, batteries, options)` aggregates per-battery results into a single comparable structure (`batteries.map(b => simulate(samples, b))`)
- [ ] **SIM-07**: The simulator and comparison aggregator run inside a dedicated Web Worker (exposed via Comlink); the main thread only ever sends inputs and receives `SimResult`s. The same pure functions are unit-tested in Vitest without a worker.
- [ ] **SIM-08**: While a simulation is running, the UI remains interactive (no input lock, no jank); a small indicator shows that a recomputation is in progress

### Comparison & Output (COMP)

- [ ] **COMP-01**: The comparison view shows, per selected battery: kWh grid import avoided (headline), self-consumption %, kWh shifted from export to self-consumption, residual grid import (kWh), residual feed-in (kWh), and a "marginal capture rate" column (`shiftedKwh / capacityKwh`) so diminishing returns are visible
- [ ] **COMP-02**: The headline metric is "kWh grid import avoided" — placed first; "self-consumption %" is shown but secondary
- [ ] **COMP-03**: Each metric column highlights the per-row leader (no synthesized "best battery" verdict)
- [ ] **COMP-04**: A consistent color is assigned per selected battery and re-used across the table and all charts
- [ ] **COMP-05**: A "saldering ON" and "saldering OFF" scenario are shown side-by-side per battery in the comparison table (the user sees both with no re-run)
- [ ] **COMP-06**: A short disclaimer near the saldering columns notes the simplification: 2026 saldering is already capped at 64%, terugleverkosten apply regardless, and a 50%-of-bare-supply-tariff floor runs through 2030
- [ ] **COMP-07**: All reported numbers are framed as "over the period you uploaded" — no auto-extrapolation to "/year" or "/month" when the dataset doesn't cover that period
- [ ] **COMP-08**: Period coverage indicator (e.g. "43 dagen aan data") is visible alongside the results

### Visualization (VIZ)

- [ ] **VIZ-01**: A grouped-bar chart shows self-consumption per month per selected battery
- [ ] **VIZ-02**: A sample-week energy flow chart shows grid import, grid export, and battery charge/discharge as step lines for a representative week from the user's dataset (heuristic: highest-export week)
- [ ] **VIZ-03**: Charts use step lines (not interpolated lines) for any quantized energy data — never imply smooth values between intervals
- [ ] **VIZ-04**: All numbers in the UI are displayed with at most one decimal place (no false precision like "1.7432 kWh")

### UX & Polish (UX)

- [ ] **UX-01**: A collapsible "Hoe is dit berekend?" panel lists the simulator's assumptions (round-trip loss, DoD, charge/discharge clamping, saldering simplification, period framing) in plain Dutch
- [ ] **UX-02**: An "Waarom geen euro's?" explainer states why v1 reports kWh only and what v2 will add
- [ ] **UX-03**: The full UI is in Dutch; technical terms have hover/tap tooltips
- [ ] **UX-04**: The results layout is readable on a mobile screen (no horizontal scroll for the headline numbers)
- [ ] **UX-05**: Terminology is honest: the app says "stroom teruggeleverd aan het net" / "solar surplus", never "solar production" or "solar generation" (we don't actually measure those — we infer surplus from P1 net flows)
- [ ] **UX-06**: No email, account, or contact form anywhere in the app; no "vraag offerte aan" CTAs

## v2 Requirements

Acknowledged but explicitly deferred. Tracked here so they don't get lost.

### Financials (FIN)

- **FIN-01**: User can enter a fixed import and feed-in tariff to see € saved alongside kWh shifted
- **FIN-02**: Support day/night dual tariff input
- **FIN-03**: Compute simple payback period in years (with assumptions disclosed)

### Dynamic Pricing (DYN)

- **DYN-01**: Support hourly dynamic tariffs (Tibber, ANWB Energie, Frank) via either an API or a user CSV upload
- **DYN-02**: Show battery arbitrage potential separately from solar self-consumption shift

### Additional Data Sources (SRC)

- **SRC-01**: Parser for Eneco "Mijn Eneco" CSV export
- **SRC-02**: Parser for Vandebron CSV export
- **SRC-03**: Parser for Greenchoice CSV export
- **SRC-04**: Parser for Essent CSV export
- **SRC-05**: Parser for Tibber NL CSV export
- **SRC-06**: Parser for Sessy app CSV export
- **SRC-07**: Parser for slimmemeterportal.nl XLSX export
- **SRC-08**: Encoding fallback for Windows-1252 files (ArrayBuffer + TextDecoder)

### Separate Solar Data (SOLAR)

- **SOLAR-01**: User can upload a separate solar production CSV (inverter / Enphase / SolarEdge / Growatt)
- **SOLAR-02**: When a solar CSV is present, simulation distinguishes true self-consumption from grid-net flows

### Saldering Detail (SALD)

- **SALD-01**: Year-by-year NL saldering phase-out schedule applied per year of the data period
- **SALD-02**: Configurable terugleverkosten input (€/kWh)
- **SALD-03**: Configurable saldering percentage cap (defaults to the year's actual cap)

### Convenience (CONV)

- **CONV-01**: Shareable URL that encodes the current battery selection + settings (never the CSV)
- **CONV-02**: CSV/PNG export of the comparison table and charts
- **CONV-03**: "Show only differences" toggle on the comparison table
- **CONV-04**: Browser-local cache of last-parsed dataset (opt-in, with explicit privacy disclosure)

## Out of Scope

Explicitly excluded. Documented so they don't get re-proposed mid-build.

| Feature | Reason |
|---------|--------|
| Backend / server-side anything | Explicit non-goal. The privacy promise *is* the product — adding a server breaks it. GitHub Pages static hosting only. |
| Account system, email, login | Same reason. No identity = no data = nothing to leak. |
| "Get a quote" / lead-capture forms | Anti-feature. The tool is vendor-neutral; turning it into a funnel destroys the trust angle. |
| Single "best battery" verdict | Anti-feature. We present numbers; the user decides. No tool can collapse a multi-axis tradeoff (cost, capacity, brand trust, install constraints) into a winner. |
| € savings / payback period (v1) | Deferred to v2 alongside dynamic pricing. Doing it badly is worse than not doing it — every tariff assumption changes the answer. |
| Year-by-year saldering schedule (v1) | Deferred to v2. v1 ships a simple on/off + a disclaimer that the toggle is a simplification. |
| Separate solar production CSV (v1) | Deferred to v2. Most NL P1 exports already include feed-in; building a second parser pathway for v1 doesn't add proportional value. |
| Non-NL regions (DE, BE, EU-wide) | Out of scope for v1. Format detection, default battery, and saldering modeling all assume NL context. |
| Full physical battery model (degradation, temperature, inverter losses) | Out of scope. Consumer sizing tool; this level of fidelity belongs in vendor calculators. |
| Auto-fetch from HomeWizard / Tibber / provider APIs | Out of scope. Requires credentials, undermines the "no network calls" promise. CSV upload only. |
| PDF report export | Out of scope. Browser print covers it. |
| Real-time data streaming | Out of scope. This is an analysis tool, not a dashboard. |
| Analytics / telemetry of any kind | Anti-feature. Privacy is non-negotiable. |

## Traceability

Each v1 requirement maps to exactly one phase. No orphans, no duplicates.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Complete |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| SETUP-05 | Phase 1 | Complete |
| PRIV-01 | Phase 1 | Complete |
| PRIV-02 | Phase 1 | Complete |
| PRIV-03 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| DATA-06 | Phase 2 | Pending |
| DATA-07 | Phase 2 | Pending |
| DATA-08 | Phase 2 | Pending |
| DATA-09 | Phase 2 | Pending |
| DATA-10 | Phase 2 | Pending |
| DATA-11 | Phase 2 | Pending |
| DATA-12 | Phase 2 | Pending |
| DATA-13 | Phase 2 | Pending |
| BATT-01 | Phase 3 | Pending |
| BATT-02 | Phase 3 | Pending |
| BATT-03 | Phase 3 | Pending |
| BATT-04 | Phase 3 | Pending |
| BATT-05 | Phase 3 | Pending |
| SIM-01 | Phase 3 | Pending |
| SIM-02 | Phase 3 | Pending |
| SIM-03 | Phase 3 | Pending |
| SIM-04 | Phase 3 | Pending |
| SIM-05 | Phase 3 | Pending |
| SIM-06 | Phase 3 | Pending |
| SIM-07 | Phase 4 | Pending |
| SIM-08 | Phase 4 | Pending |
| COMP-01 | Phase 4 | Pending |
| COMP-02 | Phase 4 | Pending |
| COMP-03 | Phase 4 | Pending |
| COMP-04 | Phase 4 | Pending |
| COMP-05 | Phase 4 | Pending |
| COMP-06 | Phase 4 | Pending |
| COMP-07 | Phase 4 | Pending |
| COMP-08 | Phase 4 | Pending |
| VIZ-01 | Phase 5 | Pending |
| VIZ-02 | Phase 5 | Pending |
| VIZ-03 | Phase 5 | Pending |
| VIZ-04 | Phase 5 | Pending |
| UX-01 | Phase 5 | Pending |
| UX-02 | Phase 5 | Pending |
| UX-03 | Phase 5 | Pending |
| UX-04 | Phase 5 | Pending |
| UX-05 | Phase 5 | Pending |
| UX-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52 ✓
- Unmapped: 0

**Per-phase counts:**
- Phase 1 (Setup, Deploy Plumbing, Privacy Rules): 8 (SETUP-01..05, PRIV-01..03)
- Phase 2 (CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series): 13 (DATA-01..13)
- Phase 3 (Battery Simulator and Curated Catalog): 11 (BATT-01..05, SIM-01..06)
- Phase 4 (Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State): 10 (SIM-07, SIM-08, COMP-01..08)
- Phase 5 (Visualizations, Polish, Transparent-Assumptions UI): 10 (VIZ-01..04, UX-01..06)

---
*Requirements defined: 2026-05-26*
*Last updated: 2026-06-07 — traceability populated by gsd-roadmapper*
