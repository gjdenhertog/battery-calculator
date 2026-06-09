# Phase 3: Battery Simulator and Curated Catalog - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A pure, browser-free domain layer in `src/domain/` that delivers:

1. **`simulate(samples, batteryConfig, options) → SimResult`** — a pure function
   (zero DOM/browser deps, runnable under plain Node Vitest, SIM-01) that walks a
   canonical `IntervalSample[]` and computes how much energy a given battery would
   have shifted from grid-export to later self-consumption. Honors per-interval
   power clamping (SIM-02), symmetric `sqrt(rte)` round-trip efficiency (SIM-03),
   and depth-of-discharge usable-capacity limits (SIM-04).
2. **`runComparison(samples, batteries, options)`** — maps `simulate` over an
   array of `[catalog | catalog | custom]` batteries, returning one `SimResult`
   per battery **in input order** (SIM-06).
3. **A curated NL battery catalog** as bundled JSON (~6–10 entries, each with a
   datasheet URL cited in the source), Sessy 5 kWh as the first/default entry
   (BATT-01..03), and a **custom battery** path using the same five fields
   (BATT-04). The UI cap of 5 compared batteries (BATT-05) is a Phase 4 concern.

**No UI this phase.** Correctness is proven entirely via hand-computed Vitest
fixtures (SIM-05), including the small-battery-can't-catch-the-peak case and a
multi-day no-export case. `npm test` runs green from a clean Node environment
(criterion 4).

Requirements covered: BATT-01..05, SIM-01..06 (11 total).

**Out of phase (deferred to later phases):** saldering on/off framing, the
comparison table, reactive signals state, the simulator Web Worker (Comlink),
and all charts. `simulate()` stays **saldering-agnostic** — saldering changes the
*value* framing of residual feed-in, not the physical kWh shifted, so Phase 4
layers the saldering ON/OFF columns on top of these aggregates.

</domain>

<decisions>
## Implementation Decisions

### SimResult shape (the Phase 4/5 contract)
- **D-01:** `SimResult` carries **energy aggregates AND a per-interval trace.**
  Aggregates: `shiftedKwh`, `residualImportKwh`, `residualExportKwh`,
  `totalImportKwh`, `totalExportKwh`, `periodDays` (exact field names are
  Claude's discretion, but raw energy totals + shifted is the contract). The
  **trace** is a per-interval array of `{ timestamp, socKwh, chargedKwh,
  dischargedKwh, residualImportKwh, residualExportKwh }`. Rationale: Phase 5's
  sample-week step-line chart (VIZ-02, which draws battery charge/discharge) and
  monthly self-consumption bars (VIZ-01) need per-interval data — if `simulate`
  doesn't emit it, Phase 4/5 would have to re-run the engine to recover it.
- **D-02:** **Derived ratios are NOT computed in Phase 3.** Self-consumption %,
  marginal capture rate (`shiftedKwh / capacityKwh`), and per-row leaders are
  Phase 4's job, computed from these aggregates. Keeps the pure sim decoupled
  from presentation metrics that may still shift in Phase 4.
- **D-03:** **Monthly breakdown is derived from the trace**, not emitted as a
  separate structure. Phase 5 buckets the trace by `timestamp` (Europe/Amsterdam)
  for VIZ-01; `simulate` does not pre-aggregate by month.

### Coarse-cadence (daily-data) fidelity
- **D-04:** **Run as-is + honesty flag — never fabricate intra-day shape.**
  `simulate` runs at whatever cadence the data has, using the real per-interval
  duration for the power clamp. When the cadence is coarser than a threshold
  (~> 60 min), set a flag/field on `SimResult` (e.g. `coarseCadenceWarning`)
  so Phase 4/5 can surface honestly: *"daily data overstates what a battery
  captures — upload 15-min data for an accurate sizing."* Consistent with
  Phase 2's flag-and-count / never-fabricate stance (02 D-05) and UX-05 honesty.
  **Context:** the project owner's real HomeWizard P1 export is daily granularity
  (one row/day), where `maxChargeKw × 24h ≈ 52 kWh` makes power clamping vanish —
  this flag is what keeps such a run from silently looking precise.
- **D-05:** **Interval duration is derived from timestamp deltas**, since
  `IntervalSample` carries only an end-`timestamp` and no explicit duration. Each
  sample's `intervalHours` = delta to the previous sample's timestamp; the first
  sample uses the next delta (or the dominant cadence) as fallback. The detection
  algorithm and first-sample fallback are Claude's discretion. (Note: `cadenceMinutes`
  exists on `ParseFileResult`/`FileStat` but is not on `IntervalSample`; the sim
  must not depend on those upstream types.)

### Intra-interval modeling rules
- **D-06:** **Initial state of charge = empty (0 usable kWh).** The battery only
  ever discharges energy it actually captured from measured surplus during the
  period — no phantom kWh on day one, no inflated `shiftedKwh` on short datasets.
  Most conservative and easiest to justify to a non-engineer.
- **D-07:** **Net-within-interval energy balance.** For each interval compute
  `net = gridExportKwh − gridImportKwh`. If `net > 0`, attempt to charge
  `min(net, powerClamp, usableHeadroom)`; if `net < 0`, attempt to discharge
  `min(−net, powerClamp, soc)`. Leftover after the battery acts becomes residual
  import/export. The **power clamp and `sqrt(rte)` loss apply to the net flow**,
  not gross — honest given we cannot see sub-interval timing, and matches that all
  we measure are P1 net flows (UX-05). Note: criterion 2's 1.5 kWh-export interval
  is a pure net-export interval, so it exercises charge clamping directly.

### Catalog composition
- **D-08:** **Capacity stored as `nominalCapacityKwh` + `dodFraction`**; the sim
  derives `usable = nominal × dod`. Matches how datasheets quote specs, makes
  criterion 3 ("5 kWh nominal @ 90% DoD never exceeds 4.5 kWh") a direct
  assertion, and mirrors the custom-config five-field input (BATT-04). Each entry:
  `{ id, name, nominalCapacityKwh, dodFraction, roundTripEfficiency, maxChargeKw,
  maxDischargeKw, datasheetUrl }` (exact field names Claude's discretion).
- **D-09:** **Catalog lineup = ROADMAP starter set.** Sessy 5 kWh (default),
  Sessy 10 kWh, Zonneplan Thuisbatterij, Tesla Powerwall 3, Huawei LUNA2000,
  Victron (ESS), plus 1–2 more NL-popular models (e.g. Marstek / Growatt) to
  reach ~6–8. **Research/planning sources the exact datasheet specs + URLs** and
  picks the +1–2; Sessy 5 kWh must be first/default.
- **D-10:** **Custom battery shares the catalog entry shape** (same five physics
  fields + dodFraction), so a custom config runs through `simulate` identically
  to a catalog entry and mixes freely in `runComparison` (criterion 6).

### Claude's Discretion
- Exact `SimResult` field names and the internal trace struct layout (D-01/D-02).
- The coarse-cadence threshold value and the exact shape of the warning
  flag/field (D-04).
- The interval-duration detection algorithm and first-sample fallback (D-05).
- Whether efficiency loss is attributed to the charge leg, discharge leg, or
  split in the trace's `chargedKwh`/`dischargedKwh` reporting (physics is fixed by
  SIM-03 `sqrt(rte)` each way; only the trace bookkeeping is open).
- Catalog source file format/location (`.json` vs `.ts` with typed export) and
  the +1–2 model picks (D-09).
- Internal module layout within `src/domain/` (e.g. `simulate.ts`, `catalog.ts`,
  `battery-types.ts`) beside the existing parser/merge files.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (read first)
- `.planning/REQUIREMENTS.md` — BATT-01..05 and SIM-01..06 full text + the v2
  deferrals (FIN/DYN arbitrage) that explain why `simulate` is solar-self-
  consumption only and kWh-only this phase.
- `.planning/ROADMAP.md` §"Phase 3: Battery Simulator and Curated Catalog" —
  goal + 6 success criteria (the acceptance contract; criteria 2 & 3 give the
  exact hand-computed expectations for power clamping and DoD/RTE).
- `.planning/PROJECT.md` — Key Decisions table (battery model = capacity + power
  limits + RTE + DoD; curated ~6–10 catalog + custom; Sessy 5 kWh default;
  P1-derived solar, no separate solar CSV; kWh-only v1) and Constraints
  (calculation fidelity: "small battery can't absorb a midday solar peak, simple
  enough to explain to a non-engineer").

### Locked input contract (from Phase 2)
- `src/domain/types.ts` — the canonical `IntervalSample` (`timestamp: UTC Date`
  at interval END, non-negative `gridImportKwh` / `gridExportKwh`), plus
  `MergeResult` / `ParseFileResult` (note `cadenceMinutes` lives here, NOT on
  `IntervalSample` — see D-05). This is `simulate`'s input shape; it must stay
  stable.
- `.planning/phases/02-csv-parsing-format-detection-multi-file-merge-dst-safe-time-/02-CONTEXT.md`
  — D-04/D-05 (gaps are flagged-and-counted, never zero-filled → the sim sees
  only real samples; gaps simply mean less coverage), D-09 (never-fabricate
  stance that D-04 above inherits). STATE.md note: real HomeWizard P1 sample is
  daily granularity (drives D-04).

### Stack lock (do not re-research / re-version)
- `CLAUDE.md` — LOCKED stack: Vitest `^4.1.7` (node env for domain tests),
  Vite `^8`, TS `~5.6`. Catalog ships as bundled JSON (no fetch — CSP
  `connect-src 'none'`). The simulator must add **no new runtime dependency**
  (pure arithmetic).

No external ADRs or third-party specs — requirements are fully captured in
REQUIREMENTS.md, ROADMAP.md success criteria, and the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/types.ts` — extend (or sit beside) with battery + SimResult types.
  Reuse the existing UTC-`Date` / non-negative-kWh conventions. Do NOT reintroduce
  a signed `net` field on stored data (DATA-06); netting is an in-`simulate`
  computation only (D-07).
- `src/domain/` already houses `parse.ts`, `merge.ts`, `gaps.ts`,
  `period-filter.ts`, `encoding.ts`, and `parsers/` — the simulator and catalog
  are new files in the same directory, no new top-level structure needed.

### Established Patterns
- **Test env split (Phase 1 D-09):** all simulator/catalog logic is pure domain →
  **node** env Vitest, no jsdom, no browser globals (matches SIM-01 + criterion 4).
  Hand-computed fixtures are the proof mechanism (SIM-05), mirroring how Phase 2's
  parser/merge/DST logic was fixture-locked.
- **Never-fabricate data:** inherited from Phase 2 D-05 — the sim consumes only
  real samples (gaps already excluded upstream) and never synthesizes intra-day
  shape (D-04).
- **No new runtime deps / CSP-safe:** catalog is bundled at build time, not
  fetched; `connect-src 'none'` (Phase 1) forbids any network access.

### Integration Points
- **Input:** the canonical `IntervalSample[]` from Phase 2's merge output is
  `simulate`'s sole data input. Interval duration is derived from timestamps
  (D-05) — there is no duration field to consume.
- **Output (forward):** `SimResult` (D-01) is the contract Phase 4 reads to build
  the comparison table (deriving self-consumption %, marginal capture, saldering
  framing) and Phase 5 reads (its `trace`) to draw VIZ-01 monthly bars and VIZ-02
  sample-week step lines. Get the aggregate + trace field shapes right here.
- **Worker (forward):** Phase 4 wraps these same pure functions in a Comlink
  worker (SIM-07); keeping them browser-free now is what makes that wrap trivial.

</code_context>

<specifics>
## Specific Ideas

- The honesty surface for this phase is the **coarse-cadence warning** (D-04):
  the owner's own real data is daily, and an un-flagged daily run would look
  deceptively precise while overstating battery capture. This flag is the
  Phase-3 equivalent of Phase 2's sanity-readout honesty (02 D-08).
- Conservatism is the through-line: empty initial SoC (D-06) + net-within-interval
  (D-07) + flag-don't-fabricate (D-04) all bias toward *not* overstating what a
  battery does — matching the project's "clear, honest comparison" core value.
- Criterion 2's expected number (~0.55 kWh = 2.2 kW × 0.25 h) is the canonical
  power-clamp fixture; criterion 3's ~4.25 kWh round-trip (6 kWh in/out at
  `sqrt(0.9)` each way) is the canonical efficiency fixture. Both should appear
  verbatim as hand-computed Vitest cases.

</specifics>

<deferred>
## Deferred Ideas

- **Saldering ON/OFF framing** — `simulate` stays saldering-agnostic; the
  side-by-side saldering columns (COMP-05) layer on aggregates in Phase 4.
- **Self-consumption %, marginal capture rate, per-row leader highlighting** —
  derived presentation metrics, computed in Phase 4 from the D-01 aggregates.
- **Simulator Web Worker (Comlink)** — SIM-07/SIM-08, Phase 4.
- **Charts (monthly bars, sample-week step lines)** — VIZ-01/VIZ-02, Phase 5;
  they consume the D-01 trace.
- **Battery arbitrage / dynamic-price dispatch** — v2 (DYN); v1 dispatch is
  pure solar self-consumption only.
- **Battery degradation, temperature, inverter losses** — explicitly out of
  scope (PROJECT.md); model is capacity + power + RTE + DoD only.
- **5-battery UI cap (BATT-05)** — the cap is enforced in the Phase 4 UI;
  `runComparison` itself imposes no limit.

None of the above are scope creep into Phase 3 — they are deliberately later.

</deferred>

---

*Phase: 3-Battery Simulator and Curated Catalog*
*Context gathered: 2026-06-09*
