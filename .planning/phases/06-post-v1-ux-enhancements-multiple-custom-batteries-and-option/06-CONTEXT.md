# Phase 6: Post-v1 UX Enhancements — Multiple Custom Batteries + Optional Saldering - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Two consumer-requested UX enhancements promoted from Phase 4 UAT (see
`04-UAT.md` → "Enhancement Notes"), deferred out of v1. Both are pure UI/state
changes layered on the already-proven simulation + comparison pipeline — no
engine, parser, or worker-contract changes.

1. **Multiple custom batteries.** Today the picker supports exactly ONE
   user-defined battery (`customBattery` single signal, hardcoded `id: 'custom'`).
   This phase lets the user add several custom batteries, each as its own
   comparison column with a distinct swatch color, still bounded by the existing
   max-5 total selection cap (catalog + custom combined).

2. **Saldering OFF by default.** Today the "met saldering" column is always
   rendered as the second headline column. This phase makes saldering an opt-in
   mode that is OFF by default, so the post-2027 "zonder saldering" reality is
   the headline. A toggle reveals the "met saldering" column; the (already
   factually-corrected) policy disclaimer surfaces only when the mode is ON.

**In scope:** picker data-model change (single → multiple customs), per-card
add/edit/remove UI, optional naming, saldering toggle + conditional column/copy,
tests for both behaviors.

**Out of phase (do NOT touch):** the saldering disclaimer *wording* (corrected
in Phase 5, verified against Rijksoverheid.nl — leave as-is), the simulation
engine, parsers, the Comlink worker contract, the 5-color palette, financials/€
(still v2), and any change to the max-5 cap value.
</domain>

<decisions>
## Implementation Decisions

### Custom-battery add flow & naming
- **D-01:** Adding a custom battery uses a **fresh editable card per click** of
  "+ Eigen batterij" — each click appends a new inline card that is editable in
  place (no separate "commit to chip" step). Editing is therefore inherent: the
  user just changes the fields on the card.
- **D-02:** Each custom card has an **optional name field pre-filled with
  `Eigen batterij N`** (N = its ordinal among customs); the user may overwrite it.
  The name flows to the card label, the comparison-table column header, and the
  swatch legend. Empty name → fall back to the `Eigen batterij N` default.
- **D-03:** **Only valid customs count toward the max-5 cap.** A custom counts
  only when `nominalCapacityKwh > 0` (matches today's `activeBatteries` guard in
  `src/state/signals.ts:92`). An empty/invalid draft card is allowed open and does
  NOT block compute or consume a slot. The "+ Eigen batterij" affordance disables
  when 5 **valid** batteries (catalog + valid custom) are active.

### Custom-battery edit & removal
- **D-04:** Each custom card carries its own **`× Verwijderen` remove button**
  (explicit per-card removal, works regardless of fill state, frees the slot
  immediately). Catalog cards keep their existing checkbox deselect behavior —
  do not change it.
- **D-05:** **Colors reflow by order.** Keep the existing order-based
  `colorFor` / `colorSlotFor` (`src/helpers/color.ts`). Removing a battery from
  the middle re-packs survivors into slots 1..N (a later battery shifts up a
  color). This deliberately preserves the Phase 4/5 color contract used across
  the table AND charts — NO new stable-id→slot map, no contract change.

### Saldering toggle UX
- **D-06:** The saldering toggle is a **labelled checkbox in an options row
  directly above the comparison table**, default **unchecked**. Working label:
  `Toon óók 'met saldering' (geldt t/m 2026)` with an adjacent info (ⓘ) affordance.
  (Exact final copy is the planner's to finalize against the existing corrected
  disclaimer text — keep it consistent.)

### Comparison-table layout when saldering OFF
- **D-07:** **OFF (default) → a single plain `kWh netto-import vermeden`
  column** with NO `zonder/met` sub-labels — the post-2027 number is simply THE
  headline. Toggling **ON splits it back into the `zonder | met` pair** (the
  current Phase 4 layout). Per-row leader highlighting applies to whichever
  headline column(s) are visible.
- **D-08:** The corrected policy disclaimer (100% t/m 2026, volledig afgeschaft
  2027-01-01, wettelijk minimum terugleververgoeding 50% t/m 2030) is shown
  **only when saldering is toggled ON** — it explains the column the user just
  revealed. The default OFF view carries no saldering verbiage. By extension, the
  existing "negative-ON" note (shown when any `avoidedOn ≤ 0`, D-02 of Phase 4)
  only appears when ON.

### Data-model direction (locked, for the planner)
- **D-09:** Replace the single `customBattery` signal with a **collection of
  custom batteries** (e.g. `customBatteries: signal<BatteryConfig[]>`), each with
  a **unique stable id** (e.g. `custom-1`, `custom-2`, … — must be distinct so
  `colorFor`/table columns key correctly; the hardcoded `id: 'custom'` at
  `battery-picker.ts:297` must go). `activeBatteries` becomes
  `[...selectedBatteries, ...validCustomBatteries]`. Add a saldering-on boolean
  signal (default `false`) for D-06/D-07/D-08.

### Constraints carried into this phase
- **D-10:** No inline styles — swatches/colors via `.battery-swatch--N` CSS
  classes only (`style-src 'self'` CSP). Recompute still flows through the
  existing Comlink worker pipeline unchanged. Both new behaviors must be covered
  by tests (custom add/remove/cap + saldering toggle column/copy).

### Claude's Discretion
- Exact id scheme for custom batteries (D-09), final Dutch copy for the toggle
  label and any helper text, debounce/validation reuse from the existing custom
  card, and the precise DOM structure of the new per-card remove button and
  options row — all left to research/planning, provided the decisions above hold.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & source
- `.planning/ROADMAP.md` § "Phase 6: Post-v1 UX Enhancements" — the three locked
  success criteria this phase must satisfy.
- `.planning/phases/04-comparison-engine-comparison-table-saldering-side-by-side-wo/04-UAT.md`
  § "Enhancement Notes" + "Content Corrections" — the origin of both enhancements
  (Test 4 multiple customs; Test 7 saldering optional/off-by-default).

### Code to modify (primary)
- `src/ui/battery-picker.ts` — custom-card builder (`buildCustomCard`, ~line 250+);
  hardcoded `id: 'custom'` at line 297; reactive swatch effect (~line 502+). This
  is where the single → multiple custom flow, naming, and `× Verwijderen` land.
- `src/state/signals.ts` — `customBattery` single signal (line 44) and
  `activeBatteries` computed (lines 90-94); the valid-custom guard
  `nominalCapacityKwh > 0` (line 92). Add custom-collection + saldering-on signals.
- `src/ui/comparison-table.ts` — `buildThead` saldering group header (lines
  100-175), the `SALDERING_DISCLAIMER_COPY` (already corrected — do NOT reword),
  the negative-ON note. Conditional single-vs-pair column layout + ON-only
  disclaimer live here.

### Code to reuse (do not change contract)
- `src/helpers/color.ts` — `colorFor` / `colorSlotFor` (order-based, 5 slots);
  reused as-is per D-05.
- `src/helpers/metrics.ts` — `avoidedWithoutSaldering` / `avoidedWithSaldering`
  (D-01/D-02 framing); both stay; only their column *visibility* changes.
- `src/state/app-state.ts` — re-exports signals + adds Comlink worker singleton +
  `scheduleRecompute`; new signals must be wired through the same recompute path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`buildCustomCard` / `validateAndWrite` / debounced write** in
  `battery-picker.ts` — the single-custom flow (400ms debounce, blur-immediate
  validate, default-fill of unfilled optional fields to Sessy 5 values) is the
  template to generalize to N cards.
- **`activeBatteries` computed** already does `[...selected, ...validCustom]` with
  a `nominalCapacityKwh > 0` guard — extends naturally to an array of customs.
- **`colorFor` / `colorSlotFor`** are already order-based and shared by table +
  charts — multiple customs get distinct colors "for free" given unique ids and
  the D-05 reflow decision.
- **`SALDERING_DISCLAIMER_COPY`** is already factually corrected and verified —
  reuse verbatim; this phase only gates its *visibility*.

### Established Patterns
- Signals + reactive `effect()` DOM updates; pure helpers tested in node Vitest;
  worker invoked only via `app-state.ts` `scheduleRecompute`.
- Swatch colors are CSS classes (`.battery-swatch--N`), never inline styles (CSP).
- Comparison table renders into its own dedicated `#comparison-table-mount` child
  node (Phase 4 fix 04-07) so `innerHTML=''` re-renders don't clobber siblings —
  the new saldering options row must respect this mount separation.

### Integration Points
- New saldering-on signal → read by `comparison-table.ts` thead/cell builders to
  switch single-column ↔ pair and gate the disclaimer.
- Custom-collection signal → read by both the picker (cards/cap/remove) and
  `activeBatteries` (compute input); recompute fires through existing worker path.

</code_context>

<specifics>
## Specific Ideas

- Toggle label direction: `Toon óók 'met saldering' (geldt t/m 2026)` (planner to
  finalize, consistent with the existing corrected disclaimer).
- Custom name default pattern: `Eigen batterij N`.
- Remove control label direction: `× Verwijderen` per custom card.
- Test worker-mock blind spot ([[test-worker-mock-blind-spot]]): Vitest mocks the
  Worker, so the Comlink round-trip + reactive recompute timing for the new
  signals will NOT be exercised in CI — verify the live recompute (custom
  add/remove and saldering toggle both triggering a correct re-render) in the
  human-verify step.

</specifics>

<deferred>
## Deferred Ideas

- Sticky per-battery color (pin a color to each id so mid-list removal doesn't
  recolor survivors) — considered and rejected for this phase (D-05 keeps the
  order-based contract). Revisit only if users complain about color shuffling.
- Persisting toggle/selection state across reloads — out of scope; ties to the
  v2 `CONV-01` shareable-URL / `CONV-04` local-cache items in REQUIREMENTS.md.
- Any change to the max-5 cap, the saldering disclaimer wording, or financial (€)
  modeling — explicitly untouched here.

</deferred>

---

*Phase: 6-post-v1-ux-enhancements-multiple-custom-batteries-and-option*
*Context gathered: 2026-06-15*
