# Phase 2: CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 2-CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series
**Areas discussed:** Phase-2 UI surface, Gap detection & handling, Bad-data & encoding policy, Sanity readout honesty

---

## Phase-2 UI surface

### Q1 — How much user-facing UI should Phase 2 actually ship?

| Option | Description | Selected |
|--------|-------------|----------|
| Real minimal drop-zone + readout | Working drag-drop + file-picker replaces the Phase 1 mount point, parses on drop, renders a live sanity readout. Matches criteria 1 & 3 literally. | ✓ |
| Pure data layer, dev-only harness | Functions + CI fixtures only; Phase 1 shell stays bare; real dropzone deferred to Phase 4. | |
| Real drop-zone, readout as plain console/DOM dump | Working drop-zone but unstyled raw text dump. | |

**User's choice:** Real minimal drop-zone + readout
**Notes:** Resolves the roadmap-goal tension ("before any UI exists" vs. "user sees a readout") toward a minimal, real, replaceable UI. Phase 4 re-wires the region with signals/workers/comparison.

### Q2 — Sub-period filter (DATA-12) scope in Phase 2?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure function only | `filterByPeriod()` + default-to-full-range, no date control this phase. Criterion 5 unit-tested. | ✓ |
| Function + minimal date inputs | Also add native date controls wired to re-filter live. | |

**User's choice:** Pure function only
**Notes:** Interactive control lands in Phase 4 with reactive state.

### Q3 — Language/polish level for the minimal readout UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Functional Dutch, unpolished | Plain Dutch labels; tone/tooltips/terminology audit deferred to Phase 5. | ✓ |
| English placeholder labels | Quick English now, Phase 5 translates. | |

**User's choice:** Functional Dutch, unpolished
**Notes:** Avoids shipping English that Phase 5's terminology grep must clean up.

---

## Gap detection & handling

### Q1 — How to DEFINE a gap?

| Option | Description | Selected |
|--------|-------------|----------|
| Missing expected interval at detected cadence | Infer dominant cadence, any empty slot between first/last = gap; DST-aware. | ✓ |
| Time-delta threshold | Flag pairs exceeding N× median interval. | |
| Both: stretches + estimated missing-interval count | Report stretches AND estimated missing count. | |

**User's choice:** Missing expected interval at detected cadence
**Notes:** DST missing/repeated hour explicitly not counted as a gap.

### Q2 — What to DO with detected gaps?

| Option | Description | Selected |
|--------|-------------|----------|
| Flag-only, pass data through untouched | Count + surface gaps; never fabricate data. | ✓ |
| Flag + fill with zero-energy intervals | Insert placeholder samples for dense series. | |
| Flag + block if gaps exceed a threshold | Warn and refuse past some gap fraction. | |

**User's choice:** Flag-only, pass data through untouched
**Notes:** Most honest; simulator (Phase 3) sees true data only; no hard block.

---

## Bad-data & encoding policy

### Q1 — Malformed row mid-file?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-fast with specific error | Abort file's parse, surface DATA-09 error (file/row/column/expected). | ✓ |
| Skip-and-report bad rows | Drop unparseable rows, report count + locations. | |
| Skip below a threshold, else fail | Tolerate up to X% bad rows. | |

**User's choice:** Fail-fast with specific error
**Notes:** Data integrity treated as sacred; no silent partial results.

### Q2 — Non-UTF-8 file encoding?

| Option | Description | Selected |
|--------|-------------|----------|
| Attempt Windows-1252 fallback | UTF-8 first; on failure retry Windows-1252; note encoding used. | ✓ |
| Fail loudly, UTF-8 only | Reject non-UTF-8 with a specific re-export error. | |

**User's choice:** Attempt Windows-1252 fallback
**Notes:** Resolves the encoding-fallback decision deferred from Phase 1. Asymmetric with Q1 by design: structural integrity is non-negotiable, recoverable decode issues should "just work".

---

## Sanity readout honesty

### Q1 — Which extra trust signals beyond the six required DATA-11 fields? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Detected resolution per file | Show 15-min / hourly; makes finer-wins merge visible. | ✓ |
| Declared series_type + monotonicity result | Cumulative vs interval + monotonicity check. | ✓ |
| First-interval anomaly flag | Surface DATA-05 anomaly flag when it fires. | ✓ |
| Per-file row range in merge | Samples contributed vs. overridden per file. | ✓ |

**User's choice:** All four
**Notes:** The readout is the phase's honesty surface — make merge rule, classification, and anomalies visible.

### Q2 — Suspicious-but-parseable values?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft warnings, never block | "Looks unusual" notes without altering data or stopping. | ✓ |
| No value-plausibility checks in v1 | Report only structural facts. | |
| Warn + let user exclude flagged intervals | Surface warnings AND offer interval exclusion. | |

**User's choice:** Soft warnings, never block
**Notes:** Consistent with the non-blocking, never-fabricate stance from gap handling.

---

## Claude's Discretion

- `IntervalSample` field shape beyond the locked contract.
- Parser-registry mechanics (header-sniffing claim strategy, registry data structure, noop second-parser stub).
- Worker boundary beyond the required PapaParse `worker: true` (whether post-parse transform also runs off-thread).
- Cadence-detection algorithm and D-09 plausibility thresholds.
- Minimal drop-zone styling (reuse Phase 1 design tokens).

## Deferred Ideas

- Interactive period-filter control (date pickers) → Phase 4.
- Additional NL parser formats beyond HomeWizard P1 → added one-file-at-a-time as samples are collected.
- Full Dutch copy / tone / tooltips / terminology audit → Phase 5.
- User-driven exclusion of flagged intervals → considered, deferred (keeps Phase 2 UI state minimal).
