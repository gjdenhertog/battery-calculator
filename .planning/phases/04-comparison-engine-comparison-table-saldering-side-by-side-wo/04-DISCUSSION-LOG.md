# Phase 4: Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 4-Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State
**Areas discussed:** Saldering framing, Battery picker UX, Table layout, Honesty surfacing

---

## Saldering framing

### Q1 — What number actually DIFFERS between the saldering-ON and saldering-OFF columns?

| Option | Description | Selected |
|--------|-------------|----------|
| Net grid position | saldering ON = 1:1 annual netting `max(0, residualImport − residualExport)`; OFF = export ~0 `residualImport`. Avoided computed vs each scenario's baseline; same battery shows big benefit without saldering, ~0 with it. | ✓ |
| Shared headline + net row | Keep physical "kWh avoided" identical in both columns; add a secondary "effectief voordeel na verrekening" row netting only in ON. | |
| Identical + disclaimer only | Same physical numbers both columns; difference explained only by COMP-06 disclaimer text. | |

**User's choice:** Net grid position (Option 1)
**Notes:** User added: "we might want to add the option to set terugleverkosten per kWh because some energy providers charge those." → Captured as deferred (SALD-02, v2); a pluggable feed-in valuation (D-04) is the forward-compat hook. Terugleverkosten is a €/kWh input that collides with the v1 kWh-only boundary, so NOT built in Phase 4.

### Q2 — Honesty when the saldering-ON benefit is ~0 / slightly negative

| Option | Description | Selected |
|--------|-------------|----------|
| Show it honestly | Display ≤0 as-is with a plain-Dutch note; the contrast with OFF is the point. | ✓ |
| Floor at zero | Clamp the ON benefit at 0 ("0 kWh bespaard"). | |
| You decide | Claude picks during planning. | |

**User's choice:** Show it honestly
**Notes:** —

### Q3 — Visual weight of the two saldering scenarios

| Option | Description | Selected |
|--------|-------------|----------|
| Lead with saldering-OFF | OFF primary (the future being sized for); ON secondary/muted "nu nog, met saldering". Both always visible, no verdict. | ✓ |
| Fully neutral, equal weight | ON first, OFF second, equal emphasis. | |
| You decide | Claude picks during UI design. | |

**User's choice:** Lead with saldering-OFF
**Notes:** —

---

## Battery picker UX

### Q1 — How catalog battery selection is presented

| Option | Description | Selected |
|--------|-------------|----------|
| Spec cards w/ checkboxes | Selectable card per battery showing key specs + color swatch; Sessy 5 pre-checked; cap-5 disables rest. | ✓ |
| Compact chips | Toggleable name+color chips; specs on hover/expand. | |
| Dropdown + add list | Dropdown + "toevoegen" building a list below. | |
| You decide | Claude picks during UI design. | |

**User's choice:** Spec cards with checkboxes
**Notes:** —

### Q2 — How the custom battery (BATT-04, 5 fields) is entered

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expandable card | "+ eigen batterij" card matching the pattern; expands to 5 fields inline; counts as one of 5. | ✓ |
| Always-visible form section | Separate form block below the catalog with an include checkbox. | |
| Modal dialog | Button opens a modal with the 5 fields. | |
| You decide | Claude picks during UI design. | |

**User's choice:** Inline expandable card
**Notes:** —

### Q3 — Recompute trigger on selection / custom-field change

| Option | Description | Selected |
|--------|-------------|----------|
| Live (auto, debounced) | Auto-rerun worker on any change (debounced typing); "Rekenen…" indicator; stale results dimmed. | ✓ |
| Explicit "Vergelijk" button | Assemble then click to compute. | |
| You decide | Claude picks during planning. | |

**User's choice:** Live (auto, debounced)
**Notes:** —

---

## Table layout

### Q1 — How saldering OFF/ON appear given batteries-as-rows / metrics-as-columns

| Option | Description | Selected |
|--------|-------------|----------|
| Only headline doubled | Just "kWh netto-import vermeden" → two columns (zonder | met saldering); other metrics shown once. | ✓ |
| Full metric set per scenario | Two column-groups repeating ALL metrics. | |
| Batteries as columns instead | Products across top, OFF/ON sub-column pair each; conflicts with COMP-03. | |
| You decide | Claude picks during UI design. | |

**User's choice:** Only headline doubled
**Notes:** Orientation (batteries=rows, metrics=columns) treated as locked by COMP-03's "metric column highlights the per-row leader" wording.

### Q2 — Responsive/mobile work in Phase 4 vs Phase 5 (UX-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive-ready structure now | Semantic structure that reflows to per-battery cards; Phase 5's UX-04 = CSS-only reflow. | ✓ |
| Desktop-first, defer to Phase 5 | Desktop table only; all responsive structure + polish in Phase 5. | |
| You decide | Claude picks during planning. | |

**User's choice:** Responsive-ready structure now
**Notes:** —

### Q3 — Per-column leader highlight vs per-battery identity color

| Option | Description | Selected |
|--------|-------------|----------|
| Separate treatments | Identity color = row swatch via tested colorFor() (reused in charts); leader = distinct neutral emphasis per metric column. | ✓ |
| Color-coded leader | Leading cell highlighted in the battery's own color (risks reading as a "best battery" verdict — COMP-03 forbids). | |
| You decide | Claude picks during UI design. | |

**User's choice:** Separate treatments
**Notes:** —

---

## Honesty surfacing

### Q1 — Prominence of the coarse-cadence warning

| Option | Description | Selected |
|--------|-------------|----------|
| Prominent banner | Clear caveat banner above results when coarseCadenceWarning is true; results still shown but caveated. | ✓ |
| Inline badge | Smaller "o.b.v. dagdata" badge near headline numbers. | |
| You decide | Claude picks during UI design. | |

**User's choice:** Prominent banner
**Notes:** The owner's own real HomeWizard export is daily granularity, so this is the common case — can't be a footnote.

### Q2 — Where the COMP-06 saldering disclaimer lives (vs Phase 5 UX-01 panel)

| Option | Description | Selected |
|--------|-------------|----------|
| Co-located + expandable | Disclaimer next to saldering column headers; short caveat + "i"/expandable full text (64% cap, terugleverkosten, 50% floor through 2030). Phase 5 UX-01 absorbs later. | ✓ |
| Minimal now, full in Phase 5 | One-line caveat now; full 3-point detail in Phase 5 (risk: COMP-06 requires content now). | |
| You decide | Claude picks during planning. | |

**User's choice:** Co-located + expandable
**Notes:** —

### Q3 — Interactive period-narrowing control (DATA-12) in Phase 4 or not

| Option | Description | Selected |
|--------|-------------|----------|
| Include it in Phase 4 | Date-range control now; filterByPeriod() exists, signals present; defaults to full range; live recompute. Closes a Pending requirement / honors Phase 2's promise. | ✓ |
| Full-range only, defer to Phase 5 | Coverage indicator only, no narrowing control; defer DATA-12. | |
| You decide | Claude picks during planning. | |

**User's choice:** Include it in Phase 4
**Notes:** Resolves the scope ambiguity (Phase 2 CONTEXT D-02 assigned the control here, but Phase 4's req list omitted DATA-12). Roadmap/REQUIREMENTS traceability should move DATA-12 → Phase 4.

---

## Claude's Discretion

- Exact color palette and `colorFor(batteryId)` mapping (only separate-treatment + chart-reuse + unit test fixed).
- Exact column header wording / ordering within the agreed set.
- "Rekenen…" indicator placement/styling and recompute debounce interval.
- Parser worker boundary — whether parse is also Comlink-wrapped or left on PapaParse's own worker (avoid double-workering); whether period filtering runs in-worker.
- Empty/loading/error-state copy & styling (functional Dutch; polish is Phase 5).
- Internal module layout for new UI/state/worker files; signals granularity; result memoization.

## Deferred Ideas

- **Terugleverkosten €/kWh input** (user-raised) → SALD-02, v2; D-04 pluggable valuation is the hook.
- Charts (VIZ-01/02), assumptions panel (UX-01), "Waarom geen euro's?" (UX-02), full mobile polish + Dutch copy + terminology audit (UX-03/04/05) → Phase 5.
- Year-by-year saldering schedule (SALD-01), battery arbitrage / dynamic pricing (DYN) → v2.
