# Phase 4: Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State — Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 14 new/modified files
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/workers/sim-worker.ts` | worker | request-response | `src/domain/compare.ts` (pure fn adapter) | partial — same domain, new role |
| `src/state/app-state.ts` | store | event-driven | `src/ui/drop-zone.ts` (state machine) | role-match (reactive state) |
| `src/helpers/metrics.ts` | utility | transform | `src/domain/period-filter.ts` | exact (pure transform) |
| `src/helpers/color.ts` | utility | transform | `src/domain/battery-catalog.ts` | role-match (pure data/mapping) |
| `src/helpers/format.ts` | utility | transform | `src/ui/readout.ts` (formatKwh, formatDate) | exact |
| `src/ui/battery-picker.ts` | component | request-response | `src/ui/drop-zone.ts` | role-match (DOM UI module) |
| `src/ui/comparison-table.ts` | component | event-driven | `src/ui/readout.ts` | exact (DOM renderer from data) |
| `src/ui/period-control.ts` | component | event-driven | `src/ui/drop-zone.ts` | role-match (DOM+event wiring) |
| `src/styles/battery-picker.css` | config | — | `src/styles/drop-zone.css` | exact |
| `src/styles/comparison-table.css` | config | — | `src/styles/drop-zone.css` | exact |
| `src/styles/results-region.css` | config | — | `src/styles/drop-zone.css` | exact |
| `src/constants/csp.ts` | config | — | `src/constants/csp.ts` (self) | exact (update in place) |
| `src/main.ts` | config | — | `src/main.ts` (self) | exact (update in place) |
| `tests/csp-plugin.test.ts` | test | — | `tests/csp-plugin.test.ts` (self) | exact (update in place) |

---

## Pattern Assignments

### `src/workers/sim-worker.ts` (worker entry, request-response)

**Analog:** `src/domain/compare.ts` (the pure function it wraps)

**Role:** Thin Comlink adapter — 5 lines max. Imports `runComparison` from the domain and exposes it. The worker entry is NOT the pure function — it only bridges the worker boundary.

**Imports pattern** (from RESEARCH.md Pattern 1):
```typescript
import * as Comlink from 'comlink'
import { runComparison } from '../domain/compare'
```

**Core pattern** (RESEARCH.md §Pattern 1 — worker side):
```typescript
// Expose only the functions the main thread needs.
// runComparison is pure and serialization-safe (SimResult contains
// plain numbers, Dates, and plain objects — no class instances, no functions).
Comlink.expose({ runComparison })
```

**Vitest dual-use:** Tests never import this file. They import `runComparison` directly from `src/domain/compare.ts`. This is not a pattern to copy in the worker file — it is a constraint to preserve (the worker entry has no test of its own beyond a smoke import test).

**CSP constraint:** The worker chunk is emitted by Vite as `assets/sim-worker-HASH.js` (same-origin URL, not blob). `worker-src blob:` alone blocks it. `src/constants/csp.ts` must be updated before this worker can instantiate in production (see `src/constants/csp.ts` section below).

---

### `src/state/app-state.ts` (store, event-driven)

**Analog:** `src/ui/drop-zone.ts` (stateful module pattern), `src/domain/period-filter.ts` (signal-derived computed)

**Role:** Single source of truth for all reactive signals. Owns the worker singleton. Exports writable signals + computed signals. UI modules read signals via `.value`; effects wire DOM reactions.

**Imports pattern** (RESEARCH.md §Pattern 2):
```typescript
import { signal, computed, effect, batch } from '@preact/signals-core'
import type { IntervalSample, BatteryConfig, SimResult } from '../domain/types'
import { filterByPeriod } from '../domain/period-filter'
import { BATTERY_CATALOG } from '../domain/battery-catalog'
import * as Comlink from 'comlink'
import SimWorker from '../workers/sim-worker?worker'
import type { runComparison } from '../domain/compare'
```

**Worker singleton pattern** (from RESEARCH.md §Pitfall 4 — construct once at module init, never inside effects):
```typescript
type SimApi = { runComparison: typeof runComparison }

// Singleton — constructed once at module init, never inside effects.
const _simWorker = new SimWorker()
export const simApi = Comlink.wrap<SimApi>(_simWorker)
```

**Writable signals** (RESEARCH.md §Pattern 2):
```typescript
export const parsedSamples    = signal<IntervalSample[]>([])
export const selectedBatteries = signal<BatteryConfig[]>([BATTERY_CATALOG[0]])
export const customBattery    = signal<Partial<BatteryConfig> | null>(null)
export const periodFrom       = signal<Date | null>(null)
export const periodTo         = signal<Date | null>(null)
export const simResults       = signal<SimResult[] | null>(null)
export const isComputing      = signal(false)
export const computeError     = signal<string | null>(null)
```

**Computed signals** (RESEARCH.md §Pattern 2 — must be read by an effect to trigger):
```typescript
export const filteredSamples = computed(() =>
  filterByPeriod(parsedSamples.value, periodFrom.value, periodTo.value)
)
export const coverageDays = computed(() => {
  const s = filteredSamples.value
  if (s.length < 2) return 0
  return Math.ceil(
    (s[s.length - 1].timestamp.getTime() - s[0].timestamp.getTime()) / 86_400_000
  )
})
export const activeBatteries = computed(() => {
  const cb = customBattery.value
  const valid = cb && (cb.nominalCapacityKwh ?? 0) > 0 ? [cb as BatteryConfig] : []
  return [...selectedBatteries.value, ...valid]
})
```

**Debounced worker invocation pattern** (RESEARCH.md §Pattern 3 — copied verbatim):
```typescript
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleRecompute(immediate = false): void {
  if (_debounceTimer) clearTimeout(_debounceTimer)
  const delay = immediate ? 0 : 400  // D-07: 400ms for continuous input
  _debounceTimer = setTimeout(async () => {
    const samples = filteredSamples.value
    const batteries = activeBatteries.value
    if (samples.length === 0 || batteries.length === 0) return
    isComputing.value = true
    computeError.value = null
    try {
      simResults.value = await simApi.runComparison(samples, batteries)
    } catch (err) {
      computeError.value =
        'Berekening mislukt. Controleer of je gegevens volledig zijn en probeer het opnieuw.'
      simResults.value = null
    } finally {
      isComputing.value = false
    }
  }, delay)
}
```

**Effect disposal pattern** (from RESEARCH.md §Pitfall 3 — always store dispose):
```typescript
// In UI modules: always capture dispose to avoid effect accumulation.
// Pattern from src/ui/drop-zone.ts module-level init approach:
const _disposeFns: Array<() => void> = []

export function initSomeUiModule(el: HTMLElement): void {
  _disposeFns.push(
    effect(() => {
      // reactive body
    })
  )
}

export function teardownSomeUiModule(): void {
  _disposeFns.forEach((d) => d())
  _disposeFns.length = 0
}
```

---

### `src/helpers/metrics.ts` (utility, transform)

**Analog:** `src/domain/period-filter.ts` (lines 1–45)

**Role:** Pure presentation-layer math. Node-env Vitest testable. Computes saldering framing from `SimResult` aggregates. Contains `deriveMetrics`, `avoidedWithoutSaldering`, `avoidedWithSaldering`, `netImportWithValuation`, `detectLeaders`.

**File header pattern** (mirrors `period-filter.ts` lines 1–7):
```typescript
/**
 * src/helpers/metrics.ts — presentation-layer metric derivations (COMP-01, D-01..D-04)
 *
 * Pure functions — no browser globals, safe to run in a Node environment.
 * Vitest node env. Saldering framing is a Phase 4 presentation layer — NOT in the engine.
 */
import type { SimResult } from '../domain/types'
```

**Core saldering framing pattern** (RESEARCH.md §Pattern 4 — copy verbatim):
```typescript
// D-01: Saldering OFF — avoided = kWh shifted (export worth nothing)
export function avoidedWithoutSaldering(sim: SimResult): number {
  return sim.shiftedKwh
}

// D-01: Saldering ON — 1:1 annual netting; can be negative (D-02: don't floor)
export function avoidedWithSaldering(sim: SimResult): number {
  const baselineNet = Math.max(0, sim.totalImportKwh - sim.totalExportKwh)
  const batteryNet  = Math.max(0, sim.residualImportKwh - sim.residualExportKwh)
  return baselineNet - batteryNet  // can be negative — D-02: show as-is
}

// D-04: pluggable feed-in valuation seam (v1: feedInValue = 0 or 1)
export function netImportWithValuation(
  residualImportKwh: number,
  residualExportKwh: number,
  feedInValue: 0 | 1,
): number {
  return residualImportKwh - feedInValue * residualExportKwh
}
```

**DerivedMetrics interface and deriveMetrics function** (RESEARCH.md §Pattern 4):
```typescript
export interface DerivedMetrics {
  avoidedOff:          number
  avoidedOn:           number
  selfConsumptionPct:  number
  shiftedKwh:          number
  residualImportKwh:   number
  residualExportKwh:   number
  marginalBenutting:   number
}

export function deriveMetrics(sim: SimResult, usableCapacityKwh: number): DerivedMetrics {
  return {
    avoidedOff:         avoidedWithoutSaldering(sim),
    avoidedOn:          avoidedWithSaldering(sim),
    selfConsumptionPct: sim.totalImportKwh > 0
      ? Math.min(100, (sim.shiftedKwh / sim.totalImportKwh) * 100) : 0,
    shiftedKwh:         sim.shiftedKwh,
    residualImportKwh:  sim.residualImportKwh,
    residualExportKwh:  sim.residualExportKwh,
    marginalBenutting:  usableCapacityKwh >= 0.1
      ? sim.shiftedKwh / usableCapacityKwh : 0,
  }
}
```

**Leader detection pattern** (RESEARCH.md §Pattern 6):
```typescript
export type MetricKey = keyof DerivedMetrics

const HIGHER_IS_BETTER: Set<MetricKey> = new Set([
  'avoidedOff', 'avoidedOn', 'selfConsumptionPct', 'shiftedKwh', 'marginalBenutting',
])

export function detectLeaders(all: DerivedMetrics[]): Map<MetricKey, number> {
  const keys: MetricKey[] = [
    'avoidedOff', 'avoidedOn', 'selfConsumptionPct', 'shiftedKwh',
    'residualImportKwh', 'residualExportKwh', 'marginalBenutting',
  ]
  const leaders = new Map<MetricKey, number>()
  for (const key of keys) {
    let best = -1
    let bestVal = HIGHER_IS_BETTER.has(key) ? -Infinity : Infinity
    all.forEach((m, i) => {
      const v = m[key]
      if (HIGHER_IS_BETTER.has(key) ? v > bestVal : v < bestVal) {
        bestVal = v; best = i
      }
    })
    if (best >= 0) leaders.set(key, best)
  }
  return leaders
}
```

---

### `src/helpers/color.ts` (utility, transform)

**Analog:** `src/domain/battery-catalog.ts` (lines 1–17, pure const data + `as const`)

**Role:** Pure helper — `colorFor(batteryId, orderedSelection)` returns a CSS var string. `colorSlotFor` returns the 1-indexed slot number for class-based swatch rendering. Node-env Vitest testable. Consumed by Phase 5 charts without modification.

**File header pattern** (mirrors `battery-catalog.ts`):
```typescript
/**
 * src/helpers/color.ts — per-battery color slot mapping (COMP-04, D-11)
 *
 * Pure functions — no browser globals, safe to run in a Node environment.
 * colorFor() is stable into Phase 5 charts: called with the same selection order.
 * Swatch rendering uses CSS classes (.battery-swatch--N) — no inline style= (CSP).
 */
```

**Core pattern** (RESEARCH.md §Pattern 5 — copy verbatim):
```typescript
// Source: 04-UI-SPEC.md §"Per-Battery Color Slots"
const COLOR_SLOTS = [
  'var(--color-battery-1)',  // #2563eb — slot 1
  'var(--color-battery-2)',  // #16a34a — slot 2
  'var(--color-battery-3)',  // #d97706 — slot 3
  'var(--color-battery-4)',  // #9333ea — slot 4
  'var(--color-battery-5)',  // #e11d48 — slot 5
] as const

export function colorFor(batteryId: string, orderedSelection: string[]): string {
  const idx = orderedSelection.indexOf(batteryId)
  if (idx === -1 || idx >= COLOR_SLOTS.length) return COLOR_SLOTS[0]
  return COLOR_SLOTS[idx]
}

export function colorSlotFor(batteryId: string, orderedSelection: string[]): number {
  const idx = orderedSelection.indexOf(batteryId)
  return idx === -1 ? 1 : idx + 1  // 1-indexed for .battery-swatch--N
}
```

---

### `src/helpers/format.ts` (utility, transform)

**Analog:** `src/ui/readout.ts` lines 17–34 (the formatter functions `formatRows`, `formatKwh`, `formatDate`)

**Role:** Extracted formatting utilities used by `comparison-table.ts` and `period-control.ts`. These are standalone exports of the same formatting patterns already established in `readout.ts`.

**Imports pattern** (pure — no imports needed):
```typescript
/**
 * src/helpers/format.ts — display-layer number/date formatters (VIZ-04 spirit)
 *
 * Pure functions — no browser globals, safe to run in a Node environment.
 * All kWh values: exactly 1 decimal place (toFixed(1)). Percentages: 1 decimal + '%'.
 */
```

**Core pattern** (extracted verbatim from `src/ui/readout.ts` lines 23–34):
```typescript
/** Format an energy value to 1 decimal place with kWh suffix (matches readout.ts formatKwh) */
export function formatKwh(n: number): string {
  return `${n.toFixed(1)} kWh`
}

/** Format a percentage to 1 decimal place with % suffix */
export function formatPct(n: number): string {
  return `${n.toFixed(1)} %`
}

/** Format a ratio (marginalBenutting) to 2 decimal places */
export function formatRatio(n: number): string {
  return n.toFixed(2)
}

/** Format a Date as DD-MM-YYYY in nl-NL locale (matches readout.ts formatDate) */
export function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Format an integer count with Dutch thousands separator (matches readout.ts formatRows) */
export function formatCount(n: number): string {
  return n.toLocaleString('nl-NL')
}
```

---

### `src/ui/battery-picker.ts` (component, request-response)

**Analog:** `src/ui/drop-zone.ts` (full file — same DOM-building + event-listener + state-machine pattern)

**Role:** Renders the battery spec-card grid inside `#drop-zone-region`. Reads from `BATTERY_CATALOG` and `selectedBatteries` signal. Writes to `selectedBatteries` and `customBattery` signals on interaction. Calls `scheduleRecompute(true)` on discrete changes.

**File header pattern** (mirrors `drop-zone.ts` lines 1–14):
```typescript
/**
 * src/ui/battery-picker.ts — battery spec-card picker (BATT-03, BATT-04, BATT-05, D-05, D-06)
 *
 * initBatteryPicker() wires the battery card grid inside #drop-zone-region.
 * Renders spec cards from BATTERY_CATALOG; Sessy 5 pre-checked (BATT-03).
 * Custom "+ Eigen batterij" card at the end (D-06).
 *
 * XSS safety: ALL user-derived strings (custom battery name) use .textContent.
 * No inline style assignments — all state via CSS class swaps (style-src 'self' CSP).
 */
import { effect } from '@preact/signals-core'
import { selectedBatteries, customBattery, scheduleRecompute } from '../state/app-state'
import { BATTERY_CATALOG } from '../domain/battery-catalog'
import type { BatteryConfig } from '../domain/types'
import { colorSlotFor } from '../helpers/color'
```

**DOM-building helper pattern** (mirrors `readout.ts` `appendField` at lines 44–53 — create element, set textContent, append):
```typescript
function createCard(battery: BatteryConfig, slotN: number, checked: boolean, disabled: boolean): HTMLLIElement {
  const li = document.createElement('li')
  // class toggling mirrors drop-zone.ts setState pattern
  li.className = [
    'battery-card',
    checked ? 'battery-card--selected' : '',
    disabled ? 'battery-card--disabled' : '',
  ].filter(Boolean).join(' ')
  li.dataset.batteryId = battery.id   // data-battery-id hook for Phase 5

  const label = document.createElement('label')
  label.className = 'battery-card__label'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.className = 'battery-card__checkbox'
  checkbox.checked = checked
  checkbox.disabled = disabled
  if (disabled) checkbox.title = 'Deselecteer een batterij om een andere te kiezen'

  const swatch = document.createElement('span')
  swatch.className = `battery-card__swatch battery-swatch--${slotN}`

  const name = document.createElement('span')
  name.className = 'battery-card__name'
  name.textContent = battery.name  // textContent — XSS safe

  label.appendChild(checkbox)
  label.appendChild(swatch)
  label.appendChild(name)
  li.appendChild(label)
  // ... spec dl appended here
  return li
}
```

**Init function pattern** (mirrors `initDropZone` signature from `drop-zone.ts` lines 153–230):
```typescript
// dispose array mirrors RESEARCH.md §Pitfall 3
const _disposeFns: Array<() => void> = []

export function initBatteryPicker(region: HTMLElement): void {
  // Build the section and card grid imperatively
  // Wire checkbox change listeners to write selectedBatteries signal
  // Wire custom card expand/input to write customBattery signal
  // Attach reactive effect for re-render on signal change
  _disposeFns.push(
    effect(() => {
      const selected = selectedBatteries.value
      // re-render card states (checked/disabled) from signal
    })
  )
}
```

**Max-5 cap enforcement** (mirrors `drop-zone.ts` `filterCsvFiles` guard pattern — check before action):
```typescript
const MAX_SELECTED = 5
// On checkbox change:
if (!currentlyChecked && selectedBatteries.value.length >= MAX_SELECTED) {
  // No-op; card is already disabled by the effect — defensive guard
  return
}
```

---

### `src/ui/comparison-table.ts` (component, event-driven)

**Analog:** `src/ui/readout.ts` (full file — same "build DOM from data, return element" pattern)

**Role:** Renders and updates the `<table class="comparison-table">` inside `#results-region`. Driven by `simResults` and `activeBatteries` signals via `effect()`. Calls `deriveMetrics`, `detectLeaders`, `colorSlotFor`, formatters.

**File header pattern** (mirrors `readout.ts` lines 1–11):
```typescript
/**
 * src/ui/comparison-table.ts — comparison table renderer (COMP-01..08, D-08..D-11)
 *
 * initComparisonTable() wires the reactive effect that rebuilds the table whenever
 * simResults or activeBatteries signals change. Returns a dispose function.
 *
 * XSS safety: ALL user-derived strings use .textContent — never .innerHTML.
 * No inline style assignments — all state via CSS class swaps (style-src 'self' CSP).
 */
import { effect } from '@preact/signals-core'
import { simResults, activeBatteries, isComputing, computeError } from '../state/app-state'
import { deriveMetrics, detectLeaders } from '../helpers/metrics'
import { colorSlotFor } from '../helpers/color'
import { formatKwh, formatPct, formatRatio } from '../helpers/format'
import type { SimResult, BatteryConfig } from '../domain/types'
```

**Effect-driven render pattern** (RESEARCH.md §Pattern, code example "Signals Effect Driving DOM Table Update"):
```typescript
export function initComparisonTable(container: HTMLElement): () => void {
  return effect(() => {
    const results = simResults.value
    const batteries = activeBatteries.value
    const computing = isComputing.value
    const error = computeError.value

    // Dim stale table while computing (SIM-08)
    const tableWrapper = container.querySelector('.table-scroll-wrapper')
    if (tableWrapper) tableWrapper.classList.toggle('results-stale', computing)

    if (error) {
      renderError(container, error)
      return
    }
    if (!results || batteries.length === 0) {
      renderEmpty(container)
      return
    }
    renderTable(container, results, batteries)
  })
}
```

**Table body builder** (mirrors `readout.ts` `buildFileGroup` pattern — createElement per cell, textContent for values):
```typescript
function renderTable(
  container: HTMLElement,
  results: SimResult[],
  batteries: BatteryConfig[],
): void {
  const orderedIds = batteries.map((b) => b.id)
  const allMetrics = results.map((r, i) =>
    deriveMetrics(r, batteries[i].nominalCapacityKwh * batteries[i].dodFraction)
  )
  const leaders = detectLeaders(allMetrics)

  // Build one <tr> per battery
  const tbody = container.querySelector('tbody')
  if (!tbody) return
  tbody.innerHTML = ''  // clear previous rows (safe — no user HTML goes here)

  batteries.forEach((battery, i) => {
    const m = allMetrics[i]
    const slot = colorSlotFor(battery.id, orderedIds)
    const tr = document.createElement('tr')
    tr.className = 'battery-row'
    tr.dataset.batteryId = battery.id  // D-12 Phase 5 hook

    // Name cell with swatch
    const tdName = document.createElement('td')
    tdName.className = 'battery-row__name'
    const swatch = document.createElement('span')
    swatch.className = `battery-swatch battery-swatch--${slot}`
    const nameSpan = document.createElement('span')
    nameSpan.className = 'battery-row__label'
    nameSpan.textContent = battery.name  // textContent — XSS safe (custom battery name)
    tdName.appendChild(swatch)
    tdName.appendChild(nameSpan)
    tr.appendChild(tdName)

    // Metric cells — the leader class pattern (COMP-03)
    function metricCell(value: string, metricKey: string, rowIdx: number, extraClass = ''): HTMLTableCellElement {
      const td = document.createElement('td')
      const isLeader = leaders.get(metricKey as never) === rowIdx
      td.className = [
        isLeader ? 'table-cell--leader' : '',
        extraClass,
      ].filter(Boolean).join(' ')
      td.dataset.metric = metricKey  // D-12 Phase 5 hook
      td.textContent = value         // textContent — formatted number string
      return td
    }
    // ... append cells
    tbody.appendChild(tr)
  })
}
```

**Error/empty state pattern** (mirrors `drop-zone.ts` `showError`/`showStatus` pattern):
```typescript
function renderEmpty(container: HTMLElement): void {
  // Clear table, show empty state paragraph
  const p = document.createElement('p')
  p.className = 'results-empty'
  p.textContent = 'Selecteer minimaal één batterij om te vergelijken.'
}

function renderError(container: HTMLElement, message: string): void {
  const p = document.createElement('p')
  p.setAttribute('role', 'alert')
  p.className = 'results-error'
  p.textContent = message  // textContent — internal error string, not user data
}
```

**Saldering disclaimer toggle** (D-14 — mirrors `drop-zone.ts` aria-expanded toggle pattern):
```typescript
function wireSalderingDisclaimer(table: HTMLTableElement): void {
  const btn = table.querySelector('.saldering-info-btn') as HTMLButtonElement | null
  const disclaimer = document.getElementById('saldering-disclaimer')
  if (!btn || !disclaimer) return
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true'
    btn.setAttribute('aria-expanded', String(!expanded))
    disclaimer.hidden = expanded
  })
}
```

---

### `src/ui/period-control.ts` (component, event-driven)

**Analog:** `src/ui/drop-zone.ts` (DOM init + event listener wiring pattern)

**Role:** Renders the two `<input type="date">` fields and the coverage indicator. Writes to `periodFrom` / `periodTo` signals on change. Reads `coverageDays` computed for the indicator. Calls `scheduleRecompute(true)` on date change.

**File header and imports pattern** (mirrors `drop-zone.ts` lines 1–19):
```typescript
/**
 * src/ui/period-control.ts — interactive period-narrowing control (DATA-12, D-19)
 *
 * initPeriodControl() renders the date-range inputs and coverage indicator.
 * Wires date change events to update periodFrom/periodTo signals → live recompute.
 * Coverage indicator updates immediately on date change (before worker returns).
 *
 * No inline style assignments — all state via CSS class swaps (style-src 'self' CSP).
 */
import { effect } from '@preact/signals-core'
import {
  parsedSamples, periodFrom, periodTo,
  coverageDays, scheduleRecompute,
} from '../state/app-state'
import { fullRange } from '../domain/period-filter'
```

**Coverage indicator update pattern** (mirrors `drop-zone.ts` `showStatus` — textContent only):
```typescript
function updateCoverageIndicator(el: HTMLElement, days: number): void {
  // textContent — formatted integer, no user data
  el.textContent = days === 1 ? '1 dag aan data' : `${days} dagen aan data`
}
```

**Init and effect wiring** (mirrors `initDropZone` structure — one init function, effect for reactive updates):
```typescript
const _disposeFns: Array<() => void> = []

export function initPeriodControl(container: HTMLElement): void {
  // Build date inputs and coverage indicator elements
  // Set min/max from fullRange(parsedSamples.value) on init + on parsedSamples change
  // Wire 'change' events on date inputs to write signals

  _disposeFns.push(
    effect(() => {
      // Update coverage indicator text reactively from coverageDays computed
      const days = coverageDays.value
      const indicator = container.querySelector('.period-coverage') as HTMLElement | null
      if (indicator) updateCoverageIndicator(indicator, days)
    })
  )
}
```

---

### `src/styles/battery-picker.css` (config)

**Analog:** `src/styles/drop-zone.css` (full file — the pattern for all Phase CSS files)

**Pattern to follow** (from `drop-zone.css` lines 1–7, header comment):
```css
/* src/styles/battery-picker.css */
/* Battery spec-card picker styles. */
/* No inline styles anywhere — required by style-src 'self' CSP (D-03). */
/* Note: base region rules live in global.css — do NOT re-declare them here. */
```

**Token reference pattern** (from `drop-zone.css` lines 13–87 — use var(--token) throughout, no raw values):
```css
/* ── Card base ─────────────────────────────────────────────────────────── */
.battery-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg);
  padding: var(--space-md);
}
.battery-card--selected {
  border: 2px solid var(--color-accent);
}
.battery-card--disabled {
  background-color: var(--color-surface);
  color: var(--color-text-muted);
  opacity: 0.6;
  cursor: not-allowed;
}
/* ── Battery swatch color slots ──────────────────────────────────────────── */
/* 5 classes using the existing --color-battery-N tokens from tokens.css */
.battery-swatch--1 { background-color: var(--color-battery-1); }
.battery-swatch--2 { background-color: var(--color-battery-2); }
.battery-swatch--3 { background-color: var(--color-battery-3); }
.battery-swatch--4 { background-color: var(--color-battery-4); }
.battery-swatch--5 { background-color: var(--color-battery-5); }
```

**Min-height touch target** (from `drop-zone.css` `.file-picker-label` at line 62):
```css
/* WCAG 2.5.5: all interactive elements min-height 44px */
.battery-card__label {
  min-height: 44px;
}
.battery-card__expand {
  min-height: 44px;
}
```

---

### `src/styles/comparison-table.css` (config)

**Analog:** `src/styles/drop-zone.css`

**Pattern to follow** — same header comment structure, same token-only approach:
```css
/* src/styles/comparison-table.css */
/* Comparison table, leader highlight, saldering columns, disclaimer. */
/* No inline styles anywhere — required by style-src 'self' CSP (D-03). */
```

**Leader and negative cell classes** (from UI-SPEC §"Leader highlight treatment"):
```css
/* Leader cell: semibold + surface tint — separate from battery identity color (D-11) */
.table-cell--leader {
  font-weight: var(--font-weight-semibold);
  background-color: var(--color-surface);
}

/* Negative saldering-ON value (D-02 — show as-is, not floored) */
.table-cell--negative {
  color: var(--color-destructive);
}

/* Muted saldering-ON column */
.col-muted {
  color: var(--color-text-muted);
}

/* Stale results dimming while worker computes (SIM-08) */
.results-stale {
  opacity: 0.5;
  pointer-events: none;
}
```

---

### `src/styles/results-region.css` (config)

**Analog:** `src/styles/drop-zone.css`

**Coarse-cadence banner pattern** (from UI-SPEC §"Coarse-Cadence Warning Banner"):
```css
/* src/styles/results-region.css */
/* Results-region layout: banner, indicator, compute status, empty/error states. */

/* Coarse-cadence warning banner (D-13) */
.cadence-banner {
  border-left: 4px solid var(--color-destructive);
  background-color: rgb(220 38 38 / 0.08); /* destructive at 8% — one-off, matches drop-zone dragover pattern */
  padding: var(--space-md);
  border-radius: 4px;
}

/* Compute indicator — muted, label size (SIM-08) */
.compute-indicator {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

/* Empty state — muted body text */
.results-empty {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
  padding: var(--space-md);
}

/* Error state — destructive body text, matches drop-zone .parse-error */
.results-error {
  font-size: var(--font-size-body);
  color: var(--color-destructive);
}
```

---

### `src/constants/csp.ts` (config — update in place)

**Analog:** `src/constants/csp.ts` (self — update one line)

**Current state** (lines 23–24 of existing file):
```typescript
// DATA-13: PapaParse worker: true creates its worker via a blob URL.
// worker-src blob: is the minimal relaxation; connect-src 'none' stays unchanged.
"worker-src blob:",
```

**Required change** (RESEARCH.md §Pitfall 1 — Vite ?worker chunk lands at 'self' origin, not blob):
```typescript
// DATA-13 + Phase 4 Comlink worker:
// PapaParse blob worker requires blob:; Vite ?worker chunk requires 'self' (assets/xxx.js).
// Both must be whitelisted.
"worker-src 'self' blob:",
```

The accompanying comment block explaining the reason should be updated to mention both workers.

---

### `src/main.ts` (config — update in place)

**Analog:** `src/main.ts` (self — extend the existing init sequence)

**Current pattern** (lines 1–22 of existing file):
```typescript
import './styles/global.css'
import './styles/drop-zone.css'
import { renderShell } from './shell'
import { initDropZone } from './ui/drop-zone'

const app = document.getElementById('app')
if (app && app.children.length === 0) {
  renderShell(app)
}

const dropZoneRegion = document.getElementById('drop-zone-region')
if (dropZoneRegion) {
  initDropZone(dropZoneRegion)
}
```

**Phase 4 extension pattern** (add after existing imports and init, following the same null-guard pattern):
```typescript
// Phase 4 additions:
import './styles/battery-picker.css'
import './styles/comparison-table.css'
import './styles/results-region.css'
import { initBatteryPicker } from './ui/battery-picker'
import { initPeriodControl } from './ui/period-control'
import { initComparisonTable } from './ui/comparison-table'
// (app-state module self-initializes its worker singleton on import)

// Re-wire drop-zone: initDropZone already wired above.
// Battery picker mounts inside the same #drop-zone-region (D-16):
if (dropZoneRegion) {
  initBatteryPicker(dropZoneRegion)
}

// Period control and comparison table fill #results-region:
const resultsRegion = document.getElementById('results-region')
if (resultsRegion) {
  initPeriodControl(resultsRegion)
  initComparisonTable(resultsRegion)
}
```

---

### `tests/csp-plugin.test.ts` (test — update in place)

**Analog:** `tests/csp-plugin.test.ts` (self — update one assertion)

**Current test** (line 39):
```typescript
it("contains worker-src blob:", () => {
  expect(CSP).toContain("worker-src blob:")
})
```

**Updated test** (new assertion after the CSP constant update):
```typescript
it("contains worker-src 'self' blob:", () => {
  expect(CSP).toContain("worker-src 'self' blob:")
})
```

The test at line 39 must be updated (not an additional test) so it continues to be a strict contract assertion. The old `"worker-src blob:"` string is still a substring of `"worker-src 'self' blob:"` — but for clarity and intent, the test should match the exact new directive.

---

## New Test Files (no analog — greenfield tests following existing test patterns)

These tests follow the established patterns in `tests/compare.test.ts` (node env) and `tests/drop-zone.test.ts` / `tests/readout.test.ts` (jsdom env).

| New Test File | Env | Closest Pattern File | Key Pattern to Copy |
|---------------|-----|---------------------|---------------------|
| `tests/metrics.test.ts` | node | `tests/compare.test.ts` | `describe` + `it` + `expect().toBeCloseTo()` for float assertions; fixture `SimResult` objects |
| `tests/color.test.ts` | node | `tests/compare.test.ts` | `describe` + `it` + `expect().toBe()` for string slot assertions |
| `tests/app-state.test.ts` | node | `tests/period-filter.test.ts` | Signal `.value` reads; no worker instantiation (mock or skip) |
| `tests/comparison-table.test.ts` | jsdom | `tests/readout.test.ts` | `// @vitest-environment jsdom` docblock; `makeResult` fixture; `el.textContent` / `querySelector` assertions |
| `tests/period-control.test.ts` | jsdom | `tests/drop-zone.test.ts` | `// @vitest-environment jsdom`; `renderShell` setup; event dispatch; `.getAttribute` assertions |
| `tests/sim-worker-contract.test.ts` | node | `tests/compare.test.ts` | Import `runComparison` directly (never instantiate worker) — smoke import test only |

**Node test fixture pattern** (from `tests/compare.test.ts` lines 17–28 — copy the `sample()` helper idiom):
```typescript
function sample(utcMs: number, gridImportKwh = 0.1, gridExportKwh = 0.05): IntervalSample {
  return { timestamp: new Date(utcMs), gridImportKwh, gridExportKwh }
}
const T0 = Date.UTC(2026, 0, 15, 8, 0, 0)
const INTERVAL_MS = 15 * 60 * 1000
```

**jsdom test setup pattern** (from `tests/readout.test.ts` lines 22–54 and `tests/drop-zone.test.ts` lines 23–32):
```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderShell } from '../src/shell'

function setupResultsRegion(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div>'
  const host = document.getElementById('app') as HTMLElement
  renderShell(host)
  return document.getElementById('results-region') as HTMLElement
}

describe('...', () => {
  let container: HTMLElement
  beforeEach(() => { container = setupResultsRegion() })
  // ...
})
```

**Float assertion pattern** (from `tests/compare.test.ts` line 71 — always `toBeCloseTo` for computed kWh, never `toBe`):
```typescript
expect(result.avoidedOff).toBeCloseTo(expectedKwh, 9)
```

**XSS safety assertion pattern** (from `tests/readout.test.ts` lines 182–194 — verify textContent, not script injection):
```typescript
it('renders custom battery name as inert text, not as a live element (XSS)', () => {
  const maliciousName = '<script>alert("xss")</script>'
  // custom battery name must appear as .textContent, not parsed HTML
  expect(el.querySelectorAll('script').length).toBe(0)
  expect(el.textContent).toContain(maliciousName)
})
```

---

## Shared Patterns

### 1. XSS Safety — `.textContent` for All User-Derived Strings
**Source:** `src/ui/drop-zone.ts` lines 63–74 and `src/ui/readout.ts` lines 44–53
**Apply to:** `battery-picker.ts` (custom battery name), `comparison-table.ts` (battery name, file name display), `period-control.ts`

```typescript
// ALWAYS use .textContent for any string that originates from user input
// or file system (file names, custom battery field values, error messages
// that embed file-derived content).
el.textContent = userDerivedString  // textContent — XSS safe; never .innerHTML
```

The existing jsdoc comment convention: `// textContent — XSS safe; [what goes here]`

### 2. CSS Class State Machine — No Inline Styles
**Source:** `src/ui/drop-zone.ts` lines 35–38 (`setState` function)
**Apply to:** All UI modules — battery picker card states, comparison table stale state, banner visibility

```typescript
// Pattern from drop-zone.ts lines 35-38:
function setState(region: HTMLElement, state: DropZoneState): void {
  region.classList.remove(...STATE_CLASSES)
  region.classList.add(`drop-zone--${state}`)
}
// Phase 4 equivalent for any state: classList.toggle('class-name', condition)
tableWrapper.classList.toggle('results-stale', isComputing.value)
li.classList.toggle('battery-card--selected', isSelected)
```

The invariant: **no `element.style.X = ...` assignments anywhere**. All visual state changes via class swaps. CSP `style-src 'self'` prohibits inline styles.

### 3. `aria-live` / `role="alert"` for Status/Error Updates
**Source:** `src/ui/drop-zone.ts` lines 58–76 (`showStatus`, `showError`)
**Apply to:** `comparison-table.ts` error state, `period-control.ts` coverage indicator, `comparison-table.ts` coarse-cadence banner, "Rekenen..." indicator

```typescript
// Status (polite — non-urgent): aria-live="polite"
// Error (urgent): role="alert"
// Coarse-cadence banner: role="alert" (D-13 — visually prominent, user action needed)
// Coverage indicator: aria-live="polite" (COMP-08)
// Rekenen indicator: aria-live="polite" + aria-busy="true"
const p = document.createElement('p')
p.setAttribute('aria-live', 'polite')  // or role="alert"
p.textContent = message
```

### 4. Effect Disposal Pattern
**Source:** RESEARCH.md §Pitfall 3, §Code Examples "initComparisonTable"
**Apply to:** Every `initXxx()` function that calls `effect()`

```typescript
// Every initXxx() returns the dispose function from effect().
// Callers store it and call it on teardown or hot-reload.
export function initXxx(container: HTMLElement): () => void {
  return effect(() => { /* reactive body */ })
}
// OR for multiple effects in one module:
const _disposeFns: Array<() => void> = []
export function teardown(): void {
  _disposeFns.forEach((d) => d())
  _disposeFns.length = 0
}
```

### 5. Module-Level File Header Comment Convention
**Source:** `src/domain/compare.ts` lines 1–8, `src/ui/drop-zone.ts` lines 1–14
**Apply to:** All new `src/` files

Every file opens with a `/** ... */` JSDoc block that names:
1. The file path
2. The requirement IDs it satisfies
3. "Pure function — no browser globals" for domain/helper files
4. XSS safety and CSP notes for UI files
5. The public API surface (what `initXxx` does or what the export is)

### 6. `data-*` Attribute Hooks for Phase 5 CSS Reflow
**Source:** UI-SPEC §5 "Responsive structure" (D-12)
**Apply to:** `comparison-table.ts` — all `<tr>`, `<th>`, `<td>` elements

```typescript
tr.dataset.batteryId = battery.id       // data-battery-id
th.dataset.metric = 'avoidedOff'        // data-metric
td.dataset.metric = metricKey           // data-metric
td.dataset.label = columnHeaderText     // data-label (for Phase 5 stacked card reflow)
```

Phase 5's UX-04 CSS pass reads these attributes with `[data-metric]` selectors to reflow the table into stacked cards — the HTML structure must not change.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All Phase 4 files have close analogs in the existing codebase or are covered verbatim by the RESEARCH.md patterns. The Comlink worker pattern has no existing analog but RESEARCH.md §Code Examples provides a complete, verified template. |

---

## Metadata

**Analog search scope:** `src/domain/`, `src/ui/`, `src/styles/`, `src/constants/`, `src/shell.ts`, `src/main.ts`, `tests/`
**Files scanned:** 20 source files + 20 test files
**Patterns extraction date:** 2026-06-11
