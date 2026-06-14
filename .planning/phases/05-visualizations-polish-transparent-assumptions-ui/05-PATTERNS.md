# Phase 5: Visualizations, Polish, Transparent-Assumptions UI — Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 14 new/modified files
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/domain/bucket-by-month.ts` | utility | transform | `src/domain/period-filter.ts` | role-match (pure domain transform) |
| `src/domain/select-representative-week.ts` | utility | transform | `src/domain/gaps.ts` | exact (TZDate walk + reduce over TraceRow[]) |
| `src/helpers/format.ts` (extend) | utility | transform | `src/helpers/format.ts` itself | self-extend |
| `src/ui/charts/monthly-bars.ts` | component | event-driven | `src/ui/comparison-table.ts` | exact (effect() subscription + DOM adapter) |
| `src/ui/charts/flow-chart.ts` | component | event-driven | `src/ui/comparison-table.ts` | exact (effect() subscription + DOM adapter) |
| `src/ui/transparency-panel.ts` | component | request-response | `src/ui/readout.ts` | role-match (DOM builder, static copy, no signals) |
| `src/ui/tooltips.ts` | utility | event-driven | `src/ui/drop-zone.ts` | role-match (event listener wiring, CSS-class toggle) |
| `src/styles/charts.css` | config | — | `src/styles/results-region.css` | exact (section/wrapper/label pattern) |
| `src/styles/tooltips.css` | config | — | `src/styles/comparison-table.css` | role-match (CSS-class-only state, custom properties) |
| `src/styles/transparency-panel.css` | config | — | `src/styles/comparison-table.css` (`.saldering-disclaimer`) | exact (surface background, border, border-radius, padding pattern) |
| `src/styles/mobile-reflow.css` | config | — | `src/styles/global.css` | role-match (@media block reusing Phase 4 data-* hooks) |
| `tests/bucket-by-month.test.ts` | test | — | `tests/format.test.ts` + `tests/dst-fixtures.test.ts` | exact (node-env, pure-function contract fixtures) |
| `tests/select-representative-week.test.ts` | test | — | `tests/dst-fixtures.test.ts` | exact (node-env, TZDate fixture + edge-case assertions) |
| `tests/terminology-audit.test.ts` | test | — | `tests/csp-plugin.test.ts` | exact (node-env CI grep, banned-string contract lock) |
| `tests/transparency-panel.test.ts` | test | — | `tests/readout.test.ts` | exact (jsdom, DOM element/text contract assertions) |
| `tests/tooltips.test.ts` | test | — | `tests/comparison-table.test.ts` | role-match (jsdom, DOM attribute + class toggle assertions) |
| `tests/monthly-bars.test.ts` | test | — | `tests/comparison-table.test.ts` | exact (jsdom, effect() mount + DOM contract) |
| `tests/flow-chart.test.ts` | test | — | `tests/comparison-table.test.ts` | exact (jsdom, effect() mount + DOM contract) |
| `tests/format.test.ts` (extend) | test | — | `tests/format.test.ts` itself | self-extend |
| `src/main.ts` (extend) | config | — | `src/main.ts` itself | self-extend |

---

## Pattern Assignments

### `src/domain/bucket-by-month.ts` (utility, transform)

**Analog:** `src/domain/gaps.ts` (TZDate walk over timestamps) + `src/domain/period-filter.ts` (pure array transform returning typed results)

**Imports pattern** — copy from `src/domain/gaps.ts` lines 16-18:
```typescript
import { TZDate } from '@date-fns/tz'
import { addDays } from 'date-fns'
import type { TraceRow } from './types'

const AMSTERDAM = 'Europe/Amsterdam'
```

**Core TZDate bucketing pattern** — adapt from `src/domain/gaps.ts` lines 55-61:
```typescript
// gaps.ts uses new TZDate(ms, AMSTERDAM) to get local-time fields.
// bucket-by-month uses the same pattern for getFullYear() / getMonth():
let current = new TZDate(ts.getTime(), AMSTERDAM)
// current.getFullYear() and current.getMonth() return Amsterdam local values
// (NOT UTC) — this is the critical correctness property for month bucketing.
```

**Pure-function signature pattern** — copy from `src/domain/period-filter.ts` lines 21-32:
```typescript
// period-filter.ts: pure function, typed input → typed output, no side effects,
// JSDoc describing invariants.
export function filterByPeriod(
  samples: IntervalSample[],
  start: Date | null,
  end: Date | null,
): IntervalSample[] {
  // pure transform; not mutated
}

// bucket-by-month follows the same shape:
export interface MonthBucket {
  monthKey: string        // "2025-06"
  monthLabel: string      // "jun '25"
  shiftedKwh: number      // sum of TraceRow-derived shifted energy for this month
  isPartial: boolean      // true if first or last calendar day of month is absent
}

export function bucketByMonth(trace: TraceRow[], zone: string): MonthBucket[]
```

**Export pattern** — named export only (no default), same as all domain helpers.

---

### `src/domain/select-representative-week.ts` (utility, transform)

**Analog:** `src/domain/gaps.ts` — same exact pattern: TZDate walk over an array of domain objects, reduce to a summary result.

**Imports pattern** — copy from `src/domain/gaps.ts` lines 16-18:
```typescript
import { TZDate } from '@date-fns/tz'
import { startOfWeek } from 'date-fns'
import type { TraceRow } from './types'

const AMSTERDAM = 'Europe/Amsterdam'
```

**TZDate week-boundary pattern** — adapt from `src/domain/gaps.ts` lines 55-61:
```typescript
// gaps.ts walks expected slots by TZDate stepping. Week selection groups by
// ISO week (Mon-Sun boundary) using the same TZDate, not raw Date:
const local = new TZDate(row.timestamp.getTime(), AMSTERDAM)
// Use startOfWeek(local, { weekStartsOn: 1 }) to get the Monday boundary
// in Amsterdam local time. Compare week keys as strings for grouping.
```

**Result type pattern** — named interface, same as `MonthBucket` above:
```typescript
export interface RepresentativeWeek {
  startTs: number    // Unix ms — Monday 00:00 Amsterdam
  endTs: number      // Unix ms — Sunday 23:59:59 Amsterdam
  weekLabel: string  // "8–14 juni 2025"
}

export function selectRepresentativeWeek(
  trace: TraceRow[],
  zone: string,
): RepresentativeWeek
// Never returns null — returns the single available span if dataset < 7 days.
```

---

### `src/helpers/format.ts` (extend)

**Analog:** `src/helpers/format.ts` itself (lines 1-35)

**Self-extension pattern** — add `formatAxisKwh` following the exact same style:
```typescript
// Existing pattern (lines 9-11):
/** Format an energy value to 1 decimal place with kWh suffix */
export function formatKwh(n: number): string {
  return `${n.toFixed(1)} kWh`
}

// New function to add (same docblock style, same toFixed(1) core):
/** Format an energy value to 1 decimal place WITHOUT kWh suffix — for uPlot axis ticks */
export function formatAxisKwh(n: number): string {
  return n.toFixed(1)
}
```

---

### `src/ui/charts/monthly-bars.ts` (component, event-driven)

**Analog:** `src/ui/comparison-table.ts` — this is the primary analog for ALL chart adapters. Same architecture: `init*()` function, `effect()` subscription, `SimResult[]` + `activeBatteries` signals, DOM construction via `document.createElement`, `.textContent` for all strings.

**Imports pattern** — copy from `src/ui/comparison-table.ts` lines 14-19:
```typescript
import { effect } from '@preact/signals-core'
import { simResults, activeBatteries, isComputing } from '../state/app-state'
import { colorFor, colorSlotFor } from '../helpers/color'
import { formatAxisKwh } from '../helpers/format'
import { bucketByMonth } from '../domain/bucket-by-month'
import type { SimResult, BatteryConfig } from '../domain/types'
import uPlot from 'uplot'
```

**Effect subscription pattern** — copy from `src/ui/comparison-table.ts` lines 422-430:
```typescript
// comparison-table.ts lines 422-480: the canonical effect pattern.
// chart adapter follows the same shape exactly:
export function initMonthlyBarsChart(container: HTMLElement): () => void {
  let chart: uPlot | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null

  // ResizeObserver created ONCE — outside the effect (Pitfall 7 guard)
  const observer = new ResizeObserver(() => {
    if (chart && container.offsetWidth > 0) {
      clearTimeout(resizeTimer!)
      resizeTimer = setTimeout(() => {
        chart!.setSize({ width: container.offsetWidth, height: 280 })
      }, 100)
    }
  })
  observer.observe(container)

  return effect(() => {
    const results = simResults.value
    const batteries = activeBatteries.value
    if (!results || batteries.length === 0) {
      // render empty/placeholder state — same pattern as renderEmpty() in comparison-table.ts
      return
    }
    // Build data → call chart.setData() if chart exists; create chart if first run
    // Destroy + recreate chart ONLY when series count (battery count) changes.
  })
}
```

**XSS-safe DOM pattern** — copy from `src/ui/comparison-table.ts` lines 54-68:
```typescript
// All text goes via .textContent — never .innerHTML.
// This applies to battery names (user-derived), chart captions, legend labels.
const label = document.createElement('span')
label.className = 'chart-legend__label'
label.textContent = battery.name // textContent — XSS safe (custom battery name)
```

**CSS-class state pattern** — copy from `src/ui/comparison-table.ts` lines 71-88:
```typescript
// No inline style= ever. State toggled via class names only.
// Example from comparison-table.ts: opacity dimming via .results-stale class.
// For charts: dim while computing by toggling a CSS class on the chart wrapper.
container.classList.toggle('chart-wrapper--computing', isComputing.value)
```

**Color resolution pattern** — from `src/helpers/color.ts` lines 25-29 + RESEARCH.md Pattern 7:
```typescript
// colorFor() returns 'var(--color-battery-N)' — NOT a valid canvas strokeStyle.
// Resolve to hex at chart-mount time:
function resolveBatteryColor(batteryId: string, orderedIds: string[]): string {
  const cssVarName = colorFor(batteryId, orderedIds)
    .replace('var(', '').replace(')', '').trim()
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVarName).trim()
  // Returns e.g. '#2563eb' — safe to pass as uPlot series.stroke
}
```

**Error state pattern** — copy from `src/ui/comparison-table.ts` lines 62-68:
```typescript
function renderChartError(container: HTMLElement): void {
  container.innerHTML = ''
  const p = document.createElement('p')
  p.setAttribute('role', 'alert')
  p.className = 'results-error'
  p.textContent = 'Grafiek kon niet worden geladen. Probeer een ander tijdvenster of herlaad de pagina.'
  container.appendChild(p)
}
```

---

### `src/ui/charts/flow-chart.ts` (component, event-driven)

**Analog:** `src/ui/comparison-table.ts` — same effect/signals pattern; plus `src/ui/drop-zone.ts` for the dropdown event listener pattern.

**Imports pattern** — same as monthly-bars.ts above, swapping `bucketByMonth` for `selectRepresentativeWeek`:
```typescript
import { effect } from '@preact/signals-core'
import { simResults, activeBatteries, isComputing } from '../state/app-state'
import { colorFor } from '../helpers/color'
import { formatAxisKwh } from '../helpers/format'
import { selectRepresentativeWeek } from '../domain/select-representative-week'
import type { SimResult, BatteryConfig, TraceRow } from '../domain/types'
import uPlot from 'uplot'
```

**Dropdown event listener pattern** — copy from `src/ui/drop-zone.ts` lines 244-249:
```typescript
// drop-zone.ts uses fileInput.addEventListener('change', ...) — same pattern for the
// battery select dropdown in the flow chart:
const select = document.createElement('select')
select.id = 'flow-chart-battery'
select.className = 'chart-battery-select'
select.addEventListener('change', () => {
  const selectedId = select.value
  updateFlowChart(selectedId)
})
```

**Dropdown option XSS-safe build** — copy from `src/ui/comparison-table.ts` battery row pattern:
```typescript
// Options built via DOM, not innerHTML. Battery name via .textContent:
batteries.forEach((battery) => {
  const option = document.createElement('option')
  option.value = battery.id
  option.textContent = battery.name // textContent — XSS safe
  select.appendChild(option)
})
```

**uPlot step-line configuration** — from RESEARCH.md Pattern 2:
```typescript
const steppedBuilder = uPlot.paths.stepped({ align: 1 })

series: [
  {},  // x-axis placeholder (required)
  {
    label: 'Grid import',
    stroke: resolveBatteryColor(battery.id, orderedIds),
    paths: steppedBuilder,
    width: 2,
    points: { show: false },
  },
  // ... 3 more series
]
```

**Week caption update pattern** — same `.textContent` assignment as any other DOM text:
```typescript
const caption = container.querySelector('.chart-week-caption') as HTMLParagraphElement
if (caption) {
  caption.textContent = `Voorbeeldweek: ${week.weekLabel} — de week met de meeste teruglevering in je data.`
}
```

---

### `src/ui/transparency-panel.ts` (component, request-response)

**Analog:** `src/ui/readout.ts` — same pattern: a pure DOM builder function (not reactive, no signals) that returns a fully-built `HTMLElement`. Static copy as `.textContent`.

**Export pattern** — single named function returning an element:
```typescript
// readout.ts exports: export function renderReadout(result: MergeResult): HTMLElement
// transparency-panel.ts follows the same shape:
export function renderTransparencyPanel(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'transparency-panel'
  section.setAttribute('aria-label', 'Berekeningsdetails')
  // ... build <details>/<summary> subtree
  return section
}
```

**Static copy pattern** — copy from `src/ui/comparison-table.ts` lines 28-38:
```typescript
// comparison-table.ts stores static copy as module-level constants and assigns
// via .textContent. Same pattern for panel assumptions copy:
const ASSUMPTION_1 =
  'Round-trip rendement: elke kWh die je opslaat én terugkrijgt, verliest energie. ...'

// Then inside the builder:
const li = document.createElement('li')
li.textContent = ASSUMPTION_1  // textContent — static locked copy
```

**Details/summary native toggle** — no JS needed for open/close. Pattern from UI-SPEC:
```typescript
const details = document.createElement('details')
details.className = 'transparency-panel__details'

const summary = document.createElement('summary')
summary.className = 'transparency-panel__summary'
summary.textContent = 'Hoe is dit berekend?'
// Native <details> open/close — browser handles it, zero JS needed.
details.appendChild(summary)
```

---

### `src/ui/tooltips.ts` (utility, event-driven)

**Analog:** `src/ui/drop-zone.ts` — same pattern: event listener wiring on `document`/elements, CSS-class toggle state machine, no signals.

**Event listener pattern** — copy from `src/ui/drop-zone.ts` lines 207-218:
```typescript
// drop-zone.ts: region.addEventListener('dragover', ...) / setState() CSS class toggle.
// tooltips.ts: document.addEventListener('touchstart', ...) / classList toggle.

export function initTooltips(): void {
  document.addEventListener('touchstart', (e) => {
    const target = (e.target as Element).closest('.term-tooltip')
    document.querySelectorAll('.term-tooltip--open').forEach((el) => {
      if (el !== target) el.classList.remove('term-tooltip--open')
    })
    if (target) target.classList.toggle('term-tooltip--open')
  }, { passive: true })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.term-tooltip--open').forEach((el) => {
        el.classList.remove('term-tooltip--open') ;
        (el as HTMLElement).blur()
      })
    }
  })
}
```

**CSS-class-only state** — no `element.style.*` assignments. Copy the pattern from `src/ui/drop-zone.ts` lines 38-41:
```typescript
// drop-zone.ts:
function setState(region: HTMLElement, state: DropZoneState): void {
  region.classList.remove(...STATE_CLASSES)
  region.classList.add(`drop-zone--${state}`)
}
// tooltips.ts equivalent: classList.add/remove('.term-tooltip--open') only.
```

---

### `src/styles/charts.css` (config)

**Analog:** `src/styles/results-region.css` — same conventions: CSS custom properties only, BEM-ish class names, section/wrapper/label/note pattern.

**CSS custom property usage pattern** — copy from `src/styles/results-region.css` lines 6-13:
```css
/* Copy the .results-section-heading rule verbatim — chart section headings
   reuse this class (already defined in results-region.css — do NOT redefine): */
/* .results-section-heading already in results-region.css — no duplication needed */

/* New rules follow the same token-only pattern: */
.chart-section {
  margin-top: var(--space-xl);
}

.chart-wrapper {
  width: 100%;
  height: 280px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden; /* contain the uPlot canvas */
}
```

**State class pattern (no inline style)** — copy from `src/styles/comparison-table.css` lines 93-97:
```css
/* comparison-table.css stale pattern: */
.results-stale {
  opacity: 0.5;
  pointer-events: none;
}

/* charts.css computing state follows the same pattern: */
.chart-wrapper--computing {
  opacity: 0.5;
  pointer-events: none;
}
```

**Battery swatch in legend** — copy swatch rules from `src/styles/comparison-table.css` lines 78-91:
```css
/* comparison-table.css defines .battery-swatch--N rules.
   chart legend swatches use the SAME classes — no duplication.
   New class for the legend item layout only: */
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

.chart-legend__item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* .chart-legend__swatch reuses .battery-swatch--N for CSS class-based coloring */
```

---

### `src/styles/tooltips.css` (config)

**Analog:** `src/styles/comparison-table.css` (CSS-class-only, custom properties, focus-visible outline) — exact pattern for the button/interactive element focus ring.

**Focus ring pattern** — copy from `src/styles/comparison-table.css` lines 131-134:
```css
/* comparison-table.css: */
.saldering-info-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* tooltips.css uses the same pattern for the tooltip term spans: */
.term-tooltip:focus-visible::after {
  opacity: 1;
}
/* (the full .term-tooltip ruleset is in UI-SPEC.md §"Technical-Term Tooltips" — copy verbatim) */
```

**No inline style** — `position: absolute` and `bottom: calc(...)` on `::after` are CSS pseudo-element declarations in a `.css` file, not `element.style.*` — fully CSP-safe.

---

### `src/styles/transparency-panel.css` (config)

**Analog:** The `.saldering-disclaimer` block in `src/styles/comparison-table.css` lines 99-111 — exact pattern: `--color-surface` background, `1px solid var(--color-border)` border, `border-radius: 8px`, `padding: var(--space-md)`.

**Surface block pattern** — copy from `src/styles/comparison-table.css` lines 99-111:
```css
/* comparison-table.css .saldering-disclaimer: */
.saldering-disclaimer {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--space-md);
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  margin-top: var(--space-sm);
}

/* transparency-panel.css follows the SAME pattern for the panel container: */
.transparency-panel__details {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--space-md);
  margin-top: var(--space-lg);
}
```

**Touch-target min-height pattern** — copy from `src/styles/results-region.css` line 69:
```css
/* results-region.css: */
.period-input {
  min-height: 44px; /* WCAG 2.5.5 touch target */
}

/* transparency-panel.css: */
.transparency-panel__summary {
  min-height: 44px; /* WCAG 2.5.5 touch target */
  cursor: pointer;
}
```

---

### `src/styles/mobile-reflow.css` (config)

**Analog:** `src/styles/global.css` lines 28-33 — the project's single existing `@media` block. Exactly the same pattern: mobile-first with min/max-width breakpoints, `display: block` reflows, no new tokens.

**Media query pattern** — copy from `src/styles/global.css` lines 28-33:
```css
/* global.css mobile-first media query: */
@media (min-width: 480px) {
  .container {
    padding: 0 var(--space-lg);
  }
}

/* mobile-reflow.css is the inverse — max-width for mobile overrides: */
@media (max-width: 480px) {
  /* comparison table → stacked cards (verbatim from UI-SPEC.md §"Mobile Reflow") */
  .comparison-table thead { display: none; }
  /* etc. — copy exactly from 05-UI-SPEC.md §"Mobile Reflow at 375px" */
}
```

**data-* attribute hook pattern** — copy from `src/ui/comparison-table.ts` lines 200-202:
```typescript
// comparison-table.ts sets data-metric and data-label on every <td>:
td.dataset.metric = metricKey  // D-12 Phase 5 hook
td.dataset.label = labelText   // D-12 Phase 5 stacked card reflow

// mobile-reflow.css accesses these hooks in the @media block:
// .comparison-table td::before { content: attr(data-label); ... }
```

---

### `tests/bucket-by-month.test.ts` (test, node-env)

**Analog:** `tests/format.test.ts` (pure-function contract fixtures, node-env) + `tests/dst-fixtures.test.ts` (DST edge-case + fixture assertions).

**File header pattern** — copy from `tests/format.test.ts` lines 1-10:
```typescript
/**
 * tests/bucket-by-month.test.ts — contract tests for src/domain/bucket-by-month.ts (VIZ-01)
 *
 * Runs in the DEFAULT node environment (no per-file environment override needed).
 * Fixture-locks the month bucketing, isPartial detection, sparse-data handling,
 * and DST month boundary correctness.
 */
import { describe, it, expect } from 'vitest'
import { bucketByMonth } from '../src/domain/bucket-by-month'
import type { TraceRow } from '../src/domain/types'
```

**DST fixture construction pattern** — copy from `tests/dst-fixtures.test.ts` lines 152-159:
```typescript
// dst-fixtures.test.ts builds minimal fixture arrays inline (not from CSV):
function dailySeries(year: number, month1: number, startDay: number, days: number): IntervalSample[] {
  const out: IntervalSample[] = []
  for (let d = 0; d < days; d++) {
    const utcMs = new TZDate(year, month1 - 1, startDay + d, 0, 0, 'Europe/Amsterdam').getTime()
    out.push({ timestamp: new Date(utcMs), gridImportKwh: 1, gridExportKwh: 0 })
  }
  return out
}

// bucket-by-month tests follow the same pattern:
function makeTraceRow(isoDate: string, shiftedKwh = 0): TraceRow {
  return {
    timestamp: new Date(isoDate),
    socKwh: 0,
    chargedKwh: shiftedKwh,
    dischargedKwh: shiftedKwh,
    residualImportKwh: 0,
    residualExportKwh: 0,
  }
}
```

---

### `tests/select-representative-week.test.ts` (test, node-env)

**Analog:** `tests/dst-fixtures.test.ts` — TZDate fixture construction + edge-case coverage.

**Same header/import pattern** as bucket-by-month test above:
```typescript
/**
 * tests/select-representative-week.test.ts — contract tests for VIZ-02 heuristic
 *
 * Runs in the DEFAULT node environment.
 * Tests: highest-teruglevering week selection, tie-break (first wins), dataset < 7 days.
 */
import { describe, it, expect } from 'vitest'
import { selectRepresentativeWeek } from '../src/domain/select-representative-week'
import { TZDate } from '@date-fns/tz'
```

---

### `tests/terminology-audit.test.ts` (test, node-env CI grep)

**Analog:** `tests/csp-plugin.test.ts` — this is the exact analog. Both are node-env contract-lock tests with no DOM, asserting string invariants. The only difference is that csp-plugin.test.ts reads from a module constant, while terminology-audit.test.ts reads from the filesystem via `fs`.

**Full file structure** — copy from RESEARCH.md Pattern 8 (which derived the pattern from `tests/csp-plugin.test.ts` lines 1-61):
```typescript
/**
 * tests/terminology-audit.test.ts — UX-05 + UX-06 CI grep contract lock
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * If any test in this file fails it means a banned term or banned UI pattern
 * has been introduced into src/ — the build must be blocked.
 *
 * Pattern derived from tests/csp-plugin.test.ts (Phase 1 contract lock style).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

function allSrcFiles(dir: string): string[] {
  // ... recursive walk (see RESEARCH.md Code Examples)
}

function findBanned(terms: string[]): string[] {
  // ... grep implementation (see RESEARCH.md Code Examples)
}

describe('UX-05 terminology audit', () => {
  it('src/ contains zero occurrences of banned solar-production terms', () => {
    const hits = findBanned(['solar production', 'solar generation', 'zonne-opwekking', 'zonne-opbrengst'])
    expect(hits).toHaveLength(0)
  })
})

describe('UX-06 no-CTA audit', () => {
  it('src/ contains no email fields, contact forms, or offerte patterns', () => {
    const hits = findBanned(['type="email"', 'type="tel"', 'offerte'])
    expect(hits).toHaveLength(0)
  })
})
```

---

### `tests/transparency-panel.test.ts` (test, jsdom)

**Analog:** `tests/readout.test.ts` — exact match. Both test a pure DOM-builder function that takes no signals and returns an `HTMLElement`. Both use `// @vitest-environment jsdom` and assert element structure + text content.

**File header + environment annotation** — copy from `tests/readout.test.ts` lines 1-13:
```typescript
// @vitest-environment jsdom
/**
 * tests/transparency-panel.test.ts — renderTransparencyPanel DOM-contract lock (UX-01, UX-02)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 */
import { describe, it, expect } from 'vitest'
import { renderTransparencyPanel } from '../src/ui/transparency-panel'
```

**DOM assertion pattern** — copy from `tests/readout.test.ts` lines 61-75:
```typescript
// readout.test.ts DOM assertion pattern:
it('returns a <section id="parse-readout"> element', () => {
  const el = renderReadout(makeResult())
  expect(el.tagName.toLowerCase()).toBe('section')
  expect(el.id).toBe('parse-readout')
})

// transparency-panel.test.ts follows the same shape:
it('renders a <details> element inside the section', () => {
  const el = renderTransparencyPanel()
  const details = el.querySelector('details')
  expect(details).not.toBeNull()
})

it('"Hoe is dit berekend?" appears in the <summary> (UX-01)', () => {
  const el = renderTransparencyPanel()
  const summary = el.querySelector('summary')
  expect(summary?.textContent).toContain('Hoe is dit berekend?')
})

it('"Waarom geen euro\'s?" heading is present inside the panel (UX-02)', () => {
  const el = renderTransparencyPanel()
  expect(el.textContent).toContain("Waarom geen euro's?")
})
```

---

### `tests/monthly-bars.test.ts` + `tests/flow-chart.test.ts` (tests, jsdom)

**Analog:** `tests/comparison-table.test.ts` — exact match. Both mount a reactive UI adapter against a jsdom DOM, manipulate signals, and assert DOM structure. Both need `// @vitest-environment jsdom`, the `beforeEach`/`afterEach` signal-reset pattern, and fixture factories.

**Full test structure** — copy from `tests/comparison-table.test.ts` lines 1-98:
```typescript
// @vitest-environment jsdom
/**
 * tests/monthly-bars.test.ts — initMonthlyBarsChart DOM-contract lock (VIZ-01, VIZ-04)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderShell } from '../src/shell'
import { initMonthlyBarsChart } from '../src/ui/charts/monthly-bars'
import { simResults, selectedBatteries, isComputing } from '../src/state/signals'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'
import type { SimResult, BatteryConfig, TraceRow } from '../src/domain/types'

function makeTraceRow(ts: Date): TraceRow { ... }

function makeSimResult(overrides: Partial<SimResult> = {}): SimResult {
  return {
    shiftedKwh: 120.5,
    // ... same pattern as comparison-table.test.ts makeSimResult()
    trace: [],
    ...overrides,
  }
}

// Signal reset in beforeEach/afterEach — copy exactly from comparison-table.test.ts lines 77-98
beforeEach(() => {
  simResults.value = null
  isComputing.value = false
  selectedBatteries.value = [BATTERY_CATALOG[0]]
  // mount chart container
})

afterEach(() => {
  dispose?.()
  // reset signals
})
```

**uPlot mock requirement** — uPlot requires a real canvas context. In jsdom tests, mock `uPlot` to avoid `canvas.getContext is not a function` errors:
```typescript
// At top of monthly-bars.test.ts:
vi.mock('uplot', () => ({
  default: vi.fn().mockImplementation(() => ({
    setData: vi.fn(),
    setSize: vi.fn(),
    destroy: vi.fn(),
    root: document.createElement('div'),
  })),
}))
```

---

### `src/main.ts` (extend)

**Self-extend pattern** — copy from `src/main.ts` lines 1-9 and 38-52:

```typescript
// Phase 5 additions follow the exact same import + init wiring pattern:
import './styles/charts.css'
import './styles/tooltips.css'
import './styles/transparency-panel.css'
import './styles/mobile-reflow.css'
import { initMonthlyBarsChart } from './ui/charts/monthly-bars'
import { initFlowChart } from './ui/charts/flow-chart'
import { renderTransparencyPanel } from './ui/transparency-panel'
import { initTooltips } from './ui/tooltips'

// Inside the resultsRegion block — APPEND to resultsRegion, not replace:
if (resultsRegion) {
  // ... existing period-control + comparison-table code (unchanged) ...

  // Phase 5: chart mounts — appended AFTER comparison-table-mount
  const monthlyChartMount = document.createElement('div')
  monthlyChartMount.id = 'monthly-chart-mount'
  resultsRegion.appendChild(monthlyChartMount)
  const disposeMonthlyBars = initMonthlyBarsChart(monthlyChartMount)

  const flowChartMount = document.createElement('div')
  flowChartMount.id = 'flow-chart-mount'
  resultsRegion.appendChild(flowChartMount)
  const disposeFlowChart = initFlowChart(flowChartMount)

  // Phase 5: transparency panel — static DOM, no signals
  const panel = renderTransparencyPanel()
  resultsRegion.appendChild(panel)

  // Phase 5: tooltip wiring
  initTooltips()

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      disposeMonthlyBars()
      disposeFlowChart()
    })
  }
}
```

---

## Shared Patterns

### Authentication / Guards
Not applicable — this project has no auth.

### XSS-Safe DOM Mutation
**Source:** `src/ui/comparison-table.ts` lines 234-235, 391-392; `src/ui/drop-zone.ts` line 76
**Apply to:** All new `src/ui/` modules: `monthly-bars.ts`, `flow-chart.ts`, `transparency-panel.ts`, `tooltips.ts`

```typescript
// ALWAYS use .textContent for any string that could be user-derived or
// that renders a variable value. NEVER use .innerHTML for variable content.
nameSpan.textContent = battery.name   // battery name could be custom (user-derived)
p.textContent = message               // error messages — textContent
li.textContent = STATIC_COPY_CONST    // static copy — textContent
```

### No Inline Style (CSP `style-src 'self'`)
**Source:** `src/ui/comparison-table.ts` line 9; `src/styles/comparison-table.css` line 3
**Apply to:** Every new `.ts` and `.css` file in this phase

```typescript
// NEVER: element.style.left = '10px'
// NEVER: element.setAttribute('style', 'color: red')
// ALWAYS: element.classList.add('my-class')
// ALWAYS: element.className = 'my-class'
// uPlot color strings passed in opts object → canvas draw calls → CSP-exempt
```

### Effect Subscription Pattern
**Source:** `src/ui/comparison-table.ts` lines 422-480
**Apply to:** `src/ui/charts/monthly-bars.ts`, `src/ui/charts/flow-chart.ts`

```typescript
// The canonical pattern:
export function initXxx(container: HTMLElement): () => void {
  return effect(() => {
    const results = simResults.value
    const batteries = activeBatteries.value
    // read signals → update DOM / chart
  })
}
// Return value is the dispose function — callers MUST store it.
// Dispose is called on HMR teardown: import.meta.hot.dispose(() => dispose())
```

### CSS Custom Property Token Usage
**Source:** `src/styles/tokens.css`, `src/styles/results-region.css`, `src/styles/comparison-table.css`
**Apply to:** All four new CSS files

```css
/* All spacing, color, and typography values via tokens — no raw hex or px except
   where a token doesn't exist for the exact value (e.g. border-radius: 8px is
   consistent with comparison-table.css and results-region.css). */
padding: var(--space-md);
color: var(--color-text-muted);
font-size: var(--font-size-label);
```

### Error State Pattern
**Source:** `src/ui/comparison-table.ts` lines 62-68; `src/styles/results-region.css` lines 46-50
**Apply to:** `src/ui/charts/monthly-bars.ts`, `src/ui/charts/flow-chart.ts`

```typescript
// Reuse the existing .results-error CSS class — no new error class needed:
const p = document.createElement('p')
p.setAttribute('role', 'alert')
p.className = 'results-error'
p.textContent = 'Grafiek kon niet worden geladen. Probeer een ander tijdvenster of herlaad de pagina.'
```

### Vitest Node-Env Test Style (pure helpers)
**Source:** `tests/format.test.ts`, `tests/csp-plugin.test.ts`
**Apply to:** `tests/bucket-by-month.test.ts`, `tests/select-representative-week.test.ts`, `tests/terminology-audit.test.ts`

```typescript
// No @vitest-environment annotation = node env (project default).
// No DOM, no jsdom, no canvas.
// Imports: 'vitest' only + the module under test + fixture helpers.
import { describe, it, expect } from 'vitest'
```

### Vitest jsdom Test Style (DOM adapters)
**Source:** `tests/comparison-table.test.ts`, `tests/readout.test.ts`
**Apply to:** `tests/monthly-bars.test.ts`, `tests/flow-chart.test.ts`, `tests/transparency-panel.test.ts`, `tests/tooltips.test.ts`

```typescript
// First line MUST be: // @vitest-environment jsdom
// beforeEach: reset all signals to null/default; mount fresh container.
// afterEach: call dispose(); reset signals.
// XSS test: always include one test that passes a '<script>' string
//   and asserts container.querySelectorAll('script').length === 0.
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All files have a close analog. uPlot-specific config inside `monthly-bars.ts` and `flow-chart.ts` has no codebase analog — planner should copy directly from RESEARCH.md Patterns 1-7 for the uPlot constructor, `paths.stepped()`, `paths.bars()`, `setData()`, `setSize()`, `tzDate`, and color resolution. |

---

## Metadata

**Analog search scope:** `src/` and `tests/` (full tree)
**Files read:** 22 source files + 8 test files
**Pattern extraction date:** 2026-06-14
**Key invariant confirmed from live code:**
- `comparison-table.ts` `effect()` pattern (lines 422-480) — the canonical reactive UI adapter
- `gaps.ts` `TZDate` walk (lines 55-61) — the canonical Amsterdam local-time bucketing primitive
- `csp-plugin.test.ts` (lines 1-61) — the canonical CI contract-lock test structure
- `format.ts` `toFixed(1)` pattern (lines 9-11) — `formatAxisKwh` is a one-line extension
- All signals: `simResults`, `activeBatteries`, `isComputing` confirmed in `src/state/signals.ts`
- `colorFor()` / `colorSlotFor()` confirmed pure (no DOM globals) — safe in both node and browser
