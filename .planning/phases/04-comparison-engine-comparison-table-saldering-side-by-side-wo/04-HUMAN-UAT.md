---
status: partial
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
source: [04-VERIFICATION.md]
started: 2026-06-13T00:00:00Z
updated: 2026-06-13T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. CR-01 — deselect/select mid-compute does not strand "Rekenen…"
expected: Rapidly toggling batteries (including deselecting down to an empty/last selection) while the worker computes never leaves the UI stuck showing "Rekenen…". The indicator clears once compute settles or when there is nothing to compute.
result: [pending]

### 2. WR-03 — 6th active battery swatch is visible
expected: With all 5 catalog batteries selected plus a valid custom battery (6 active), every battery row and picker entry shows a visible color swatch (no invisible/blank swatch for the 6th).
result: [pending]

### 3. WR-04 — "met saldering" value of exactly 0 renders neutral, not red
expected: When a battery's "met saldering" (avoidedOn) value lands at exactly 0.0 kWh, the cell renders in neutral/muted color (not destructive red). Strictly negative values still render red with a U+2212 minus sign.
result: [pending]

### 4. Privacy invariant — zero network / zero CSP violations (production build)
expected: In `npm run build && npm run preview`, with DevTools Console + Network open: zero CSP violations on load and zero network/third-party requests before, during, and after a CSV upload + comparison (connect-src 'none').
result: [pending]

### 5. Visual hierarchy & framing
expected: "zonder saldering" column precedes the muted "met saldering" column; per-column leader highlighted; "i" disclaimer expands with the 2026 64% cap / terugleverkosten / 50% floor copy; coverage shows "N dagen aan data" with no "/jaar" or "/maand" anywhere.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
