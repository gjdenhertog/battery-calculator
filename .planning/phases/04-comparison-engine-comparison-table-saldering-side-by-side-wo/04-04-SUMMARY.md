---
phase: 04-comparison-engine-comparison-table-saldering-side-by-side-wo
plan: "04"
subsystem: battery-picker
tags: [ui, signals, xss-safe, css-tokens, wcag, jsdom, battery-picker]
dependency_graph:
  requires:
    - src/state/app-state.ts (selectedBatteries, customBattery, scheduleRecompute — plan 04-03)
    - src/helpers/color.ts (colorSlotFor — plan 04-02)
    - src/domain/battery-catalog.ts (BATTERY_CATALOG — 7 entries, Sessy 5 at index 0)
    - src/domain/types.ts (BatteryConfig)
  provides:
    - src/ui/battery-picker.ts (initBatteryPicker, teardownBatteryPicker)
    - src/styles/battery-picker.css (all battery-picker styles)
  affects:
    - src/main.ts (plan 04-06 — imports battery-picker.css + calls initBatteryPicker)
    - Phase 5 charts (read selectedBatteries order for swatch color consistency via colorSlotFor)
tech_stack:
  added: []
  patterns:
    - CSS class state machine (no element.style.X assignments — style-src 'self' CSP)
    - Reactive effect from @preact/signals-core driving card checked/disabled/swatch state
    - Effect dispose array (_disposeFns) per RESEARCH Pitfall 3
    - XSS: all user-derived strings (custom battery name) via .textContent only
    - Debounced custom-battery validation (400ms, D-07) — blur fires immediately
    - Max-5 selection cap enforced in both event handler (defensive) and reactive effect
    - Sessy 5 default selection via initial selectedBatteries.value (BATT-03 — set by signals.ts)
key_files:
  created:
    - src/ui/battery-picker.ts
    - src/styles/battery-picker.css
    - tests/battery-picker.test.ts
  modified: []
decisions:
  - "colorSlotFor called inside reactive effect so swatch slot updates when selection order changes (not just on initial render)"
  - "Custom battery collapse resets customBattery.value=null + scheduleRecompute(true) — ensures the exclusion is immediate, not debounced"
  - "Optional custom fields default to Sessy 5 specs when left blank — user only needs capacity for a valid comparison entry"
  - "teardownBatteryPicker() exported for hot-reload/test teardown discipline (Pitfall 3)"
  - "Blur handler fires validateAndWrite() immediately (not debounced) for better UX feedback on field exit"
metrics:
  duration_minutes: 8
  completed_date: "2026-06-11"
  tasks_completed: 2
  files_created: 3
---

# Phase 04 Plan 04: Battery Spec-Card Picker Summary

Battery spec-card grid with 7 catalog entries + custom card; Sessy 5 pre-checked; max-5 cap enforced via reactive effect; debounced custom battery validation; all styling via CSS tokens with no inline styles; 16 jsdom tests green, build clean.

## What Was Built

### Task 1: battery-picker.ts — spec cards, max-5 cap, custom battery card (commit 0a71210)

**`src/ui/battery-picker.ts`** exports `initBatteryPicker(region: HTMLElement): void` and `teardownBatteryPicker(): void`.

Structure built inside `#drop-zone-region`:
- `<section aria-label="Batterijkeuze">` with `<h2>Kies batterijen</h2>`
- `<ul role="list" class="battery-picker">` containing 7 catalog `<li class="battery-card">` elements and 1 custom card
- Each catalog card: `<label class="battery-card__label">` containing checkbox, swatch `<span class="battery-card__swatch battery-swatch--N">`, and name `<span class="battery-card__name">` (`.textContent`)
- `<dl class="battery-card__specs">` with 5 Dutch-locale spec rows (Capaciteit, Bruikbaar, Rendement, Max laden, Max ontladen)

Reactive effect (stored in `_disposeFns` array — Pitfall 3):
- Updates `battery-card--selected` / `battery-card--disabled` classes from `selectedBatteries.value`
- Updates `checkbox.checked` and `checkbox.disabled`
- Re-assigns `battery-swatch--N` class on slot change (selection order change)
- Shows/hides `<p class="picker-cap-note">` when `selectedBatteries.value.length >= 5`

Max-5 cap:
- Reactive effect adds `battery-card--disabled` + `checkbox.disabled = true` + title on unchecked cards when cap reached
- Event handler defensive guard: no-op if already at cap
- `<p class="picker-cap-note">Maximaal 5 batterijen geselecteerd.</p>` shown/hidden via `.hidden`

Custom battery card:
- `<button class="battery-card__expand" aria-expanded="false">+ Eigen batterij</button>`
- `<form class="custom-battery-form" novalidate hidden>` with 5 number fields
- Placeholder defaults = Sessy 5 specs (capaciteit: 5.0, dod: 100, rendement: 85, laden: 2.2, ontladen: 1.7)
- `max` attributes per T-04-12 DoS guard (capacity max 200; power max 100)
- Validation on `blur` (immediate) + `input` (debounced 400ms, D-07)
- Invalid capacity: `.input--invalid` + `<span role="alert" class="input-error">` + `customBattery.value = null`
- Valid capacity: writes `Partial<BatteryConfig>` to `customBattery.value`; optional fields default to Sessy 5 specs

XSS gates:
- All user-derived strings use `.textContent` — zero `.innerHTML` assignments
- `grep -c '\.style\.' src/ui/battery-picker.ts` returns 0 (no inline style)

**`tests/battery-picker.test.ts`** (jsdom, `// @vitest-environment jsdom`):
- 16 tests covering: 7 catalog cards render, 1 custom card, Sessy 5 checked on mount, cap note visible/hidden, disabled checkboxes when 5 selected, XSS assertion (`querySelectorAll('script').length === 0`), swatch classes, form hidden initially, no inline styles

### Task 2: battery-picker.css — token-only styles (commit 8cb50a2)

**`src/styles/battery-picker.css`** (204 lines):

- Header comment per drop-zone.css convention (file path, CSP note, global.css note)
- `.battery-picker` — CSS grid, 1 column, 2 columns at >=480px via `@media`
- `.battery-card` — 1px `--color-border` border, 8px radius, `--color-bg` bg, `--space-md` padding
- `.battery-card--selected` — 2px solid `--color-accent` (only appearance of accent on cards)
- `.battery-card--disabled` — `--color-surface` bg, `--color-text-muted` text, opacity 0.6, `cursor: not-allowed`
- `.battery-card__label` — `min-height: 44px` (WCAG 2.5.5)
- `.battery-card__swatch` — 12x12px circle (`border-radius: 50%`)
- `.battery-swatch--1..5` — each sets `background-color: var(--color-battery-N)` (5 slots)
- `.battery-card__specs` — grid layout, dt at label size/muted, dd at body size/primary
- `.picker-cap-note` — label size, muted color
- `.battery-card__expand` — `min-height: 44px` (WCAG 2.5.5)
- `.custom-battery-form`, `.custom-battery-form__label`, `.custom-battery-form__input`
- `.input--invalid` — `border-color: var(--color-destructive)`
- `.input-error` — label size, destructive color
- Focus rings: `outline: 2px solid var(--color-accent)` at 2px offset on all interactive elements
- Zero raw hex values; all values via `var(--token)` (48 token references)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the `placeholder` attributes in the custom battery form inputs are intentional Sessy 5 defaults as specified in UI-SPEC §2. They are HTML `<input placeholder="...">` attributes, not placeholder values in the business logic. The `customBattery.value` signal is always `null` until the user fills in and validates at least the capacity field.

## Threat Surface Scan

No new threat surface beyond the plan's threat register:

- T-04-10 (XSS via custom battery name): mitigated — all user-derived strings via `.textContent`; `querySelectorAll('script').length === 0` assertion in jsdom test
- T-04-11 (inline style injection): mitigated — `grep -c '\.style\.' src/ui/battery-picker.ts` returns 0; swatch colors set via `.battery-swatch--N` CSS classes
- T-04-12 (DoS via huge numbers): mitigated — `<input max="200">` for capacity, `<input max="100">` for power/percentage fields; `nominalCapacityKwh > 0` guard before writing to `customBattery.value`

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/ui/battery-picker.ts exists | FOUND |
| src/styles/battery-picker.css exists | FOUND |
| tests/battery-picker.test.ts exists | FOUND |
| commit 0a71210 exists | FOUND |
| commit 8cb50a2 exists | FOUND |
| grep -c '.style.' src/ui/battery-picker.ts returns 0 | PASSED |
| grep -E "selectedBatteries.value|scheduleRecompute" matches | PASSED |
| npm test -- --run tests/battery-picker.test.ts → 16 passed | PASSED |
| npm run build → 0 errors | PASSED |
| 5 battery-swatch--N classes in battery-picker.css | PASSED |
| battery-card__label min-height: 44px | PASSED |
| battery-card__expand min-height: 44px | PASSED |
