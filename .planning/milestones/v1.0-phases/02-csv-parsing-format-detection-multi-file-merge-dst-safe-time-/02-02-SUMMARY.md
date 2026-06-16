---
phase: 02-csv-parsing-format-detection-multi-file-merge-dst-safe-time
plan: "02"
subsystem: domain/parsing
tags: [csv, encoding, dst, parser-registry, papaparse, tzdate]
dependency_graph:
  requires: ["02-01"]
  provides: ["encoding.ts", "parsers/homewizard-p1.ts", "parsers/noop-stub.ts", "parse.ts"]
  affects: ["02-03", "02-04"]
tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN/REFACTOR per task"
    - "Self-registering parser with import side-effect and export {}"
    - "PapaParse worker:true with node-env graceful fallback"
    - "TZDate(Europe/Amsterdam) for DST-safe UTC conversion"
    - "UTF-8 fatal-mode TextDecoder then Windows-1252 fallback chain"
key_files:
  created:
    - src/domain/encoding.ts
    - src/domain/parsers/homewizard-p1.ts
    - src/domain/parsers/noop-stub.ts
    - src/domain/parse.ts
    - tests/encoding.test.ts
    - tests/homewizard-p1.test.ts
    - tests/parse-errors.test.ts
    - tests/dst-fixtures.test.ts
  modified: []
decisions:
  - "PapaParse worker:true used in production config; node env falls back silently"
  - "HomeWizard adapter tolerates YYYY-MM-DD HH:MM (15-min) and YYYY-MM-DD (daily) formats"
  - "Extra trailing columns (L1/L2/L3 max W) silently ignored by adapter"
  - "Windows-1252 test guarded with try/catch for slim-ICU Node builds"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-09"
  tasks_completed: 3
  files_created: 8
  tests_added: 64
---

# Phase 02 Plan 02: CSV Parsing Pipeline — encoding detection, HomeWizard P1 adapter, parseFile() orchestrator

**One-liner:** UTF-8/BOM + Windows-1252 encoding detection, HomeWizard P1 cumulative-to-delta adapter with TZDate DST-safe timestamps, and PapaParse worker:true orchestrator with fail-fast ParseRowError.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Encoding detection (UTF-8 to Windows-1252) | e207b64 | `src/domain/encoding.ts`, `tests/encoding.test.ts` |
| 2 | HomeWizard P1 adapter + noop stub | 29736c1 | `src/domain/parsers/homewizard-p1.ts`, `src/domain/parsers/noop-stub.ts`, `tests/homewizard-p1.test.ts` |
| 3 | parseFile() orchestrator + parse-error + DST fixture validation | 9f46153 | `src/domain/parse.ts`, `tests/parse-errors.test.ts`, `tests/dst-fixtures.test.ts` |

## What Was Built

### src/domain/encoding.ts
`decodeFileWithFallback(file: File)` reads the file as ArrayBuffer, tries TextDecoder utf-8 with fatal:true (auto-strips BOM), falls back to TextDecoder windows-1252, and throws UnsupportedEncodingError(file.name) if neither succeeds.

### src/domain/parsers/homewizard-p1.ts
HomeWizardP1Parser implementing CsvParser:
- claim(): requires all 5 required headers; tolerates extra trailing columns (L1/L2/L3 max W)
- transform(): parses timestamps via TZDate(Europe/Amsterdam) for both YYYY-MM-DD HH:MM and YYYY-MM-DD daily formats; normalises decimal commas; computes cumulative-to-delta from index 1; flags monotonicity failures (D-05); clamps to >= 0 (DATA-06)
- Self-registers via ParserRegistry.register() on import; ends with export {}

### src/domain/parsers/noop-stub.ts
Proves DATA-03: a second parser can be added with one new file + one import in parse.ts, zero changes to registry. claim() always returns false.

### src/domain/parse.ts
parseFile(file) orchestrator:
- Static side-effect imports for both parsers (one-file-change point, DATA-03)
- Calls decodeFileWithFallback() for encoding
- Papa.parse(text, { worker: true, ... }) — off-main-thread in browser (DATA-13); PapaParse falls back gracefully in Node test env
- Fail-fast on malformed PapaParse structural error (D-06)
- Rejects with "Onbekend bestandsformaat voor" if no adapter claims the headers
- Merges encoding into the adapter ParseFileResult

## Test Results

Full suite: 64 tests, 7 test files, 0 failures.

Key coverage:
- encoding.test.ts: UTF-8, BOM-stripped, Windows-1252 fallback, UnsupportedEncodingError
- homewizard-p1.test.ts: claim with/without extra columns, delta computation, T1+T2 summing, monotonicity, decimal comma, UTC timestamps, ParseRowError, noop stub isolation, daily cadence
- parse-errors.test.ts: ParseRowError fields, unknown format, valid CSV resolves
- dst-fixtures.test.ts: spring 2026-03-29 -> exactly 92 intervals; fall 2026-10-25 -> exactly 100 intervals; real 15-min fixture with L1/L2/L3 columns

## Deviations from Plan

### Auto-added

**1. [Rule 2 - Missing Critical Functionality] Daily timestamp format support**
- **Found during:** Task 2 — upstream finding from plan 02-01 noted real daily fixture with YYYY-MM-DD timestamps (no time portion)
- **Fix:** Extended parseLocalTimestamp to accept both YYYY-MM-DD HH:MM and YYYY-MM-DD formats; daily rows default to midnight Amsterdam time
- **Files modified:** src/domain/parsers/homewizard-p1.ts
- **Commit:** 29736c1

**2. [Rule 1 - Bug Fix] PapaParse worker:true graceful fallback in node**
- **Found during:** Task 3 — PapaParse worker:true requires blob-URL workers unavailable in Vitest node environment
- **Fix:** PapaParse falls back to synchronous mode when Worker is unavailable in node — no code change required. The worker:true literal is preserved for the browser path (DATA-13); tests work because PapaParse handles this internally
- **Files modified:** src/domain/parse.ts (comment added)
- **Commit:** 9f46153

## Known Stubs

None. The encoding: 'UTF-8' placeholder in the adapter transform return is intentional and documented — parseFile() overwrites it with the actual detected encoding before resolving.

## Threat Flags

No new network endpoints, auth paths, or trust boundaries introduced. Cells are only ever parseFloat'd or regex-matched (T-02-03, T-02-04 mitigated). connect-src 'none' CSP unchanged (T-02-06 mitigated).

## Self-Check

## Self-Check: PASSED

All 8 created files found on disk. All 3 implementation commits verified in git log. Full test suite: 64/64 tests passing. TypeScript: 0 errors.
