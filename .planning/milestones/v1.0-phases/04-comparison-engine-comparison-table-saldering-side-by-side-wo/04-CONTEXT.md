# Phase 4: Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The differentiator — the first **real interactive UI**, layered on the already-proven
pure `simulate()` / `runComparison()` from Phase 3. This phase delivers:

1. **Reactive signals state** (`@preact/signals-core`) wrapping selected batteries,
   the parsed/merged `IntervalSample[]`, the chosen period, and derived results —
   replacing the throwaway Phase 2 drop-zone wiring in place.
2. **Battery selection UI** — spec cards for the 7-entry catalog (BATT-05 cap of 5),
   Sessy 5 pre-selected (BATT-03), plus one inline custom battery (BATT-04).
3. **Workers** — the simulator + comparison aggregator run in a dedicated Comlink
   Web Worker (SIM-07); the main thread only sends inputs and receives `SimResult`s.
   The same pure functions still pass Vitest without a worker (criterion 4 of Phase 3
   carries forward). The UI stays interactive during compute (SIM-08).
4. **Comparison table** — batteries as rows, metrics as columns, headline metric
   "kWh netto-import vermeden" first (COMP-01/02), saldering OFF/ON as the doubled
   headline pair (COMP-05), marginal capture rate (COMP-01), per-column leader
   highlight without a "best battery" verdict (COMP-03), consistent per-battery color
   (COMP-04), period-coverage indicator (COMP-08), no auto-extrapolation (COMP-07).
5. **Interactive period-narrowing control (DATA-12)** — added to this phase (see D-19);
   re-filters → live recompute through the same pipeline.

Requirements covered: SIM-07, SIM-08, COMP-01..08 (10 from the phase list) **plus
DATA-12** folded in from Phase 2's deferral (D-19) — 11 total.

**Out of phase (deferred to Phase 5):** charts (VIZ-01 monthly bars, VIZ-02 sample-week
step lines), the broad "Hoe is dit berekend?" assumptions panel (UX-01), the "Waarom
geen euro's?" explainer (UX-02), full Dutch copy/tone/tooltip pass (UX-03), final
mobile polish (UX-04 — Phase 4 only ships responsive-ready *structure*, see D-14),
terminology audit (UX-05), and the no-CTA audit (UX-06).

**Locked from Phase 3 — do NOT touch the physics:** `simulate()` / `runComparison()`
are pure, **saldering-agnostic**, and emit aggregates + a per-interval trace (Phase 3
D-01). Saldering ON/OFF is a **value-framing layer computed in Phase 4 from the
aggregates** (D-01..D-04 below) — it never changes the physical kWh the engine reports.

</domain>

<decisions>
## Implementation Decisions

### Saldering framing (the conceptual core)
- **D-01: "Net grid position" is what differs between the two saldering columns.**
  Since the physical metrics are identical with saldering on or off, the meaningful
  difference is the **net billed import** after meter netting:
  - **Saldering ON** = simple 1:1 annual netting: `netImport = max(0, residualImportKwh − residualExportKwh)`.
  - **Saldering OFF** = export worth ~nothing: `netImport = residualImportKwh`.
  The headline **"kWh netto-import vermeden"** for each scenario is computed against
  that scenario's **no-battery baseline**:
  - ON baseline: `max(0, totalImportKwh − totalExportKwh)`; avoided = baseline − battery `netImport`.
  - OFF baseline: `totalImportKwh`; avoided = `totalImportKwh − residualImportKwh` (≈ `shiftedKwh`).
  Consequence (by design): the *same* battery shows a large benefit without saldering
  and ~zero (or slightly negative) benefit with it. **This contrast IS the message of
  the tool** — a battery only pays off once saldering ends.
- **D-02: Show the honest near-zero / negative ON result — do NOT floor at 0.**
  Under 1:1 netting the battery often nets slightly negative (round-trip loss outweighs
  the gain, because export already offset import at full value). When net avoided ≤ 0,
  display it as-is with a plain-Dutch note, e.g. *"met saldering levert een batterij nu
  nog niets op — het verlies bij op- en ontladen is groter dan de winst."* (UX-05 honesty,
  core value). Numbers still at ≤ 1 decimal (VIZ-04 is Phase 5, but apply the spirit now).
- **D-03: Lead with saldering-OFF as the primary framing.** OFF is the future the user
  is sizing a battery for; it reads first / emphasized. Saldering-ON is shown secondary /
  muted ("nu nog, met saldering"). Both ALWAYS visible side-by-side, no re-run, no
  synthesized "best battery" verdict (COMP-03/COMP-05).
- **D-04: Net-position calc behind a pluggable feed-in valuation.** Put the netting in a
  small pure helper with the feed-in value as a parameter (v1: export = 0 when saldering
  off, 1:1 when on). This makes the v2 **terugleverkosten €/kWh** input (SALD-02) a clean
  slot-in, not a rewrite. Build only the v1 valuation now. (See Deferred.)

### Battery picker UX
- **D-05: Spec cards with checkboxes.** Each catalog battery is a selectable card/row
  showing its key specs (nominalCapacityKwh, dodFraction, roundTripEfficiency,
  maxChargeKw, maxDischargeKw) + its assigned color swatch. Specs visible at choice time
  (it's a comparison tool). Sessy 5 (catalog index 0) pre-checked (BATT-03). At 5
  selected, remaining cards disable with a "max 5" note (BATT-05).
- **D-06: Custom battery = inline expandable card.** An "+ eigen batterij" card at the end
  of the catalog grid matching the spec-card pattern; expanding reveals the 5 fields
  (BATT-04) with placeholder defaults + inline validation; it counts as one of the 5 and
  gets its own color. Shares the `BatteryConfig` shape (Phase 3 D-10) so it flows through
  `runComparison` identically.
- **D-07: Live auto-recompute (debounced).** Any change to selected batteries or custom
  fields auto-reruns the simulator worker — debounced while typing custom values. No
  "Vergelijk" button. Matches the reactive signals architecture and feels instant given
  the worker (SIM-08).

### Comparison table layout
- **D-08: Batteries as rows, metrics as columns** (locked by COMP-03 "each metric column
  highlights the per-row leader"). Per-column the leading battery's cell is highlighted;
  never aggregated into an overall winner (COMP-03 — no "best battery" verdict).
- **D-09: Only the headline metric doubles by saldering.** "kWh netto-import vermeden"
  becomes two adjacent columns — **"zonder saldering" (first/primary) | "met saldering"
  (muted)** (per D-03). All other metrics (self-consumptie %, verschoven kWh, rest-import,
  rest-teruglevering, marginale benutting = `shiftedKwh / usableCapacityKwh`) are
  physical/saldering-independent and shown **once**. Narrowest honest table; no repeated
  identical numbers.
- **D-10: Column set** (left→right, names Claude's discretion): battery name + color
  swatch · **kWh netto-import vermeden — zonder saldering** · **kWh netto-import vermeden —
  met saldering** · self-consumptie % (secondary, COMP-02) · kWh verschoven (export→zelf) ·
  rest-import kWh · rest-teruglevering kWh · marginale benutting.
- **D-11: Per-battery color vs leader highlight are SEPARATE treatments.** Battery identity
  color = swatch/accent on the battery's row name, exposed via a tested
  `colorFor(batteryId)` helper reused verbatim in Phase 5 charts (COMP-04). Leader
  highlight = a distinct **neutral** emphasis (bold + subtle tint / small marker) on the
  single best cell per metric column. Keeping them separate avoids clashes and prevents a
  "winning battery" read (COMP-03).
- **D-12: Responsive-ready structure now; full mobile polish is Phase 5.** Build the table
  with a semantic structure that can reflow to per-battery stacked cards on narrow screens
  (headline avoided pair prominent, secondary metrics below), so Phase 5's UX-04 pass is a
  CSS-only reflow — not a table rebuild. Phase 4 ships a working desktop table + the
  structural hooks; it does not own final mobile styling.

### Honesty surfacing
- **D-13: Prominent coarse-cadence banner.** When `SimResult.coarseCadenceWarning` is true
  (hourly/daily data — and the owner's own real HomeWizard export is daily), show a clear
  caveat banner ABOVE the results: *"Dagdata overschat sterk wat een batterij opvangt —
  upload 15-minuten P1-data voor een betrouwbare schatting."* Results still shown but
  visibly caveated — not a footnote (this is the common case for the owner's data).
- **D-14: Saldering disclaimer co-located + expandable.** Ship the COMP-06 disclaimer in
  THIS phase right next to the saldering column headers: a short inline caveat with an
  "i"/expandable for the full text — **2026 saldering capped at 64%, terugleverkosten apply
  regardless, and a 50%-of-bare-supply-tariff floor runs through 2030** — framing the
  on/off toggle as a deliberate simplification. Phase 5's UX-01 assumptions panel later
  absorbs/expands it; Phase 4 is the source of truth for now.
- **D-15: Period framing (COMP-07/08, locked).** Every reported number is framed "over de
  periode die je hebt geüpload"; a coverage indicator ("43 dagen aan data") sits with the
  results; **no auto-extrapolation** to `/year` or `/month` anywhere.

### State, workers & wiring
- **D-16: Replace the Phase 2 drop-zone wiring in place.** The Phase 2 drop-zone + readout
  was explicitly throwaway-grade (02 D-01). Phase 4 re-wires `#drop-zone-region` and fills
  the bare `#results-region` (01 D-02) with the signals-driven selection + comparison UI.
  Keep the verbatim `p.privacy-promise` (PRIV-02) intact.
- **D-17: Simulator + comparison run in a Comlink worker (SIM-07).** Main thread sends
  `(samples, batteries[], options)` → worker runs `runComparison` → returns `SimResult[]`.
  The pure functions remain independently Vitest-tested without a worker.
- **D-18: Parser worker boundary is Claude's/research discretion.** `parseFile()` already
  uses PapaParse `worker: true` (its own blob worker). Whether the parse path is ALSO
  wrapped in Comlink, or left on PapaParse's worker while only the simulator gets a Comlink
  worker, is a research/planning call — avoid double-workering the parse without reason.
  CSP currently allows `worker-src blob:`; a Vite `?worker` module worker may need a CSP
  check (research).
- **D-19: DATA-12 interactive period control is IN Phase 4.** Honors Phase 2's explicit
  promise (02 D-02: "the UI control lands in Phase 4 with reactive state"). The pure
  `filterByPeriod()` already exists; with signals now present, add a date-range control
  defaulting to the full merged range, updating the COMP-08 coverage indicator live, and
  re-filtering → live recompute (D-07). **Roadmap/REQUIREMENTS traceability should move
  DATA-12 to Phase 4.**

### Claude's Discretion
- The exact color **palette** and the `colorFor(batteryId)` mapping (D-11) — only the
  separate-treatment rule and chart-reuse + unit test are fixed.
- Exact **column header wording** and ordering details within D-10's set.
- The **"Rekenen…" indicator** placement/styling and the recompute **debounce interval**
  (D-07).
- The **parser worker boundary** (D-18) and whether period filtering runs in the worker
  or on the main thread (it's cheap).
- **Empty/loading states** (no file yet, no battery selected, parse error) copy and
  styling — functional Dutch, polish deferred to Phase 5 (02 D-03 pattern).
- Internal module layout for the new UI/state/worker files under `src/ui/`, `src/state/`
  (or similar), and the Comlink worker entry.
- Signals granularity (one store vs several signals) and how derived results memoize.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (read first)
- `.planning/REQUIREMENTS.md` — SIM-07, SIM-08, COMP-01..08 full text **plus DATA-12**
  (now folded into Phase 4 per D-19) and the v2 deferrals (FIN/DYN, **SALD-02
  terugleverkosten** which D-04's pluggable valuation anticipates).
- `.planning/ROADMAP.md` §"Phase 4: Comparison Engine, Comparison Table, Saldering
  Side-by-Side, Worker Wiring, State" — goal + 6 success criteria (the acceptance
  contract). Criterion 2 (saldering side-by-side + disclaimer), criterion 4 (Comlink
  worker + interactivity), criterion 6 (`colorFor(batteryId)` reused in Phase 5) are the
  sharp ones.
- `.planning/PROJECT.md` — Key Decisions table (saldering = on/off toggle v1; headline =
  "kWh grid import avoided" not self-consumption %; kWh-only, defer €; output = table +
  charts) and Constraints (client-side only, CSP `connect-src 'none'`, modest bundle).

### Locked domain contract (from Phase 3 — the engine Phase 4 sits on)
- `src/domain/types.ts` — `BatteryConfig`, `SimResult` (aggregates + `coarseCadenceWarning`
  + `trace`), `TraceRow`, `SimOptions`, and the input `IntervalSample`. These shapes are
  STABLE; Phase 4 consumes them, does not change them.
- `src/domain/simulate.ts` (`simulate`) and `src/domain/compare.ts` (`runComparison`) —
  the pure, saldering-agnostic engine wrapped by the Comlink worker (D-17). Do NOT add
  saldering logic here; saldering framing is a Phase-4 presentation layer (D-01..D-04).
- `src/domain/battery-catalog.ts` — `BATTERY_CATALOG` (7 entries, Sessy 5 at index 0,
  each with `datasheetUrl`). The picker (D-05) renders from this; the `dodFraction = 1.0`
  "vendor quotes usable capacity" convention matters for the marginal-benutting denominator.
- `src/domain/period-filter.ts` (`filterByPeriod`) — the pure function the DATA-12 control
  drives (D-19).
- `.planning/phases/03-battery-simulator-and-curated-catalog/03-CONTEXT.md` — D-01 (the
  SimResult contract Phase 4/5 reads), D-02 (derived ratios = Phase 4's job: self-
  consumption %, marginal capture, leaders), D-04 (coarse-cadence warning → D-13), D-08/D-10
  (catalog shape + custom mixes freely).
- `.planning/phases/02-csv-parsing-format-detection-multi-file-merge-dst-safe-time-/02-CONTEXT.md`
  — D-01 (Phase 2 drop-zone is throwaway, re-wired here → D-16), **D-02 (period-filter UI
  lands in Phase 4 → D-19)**, D-03 (functional-Dutch-now, polish in Phase 5).

### UI/shell contract (from Phase 1)
- `src/shell.ts` / `01-UI-SPEC.md` §"Shell Structure Contract" — `#drop-zone-region`
  (D-16 re-wires) and the bare `#results-region` (Phase 4 fills). Keep `p.privacy-promise`
  (PRIV-02) verbatim.
- `src/styles/tokens.css` / `src/styles/global.css` — design tokens to reuse; NO inline
  `style=` (style-src 'self' CSP D-03 from Phase 1).
- `src/constants/csp.ts` — current CSP (`worker-src blob:`, `connect-src 'none'`). The
  Comlink/Vite `?worker` boundary (D-18) must stay within or minimally extend this.

### Stack lock (do not re-research / re-version)
- `CLAUDE.md` — LOCKED stack. **`@preact/signals-core@^1.14.2`** (state, ~1.5 KB) and
  **Comlink** for the worker (SIM-07) are the two new runtime deps this phase adds; both
  are CLAUDE.md-endorsed. Vite `?worker` import suffix for the custom worker. Vite `^8`,
  TS `~5.6`, Vitest `^4.1.7` (node env for pure logic, jsdom only for DOM/UI tests). uPlot
  is Phase 5, NOT this phase.

No external ADRs or third-party specs beyond the above — requirements are fully captured
in REQUIREMENTS.md, ROADMAP.md success criteria, and the decisions here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`runComparison()` / `simulate()`** (`src/domain/compare.ts`, `simulate.ts`) — already
  exist, pure, order-preserving, saldering-agnostic. Phase 4 wraps these in the Comlink
  worker (D-17) and derives all presentation metrics + saldering framing from their output.
- **`BATTERY_CATALOG`** (`src/domain/battery-catalog.ts`) — 7 entries, Sessy 5 at index 0;
  drives the spec-card picker (D-05) directly.
- **`filterByPeriod()`** (`src/domain/period-filter.ts`) — drives the DATA-12 control (D-19).
- **`SimResult.coarseCadenceWarning`** + `trace` (`src/domain/types.ts`) — D-13 reads the
  flag; Phase 5 charts read `trace`.
- **Phase 2 parse/merge pipeline** (`parseFile`, `mergeFiles`) — feeds the signals store;
  the existing drop-zone controller (`src/ui/drop-zone.ts`) and `readout.ts` are the
  re-wire targets (D-16), not greenfield.
- **Shell regions** (`src/shell.ts`): `#drop-zone-region` (re-wire) + bare `#results-region`
  (fill). Design tokens in `src/styles/`.

### Established Patterns
- **Test env split (Phase 1 D-09):** pure logic (saldering netting helper, metric
  derivations, `colorFor`, period filtering) → **node** env Vitest; DOM/UI (picker, table,
  banner) → **jsdom**. Keep the new saldering/metric math in pure helpers so it's
  node-testable (mirrors how the engine was fixture-locked).
- **Pure-core / browser-shell split:** the engine stays browser-free; only the worker
  adapter + UI touch browser globals. This is exactly what makes the Comlink wrap trivial
  (Phase 3 anticipated it).
- **Never-fabricate / honesty-first:** D-13 (coarse-cadence) and D-02 (show negative)
  continue the Phase 2/3 stance — surface limitations, don't paper over them.
- **CSP strictness:** no inline scripts/styles, `connect-src 'none'`; new worker must use
  blob/module workers within `worker-src` (D-18). Catalog is bundled, never fetched.
- **XSS-safe DOM:** all user-derived strings via `.textContent` (existing `drop-zone.ts`
  convention) — relevant for custom-battery field echoes and file names in the table.

### Integration Points
- **Input:** the merged `IntervalSample[]` from Phase 2 → signals store → (optional period
  filter, D-19) → Comlink worker.
- **Compute:** worker runs `runComparison(samples, selectedBatteries, options)` →
  `SimResult[]` back to the main thread (D-17).
- **Derive (Phase 4-owned):** self-consumption %, marginal benutting, per-column leaders,
  and the saldering net-position framing (D-01..D-04, D-09..D-11) computed from
  `SimResult[]` aggregates — NOT in the engine.
- **Output forward (Phase 5):** `colorFor(batteryId)` (D-11) and the per-interval `trace`
  feed VIZ-01/VIZ-02; the responsive table structure (D-12) feeds UX-04; the saldering
  disclaimer (D-14) feeds UX-01.

</code_context>

<specifics>
## Specific Ideas

- The **saldering contrast is the product**: a battery looking ~worthless under saldering
  and clearly worth it without it (D-01/D-02/D-03) is not a bug to soften — it's the exact
  gut-check the tool exists to deliver. Build the table so that contrast is the first thing
  the eye lands on (OFF-led headline pair).
- The **coarse-cadence banner (D-13) is this phase's honesty surface**, the way the sanity
  readout was Phase 2's (02 D-08) and the warning flag was Phase 3's (03 D-04). The owner's
  own data is daily, so an un-banner'd optimistic table would be self-undermining.
- **Pluggable feed-in valuation (D-04)** is the one deliberate seam for v2: design the
  netting helper so a future `terugleverkosten` (€/kWh) is a parameter swap, even though
  v1 only ever passes "0" or "1:1".
- Keep **"leader" ≠ "winner"** (D-11/COMP-03): per-column highlights, never a synthesized
  best battery — the user decides across a multi-axis tradeoff.

</specifics>

<deferred>
## Deferred Ideas

- **Terugleverkosten €/kWh input** (user raised it during saldering discussion) — it's a
  euro-denominated input that collides with the v1 kWh-only boundary (COMP-07). Already
  tracked as **SALD-02 in v2 requirements**. D-04's pluggable feed-in valuation is the
  forward-compat hook so v2 slots it in cleanly. NOT built in Phase 4.
- **Charts** (monthly self-consumption bars VIZ-01, sample-week step-line flow VIZ-02) —
  Phase 5; they consume `SimResult.trace` and `colorFor()`.
- **Broad assumptions panel "Hoe is dit berekend?"** (UX-01) and **"Waarom geen euro's?"**
  (UX-02) — Phase 5; Phase 4 ships only the co-located saldering disclaimer (D-14).
- **Final mobile polish / full Dutch copy & tooltips / terminology audit** (UX-03/04/05) —
  Phase 5; Phase 4 ships responsive-ready *structure* (D-12) and functional Dutch only.
- **Year-by-year saldering phase-out schedule** (SALD-01) — v2; Phase 4 uses the simple
  on/off net-position model (D-01) + the COMP-06 disclaimer noting the simplification.
- **Battery arbitrage / dynamic-price dispatch** (DYN) — v2; v1 dispatch is pure solar
  self-consumption only.

### Reviewed Todos (not folded)
None — no pending todos matched this phase (todo.match-phase returned 0).

None of the above are scope creep into Phase 4 — they are deliberately later. (DATA-12 is
the one item pulled INTO this phase, per D-19, not deferred.)

</deferred>

---

*Phase: 4-Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State*
*Context gathered: 2026-06-11*
