---
phase: 04
slug: comparison-engine-comparison-table-saldering-side-by-side-wo
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-11
validated: 2026-06-13
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x |
| **Config file** | vite.config.ts / vitest config (existing) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && npm run build` |
| **Estimated runtime** | ~10 seconds (unit) + build |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run && npm run build`
- **Before `/gsd:verify-work`:** Full suite + production `vite build` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | SIM-07 | T-04-01..03,SC | CSP worker-src 'self' blob:; connect-src 'none' preserved | unit (node) | `npm test -- --run tests/csp-plugin.test.ts` | ✅ exists (12) | ✅ green |
| 04-01-T2 | 04-01 | 1 | SIM-07 | T-04-01 | Pure runComparison importable without worker; build emits chunk | smoke + build | `npm test -- --run tests/sim-worker-contract.test.ts && npm run build` | ✅ exists (3) | ✅ green |
| 04-02-T1 | 04-02 | 1 | COMP-04 | T-04-04 | Selection-order color slots; 1-decimal formatters | unit (node) | `npm test -- --run tests/color.test.ts tests/format.test.ts` | ✅ exists (13+14) | ✅ green |
| 04-02-T2 | 04-02 | 1 | COMP-01,03,05 | T-04-04 | Saldering ON un-floored negative (D-02); detectLeaders min/max | unit (node) | `npm test -- --run tests/metrics.test.ts` | ✅ exists (26) | ✅ green |
| 04-03-T1 | 04-03 | 2 | SIM-07,08 | T-04-07,08,09 | Worker singleton; generation guard; computeds | unit (node) | `npm test -- --run tests/app-state.test.ts` | ✅ exists (23) | ✅ green |
| 04-03-T2 | 04-03 | 2 | DATA-12 | T-04-06 | Drop-zone writes parsedSamples + period defaults; no regression | unit + build | `npm test -- --run tests/app-state.test.ts tests/drop-zone.test.ts && npm run build` | ✅ exists (23+16) | ✅ green |
| 04-04-T1 | 04-04 | 3 | COMP-04 | T-04-10,12 | Sessy 5 default; max-5 cap; custom validate; XSS textContent | DOM (jsdom) | `npm test -- --run tests/battery-picker.test.ts` | ✅ exists (16) | ✅ green |
| 04-04-T2 | 04-04 | 3 | COMP-04 | T-04-11 | 5 swatch slots via classes; no inline style; 44px targets | build + grep | `npm run build` | ✅ exists | ✅ green |
| 04-05-T1 | 04-05 | 3 | COMP-01,02,03,05,06,07,SIM-08 | T-04-13..16 | OFF-led pair; leaders; un-floored negative ON; disclaimer; no /jaar; banner; XSS | DOM (jsdom) | `npm test -- --run tests/comparison-table.test.ts` | ✅ exists (18) | ✅ green |
| 04-05-T2 | 04-05 | 3 | COMP-08,DATA-12 | T-04-16 | Full-range date defaults; live coverage; date-driven recompute | DOM (jsdom) | `npm test -- --run tests/period-control.test.ts && npm run build` | ✅ exists (12) | ✅ green |
| 04-06-T1 | 04-06 | 4 | SIM-07,08,COMP-04 | T-04-18 | main.ts wiring; worker chunk under dist/assets/; full suite | build + suite | `npm run build && ls dist/assets | grep -iE worker && npm test -- --run` | ✅ verified (290) | ✅ green |
| 04-06-T2 | 04-06 | 4 | SIM-08,COMP-04,08 | T-04-17,19 | Live: zero CSP/network; interactive compute; color consistency | human-verify | manual (preview) | n/a | ✅ approved (human-verify) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Audit (2026-06-13):** All 10 Phase 4 automated test files present and green — 153 tests across the phase files (290 in the full suite); production build exits 0 and emits `sim-worker-DazZ4rAZ.js` under `dist/assets/`. The render-race regression found at the human-verify checkpoint added 2 tests to `comparison-table.test.ts` locking the length-mismatch guard. 04-06-T2's live checks were approved at the execution checkpoint (recorded in 04-06-SUMMARY.md); the 3 post-fix browser re-checks remain tracked in 04-HUMAN-UAT.md (accepted on regression-test strength).

---

## Wave 0 Requirements

- [x] `npm install comlink @preact/signals-core` — added to package.json (`comlink ^4.4.2`, `@preact/signals-core ^1.14.2`)
- [x] Production `vite build` emits Comlink worker chunk under `assets/` (`sim-worker-DazZ4rAZ.js`) — gates passed for all later waves
- [x] CSP `worker-src 'self' blob:` verified against the production worker chunk URL (csp-plugin.test.ts + dist/index.html injection)

*Pure-function domain modules (compare/saldering/colorFor) are imported directly in Vitest — no worker in tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI stays interactive while worker computes (no dropped frames >200ms) | SIM-07 | Frame timing during real worker run is not unit-testable | Drag a slider / toggle batteries while a large CSV simulates; observe "Rekenen…" indicator + responsive controls |
| Per-battery color preserved into Phase 5 charts | COMP-08 | Visual cross-phase continuity | Manual visual check; `colorFor(batteryId)` covered by unit test |

*All other phase behaviors have automated verification.*

---

## Validation Audit 2026-06-13

| Metric | Count |
|--------|-------|
| Requirements/tasks audited | 12 |
| COVERED (automated, green) | 11 |
| Manual-only (documented, accepted) | 1 (04-06-T2 live human-verify) + 2 register items (SIM-08 frame timing, COMP-08 cross-phase color) |
| MISSING / gaps | 0 |

No MISSING gaps — all plan-time test-file references exist and run green. No nyquist-auditor run required.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are the 2 documented human-only checks (SIM-08 interactivity, COMP-08 color)
- [x] Sampling continuity: every task except the final human-verify checkpoint has an automated command
- [x] Wave 0 (plans 04-01/04-02) covers all MISSING test-file references before UI waves
- [x] No watch-mode flags (all use --run)
- [x] Feedback latency < 30s (unit ~10s + build)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] All automated tasks verified green (153 phase tests / 290 full suite) on 2026-06-13

**Approval:** verified 2026-06-13
