---
status: diagnosed
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md]
started: 2026-06-14T04:49:43Z
updated: 2026-06-14T05:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Start the app from scratch in a browser. Page loads with no console errors; drop zone, battery picker ("Kies batterijen"), and period control ("Analyseperiode") all render. No outbound network calls with data.
result: pass

### 2. Battery Picker — Sessy 5 Default
expected: The battery picker shows 7 catalog spec-cards plus a "+ Eigen batterij" custom card. Each card shows a color swatch, name, and Dutch spec rows (Capaciteit, Bruikbaar, Rendement, Max laden, Max ontladen). Sessy 5 is pre-checked on load.
result: pass

### 3. Select Multiple Batteries + Max-5 Cap
expected: Checking additional batteries adds them to the selection. Once 5 are selected, the remaining unchecked cards become disabled (greyed, not clickable) and a note "Maximaal 5 batterijen geselecteerd." appears. Unchecking one re-enables the others.
result: pass

### 4. Custom Battery Entry
expected: Clicking "+ Eigen batterij" expands a form. Entering a capacity (e.g. 10) produces a valid custom entry that appears as a column in the comparison. Leaving capacity blank/invalid shows an inline error and does not add a column. Collapsing the form removes the custom entry.
result: pass
note: "User wants to be able to add MULTIPLE custom batteries (current design supports only one). Captured as future enhancement — see Enhancement Notes."

### 5. Upload CSV → Automatic Comparison
expected: Drop/upload a valid energy CSV. After parsing, the comparison table renders automatically for the pre-selected Sessy 5 (no extra click needed). Period date inputs auto-fill to the data's full range and a coverage indicator shows "{N} dagen aan data".
result: issue
reported: "I don't see the coverage indicator, where should that be?"
severity: major
confirmed_root_cause: "main.ts mounts initPeriodControl(resultsRegion) AND initComparisonTable(resultsRegion) into the SAME #results-region. comparison-table.ts renderEmpty/renderTable/renderError each call container.innerHTML = '' (lines 48/56/339). The table effect runs immediately on load (empty-state) and on every recompute, wiping the entire period-control <section> (Analyseperiode heading + Van/Tot date inputs + coverage indicator + framing note). CONFIRMED live: user sees the Phase 2 parse readout ('Periode: {date} – {date}', readout.ts:79, mounted beside the upload zone) but NOT the Analyseperiode section. Escaped CI because jsdom tests mount each component in an isolated container — the shared-container layering bug only manifests in the integrated live DOM (worker-mock blind spot family)."

### 6. Saldering Side-by-Side Columns + Leaders
expected: Each battery row shows "zonder saldering" (primary) and "met saldering" (muted) columns side by side, plus Zelfverbruik %, Verschoven kWh, Rest-import kWh, Rest-teruglevering kWh, and Marginale benutting. With multiple batteries, the best value per column is highlighted (semibold / tinted leader cell). No "/jaar" or "/maand" extrapolation appears anywhere.
result: pass

### 7. Saldering Honesty — Negative Shown As-Is
expected: When "met saldering" yields a non-positive value, the cell shows the actual negative number with a proper minus sign (−) in a distinct (destructive) color — it is NOT floored to "0.0 kWh".
result: pass
note: "User raised two follow-ups (not defects in this test): (1) make the whole saldering feature OPTIONAL and OFF by default; (2) factual correction — saldering is currently 100% and is fully abolished as of 2027-01-01, which contradicts the shipped disclaimer copy. See Enhancement Notes + Content Corrections."

### 8. Saldering Disclaimer Toggle
expected: An "i" info button near the saldering columns toggles a disclaimer explaining the saldering assumption. Clicking it shows/hides the explanatory text.
result: pass

### 9. Period Narrowing → Live Recompute
expected: Changing the Van/Tot date inputs to a narrower range recomputes the comparison against just that window. The coverage indicator updates to the new day count. Setting Van later than Tot clamps sensibly rather than breaking.
result: issue
reported: "Not testable — the Van/Tot date inputs are wiped by the Test 5 container-clobber bug; the period control never renders."
severity: major
root_cause: "Same as Test 5 — comparison table's container.innerHTML='' on the shared #results-region destroys the period-control section. Period narrowing cannot be exercised until that is fixed. Re-test this item after the Test 5 fix lands."

### 10. Compute States — "Rekenen..." + Coarse-Cadence Banner + Consistent Colors
expected: During recompute a "Rekenen..." indicator appears and the table dims but the UI is not locked. On daily-cadence data a warning banner appears above the table. Each battery's swatch color is the same in the picker as in its table row/column.
result: pass
note: "Core checks (Rekenen indicator, cadence banner, catalog-battery color consistency) all pass. Minor cosmetic defect surfaced: the user-created custom battery card shows NO color swatch, so its color is not consistent with its table row. Logged as a minor gap."

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Period control (Analyseperiode section: Van/Tot date inputs + coverage indicator + framing note) renders and persists in #results-region after upload and recompute"
  status: failed
  reason: "User reported: I don't see the coverage indicator. Confirmed live — the entire Analyseperiode section is absent; user sees only the Phase 2 parse readout ('Periode: {date} – {date}')."
  severity: major
  test: 5
  root_cause: "main.ts mounts initPeriodControl AND initComparisonTable into the same #results-region; comparison-table.ts renderEmpty/renderTable/renderError each do container.innerHTML = '' (lines 48/56/339), wiping the period-control section on initial empty-state render and every recompute."
  artifacts:
    - path: "src/main.ts"
      issue: "initPeriodControl(resultsRegion) and initComparisonTable(resultsRegion) share the same container (lines 38-40)"
    - path: "src/ui/comparison-table.ts"
      issue: "renderEmpty/renderError/renderTable call container.innerHTML = '' on the shared #results-region (lines 48, 56, 339)"
  missing:
    - "Give the comparison table its own dedicated child container inside #results-region (e.g. a <div> appended by initComparisonTable) so innerHTML='' only clears the table, not the sibling period control"
    - "OR have initComparisonTable own a sub-container created in main.ts and pass distinct mount nodes to each init"
  also_blocks: "Test 9 (period narrowing → live recompute) — cannot be exercised while the period control is wiped"
  debug_session: ""

- truth: "User-created custom battery shows a color swatch on its picker card, consistent with its color in the comparison table"
  status: failed
  reason: "User reported: the battery the user can create himself does not show the color on the card. Confirmed — buildCustomCard() renders no .battery-card__swatch element (only catalog cards do, battery-picker.ts:86-94)."
  severity: minor
  test: 10
  root_cause: "buildCustomCard() in src/ui/battery-picker.ts omits the swatch <span> that buildBatteryCard() includes; the custom card has no element bound to colorSlotFor for the active custom battery."
  artifacts:
    - path: "src/ui/battery-picker.ts"
      issue: "buildCustomCard() (line ~118+) renders expand button + form but no battery-card__swatch span; reactive effect does not update a swatch for the custom card"
  missing:
    - "Add a .battery-card__swatch span to the custom card and update its battery-swatch--N slot in the reactive effect when customBattery is active (using colorSlotFor against activeBatteries order)"
  debug_session: ""

## Enhancement Notes

> **Promoted to roadmap Phase 6** (2026-06-14): "Post-v1 UX Enhancements — Multiple Custom Batteries + Optional Saldering". Both items below are now tracked there.

- **Multiple custom batteries** (raised during Test 4, 2026-06-14): The custom-battery card currently
  supports only one user-defined battery. User wants to add several of their own batteries to the
  comparison. Not a defect (Test 4 passed as designed) — a future enhancement for a later phase/milestone.

- **Saldering optional + off by default** (raised during Test 7, 2026-06-14): User wants the entire
  saldering treatment to be an optional mode, toggled OFF by default. Currently the "met saldering"
  column is always shown. Future enhancement — likely pairs with the content correction below.

## Content Corrections

- **Saldering policy copy is factually stale** (raised during Test 7, 2026-06-14): The locked
  SALDERING_DISCLAIMER_COPY in src/ui/comparison-table.ts states "vanaf 2026 is saldering al afgebouwd
  naar 64% van het leveringstarief" and "een vloer van 50% van het kale leveringstarief blijft gelden
  tot en met 2030". Per user (domain owner): saldering is currently 100% and is fully abolished as of
  2027-01-01 (no gradual 64% step, no 50% floor through 2030). The disclaimer copy — and any saldering
  modeling assumptions that depend on these figures — should be corrected. Verify against current NL
  legislation before editing the locked copy.
