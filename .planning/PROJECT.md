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
- [x] Add multiple custom batteries (not just one) within the max-5 cap, each with an optional name and order-based color — validated Phase 6 (multi-custom picker with deferred-commit button)
- [x] Select multiple batteries to compare side-by-side in one run — validated Phase 4 (max-5 picker + `runComparison`)
- [x] Compare saldering on/off — validated Phase 4 (side-by-side "zonder/met saldering" columns), refined in Phase 6 to an opt-in toggle that is OFF by default so the post-2027 "zonder saldering" reality is the headline and "met saldering" is revealed on demand
- [x] Simulate, per battery, the energy stored during solar export and later self-consumed instead of imported — validated Phase 3 engine, surfaced in the Phase 4 UI
- [x] Show a comparison table (self-consumption %, kWh shifted, residual grid import, residual feed-in) — validated Phase 4 (comparison table + per-row leader highlighting + marginal capture rate)
- [x] Show key charts (monthly self-consumption bars, a sample-week energy flow chart) — validated Phase 5 (uPlot charts) with a transparent-assumptions panel and "no euros" explainer
- [x] Ship as static files on GitHub Pages; everything runs in the user's browser — validated Phase 1, live-verified at v1.0 close (https://gjdenhertog.github.io/battery-calculator/ serves the built artifact, HTTP 200, no 404s)
- [x] Privacy promise: uploaded CSVs never leave the browser — validated Phase 1 CSP (`connect-src 'none'`) + Phase 4 Comlink worker (postMessage only) + CI dist/ privacy guard; confirmed in Phase 6's approved live human-verify

### Active

<!-- Current scope. Building toward these. -->

_None — v1.0 MVP shipped 2026-06-16. Next-milestone scope not yet defined; run `/gsd:new-milestone`._

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- € savings, payback period, ROI calculations — deferred to a later milestone alongside dynamic pricing; v1 reports kWh only to keep the calculation honest and scope tight
- Dynamic / hourly tariffs (Tibber, ANWB Energie, Frank) — requires a price source or extra upload; revisit when financials land
- Separate solar-production CSV upload (from inverter / Enphase / SolarEdge / Growatt) — v1 derives solar availability from P1 net flows; future milestone
- Non-NL regions (BE, DE, EU-wide) — keeps format detection and battery catalog tight
- Year-by-year NL saldering phase-out schedule — v1 uses a simple on/off toggle; more nuanced modeling later
- Full physical battery model (degradation curves, temperature effects, inverter losses) — out of scope for a consumer-grade sizing tool
- Any server-side component, account system, or remote storage — explicit non-goal; everything runs client-side

## Current State

**Shipped: v1.0 MVP (2026-06-16)** — live at https://gjdenhertog.github.io/battery-calculator/

- 6 phases, 27 plans, ~12,400 LOC TypeScript (src + tests), 423 tests green.
- Stack: Vite 8 + TS 5.6, `@preact/signals-core`, papaparse, `@date-fns/tz`, uPlot, Comlink workers. Zero runtime network dependencies.
- Fully client-side on GitHub Pages; maximal-lockdown CSP (`connect-src 'none'`), CI privacy guard scans `dist/` for external URLs, no error-reporting libs.
- Known limitation: October DST fall-back parsing is only correct when the JS runtime TZ is Europe/Amsterdam (acceptable for the NL-only target; test suite pinned to that zone). Hardening is a follow-up if the app expands beyond NL.

## Next Milestone Goals

Not yet defined — run `/gsd:new-milestone` to scope v1.1+. Candidate directions parked in Out of Scope below: € savings / payback (needs tariffs), dynamic pricing, separate solar-CSV upload, year-by-year saldering phase-out modeling, additional NL CSV formats.

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
| Netherlands-only for v1 | Format detection, battery catalog, and saldering modeling all benefit from a tight regional focus | ✓ Good — held for all 6 phases; one consequence surfaced (DST fall-back parsing assumes Europe/Amsterdam runtime; test suite pinned accordingly) |
| P1-derived solar (no separate solar CSV in v1) | Most NL P1 exports already include feed-in; defers a whole upload/parser pathway | ✓ Good (Phase 2) — feed-in parsed from P1; no separate solar path needed |
| Overlap resolution: higher-resolution data wins | P1 (15-min or finer) is more accurate than provider hourly exports; predictable default | ✓ Good (Phase 2) — finer-wins `mergeFiles`, fixture-locked |
| Battery model includes power limits + efficiency + DoD | Capacity-only is misleading for sizing decisions; full physical model is overkill | ✓ Good (Phase 3) — `simulate()` with sqrt(rte), DoD cap, power clamp; 16 hand-computed fixtures |
| Curated catalog of ~6–10 NL batteries + Custom | Balances "no decision paralysis" with "I have a different battery"; bundled JSON for offline use | ✓ Good (Phase 3/4) — 7-entry catalog + custom; Phase 6 extended to multiple customs |
| Default battery = Sessy 5 kWh | NL-made, modular, sized for typical row-house consumption | ✓ Good (Phase 3) — pre-checked default |
| Saldering modeled as on/off toggle | Captures the core "is a battery worth it post-saldering?" question without UI complexity | ✓ Good — Phase 4 shipped side-by-side columns; Phase 6 refined to opt-in OFF-by-default toggle (post-2027 headline) |
| kWh-only outputs for v1, defer € to later milestone | Financial modeling needs tariff/dynamic-pricing input; cleaner to ship a solid energy model first | ✓ Good — honest kWh-only framing held; "no euros" explainer added (Phase 5) |
| Output = comparison table + key charts | Numbers answer the decision; charts build intuition for why | ✓ Good (Phase 4/5) — comparison table + uPlot monthly-bars + flow chart |
| Defer custom-battery recompute to an explicit commit button (Phase 6) | Per-keystroke recompute through the Comlink worker was slow with multiple customs | ✓ Good — "Toevoegen aan vergelijking" button; one recompute per commit |
| Pin test timezone to Europe/Amsterdam | NL-only app; DST fall-back parsing leaks the runtime TZ, and CI runs UTC | ⚠️ Revisit — masks a latent non-Amsterdam DST edge case; harden the parser if the app goes multi-region |

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
*Last updated: 2026-06-16 after v1.0 MVP milestone — all 6 phases shipped and deployed live to GitHub Pages. A fully client-side NL home-battery calculator: upload P1/energy CSVs, pick catalog and/or multiple custom batteries, get an honest side-by-side kWh-avoided comparison with charts and transparent assumptions — no data leaves the browser. ~12,400 LOC TS, 423 tests, maximal-lockdown CSP + CI privacy guard. Phase 6 added multiple custom batteries and an opt-in (OFF-by-default) saldering toggle. All v1.0 requirements validated; all pre-close UAT/verification/debug artifacts resolved with evidence (live-deploy verified, Phase 4 behaviors confirmed in Phase 6's approved live human-verify). One known limitation: DST fall-back parsing assumes the Europe/Amsterdam runtime (NL-only). Next: run `/gsd:new-milestone` to scope v1.1+.*
