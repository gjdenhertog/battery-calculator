---
phase: 02-csv-parsing-format-detection-multi-file-merge-dst-safe-time-
plan: 01
subsystem: data
tags: [papaparse, date-fns, typescript, csp, registry, fixtures, csv]

# Dependency graph
requires:
  - phase: 01-setup-deploy-plumbing-privacy-rules
    provides: Vite+TS scaffold, CSP plugin infrastructure, passing test suite baseline
provides:
  - IntervalSample/ParseFileResult/MergeResult/ParseRowError/UnsupportedEncodingError type contract
  - CsvParser interface + ParserRegistry singleton (register/claim, first-match)
  - worker-src blob: CSP directive (unblocks PapaParse worker:true)
  - DST fixture CSVs for spring 2026-03-29 (92 intervals) and fall 2026-10-25 (100 intervals)
  - Real HomeWizard P1 daily-granularity export fixture (366 rows, 2025)
  - papaparse, date-fns, @date-fns/tz runtime deps at CLAUDE.md-locked versions
affects: [02-02, 02-03, 02-04, 03]

# Tech tracking
tech-stack:
  added:
    - papaparse@^5.5.3 (CSV streaming parser)
    - date-fns@^4.3.0 (tree-shakeable date utilities)
    - "@date-fns/tz@^1.5.0 (TZDate for DST-safe Europe/Amsterdam bucketing)"
    - "@types/papaparse@^5 (TypeScript types for PapaParse)"
  patterns:
    - Named-export-only modules (no default exports) — matches existing csp.ts/shell.ts convention
    - Parser registry as singleton with register/claim (open-closed: add parser by import side-effect)
    - Node-env tests for pure domain logic (no jsdom) — registry.test.ts
    - One it()-per-directive test structure — csp-plugin.test.ts extended for worker-src

key-files:
  created:
    - src/domain/types.ts (IntervalSample, SeriesType, ParseFileResult, MergeResult, FileStat, ParseRowError, UnsupportedEncodingError)
    - src/domain/parsers/registry.ts (CsvParser interface, ParserRegistry singleton)
    - tests/fixtures/homewizard-spring-2026-03-29.csv (DST spring-forward, 93 rows = 92 delta intervals)
    - tests/fixtures/homewizard-fall-2026-10-25.csv (DST fall-back, 101 rows = 100 delta intervals)
    - tests/fixtures/homewizard-real-sample.csv (real daily export, 366 rows, 2025-01-01–2025-12-31)
  modified:
    - package.json (4 new deps at locked versions)
    - package-lock.json (lockfile update)
    - src/constants/csp.ts (worker-src blob: inserted between connect-src and base-uri)
    - tests/csp-plugin.test.ts (worker-src blob: assertion added)
    - tests/registry.test.ts (red test committed, then implementation; 4 tests green)

key-decisions:
  - "CSP Option A chosen: add worker-src blob: (PapaParse blob worker is same-origin bundled code, cannot fetch); connect-src 'none' unchanged; Option B (Vite ?worker + worker:false) documented as alternative"
  - "ParseRowError and UnsupportedEncodingError use verbatim Dutch error-message strings per RESEARCH.md Error Architecture"
  - "ParserRegistry uses sentinel pattern (clearForTesting) to prevent cross-test pollution from module singleton"
  - "Real HomeWizard P1 sample is DAILY granularity (one row/day) — not 15-min intervals; adapter (02-02) must not assume 15-min spacing"
  - "Real sample header has 3 extra trailing columns (L1 max W, L2 max W, L3 max W) beyond the 5 core columns; adapter must tolerate/ignore extra trailing columns"

patterns-established:
  - "Pattern: CsvParser registry — register by import side-effect, claim returns first matching parser or null"
  - "Pattern: node-env Vitest tests for pure domain modules (registry, types, future adapters)"
  - "Pattern: CSP directive test — one it() per directive in csp-plugin.test.ts"

requirements-completed: [DATA-03, DATA-06, DATA-07, DATA-08, DATA-09, DATA-13]

# Metrics
duration: ~90min (across two execution sessions including checkpoint)
completed: 2026-06-09
---

# Phase 02 Plan 01: Foundation — Deps, CSP, Domain Contract, Parser Registry, DST Fixtures Summary

**papaparse/date-fns/@date-fns/tz installed; CSP relaxed for blob worker; IntervalSample/ParseFileResult/MergeResult type contract + open-closed parser registry established; DST fixtures synthesized; real HomeWizard P1 daily export fixture committed.**

## Performance

- **Duration:** ~90 min (two sessions, checkpoint between sessions)
- **Started:** 2026-06-08T15:23Z
- **Completed:** 2026-06-09T09:30Z
- **Tasks:** 4 (Task 1: human gate; Task 2: deps+CSP; Task 3: TDD types+registry; Task 4: fixtures)
- **Files modified:** 9 files (5 created, 4 modified)

## Accomplishments

### Task 1: Package legitimacy gate (human-verify)
Human reviewer confirmed all four runtime packages (papaparse, @types/papaparse, date-fns, @date-fns/tz) are legitimate against RESEARCH.md audit table and CLAUDE.md locked versions. Gate passed: "approved".

### Task 2: Install locked runtime deps + relax CSP for blob worker
- Installed papaparse@^5.5.3, date-fns@^4.3.0, @date-fns/tz@^1.5.0 to dependencies; @types/papaparse@^5 to devDependencies.
- Inserted `worker-src blob:` into CSP array between `connect-src 'none'` and `base-uri 'self'` (DATA-13). `connect-src 'none'` remains — exfiltration surface unchanged. Cited DATA-13 in a comment.
- Added one-liner `it("contains worker-src blob:")` to csp-plugin.test.ts matching the existing per-directive structure.
- Commit: de1423e

### Task 3: Domain type contract + parser registry (TDD)
RED commit (a735e8c) — failing registry tests for first-match, no-match-null, false-claim-excluded behaviors.

GREEN + implementation (5416d13):
- `src/domain/types.ts`: exports `IntervalSample` (UTC Date timestamp, non-negative gridImportKwh/gridExportKwh), `SeriesType`, `ParseFileResult` (with softWarnings, rowsContributed, rowsOverridden), `MergeResult` (gapCount, gapRanges, fileStats), `ParseRowError` (Dutch message strings), `UnsupportedEncodingError` (Dutch message). All symbols JSDoc'd with invariants. Named exports only; no browser globals.
- `src/domain/parsers/registry.ts`: exports `CsvParser` interface and `ParserRegistry` singleton with `register(parser)` and `claim(headers) → CsvParser | null` (first-match semantics). Singleton uses test-isolation sentinel pattern (`clearForTesting`).
- 4 registry tests green; `npx tsc --noEmit` exits 0.

### Task 4: DST fixtures + real HomeWizard P1 sample (checkpoint then continuation)
- Synthesized `homewizard-spring-2026-03-29.csv`: 93 rows (1 reference + 92 delta intervals); no `02:xx` timestamps (spring-forward skipped hour). Commit: 44bd5c0.
- Synthesized `homewizard-fall-2026-10-25.csv`: 101 rows (1 reference + 100 delta intervals); two distinct `02:00–02:45` blocks with monotonically increasing cumulative values. Commit: 44bd5c0.
- Real HomeWizard P1 export committed after human gate approved. Commit: 03bb509.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as designed.

### IMPORTANT: Real HomeWizard Sample Findings for Plan 02-02

The real HomeWizard P1 export (`tests/fixtures/homewizard-real-sample.csv`) differs from the synthesized fixtures in two significant ways that **plan 02-02's HomeWizard adapter must handle**:

**1. Daily granularity — NOT 15-minute intervals**
- Timestamps are `YYYY-MM-DD 00:00` (one row per day), not `HH:MM` 15-minute entries.
- The adapter must NOT assume 15-min spacing. It must detect `cadenceMinutes` from actual delta between consecutive timestamps.
- The synthesized DST fixtures remain valid for 15-min DST edge-case testing; the real sample confirms daily is also a valid cadence from this device.

**2. Three extra trailing columns beyond the 5 core columns**
- Synthesized fixture header: `time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh`
- Real sample header: `time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh,L1 max W,L2 max W,L3 max W`
- The HomeWizard adapter `claim()` and `transform()` must tolerate extra trailing columns and not fail or misparse when columns beyond index 4 are present.

These two findings must be addressed in plan 02-02 before the adapter is considered production-ready.

## Verification

- `npm test` — 23 tests pass (3 test files: shell.test.ts, csp-plugin.test.ts, registry.test.ts).
- `npx tsc --noEmit` — exits 0.
- `grep -c "worker-src blob:" src/constants/csp.ts` — returns 1.
- `grep -c "connect-src 'none'" src/constants/csp.ts` — returns 1.
- `grep -c "export interface IntervalSample" src/domain/types.ts` — returns 1.
- `grep -c "export class ParseRowError" src/domain/types.ts` — returns 1.
- `grep -c "export const ParserRegistry" src/domain/parsers/registry.ts` — returns 1.
- All three fixture files present under `tests/fixtures/`.

## Self-Check: PASSED

All claimed files present. All claimed commits verified. Test suite green. Type-check clean.
