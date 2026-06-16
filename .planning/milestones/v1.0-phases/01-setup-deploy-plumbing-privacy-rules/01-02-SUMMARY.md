---
phase: "01"
plan: "02"
subsystem: testing
tags: [vitest, csp, shell, jsdom, contract-tests, privacy]
dependency_graph:
  requires:
    - Plan 01-01 (src/constants/csp.ts CSP export, src/shell.ts renderShell function)
  provides:
    - tests/csp-plugin.test.ts — CSP directive contract lock (node env, 11 assertions)
    - tests/shell.test.ts — Shell DOM-contract lock (jsdom env, 7 assertions)
  affects:
    - Plan 03 (CI workflow runs these tests on every push as regression guard)
    - Phases 2-5 (inherit node-default / jsdom-per-file test pattern from D-09)
tech_stack:
  added: []
  patterns:
    - Node-env contract tests (no docblock — fast string assertions against pure TS exports)
    - jsdom per-file override via @vitest-environment docblock on line 1 (D-09)
    - renderShell() called into live jsdom DOM — not hand-authored markup in tests
key_files:
  created:
    - tests/csp-plugin.test.ts
    - tests/shell.test.ts
  modified: []
decisions:
  - "CSP test comment must not contain '@vitest-environment <word>' substring — vitest parses it as an environment directive"
  - "Shell test calls renderShell() rather than hand-writing markup — tests the source, not the test"
  - "beforeEach resets document.body.innerHTML to prevent cross-test DOM contamination"
metrics:
  duration: "1m 41s"
  completed_date: "2026-06-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 01 Plan 02: Contract-Locking Vitest Suite Summary

**One-liner:** CSP and shell DOM contracts locked via 18 passing Vitest assertions — node-env for directives, jsdom for DOM structure — with the D-09 test environment pattern established for Phases 2-5.

---

## What Was Built

### Task 1: CSP directive contract test (commit 0c3469c)

`tests/csp-plugin.test.ts` — 11 assertions in default node environment (no per-file override):
- 9 positive assertions: every required directive (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self'`, `font-src 'self'`, `connect-src 'none'`, `base-uri 'self'`, `form-action 'none'`, `frame-ancestors 'none'`)
- 2 negative assertions: `'unsafe-inline'` absent, `'unsafe-eval'` absent
- Imports `{ CSP }` from `../src/constants/csp` — no inlined directive strings
- Runs in ~190ms in node env (no jsdom overhead)

**Locks SETUP-05 / D-08:** Any future edit that weakens the policy fails CI.

### Task 2: Shell DOM-contract test (commit 9d14ac8)

`tests/shell.test.ts` — 7 assertions in jsdom environment (per-file override via first-line `// @vitest-environment jsdom` docblock):
- Imports `{ renderShell }` from `../src/shell`
- `beforeEach` resets `document.body.innerHTML` and calls `renderShell()` into the host
- Asserts `header[role="banner"]` not null
- Asserts `#drop-zone-region` not null
- Asserts `#results-region` not null
- Asserts `h1.textContent === 'Thuisbatterij Calculator'` (exact)
- Asserts `#drop-zone-region.textContent` contains verbatim privacy promise with U+2014 em dash
- Asserts `#results-region.getAttribute('aria-label') === 'Vergelijkingsresultaten'`
- Asserts `#results-region.textContent.trim()` does NOT contain privacy promise (D-02 bare)

**Locks PRIV-02 / D-01:** Removing a region, changing the title, or altering the privacy copy fails CI.

**Full suite:** `npx vitest run` — 2 test files, 18 tests, all passing, ~870ms total.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc comment triggered vitest environment parser**

- **Found during:** Task 1 (RED phase — test failed to load at all)
- **Issue:** The JSDoc block comment `* Runs in the DEFAULT node environment (no @vitest-environment docblock).` contained the substring `@vitest-environment docblock` which vitest parsed as a per-file environment directive, causing it to try to load `vitest-environment-docblock` as a package, resulting in "Failed to load url .../docblock" error.
- **Fix:** Rephrased the comment to `* Runs in the DEFAULT node environment (no per-file environment override).` — removed the `@vitest-environment` substring from the JSDoc.
- **Files modified:** `tests/csp-plugin.test.ts`
- **Impact:** No behavior change — the test still runs in node env. The lesson is that vitest scans ALL text in a file (including comments) for `@vitest-environment` annotations.

---

## Known Stubs

None. Both test files are complete contract-locking assertions with no placeholder behavior.

---

## Threat Flags

No new security surface introduced. Test files are dev-only artifacts (not shipped to the browser).

---

## Self-Check: PASSED

**Files verified:**

- [x] `tests/csp-plugin.test.ts` — exists, 57 lines, no `@vitest-environment` annotation
- [x] `tests/shell.test.ts` — exists, 69 lines, first line is `// @vitest-environment jsdom`

**Commits verified:**

- [x] 0c3469c — test(01-02): CSP directive contract lock (node env, D-08, SETUP-05)
- [x] 9d14ac8 — test(01-02): shell DOM-contract lock (jsdom env, D-08, PRIV-02, D-01)

**Suite verified:**

- [x] `npx vitest run` — 2 passed, 18 passed, 0 failed
