---
phase: 03-battery-simulator-and-curated-catalog
plan: "04"
subsystem: domain/simulate
tags: [tdd, gap-closure, cr-01, energy-conservation, mixed-interval]
dependency_graph:
  requires: [03-02-SUMMARY.md]
  provides: [mixed-interval-residual-conservation]
  affects: [src/domain/simulate.ts, tests/simulate.test.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, pure-function-fix]
key_files:
  modified:
    - src/domain/simulate.ts
    - tests/simulate.test.ts
decisions:
  - "Discharge branch: use `s.gridImportKwh - delivered` (not `demand - delivered`) — grounds the import base to the raw sample value and preserves non-zero export on mixed intervals"
  - "Charge branch: `residualImport = s.gridImportKwh` — unchanged raw import, battery absorbs from net surplus not from the import component"
metrics:
  duration_minutes: 2
  completed: "2026-06-09T20:47:10Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 03 Plan 04: CR-01 Mixed-Interval Residual Conservation Summary

## One-liner

Fixed silent deletion of non-dominant grid flow on mixed intervals by preserving `s.gridImportKwh` in the charge branch and `s.gridExportKwh` in the discharge branch of `simulate.ts`.

## What Was Built

Closed the single blocking gap from 03-VERIFICATION.md (truth #11 / CR-01): `simulate()` was silently zeroing the non-dominant grid flow on any interval where both `gridImportKwh > 0` and `gridExportKwh > 0` co-exist.

**Root cause:** The charge branch hard-set `residualImport = 0` (line 218), and the discharge branch hard-set `residualExport = 0` (line 229). Real-world HomeWizard P1 15-min buckets routinely carry both flows (e.g. a solar surplus plus a brief demand spike in the same bucket). The SimResult invariant in `types.ts:250-253` documents residuals as "the honest what-would-remain totals", which the old code violated.

**Fix:** Two assignment changes + matching doc comment update.

| Branch | Old | New | Why |
|--------|-----|-----|-----|
| Charge (`net > 0`) | `residualImport = 0` | `residualImport = s.gridImportKwh` | Real grid draw exists regardless of net direction; battery charges from net surplus, not from the import component |
| Discharge (`net < 0`) | `residualExport = 0` | `residualExport = s.gridExportKwh` | Real export exists even when net demand; battery covers demand, leaving export untouched |
| Discharge (`net < 0`) | `residualImport = demand - delivered` | `residualImport = s.gridImportKwh - delivered` | `demand = import - export`, so old form dropped the export term; new form uses raw import base |

**Single-flow intervals unchanged:**
- Pure export (import=0, net>0): `residualImport = 0` (same as before)
- Pure demand (export=0, net<0): `residualExport = 0` and `residualImport = import - delivered` (same as before, since `demand = import` when export=0)

**Non-negativity preserved:**
- Charge branch: `gridSideCharge <= net = export - import`, so `residualExport = export - gridSideCharge >= import >= 0`
- Discharge branch: `delivered <= demand = import - export`, so `residualImport = import - delivered >= export >= 0`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing mixed-interval conservation fixtures | 5686786 | tests/simulate.test.ts |
| 2 (GREEN) | Fix residual accounting in both dispatch branches | b2f2d8f | src/domain/simulate.ts |

## TDD Gate Compliance

- RED gate: `test(03-04)` commit `5686786` — 2 new fixtures failing with `residualImportKwh=0` (expected 2) and `residualExportKwh=0` (expected 1) against unmodified `simulate.ts`
- GREEN gate: `fix(03-04)` commit `b2f2d8f` — all 165 tests pass; `tsc --noEmit` clean

## Verification Results

```
npx vitest run          → 165 tests, 14 files, all passed
npx tsc --noEmit        → TSC_CLEAN (exit 0)
CR-01 probe             → residualImportKwh = 2 (was 0 before fix)
criterion-1 fixture     → residualImportKwh ≈ 0.5, residualExportKwh ≈ 0.0 (single-flow unchanged)
```

## Deviations from Plan

None — plan executed exactly as written. Two assignments changed in `simulate.ts`, doc comment updated, two fixtures added to `simulate.test.ts`. No architectural changes, no new dependencies.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. This is a pure arithmetic correction to an existing in-memory computation.

## Self-Check

Files exist:
- src/domain/simulate.ts — modified (charge/discharge branches + doc comment)
- tests/simulate.test.ts — modified (two new mixed-interval fixtures)
- .planning/phases/03-battery-simulator-and-curated-catalog/03-04-SUMMARY.md — this file

Commits exist:
- `5686786` — test(03-04): add failing mixed-interval conservation fixtures (CR-01 RED)
- `b2f2d8f` — fix(03-04): preserve non-dominant grid flow on mixed intervals (CR-01)
