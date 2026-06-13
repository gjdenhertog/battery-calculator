# Battery Calculator

## What This Is

A simple, fully client-side web app that helps regular Dutch consumers figure out which home battery best fits their home's actual power usage and solar generation. Users upload one or more energy CSV exports (P1 meter, energy provider), pick one or more candidate batteries, and get a comparison of how much energy each battery would have shifted from the grid to self-consumption over the period.

## Core Value

The user uploads their own real CSV data and gets back a clear, honest comparison of which battery size makes sense for their house — without sending any data anywhere.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] Upload one or more energy CSV files in the browser — validated Phase 4 (drop-zone + file picker wired to the live reactive pipeline)
- [x] Auto-detect CSV format (HomeWizard P1 export; more NL sources as samples are collected) — validated Phase 2 (parser registry + adapter), exercised end-to-end in Phase 4
- [x] Parse import and export (feed-in) energy data into a normalized time series — validated Phase 2 (`IntervalSample[]`), live in Phase 4
- [x] Merge multiple files; on overlapping timestamps the higher-resolution data point wins — validated Phase 2
- [x] Default to the full period covered by the data; allow narrowing to a user-chosen sub-period — validated Phase 4 (period control, D-19 full-range default)
- [x] Pick a battery from a curated catalog (default: Sessy 5 kWh) or provide a custom config — validated Phase 3 (catalog + `simulate`) + Phase 4 (spec-card picker, custom card)
- [x] Select multiple batteries to compare side-by-side in one run — validated Phase 4 (max-5 picker + `runComparison`)
- [x] Compare saldering on/off — validated Phase 4 as side-by-side "zonder/met saldering" columns (D-01/COMP-02), not a re-computing toggle, so both scenarios are visible at once
- [x] Simulate, per battery, the energy stored during solar export and later self-consumed instead of imported — validated Phase 3 engine, surfaced in the Phase 4 UI
- [x] Show a comparison table (self-consumption %, kWh shifted, residual grid import, residual feed-in) — validated Phase 4 (comparison table + per-row leader highlighting + marginal capture rate)
- [x] Privacy promise: uploaded CSVs never leave the browser — validated Phase 1 CSP (`connect-src 'none'`) + Phase 4 Comlink worker (postMessage only); production re-confirm tracked in 04-HUMAN-UAT.md

### Active

<!-- Current scope. Building toward these. -->

- [ ] Show key charts (e.g. monthly self-consumption bars, a sample-week energy flow chart) — Phase 5
- [ ] Ship as static files hosted on GitHub Pages; everything runs in the user's browser — implemented Phase 1; live-deploy reachability pending human verification (01-HUMAN-UAT.md)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- € savings, payback period, ROI calculations — deferred to a later milestone alongside dynamic pricing; v1 reports kWh only to keep the calculation honest and scope tight
- Dynamic / hourly tariffs (Tibber, ANWB Energie, Frank) — requires a price source or extra upload; revisit when financials land
- Separate solar-production CSV upload (from inverter / Enphase / SolarEdge / Growatt) — v1 derives solar availability from P1 net flows; future milestone
- Non-NL regions (BE, DE, EU-wide) — keeps format detection and battery catalog tight
- Year-by-year NL saldering phase-out schedule — v1 uses a simple on/off toggle; more nuanced modeling later
- Full physical battery model (degradation curves, temperature effects, inverter losses) — out of scope for a consumer-grade sizing tool
- Any server-side component, account system, or remote storage — explicit non-goal; everything runs client-side

## Context

- Audience is regular NL homeowners with solar, evaluating a battery now because the salderingsregeling (net-metering) is being phased out — the financial logic of solar is changing and people need a quick gut check on battery sizing.
- P1 meter readings (HomeWizard etc.) are common in NL households; provider exports are also available from the major energieleveranciers but vary in format and resolution.
- The user (project owner) will collect sample exports from multiple sources over time and feed them in to expand the auto-detect format library.
- "Comparison" is the central interaction — users care about *which* battery fits, not just whether *a* battery fits.
- Default battery (Sessy 5 kWh) is intentionally NL-made and modular, which matches the typical row-house consumer profile (~3500 kWh/yr).

## Constraints

- **Tech stack**: Vanilla TypeScript + Vite — chosen for minimal dependencies, easy long-term maintenance, and clean GitHub Pages deploys.
- **Hosting**: GitHub Pages — implies static build output, no server-side code, no environment secrets, no API keys baked in.
- **Privacy**: All CSV parsing and computation must happen in the browser. No network calls with user data, ever. This is both a feature and a hard constraint.
- **Bundle size**: Should remain modest — this is a single-purpose calculator, not an app shell. Battery catalog ships as bundled JSON.
- **Region**: Netherlands-only for v1 — formats, default battery, saldering modeling all assume NL context.
- **Calculation fidelity**: Battery model is capacity + charge/discharge power + round-trip efficiency + depth of discharge. Detailed enough that a small battery can't absorb a midday solar peak, simple enough to explain to a non-engineer.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fully client-side, GitHub Pages hosting | Simplest deploy, zero infra cost, strongest privacy story | Implemented (Phase 1) — maximal-lockdown CSP (`connect-src 'none'`), CI `dist/` privacy guard, official Pages deploy chain; live-deploy reachability pending human verification |
| Vanilla TypeScript + Vite (no framework) | Minimal deps, fast ship, easy maintenance for a single-purpose tool | Implemented (Phase 1) — Vite 8 + TS 5.6 scaffold, design-token CSS, 3-region shell, `tsc -b` typecheck + ESLint/Prettier/Vitest in CI |
| Netherlands-only for v1 | Format detection, battery catalog, and saldering modeling all benefit from a tight regional focus | — Pending |
| P1-derived solar (no separate solar CSV in v1) | Most NL P1 exports already include feed-in; defers a whole upload/parser pathway | — Pending |
| Overlap resolution: higher-resolution data wins | P1 (15-min or finer) is more accurate than provider hourly exports; predictable default | — Pending |
| Battery model includes power limits + efficiency + DoD | Capacity-only is misleading for sizing decisions; full physical model is overkill | — Pending |
| Curated catalog of ~6–10 NL batteries + Custom | Balances "no decision paralysis" with "I have a different battery"; bundled JSON for offline use | — Pending |
| Default battery = Sessy 5 kWh | NL-made, modular, sized for typical row-house consumption | — Pending |
| Saldering modeled as on/off toggle (v1) | Captures the core "is a battery worth it post-saldering?" question without UI complexity | — Pending |
| kWh-only outputs for v1, defer € to later milestone | Financial modeling needs tariff/dynamic-pricing input; cleaner to ship a solid energy model first | — Pending |
| Output = comparison table + key charts | Numbers answer the decision; charts build intuition for why | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-13 after Phase 4 (Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State) complete — the differentiator now ships as a live UI on the proven core. Reactive signal state (@preact/signals-core), Comlink simulation Web Worker (off-main-thread `runComparison`), a battery spec-card picker (Sessy 5 default, max 5 + custom), a period-narrowing control (full-range default, no /jaar /maand extrapolation), and a comparison table with "zonder/met saldering" side-by-side columns, per-row leader highlighting, marginal capture rate, and a "Rekenen…" interactivity indicator. Verified 5/5 success criteria + 11/11 requirements (SIM-07/08, COMP-01..08, DATA-12); 290 Vitest tests green; production build emits the worker chunk. A render-race crash on multi-battery select was caught at the human-verify checkpoint and fixed; code review found 3 Critical + 4 Warning issues, all fixed (CR-01 stranded isComputing, CR-02 batch ordering, CR-03 status-node cleanup, dispose leaks, 6th swatch, zero-value coloring). Post-fix browser re-confirmation tracked in 04-HUMAN-UAT.md (accepted on regression-test strength). Phase 1 live-deploy reachability still pending human verification (01-HUMAN-UAT.md). Next: Phase 5 — charts, transparent-assumptions UI, Dutch copy pass, honest terminology audit.*
