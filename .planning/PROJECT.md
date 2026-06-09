# Battery Calculator

## What This Is

A simple, fully client-side web app that helps regular Dutch consumers figure out which home battery best fits their home's actual power usage and solar generation. Users upload one or more energy CSV exports (P1 meter, energy provider), pick one or more candidate batteries, and get a comparison of how much energy each battery would have shifted from the grid to self-consumption over the period.

## Core Value

The user uploads their own real CSV data and gets back a clear, honest comparison of which battery size makes sense for their house — without sending any data anywhere.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Upload one or more energy CSV files in the browser
- [ ] Auto-detect CSV format (start with HomeWizard P1 export; more NL sources added as sample files are collected)
- [ ] Parse import and export (feed-in) energy data into a normalized time series
- [ ] Merge multiple files; on overlapping timestamps the higher-resolution data point wins
- [ ] Default to the full period covered by the data; allow narrowing to a user-chosen sub-period
- [ ] Pick a battery from a curated catalog of ~6–10 NL-popular models (default: Sessy 5 kWh) or provide a custom config (capacity kWh, max charge/discharge kW, round-trip efficiency, depth of discharge)
- [ ] Select multiple batteries to compare side-by-side in one run
- [ ] Toggle saldering on/off and re-compute
- [ ] Simulate, per battery, the energy that would have been stored during solar export and later self-consumed instead of imported from the grid
- [ ] Show a comparison table (self-consumption %, kWh shifted, residual grid import, residual feed-in)
- [ ] Show key charts (e.g. monthly self-consumption bars, a sample-week energy flow chart)
- [ ] Ship as static files hosted on GitHub Pages; everything runs in the user's browser
- [ ] Privacy promise: uploaded CSVs never leave the browser

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
*Last updated: 2026-06-09 after Phase 3 (Battery Simulator and Curated Catalog) complete — the bottom-up domain core is now proven by Vitest: Phase 2 shipped the DST-safe CSV→`IntervalSample[]` data layer; Phase 3 shipped the pure `simulate()` dispatch engine (capacity/power/round-trip/DoD fidelity), a 7-entry curated NL catalog (Sessy 5 default), and `runComparison()`. Verified 11/11 must-haves; the mixed-interval residual energy-conservation gap (CR-01) was caught by code review and closed in 03-04. No UI yet — Active requirements remain unvalidated (user-facing) until the Phase 4 comparison UI lands. Phase 1 live-deploy reachability still pending human verification (01-HUMAN-UAT.md).*
