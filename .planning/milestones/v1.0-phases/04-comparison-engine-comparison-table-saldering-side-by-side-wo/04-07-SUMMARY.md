---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
plan: "07"
subsystem: ui
tags: [bug-fix, regression-test, content-fix, saldering, period-control]
dependency_graph:
  requires: []
  provides:
    - "#comparison-table-mount dedicated mount node in #results-region"
    - "Period control survives table renders (UAT Test 5 + 9 unblocked)"
    - "Factually correct SALDERING_DISCLAIMER_COPY (UAT Test 7)"
    - "Integration regression test locking the shared-container fix"
  affects:
    - src/main.ts
    - src/ui/comparison-table.ts
    - tests/comparison-table.test.ts
    - tests/results-region-integration.test.ts
tech_stack:
  added: []
  patterns:
    - "Dedicated child mount node pattern: create div + append before passing to initComparisonTable"
    - "Integration test replicating main.ts mount topology in jsdom"
key_files:
  created:
    - tests/results-region-integration.test.ts
  modified:
    - src/main.ts
    - src/ui/comparison-table.ts
    - tests/comparison-table.test.ts
decisions:
  - "Dedicated #comparison-table-mount div inserted by main.ts after period control mounts — not by initComparisonTable itself — so the fix is testable without invoking main.ts"
  - "SALDERING_DISCLAIMER_COPY comment updated from 'do NOT edit' to record the factual correction date"
  - "Content-lock assertion added to existing comparison-table.test.ts (not a separate file)"
metrics:
  duration_minutes: 3
  completed_date: "2026-06-14"
  tasks_completed: 3
  files_changed: 4
---

# Phase 04 Plan 07: Container-Clobber Fix + Saldering Copy Correction Summary

**One-liner:** Dedicated `#comparison-table-mount` child div prevents `innerHTML=''` from wiping the period-control section; saldering disclaimer updated to confirmed 100% t/m 2026 / full abolition 2027-01-01.

## What Was Built

### Task 1: Give the comparison table its own mount node (fix(04-07) — 3444115)

Changed `src/main.ts` to create a dedicated `<div id="comparison-table-mount">` inside `#results-region` after `initPeriodControl` mounts. `initComparisonTable` now receives this child div instead of `resultsRegion`, so its `renderEmpty/renderTable/renderError` calls to `container.innerHTML = ''` clear only the table area — the sibling `<section aria-label="Analyseperiode">` from the period control is untouched.

The fix mirrors the plan's exact approach: no inline styles (CSP compliant), no change to `initComparisonTable`'s signature, HMR dispose wiring preserved.

### Task 2: Regression integration test (test(04-07) — ffb6914)

Created `tests/results-region-integration.test.ts` (223 lines, jsdom environment) that replicates the main.ts mount topology exactly: `initPeriodControl(resultsRegion)` → create child `#comparison-table-mount` → `initComparisonTable(mountDiv)`. Five test assertions:

1. Period control elements (`#period-from`, `#period-to`, `.period-coverage`) survive empty-state table render
2. Period control elements survive populated table render
3. Period control elements survive recompute (signal toggle)
4. Table content is scoped inside `#comparison-table-mount` (not root region)
5. Empty-state message is scoped inside `#comparison-table-mount`

This test would fail if main.ts topology regressed to sharing the container.

### Task 3: Corrected SALDERING_DISCLAIMER_COPY (fix(04-07) — 6dc5de0)

Rewrote `SALDERING_DISCLAIMER_COPY` in `src/ui/comparison-table.ts` with verified NL saldering facts (Rijksoverheid.nl, June 2026):
- Saldering is 100% and remains so through 31 December 2026
- From 1 January 2027 saldering is fully abolished — no gradual phase-out
- 50% minimum terugleververgoeding through 2030 is a post-abolition compensation minimum, not a saldering floor
- "zonder saldering" column = reality from 2027 onward (what you're buying the battery for)

Comment updated from "locked, do NOT edit" to note the factual correction. No saldering math/modeling changed.

Added content-lock assertion in `tests/comparison-table.test.ts`: disclaimer must contain "2027" and must NOT contain "64%". This is assertion #19 in the test file (previously 18 tests, now 19).

## Verification Results

- `npm test`: 296 tests across 23 files — all passed
- `npm run build`: green, 63.44 kB JS gzip 21.16 kB
- `grep -c "64%" src/ui/comparison-table.ts`: 0 (no stale copy)
- No inline style assignments on the new mount div

## Deviations from Plan

None — plan executed exactly as written.

The "64%" appeared in the code comment after the initial edit, which would have failed the plan's grep gate. Removed from comment to be consistent with the verify command's zero-count expectation.

## Known Stubs

None. All data flows are real; no placeholder text in the new or modified code.

## Threat Flags

No new security-relevant surface introduced. The `#comparison-table-mount` div is a static transparent wrapper carrying no user-derived content, as noted in the plan's threat model (T-04-07-02 accepted). All existing `.textContent` XSS safety on the table renderer is unchanged.

## Self-Check

Checking created files exist:
- tests/results-region-integration.test.ts: FOUND
- src/main.ts (modified): FOUND
- src/ui/comparison-table.ts (modified): FOUND
- tests/comparison-table.test.ts (modified): FOUND

Checking commits exist:
- 3444115 (Task 1): fix(04-07): give comparison table its own #comparison-table-mount node
- ffb6914 (Task 2): test(04-07): add regression integration test — period control survives table renders
- 6dc5de0 (Task 3): fix(04-07): correct SALDERING_DISCLAIMER_COPY — 100% t/m 2026, abolished 2027-01-01

## Self-Check: PASSED
