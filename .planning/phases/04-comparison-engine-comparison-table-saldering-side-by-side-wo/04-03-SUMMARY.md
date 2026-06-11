---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
plan: "03"
subsystem: app-state
tags: [signals, comlink, worker-singleton, generation-guard, debounce, drop-zone-rewire]
dependency_graph:
  requires:
    - src/workers/sim-worker.ts (Comlink worker entry — plan 04-01)
    - src/domain/period-filter.ts (filterByPeriod, fullRange)
    - src/domain/battery-catalog.ts (BATTERY_CATALOG — Sessy 5 at index 0)
    - src/domain/types.ts (IntervalSample, BatteryConfig, SimResult)
  provides:
    - src/state/signals.ts (8 writable signals + 3 computeds — worker-free, testable in node env)
    - src/state/app-state.ts (full store: re-exports signals + worker singleton + scheduleRecompute)
  affects:
    - src/ui/drop-zone.ts (re-wired to write parsedSamples + seed period defaults on parse)
    - 04-04 battery-picker (reads selectedBatteries, customBattery; calls scheduleRecompute)
    - 04-05 comparison-table (reads simResults, activeBatteries, isComputing, computeError)
    - 04-06 period-control (reads coverageDays, parsedSamples; writes periodFrom, periodTo)
tech_stack:
  added: []
  patterns:
    - Signals split — worker-free signals.ts for node-env testability; app-state.ts re-exports everything
    - Comlink worker singleton constructed at module init (Pitfall-4 guard — never in effects)
    - Generation counter (_generation/myGen) discards stale out-of-order worker results (T-04-07)
    - 400ms debounce for continuous input (D-07); immediate=true bypasses for discrete events
    - Worker mock in tests/setup.ts installed as globalThis.Worker for jsdom test compatibility
    - vite-env.d.ts /// reference types="vite/client" enables TypeScript resolution of ?worker suffix
key_files:
  created:
    - src/state/signals.ts
    - src/state/app-state.ts
    - tests/app-state.test.ts
    - tests/setup.ts
    - src/vite-env.d.ts
  modified:
    - src/ui/drop-zone.ts
    - vitest.config.ts
decisions:
  - "Split signals.ts (worker-free) from app-state.ts (worker + scheduleRecompute) so node-env tests avoid Worker is not defined"
  - "Tests import from signals.ts, not app-state.ts — app-state re-exports all signals so callers use a single import point"
  - "Worker mock in tests/setup.ts (not vi.mock) — globalThis.Worker stub satisfies Vite ?worker WorkerWrapper constructor call in jsdom"
  - "src/vite-env.d.ts with triple-slash reference enables tsc to resolve ?worker import suffix (build gate)"
  - "scheduleRecompute batch() wraps both the isComputing=true + error/result writes for atomic DOM update"
metrics:
  duration_minutes: 13
  completed_date: "2026-06-11"
  tasks_completed: 2
  files_changed: 7
---

# Phase 04 Plan 03: Reactive State Core Summary

Signals store + Comlink worker singleton with generation-guarded debounced recompute; drop-zone re-wired to feed the signal graph on parse; 23 node-env signal/computed tests green; full build with emitted sim-worker chunk.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | app-state.ts — signals, worker singleton, generation-guarded scheduleRecompute | e0bc5d2 | src/state/signals.ts, src/state/app-state.ts, tests/app-state.test.ts |
| 2 | Re-wire drop-zone parse pipeline to write parsedSamples + period defaults | a235f62 | src/ui/drop-zone.ts, vitest.config.ts, src/vite-env.d.ts, tests/setup.ts |

## What Was Built

### Task 1: Signals + Worker Singleton + Generation Guard

**`src/state/signals.ts`** (worker-free sub-module):

Eight writable signals exactly per the UI-SPEC Signals State Contract:
- `parsedSamples` (initial: `[]`)
- `selectedBatteries` (initial: `[BATTERY_CATALOG[0]]` — Sessy 5, BATT-03 NL default)
- `customBattery` (initial: `null`)
- `periodFrom` / `periodTo` (initial: `null` — open bounds = full range)
- `simResults` (initial: `null`)
- `isComputing` (initial: `false`)
- `computeError` (initial: `null`)

Three computed signals:
- `filteredSamples` — delegates to `filterByPeriod(parsedSamples.value, periodFrom.value, periodTo.value)`; returns full set when both bounds are null (DATA-12)
- `coverageDays` — `Math.ceil((last - first) / 86_400_000)`; returns 0 for <2 samples
- `activeBatteries` — `[...selectedBatteries.value, ...valid]`; valid = `customBattery` with `nominalCapacityKwh > 0` (T-04-06 DoS guard)

**`src/state/app-state.ts`** (full module):

Worker singleton pattern (Pitfall 4 — once at module init, never in effects):
```typescript
const _simWorker = new SimWorker()
export const simApi = Comlink.wrap<SimApi>(_simWorker)
```

Generation-guarded `scheduleRecompute(immediate = false)`:
- Debounce: 0ms (immediate) or 400ms (D-07)
- `const myGen = ++_generation` captured before the await boundary
- After `await simApi.runComparison(...)`, writes `simResults.value` only if `myGen === _generation` — discards superseded out-of-order results (T-04-07 / RESEARCH Open Q3)
- Error path also guarded: Dutch error message + `simResults.value = null` only if still newest
- `batch()` wraps both the pre-await flag (`isComputing.value = true`) and post-await result writes for atomic DOM update

Re-exports all 11 signals/computeds from `signals.ts` so callers use `from '../state/app-state'` as the single import point.

**`tests/app-state.test.ts`** (23 node-env tests):
- Initial values for all 8 writable signals
- `filteredSamples` re-derives on `parsedSamples` change, `periodFrom` change, and both-null full-range
- `coverageDays` for 0 samples, 1 sample, 1-day span, 7-day span, fractional ceiling
- `activeBatteries` with null/invalid/valid `customBattery`, and multi-battery selection order

### Task 2: Drop-Zone Re-Wire

**`src/ui/drop-zone.ts`** changes (inside `processFiles()`):

After successful `mergeFiles()`:
1. `parsedSamples.value = mergeResult.samples` (D-16 re-wire link)
2. If non-empty: `batch(() => { periodFrom.value = range.start; periodTo.value = range.end })` (D-19 period defaults)
3. `scheduleRecompute(true)` — immediate recompute so Sessy-5 comparison renders without user interaction
4. Existing `renderReadout(mergeResult)` call preserved (D-16 in-place re-wire)

On error: `parsedSamples.value = []` clears stale samples from a previous successful parse.

**`src/vite-env.d.ts`** (new — build gate fix):
Added `/// <reference types="vite/client" />` so TypeScript resolves the Vite-specific `?worker` import suffix in `app-state.ts`. Without this, `tsc -b` fails with TS2307. This is a standard Vite project setup file.

**`tests/setup.ts` + `vitest.config.ts`** (Worker mock for jsdom):
`drop-zone.ts` now transitively imports `app-state.ts` which constructs `new SimWorker()` at module scope. jsdom does not provide `Worker`. Rather than lazy-initializing the worker (which would violate Pitfall 4), a minimal no-op `WorkerMock` is installed as `globalThis.Worker` via `tests/setup.ts` when `Worker` is undefined. Vitest loads this via `setupFiles: ['tests/setup.ts']`. The mock stubs `postMessage`, `terminate`, and `addEventListener` — scheduleRecompute calls queue and never resolve in test context, which is correct because no test exercises the full worker round-trip (worker contract tests use `runComparison` directly per SIM-07 dual-use pattern).

## Verification Results

```
grep -c "new SimWorker()" src/state/app-state.ts     → 1 (singleton)
grep "_generation|myGen" src/state/app-state.ts      → matched (generation guard)
grep "parsedSamples.value =" src/ui/drop-zone.ts     → matched (re-wire link)
npm test -- --run tests/app-state.test.ts            → 23 passed
npm test -- --run tests/app-state.test.ts tests/drop-zone.test.ts → 39 passed
npm test -- --run                                    → 244 passed (19 test files)
npm run build                                        → 0 errors; sim-worker-DazZ4rAZ.js emitted
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Signals split into worker-free sub-module**
- **Found during:** Task 1 — node test environment cannot resolve Vite `?worker` import suffix
- **Issue:** Importing `app-state.ts` in a node-env test (or a jsdom test) pulls in `SimWorker from '../workers/sim-worker?worker'` which constructs `new Worker()` at module scope. Node has no `Worker` global; jsdom also lacks it. `WorkerWrapper` from the `?worker` transform throws `ReferenceError: Worker is not defined`.
- **Fix:** Created `src/state/signals.ts` (signals + computeds only, no worker import). `app-state.ts` imports from `signals.ts`, adds the worker + `scheduleRecompute`, and re-exports everything. Tests import from `signals.ts`. The plan explicitly anticipated this split and described it as the preferred approach: "split the signals+computeds into a worker-free sub-module `src/state/signals.ts` that app-state re-exports, and test that sub-module instead."
- **Files modified:** src/state/signals.ts (new), src/state/app-state.ts (new), tests/app-state.test.ts (tests signals.ts)
- **Commits:** e0bc5d2

**2. [Rule 3 - Blocking Issue] Worker mock required for drop-zone.test.ts (jsdom)**
- **Found during:** Task 2 — after re-wiring drop-zone.ts to import app-state, the existing jsdom test suite fails with `ReferenceError: Worker is not defined`
- **Issue:** `drop-zone.ts` now imports `scheduleRecompute` (and signals) from `app-state.ts`, which constructs the worker at module scope. The jsdom environment does not provide `Worker`. This blocked the Task 2 acceptance criterion "existing tests/drop-zone.test.ts still exits 0 (no regression)".
- **Fix:** Created `tests/setup.ts` with a minimal no-op `WorkerMock` installed on `globalThis.Worker` (guarded by `typeof Worker === 'undefined'`). Added `setupFiles: ['tests/setup.ts']` to `vitest.config.ts`. This satisfies Vite's `WorkerWrapper` constructor call without spinning up a real thread.
- **Files modified:** tests/setup.ts (new), vitest.config.ts (setupFiles added)
- **Commits:** a235f62

**3. [Rule 3 - Blocking Issue] vite-env.d.ts required for TypeScript to resolve ?worker**
- **Found during:** Task 2 build verification — `tsc -b` fails with TS2307 for `?worker` suffix
- **Issue:** TypeScript with `moduleResolution: "bundler"` does not natively know about Vite's `?worker` query suffix. The `vite/client` type declarations include `declare module '*?worker' { ... }` which resolves this, but only when referenced via a triple-slash directive or `types` config.
- **Fix:** Created `src/vite-env.d.ts` with `/// <reference types="vite/client" />`. This is the standard Vite scaffolding step that was missing from earlier phases (pre-existing omission; not a regression this plan introduced).
- **Files modified:** src/vite-env.d.ts (new)
- **Commits:** a235f62

## Known Stubs

None — `scheduleRecompute` makes real `simApi.runComparison()` calls in the browser. The `simApi` proxy is a real Comlink proxy over the emitted `sim-worker` chunk (confirmed in `npm run build` output: `dist/assets/sim-worker-DazZ4rAZ.js`). No placeholder values flow to UI rendering.

## Threat Surface Scan

No new threat surface beyond what was modeled in the plan's threat register:
- T-04-06 (DoS via huge customBattery values): `activeBatteries` computed guards `nominalCapacityKwh > 0` — invalid/null custom battery is excluded before reaching `runComparison`
- T-04-07 (stale worker results): generation counter implemented and tested implicitly by the guard pattern in `_runCompute`
- T-04-08 (worker network egress): `connect-src 'none'` from plan 04-01 applies inside the worker; Comlink uses postMessage, not fetch
- T-04-09 (effect leak): `app-state.ts` creates NO effects — only signals, computeds, and an async function; UI plans own effect disposal (RESEARCH Pitfall 3)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/state/signals.ts exists | FOUND |
| src/state/app-state.ts exists | FOUND |
| tests/app-state.test.ts exists | FOUND |
| tests/setup.ts exists | FOUND |
| src/vite-env.d.ts exists | FOUND |
| src/ui/drop-zone.ts contains parsedSamples.value = mergeResult.samples | FOUND |
| grep -c "new SimWorker()" src/state/app-state.ts → 1 | PASSED |
| grep "_generation|myGen" src/state/app-state.ts → matched | PASSED |
| commit e0bc5d2 exists | FOUND |
| commit a235f62 exists | FOUND |
| npm test (244 tests, 19 files) → 0 failures | PASSED |
| npm run build → 0 errors, sim-worker chunk emitted | PASSED |
