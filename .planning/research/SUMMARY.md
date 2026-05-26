# Project Research Summary

**Project:** Battery Calculator
**Domain:** Client-side static calculator — NL home battery sizing tool (CSV-driven, vendor-neutral, multi-battery comparison)
**Researched:** 2026-05-26
**Confidence:** HIGH

## Executive Summary

A regular Dutch homeowner with solar wants to know, post-saldering, *which* home battery is worth buying for *their* actual usage. Every NL tool on the market today either gates the answer behind an account (jeroen.nl), funnels to a reseller (bereken-thuisbatterij.nl → OfferteAdviseur), or simulates only the vendor's own product (Sessy/Zonneplan/Essent). The closest open-source comparable (mark-vis/thuisbatterij-simulatie) runs one battery configuration per simulation. **No NL tool does true side-by-side, multi-battery comparison from the user's own CSV — that is this project's defensible gap, and it is uncopyable by any tool that touches a server.**

The recommended build is opinionated and small: vanilla TypeScript on Vite 8, a ~33 KB-gzipped runtime (PapaParse + uPlot + Preact signals-core + date-fns v4 with `@date-fns/tz`), Vitest for fixture-driven tests, and the official `actions/*-pages` deploy chain. Architecturally, a **pure domain core** (parsers, simulator, merger, aggregator — zero browser APIs) sits behind a **parser registry** so adding the next NL format is one new file, not a switch-statement edit. The canonical contract that decouples the whole pipeline is `IntervalSample[]` (`{timestamp, intervalSeconds, gridImportKwh ≥ 0, gridExportKwh ≥ 0}`). Workers come in later as adapters around the same pure functions.

The risks are not in the JavaScript — they are in the **physics modeling and the timezone math**. Five pitfalls can produce confidently wrong output that misleads a buyer: cumulative-vs-interval misclassification, sign-convention flips, ignoring round-trip efficiency + depth-of-discharge, ignoring max charge/discharge power (a 5 kWh battery is *not* a 5 kWh bucket), and DST-unsafe bucketing in Europe/Amsterdam. Two product-framing risks compound them: the **saldering toggle is a simplification** (2026 already capped at 64%, terugleverkosten apply, post-2027 has a 50% floor through 2030), and **"self-consumption %" alone is a misleading headline** that biases users toward over-sized batteries — "kWh of grid import avoided" is the more honest framing.

## Key Findings

### Recommended Stack

Baseline (vanilla TS + Vite + GitHub Pages, no framework) was locked in PROJECT.md. Research recommends the *supporting* libraries. Total runtime cost: **~33 KB gzipped**.

**Core technologies (highest-confidence picks):**
- **papaparse 5.5.3** (~6.9 KB gz) — CSV parsing; streams via `step`, runs in a worker via `worker: true`, handles File objects, supports `;` delimiter and BOM.
- **uPlot 1.6.32** (~22 KB gz) — time-series + bar charts; smallest competent option, beats Chart.js (~68 KB) and ECharts (~130 KB) on bundle and re-render speed for our 1k–10k point regime.
- **@preact/signals-core 1.14.2** (~1.5 KB gz) — framework-agnostic reactive state; three primitives (`signal`/`computed`/`effect`) cover ~3 controls feeding ~2 charts.
- **date-fns 4.3.0 + @date-fns/tz 1.5.0** (~3 KB gz) — Europe/Amsterdam DST-safe bucketing via `TZDate`; the only competent choice given Safari's lack of native `Temporal`.
- **vitest 4.1.7** — shares Vite 8's config and transformer, zero setup beyond `defineConfig`.
- **GitHub Actions deploy chain** — `actions/checkout@v6` + `setup-node@v6` + `configure-pages@v6` + `upload-pages-artifact@v5` + `deploy-pages@v5`. Do **not** use third-party `peaceiris`/`JamesIves`. One-time setup: Repo → Settings → Pages → Source = "GitHub Actions".

**Native HTML5 drag-and-drop** for upload — ~30 lines of TS beats FilePond/Uppy (~45 KB each) when there is no server to upload *to*.

### Expected Features

**The competitive gap (central finding):** multi-battery side-by-side comparison from the user's own CSV is unique in the NL market. The combination of (a) the user's own data, (b) vendor neutrality, (c) side-by-side N batteries, (d) zero server, (e) zero account is uncopyable by hosted competitors. Lean on this in copy ("open the Network tab — zero requests after the bundle loads").

**Must have (table stakes):**
- Drag-and-drop CSV upload + file-picker fallback, both visible
- Auto-detect of NL formats (HomeWizard P1 first; more as samples arrive)
- Visible privacy promise *at the drop zone* (not in a footer)
- No account, no email, no quote CTA — anywhere, ever
- Post-parse sanity readout (rows, date range, totals, gaps) before battery selection
- Period selector defaulting to full range
- Curated battery catalog (~6–10 NL models) + Sessy 5 kWh default + Custom escape hatch
- Saldering on/off toggle with **both scenarios visible simultaneously** in the comparison table
- Comparison table: self-consumption %, kWh shifted, residual grid import, residual feed-in
- Monthly self-consumption bars + sample-week energy flow chart
- Transparent assumptions panel ("Hoe is dit berekend?")
- Plain-Dutch labels with tooltips
- Specific parse errors naming row/column/expected format
- Mobile-readable result layout

**Should have (differentiators):**
- True multi-battery side-by-side (the central interaction; cap visible at 5)
- "Show only differences" toggle on the comparison table
- Saldering on vs off as two columns per battery (not two runs)
- Honest "kWh only, no euros yet" framing with explainer
- Per-row "winner" indicator on each metric (no synthesized verdict)
- Consistent color-per-battery across charts and table

**Defer (v1.x / v2+):**
- Additional NL CSV parsers (Eneco, Vandebron, Tibber, slimmemeterportal XLSX) — add as samples arrive
- Shareable URL with config (not CSV)
- CSV/PNG export
- Capacity sweep chart
- **Euro/payback + dynamic tariffs** — biggest deferred feature
- Year-by-year saldering phase-out modeling
- Separate solar production CSV
- Non-NL regions

**Explicit anti-features:** email/account gate, "get a quote" CTA, single "best battery" verdict, € savings in v1, auto-fetch from HomeWizard/Tibber APIs, PDF report export.

### Architecture Approach

Pure-domain core + thin adapter shells. **Zero browser APIs in `src/domain/`** — simulator, parsers, merger, aggregator are all pure TS functions, testable in plain Node Vitest. Workers come in later as ~20-line Comlink shells around the same pure functions. State lives in `@preact/signals-core` atoms with a single `effect()` that re-runs the simulator when inputs change. UI subscribes to results, never calls workers or domain code directly.

**Major components:**
1. **Format Detector + Parser Registry** — `detectFormat(sample)` ranks registered parsers; each parser is one file under `src/domain/parsers/` and registers itself by import side-effect.
2. **Canonical Normalizer** — every parser emits `IntervalSample[]` (`{timestamp: Date (UTC), intervalSeconds, gridImportKwh ≥ 0, gridExportKwh ≥ 0, sourceFormat}`). This is **the** decoupling contract.
3. **Multi-file Merger** — two-pointer sort/walk; higher-resolution wins on overlap.
4. **Period Filter** — pure binary-search slice.
5. **Battery Simulator** — pure `simulate(samples, BatteryConfig, SimOptions) → SimResult` with per-interval clamping; no clock reads, no DOM, no globals.
6. **Comparison Aggregator** — `batteries.map(b => simulate(samples, b))`; embarrassingly parallel.
7. **State (signals)** — `files`, `period`, `batteries`, `saldering` atoms; `mergedSamples`, `filteredSamples`, `results` computed.
8. **UI** — DOM helpers + uPlot; a `view-model.ts` translates `SimResult → ChartData`.
9. **Workers (later)** — Comlink shells; introduce when slider drags stall, not before.

Build order: types → first parser + simulator + merger → aggregator + catalog → workers → state → UI. Simulator + first parser can be proven correct **before any UI exists**.

### Critical Pitfalls (the 5 most damaging)

These are calculator-correctness issues — the kind that produce *confidently wrong* output and drive a user to buy the wrong battery.

1. **Cumulative vs interval misclassification** (Phase 2). DSMR/P1 telegrams are cumulative; provider kwartierwaarden are pre-differenced. Treat one as the other → first interval is thousands of kWh, or all rows near zero. **Mitigation:** each adapter declares `series_type: "cumulative" | "interval"`; monotonicity check after parse; UI surfaces the detected interpretation.

2. **Sign convention flip on import vs export** (Phase 2). A single flip silently produces a result that is not slightly off but *completely backwards* (battery "charges" at night, self-consumption goes negative). **Mitigation:** canonical normalized shape uses two non-negative fields `importKwh ≥ 0` and `exportKwh ≥ 0` — never a single signed `net`. Branded types at the parser boundary; CI invariant: no interval has both `import > 0` and `export > 0`.

3. **Missing round-trip efficiency + DoD** (Phase 3). A "5 kWh" Sessy modeled as 5 kWh usable with 100% RTE appears ~18% more effective than reality — enough to recommend 5 kWh when 7 kWh is needed. **Mitigation:** battery config carries `nominalCapacityKwh`, `usableCapacityKwh` (or `dodFraction`), `roundTripEfficiency`; simulator splits losses symmetrically (`sqrt(rte)` each way); catalog pre-populated with verified specs (Sessy 5 kWh: RTE 0.85, max charge 2.2 kW, max discharge 1.7 kW).

4. **Ignored max charge/discharge power** (Phase 3). Sessy 5 kWh absorbs only 2.2 kW, so a 4 kW solar burst still exports 1.8 kW. Capacity-only models massively overstate shifted energy on sunny days and make a 5 kWh look like a 15 kWh — hiding the real differentiator. **Mitigation:** per-interval clamping: `charge = min(surplusKwh, maxChargeKw × intervalHours, capacityRemainingKwh)`; discharge symmetrically. Hand-computed fixture (1.5 kWh export into 2 kW battery should charge ~0.5 kWh, not 1.5).

5. **DST / Europe/Amsterdam bucketing** (Phase 2). Spring-forward loses 02:00–03:00; fall-back sees it *twice* with identical local labels. `new Date("2025-10-26 02:30")` is ambiguous and JS silently picks one. Dev tests with summer data, ships, first October file silently corrupts a day. **Mitigation:** all internal timestamps UTC; parsing layer is the only place that touches Europe/Amsterdam, via `@date-fns/tz`'s `TZDate`. **Mandatory CI fixtures:** one CSV crossing 2026-03-29 (92 intervals) and one crossing 2026-10-25 (100 intervals) — without these, DST bugs ship.

**Critical secondary pitfalls (don't get top-of-doc billing but break the product):**
- **Privacy leak via third-party scripts** (Phase 1 + ongoing). No analytics, no Sentry, no Google Fonts, no CDN — bundle everything. Sentry has been caught capturing CSV rows in error contexts. Add CSP via `<meta http-equiv>` since GitHub Pages can't set HTTP headers. Verify on every release.
- **GitHub Pages base-path** (Phase 1). Set `base: '/battery-calculator/'`. Deploy a "hello world" first.
- **Saldering oversimplification** (Phase 4 copy): 2026 already capped at 64%; terugleverkosten of €0.02–€0.18/kWh apply regardless; post-2027 has a 50%-of-bare-supply-tariff floor through 2030. The on/off toggle needs a disclaimer near it; v1 must report **kWh only**.
- **"Self-consumption %" headline biases toward over-sized batteries** (Phase 4): headline must be **"kWh grid import avoided"**; add "marginal capture rate" column (`shiftedKwh / capacityKwh`) so diminishing returns are visible.
- **Partial-period extrapolation** (Phase 4): never auto-extrapolate to `/year`. Show "Over the 43 days you uploaded…".
- **"P1-derived solar" terminology** (Phase 4 audit): use `gridExport`/`solarSurplus`, never `solarProduction`/`solarGeneration`.

## Implications for Roadmap

Suggested phase structure: **5 phases**, dependency-driven (build order from leaves to UI) and pitfall-driven (modeling errors addressed in the phase that introduces their data).

### Phase 1: Setup + Deploy Plumbing + Privacy Rules
**Rationale:** GitHub Pages base-path and the no-third-party-script rule are cheap in Phase 1 and expensive in Phase 5. Deploy "hello world" *before* writing any parsing code so the deploy pipeline is proven, not assumed.
**Delivers:** Working Vite + TS scaffold deployed to `https://<user>.github.io/battery-calculator/`; GitHub Actions workflow green; `base: '/battery-calculator/'`; CSP meta tag; CI lint + format + Vitest baseline.
**Uses:** Vite 8 + TypeScript 5.6 + Vitest 4.1 + ESLint 9 + Prettier; `actions/*-pages` chain.
**Avoids:** Pitfalls #13 (privacy), #14 (Pages base path).

### Phase 2: CSV Parser + Format Detection + Multi-file Merge + DST-safe Time Series
**Rationale:** The data layer's most pitfall-dense phase (6 of 15 pitfalls). The canonical `IntervalSample[]` contract is established here. Parser registry built with **one** concrete parser (HomeWizard P1) so the framework's extensibility is validated.
**Delivers:** Parser registry + HomeWizard P1 adapter; multi-file merger with higher-resolution-wins overlap; period filter; canonical `IntervalSample[]` type; CI fixtures including DST transitions (2026-03-29 → 92 intervals, 2026-10-25 → 100), cumulative + pre-differenced, decimal-comma, enkeltarief + dual-tariff.
**Uses:** PapaParse, date-fns + @date-fns/tz, Vitest.
**Implements:** Parser Registry pattern, canonical normalizer, two-pointer merger.
**Avoids:** Pitfalls #1, #2, #5, #6, #7, #8.

### Phase 3: Battery Simulator + Curated Catalog
**Rationale:** Simulator is the most important code in the project. Pure function + hand-computed fixtures means the comparison engine is just `batteries.map(simulate)`. **Still no UI.** Phase ends with `npm run dev:cli` against a sample file producing expected numbers.
**Delivers:** Pure `simulate(...)` function; battery model with capacity + DoD + RTE + max-charge-kW + max-discharge-kW; curated JSON catalog with verified specs (Sessy 5/10, Zonneplan, Tesla Powerwall, Huawei Luna, Victron + 1–2 more); hand-computed fixture tests (one-week known result + edge cases).
**Uses:** Pure TS; Vitest with deterministic fixtures.
**Implements:** Pattern 3 (pure-function simulator).
**Avoids:** Pitfalls #3, #4. Each catalog entry cited to a datasheet URL.

### Phase 4: Comparison Engine + Comparison Table + Saldering Toggle + State Wiring
**Rationale:** Central differentiator (multi-battery side-by-side) is built on the proven simulator. Saldering toggle wired as `SimOptions` field but doesn't yet branch math. State layer (`@preact/signals-core`) comes online; first UI surfaces appear. Saldering "ON vs OFF" as two columns per battery, not two runs.
**Delivers:** `runComparison(samples, batteries, options)` aggregator; signals state store; dropzone with privacy promise *at* the drop zone; post-parse sanity readout; period selector; battery picker; comparison table with self-consumption %, kWh shifted, residual import, residual feed-in, marginal capture rate; saldering toggle with disclaimer copy; specific parse-error UI.
**Uses:** @preact/signals-core; PapaParse `worker: true` when parse latency justifies; native HTML5 drag-and-drop.
**Implements:** Pattern 2 (reactive state), Pattern 4 (workers as adapters — introduce when needed).
**Avoids:** Pitfalls #9 (saldering disclaimer), #11 (headline metric, marginal capture rate column).

### Phase 5: Visualizations + Polish + Transparent-Assumptions UI
**Rationale:** Charts and copy come last — they consume the result shape; building earlier means churn. Chart honesty rules enforced here (step charts, calendar-coverage indicators, no false precision).
**Delivers:** Monthly self-consumption grouped bars; sample-week energy flow chart (auto-pick representative sunny week); collapsible "Hoe is dit berekend?" panel; "Why no euros yet" explainer; mobile layout; full Dutch copy pass with tooltips; "Show only differences" toggle; per-row winner indicators.
**Uses:** uPlot; `view-model.ts` for `SimResult → ChartData`.
**Avoids:** Pitfalls #10 (no `/year` extrapolation), #12 (string audit), #15 (step charts, coverage indicators, rounded display).

### Phase Ordering Rationale
- **Bottom-up by dependency.** Types/parser/simulator are leaves (Phase 2–3); aggregator + state are trunks (Phase 4); UI is the canopy (Phase 5).
- **Pitfalls addressed in the phase that introduces their data.** Privacy + Pages are Phase 1 contracts re-verified every phase.
- **Workers come in late as adapters, not Phase 1 plumbing.** Build everything on the main thread first; move when measured.
- **No UI before the math is proven.** Phase 2 + 3 produce a CLI-runnable, fixture-tested core *before any dropzone exists* — avoids the common trap of building UI scaffolding before knowing what the math should output.
- **The differentiator (multi-battery comparison) lands in Phase 4, the earliest possible phase** — it's intentionally not deferred to Phase 5.

### Research Flags

**Phases likely needing deeper research during planning (`/gsd:plan-phase` will spawn researcher):**
- **Phase 2:** Needs **real HomeWizard CSV sample(s)** to confirm exact column names and unit conventions before writing the adapter. Also needs encoding fallback decision (UTF-8 → Windows-1252) and exact monotonicity threshold for cumulative-detection heuristic.
- **Phase 4:** Needs UX decisions on (a) saldering "two columns per battery" vs "scenario grouping"; (b) sample-week selection heuristic (median-export? sunniest? user-pickable?); (c) when to move simulator to a worker based on Phase 3's measured latency.

**Phases with standard patterns (skip research):**
- **Phase 1:** STACK.md provides exact workflow YAML and `base` config; hello-world deploy is the verification step.
- **Phase 3:** Per-interval clamping formula given in PITFALLS.md and ARCHITECTURE.md; catalog spec sources listed.
- **Phase 5:** uPlot patterns are conventional copy-paste-and-style; chart-honesty rules spelled out in PITFALLS.md #15.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry + GitHub release tags on 2026-05-26. The only LOW-confidence item (exact FilePond/Uppy gzip) doesn't change the conclusion. |
| Features | HIGH | Direct analysis of 13 NL/comparable tools. MEDIUM on anti-feature framing (synthesized from competitor patterns, not user studies — appropriate for "ship to validate"). |
| Architecture | HIGH | Patterns cross-referenced against authoritative sources; domain-core split is conventional. |
| Pitfalls | HIGH | Battery-modeling and P1/NL-data pitfalls verified against DSMR specs, HomeWizard docs, NL saldering regulation, Sessy specs. MEDIUM on UX/comparison pitfalls. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact HomeWizard P1 CSV column names + cumulative-vs-15-min-delta column choice** — needs a real export sample before Phase 2's concrete adapter is written. Framework can be built without it; adapter cannot.
- **Exact NL provider CSV formats** (Vandebron, Eneco, Tibber, Frank, ANWB Energie, Enexis MijnAansluiting) — PROJECT.md acknowledges this is a "collect samples over time" loop. v1 ships HomeWizard only; don't pre-build adapters from inferred specs.
- **Sample-week selection heuristic** — median-export vs sunniest vs user-pickable. Resolve in Phase 4 UX design.
- **Saldering scenario UI shape** — two columns per battery vs scenario grouping. Decide in Phase 4 based on table density.
- **When workers tip from premature to necessary** — depends on measured Phase 3 simulator latency.
- **Encoding fallback strategy** — NL files are sometimes Windows-1252. Phase 2 needs ArrayBuffer + TextDecoder fallback path.

## Sources

**Primary (HIGH confidence):** npm registry API (2026-05-26), GitHub Releases API for `actions/*-pages`, `vitejs/vite` canonical Pages workflow, bundlephobia, PapaParse docs, uPlot README, date-fns v4 release blog, Preact signals guide, Vitest 4.1 announcement, caniuse Temporal, HomeWizard CSV export docs, DSMR/P1 references (Domoticz Wiki, lvzon/dsmr-p1-parser, jeroen.nl), NL saldering official sources (Rijksoverheid, Milieu Centraal, Vandebron, Pure Energie), Sessy public specs.

**Secondary (MEDIUM):** Competitor analysis (mark-vis, jeroen.nl, bereken-thuisbatterij, thuisbatterijgids, vendor calculators, ESB Networks), UX pattern sources (NN/G, Smashing Magazine, LogRocket), ts-reactive-comparison, web.dev long-task threshold, Comlink+TS wiring guides.

**Tertiary (LOW, flagged but non-blocking):** Exact FilePond/Uppy gzip sizes; anti-feature framing synthesized from patterns rather than user research.
