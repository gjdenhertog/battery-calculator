# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-16
**Phases:** 6 | **Plans:** 27 | **Tasks:** 46

### What Was Built
- A fully client-side, NL-only home-battery calculator deployed to GitHub Pages: upload P1/energy CSVs → pick catalog and/or multiple custom batteries → honest side-by-side kWh-avoided comparison, with charts and a transparent-assumptions panel. No data leaves the browser.
- Layered build: privacy/deploy shell (P1) → DST-safe CSV parsing + merge (P2) → pure fixture-locked simulator + catalog (P3) → reactive signals + Comlink workers + comparison table (P4) → uPlot charts + Dutch copy/terminology pass (P5) → multiple custom batteries + opt-in saldering toggle (P6).
- ~12,400 LOC TypeScript, 423 tests, maximal-lockdown CSP + CI privacy guard.

### What Worked
- **Bottom-up, fixture-locked layering.** Types/contracts and a pure simulator with hand-computed fixtures landed before any UI, so the differentiator (P4) sat on a proven core. Contract tests caught regressions cheaply.
- **Live human-verify at worker boundaries.** The worker-mock blind spot (Vitest mocks the Worker) was covered by deliberate live checks; Phase 6's blocking live verify transitively confirmed Phase 4's deferred UI items.
- **Wave-based parallel execution** for Phase 6 (disjoint files in Wave 2) with worktree isolation merged cleanly.

### What Was Inefficient
- **CI debt accumulated invisibly.** Phases 2–6 were built on local `main` and never pushed, so CI hadn't run since Phase 1. The milestone-ship deploy then failed three times in a row — ESLint unused-var errors, 52 prettier files, and a timezone-dependent test — because the local gates only ran build + test, not lint / format:check / TZ-pinned tests.
- **Deferred human-verification piled up.** Phase 1 (live deploy) and Phase 4 (UI behaviors) left `human_needed`/`partial` artifacts open until milestone close, where they had to be reconciled in bulk.

### Patterns Established
- **Run the full CI sequence locally before pushing:** `typecheck && build && lint && format:check && TZ=UTC test` (simulate the Ubuntu/UTC runner). Captured in memory `ci-gates-vs-local-gates`.
- **Pin test timezone for region-specific apps** (`TZ=Europe/Amsterdam`) so CI matches the production runtime.
- **Deferred-commit for expensive reactive work:** edit in a draft, recompute once on an explicit button — not per keystroke through a worker.

### Key Lessons
1. Green local `npm test` is necessary but not sufficient for a green deploy — replicate every CI gate locally, and push per phase so CI surfaces debt early instead of all at once.
2. Close human-verify artifacts as you go (or transitively, with evidence) — don't let `human_needed` states accumulate to the milestone boundary.
3. For NL/region-only apps, timezone-sensitive code (DST disambiguation) must either pin the runtime TZ or be made TZ-independent; document which.

### Cost Observations
- Model mix: orchestration on Opus; phase executors on Sonnet (per GSD config).
- Notable: the bulk of milestone-close effort went into reconciling un-pushed CI debt and deferred UAT — both avoidable with earlier pushes.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 27 | Established bottom-up fixture-locked layering + wave-based parallel execution; identified the need to run full CI locally and push per phase |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Discipline |
|-----------|-------|---------------------|
| v1.0 | 423 | Held — vanilla TS + small curated deps (signals-core, papaparse, date-fns/tz, uPlot, comlink); no framework, no analytics, no error-reporting |

### Top Lessons (Verified Across Milestones)

1. Replicate every CI gate locally and push incrementally — local build+test alone hides lint/format/TZ debt. *(v1.0)*
2. Cover worker/runtime boundaries with live verification; CI mocks hide round-trip and timezone bugs. *(v1.0)*
