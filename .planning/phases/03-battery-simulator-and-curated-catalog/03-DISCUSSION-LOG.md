# Phase 3: Battery Simulator and Curated Catalog - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 3-Battery Simulator and Curated Catalog
**Areas discussed:** SimResult shape, Daily-data fidelity, Intra-interval rules, Catalog composition

---

## SimResult shape

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregates + trace | Energy aggregates AND a per-interval trace (SoC/charge/discharge) for Phase 5 charts; derived ratios deferred to Phase 4 | ✓ |
| Aggregates only | Scalar aggregates only; Phase 5 would need to re-run/extend the sim to draw VIZ-02 | |
| Full metrics + trace | Compute Phase 4 comparison metrics now too; couples pure sim to presentation | |

**User's choice:** Aggregates + trace
**Notes:** Trace shape `{ t, socKwh, chargedKwh, dischargedKwh, residualImportKwh, residualExportKwh }`. Self-consumption % / marginal capture computed in Phase 4; monthly bars (VIZ-01) derived by bucketing the trace in Phase 5.

---

## Daily-data fidelity (coarse cadence)

| Option | Description | Selected |
|--------|-------------|----------|
| Run as-is + honesty flag | Simulate at native cadence; set a coarseCadenceWarning flag when cadence > ~60 min; never fabricate intra-day shape | ✓ |
| Require/recommend sub-daily | Mark daily results low-confidence and steer users to sub-daily exports | |
| Model intra-day shape | Synthesize a plausible intra-day curve so clamping bites; fabricates unmeasured data | |

**User's choice:** Run as-is + honesty flag
**Notes:** Owner's real HomeWizard P1 export is daily (one row/day), where `maxChargeKw × 24h ≈ 52 kWh` neutralizes power clamping. Flag keeps the run honest. Interval duration derived from timestamp deltas (IntervalSample has no duration field).

---

## Intra-interval rules — Initial state of charge

| Option | Description | Selected |
|--------|-------------|----------|
| Empty | Start at 0 usable kWh; no phantom kWh on day one; most conservative | ✓ |
| Full | Start at usable capacity; inflates shiftedKwh on short datasets | |
| Half (50%) | Arbitrary middle-ground; still grants phantom energy | |

**User's choice:** Empty (0 usable kWh)

---

## Intra-interval rules — Both import & export nonzero

| Option | Description | Selected |
|--------|-------------|----------|
| Net within interval | `net = export − import`; charge if positive, discharge if negative; clamp + sqrt(rte) apply to net | ✓ |
| Charge then discharge in sequence | Round-trip within one interval; more generous, implies sub-interval timing we didn't measure | |
| Assume mutually exclusive | Pick the larger, zero the other; discards real energy on daily rows | |

**User's choice:** Net within interval
**Notes:** Honest given only P1 net flows are measured; common at daily granularity where a day has both morning import and midday export.

---

## Catalog composition — Capacity representation

| Option | Description | Selected |
|--------|-------------|----------|
| Nominal + dodFraction | Store nominalCapacityKwh + dodFraction; sim derives usable = nominal × dod | ✓ |
| Usable kWh directly | Single usableCapacityKwh field; loses nominal-vs-usable datasheet distinction | |
| Both, usable optional | Nominal + dod plus optional usable override; risk of drift | |

**User's choice:** Nominal + dodFraction
**Notes:** Matches datasheet conventions and the BATT-04 custom five-field input; makes criterion 3 (5 kWh @ 90% → 4.5 kWh) a direct assertion.

---

## Catalog composition — Model lineup

| Option | Description | Selected |
|--------|-------------|----------|
| ROADMAP starter set | Sessy 5 (default), Sessy 10, Zonneplan, Tesla Powerwall 3, Huawei LUNA2000, Victron, +1–2 NL-popular | ✓ |
| Research picks top NL models | Let research determine the ~6–10 most popular in 2026 | |
| I'll specify the models | User provides an explicit lineup | |

**User's choice:** ROADMAP starter set
**Notes:** Research/planning sources exact datasheet specs + URLs and picks the +1–2 (e.g. Marstek / Growatt); Sessy 5 kWh must be first/default.

---

## Claude's Discretion

- Exact `SimResult` field names and internal trace struct layout.
- Coarse-cadence threshold value and the exact warning flag/field shape.
- Interval-duration detection algorithm and first-sample fallback.
- Efficiency-loss attribution in the trace's charged/discharged bookkeeping (physics fixed by SIM-03 `sqrt(rte)`).
- Catalog source file format/location (`.json` vs typed `.ts` export) and the +1–2 model picks.
- Internal `src/domain/` module layout for the new simulator/catalog files.

## Deferred Ideas

- Saldering ON/OFF framing → Phase 4 (sim stays saldering-agnostic).
- Self-consumption %, marginal capture rate, per-row leader highlighting → Phase 4.
- Simulator Web Worker (Comlink) → Phase 4 (SIM-07/08).
- Charts (monthly bars, sample-week step lines) → Phase 5 (consume the trace).
- Battery arbitrage / dynamic-price dispatch → v2 (DYN).
- Battery degradation / temperature / inverter losses → out of scope.
- 5-battery UI cap (BATT-05) enforced in Phase 4 UI; `runComparison` imposes no limit.
