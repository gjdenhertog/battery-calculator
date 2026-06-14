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
| VIZ-01 | `bucketByMonth()` returns correct MonthBucket[] with isPartial flags | unit | `npm test -- bucket-by-month` | ❌ W1/P01 | ⬜ pending |
| VIZ-01 | `bucketByMonth()` handles DST month boundary (Mar/Oct) | unit | `npm test -- bucket-by-month` | ❌ W1/P01 | ⬜ pending |
| VIZ-01 | `bucketByMonth()` sparse case (<2 full months) returns all-partial array | unit | `npm test -- bucket-by-month` | ❌ W1/P01 | ⬜ pending |
| VIZ-01 | Monthly bars axis ticks render via formatAxisKwh (no raw float in DOM) | unit (jsdom) | `npm test -- monthly-bars` | ❌ W2/P03 | ⬜ pending |
| VIZ-02 | `selectRepresentativeWeek()` returns week with highest sum of residualExportKwh | unit | `npm test -- select-representative-week` | ❌ W1/P01 | ⬜ pending |
| VIZ-02 | `selectRepresentativeWeek()` tie-breaks to first week | unit | `npm test -- select-representative-week` | ❌ W1/P01 | ⬜ pending |
| VIZ-02 | `selectRepresentativeWeek()` handles dataset < 7 days (single span) | unit | `npm test -- select-representative-week` | ❌ W1/P01 | ⬜ pending |
| VIZ-03 | Flow chart uses stepped path (not smooth): uPlot config inspection | unit (jsdom) | `npm test -- flow-chart` | ❌ W2/P03 | ⬜ pending |
| VIZ-04 | `formatAxisKwh(3.14159)` returns `"3.1"` (1 decimal) | unit | `npm test -- format` | ❌ extend, W1/P01 | ⬜ pending |
| UX-01 | `<details>` panel renders with correct aria-label + summary text | unit (jsdom) | `npm test -- transparency-panel` | ❌ W2/P04 | ⬜ pending |
| UX-02 | "Waarom geen euro's?" heading present inside the panel | unit (jsdom) | `npm test -- transparency-panel` | ❌ W2/P04 | ⬜ pending |
| UX-03 | `.term-tooltip` span has tabindex="0" + data-tooltip attribute | unit (jsdom) | `npm test -- tooltips` | ❌ W2/P04 | ⬜ pending |
| UX-04 | Charts do not overflow viewport at 375px | manual visual | — | manual | ⬜ pending |
| UX-05 | `src/` grep: zero occurrences of banned terminology | CI grep | `npm test -- terminology-audit` | ❌ W1/P02 | ⬜ pending |
| UX-06 | `src/` grep: no email/CTA/offerte patterns | CI grep | `npm test -- terminology-audit` | ❌ W1/P02 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists column: W1/P01 = created in Wave 1, Plan 01; W2/P03 = created in Wave 2, Plan 03; etc.*

---

## Wave 0 Requirements (pre-execution)

> Wave 0 is the pre-execution gate: it installs the one new runtime dependency only.
> All test files are created inside their owning plans, NOT pre-stubbed in Wave 0:
> - The node-env pure-helper + audit tests are Wave 1 deliverables (Plan 01 / Plan 02).
> - The jsdom DOM-adapter tests are Wave 2 deliverables (Plan 03 / Plan 04), created alongside the adapters/components they cover — they are NOT Wave 0 pre-stubs (a jsdom mount test cannot exist before its adapter does).

- [ ] `npm install uplot@^1.6.32` — install the one new runtime dep (no test framework changes needed)

### Wave 1 test files (created in their owning plans, node-env)

- [ ] `tests/bucket-by-month.test.ts` — VIZ-01 (full month, partial month, DST crossing, sparse) — Plan 01
- [ ] `tests/select-representative-week.test.ts` — VIZ-02 (best week, tie-break, short dataset) — Plan 01
- [ ] Extend `tests/format.test.ts` — add `formatAxisKwh` tests (VIZ-04) — Plan 01
- [ ] `tests/terminology-audit.test.ts` — UX-05 + UX-06 (combined CI grep file) — Plan 02

### Wave 2 test files (created alongside their adapters/components, jsdom — NOT Wave 0)

- [ ] `tests/monthly-bars.test.ts` — VIZ-01 DOM + VIZ-04 (jsdom) — Plan 03, with `src/ui/charts/monthly-bars.ts`
- [ ] `tests/flow-chart.test.ts` — VIZ-02/03 + dropdown (jsdom) — Plan 03, with `src/ui/charts/flow-chart.ts`
- [ ] `tests/transparency-panel.test.ts` — UX-01 + UX-02 (jsdom) — Plan 04, with `src/ui/transparency-panel.ts`
- [ ] `tests/tooltips.test.ts` — UX-03 basics (jsdom) — Plan 04, with `src/ui/tooltips.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Results layout readable at 375px, no horizontal scroll for headline numbers | UX-04 | Visual reflow / no-overflow is a rendered-layout property; jsdom has no layout engine | Open dev build, DevTools device toolbar @375px, confirm headline numbers do not overflow and charts stay within their container |
| Charts visually render step lines (not curves) and bar colors match table | VIZ-02/03, VIZ-01 | Canvas pixel output not assertable in jsdom | Load app with sample CSV, eyeball flow chart steps + per-battery grouped bar colors vs comparison table |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Wave 0 = install only; test files owned by their plans)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
