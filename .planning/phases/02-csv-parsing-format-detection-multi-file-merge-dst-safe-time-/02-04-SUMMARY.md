---
phase: 02-csv-parsing-format-detection-multi-file-merge-dst-safe-time
plan: "04"
subsystem: ui
tags: [drop-zone, readout, drag-drop, papaparse-worker, xss-safe, data-01, data-11, data-13]
dependency_graph:
  requires: ["02-01", "02-02", "02-03"]
  provides: ["initDropZone", "renderReadout", "drop-zone-state-css"]
  affects: ["03-ui", "04-charts"]
tech_stack:
  added: []
  patterns:
    - "initDropZone mounts into existing #drop-zone-region (append, not replace) to preserve privacy promise"
    - "setState class-swap pattern — never el.style.* (CSP + maintainability)"
    - "All user-derived strings via .textContent — zero innerHTML for user data (XSS)"
    - "renderReadout returns a detached HTMLElement; caller owns insertion point"
    - "jsdom environment tests for DOM contract; live verification for worker threading"
key_files:
  created:
    - src/ui/readout.ts
    - src/ui/drop-zone.ts
    - src/styles/drop-zone.css
    - tests/readout.test.ts
    - tests/drop-zone.test.ts
  modified:
    - src/main.ts
decisions:
  - "Append-not-replace pattern for initDropZone: region already contains the privacy promise <p> injected by shell.ts; drop-zone controller appends the drop instruction and file-picker label rather than replacing region innerHTML — preserves PRIV-02 verbatim without re-reading shell state"
  - "renderReadout returns detached HTMLElement: caller (drop-zone controller) inserts/removes it; keeps the renderer pure and testable without document side effects"
  - "grep innerHTML === 0 gate on readout.ts and drop-zone.ts enforced: all user-derived strings (file names, row values) use .textContent per T-02-10 XSS mitigation"
metrics:
  duration_seconds: ~300
  completed_date: "2026-06-09"
  tasks_completed: 3
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 04: Drop-Zone UI + Sanity Readout Summary

**One-liner:** Drag-drop file picker wired through parse→merge to a DATA-11 sanity readout (six summary + per-file D-08 fields), with XSS-safe textContent rendering and PapaParse worker:true keeping the UI non-frozen on 50k-row files — human-verified live end-to-end.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Sanity readout renderer + drop-zone state CSS | `199f9f6` | `src/ui/readout.ts`, `src/styles/drop-zone.css`, `tests/readout.test.ts` |
| 2 | Drop-zone controller + main.ts wiring | `5bc4239` | `src/ui/drop-zone.ts`, `src/main.ts`, `tests/drop-zone.test.ts` |
| 3 | Live end-to-end verification (incl. DATA-13 no-freeze) | *(human-approved — no code commit)* | *(no files)* |

## What Was Built

### `src/ui/readout.ts`
`renderReadout(result: MergeResult): HTMLElement` — builds a `<section id="parse-readout" aria-label="Parseresultaten">` containing:
- Summary `<dl>` group: six DATA-11 fields (`Bestanden`, `Rijen`, `Periode`, `Totaal netafname`, `Totaal teruglevering`, `Ontbrekende intervallen`); gap count 0 renders as `Geen`.
- Per-file `<dl>` group repeated per file: D-08 fields (`Bestand`, `Resolutie`, `Type meting`, `Monotoon`, `Eerste interval`, `Rijen meegenomen`, `Rijen overschreven`, `Encoding`).
- Soft-warnings group rendered only when `softWarnings` are non-empty.
- nl-NL formatters: `toLocaleString('nl-NL')` for row counts, `toFixed(1) + ' kWh'` for energy, `toLocaleDateString('nl-NL')` for dates.
- All user-derived values (file names, raw cell values) via `.textContent` — zero `innerHTML` (T-02-10).
- Returns a detached element; does not mutate the document.

### `src/ui/drop-zone.ts`
`initDropZone(region: HTMLElement): void` — appends to the existing `#drop-zone-region` (does NOT replace, preserving the privacy promise paragraph):
- Drop-instruction `<p>` (`Sleep een of meer CSV-bestanden hierheen`) and always-visible `<label class="file-picker-label">` (`Of kies bestanden`) wrapping a hidden `<input type="file" multiple accept=".csv,text/csv">`.
- `setState(state)` swaps `drop-zone--idle/--dragover/--parsing/--success/--error` classes — never `el.style.*`.
- Native `dragenter/dragover/dragleave/drop` handlers: `preventDefault` on dragover, `aria-dropeffect="copy"` toggled.
- File-input `change` handler: shows `Bezig met verwerken...` status (aria-live polite), calls `parseFile()` per file, `mergeFiles()`, removes any prior `#parse-readout`, appends `renderReadout()` after the region, sets success state `{n} bestand(en) verwerkt.`.
- Error handling: `ParseRowError` → `<p class="parse-error" role="alert">` with DATA-09 fields (file/row/column/expected); `UnsupportedEncodingError` → unsupported-encoding message. Both use textContent.
- Region receives `aria-label="Bestanden uploaden"`.

### `src/styles/drop-zone.css`
State classes `.drop-zone--idle/--dragover/--parsing/--success/--error`, `.file-picker-input` (clip-path hidden, not display:none — keyboard accessible), `.file-picker-label` (44px touch target), `#parse-readout` + `.readout-divider` + dt/dd layout rules — all via existing tokens; no hardcoded colors except the single-use `rgb(37 99 235 / 0.08)` dragover tint; does not re-declare margin/padding/min-height/border-radius already set on `#drop-zone-region` in global.css.

### `src/main.ts` (modified)
Added `import './styles/drop-zone.css'` and `import { initDropZone } from './ui/drop-zone'`; preserves the existing `renderShell` double-render guard verbatim; mounts with `const dz = document.getElementById('drop-zone-region'); if (dz) initDropZone(dz)`.

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| `tests/readout.test.ts` | 41 (combined run) | DATA-11 six labels render; XSS: `<script>` file name inert; D-08 per-file fields; gap count zero → "Geen"; nl-NL formatters |
| `tests/drop-zone.test.ts` | — (part of 41) | `input[type=file][multiple]` present; privacy promise survives; `aria-label="Bestanden uploaden"`; dragover toggles class + aria-dropeffect |

Full suite after this plan: **128/128 tests green**. `tsc -b` + `vite build` clean.

## Task 3: Live End-to-End Verification (Human-Approved)

Task 3 was a `checkpoint:human-verify` gate covering functionality that automated jsdom tests cannot assess:

| Check | Result |
|-------|--------|
| Readout renders correct totals (file count, rows, period, import kWh, export kWh, gap count) matching meter within rounding | Approved |
| DATA-09 error fields shown (file name, row, column, expected format) — not a generic error message | Approved |
| DATA-13: 50k-row file does not freeze the UI; "Bezig met verwerken..." status shows during parse (PapaParse worker:true) | Approved |
| Zero network requests during parse (DevTools Network tab — privacy promise holds; connect-src 'none' unchanged) | Approved |

Human reviewer approved all five checks.

## Success Criteria Verification

- [x] **DATA-01**: Drag-drop target AND always-visible file-picker (`<input type="file" multiple>` never hidden via display:none); privacy promise preserved in place (append-not-replace).
- [x] **DATA-11**: Sanity readout shows all six summary fields + D-08 per-file detail; totals match within rounding (human-verified).
- [x] **DATA-13**: 50k-row file does not freeze the UI (worker:true); verified live by human.
- [x] **T-02-10**: `grep innerHTML === 0` on both `src/ui/readout.ts` and `src/ui/drop-zone.ts`; jsdom test asserts `<script>` file name renders inert.
- [x] **T-02-11**: UI non-frozen on large file — PapaParse `worker:true` + human DATA-13 verification.
- [x] **T-02-12**: Zero network requests during parse — human-verified on DevTools Network tab; `connect-src 'none'` from Plan 01 unchanged.
- [x] **D-03**: All UI strings are functional Dutch (unpolished).
- [x] **CSP**: No inline styles (`grep .style. === 0` on both UI files); all styling via CSS classes.

## Deviations from Plan

None — plan executed exactly as written. Task 3 was a human-verify gate and proceeded to approval without any fix-up code changes.

## Known Stubs

None. The readout renders real data from the parse→merge pipeline; all six DATA-11 fields and D-08 per-file fields are wired to live `MergeResult` data.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond what the plan's threat model already covers.

## Threat Model Compliance

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-02-10 (XSS via file name / cell value) | Mitigated — zero `innerHTML` in readout.ts and drop-zone.ts; jsdom test asserts `<script>` file name renders as inert text |
| T-02-11 (DoS: 50k-row UI freeze) | Mitigated — PapaParse `worker: true` from parse.ts; human-verified in Task 3 (DATA-13) |
| T-02-12 (CSV data exfiltration) | Mitigated — `connect-src 'none'` from Plan 01 unchanged; human-verified zero Network requests in Task 3 |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/ui/readout.ts exists | FOUND |
| src/ui/drop-zone.ts exists | FOUND |
| src/styles/drop-zone.css exists | FOUND |
| tests/readout.test.ts exists | FOUND |
| tests/drop-zone.test.ts exists | FOUND |
| src/main.ts modified | FOUND |
| Commit 199f9f6 exists | FOUND |
| Commit 5bc4239 exists | FOUND |
| npm test: 128/128 green | PASSED |
| npm run build: success | PASSED |
| grep innerHTML readout.ts === 0 | PASSED |
| grep .style. readout.ts === 0 | PASSED |
| grep .style. drop-zone.ts === 0 | PASSED |
