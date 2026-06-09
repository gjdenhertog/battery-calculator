# Phase 3: Battery Simulator and Curated Catalog - Research

**Researched:** 2026-06-09
**Domain:** Pure TypeScript domain layer — battery dispatch simulation + curated NL battery catalog (datasheet specs)
**Confidence:** HIGH (sim math, module layout, test patterns); MEDIUM-HIGH (catalog specs — real datasheet values sourced, a few vendor figures are ranges/inferred and flagged)

## Summary

This phase is a **pure-arithmetic domain layer** with no new dependencies and no UI. Almost all design is already locked in `03-CONTEXT.md` (D-01..D-10); the genuine research value is in exactly two places, both confirmed below:

1. **The simulation math is internally consistent with the ROADMAP success criteria — but criterion 3 only works under one specific interpretation of where the `sqrt(rte)` loss and the capacity clamp interact.** A naive "round-trip 6 kWh in / 6 kWh out" reading yields **5.4 kWh, not the ~4.25 kWh** the criterion asserts. The 4.25 number is **capacity-clamped**: a 5 kWh-nominal @ 90%-DoD battery caps at **4.5 kWh usable**, and discharging that stored 4.5 kWh through one `sqrt(0.9)` leg gives `4.5 × 0.94868 ≈ 4.269 ≈ 4.25`. The planner MUST write the fixture against this clamped interpretation (SoC stores post-charge-loss energy; discharge applies the second sqrt). This is the single most important finding in this document.

2. **The curated catalog needs real datasheet numbers.** Sourced below: Sessy 5 kWh & 10 kWh, Zonneplan, Tesla Powerwall 3, Huawei LUNA2000-5-S0, Victron ESS (representative config), and Marstek Venus E (the recommended +1 NL pick). Each row carries a datasheet/spec URL and a confidence flag. Note one important reality-check: **real RTE figures are mostly 82–92%, not the 90% used in the synthetic criterion-3 fixture** — the criterion fixtures are hypothetical test vectors, not catalog rows, and must not be conflated.

The module layout drops cleanly into `src/domain/` beside `parse.ts`/`merge.ts`/`gaps.ts`/`period-filter.ts`, and the interval-duration-from-timestamp-deltas logic (D-05) is a near-twin of the existing `inferDominantCadence()` in `merge.ts` — reuse that pattern. All tests run in the existing **node-env Vitest** (`vitest.config.ts` already defaults `environment: 'node'`), proving SIM-01 / criterion 4 for free.

**Primary recommendation:** Implement `simulate()` with an explicit per-interval state machine where `socKwh` always holds *energy currently in the cell* (post-charge-loss, pre-discharge-loss), clamp charge to `min(net, maxChargeKw × intervalHours, usableKwh − socKwh)` on the **grid-side flow**, apply `sqrt(rte)` once entering and once leaving the cell, and cap `socKwh ≤ nominalCapacityKwh × dodFraction`. Derive `intervalHours` from timestamp deltas exactly as `merge.ts` does.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**SimResult shape (Phase 4/5 contract):**
- **D-01:** `SimResult` carries energy aggregates AND a per-interval trace. Aggregates: `shiftedKwh`, `residualImportKwh`, `residualExportKwh`, `totalImportKwh`, `totalExportKwh`, `periodDays` (exact field names = Claude's discretion). Trace: per-interval array of `{ timestamp, socKwh, chargedKwh, dischargedKwh, residualImportKwh, residualExportKwh }`.
- **D-02:** Derived ratios (self-consumption %, marginal capture rate, per-row leaders) are NOT computed in Phase 3 — Phase 4's job.
- **D-03:** Monthly breakdown is derived from the trace (Phase 5 buckets by timestamp); `simulate` does not pre-aggregate by month.

**Coarse-cadence fidelity:**
- **D-04:** Run as-is + honesty flag — never fabricate intra-day shape. When cadence is coarser than a threshold (~>60 min), set a flag/field on `SimResult` (e.g. `coarseCadenceWarning`). Owner's real HomeWizard P1 export is daily granularity.
- **D-05:** Interval duration is derived from timestamp deltas (`IntervalSample` carries no duration). Each sample's `intervalHours` = delta to previous sample's timestamp; first sample uses next delta (or dominant cadence) as fallback. Detection algorithm + first-sample fallback = Claude's discretion. `cadenceMinutes` exists on `ParseFileResult`/`FileStat` but NOT on `IntervalSample` — the sim must not depend on those upstream types.

**Intra-interval modeling rules:**
- **D-06:** Initial state of charge = empty (0 usable kWh). No phantom kWh on day one.
- **D-07:** Net-within-interval energy balance. `net = gridExportKwh − gridImportKwh`. If `net > 0` charge `min(net, powerClamp, usableHeadroom)`; if `net < 0` discharge `min(−net, powerClamp, soc)`. Power clamp and `sqrt(rte)` loss apply to the **net flow**, not gross. Criterion 2's 1.5 kWh-export interval is a pure net-export interval, so it exercises charge clamping directly.

**Catalog composition:**
- **D-08:** Capacity stored as `nominalCapacityKwh` + `dodFraction`; sim derives `usable = nominal × dod`. Entry shape: `{ id, name, nominalCapacityKwh, dodFraction, roundTripEfficiency, maxChargeKw, maxDischargeKw, datasheetUrl }` (exact field names = discretion).
- **D-09:** Catalog lineup = ROADMAP starter set. Sessy 5 kWh (default/first), Sessy 10 kWh, Zonneplan, Tesla Powerwall 3, Huawei LUNA2000, Victron (ESS), plus 1–2 more NL-popular (e.g. Marstek / Growatt) to reach ~6–8. Research sources exact specs + URLs and picks the +1–2; Sessy 5 kWh must be first/default.
- **D-10:** Custom battery shares the catalog entry shape (same five physics fields + dodFraction) so it runs through `simulate` identically and mixes freely in `runComparison`.

### Claude's Discretion
- Exact `SimResult` field names and internal trace struct layout (D-01/D-02).
- Coarse-cadence threshold value and exact shape of the warning flag/field (D-04).
- Interval-duration detection algorithm and first-sample fallback (D-05).
- Whether efficiency loss is attributed to charge leg, discharge leg, or split in the trace's `chargedKwh`/`dischargedKwh` reporting (physics fixed by SIM-03 `sqrt(rte)` each way; only trace bookkeeping is open).
- Catalog source file format/location (`.json` vs `.ts` typed export) and the +1–2 model picks (D-09).
- Internal module layout within `src/domain/` (e.g. `simulate.ts`, `catalog.ts`, `battery-types.ts`).

### Deferred Ideas (OUT OF SCOPE)
- Saldering ON/OFF framing — `simulate` stays saldering-agnostic (Phase 4 layers columns on aggregates).
- Self-consumption %, marginal capture rate, per-row leader highlighting — Phase 4 derived metrics.
- Simulator Web Worker (Comlink) — SIM-07/SIM-08, Phase 4.
- Charts (monthly bars, sample-week step lines) — VIZ-01/VIZ-02, Phase 5; consume the D-01 trace.
- Battery arbitrage / dynamic-price dispatch — v2 (DYN); v1 is pure solar self-consumption only.
- Battery degradation, temperature, inverter losses — out of scope (PROJECT.md); model is capacity + power + RTE + DoD only.
- 5-battery UI cap (BATT-05) — enforced in Phase 4 UI; `runComparison` itself imposes no limit.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BATT-01 | Curated catalog ~6–10 NL batteries as bundled JSON, each cites datasheet URL | Catalog section below: 7 sourced entries with URLs. Bundle as `.ts` typed export or `.json` (discretion) — both tree-shake into the Vite build, no fetch (CSP `connect-src 'none'`). |
| BATT-02 | Each entry: nominal capacity, usable/DoD, RTE, max charge kW, max discharge kW | D-08 entry shape confirmed; all 5 physics fields sourced per model below. |
| BATT-03 | Default selection = Sessy 5 kWh | Sessy 5 kWh is first array entry; specs sourced (5 kWh usable, 2.2 kW charge, 1.7 kW discharge, 85% RTE). |
| BATT-04 | Custom battery from same five fields | D-10: custom config = same `BatteryConfig` shape; no separate code path. |
| BATT-05 | Multi-battery compare; UI caps at 5 | Phase 4 concern. `runComparison` imposes no limit (D, deferred). |
| SIM-01 | Pure `simulate(samples, batteryConfig, options) → SimResult`, zero browser deps, Node Vitest | Module layout + node-env Vitest confirmed; mirrors existing pure domain files. |
| SIM-02 | Clamp charge `min(surplusKwh, maxChargeKw × intervalHours, capacityRemainingKwh)`, discharge symmetric | Criterion 2 math verified (0.55 kWh); clamp formula below. |
| SIM-03 | RTE symmetric `sqrt(rte)` each way | Verified; criterion 3 caveat documented (capacity-clamped, not pure round-trip). |
| SIM-04 | Usable capacity (DoD) honored — 5 kWh @ 90% never > 4.5 kWh | `socKwh ≤ nominal × dod` invariant; assertable across all fixtures. |
| SIM-05 | Hand-computed fixture tests incl. small-battery-can't-catch-peak + multi-day no-export | Fixture catalogue in Validation Architecture below. |
| SIM-06 | `runComparison(samples, batteries, options)` → one SimResult per battery in input order | `batteries.map(b => simulate(samples, b, options))` — order-preserving by construction. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-interval battery dispatch (`simulate`) | Domain / pure compute | — | Zero browser deps (SIM-01); runs in Node Vitest. Phase 4 will wrap in a worker, but the function itself is tier-agnostic. |
| Interval-duration derivation (D-05) | Domain / pure compute | — | Pure function of the `IntervalSample[]` timestamps; mirrors `merge.ts inferDominantCadence`. |
| Multi-battery aggregation (`runComparison`) | Domain / pure compute | — | Pure `.map` over `simulate`; SIM-06 order guarantee. |
| Battery catalog data | Build-time static asset | Domain (typed shape) | Bundled JSON/TS — no fetch (CSP `connect-src 'none'`). Ships in the Vite bundle. |
| SimResult trace emission (D-01) | Domain / pure compute | Presentation (Phase 4/5 consume) | Trace is data; charts/table are downstream tiers. |
| Coarse-cadence honesty flag (D-04) | Domain (sets flag) | Presentation (Phase 4/5 surface copy) | Domain detects + flags; UI renders the Dutch warning. |

## Standard Stack

**No new runtime dependencies.** This is pure arithmetic over `IntervalSample[]`. The CONTEXT lock (D, "no new runtime dependency") and CLAUDE.md ("simulator must add no new runtime dependency — pure arithmetic") are explicit.

### Core (already installed — do not re-add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest` | `^4.1.7` | Unit/fixture tests | Already configured node-env (`vitest.config.ts`). Hand-computed fixtures use `toBeCloseTo(value, 3)` per criterion 1. [CITED: CLAUDE.md stack lock] |
| `typescript` | `~5.6` | Type system | Already pinned (5.6.3 installed). [CITED: STATE.md] |

### Supporting (optional, for date bucketing IF needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@date-fns/tz` (`TZDate`) | `^1.5.0` | Local-time math | Already a dependency (used in `gaps.ts`). **Phase 3 likely does NOT need it** — D-03 defers monthly bucketing to Phase 5. `simulate` walks samples in array order; no timezone math required for dispatch. Mention only so the planner doesn't reach for it unnecessarily. |

### Alternatives Considered
None — the stack is locked and this phase adds nothing. The only "alternative" is the catalog file format (`.ts` typed export vs `.json` + import), addressed under Code Examples.

**Installation:** None required.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages. All required libraries (`vitest`, `typescript`, `@date-fns/tz`, `date-fns`) are already present and were vetted in Phases 1–2. No slopcheck run needed; no new registry surface introduced.

## Simulation Math — Verified Against ROADMAP Criteria

### Criterion 2 (power clamp) — VERIFIED [VERIFIED: hand-computed]

1.5 kWh export in a single interval, Sessy 5 kWh (2.2 kW max charge), 15-min interval (0.25 h):

```
powerClamp = maxChargeKw × intervalHours = 2.2 × 0.25 = 0.55 kWh
net        = gridExportKwh − gridImportKwh = 1.5 − 0 = +1.5 kWh
chargeAttempt (grid-side) = min(net, powerClamp, usableHeadroom)
           = min(1.5, 0.55, 4.5) = 0.55 kWh   ← matches criterion
```

So **0.55 kWh is the grid-side flow drawn from surplus**. The criterion phrases it as "charges ~0.55 kWh", confirming the clamp is on the **grid-side flow** (what's pulled off the export), and the `sqrt(rte)` loss then reduces what actually lands in the cell. The remaining `1.5 − 0.55 = 0.95 kWh` becomes residual export.

**`intervalHours = 0.25` derivation (D-05):** for the second-and-later samples, `intervalHours = (thisTimestamp − prevTimestamp) / 3_600_000`. For a 15-min cadence that is exactly `900_000 / 3_600_000 = 0.25`. ✓ The first sample has no predecessor → use the **next** delta as fallback (`samples[1].timestamp − samples[0].timestamp`), or the median delta if only one sample exists. This is the same fallback shape `merge.ts inferDominantCadence` already uses (median of inter-sample deltas, default 15 min for `<2` samples).

### Criterion 3 (RTE + DoD) — VERIFIED, with a critical interpretation note [VERIFIED: hand-computed]

The criterion says: "a 6 kWh charge / 6 kWh discharge round-trip returns ~4.25 kWh, not 5 kWh" AND "5 kWh nominal @ 90% DoD never stores more than 4.5 kWh."

A **naive pure round-trip** of 6 kWh yields the WRONG answer:
```
sqrt(0.9) = 0.94868
6 × 0.94868 = 5.692 into cell → × 0.94868 = 5.40 out    ✗ (criterion wants 4.25)
```

The ~4.25 number is **capacity-clamped**, not pure round-trip:
```
Battery: 5 kWh nominal × 0.90 DoD = 4.5 kWh usable cap.
A 6 kWh charge attempt fills the cell to the 4.5 kWh CAP (surplus beyond cap → residual export).
Discharge the stored 4.5 kWh through ONE sqrt(0.9) leg:
  4.5 × 0.94868 = 4.269 ≈ 4.25 kWh delivered   ✓ matches criterion
```

**Therefore the locked physics is:** `socKwh` holds **energy in the cell** (already past the charge-leg sqrt loss), capped at `nominal × dod`. Discharge applies the **second** sqrt on the way out. The 4.25 number only falls out if the charge that hit the cap is treated as *already inside the cell* (i.e. the cap is on stored energy, and the discharge sqrt is the only loss remaining on that stored 4.5 kWh).

**Two internally-consistent bookkeeping conventions exist** (discretion per CONTEXT — "whether efficiency loss is attributed to charge leg, discharge leg, or split"). Both must reproduce 4.25; the planner must pick one and write the fixture to it:

- **Convention A (recommended — matches the 4.25 arithmetic cleanly):** `socKwh` = energy physically in the cell. Charge: `intoCell = gridSideCharge × sqrt(rte)`, then `socKwh = min(socKwh + intoCell, usable)`. The cap clamps *cell* energy at 4.5. Discharge: `delivered = min(demand, socKwh × sqrt(rte), maxDischargeKw × h)`; `socKwh −= delivered / sqrt(rte)`. For the criterion-3 vector (cell already at 4.5 via a large charge), `delivered = 4.5 × sqrt(0.9) = 4.269`. ✓
- **Convention B:** split loss differently but still `sqrt` each way and cap usable at 4.5 — arithmetically equivalent for the criterion because the cap dominates. Riskier to get the trace bookkeeping consistent; prefer A.

> **Planner action:** Write criterion-3 fixture as a 5 kWh-nominal / 0.90-DoD battery, charge enough surplus to exceed 4.5 kWh usable (so the cap engages), then discharge with enough demand to drain it, and assert delivered `≈ 4.269` (`toBeCloseTo(4.269, 2)` or `4.25` at 1 dp). Do NOT write it as a literal "6 in / 6 out" with no cap — that yields 5.4 and fails the criterion.

### Criterion 1 (one-week aggregate) — structure confirmed
A hand-built one-week `IntervalSample[]` (e.g. 7 days × a handful of intervals with known import/export) walked through `simulate` must produce `shiftedKwh`, `residualImportKwh`, `residualExportKwh` matching pre-computed values within `toBeCloseTo(x, 3)`. `shiftedKwh` = total energy discharged from the battery to serve import demand (the self-consumption shift). Keep the fixture small enough to hand-compute (the planner should tabulate each interval's net → charge/discharge → soc → residuals in a comment block).

### Edge cases the planner MUST write fixtures for
| Edge case | What it proves | Expected behavior |
|-----------|----------------|-------------------|
| Small battery can't catch the peak (criterion 2) | Power clamp on charge | 0.55 kWh charged, 0.95 residual export |
| Capacity-clamped round-trip (criterion 3) | DoD cap + sqrt each way | ~4.269 kWh delivered, soc never > 4.5 |
| Multi-day, **no export at all** | Empty-SoC conservatism (D-06) | `shiftedKwh = 0`; battery never discharges phantom energy; all import is residual |
| **Daily-cadence** data (intervalHours ≈ 24) | Coarse-cadence flag (D-04) | `coarseCadenceWarning` set true; `powerClamp = maxChargeKw × 24` is so large it never binds — flag is what keeps the run honest |
| First-sample fallback | D-05 fallback | First interval's duration = next delta (or median); no NaN / divide-by-zero |
| Single-sample input | Degenerate D-05 | intervalHours falls back to a sane default (e.g. median/15 min); no crash |
| Discharge clamped by `maxDischargeKw` | Symmetric clamp (SIM-02) | Sessy's 1.7 kW discharge < 2.2 kW charge — a fixture with a large import interval proves discharge clamp is independent of charge clamp |
| `dischargedKwh ≤ soc` and `socKwh ≥ 0` | No negative SoC | Never discharge more than stored |

**Note on the asymmetric Sessy clamp:** Sessy charges at 2.2 kW but discharges at only **1.7 kW**. The `BatteryConfig` MUST carry `maxChargeKw` and `maxDischargeKw` as separate fields (already in D-08 shape) — do not collapse to one "power" field. At least one fixture should exercise the discharge clamp distinctly from the charge clamp.

## Curated NL Battery Catalog (datasheet-sourced specs)

> **Provenance note:** All package/spec values below were discovered via WebSearch and vendor pages, then cross-checked against official datasheet/spec pages where reachable. Per the role's provenance rules, spec figures that could not be pinned to an official datasheet page are tagged `[ASSUMED]` or `[CITED: <url>]` and flagged in the Assumptions Log. The planner should treat `[ASSUMED]` RTE/power values as needing a quick human spot-check before locking the JSON, OR accept them as defensible v1 defaults (this is a consumer gut-check tool, not a billing engine).

> **CRITICAL reality-check for the planner:** the synthetic criterion-3 fixture uses **90% RTE**. Real catalog RTEs are **82–92%**. Do NOT back-fill the criterion fixture from a catalog row, and do NOT "fix" a catalog RTE to make a criterion pass. They are independent. The criterion fixtures are hypothetical test vectors using round numbers.

### Recommended lineup (7 entries; Sessy 5 kWh first/default)

| # | id | name | nominalCapacityKwh | dodFraction | roundTripEfficiency | maxChargeKw | maxDischargeKw | Confidence |
|---|----|------|--------------------|-------------|---------------------|-------------|----------------|-----------|
| 1 | `sessy-5` | Sessy 5 kWh | 5.0 | 1.0 (capacity quoted as usable) | 0.85 | 2.2 | 1.7 | HIGH |
| 2 | `sessy-10` | Sessy 10 kWh | 10.0 | 1.0 (usable) | 0.85 | 2.2 | 1.7 | HIGH (RTE/power assumed same inverter as 5 kWh) |
| 3 | `zonneplan-10` | Zonneplan Thuisbatterij 10 kWh | 10.0 | ~0.95 | 0.90 [ASSUMED] | 4.4 | 4.4 | MEDIUM |
| 4 | `powerwall-3` | Tesla Powerwall 3 | 13.5 | 1.0 (usable; Tesla manages window internally) | 0.975 | 5.0 | 11.5 | HIGH |
| 5 | `huawei-luna-5` | Huawei LUNA2000-5-S0 | 5.0 | 1.0 (100% DoD, usable) | 0.95 [ASSUMED] | 2.5 | 2.5 | HIGH (capacity/power), MEDIUM (RTE) |
| 6 | `victron-ess-10` | Victron ESS (MultiPlus-II + 10 kWh LFP) | 10.0 | ~0.90 | 0.85 [ASSUMED] | 3.0 | 3.0 | MEDIUM (representative config, not a single product) |
| 7 | `marstek-venus-e` | Marstek Venus E (5.12 kWh) | 5.12 | ~0.95 | 0.825 | 2.5 | 2.5 | MEDIUM-HIGH |

### Per-model sourcing detail

**1. Sessy 5 kWh** `[CITED: sessy.nl/specificaties]`
- 5 kWh **bruikbare** (usable) capacity → model as `nominalCapacityKwh: 5.0, dodFraction: 1.0` (the quoted number is already usable; don't double-discount).
- Charge (laden) **2.2 kW**, discharge (ontladen) **1.7 kW** — asymmetric, confirmed twice (spec page + retailer).
- Round-trip efficiency **85%** (explicitly listed as "Round-trip efficiency (RTE) 85%" on the spec page). LFP, 6000+ cycles.
- `datasheetUrl`: `https://www.sessy.nl/specificaties/`

**2. Sessy 10 kWh** `[CITED: sessy.nl/sessy-10-kwh]`
- 10 kWh usable. Same 2.2 kW / 1.7 kW inverter and 85% RTE assumed (same Sessy hardware, two modules) — `[ASSUMED]` that power/RTE match the 5 kWh; flag A-2.
- `datasheetUrl`: `https://www.sessy.nl/sessy-10-kwh/`

**3. Zonneplan Thuisbatterij 10 kWh** `[CITED: zonneplan.nl/thuisbatterij/10-kwh-thuisbatterij]`
- 10 kWh entry uses a **4.4 kW** inverter (charge = discharge symmetric). Larger 15/20/30 kWh variants use 10 kW.
- RTE not published by Zonneplan → `0.90` is a defensible LFP default `[ASSUMED]`, flag A-3.
- DoD ~0.95 typical for LFP `[ASSUMED]`.
- `datasheetUrl`: `https://www.zonneplan.nl/thuisbatterij/10-kwh-thuisbatterij`

**4. Tesla Powerwall 3** `[CITED: energylibrary.tesla.com Powerwall-3-Datasheet]`
- **13.5 kWh usable** (Tesla manages the SoC window internally → model `dodFraction: 1.0`).
- **RTE 97.5%** (datasheet/EnergySage).
- Discharge **11.5 kW** continuous (off-grid) / 10 kW (on-grid) — use 11.5 or 10; recommend **10 kW** for the on-grid NL use case, or 11.5 to match the datasheet headline. Flag A-4 (pick one).
- Charge **5 kW** continuous (single unit, configurable up to 5 kW AC/DC; 8 kW with expansion).
- `datasheetUrl`: `https://energylibrary.tesla.com/docs/Public/EnergyStorage/Powerwall/3/Datasheet/en-uk/Powerwall-3-Datasheet-EN.pdf`

**5. Huawei LUNA2000-5-S0** `[CITED: solar.huawei.com LUNA2000-5-10-15-S0 specs]`
- 5 kWh module, **100% DoD** (Huawei markets "100% Depth of Discharge") → `nominalCapacityKwh: 5.0, dodFraction: 1.0`.
- Rated charge/discharge **2.5 kW**, max **3.74 kW** — use **2.5 kW** (rated continuous) for both. >5000 cycles.
- RTE not on the datasheet headline; LFP string systems typically ~95% → `0.95` `[ASSUMED]`, flag A-5.
- `datasheetUrl`: `https://solar.huawei.com/en/products/luna2000-5-10-15-s0/specs/`

**6. Victron ESS (representative)** `[CITED: victronenergy.com / community RTE threads]`
- Victron ESS is **not a single product** — it's a MultiPlus-II inverter + a battery bank (Pylontech/BYD/etc.). Model a **representative** config: MultiPlus-II 48/5000 + ~10 kWh LFP.
- RTE: Victron quotes ~92% for the battery alone; real **system** AC→AC round-trip is **~80–85%** per Victron community/docs. Use **0.85** as an honest system figure `[ASSUMED]`, flag A-6.
- Charge/discharge ~3 kW continuous for a 48/5000 class unit `[ASSUMED]`; DoD ~0.90 (Pylontech LFP).
- **Label this entry clearly** in `name` (e.g. "Victron ESS (MultiPlus-II + 10 kWh)") so users understand it's a representative DIY config, not a packaged product.
- `datasheetUrl`: `https://www.victronenergy.com/live/ess:start`

**7. Marstek Venus E 5.12 kWh** (RECOMMENDED +1 NL pick) `[CITED: marstek.nl product page]`
- **5.12 kWh** capacity, LiFePO4. Max charge/discharge **2.5 kW** per unit (note: only 800 W via a standard wall socket, 2.5 kW on a dedicated circuit — model the **2.5 kW** dedicated-circuit figure).
- **RTE 82.5%** (explicitly stated). DoD ~0.95 typical.
- Very popular plug-in NL battery; good "cheap/small" anchor at the opposite end from Powerwall.
- `datasheetUrl`: `https://www.marstek.nl/product/marstek-venus-e-3-0-plug-charge-thuisbatterij-5-12-kwh-incl-p1-meter/`

### Why Marstek over Growatt as the +1
Growatt's home storage (ARK XH / LV) is a **modular stack** (2.5 kWh modules, system charge/discharge expressed as a current per added module) — awkward to express as a single fixed catalog row without inventing a configuration. Marstek Venus E is a **single packaged plug-in unit** with clean published charge/discharge/RTE numbers and is widely sold in NL. If the planner wants 8 entries instead of 7, Growatt ARK 2.5H (2.56 kWh nominal, 90% DoD → 2.3 kWh usable, >95% efficiency `[ASSUMED]`, `datasheetUrl: https://www.pvo-int.com/wp-content/uploads/2022/03/Datasheet-Growatt-ARK-HV-5.1H-25.6H-Battery-System-EU.pdf`) is the cleanest single-module pick.

### Modeling guidance for `dodFraction` vs quoted "usable"
Most NL vendors quote **usable** kWh directly (Sessy "5 kWh bruikbare capaciteit", Powerwall "13.5 kWh usable", Huawei "100% DoD"). For those, set `nominalCapacityKwh` = the quoted usable number and `dodFraction = 1.0` — do NOT additionally discount, or you'll double-count the DoD haircut. Only apply `dodFraction < 1.0` when a vendor publishes a **gross** capacity separate from a usable figure (rare in this lineup). Document this convention in the catalog file header so future entries stay consistent. The criterion-4 assertion (`5 kWh nominal @ 90% DoD never > 4.5 kWh`) is a **synthetic test battery**, independent of these catalog rows.

## Architecture Patterns

### System Architecture Diagram

```
                         Phase 2 output
                   ┌──────────────────────┐
                   │  IntervalSample[]     │  (UTC timestamps @ interval END,
                   │  (merged, sorted)     │   non-negative import/export kWh)
                   └──────────┬───────────┘
                              │
                  ┌───────────▼────────────┐      ┌─────────────────────┐
                  │  BatteryConfig          │◄─────│  catalog (bundled)  │
                  │  {nominalCapacityKwh,   │      │  Sessy/Tesla/...    │
                  │   dodFraction, rte,     │      │  + custom (BATT-04) │
                  │   maxChargeKw,          │      └─────────────────────┘
                  │   maxDischargeKw}       │
                  └───────────┬────────────┘
                              │
        ┌─────────────────────▼──────────────────────┐
        │  simulate(samples, config, options)         │
        │                                             │
        │  for each sample (in array order):          │
        │    h    = intervalHours(deltas, D-05)       │
        │    net  = export − import                   │
        │    if net>0: charge clamp → soc += in·√rte  │
        │    if net<0: discharge clamp → out = soc·√rte│
        │    cap soc ≤ nominal·dod (SIM-04)            │
        │    record trace row + accumulate aggregates │
        │  detect coarse cadence → warning flag (D-04)│
        └─────────────────────┬──────────────────────┘
                              │
                  ┌───────────▼────────────┐
                  │  SimResult              │
                  │  {aggregates + trace +  │
                  │   coarseCadenceWarning} │  ──► Phase 4 (table) / Phase 5 (charts)
                  └─────────────────────────┘

   runComparison(samples, batteries[], options)
        = batteries.map(b => simulate(samples, b, options))   // input order preserved (SIM-06)
```

### Recommended Project Structure
```
src/domain/
├── types.ts            # EXTEND: add BatteryConfig, SimResult, TraceRow, SimOptions
├── battery-catalog.ts  # NEW: typed catalog array (or catalog.json + a typed loader)
├── simulate.ts         # NEW: simulate() + interval-duration helper (D-05)
├── compare.ts          # NEW: runComparison() — thin .map wrapper (SIM-06)
├── parse.ts            # (existing)
├── merge.ts            # (existing — reuse inferDominantCadence pattern for D-05)
├── gaps.ts             # (existing)
└── period-filter.ts    # (existing)
```
Discretion note: catalog as `.ts` typed export is recommended over `.json` — you get compile-time validation of the entry shape (BATT-02) and tree-shaking, and the datasheet URLs live as code comments + a `datasheetUrl` field. A `.json` + `import catalog from './catalog.json'` also works (Vite supports JSON imports) but loses inline type-checking unless you add a runtime validator.

### Pattern 1: Interval-duration from timestamp deltas (D-05)
**What:** Derive `intervalHours[i]` so the per-interval power clamp uses real durations.
**When to use:** Every interval, before the charge/discharge clamp.
**Example:**
```typescript
// Mirrors src/domain/merge.ts inferDominantCadence (median-delta + small-input fallback).
function intervalHoursFor(samples: IntervalSample[]): number[] {
  const n = samples.length
  if (n === 0) return []
  // Fallback duration for the FIRST sample (no predecessor): use the next delta,
  // or the median delta, or a sane default if only one sample exists.
  const deltasMs: number[] = []
  for (let i = 1; i < n; i++) {
    deltasMs.push(samples[i].timestamp.getTime() - samples[i - 1].timestamp.getTime())
  }
  const medianMs =
    deltasMs.length === 0
      ? 15 * 60_000 // single-sample default: 15 min
      : [...deltasMs].sort((a, b) => a - b)[Math.floor(deltasMs.length / 2)]

  const hours: number[] = new Array(n)
  hours[0] = (deltasMs[0] ?? medianMs) / 3_600_000 // first sample = next delta (D-05)
  for (let i = 1; i < n; i++) hours[i] = deltasMs[i - 1] / 3_600_000
  return hours
}
```

### Pattern 2: Per-interval dispatch state machine (D-06/D-07, SIM-02/03/04)
**What:** The core loop. `socKwh` = energy in the cell (post-charge-loss).
**Example (Convention A — recommended):**
```typescript
const usable = config.nominalCapacityKwh * config.dodFraction // SIM-04 cap
const eff = Math.sqrt(config.roundTripEfficiency)             // sqrt(rte) each way (SIM-03)
let soc = 0                                                   // empty start (D-06)

for (let i = 0; i < samples.length; i++) {
  const h = hours[i]
  const s = samples[i]
  const net = s.gridExportKwh - s.gridImportKwh                // D-07
  let charged = 0, discharged = 0
  let residualImport = s.gridImportKwh, residualExport = s.gridExportKwh

  if (net > 0) {
    // grid-side flow clamped by power + remaining headroom (headroom measured in cell terms)
    const headroomGridSide = (usable - soc) / eff
    const gridSideCharge = Math.min(net, config.maxChargeKw * h, headroomGridSide)
    const intoCell = gridSideCharge * eff
    soc = Math.min(soc + intoCell, usable)                    // hard cap (SIM-04)
    charged = gridSideCharge
    residualExport = s.gridExportKwh - gridSideCharge
    residualImport = 0
  } else if (net < 0) {
    const demand = -net
    const delivered = Math.min(demand, soc * eff, config.maxDischargeKw * h)
    soc -= delivered / eff                                    // remove pre-loss energy from cell
    if (soc < 0) soc = 0
    discharged = delivered
    residualImport = demand - delivered
    residualExport = 0
  }
  // accumulate aggregates; push { timestamp: s.timestamp, socKwh: soc, chargedKwh: charged,
  //   dischargedKwh: discharged, residualImportKwh: residualImport, residualExportKwh: residualExport }
}
```
> The criterion-2 fixture (`charged = 0.55`) reports the **grid-side** charge in `chargedKwh`. Decide and document whether `chargedKwh` in the trace is grid-side (0.55) or into-cell (`0.55·√0.85`) — criterion 2 implies **grid-side**. Keep it consistent for criterion-1's one-week aggregate.

### Pattern 3: `runComparison` (SIM-06)
```typescript
export function runComparison(
  samples: IntervalSample[],
  batteries: BatteryConfig[],
  options?: SimOptions,
): SimResult[] {
  return batteries.map((b) => simulate(samples, b, options)) // order preserved by Array.map
}
```

### Anti-Patterns to Avoid
- **Storing a signed `net` on `IntervalSample`:** forbidden by DATA-06. `net` is an in-`simulate` local only (D-07).
- **Depending on `cadenceMinutes`/`ParseFileResult` inside `simulate`:** D-05 — those types are upstream; derive duration from `IntervalSample.timestamp` deltas only.
- **Reading the criterion-3 fixture as a pure 6-in/6-out round-trip:** yields 5.4, fails the criterion. Must be capacity-clamped (see Simulation Math).
- **Double-discounting DoD on catalog rows quoted as "usable":** set `dodFraction: 1.0` for usable-quoted vendors (Sessy/Tesla/Huawei).
- **Fabricating intra-day shape for daily data:** D-04 — run as-is, set the coarse-cadence flag, never synthesize sub-day intervals.
- **Phantom day-one discharge:** D-06 — start SoC at 0; the battery only discharges energy it captured during the measured period.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interval-duration / cadence detection | A fresh delta-scanner | The `inferDominantCadence` median-delta pattern already in `merge.ts` | Already DST-tested in Phase 2; copy the median-delta + small-input fallback shape. |
| Timezone bucketing (if ever needed) | Manual UTC offset math | `@date-fns/tz TZDate` (already a dep, used in `gaps.ts`) | Phase 3 likely needs none (D-03 defers monthly bucketing to Phase 5) — but if you do, reuse the existing dep. |
| Float comparison in tests | Exact `===` on kWh | Vitest `toBeCloseTo(value, 3)` | Criterion 1 mandates 3-dp tolerance; `sqrt` introduces irrational values. |

**Key insight:** This phase's "don't hand-roll" is mostly *don't re-derive Phase 2's already-tested primitives*. The simulation arithmetic itself is intentionally hand-written (it's the deliverable) — but the duration-detection scaffolding around it already exists.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this is greenfield domain code (new files, extended `types.ts`). No stored data, live-service config, OS-registered state, secrets, or build artifacts carry phase-relevant state. **None — verified by scope (pure new compute + a static data file).**

## Common Pitfalls

### Pitfall 1: Criterion-3 "round-trip" misread as uncapped
**What goes wrong:** Implementer writes a fixture that charges and discharges 6 kWh with no capacity cap, gets 5.4 kWh, and either the test fails or (worse) they "fix" the RTE/sqrt to force 4.25.
**Why it happens:** The criterion's phrasing ("6 kWh charge / 6 kWh discharge round-trip returns ~4.25") reads like a pure efficiency round-trip; it isn't — the 4.5 kWh usable cap is doing the real work.
**How to avoid:** Write the fixture against a 5 kWh-nominal / 0.90-DoD battery where the charge exceeds 4.5 kWh usable so the cap engages; assert `≈ 4.269`. Keep RTE at 0.90 and `sqrt` each way.
**Warning signs:** A fixture that produces 5.4 instead of 4.25; an RTE value tweaked away from 0.90 to make a test pass.

### Pitfall 2: Double-discounting usable capacity
**What goes wrong:** Sessy quotes "5 kWh **usable**"; implementer sets `nominalCapacityKwh: 5, dodFraction: 0.9`, giving 4.5 usable — understating the battery.
**Why it happens:** Reflexively applying a DoD haircut to every entry.
**How to avoid:** For vendors quoting usable (Sessy, Tesla, Huawei), `dodFraction: 1.0`. Document the convention in the catalog header.
**Warning signs:** Sessy 5 kWh shifting noticeably less than 5 kWh of headroom in a fixture.

### Pitfall 3: First-interval NaN / divide-by-zero (D-05)
**What goes wrong:** First sample has no predecessor → `intervalHours[0]` is undefined → `maxChargeKw × undefined = NaN` poisons all aggregates.
**Why it happens:** Forgetting the first-sample fallback.
**How to avoid:** First sample uses the **next** delta (or median, or 15-min default for a single sample). Add a single-sample fixture.
**Warning signs:** `NaN` in `shiftedKwh`; tests that pass on multi-sample input but crash on 1-sample input.

### Pitfall 4: Asymmetric charge/discharge collapsed to one field
**What goes wrong:** Sessy charges 2.2 kW but discharges 1.7 kW; a single `maxPowerKw` field overstates discharge capability.
**Why it happens:** Many tools model one power number.
**How to avoid:** Keep `maxChargeKw` and `maxDischargeKw` separate (already in D-08). Write a fixture where the discharge clamp binds independently.
**Warning signs:** Discharge in a fixture exceeding 1.7 kW × intervalHours for the Sessy.

### Pitfall 5: Daily data silently looking precise
**What goes wrong:** Owner's real daily-cadence export runs through `simulate`; `maxChargeKw × 24h ≈ 52 kWh` clamp never binds, so a tiny battery appears to capture an entire day's surplus — overstating shift, with no warning.
**Why it happens:** The power clamp is the honesty mechanism, and it vanishes at coarse cadence (D-04).
**How to avoid:** Detect cadence (median interval > ~60 min) and set `coarseCadenceWarning`. Write a daily-cadence fixture asserting the flag is true.
**Warning signs:** A 5 kWh battery shifting > its usable capacity in a single daily interval with no flag set.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single RTE applied once to the round-trip | `sqrt(rte)` applied symmetrically each way | Locked by SIM-03 | Charge and discharge each carry half the loss; trace bookkeeping must reflect it. |
| Capacity-only battery model | capacity + power limits + RTE + DoD | PROJECT.md key decision | Small batteries can't absorb solar peaks — the whole point of the fidelity. |

**Deprecated/outdated:** None relevant — this is greenfield. No library deprecations apply (no libraries added).

## Code Examples

Verified patterns are inline in **Architecture Patterns** (Pattern 1–3) above — they are the load-bearing snippets. The catalog entry shape:

```typescript
// src/domain/types.ts — extend
export interface BatteryConfig {
  id: string
  name: string
  nominalCapacityKwh: number
  dodFraction: number          // 1.0 when vendor quotes "usable" (Sessy/Tesla/Huawei)
  roundTripEfficiency: number  // 0..1; sqrt() applied each way (SIM-03)
  maxChargeKw: number
  maxDischargeKw: number
  datasheetUrl: string         // BATT-01: cited in source
}

export interface TraceRow {
  timestamp: Date
  socKwh: number
  chargedKwh: number           // grid-side (criterion 2 → 0.55); document the choice
  dischargedKwh: number
  residualImportKwh: number
  residualExportKwh: number
}

export interface SimResult {
  shiftedKwh: number
  residualImportKwh: number
  residualExportKwh: number
  totalImportKwh: number
  totalExportKwh: number
  periodDays: number
  coarseCadenceWarning: boolean // D-04
  trace: TraceRow[]
}

export interface SimOptions {
  // reserved — saldering is Phase 4 and does NOT belong here (sim is saldering-agnostic)
  coarseCadenceThresholdMinutes?: number // default ~60 (discretion)
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A-1 | `chargedKwh` in the trace is reported grid-side (0.55), not into-cell | Sim Math / Pattern 2 | Criterion 2 asserts 0.55; reporting into-cell (~0.507) would fail the criterion. Planner must lock this. |
| A-2 | Sessy 10 kWh shares the 5 kWh's 2.2/1.7 kW inverter and 85% RTE | Catalog #2 | Mild — affects only the 10 kWh row's clamp; verify on sessy.nl/sessy-10-kwh before lock. |
| A-3 | Zonneplan 10 kWh RTE = 0.90 (not published) | Catalog #3 | Low — defensible LFP default; users see a gut-check, not billing. |
| A-4 | Powerwall 3 discharge = 11.5 kW (or 10 kW on-grid) — pick one | Catalog #4 | Low — both are datasheet figures; choose 10 kW for NL on-grid realism. |
| A-5 | Huawei LUNA2000-5 RTE = 0.95 (not on datasheet headline) | Catalog #5 | Low — typical LFP string RTE; spot-check the full PDF if desired. |
| A-6 | Victron ESS modeled as representative 10 kWh / 3 kW / 85% RTE config | Catalog #6 | Medium — Victron ESS is configurable, not a product. Label the entry as representative; numbers are honest mid-points. |
| A-7 | Marstek Venus E DoD ~0.95 | Catalog #7 | Low — RTE (82.5%) and power (2.5 kW) are sourced; DoD inferred. |
| A-8 | Catalog ships as `.ts` typed export (vs `.json`) | Structure | None functional — both build into the bundle; `.ts` gives type-checking (discretion). |

**If the planner prefers zero `[ASSUMED]` in the shipped catalog:** add a `checkpoint:human-verify` task to spot-check A-2/A-5/A-6 against the linked datasheets, OR accept them as documented v1 defaults (recommended — this is a consumer sizing gut-check, and every figure here is a real-world-plausible mid-point with a cited source).

## Open Questions (RESOLVED)

1. **Trace `chargedKwh` semantics (grid-side vs into-cell)** — A-1. **RESOLVED: grid-side.**
   - What we know: criterion 2 expects 0.55 (grid-side).
   - What's unclear: whether the one-week criterion-1 fixture's `shiftedKwh` was hand-computed assuming grid-side or into-cell charge accounting.
   - Recommendation: report `chargedKwh` grid-side (matches criterion 2), `dischargedKwh` as delivered energy; `shiftedKwh` = sum of `dischargedKwh`. Document in the module header. The planner hand-computes criterion 1 against this convention.
   - **Resolution:** Locked grid-side in plan 03-02 `<locked_physics>` + acceptance criteria.

2. **Exactly 7 vs 8 catalog entries** — D-09 says ~6–8. **RESOLVED: 7 entries.**
   - Recommendation: ship the 7 above; add Growatt ARK 2.5H as #8 only if the planner wants a second small/modular anchor.
   - **Resolution:** Locked at 7 entries in plan 03-01.

## Environment Availability

> No external runtime dependencies — pure TS + already-installed Vitest. Skipped per the "code-only changes" condition.

**Step 2.6: SKIPPED (no external dependencies identified beyond already-installed Vitest/TypeScript).**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.7` |
| Config file | `vitest.config.ts` (default `environment: 'node'`; include `tests/**/*.test.ts` and `src/**/*.test.ts`) |
| Quick run command | `npx vitest run tests/simulate.test.ts` |
| Full suite command | `npm test` (or `npx vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIM-01 | Pure function, node env, no browser globals | unit | `npx vitest run tests/simulate.test.ts` | ❌ Wave 0 |
| SIM-02 | Charge clamp 0.55 kWh (criterion 2) | unit | `npx vitest run tests/simulate.test.ts -t "power clamp"` | ❌ Wave 0 |
| SIM-03 | sqrt(rte) symmetric, ~4.269 capacity-clamped (criterion 3) | unit | `npx vitest run tests/simulate.test.ts -t "round-trip"` | ❌ Wave 0 |
| SIM-04 | soc never > nominal×dod (criterion 3/4) | unit | `npx vitest run tests/simulate.test.ts -t "DoD cap"` | ❌ Wave 0 |
| SIM-05 | One-week fixture + small-battery + multi-day-no-export | unit | `npx vitest run tests/simulate.test.ts` | ❌ Wave 0 |
| SIM-06 | runComparison preserves input order | unit | `npx vitest run tests/compare.test.ts` | ❌ Wave 0 |
| BATT-01..03 | Catalog loads ~6–8 entries, Sessy 5 first, datasheet URLs present | unit | `npx vitest run tests/catalog.test.ts` | ❌ Wave 0 |
| BATT-04 | Custom config runs identically | unit | `npx vitest run tests/simulate.test.ts -t "custom"` | ❌ Wave 0 |
| D-04 | Daily-cadence run sets coarseCadenceWarning | unit | `npx vitest run tests/simulate.test.ts -t "coarse cadence"` | ❌ Wave 0 |
| D-05 | First-sample / single-sample duration fallback | unit | `npx vitest run tests/simulate.test.ts -t "interval duration"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/simulate.test.ts` (the relevant new file)
- **Per wave merge:** `npm test` (full suite — proves criterion 4: clean node env, all green)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/simulate.test.ts` — covers SIM-01..05, D-04, D-05 (the bulk)
- [ ] `tests/compare.test.ts` — covers SIM-06 (order preservation, mixed catalog+custom)
- [ ] `tests/catalog.test.ts` — covers BATT-01..03 (entry shape, Sessy-first, URL presence; assert each entry has all 5 physics fields + datasheetUrl)
- [ ] No framework install needed — Vitest node-env already configured.
- [ ] Consider a tiny shared fixture builder (`sample(utcMs, importKwh, exportKwh)`) mirroring the helper in `tests/period-filter.test.ts`.

## Security Domain

This phase introduces **no new attack surface**: pure arithmetic over already-validated `IntervalSample[]`, no I/O, no network (CSP `connect-src 'none'` unchanged), no DOM, no user-string interpolation, no new dependencies. The catalog is a static, code-reviewed data file bundled at build time (no fetch, no eval).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts (PROJECT.md non-goal) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-user surface |
| V5 Input Validation | partial | `IntervalSample[]` already validated at Phase 2 adapter boundary; `simulate` should defensively guard against `NaN`/negative config values (e.g. reject `dodFraction > 1` or `roundTripEfficiency ≤ 0`) so a bad **custom** config (BATT-04) fails fast rather than producing `NaN` aggregates |
| V6 Cryptography | no | No crypto |

### Known Threat Patterns for pure-TS-domain / static-data
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed custom BatteryConfig (negative/NaN fields) → NaN-poisoned output | Tampering (input) | Validate custom config fields at the `simulate` entry (range-check capacity > 0, 0 < dod ≤ 1, 0 < rte ≤ 1, powers ≥ 0); throw a clear error, don't propagate NaN |
| Supply-chain (new dependency) | Tampering | N/A — zero new deps this phase |
| Data exfiltration | Information disclosure | N/A — no network; CSP `connect-src 'none'` enforced since Phase 1 |

## Sources

### Primary (HIGH confidence)
- `03-CONTEXT.md` (D-01..D-10) — the authoritative design contract.
- `.planning/ROADMAP.md` Phase 3 — 6 success criteria (criteria 2 & 3 hand-verified above).
- `.planning/REQUIREMENTS.md` — BATT-01..05, SIM-01..06 full text.
- `src/domain/types.ts`, `merge.ts`, `gaps.ts`, `period-filter.ts`, `vitest.config.ts`, `tests/period-filter.test.ts` — existing patterns read directly.
- [Sessy specificaties](https://www.sessy.nl/specificaties/) — 5 kWh usable, 2.2 kW charge, 1.7 kW discharge, **85% RTE**, LFP, 6000+ cycles.
- [Tesla Powerwall 3 datasheet](https://energylibrary.tesla.com/docs/Public/EnergyStorage/Powerwall/3/Datasheet/en-uk/Powerwall-3-Datasheet-EN.pdf) — 13.5 kWh usable, 97.5% RTE, 11.5/10 kW discharge, 5 kW charge.
- [Huawei LUNA2000-5/10/15-S0 specs](https://solar.huawei.com/en/products/luna2000-5-10-15-s0/specs/) — 5 kWh module, 100% DoD, 2.5 kW rated (3.74 kW max), >5000 cycles.
- [Marstek Venus E 5.12 kWh](https://www.marstek.nl/product/marstek-venus-e-3-0-plug-charge-thuisbatterij-5-12-kwh-incl-p1-meter/) — 5.12 kWh, 2.5 kW, **82.5% RTE**, LiFePO4.

### Secondary (MEDIUM confidence)
- [Zonneplan 10 kWh thuisbatterij](https://www.zonneplan.nl/thuisbatterij/10-kwh-thuisbatterij) — 10 kWh / 4.4 kW inverter (RTE not published → assumed 0.90).
- [Victron ESS](https://www.victronenergy.com/live/ess:start) + community RTE threads — system AC→AC RTE ~80–85% (representative config, not a single product).
- [Growatt ARK HV datasheet](https://www.pvo-int.com/wp-content/uploads/2022/03/Datasheet-Growatt-ARK-HV-5.1H-25.6H-Battery-System-EU.pdf) — modular; optional 8th entry.

### Tertiary (LOW confidence)
- Various NL retailer pages (thuisbatterijnederland.nl, solarnrg.shop, dewarmtemeester.nl) — cross-checked the Sessy 2.2/1.7 kW figures; used only as corroboration.

## Metadata

**Confidence breakdown:**
- Simulation math / criteria verification: HIGH — both criteria hand-computed; criterion-3 interpretation pinned.
- Module layout & test patterns: HIGH — read existing files; node-env Vitest already configured.
- Catalog specs (Sessy, Tesla, Huawei, Marstek): HIGH-MEDIUM — sourced from vendor/datasheet pages; a few RTE/DoD figures `[ASSUMED]` and logged.
- Catalog specs (Zonneplan, Victron): MEDIUM — RTE not vendor-published / config-dependent; defensible defaults logged.

**Research date:** 2026-06-09
**Valid until:** ~2026-09-09 (stable — pure-compute design; battery datasheet specs change slowly, but re-verify a vendor figure if a row is ever surfaced as authoritative in the UI).

## RESEARCH COMPLETE

**Phase:** 3 - Battery Simulator and Curated Catalog
**Confidence:** HIGH (sim math, layout, tests); MEDIUM-HIGH (catalog specs)

### Key Findings
- **Criterion 3's ~4.25 kWh is capacity-clamped, NOT a pure round-trip** (pure 6-in/6-out = 5.4). The 5 kWh-nominal @ 90%-DoD cap (4.5 usable) × one `sqrt(0.9)` discharge leg = 4.269 ≈ 4.25. The fixture MUST engage the cap; this is the single most important planning detail.
- **Criterion 2 (0.55 kWh) verified:** `2.2 kW × 0.25 h`, clamp on the grid-side flow; `intervalHours` derivation mirrors `merge.ts inferDominantCadence`.
- **Catalog sourced (7 entries):** Sessy 5/10 (85% RTE, 2.2/1.7 kW), Powerwall 3 (13.5 kWh, 97.5%), Huawei LUNA2000-5 (100% DoD, 2.5 kW), Zonneplan 10 (4.4 kW), Victron ESS (representative), Marstek Venus E (recommended +1, 82.5% RTE). Each with datasheet URL; assumptions logged.
- **Usable-vs-DoD trap:** vendors quoting "usable" (Sessy/Tesla/Huawei) → `dodFraction: 1.0`, no double-discount.
- **No new deps, no new attack surface;** all tests in existing node-env Vitest → SIM-01 / criterion 4 satisfied by construction.

### File Created
`.planning/phases/03-battery-simulator-and-curated-catalog/03-RESEARCH.md`

### Open Questions
- Trace `chargedKwh` grid-side (0.55) vs into-cell — recommend grid-side to match criterion 2 (A-1).
- 7 vs 8 catalog entries — recommend 7, Growatt optional 8th.

### Ready for Planning
Research complete. The planner can write PLAN.md files; the criterion-3 clamp interpretation and the catalog table are the load-bearing inputs.
