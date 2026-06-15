# Phase 6: Post-v1 UX Enhancements — Multiple Custom Batteries + Optional Saldering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 06-post-v1-ux-enhancements-multiple-custom-batteries-and-option
**Areas discussed:** Custom add flow + naming, Edit/remove customs, Saldering toggle UX, Table layout when OFF

---

## Custom add flow

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh card per click | Each "+ Eigen batterij" click appends a new inline editable card; cards editable in place | ✓ |
| Fill then commit to chip | One form, fill specs, click "Toevoegen" → becomes a chip, form resets | |

**User's choice:** Fresh card per click
**Notes:** Simplest mental model; editing is inherent (no separate commit step).

## Custom naming

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-numbered | "Eigen batterij 1/2/…" assigned automatically | |
| User-typed name | Name field per card; user types a custom name | |
| User-typed, defaults to numbered | Optional field pre-filled "Eigen batterij N", overwritable | ✓ |

**User's choice:** User-typed, defaults to numbered
**Notes:** Name flows to card label, table column, swatch legend; empty → numbered fallback.

## Cap rule (incomplete cards)

| Option | Description | Selected |
|--------|-------------|----------|
| Only valid customs count | Only capacity>0 customs consume a slot; empty draft allowed, doesn't block compute; add disables at 5 valid | ✓ |
| Every card counts | Each added card reserves a slot immediately | |

**User's choice:** Only valid customs count
**Notes:** Matches existing `activeBatteries` guard (`nominalCapacityKwh > 0`).

---

## Custom removal

| Option | Description | Selected |
|--------|-------------|----------|
| Per-card remove (×) button | Each custom card has its own "× Verwijderen" control; frees slot immediately | ✓ |
| Deselect checkbox like catalog | Checkbox per custom card; uncheck removes from comparison but keeps card | |

**User's choice:** Per-card remove (×) button
**Notes:** Explicit, works regardless of fill state; catalog cards keep existing checkbox behavior.

## Color reflow on removal

| Option | Description | Selected |
|--------|-------------|----------|
| Reflow by order (accept shift) | Keep order-based colorFor/colorSlotFor; survivors re-pack into slots 1..N | ✓ |
| Sticky color per battery | Pin color to each id so removal doesn't recolor survivors | |

**User's choice:** Reflow by order (accept shift)
**Notes:** Zero new code; preserves the Phase 4/5 color contract across table + charts.

---

## Saldering toggle UX

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox above table | Labelled checkbox in options row above the table, default unchecked | ✓ |
| Toggle in column header | Re-use the existing "i" header area to reveal the column in place | |

**User's choice:** Checkbox above table
**Notes:** Label direction "Toon óók 'met saldering' (geldt t/m 2026)" + ⓘ; close to the data it affects, keyboard-accessible.

---

## Table layout when OFF

| Option | Description | Selected |
|--------|-------------|----------|
| Single plain column | Collapse to one "kWh netto-import vermeden" column, no zonder/met sub-labels; ON splits into pair | ✓ |
| Keep "zonder saldering" label | Single column but labelled "zonder saldering" even when OFF | |

**User's choice:** Single plain column
**Notes:** OFF is the headline reality; toggling ON restores the Phase 4 "zonder | met" pair.

## Disclaimer visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Only when toggled ON | Disclaimer appears only once the saldering column is revealed | ✓ |
| Always visible | Disclaimer reachable (info button) even when OFF | |

**User's choice:** Only when toggled ON
**Notes:** Keeps the default OFF view free of saldering verbiage; negative-ON note likewise only when ON.

---

## Claude's Discretion

- Exact unique-id scheme for custom batteries (e.g. `custom-1`, `custom-2`).
- Final Dutch copy for the toggle label and helper text (consistent with the existing corrected disclaimer).
- Reuse of the existing custom-card debounce/validation logic.
- Precise DOM structure of the per-card remove button and the saldering options row.

## Deferred Ideas

- Sticky per-battery color (rejected for this phase; revisit only on user complaint).
- Persisting toggle/selection state across reloads (ties to v2 CONV-01 / CONV-04).
- Any change to the max-5 cap, saldering disclaimer wording, or € modeling — explicitly untouched.
