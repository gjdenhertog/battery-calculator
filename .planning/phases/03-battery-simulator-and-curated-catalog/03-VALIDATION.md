---
phase: 3
slug: battery-simulator-and-curated-catalog
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.7` (node environment — no jsdom, no browser globals) |
| **Config file** | `vitest.config.ts` (default `environment: 'node'`; includes `tests/**/*.test.ts` + `src/**/*.test.ts`) |
| **Quick run command** | `npx vitest run tests/simulate.test.ts` |
| **Full suite command** | `npm test` (`npx vitest run`) |
| **Estimated runtime** | ~5 seconds (pure arithmetic, no I/O) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/<relevant-new-file>.test.ts`
- **After every plan wave:** Run `npm test` (full suite — proves criterion 4: clean node env, all green)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Seeded from RESEARCH.md §Validation Architecture. The planner refines per-task IDs/waves; every row maps to an automated Vitest command (all unit, node env).

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| SIM-01 | Pure function, node env, no browser globals | unit | `npx vitest run tests/simulate.test.ts` | ❌ W0 | ⬜ pending |
| SIM-02 | Charge power clamp → 0.55 kWh (criterion 2) | unit | `npx vitest run tests/simulate.test.ts -t "power clamp"` | ❌ W0 | ⬜ pending |
| SIM-03 | sqrt(rte) symmetric, ~4.269 capacity-clamped (criterion 3) | unit | `npx vitest run tests/simulate.test.ts -t "round-trip"` | ❌ W0 | ⬜ pending |
| SIM-04 | soc never > nominal×dod (criteria 3 & 4) | unit | `npx vitest run tests/simulate.test.ts -t "DoD cap"` | ❌ W0 | ⬜ pending |
| SIM-05 | One-week + small-battery + multi-day-no-export fixtures | unit | `npx vitest run tests/simulate.test.ts` | ❌ W0 | ⬜ pending |
| SIM-06 | runComparison preserves input order, mixed catalog+custom | unit | `npx vitest run tests/compare.test.ts` | ❌ W0 | ⬜ pending |
| BATT-01..03 | Catalog loads ~6–8 entries, Sessy 5 first, datasheet URLs present | unit | `npx vitest run tests/catalog.test.ts` | ❌ W0 | ⬜ pending |
| BATT-04 | Custom config runs identically to a catalog entry | unit | `npx vitest run tests/simulate.test.ts -t "custom"` | ❌ W0 | ⬜ pending |
| D-04 | Daily-cadence run sets `coarseCadenceWarning` | unit | `npx vitest run tests/simulate.test.ts -t "coarse cadence"` | ❌ W0 | ⬜ pending |
| D-05 | First-sample / single-sample duration fallback | unit | `npx vitest run tests/simulate.test.ts -t "interval duration"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Note: BATT-05 (5-battery UI cap) is enforced in the Phase 4 UI; `runComparison` imposes no limit, so it has no Phase 3 verification row.

---

## Wave 0 Requirements

- [ ] `tests/simulate.test.ts` — covers SIM-01..05, BATT-04, D-04, D-05 (the bulk)
- [ ] `tests/compare.test.ts` — covers SIM-06 (order preservation, mixed catalog+custom)
- [ ] `tests/catalog.test.ts` — covers BATT-01..03 (entry shape, Sessy-first, every entry has all 5 physics fields + `datasheetUrl`)
- [ ] No framework install needed — Vitest node-env already configured (Phase 1/2).
- [ ] Optional: a tiny shared fixture builder `sample(utcMs, importKwh, exportKwh)` mirroring the helper in `tests/period-filter.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Datasheet spec accuracy vs. real vendor sources | BATT-01..03 | Spec values are real-world facts; correctness of a cited number against its datasheet URL cannot be asserted by code | Reviewer spot-checks each catalog entry's specs against its `datasheetUrl` during code review |

*All computational behaviors have automated verification; only external-fact accuracy is manual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test files authored in-plan, TDD RED-first in 03-02)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-09 (plan-checker VERIFICATION PASSED, Dimension 8)
