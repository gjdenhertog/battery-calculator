---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
plan: "01"
subsystem: worker-infra
tags: [comlink, worker, csp, deps]
dependency_graph:
  requires: []
  provides: [comlink-worker-entry, csp-worker-src-self-blob, signals-core-installed]
  affects: [04-03-worker-wiring, 04-04-state, 04-05-ui-components]
tech_stack:
  added: [comlink@^4.4.2, "@preact/signals-core@^1.14.2"]
  patterns: [comlink-expose-pattern, pure-core-worker-shell-split]
key_files:
  created:
    - src/workers/sim-worker.ts
    - tests/sim-worker-contract.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/constants/csp.ts
    - tests/csp-plugin.test.ts
    - tests/simulate.test.ts
decisions:
  - "Worker entry is 11 lines: only Comlink.expose({ runComparison }) — no logic"
  - "Contract test imports runComparison directly from domain, never from worker file"
  - "Separate worker chunk emission requires ?worker import (04-03); build succeeds without it"
metrics:
  duration_minutes: 8
  completed_date: "2026-06-11"
  tasks_completed: 2
  files_changed: 7
---

# Phase 04 Plan 01: Worker Infrastructure Gate Summary

**One-liner:** Comlink worker entry + CSP 'self' blob: fix gates the phase — both deps installed, typecheck green, and contract test proves SIM-07 dual-use invariant.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install deps and fix CSP worker-src directive | b8d61a9 | package.json, package-lock.json, src/constants/csp.ts, tests/csp-plugin.test.ts |
| 2 | Create Comlink worker entry + contract smoke test + production build proof | d5f2b79 | src/workers/sim-worker.ts, tests/sim-worker-contract.test.ts, tests/simulate.test.ts |

## What Was Built

### Task 1: Deps + CSP
- Installed `comlink@^4.4.2` and `@preact/signals-core@^1.14.2` as runtime `dependencies` in package.json
- Updated `worker-src blob:` to `worker-src 'self' blob:` in `src/constants/csp.ts` with expanded comment block explaining both whitelisted worker origins
- Updated `tests/csp-plugin.test.ts` worker-src assertion from `"worker-src blob:"` to `"worker-src 'self' blob:"` (in-place update, no second test added)

### Task 2: Worker Entry + Contract Test + Build
- Created `src/workers/sim-worker.ts` — 11-line Comlink adapter calling `Comlink.expose({ runComparison })`; satisfies the 12-line constraint (SIM-07)
- Created `tests/sim-worker-contract.test.ts` — imports `runComparison` directly from `../src/domain/compare` (never from the worker file); 3 tests proving the dual-use contract
- Production build green: `npm run build` (tsc -b + vite build) exits 0 with zero TypeScript errors

## Sequencing Note: Worker Chunk Emission

The Vite `?worker` import (e.g. `import SimWorker from '../workers/sim-worker?worker'`) is the mechanism that causes Vite to emit the Comlink worker as a separate `dist/assets/` chunk. This import lands in plan **04-03** when `src/state/app-state.ts` instantiates the worker singleton. For this plan (04-01), the build succeeds with the worker entry present and typechecked, but the separate chunk is not yet emitted. The `worker-src 'self'` CSP directive is pre-wired so it will work immediately when 04-03 wires it.

## Verification Results

All plan-level verification criteria passed:

```
node -e "require('comlink');require('@preact/signals-core')"  → OK
grep "worker-src 'self' blob:" src/constants/csp.ts           → matched
grep "connect-src 'none'" src/constants/csp.ts                → matched (privacy invariant)
npm test -- --run tests/csp-plugin.test.ts                    → 12 passed
npm test -- --run tests/sim-worker-contract.test.ts           → 3 passed
npm run build                                                   → 0 errors, built in 480ms
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing unused variable in tests/simulate.test.ts**
- **Found during:** Task 2 (production build verification)
- **Issue:** `contiguous60min` function declared at line 42 of `tests/simulate.test.ts` but never used — TypeScript error TS6133 blocked `tsc -b` and therefore `npm run build`
- **Fix:** Removed the unused `contiguous60min` function (5 lines). The function was defined alongside `contiguous15min` and `contiguousDaily` but no test in that file referenced it.
- **Files modified:** tests/simulate.test.ts
- **Commit:** d5f2b79 (included with Task 2 files)

## Threat Surface Scan

No new threat surface introduced beyond what was modeled in the plan's threat model:
- T-04-01 (Comlink postMessage channel): worker entry implements `Comlink.expose` — no custom serialization, only structured clone
- T-04-02 (worker network egress): `connect-src 'none'` confirmed present in final CSP
- T-04-03 (CSP relaxation): `worker-src 'self' blob:` — minimal set; no `data:` or remote origins added
- T-04-SC (npm installs): both packages installed with pinned `^` semver ranges; no postinstall scripts

## Self-Check: PASSED

- `src/workers/sim-worker.ts` exists: FOUND (11 lines, contains Comlink.expose({ runComparison }))
- `tests/sim-worker-contract.test.ts` exists: FOUND (3 tests, all passing)
- Commit b8d61a9 exists: FOUND
- Commit d5f2b79 exists: FOUND
- All acceptance criteria met per verification run above
