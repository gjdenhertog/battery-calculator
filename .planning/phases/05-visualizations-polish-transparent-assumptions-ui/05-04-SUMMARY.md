---
phase: 05
plan: 04
subsystem: ui-transparency
tags: [transparency-panel, tooltips, dom-builder, event-wiring, jsdom, ux, csp, dutch-copy]
dependency_graph:
  requires:
    - 05-02 (transparency-panel.css + tooltips.css — the CSS classes both modules target)
  provides:
    - src/ui/transparency-panel.ts: renderTransparencyPanel() — pure DOM builder for collapsible Dutch assumptions panel (UX-01, UX-02)
    - src/ui/tooltips.ts: initTooltips() — document-level tap-toggle + Escape tooltip wiring (UX-03)
  affects:
    - 05-05 (wiring plan can append panel and call initTooltips() during main.ts integration)
tech_stack:
  added: []
  patterns:
    - Pure DOM builder (no signals) — modeled on readout.ts pattern
    - Module-level static copy constants assigned via textContent only
    - Native <details>/<summary> for collapsible toggle — zero JS needed (D-07)
    - Document-level touchstart passive listener for tap-toggle
    - classList-only state management — no element.style writes (CSP style-src 'self')
key_files:
  created:
    - src/ui/transparency-panel.ts
    - tests/transparency-panel.test.ts
    - src/ui/tooltips.ts
    - tests/tooltips.test.ts
  modified: []
decisions:
  - Static copy stored as module-level const strings and assigned via textContent only (XSS + CSP T-05-08)
  - initTooltips() uses passive touchstart listener to avoid scroll jank
  - Tests call initTooltips() once before describe block to avoid listener accumulation across tests
  - fireTouchstart helper dispatches native Event without overriding target (jsdom sets target automatically via dispatchEvent)
metrics:
  duration: 239s
  completed: "2026-06-14"
  tasks: 2
  files: 4
---

# Phase 05 Plan 04: Transparency Panel + Tooltips Summary

**One-liner:** Collapsible Dutch assumptions panel (UX-01/UX-02) with full saldering depth (D-08) and honest no-euros boundary (D-09), plus document-level tap-toggle tooltip wiring for seven technical terms (UX-03/D-11), both CSP-safe via classList-only state.

## What Was Built

### Task 1: transparency-panel.ts builder (UX-01, UX-02)

`src/ui/transparency-panel.ts` — pure DOM builder returning `HTMLElement`, modeled exactly on `src/ui/readout.ts`. Exports `renderTransparencyPanel(): HTMLElement`.

Structure:
- `<section class="transparency-panel" aria-label="Berekeningsdetails">`
- Native `<details class="transparency-panel__details">` — browser handles open/close, no JS needed (D-07)
- `<summary class="transparency-panel__summary">"Hoe is dit berekend?"` (UX-01)
- `<div class="transparency-panel__body">` containing:
  - `<ul class="assumptions-list">` with exactly 5 `<li>` items (verbatim from UI-SPEC Copywriting Contract):
    - Assumption 1: Round-trip rendement (√rendement per direction, 85% example)
    - Assumption 2: Diepteontlading (DoD cap)
    - Assumption 3: Laad-/ontlaadvermogen per tijdstap (2.2 kW example)
    - Assumption 4: Salderingsvereenvoudiging — cites "2026-64%-cap" and "situatie na 2027" (D-08 full caveat)
    - Assumption 5: Periode — no extrapolation
  - `<div class="no-euros-section">` with `<h3>"Waarom geen euro's?"</h3>` (UX-02) and body explaining kWh-only approach with NO v2 promise (D-09)

All copy via `.textContent` — never `.innerHTML`. Panel collapsed by default (no `open` attribute).

`tests/transparency-panel.test.ts` (jsdom, 13 tests):
- section/class/aria-label structure
- `<details>` present and collapsed by default
- `<summary>` contains "Hoe is dit berekend?" (UX-01)
- exactly 5 `<li>` in `.assumptions-list`
- one li contains "2027" or "terugleverkosten" (D-08 saldering caveat)
- `<h3>` containing "Waarom geen euro's?" (UX-02)
- `.no-euros-section__body` does NOT contain "v2 zal", "binnenkort", "komt eraan", "volgende versie" (D-09 negative assertion)
- `.transparency-panel__body` contains both sub-sections
- No `<script>` elements (XSS guard)

### Task 2: tooltips.ts tap-toggle wiring (UX-03)

`src/ui/tooltips.ts` — event-wiring module, modeled on `src/ui/drop-zone.ts` listener pattern. Exports `initTooltips(): void`.

Behavior:
- **Passive `touchstart`** listener at document level: `(e.target as Element).closest('.term-tooltip')` finds the tapped tooltip; removes `.term-tooltip--open` from all others; toggles `.term-tooltip--open` on the tapped element; tapping outside any tooltip removes all open states.
- **`keydown`** listener: on `Escape`, removes `.term-tooltip--open` from all open tooltips and blurs each.
- **Desktop hover / keyboard focus**: handled entirely by CSS (`:hover::after`, `:focus-visible::after` in Plan 02 `tooltips.css`) — no JS needed.

CSP compliance: classList add/remove ONLY. Zero `element.style` writes. Zero `setAttribute('style')` calls.

Tooltip markup contract documented in JSDoc for copy authors:
```html
<span class="term-tooltip" tabindex="0" data-tooltip="[author-defined string]">
  [term]
</span>
```

Seven verbatim term/data-tooltip pairs locked (including canonical "teruglevering" — D-10). All data-tooltip values are author-defined static strings; never interpolated from user CSV data (T-05-08).

`tests/tooltips.test.ts` (jsdom, 8 tests):
- tap opens span A, span B stays closed
- tap B after A: B opens, A closes (only one open at a time)
- tap outside closes all open tooltips
- tap already-open tooltip toggles it closed
- Escape removes `.term-tooltip--open` from all elements
- spans carry `tabindex="0"` (keyboard accessibility)
- spans carry non-empty `data-tooltip` attribute
- no `style` attribute set after toggle (CSP guard, T-05-09)

## Verification

- `npm test -- transparency-panel --run`: 13 tests green
- `npm test -- tooltips --run`: 8 tests green
- Full suite `npm test -- --run`: 353 tests green (28 test files)
- `npx tsc --noEmit`: clean
- No `.style.` writes in either module (grep clean)
- No `.innerHTML` for copy nodes in transparency-panel.ts (grep clean)
- Passive touchstart listener confirmed in tooltips.ts source

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed synthetic touchstart event dispatch in tests**

- **Found during:** Task 2 test execution
- **Issue:** Initial `fireTouchstart()` helper used `Object.defineProperty(event, 'target', ...)` before `dispatchEvent()`, which conflicted with jsdom's automatic `e.target` assignment when an element dispatches an event. The listener received a mismatched target, causing toggle state to not apply. Also, `initTooltips()` was being called inside individual tests, causing listener accumulation.
- **Fix:** Removed `Object.defineProperty` — let jsdom set `e.target` naturally via `element.dispatchEvent(event)`. Moved `initTooltips()` call to module scope (once, before the `describe` block) to avoid listener stacking.
- **Files modified:** `tests/tooltips.test.ts`
- **Commit:** 65a2691

## Known Stubs

None — both modules are fully implemented with production-ready content. No hardcoded empty arrays, placeholder text, or stub patterns.

## Threat Surface Scan

No new threat surfaces beyond the plan's threat model. Both modules:
- Use only author-defined static strings (no user CSV data path)
- Touch only CSS classes via classList (no DOM attribute writes that could carry user data)
- Are confirmed clean of inline style patterns

## Self-Check: PASSED

### Files exist:
- [x] src/ui/transparency-panel.ts — FOUND
- [x] tests/transparency-panel.test.ts — FOUND
- [x] src/ui/tooltips.ts — FOUND
- [x] tests/tooltips.test.ts — FOUND

### Commits exist:
- [x] cc4e822 (Task 1: transparency panel) — FOUND
- [x] 65a2691 (Task 2: tooltips) — FOUND
