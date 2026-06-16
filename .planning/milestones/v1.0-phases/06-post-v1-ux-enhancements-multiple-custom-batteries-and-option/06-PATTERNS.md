# Phase 6: Post-v1 UX Enhancements — Multiple Custom Batteries + Optional Saldering - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 6 primary (3 modified, 3 reused as-is)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/state/signals.ts` | store (writable + computed signals) | event-driven | `src/state/signals.ts` itself | self — internal extension |
| `src/state/app-state.ts` | store facade + re-export | event-driven | `src/state/app-state.ts` itself | self — re-export list update only |
| `src/ui/battery-picker.ts` | UI component | event-driven | `src/ui/battery-picker.ts` itself | self — generalization of existing patterns |
| `src/ui/comparison-table.ts` | UI component | event-driven | `src/ui/comparison-table.ts` itself | self — conditional column layout |
| `src/helpers/color.ts` | utility | transform | no change needed | reused as-is |
| `src/helpers/metrics.ts` | utility | transform | no change needed | reused as-is |

---

## Pattern Assignments

### `src/state/signals.ts` — collection signal + saldering boolean

**Role:** writable signal store (node-safe, no browser globals)

**Analog:** the existing file; the new signals follow exactly the same shape.

**Existing signal declaration pattern** (`src/state/signals.ts` lines 34-59):
```typescript
/** Raw merged samples from the last successful CSV parse. Initial: empty array. */
export const parsedSamples = signal<IntervalSample[]>([])

/** Batteries selected in the picker. Initial: [Sessy 5] (BATT-03 NL default). */
export const selectedBatteries = signal<BatteryConfig[]>([BATTERY_CATALOG[0]])

/**
 * Partial config from the custom battery form, or null when not configured.
 * Only appended to activeBatteries when nominalCapacityKwh > 0 (T-04-06).
 */
export const customBattery = signal<Partial<BatteryConfig> | null>(null)
```

**New signals to add — follow the same JSDoc + export pattern:**
- Replace `customBattery` with `customBatteries: signal<BatteryConfig[]>([])` (empty array initial value, not null).
- Add `salderingOn: signal<boolean>(false)` (boolean, default `false` per D-06).

**Existing computed pattern** (`src/state/signals.ts` lines 90-94):
```typescript
export const activeBatteries = computed(() => {
  const cb = customBattery.value
  const valid = cb !== null && (cb.nominalCapacityKwh ?? 0) > 0 ? [cb as BatteryConfig] : []
  return [...selectedBatteries.value, ...valid]
})
```

**New `activeBatteries` must follow the same spread pattern** — filter `customBatteries` array to only those with `nominalCapacityKwh > 0`, then spread at the end:
```typescript
export const activeBatteries = computed(() => {
  const validCustoms = customBatteries.value.filter(
    (cb) => (cb.nominalCapacityKwh ?? 0) > 0,
  )
  return [...selectedBatteries.value, ...validCustoms]
})
```

**Module-level comment block** (`src/state/signals.ts` lines 1-24): update the Signal contract docblock to document `customBatteries: signal<BatteryConfig[]>` and `salderingOn: signal<boolean>` in place of `customBattery`. The Computed contract block must update `activeBatteries` description to reflect array-of-customs.

**Import pattern** (`src/state/signals.ts` lines 25-29):
```typescript
import { signal, computed } from '@preact/signals-core'
import type { IntervalSample, BatteryConfig, SimResult } from '../domain/types'
import { filterByPeriod } from '../domain/period-filter'
import { BATTERY_CATALOG } from '../domain/battery-catalog'
```
No new imports needed.

---

### `src/state/app-state.ts` — re-export list update

**Role:** store facade; no logic change — only re-export list.

**Existing re-export block** (`src/state/app-state.ts` lines 21-33):
```typescript
export {
  parsedSamples,
  selectedBatteries,
  customBattery,
  periodFrom,
  periodTo,
  simResults,
  isComputing,
  computeError,
  filteredSamples,
  coverageDays,
  activeBatteries,
} from './signals'
```

Replace `customBattery` with `customBatteries` and add `salderingOn`. Identical structure, one name swap + one addition.

**Internal import block** (`src/state/app-state.ts` lines 37-42) for `_runCompute`:
```typescript
import {
  filteredSamples,
  activeBatteries,
  simResults,
  isComputing,
  computeError,
} from './signals'
```
No change needed here — `_runCompute` reads only `filteredSamples` and `activeBatteries`, both of which still exist.

**scheduleRecompute call sites in new code** — copy the exact two-argument signature:
```typescript
scheduleRecompute(true)   // discrete change (checkbox, remove button, saldering toggle)
scheduleRecompute(false)  // debounced continuous input (number field edits)
```

---

### `src/ui/battery-picker.ts` — single → multiple custom cards

**Role:** UI component; DOM-manipulation + signal writes; jsdom-tested.

**Existing `buildCustomCard` function** (`src/ui/battery-picker.ts` lines 116-363): this is the template. The generalised version takes a unique card id and an ordinal `n` for the default name.

**Function signature pattern to follow:**
```typescript
// Current (single):
function buildCustomCard(): HTMLLIElement { ... }

// New (N cards): accept id + ordinal
function buildCustomCard(id: string, n: number): HTMLLIElement { ... }
```

**Hardcoded `id: 'custom'` inside `buildCustomCard`** (`src/ui/battery-picker.ts` line 119 and lines 297-298):
```typescript
// Current — remove both of these:
li.dataset.batteryId = 'custom'

// In validateAndWrite():
const partial = {
  id: 'custom',
  name: 'Eigen batterij',
  ...
}
```
Replace with the passed-in `id` parameter. Default name = `Eigen batterij ${n}` (textContent — XSS safe; static pattern string).

**`validateAndWrite` closure pattern** (`src/ui/battery-picker.ts` lines 258-321): this writes to `customBattery.value`. In the multi-card version it writes into `customBatteries.value` by id:
```typescript
// Current pattern (copy this shape, target customBatteries array instead):
customBattery.value = null           // invalid path
customBattery.value = partial as BatteryConfig  // valid path
scheduleRecompute(false)

// New pattern (immutable array update — same as selectedBatteries pattern):
customBatteries.value = customBatteries.value.filter((b) => b.id !== id)
// or
customBatteries.value = [
  ...customBatteries.value.filter((b) => b.id !== id),
  partial as BatteryConfig,
]
scheduleRecompute(false)
```

**`scheduledValidate` closure** (`src/ui/battery-picker.ts` lines 323-326): copy verbatim — 400ms debounce, local `_debounce` variable per card closure:
```typescript
function scheduledValidate(): void {
  if (_debounce !== null) clearTimeout(_debounce)
  _debounce = setTimeout(validateAndWrite, 400)
}
```

**Blur handler pattern** (`src/ui/battery-picker.ts` lines 329-338): copy verbatim — blur fires immediately (cancel pending debounce, call `validateAndWrite` directly):
```typescript
inp.addEventListener('blur', () => {
  if (_debounce !== null) {
    clearTimeout(_debounce)
    _debounce = null
  }
  validateAndWrite()
})
```

**`× Verwijderen` remove button** — new element, no existing analog, but DOM-creation pattern follows the existing expand button:
```typescript
// Pattern for expand button (src/ui/battery-picker.ts lines 122-126):
const expandBtn = document.createElement('button')
expandBtn.type = 'button'
expandBtn.className = 'battery-card__expand'
expandBtn.setAttribute('aria-expanded', 'false')
expandBtn.textContent = '+ Eigen batterij'  // textContent — static string

// Apply same pattern for remove button:
const removeBtn = document.createElement('button')
removeBtn.type = 'button'
removeBtn.className = 'battery-card__remove'
removeBtn.setAttribute('aria-label', `Verwijder ${defaultName}`) // static pattern string
removeBtn.textContent = '× Verwijderen'  // textContent — static string
```

**Remove button click handler** — pattern from checkbox change handler (`src/ui/battery-picker.ts` lines 422-438):
```typescript
// Existing selection-remove pattern:
selectedBatteries.value = selectedBatteries.value.filter((b) => b.id !== battery.id)
scheduleRecompute(true)

// Apply same pattern for custom remove:
removeBtn.addEventListener('click', () => {
  customBatteries.value = customBatteries.value.filter((b) => b.id !== id)
  li.remove()
  scheduleRecompute(true)  // discrete change — immediate
})
```

**"+ Eigen batterij" add button** — replaces the single `buildCustomCard()` call at `src/ui/battery-picker.ts` line 446. Pattern follows the expand button click handler:
```typescript
// Existing expand toggle pattern (lines 342-356):
expandBtn.addEventListener('click', () => {
  const isExpanded = expandBtn.getAttribute('aria-expanded') === 'true'
  expandBtn.setAttribute('aria-expanded', String(!isExpanded))
  form.hidden = isExpanded
  incompleteAlert.hidden = isExpanded
  ...
})

// New add-button pattern:
addBtn.addEventListener('click', () => {
  // Guard: disable when 5 valid batteries already active (D-03)
  if (activeBatteries.value.length >= MAX_SELECTED) return
  const n = nextOrdinal()          // counter kept in closure
  const cardId = `custom-${n}`    // stable unique id per D-09
  const newCard = buildCustomCard(cardId, n)
  ul.insertBefore(newCard, addBtn.parentElement ?? addBtn)
  scheduleRecompute(false)
})
```

**Cap guard for add button** — mirrors the existing `isDisabled` logic. Keep `MAX_SELECTED = 5` constant unchanged.

**Reactive swatch effect — custom cards** (`src/ui/battery-picker.ts` lines 507-531):
```typescript
// Current effect (single custom swatch):
_disposeFns.push(
  effect(() => {
    const cb = customBattery.value
    const isValid = cb !== null && (cb.nominalCapacityKwh ?? 0) > 0

    if (isValid) {
      const orderedIds = activeBatteries.value.map((b) => b.id)
      const slot = colorSlotFor('custom', orderedIds)
      for (let i = 1; i <= 5; i++) {
        customSwatch.classList.remove(`battery-swatch--${i}`)
      }
      customSwatch.classList.add(`battery-swatch--${slot}`)
      customSwatch.hidden = false
    } else {
      for (let i = 1; i <= 5; i++) {
        customSwatch.classList.remove(`battery-swatch--${i}`)
      }
      customSwatch.hidden = true
    }
  }),
)
```
In the multi-card version, each `buildCustomCard(id, n)` call sets up its own closure over the card's swatch element and its `id`. The same `colorSlotFor(id, orderedIds)` call applies. Push each dispose fn into `_disposeFns` as before.

**Reactive catalog card effect** (`src/ui/battery-picker.ts` lines 459-498): this now also drives the add-button enabled/disabled state. The `atCap` check must count `activeBatteries.value.length` (which includes valid customs via the updated computed) — no change to the computation, only the `atCap` check drives both cap note and add-button disabled state.

**Effect disposal pattern** (`src/ui/battery-picker.ts` lines 27-27 and 538-541):
```typescript
// Module-level array:
const _disposeFns: Array<() => void> = []

// Registration:
_disposeFns.push(effect(() => { ... }))

// Teardown (copy verbatim):
export function teardownBatteryPicker(): void {
  _disposeFns.forEach((d) => d())
  _disposeFns.length = 0
}
```

**CSS class conventions** (no inline styles — CSP rule from D-10):
```typescript
// Correct — CSS class only:
swatch.classList.add(`battery-swatch--${slot}`)
// Wrong — never do this:
// swatch.style.backgroundColor = colorFor(...)
```

---

### `src/ui/comparison-table.ts` — saldering toggle + conditional column layout

**Role:** UI component; DOM-manipulation; signal consumer; jsdom-tested.

**New import needed**: `salderingOn` signal from `'../state/app-state'` (add alongside existing imports at lines 14-19):
```typescript
import { effect } from '@preact/signals-core'
import { simResults, activeBatteries, isComputing, computeError } from '../state/app-state'
// Add:
import { salderingOn } from '../state/app-state'
```

**`initComparisonTable` effect reads** (`src/ui/comparison-table.ts` lines 423-428): add `salderingOn.value` to the reads so the effect re-runs on toggle:
```typescript
export function initComparisonTable(container: HTMLElement): () => void {
  return effect(() => {
    const results = simResults.value
    const batteries = activeBatteries.value
    const computing = isComputing.value
    const error = computeError.value
    // Add:
    const showSaldering = salderingOn.value
    ...
    renderTable(container, results, batteries, showSaldering)
  })
}
```

**`buildThead` conditional layout** (`src/ui/comparison-table.ts` lines 100-179): this function must branch on `salderingOn`. Pass `showSaldering: boolean` as a parameter.

**Current two-column saldering group header** (lines 113-127, copy and keep for ON path):
```typescript
// ON path (current Phase 4 layout) — keep as-is:
const thSalderingGroup = document.createElement('th')
thSalderingGroup.setAttribute('colspan', '2')
thSalderingGroup.className = 'col-saldering-group__header'
thSalderingGroup.textContent = 'kWh netto-import vermeden'
const infoBtn = document.createElement('button')
infoBtn.className = 'saldering-info-btn'
infoBtn.setAttribute('aria-expanded', 'false')
infoBtn.setAttribute('aria-controls', 'saldering-disclaimer')
infoBtn.setAttribute('aria-label', 'Meer over de salderingsvereenvoudiging')
infoBtn.type = 'button'
infoBtn.textContent = 'i'
thSalderingGroup.appendChild(infoBtn)
```

**OFF path (new) — single column, no sub-labels row for saldering pair:**
```typescript
// OFF path:
const thSingle = document.createElement('th')
thSingle.setAttribute('rowspan', '2')   // spans both header rows
thSingle.className = 'col-saldering-group__header'
thSingle.textContent = 'kWh netto-import vermeden'
thSingle.dataset.metric = 'avoidedOff'
groupRow.appendChild(thSingle)
// No sub-label row entries for zonder/met when OFF
```

**Label row sub-headers** (lines 162-177): add only when `showSaldering === true`:
```typescript
// Only added for the ON path:
const thZonder = document.createElement('th')
thZonder.className = 'col-primary'
thZonder.textContent = 'zonder saldering'
thZonder.dataset.metric = 'avoidedOff'

const thMet = document.createElement('th')
thMet.className = 'col-muted'
thMet.textContent = 'met saldering'
thMet.dataset.metric = 'avoidedOn'
```

**`buildBatteryRow` saldering columns** (`src/ui/comparison-table.ts` lines 241-271): pass `showSaldering: boolean`; the `met saldering` column (avoidedOn, lines 252-271) is appended only when `showSaldering === true`. The `zonder saldering` column (avoidedOff) is always appended (it is the post-2027 headline per D-07).

**`SALDERING_DISCLAIMER_COPY` — DO NOT REWORD** (lines 28-38): referenced verbatim. The disclaimer `<div>` and the "i" info button are only emitted into the DOM when `showSaldering === true` (D-08). Copy the existing element-creation block from `renderTable` lines 388-393:
```typescript
// Only emit disclaimer elements when showSaldering is true (D-08):
if (showSaldering) {
  const disclaimer = document.createElement('div')
  disclaimer.id = 'saldering-disclaimer'
  disclaimer.className = 'saldering-disclaimer'
  disclaimer.hidden = true
  disclaimer.textContent = SALDERING_DISCLAIMER_COPY  // textContent — static locked copy
  container.appendChild(disclaimer)
  wireSalderingDisclaimer(container)
}
```

**Negative-ON note** (lines 399-405): existing pattern:
```typescript
// Only show when showSaldering is true (D-08):
const hasNegativeOn = allMetrics.some((m) => m.avoidedOn <= 0)
if (showSaldering && hasNegativeOn) {
  const noteP = document.createElement('p')
  noteP.className = 'saldering-negative-note'
  noteP.textContent = NEGATIVE_ON_NOTE_COPY  // textContent — static copy
  container.appendChild(noteP)
}
```

**Saldering options row** (new, above the table) — pattern for button/label wiring from `wireSalderingDisclaimer` (`src/ui/comparison-table.ts` lines 325-334):
```typescript
function wireSalderingDisclaimer(container: HTMLElement): void {
  const btn = container.querySelector('.saldering-info-btn') as HTMLButtonElement | null
  const disclaimer = container.querySelector('#saldering-disclaimer') as HTMLElement | null
  if (!btn || !disclaimer) return

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true'
    btn.setAttribute('aria-expanded', String(!expanded))
    disclaimer.hidden = expanded
  })
}
```

The saldering options row checkbox is wired similarly — write `salderingOn.value = checkbox.checked` and call `scheduleRecompute(true)`. The options row must sit outside `#comparison-table-mount` (or the equivalent container passed to `initComparisonTable`) so that `container.innerHTML = ''` re-renders inside `renderTable` do not clobber the options row. Use the Phase 4 `#comparison-table-mount` separation pattern: create the options row as a sibling above the container, not a child of it, wired from the caller site in `main.ts`.

**`#comparison-table-mount` separation** (Phase 4 fix 04-07 comment in CONTEXT.md): the existing code renders into `container` which IS `#results-region`. The saldering options row must be a sibling element (appended to `#results-region`'s parent, or to a wrapper) rather than inside the container that `renderTable` clears with `container.innerHTML = ''`. The planner must decide the precise mounting point.

---

## Shared Patterns

### Signal writes — always immutable array replacement
**Source:** `src/ui/battery-picker.ts` lines 432-434, `src/state/signals.ts` lines 90-93
**Apply to:** all writes to `customBatteries`, `selectedBatteries`
```typescript
// Correct — replace array reference entirely:
selectedBatteries.value = selectedBatteries.value.filter((b) => b.id !== battery.id)
selectedBatteries.value = [...selectedBatteries.value, battery]

// Wrong — mutating in place does not trigger reactive recompute:
// selectedBatteries.value.push(battery)
```

### Reactive `effect()` pattern
**Source:** `src/ui/battery-picker.ts` lines 459-498 and lines 507-531
**Apply to:** all new reactive DOM updates
```typescript
_disposeFns.push(
  effect(() => {
    // Read signals — effect re-runs on any change
    const selected = selectedBatteries.value
    const customs = customBatteries.value
    // ... DOM mutations
  }),
)
```
Always push to `_disposeFns`; teardown calls each dispose fn.

### `batch()` for atomic multi-signal writes
**Source:** `src/state/app-state.ts` lines 113-118
**Apply to:** any code path that writes multiple signals as one logical update
```typescript
batch(() => {
  isComputing.value = true
  computeError.value = null
})
```

### CSS class swaps — never inline style
**Source:** `src/ui/battery-picker.ts` lines 488-493, `src/ui/comparison-table.ts` lines 230-231
**Apply to:** every swatch, selection state, and enabled/disabled visual
```typescript
// Only CSS class mutations — no element.style.* (CSP rule D-10)
swatch.classList.remove(`battery-swatch--${i}`)
swatch.classList.add(`battery-swatch--${slot}`)
li.classList.toggle('battery-card--selected', isChecked)
```

### XSS safety — always `.textContent`, never `.innerHTML`
**Source:** `src/ui/battery-picker.ts` line 9 (file-level comment) and throughout
**Apply to:** all user-derived strings (custom battery name field value)
```typescript
nameSpan.textContent = battery.name   // correct
// nameSpan.innerHTML = battery.name  // NEVER
```

### `scheduleRecompute` call pattern
**Source:** `src/state/app-state.ts` lines 93-101
**Apply to:** every signal-write site in battery-picker and any saldering toggle handler
```typescript
scheduleRecompute(true)   // immediate — discrete event (checkbox, remove, saldering toggle)
scheduleRecompute(false)  // debounced 400ms — continuous input (number field edits)
```

### Test file structure — jsdom environment
**Source:** `tests/battery-picker.test.ts` lines 1-33, `tests/comparison-table.test.ts` lines 1-32
**Apply to:** new tests for picker multi-custom and saldering toggle
```typescript
// @vitest-environment jsdom
/**
 * tests/[feature].test.ts — ...
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderShell } from '../src/shell'
// ... component import
// ... signal imports (from '../src/state/signals' — NOT app-state, to avoid Worker)

beforeEach(() => {
  // Reset ALL signals to clean state
  customBatteries.value = []
  selectedBatteries.value = [BATTERY_CATALOG[0]]
  salderingOn.value = false
  simResults.value = null
  ...
})

afterEach(() => {
  teardownBatteryPicker()   // dispose effects
  customBatteries.value = []
  salderingOn.value = false
})
```

### Test for signal contracts — node environment
**Source:** `tests/app-state.test.ts` lines 1-12, lines 50-61
**Apply to:** new signal tests for `customBatteries` computed and `salderingOn`
```typescript
// DEFAULT node env — no @vitest-environment override
// Import from signals.ts (not app-state.ts) to avoid the ?worker suffix:
import {
  customBatteries,
  salderingOn,
  activeBatteries,
} from '../src/state/signals'

beforeEach(() => {
  customBatteries.value = []
  salderingOn.value = false
  selectedBatteries.value = [BATTERY_CATALOG[0]]
})
```

### Fixture helpers in tests
**Source:** `tests/comparison-table.test.ts` lines 30-56
**Apply to:** any new test that needs a BatteryConfig or SimResult
```typescript
function makeSimResult(overrides: Partial<SimResult> = {}): SimResult {
  return {
    shiftedKwh: 120.5,
    residualImportKwh: 450.2,
    residualExportKwh: 80.1,
    totalImportKwh: 570.7,
    totalExportKwh: 200.3,
    periodDays: 90,
    coarseCadenceWarning: false,
    trace: [],
    ...overrides,
  }
}

function makeBattery(overrides: Partial<BatteryConfig> = {}): BatteryConfig {
  return {
    id: 'sessy-5',
    name: 'Sessy 5 kWh',
    nominalCapacityKwh: 5,
    dodFraction: 1.0,
    roundTripEfficiency: 0.85,
    maxChargeKw: 2.2,
    maxDischargeKw: 1.7,
    datasheetUrl: 'https://example.com',
    ...overrides,
  }
}
```

---

## Reused As-Is (no contract change)

### `src/helpers/color.ts` — `colorFor` / `colorSlotFor`
Per D-05: order-based, 5-slot palette, reused without modification. Multiple custom batteries get distinct colors automatically because each has a unique stable id (`custom-1`, `custom-2`, …) and `colorSlotFor` uses array position in `activeBatteries`.

Call sites in new code use the identical signature:
```typescript
// src/helpers/color.ts lines 42-46:
export function colorSlotFor(batteryId: string, orderedSelection: string[]): number {
  const idx = orderedSelection.indexOf(batteryId)
  if (idx === -1) return 1
  return (idx % COLOR_SLOTS.length) + 1
}
```

### `src/helpers/metrics.ts` — `avoidedWithoutSaldering` / `avoidedWithSaldering`
Both functions stay. Only their *column visibility* in the table changes. `avoidedWithoutSaldering` is always shown (the post-2027 headline). `avoidedWithSaldering` is shown only when `salderingOn` is true.

---

## No Analog Found

None. All files to be created or modified have direct analogs in the existing codebase.

---

## Worker-Mock Blind Spot (critical for testing notes)

**Source:** `tests/setup.ts` lines 47-88, `vitest.config.ts` lines 8-10

Vitest installs a no-op `WorkerMock` at global setup. `scheduleRecompute()` queues a debounced async call, but `simApi.runComparison` is a Comlink Proxy over a mock that never resolves. This means:

- Signal reads/writes and computed re-derivations ARE exercised in CI.
- The Comlink round-trip (worker response → `simResults.value` update → table re-render) is NOT exercised in CI.
- Tests must verify add/remove/cap and saldering toggle at the signal layer (node env) and at the DOM layer (jsdom env, using direct `simResults.value = [...]` injection) — not through the full worker path.
- The full reactive pipeline (custom add → scheduleRecompute → simResults update → table re-render) must be verified in the human-verify step (live browser).

---

## Metadata

**Analog search scope:** `src/state/`, `src/ui/`, `src/helpers/`, `tests/`
**Files scanned:** 10 source files + 3 test files read in full
**Pattern extraction date:** 2026-06-15
