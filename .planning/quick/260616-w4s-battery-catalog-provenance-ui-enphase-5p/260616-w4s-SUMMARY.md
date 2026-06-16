---
phase: quick-260616-w4s
plan: 01
subsystem: battery-catalog, battery-picker-ui
tags: [catalog, provenance, ui, xss-safety, csp, enphase]
dependency_graph:
  requires: []
  provides:
    - "assumedFields on BatteryConfig (optional, machine-readable provenance)"
    - "8-entry BATTERY_CATALOG with Enphase IQ Battery 5P"
    - "geschat badge in battery picker (assumed spec rows)"
    - "Datasheet link per catalog card"
  affects:
    - src/domain/types.ts
    - src/domain/battery-catalog.ts
    - src/ui/battery-picker.ts
    - src/styles/battery-picker.css
tech_stack:
  added: []
  patterns:
    - "createElement + setAttribute + textContent for XSS/CSP-safe anchor rendering"
    - "assumedFields Set lookup at render time for zero-overhead badge gating"
key_files:
  created: []
  modified:
    - src/domain/types.ts
    - src/domain/battery-catalog.ts
    - src/ui/battery-picker.ts
    - src/styles/battery-picker.css
    - tests/catalog.test.ts
    - tests/battery-picker.test.ts
decisions:
  - "assumedFields is optional so all existing test fixtures and custom-battery builder typecheck unchanged"
  - "Badge appended inside dt via textContent (static 'geschat' string) — no innerHTML, CSP-safe"
  - "Datasheet link built via createElement + setAttribute(href/target/rel) — no innerHTML, no tabnapping"
  - "CSS uses only existing design tokens — no new tokens, no inline styles"
metrics:
  duration_minutes: 4
  completed_date: "2026-06-16"
  tasks_completed: 3
  files_changed: 6
---

# Quick Task 260616-w4s: Battery Catalog Provenance UI + Enphase 5P — Summary

**One-liner:** Added machine-readable assumedFields provenance to all 8 catalog entries (incl. new Enphase IQ Battery 5P), rendered as a Dutch "geschat" badge per spec row and a "Datasheet" link per card, XSS/CSP-safe throughout.

## What Was Built

### Task 1 — assumedFields on BatteryConfig + 8-entry catalog

- `src/domain/types.ts`: Added optional `assumedFields?: ReadonlyArray<'nominalCapacityKwh' | 'dodFraction' | 'roundTripEfficiency' | 'maxChargeKw' | 'maxDischargeKw'>` to `BatteryConfig`. Optional so all existing test fixtures and the custom-battery builder stay valid with zero changes.
- `src/domain/battery-catalog.ts`: Added `assumedFields: [...]` to all 7 existing entries (sessy-5 and powerwall-3 get `[]`; others populated per RESEARCH.md map). Appended new `enphase-5p` entry with datasheet-verified specs (DSH-00857-1.0): nominalCapacityKwh 5.0, dodFraction 1.0, roundTripEfficiency 0.9, maxChargeKw 3.2, maxDischargeKw 3.2, assumedFields `['maxChargeKw']`. Sessy 5 remains at index 0.
- `tests/catalog.test.ts`: Added shape lock (every assumedFields member is a valid key), Enphase entry assertions (id, name, specs, datasheetUrl), assumedFields deep-equal `['maxChargeKw']`, and a hard count assertion (`BATTERY_CATALOG.length === 8`).

### Task 2 — geschat badge + Datasheet link in battery picker

- `src/ui/battery-picker.ts`: Extended `appendSpec` with optional `isAssumed` param (default false). When true, appends `<span class="battery-card__badge">geschat</span>` (textContent, no innerHTML) with `title="geschatte waarde"` and `aria-label="geschatte waarde"`. `buildSpecCard` computes `const assumed = new Set(battery.assumedFields ?? [])` once and passes `assumed.has(fieldKey)` to each appendSpec call. After the spec dl, a datasheet `<a>` is built with `createElement` + `setAttribute(href, target, rel)` + `textContent = '📄 Datasheet'` — no innerHTML anywhere (T-w4s-01, T-w4s-03).
- `src/styles/battery-picker.css`: Added `.battery-card__badge` (inline-block pill using existing tokens) and `.battery-card__datasheet` (accent inline-flex link with `:hover` underline and `:focus-visible` ring). No inline styles, no new tokens.
- `tests/battery-picker.test.ts`: Added tests: victron-ess-10 has 4 badges on its 4 assumed rows; Capaciteit dt has no badge (cited); sessy-5 has 0 badges; enphase-5p has exactly 1 badge inside the "Max laden" dt; every catalog card has `.battery-card__datasheet` with correct href/target/rel; picker subtree has 0 `<script>` elements; no inline styles after badge + link rendering. Updated card-count test descriptions from "7" to "8".

### Task 3 — Full CI + privacy guard (verification, no code changes)

- `npm run typecheck` — clean
- `npm run build` — clean (134.85 kB JS, 19.25 kB CSS)
- `npm run lint` — clean
- `npm run format:check` — clean
- `TZ=Europe/Amsterdam npm test` — 436 tests, 30 test files, all green
- Privacy guard grep against fresh dist/ — PASS (Enphase URL in bundled JS, never in static index.html; guard is unchanged)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b959acb | feat(260616-w4s-01): add assumedFields to BatteryConfig + populate 8 catalog entries incl. Enphase 5P |
| 2 | 127b721 | feat(260616-w4s-01): render geschat badge per assumed spec row + Datasheet link per card |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-external-nav | src/ui/battery-picker.ts | New `<a target="_blank" rel="noopener noreferrer">` link per catalog card — user-initiated navigation to vendor domain. Not an auto-fetch (no connect-src violation). rel=noopener noreferrer mitigates reverse tabnapping (T-w4s-03). Addressed by the plan's threat model. |

## Known Stubs

None.

## Self-Check: PASSED

- Modified files exist: types.ts, battery-catalog.ts, battery-picker.ts, battery-picker.css, catalog.test.ts, battery-picker.test.ts — all FOUND
- Commits exist: b959acb and 127b721 — FOUND
- typecheck: PASSED
- build: PASSED
- lint: PASSED
- format:check: PASSED
- Full test suite (436 tests, 30 files): PASSED
- Privacy guard: PASSED
