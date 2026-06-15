---
phase: 06-post-v1-ux-enhancements-multiple-custom-batteries-and-option
plan: 03
subsystem: ui
tags: [comparison-table, saldering, toggle, options-row, worker-pipeline, wave-2]
dependency_graph:
  requires:
    - salderingOn boolean signal (06-01)
    - scheduleRecompute (06-01)
    - activeBatteries computed (06-01)
    - customBatteries collection (06-01, exercised live via 06-02)
  provides:
    - salderingOn-driven single-vs-pair comparison table layout
    - persistent saldering options-row toggle above the table
    - ON-only disclaimer + negative-ON note gating
  affects:
    - src/ui/comparison-table.ts
    - src/main.ts
    - src/styles/comparison-table.css
tech_stack:
  added: []
  patterns:
    - showSaldering boolean threaded through renderTable -> buildThead/buildBatteryRow
    - options-row mounted as a sibling OUTSIDE the container renderTable clears
    - effect reads salderingOn.value so the table re-renders on toggle
key_files:
  created: []
  modified:
    - src/ui/comparison-table.ts
    - src/main.ts
    - src/styles/comparison-table.css
    - tests/comparison-table.test.ts
decisions:
  - D-06: options-row toggle checkbox, default unchecked (saldering OFF by default)
  - D-07: single 'kWh netto-import vermeden' column when OFF; zonder|met pair when ON; leader highlight follows visible columns
  - D-08: SALDERING_DISCLAIMER_COPY + (i) affordance + negative-ON note emitted ONLY when ON
  - D-10: no inline styles; toggle recomputes through the existing Comlink worker
  - "locked copy (SALDERING_DISCLAIMER_COPY / CADENCE_BANNER_COPY / NEGATIVE_ON_NOTE_COPY) reused verbatim — visibility gated, never reworded"
requirements: [COMP-05, COMP-06]
status: complete
---

# 06-03 Summary — Optional saldering toggle (OFF by default)

## What was built

- **Conditional table layout** (`src/ui/comparison-table.ts`): `renderTable` → `buildThead` → `buildBatteryRow` now take a `showSaldering` boolean read from `salderingOn.value` inside the `initComparisonTable` effect. OFF renders a single `kWh netto-import vermeden` headline column (no zonder/met sub-labels, no avoidedOn cell); ON restores the Phase-4 colspan-2 group header + zonder|met pair. Leader highlighting keys per-metric, so it lands on whichever avoided column(s) are visible.
- **ON-only disclaimer/note gating** (D-08): the `#saldering-disclaimer` block + `(i)` affordance and the negative-ON note are emitted only when `showSaldering` is true (note also requires some `avoidedOn <= 0`). Locked copy reused byte-for-byte.
- **Persistent options-row toggle** (`src/main.ts`): a `.saldering-options-row` is appended to `resultsRegion` as a sibling above `comparison-table-mount` (so `renderTable`'s `innerHTML=''` never clobbers it). The checkbox change handler writes `salderingOn.value` and calls `scheduleRecompute(true)`.
- **Styling** (`src/styles/comparison-table.css`): `.saldering-options-row` via design tokens, no inline styles.
- **Tests** (`tests/comparison-table.test.ts`): OFF single-column, ON pair, ON-only disclaimer/note, leader-on-visible-column, toggle wiring; existing XSS test retained.

## Verification

- `npm test` — full suite green (419 tests after the perf deviation below).
- `npm run build` — succeeds; build-only CSP plugin passes (no inline styles).
- `grep -c "saldering is 100%"` == 1 — locked copy intact.
- **Live human-verify (Task 3, blocking)** — APPROVED by the user. Both behavior sets exercised through the real Comlink worker pipeline on merged `main` (the [[test-worker-mock-blind-spot]] CI cannot cover): (A) multiple custom batteries add/edit/remove with order-based colors across table + charts; (B) saldering toggle OFF→ON→OFF with disclaimer/note gating. Zero console errors, zero CSV-bearing network requests.

## Deviations

- **Post-verify perf fix (touches 06-02's `battery-picker.ts`):** during the live verify the user found that editing a custom battery was slow — every debounced keystroke wrote `customBatteries` and triggered a full worker recompute. Reworked the custom card to defer the signal write + recompute to an explicit **"Toevoegen aan vergelijking"** commit button at the bottom of the form (relabels to "Bijwerken" once committed; cap-guard blocks committing past 5 active). Field edits now run inline validation only. Committed separately as `perf(06-02): defer custom-battery recompute to an explicit commit button`; +4 tests. Re-verified live and approved.

## Notes for downstream

- The saldering options-row lives outside the table container — any future table re-render strategy must keep that sibling relationship.
- The commit-button model means `customBatteries` reflects committed drafts only; anything counting "active" customs (cap, swatches, columns) updates on commit, not on keystroke.
