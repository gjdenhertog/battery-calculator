---
phase: 2
slug: csv-parsing-format-detection-multi-file-merge-dst-safe-time
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-08
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.7` |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test -- --coverage` |
| **Estimated runtime** | ~5–15 seconds (pure-node domain layer; jsdom only for drop-zone/readout) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (full suite — fast, pure node functions)
- **After every plan wave:** Run `npm run test -- --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| DATA-01 | Drop zone accepts files; file-picker always visible | DOM/jsdom | `npm test -- tests/drop-zone.test.ts` | ❌ W0 |
| DATA-02 | HomeWizard P1 file produces `IntervalSample[]` with non-negative values | unit (node) | `npm test -- tests/homewizard-p1.test.ts` | ❌ W0 |
| DATA-03 | Noop second parser registered without editing central switch | unit (node) | `npm test -- tests/registry.test.ts` | ❌ W0 |
| DATA-04 | UTF-8 + BOM parses correctly; `;` delimiter + decimal comma auto-handled | unit (node) | `npm test -- tests/encoding.test.ts` | ❌ W0 |
| DATA-05 | Cumulative series classified; monotonicity failure detected; first-interval flagged | unit (node) | `npm test -- tests/homewizard-p1.test.ts` | ❌ W0 |
| DATA-06 | `gridImportKwh >= 0` and `gridExportKwh >= 0` invariant on all samples | unit (node) | `npm test -- tests/homewizard-p1.test.ts` | ❌ W0 |
| DATA-07 | Timestamps are UTC `Date` instances; not local TZ | unit (node) | `npm test -- tests/homewizard-p1.test.ts` | ❌ W0 |
| DATA-08 | 2026-03-29 fixture: exactly 92 intervals; 2026-10-25 fixture: exactly 100 | unit (node) | `npm test -- tests/dst-fixtures.test.ts` | ❌ W0 |
| DATA-09 | Malformed row produces `ParseRowError` with file/row/col/expected | unit (node) | `npm test -- tests/parse-errors.test.ts` | ❌ W0 |
| DATA-10 | Overlapping files: finer cadence wins; coarser overridden | unit (node) | `npm test -- tests/merge.test.ts` | ❌ W0 |
| DATA-11 | Sanity readout DOM: all 6 required fields present after parse | DOM/jsdom | `npm test -- tests/readout.test.ts` | ❌ W0 |
| DATA-12 | `filterByPeriod` narrows; defaults to full range | unit (node) | `npm test -- tests/period-filter.test.ts` | ❌ W0 |
| DATA-13 | Large file (50k+) does not freeze UI — PapaParse `worker: true` active | manual-only | Manual browser test — 50k+ row CSV | N/A |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — all currently ⬜ pending*

---

## Wave 0 Requirements

- [ ] `tests/homewizard-p1.test.ts` — covers DATA-02, DATA-05, DATA-06, DATA-07
- [ ] `tests/registry.test.ts` — covers DATA-03 (registry + noop second-parser stub)
- [ ] `tests/encoding.test.ts` — covers DATA-04, D-07 (UTF-8 BOM, Windows-1252 fallback, `;` delimiter, decimal comma)
- [ ] `tests/dst-fixtures.test.ts` — covers DATA-08 (requires DST fixture CSVs)
- [ ] `tests/parse-errors.test.ts` — covers DATA-09 (fail-fast malformed row)
- [ ] `tests/merge.test.ts` — covers DATA-10 (finer-wins merge)
- [ ] `tests/drop-zone.test.ts` — covers DATA-01 (jsdom; `// @vitest-environment jsdom` docblock required)
- [ ] `tests/readout.test.ts` — covers DATA-11 (jsdom)
- [ ] `tests/period-filter.test.ts` — covers DATA-12
- [ ] `tests/fixtures/` — DST fixture CSV files for DATA-08 (2026-03-29 spring-forward day → 92 intervals, 2026-10-25 fall-back day → 100 intervals)
- [ ] `tests/fixtures/` — HomeWizard P1 real sample CSV (**gated on project owner providing file**; adapter skeleton can be coded from documented spec, but DST fixture validation needs a real crossing-DST file)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 50k+ row file does not freeze UI | DATA-13 | Worker threading / UI-responsiveness cannot be asserted deterministically in Vitest | Load app, drop a 50k+ row CSV, confirm UI stays interactive during parse and a progress signal appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
