---
phase: 05
plan: 02
subsystem: styles + ci-audit
tags: [css, chart-styles, tooltip-styles, transparency-panel, mobile-reflow, ci-grep, ux]
dependency_graph:
  requires:
    - 05-01 (pure domain helpers: bucketByMonth, selectRepresentativeWeek, formatAxisKwh)
  provides:
    - charts.css: every CSS class Plan 03 (chart adapters) references
    - tooltips.css: every CSS class Plan 04 (tooltip JS) references
    - transparency-panel.css: every CSS class Plan 04 (transparency panel) references
    - mobile-reflow.css: comparison table card reflow + chart height overrides (UX-04)
    - tests/terminology-audit.test.ts: UX-05 + UX-06 CI contract lock
  affects:
    - Plan 03 (chart adapters can reference .chart-wrapper, .chart-legend, etc.)
    - Plan 04 (transparency panel + tooltips can reference their CSS classes)
    - Plan 05 (mobile visual verification tests CSS from this plan)
tech_stack:
  added: []
  patterns:
    - CSS-class-only state management (no inline style= attributes)
    - Token-only values (all colors/spacing via CSS custom properties from tokens.css)
    - ::after pseudo-element tooltip (CSP-safe, no JS positioning)
    - attr(data-label) content hook for mobile card reflow (Phase 4 D-12 hooks)
    - Vitest node-env CI grep test (Pattern 8 from 05-RESEARCH.md)
key_files:
  created:
    - tests/terminology-audit.test.ts
    - src/styles/charts.css
    - src/styles/tooltips.css
    - src/styles/transparency-panel.css
    - src/styles/mobile-reflow.css
  modified: []
decisions:
  - No new color tokens introduced (all values from existing tokens.css)
  - .results-section-heading not redefined (already in results-region.css)
  - .battery-swatch--N reused from comparison-table.css for chart legend swatches
  - UX-06 banned list uses 3 specific markers (type="email", type="tel", offerte) per plan spec
  - mobile-reflow.css also includes fallback .chart-wrapper height for non-ID-specific wrappers
metrics:
  duration: 179s
  completed: "2026-06-14"
  tasks: 3
  files: 5
---

# Phase 05 Plan 02: CSS Files + CI Grep Audits Summary

**One-liner:** Four new CSS files (chart wrapper/legend/tooltip/panel/mobile-reflow) plus a Vitest node-env CI grep test locking UX-05 honest-terminology and UX-06 no-CTA invariants.

## What Was Built

### Task 1: Terminology + No-CTA CI Grep Audit (UX-05, UX-06)

`tests/terminology-audit.test.ts` — a Vitest node-env test following the Phase 1 `csp-plugin.test.ts` contract-lock pattern. Two describe blocks:

1. **UX-05** — `findBanned(['solar production', 'solar generation', 'zonne-opwekking', 'zonne-opbrengst'])` must return length 0. Enforces honest Dutch terminology; no banned English/Dutch solar-production phrases allowed in `src/`.
2. **UX-06** — `findBanned(['type="email"', 'type="tel"', 'offerte'])` must return length 0. Prevents lead-capture CTA patterns from entering `src/`.

The `allSrcFiles()` recursive walk collects `.ts` and `.html` files under `src/` (resolved via `import.meta.dirname`). The `findBanned()` function opens each file with `readFileSync` and records `file: "term"` for actionable failure output. The scan is scoped to `src/` only — banned literals in this test file do not self-invalidate.

### Task 2: charts.css + tooltips.css

`src/styles/charts.css` defines every CSS class the Plan 03 chart adapters reference:
- `.chart-section` (margin-top `--space-xl`)
- `.chart-section__header` (flex row, heading + dropdown)
- `.chart-wrapper` (100% width, 280px height, `--color-bg`, 1px border, 8px radius, overflow hidden)
- `.chart-battery-select` (min-height 44px WCAG 2.5.5 touch target) + `.chart-battery-select__label`
- `.chart-week-caption` (`--font-size-label`, `--color-text-muted`)
- `.chart-partial-label` (muted label for "(deels)" annotation)
- `.chart-sparse-note` (`--color-surface` background, sm padding, 4px radius)
- `.chart-legend` + `__item` + `__swatch` + `__label` (flex wrap legend below canvas)
- `.chart-wrapper--computing` (opacity 0.5, pointer-events none — mirrors `.results-stale`)

Does NOT redefine `.results-section-heading` (only in a comment noting it lives in `results-region.css`). Reuses `.battery-swatch--N` from `comparison-table.css` for chart legend swatches.

`src/styles/tooltips.css` defines the dotted-underline term tooltip:
- `.term-tooltip` (dotted underline, cursor help, position relative)
- `.term-tooltip::after` with `content: attr(data-tooltip)`, `--color-text` bg / `--color-bg` text, max-width 280px, z-index 10, opacity 0, `transition: none`
- Three opacity-1 triggers: `:hover::after`, `:focus-visible::after`, `.term-tooltip--open::after`

### Task 3: transparency-panel.css + mobile-reflow.css (UX-04)

`src/styles/transparency-panel.css` defines the collapsible panel surface:
- `.transparency-panel` (full-width block)
- `.transparency-panel__details` (surface bg, 1px border, 8px radius, md padding, lg top margin — mirrors `.saldering-disclaimer`)
- `.transparency-panel__summary` (heading size, semibold, min-height 44px, list-style none, Unicode glyphs via `::before` and `details[open]` selector)
- `:focus-visible` outline using `var(--color-accent)` at 2px offset
- `.transparency-panel__body`, `.assumptions-list` (body size, line-height 1.5, left padding)
- `.no-euros-section` (left 4px border, left padding), `__heading` (body/semibold), `__body` (body/muted)

`src/styles/mobile-reflow.css` contains a single `@media (max-width: 480px)` block:
- Hides `.comparison-table thead`
- Reflows table/tbody/tr/td to `display: block`
- Styles `.comparison-table tr.battery-row` as bordered card (1px border, 8px radius, md margin/padding, `--color-bg`)
- `td::before { content: attr(data-label); ... }` using Phase 4 D-12 data hooks
- `.battery-row__name` as card heading (heading size, semibold, bottom border)
- `#chart-monthly .chart-wrapper` 220px; `#chart-flow .chart-wrapper` 260px with `overflow-x: auto`
- Fallback `.chart-wrapper` 220px for non-ID-specific chart wrappers

## Verification

- 302 tests pass (`npm test` — 290 existing + 2 new from terminology audit)
- Zero `style=` attribute literals in any of the four CSS files (CSP `style-src 'self'` intact)
- `mobile-reflow.css` uses `attr(data-label)` — Phase 4 data hook confirmed present
- All four CSS files use only existing `--space-*`, `--color-*`, `--font-size-*`, `--font-weight-*` tokens

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Terminology + no-CTA CI grep audit | d41f742 | tests/terminology-audit.test.ts |
| 2 | charts.css + tooltips.css | 5c583a9 | src/styles/charts.css, src/styles/tooltips.css |
| 3 | transparency-panel.css + mobile-reflow.css | f4bafab | src/styles/transparency-panel.css, src/styles/mobile-reflow.css |

## Self-Check: PASSED
