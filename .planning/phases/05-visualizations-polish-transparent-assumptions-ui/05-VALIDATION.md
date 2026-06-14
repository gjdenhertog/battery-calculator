---
phase: 05
slug: visualizations-polish-transparent-assumptions-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 05-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.7` |
| **Config file** | `vitest.config.ts` — default env: `node`; per-file jsdom via `// @vitest-environment jsdom` |
| **Quick run command** | `npm test -- --reporter=dot` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=dot` (fast, all tests)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; this map is keyed by requirement until PLAN.md exists.
> Pure helpers run in node-env Vitest; DOM/chart mount tests use jsdom (`// @vitest-environment jsdom`).

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| VIZ-01 | `bucketByMonth()` returns correct MonthBucket[] with isPartial flags | unit | `npm test -- bucket-by-month` | ❌ W0 | ⬜ pending |
| VIZ-01 | `bucketByMonth()` handles DST month boundary (Mar/Oct) | unit | `npm test -- bucket-by-month` | ❌ W0 | ⬜ pending |
| VIZ-01 | `bucketByMonth()` sparse case (<2 full months) returns all-partial array | unit | `npm test -- bucket-by-month` | ❌ W0 | ⬜ pending |
| VIZ-01 | Monthly bars axis ticks render via formatAxisKwh (no raw float in DOM) | unit (jsdom) | `npm test -- monthly-bars` | ❌ W0 | ⬜ pending |
| VIZ-02 | `selectRepresentativeWeek()` returns week with highest sum of residualExportKwh | unit | `npm test -- select-representative-week` | ❌ W0 | ⬜ pending |
| VIZ-02 | `selectRepresentativeWeek()` tie-breaks to first week | unit | `npm test -- select-representative-week` | ❌ W0 | ⬜ pending |
| VIZ-02 | `selectRepresentativeWeek()` handles dataset < 7 days (single span) | unit | `npm test -- select-representative-week` | ❌ W0 | ⬜ pending |
| VIZ-03 | Flow chart uses stepped path (not smooth): uPlot config inspection | unit (jsdom) | `npm test -- flow-chart` | ❌ W0 | ⬜ pending |
| VIZ-04 | `formatAxisKwh(3.14159)` returns `"3.1"` (1 decimal) | unit | `npm test -- format` | ❌ (extend) | ⬜ pending |
| UX-01 | `<details>` panel renders with correct aria-label + summary text | unit (jsdom) | `npm test -- transparency-panel` | ❌ W0 | ⬜ pending |
| UX-02 | "Waarom geen euro's?" heading present inside the panel | unit (jsdom) | `npm test -- transparency-panel` | ❌ W0 | ⬜ pending |
| UX-03 | `.term-tooltip` span has tabindex="0" + data-tooltip attribute | unit (jsdom) | `npm test -- tooltips` | ❌ W0 | ⬜ pending |
| UX-04 | Charts do not overflow viewport at 375px | manual visual | — | manual | ⬜ pending |
| UX-05 | `src/` grep: zero occurrences of banned terminology | CI grep | `npm test -- terminology-audit` | ❌ W0 | ⬜ pending |
| UX-06 | `src/` grep: no email/CTA/offerte patterns | CI grep | `npm test -- terminology-audit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install uplot@^1.6.32` — install the one new runtime dep (no test framework changes needed)
- [ ] `tests/bucket-by-month.test.ts` — VIZ-01 (full month, partial month, DST crossing, sparse)
- [ ] `tests/select-representative-week.test.ts` — VIZ-02 (best week, tie-break, short dataset)
- [ ] `tests/terminology-audit.test.ts` — UX-05 + UX-06 (combined CI grep file)
- [ ] `tests/transparency-panel.test.ts` — UX-01 + UX-02 (jsdom)
- [ ] `tests/tooltips.test.ts` — UX-03 basics (jsdom)
- [ ] `tests/monthly-bars.test.ts` — VIZ-01 DOM + VIZ-04 (jsdom)
- [ ] `tests/flow-chart.test.ts` — VIZ-02/03 + dropdown (jsdom)
- [ ] Extend `tests/format.test.ts` — add `formatAxisKwh` tests (VIZ-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Results layout readable at 375px, no horizontal scroll for headline numbers | UX-04 | Visual reflow / no-overflow is a rendered-layout property; jsdom has no layout engine | Open dev build, DevTools device toolbar @375px, confirm headline numbers do not overflow and charts stay within their container |
| Charts visually render step lines (not curves) and bar colors match table | VIZ-02/03, VIZ-01 | Canvas pixel output not assertable in jsdom | Load app with sample CSV, eyeball flow chart steps + per-battery bar colors vs comparison table |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
