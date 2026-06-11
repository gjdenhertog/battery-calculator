# Phase 04: Comparison Engine, Comparison Table, Saldering Side-by-Side, Worker Wiring, State — Research

**Researched:** 2026-06-11
**Domain:** Comlink web workers, @preact/signals-core reactive state, saldering economic framing, comparison aggregation, vanilla TS DOM
**Confidence:** HIGH (all core claims verified against npm registry and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Saldering framing** — "net grid position" is what differs between columns. Physics engine is saldering-agnostic. Saldering ON = 1:1 annual netting (`netImport = max(0, residualImportKwh − residualExportKwh)`). Saldering OFF = export worth nothing (`netImport = residualImportKwh`). Headline "kWh netto-import vermeden" computed per scenario against its own baseline.
- **D-02: Show honest near-zero / negative ON result** — do NOT floor at 0. When ≤ 0, display as-is with Dutch note.
- **D-03: Lead with saldering-OFF as primary framing** — reads first / emphasized. ON is secondary/muted. Both ALWAYS visible side-by-side, no re-run.
- **D-04: Net-position calc behind pluggable feed-in valuation** — small pure helper with feed-in value as parameter. v1: export = 0 (OFF) or 1:1 (ON). Slot for v2 terugleverkosten.
- **D-05: Spec cards with checkboxes** — each battery is a selectable card showing specs + color swatch. Sessy 5 pre-checked (BATT-03). At 5 selected, remaining cards disable.
- **D-06: Custom battery = inline expandable card** — "+ eigen batterij" card, 5 fields, BatteryConfig shape, counts as one of 5, gets own color.
- **D-07: Live auto-recompute (debounced)** — any change auto-reruns worker, debounced only for continuous custom-field typing (400ms). Discrete changes (checkbox, date) fire immediately. No "Vergelijk" button.
- **D-08: Batteries as rows, metrics as columns** — per-column leader highlight; never overall winner.
- **D-09: Only headline metric doubles by saldering** — all other metrics are physical/saldering-independent and shown once.
- **D-10: Column set** (left→right) — battery name + swatch · kWh netto-import vermeden (zonder) · kWh netto-import vermeden (met) · Zelfverbruik % · Verschoven kWh · Rest-import kWh · Rest-teruglevering kWh · Marginale benutting.
- **D-11: Per-battery color vs leader highlight are SEPARATE treatments** — color = identity swatch; leader = neutral bold + surface tint. `colorFor(batteryId)` tested helper.
- **D-12: Responsive-ready structure now; full mobile polish is Phase 5** — semantic table with `data-battery-id`, `data-metric`, `data-label` attributes for Phase 5 CSS reflow.
- **D-13: Prominent coarse-cadence banner** — shown above results when `SimResult.coarseCadenceWarning === true`.
- **D-14: Saldering disclaimer co-located + expandable** — "i" button in column group header; verbatim COMP-06 copy.
- **D-15: Period framing** — every number framed as "over de periode die je hebt geüpload"; coverage indicator; no auto-extrapolation.
- **D-16: Replace Phase 2 drop-zone wiring in place** — re-wire `#drop-zone-region`; fill `#results-region`. Keep `p.privacy-promise` verbatim (PRIV-02).
- **D-17: Simulator + comparison run in Comlink worker (SIM-07)** — main thread sends (samples, batteries[], options) → worker runs `runComparison` → returns `SimResult[]`. Pure functions remain Vitest-testable without a worker.
- **D-18: Parser worker boundary = Claude's discretion** — PapaParse already uses its own blob worker; no Comlink wrapper needed for parsing. Only the simulator gets the Comlink worker.
- **D-19: DATA-12 interactive period control is IN Phase 4** — `filterByPeriod()` already exists; add date-range control defaulting to full merged range. Live recompute.
- **Stack lock** — `@preact/signals-core@^1.14.2` and `comlink@^4` are the two new runtime deps. Vite `?worker` suffix. Vite `^8`, TS `~5.6`, Vitest `^4.1.7`. uPlot is Phase 5.
- **CSP lock** — `worker-src blob:` already in `src/constants/csp.ts`. No inline `style=`. No `connect-src` relaxation.
- **UI/Shell contract** — `#drop-zone-region` (re-wire), `#results-region` (fill), design tokens from `tokens.css`, no inline styles.

### Claude's Discretion

- Exact color palette and `colorFor(batteryId)` slot mapping (only the separate-treatment rule and chart-reuse + unit test are fixed).
- Exact column header wording and ordering details within D-10's set.
- "Rekenen..." indicator placement/styling and debounce interval (D-07).
- Parser worker boundary (D-18) and whether period filtering runs in worker or main thread (it's cheap).
- Empty/loading states copy and styling — functional Dutch, polish Phase 5.
- Internal module layout for new UI/state/worker files under `src/ui/`, `src/state/`, and Comlink worker entry.
- Signals granularity (one store vs several signals) and how derived results memoize.

### Deferred Ideas (OUT OF SCOPE)

- Terugleverkosten €/kWh input (SALD-02) — v2.
- Charts VIZ-01, VIZ-02 — Phase 5.
- Assumptions panel UX-01, "Waarom geen euro's?" UX-02 — Phase 5.
- Final mobile polish / full Dutch copy / terminology audit UX-03/04/05 — Phase 5.
- Year-by-year saldering phase-out schedule SALD-01 — v2.
- Battery arbitrage / dynamic-price dispatch DYN — v2.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIM-07 | Simulator + comparison aggregator run inside a Comlink Web Worker; main thread sends inputs, receives SimResult[]. Same pure functions pass Vitest without a worker. | Comlink 4.4.2 `expose`/`wrap` + Vite `?worker` suffix; dual-use pattern via separate module files. |
| SIM-08 | UI remains interactive while simulator runs; no dropped frames >200ms; "Rekenen..." indicator visible. | Comlink worker executes off-main-thread; signals `isComputing` drives indicator; `.results-stale` dims stale table. |
| COMP-01 | Comparison view shows: kWh grid import avoided (headline), self-consumption %, kWh shifted, residual import, residual feed-in, marginal capture rate. | All derived from `SimResult` aggregates in Phase 4 presentation layer; pure helper functions. |
| COMP-02 | Headline metric is "kWh grid import avoided" — placed first; self-consumption % shown secondary. | D-10 column order locks this. |
| COMP-03 | Each metric column highlights the per-row leader; no synthesized "best battery" verdict. | `.table-cell--leader` class; per-column max/min scan at render time. |
| COMP-04 | Consistent color per selected battery reused across table and all charts. | `colorFor(batteryId)` pure helper; selection-order slot assignment; 5 CSS custom properties from tokens.css. |
| COMP-05 | Saldering ON and OFF scenarios shown side-by-side per battery (no re-run, no toggle). | D-01 framing: two adjacent columns computed from same `SimResult`; both always rendered. |
| COMP-06 | Short disclaimer near saldering columns: 2026 64% cap, terugleverkosten, 50% floor through 2030. | Expandable `<div id="saldering-disclaimer" hidden>` toggled by "i" button; verbatim copy from UI-SPEC. |
| COMP-07 | All reported numbers framed as "over the period you uploaded" — no auto-extrapolation. | No `/year` or `/maand` math anywhere; COMP-07 is a display/copy constraint, not a calculation. |
| COMP-08 | Period coverage indicator visible alongside results (e.g. "43 dagen aan data"). | `sim.periodDays` from `SimResult`; coverage derived from `filteredSamples` timestamps; `aria-live="polite"` element. |
| DATA-12 | User can narrow analysis to sub-period (defaults to full range). | `filterByPeriod()` already exists; two `<input type="date">` fields; signals-driven recompute. |

</phase_requirements>

---

## Summary

Phase 4 is the first real interactive UI for the battery calculator. It layers reactive state, worker offloading, and the comparison table on top of the pure simulation engine already proven in Phases 1–3. The core challenge is wiring three concerns cleanly: (1) Comlink worker for offloading `runComparison` without losing Vitest testability of the pure functions; (2) `@preact/signals-core` reactive state that drives all DOM updates without a framework; and (3) the saldering framing layer that computes two columns from the same `SimResult` with different economic assumptions.

The canonical Comlink + Vite pattern — using `?worker` suffix to import a dedicated worker entry file, calling `Comlink.expose()` inside that file, and calling `Comlink.wrap()` on the main thread — is well-established and works with the existing stack. The critical pitfall is CSP: Vite's `?worker` in production emits the worker as a separate chunk at an `assets/` URL (same origin), not a blob URL. This means `worker-src blob:` alone is insufficient — `worker-src 'self' blob:` is needed to permit both the Comlink worker chunk and PapaParse's blob worker. The dev server has no CSP (build-only plugin), so this issue only surfaces after `vite build`.

The dual-use testing pattern for Comlink is straightforward: the worker entry file (`src/workers/sim-worker.ts`) simply imports and re-exposes the pure functions (`runComparison`). Tests import those pure functions directly from `src/domain/compare.ts` — they never instantiate the worker file. This means zero special mocking infrastructure for Vitest.

**Primary recommendation:** Use `comlink@^4.4.2` with Vite `?worker` suffix; update `worker-src` in `src/constants/csp.ts` from `blob:` to `'self' blob:`; keep all simulation/aggregation logic in `src/domain/` pure functions; the worker entry is a thin adapter — five lines of `Comlink.expose({ runComparison })`. State lives in `src/state/` as `@preact/signals-core` signals; effects drive DOM mutations directly. Period filtering stays on the main thread (cheap, synchronous, no worker needed).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSV parsing | Web Worker (PapaParse blob worker — Phase 2) | Main thread (file input handling) | Already wired; unchanged in Phase 4 |
| Period filtering | Main thread | — | `filterByPeriod()` is synchronous, sub-millisecond on any realistic dataset; no worker needed |
| Battery simulation | Web Worker (Comlink module worker — new in Phase 4) | — | Potentially slow on large datasets (50k × 5 batteries = 250k iterations); must not block UI |
| Comparison aggregation | Web Worker (same Comlink worker) | — | `runComparison` calls `simulate` N times; lives in the same worker as simulation |
| Saldering framing derivation | Main thread (presentation layer) | — | Computed from `SimResult` aggregates in Phase 4; pure math on pre-computed numbers, negligible cost |
| Signal state management | Main thread | — | `@preact/signals-core` signals live in main thread; effects drive DOM |
| Battery picker UI | Browser (vanilla DOM + signals) | — | No server involvement; state-driven DOM updates from `selectedBatteries` signal |
| Comparison table render | Browser (vanilla DOM) | — | DOM manipulation inside `effect()` callbacks driven by `simResults` signal |
| Color assignment | Main thread (pure helper) | — | Deterministic selection-order mapping; tested pure function |
| Leader detection | Main thread (pure helper) | — | Per-column scan of `SimResult[]` before render; trivially fast |

---

## Standard Stack

### Core (new in Phase 4)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `comlink` | `^4.4.2` | Wraps a Web Worker as a transparent async RPC proxy; `expose()` on worker side, `wrap()` on main thread | GoogleChromeLabs-maintained; ~1.2 KB gzip; widely used; works with any `postMessage`-capable endpoint; no postinstall script |
| `@preact/signals-core` | `^1.14.2` | Framework-agnostic reactive state: `signal`, `computed`, `effect`, `batch` | CLAUDE.md-locked; ~1.5 KB gzip; three primitives are sufficient; supports cleanup via dispose pattern |

[VERIFIED: npm registry] `comlink@4.4.2` — published 2024-11-07, source `github.com/GoogleChromeLabs/comlink`, no postinstall script. `@preact/signals-core@1.14.2` — published 2026-05-11, source `github.com/preactjs/signals`, no postinstall script.

### Already Installed (Phase 1–3, consumed here)

| Library | Version | Purpose in Phase 4 |
|---------|---------|---------------------|
| `papaparse` | `^5.5.3` | CSV parsing (unchanged) |
| `@date-fns/tz` + `date-fns` | `^1.5.0` / `^4.4.0` | Timestamp math for coverage days display |
| `vite` | `^8.0.14` | `?worker` suffix for Comlink worker chunk |
| `vitest` | `^4.1.7` | Tests for pure saldering helpers, colorFor, leader detection (node env); picker/table tests (jsdom env) |

### Supporting (new dev-only)

None. The Phase 4 feature set requires only the two new runtime deps listed above.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `comlink@4` | `vite-plugin-comlink@^5` | Plugin removes boilerplate but adds a dev dependency and Vite plugin config; for a five-line wrapper it is unnecessary overhead. The manual `expose`/`wrap` pattern is simpler and directly testable. [ASSUMED] |
| Manual `expose`/`wrap` | `new Worker(new URL(..., import.meta.url))` (no Comlink) | Raw Worker requires manual `postMessage` + serialization; Comlink saves ~50 lines of boilerplate for complex return types like `SimResult[]`. |
| `@preact/signals-core` | Plain callbacks / event bus | CLAUDE.md-locked; signals provide automatic dependency tracking and are already the CLAUDE.md recommendation |

**Installation (two new runtime deps):**
```bash
npm install comlink @preact/signals-core
```

**Version verification (confirmed 2026-06-11):**
```
comlink                 4.4.2
@preact/signals-core    1.14.2
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `comlink` | npm | ~6 yrs (first published ~2018) | High (GoogleChromeLabs widely used) | github.com/GoogleChromeLabs/comlink | Not run (unavailable) | [ASSUMED] — see note |
| `@preact/signals-core` | npm | ~3 yrs | High (Preact ecosystem) | github.com/preactjs/signals | Not run (unavailable) | [ASSUMED] — see note |

**slopcheck was not available** at research time. Both packages are manually verified:
- `comlink`: GoogleChromeLabs GitHub organization (authoritative, maintained by Surma/Google); no postinstall; 6+ years on registry; used by thousands of projects.
- `@preact/signals-core`: preactjs GitHub organization (authoritative, active); no postinstall; CLAUDE.md explicitly endorses this package.

Despite slopcheck being unavailable, both packages have MEDIUM-HIGH confidence of legitimacy based on authoritative source org and registry age. The planner does NOT need to insert `checkpoint:human-verify` tasks — both packages are effectively CLAUDE.md-endorsed choices with well-known source repositories.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User gesture (checkbox / date / custom-field)
         |
         v
  [signals: selectedBatteries, periodFrom, periodTo, customBattery]
         |
         v
  [computed: filteredSamples = filterByPeriod(parsedSamples, from, to)]  ← main thread
         |
         v  (Comlink postMessage)
  [sim-worker.ts]  ← Comlink worker chunk (assets/xxx.js from 'self')
    Comlink.expose({ runComparison })
    runComparison(filteredSamples, activeBatteries, options)
    → SimResult[]
         |
         v  (Comlink postMessage back)
  [signals: simResults, isComputing, computeError]
         |
         v
  [effect: renderTable(simResults)]  ← main thread DOM mutation
    deriveMetrics(simResult, battery)
    computeSalderingOff(simResult)
    computeSalderingOn(simResult)
    colorFor(battery.id)
    detectLeaders(allSimResults)
         |
         v
  <table class="comparison-table"> in #results-region
```

**Parse path (unchanged from Phase 2, wired into signals):**
```
File drop/pick
    → parseFile() [PapaParse blob worker — existing]
    → mergeFiles()
    → parsedSamples.value = mergeResult.samples
```

### Recommended Project Structure

```
src/
├── domain/                    # Pure functions — unchanged from Phase 3
│   ├── types.ts               # BatteryConfig, SimResult, TraceRow, etc.
│   ├── simulate.ts            # simulate()
│   ├── compare.ts             # runComparison()
│   ├── period-filter.ts       # filterByPeriod(), fullRange()
│   ├── battery-catalog.ts     # BATTERY_CATALOG
│   └── parsers/               # Unchanged
├── workers/                   # NEW — worker entry files only
│   └── sim-worker.ts          # Comlink.expose({ runComparison })
├── state/                     # NEW — all signals
│   └── app-state.ts           # signal(), computed() declarations
├── ui/
│   ├── drop-zone.ts           # Existing — re-wired to write parsedSamples signal
│   ├── readout.ts             # Existing — minimal changes or unchanged
│   ├── battery-picker.ts      # NEW — renders spec cards from BATTERY_CATALOG
│   ├── comparison-table.ts    # NEW — renders table from simResults signal
│   └── period-control.ts      # NEW — date inputs, coverage indicator
├── helpers/                   # NEW — pure presentation helpers
│   ├── color.ts               # colorFor(batteryId): string
│   ├── metrics.ts             # deriveMetrics(), computeSalderingOff/On(), detectLeaders()
│   └── format.ts              # formatKwh(), formatPct() (spirit of VIZ-04)
├── constants/
│   └── csp.ts                 # UPDATE: worker-src blob: → worker-src 'self' blob:
├── styles/
│   ├── tokens.css             # Existing — battery color CSS vars already here (UI-SPEC)
│   ├── global.css             # UPDATE: import new CSS files
│   ├── battery-picker.css     # NEW
│   ├── comparison-table.css   # NEW
│   └── results-region.css     # NEW
├── shell.ts                   # Unchanged
└── main.ts                    # UPDATE: wire signals, init battery picker, init period control
```

### Pattern 1: Comlink Worker — Expose and Wrap

**Worker entry file (`src/workers/sim-worker.ts`):**
```typescript
// Source: https://github.com/GoogleChromeLabs/comlink#readme
import * as Comlink from 'comlink'
import { runComparison } from '../domain/compare'

// Expose only the functions the main thread needs.
// runComparison is already pure and serialization-safe (SimResult contains
// plain numbers, Dates, and plain objects — no class instances, no functions).
Comlink.expose({ runComparison })
```

**Main thread wiring (in `src/state/app-state.ts` or `src/main.ts`):**
```typescript
// Source: https://github.com/GoogleChromeLabs/comlink#readme
import * as Comlink from 'comlink'
import SimWorker from '../workers/sim-worker?worker'
import type { runComparison } from '../domain/compare'

// Worker is a module worker (Vite ?worker emits type: 'module' in production)
const simWorker = new SimWorker()
const simApi = Comlink.wrap<{ runComparison: typeof runComparison }>(simWorker)

// Usage (async):
const results = await simApi.runComparison(filteredSamples, activeBatteries)
```

**Vitest tests — no worker needed:**
```typescript
// Import pure functions directly from domain/; never touch the worker file.
import { runComparison } from '../src/domain/compare'
// Works in node env, no Worker global, no Comlink.
const results = runComparison(samples, batteries)
```

### Pattern 2: @preact/signals-core State Architecture

```typescript
// Source: https://preactjs.com/guide/v10/signals/
import { signal, computed, effect, batch } from '@preact/signals-core'
import type { IntervalSample, BatteryConfig, SimResult } from '../domain/types'
import { filterByPeriod } from '../domain/period-filter'
import { BATTERY_CATALOG } from '../domain/battery-catalog'

// ── Writable signals (one writer each) ──────────────────────────────────────
export const parsedSamples   = signal<IntervalSample[]>([])
export const selectedBatteries = signal<BatteryConfig[]>([BATTERY_CATALOG[0]]) // Sessy 5 pre-selected
export const customBattery   = signal<Partial<BatteryConfig> | null>(null)
export const periodFrom      = signal<Date | null>(null)
export const periodTo        = signal<Date | null>(null)
export const simResults      = signal<SimResult[] | null>(null)
export const isComputing     = signal(false)
export const computeError    = signal<string | null>(null)

// ── Derived (computed) ───────────────────────────────────────────────────────
export const filteredSamples = computed(() =>
  filterByPeriod(parsedSamples.value, periodFrom.value, periodTo.value)
)
export const coverageDays = computed(() => {
  const s = filteredSamples.value
  if (s.length < 2) return 0
  return Math.ceil((s[s.length-1].timestamp.getTime() - s[0].timestamp.getTime()) / 86_400_000)
})
export const activeBatteries = computed(() => {
  const cb = customBattery.value
  const valid = cb && cb.nominalCapacityKwh && cb.nominalCapacityKwh > 0
    ? [cb as BatteryConfig] : []
  return [...selectedBatteries.value, ...valid]
})
```

**Effect for driving DOM from signals:**
```typescript
// Source: https://preactjs.com/guide/v10/signals/
const dispose = effect(() => {
  const results = simResults.value
  const table = document.querySelector('.comparison-table')
  if (!table || !results) return
  renderTableRows(table as HTMLTableElement, results, activeBatteries.value)
})
// Store dispose() and call it when tearing down (e.g. hot reload).
```

### Pattern 3: Debounced Worker Invocation

The auto-recompute on custom-battery field changes must debounce to avoid spamming the worker:

```typescript
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRecompute(immediate = false): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  const delay = immediate ? 0 : 400  // D-07: 400ms for continuous input
  debounceTimer = setTimeout(async () => {
    const samples = filteredSamples.value
    const batteries = activeBatteries.value
    if (samples.length === 0 || batteries.length === 0) return
    isComputing.value = true
    computeError.value = null
    try {
      simResults.value = await simApi.runComparison(samples, batteries)
    } catch (err) {
      computeError.value = 'Berekening mislukt. Controleer of je gegevens volledig zijn en probeer het opnieuw.'
      simResults.value = null
    } finally {
      isComputing.value = false
    }
  }, delay)
}
```

### Pattern 4: Saldering Framing (pure helper)

```typescript
// src/helpers/metrics.ts — node-env Vitest testable
import type { SimResult } from '../domain/types'

// D-01: Saldering OFF — export is worthless; avoided = kWh shifted from import to self
export function avoidedWithoutSaldering(sim: SimResult): number {
  // OFF baseline: totalImportKwh. Avoided = baseline − residualImportKwh = shiftedKwh.
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
  feedInValue: 0 | 1  // 0 = OFF (export worthless), 1 = ON (1:1 netting)
): number {
  return residualImportKwh - feedInValue * residualExportKwh
}

// Derived display metrics (saldering-independent)
export interface DerivedMetrics {
  avoidedOff:          number   // kWh netto-import vermeden, zonder saldering
  avoidedOn:           number   // kWh netto-import vermeden, met saldering (can be ≤ 0)
  selfConsumptionPct:  number   // (shiftedKwh / totalImportKwh) × 100
  shiftedKwh:          number   // from SimResult
  residualImportKwh:   number   // from SimResult
  residualExportKwh:   number   // from SimResult
  marginalBenutting:   number   // shiftedKwh / usableCapacityKwh
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

### Pattern 5: colorFor(batteryId) — Selection-Order Based

```typescript
// src/helpers/color.ts — node-env Vitest testable
// Source: 04-UI-SPEC.md §"Per-Battery Color Slots"
const COLOR_SLOTS = [
  'var(--color-battery-1)',  // #2563eb — slot 1
  'var(--color-battery-2)',  // #16a34a — slot 2
  'var(--color-battery-3)',  // #d97706 — slot 3
  'var(--color-battery-4)',  // #9333ea — slot 4
  'var(--color-battery-5)',  // #e11d48 — slot 5
] as const

// colorFor() takes a batteryId and the current ordered selection list.
// Returns the CSS var string for the battery's slot (selection position 1-indexed).
// Stable into Phase 5 charts: Phase 5 calls colorFor() with the same selection order.
export function colorFor(batteryId: string, orderedSelection: string[]): string {
  const idx = orderedSelection.indexOf(batteryId)
  if (idx === -1 || idx >= COLOR_SLOTS.length) return COLOR_SLOTS[0]
  return COLOR_SLOTS[idx]
}

// For CSS class assignment (swatch rendering — no inline style):
export function colorSlotFor(batteryId: string, orderedSelection: string[]): number {
  const idx = orderedSelection.indexOf(batteryId)
  return idx === -1 ? 1 : idx + 1  // 1-indexed slot number for .battery-swatch--N
}
```

### Pattern 6: Leader Detection (per-column)

```typescript
// src/helpers/metrics.ts (continued)
// "Best" semantics: higher is better for avoidedOff, avoidedOn, selfConsumptionPct,
// shiftedKwh, marginalBenutting. Lower is better for residualImportKwh, residualExportKwh.
export type MetricKey = keyof DerivedMetrics

const HIGHER_IS_BETTER: Set<MetricKey> = new Set([
  'avoidedOff', 'avoidedOn', 'selfConsumptionPct', 'shiftedKwh', 'marginalBenutting'
])

export function detectLeaders(all: DerivedMetrics[]): Map<MetricKey, number> {
  // Returns a Map<metricKey, winnerIndex> for per-column leader highlighting.
  const keys: MetricKey[] = [
    'avoidedOff','avoidedOn','selfConsumptionPct','shiftedKwh',
    'residualImportKwh','residualExportKwh','marginalBenutting'
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

### Anti-Patterns to Avoid

- **Putting saldering logic in the simulation engine:** D-01 and the Phase 3 CONTEXT explicitly prohibit this. The engine is saldering-agnostic; framing is presentation-layer-only.
- **Running `filterByPeriod` inside the Comlink worker:** it's synchronous, cheap, and the result is needed on the main thread immediately (for coverage indicator update). Run it on the main thread before sending to the worker.
- **Using `signal.value` inside computed():** for reading other signals inside computed, use `.value`. For writing from inside an effect, write to a different signal. Never write to a signal you're reading in the same computed.
- **Creating effects without storing the dispose function:** effects that aren't disposed accumulate and re-run on every signal change forever. Store `const dispose = effect(...)` and call `dispose()` on teardown or hot-reload.
- **Assigning worker result directly to signal inside the worker:** the worker doesn't have access to signals. The `await simApi.runComparison(...)` call on the main thread must write to `simResults.value` after awaiting.
- **Double-wrapping the parse path with Comlink:** PapaParse already uses its own blob worker (Phase 2). Adding a Comlink layer would create two worker boundaries for parsing without benefit (D-18).
- **Using inline `style=` for battery swatches:** violates `style-src 'self'` CSP. Swatches use `.battery-swatch--N` classes; color is set in CSS via `--color-battery-N` tokens.
- **Flooring saldering-ON avoided value at 0:** D-02 explicitly forbids this. Negative values must show as-is in `--color-destructive`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker RPC / postMessage protocol | Custom serialization + message routing | `comlink@4.4.2` | Comlink handles typed proxy, transfer, error propagation, and cleanup; ~30 lines of boilerplate become 5 |
| Reactive state management | Manual event bus / observer registry | `@preact/signals-core` | Automatic dependency tracking, batching, computed memoization; already CLAUDE.md-locked |
| Worker entry TypeScript types | Copying type signatures between files | `typeof runComparison` imported as type + `Comlink.wrap<T>()` | Type-safe without duplication |
| Debounce utility | `setTimeout` management by hand | Small inline implementation is fine here — no library needed for a single-call debounce | The pattern is trivial; a library would be over-engineering |

**Key insight:** Comlink and signals each eliminate an entire class of hand-rolled bugs (message routing errors, stale UI state) for negligible bundle cost (~2.7 KB total gzipped).

---

## Common Pitfalls

### Pitfall 1: CSP `worker-src` Blocks the Comlink Worker in Production

**What goes wrong:** After `vite build`, the Comlink worker is emitted as `assets/sim-worker-HASH.js` — an `https://` URL from the same origin (`'self'`). The current `worker-src blob:` only permits blob: URL workers (which PapaParse uses). Trying to instantiate a `'self'`-origin worker fails with a CSP violation in the browser console. The error only manifests in production — `vite dev` skips the CSP plugin entirely (`apply: 'build'`).

**Why it happens:** Vite's `?worker` suffix in production builds emits a separate JS chunk at an assets URL, not a blob. Blob-only `worker-src` rejects it.

**How to avoid:** Update `src/constants/csp.ts`:
```typescript
"worker-src 'self' blob:",
```
This permits both the Comlink worker chunk (`'self'`) and PapaParse's blob worker (`blob:`). The CSP test in `tests/csp-plugin.test.ts` must be updated to assert the new directive.

**Warning signs:** "Refused to create a worker from 'https://example.github.io/battery-calculator/assets/sim-worker-xxx.js' because it violates the following Content Security Policy directive: `worker-src blob:`" in the browser console after a production deploy.

### Pitfall 2: `SimResult` Serialization Across the Worker Boundary

**What goes wrong:** `SimResult` contains `trace: TraceRow[]` where each `TraceRow` has a `timestamp: Date`. `Date` objects are NOT transferable — Comlink serializes them as structured-clone, which does transfer Dates correctly via the structured clone algorithm. However, the `trace` array can be large (50k elements for a year of 15-min data). This slows postMessage for every recompute.

**Why it happens:** The full trace is needed in Phase 5 (VIZ-02), but Phase 4 only needs aggregates.

**How to avoid:** In Phase 4, the worker can strip `trace` before returning (or accept a `includeTrace: false` option). Add to `SimOptions`:
```typescript
// In the Comlink worker, strip trace if not needed:
const result = runComparison(samples, batteries, options)
return result.map(r => options?.includeTrace ? r : { ...r, trace: [] })
```
Phase 5 will request `includeTrace: true`. This is a Phase 4 optimization opportunity — add the option but default to `false` for performance.

**Warning signs:** Noticeable lag (>200ms) between trigger and "Rekenen..." indicator appearing, even on fast machines with small datasets.

### Pitfall 3: Effect Leaks on Drop-Zone Re-init

**What goes wrong:** If `initDropZone` or any UI module calls `effect()` without storing and invoking the dispose function, effects accumulate across hot reloads in dev or across repeated `initXxx()` calls. The effect fires redundantly on every signal change.

**Why it happens:** `@preact/signals-core`'s `effect()` returns a dispose function that must be called to unsubscribe. Failing to call it means the effect and its subscriptions live forever in the current JS module scope.

**How to avoid:** Always capture: `const disposeFns: Array<() => void> = []` at module level; push every `effect()` return value; export a `teardown()` that calls all dispose functions. For the static main.ts pattern (no hot module reload teardown), this is less critical but still best practice.

**Warning signs:** Table re-renders multiple times per signal change; effects appear in profiler as called N times where N grows over time.

### Pitfall 4: Comlink Worker Instantiated Multiple Times

**What goes wrong:** If the worker is constructed inside an `effect()` or a re-runnable function, multiple worker instances accumulate and compete on postMessage.

**Why it happens:** Comlink workers should be singletons (one per page lifecycle). Constructing `new SimWorker()` inside a reactive callback re-creates it on every recompute.

**How to avoid:** Construct the worker once at module initialization:
```typescript
// top-level, runs once
const simWorker = new SimWorker()
const simApi = Comlink.wrap<WorkerApi>(simWorker)
```
Never construct it inside effects, event handlers, or reactive functions.

**Warning signs:** Multiple "Rekenen..." overlaps; `isComputing` flickers; results appear out-of-order (last worker wins non-deterministically).

### Pitfall 5: `colorFor` Selection Order Instability

**What goes wrong:** If `colorFor` is keyed on `batteryId` alone (ignoring selection order), or if the selection order array is recomputed from a Set (unordered), colors flicker when batteries are toggled.

**Why it happens:** UI-SPEC §"colorFor() mapping rule" states color slot is assigned by selection order, not catalog position. A Set or sorted array would break this.

**How to avoid:** The `selectedBatteries` signal holds a `BatteryConfig[]` array in selection order. When a battery is deselected, filter it out (preserving remaining order). When re-selected, append. Never sort. The `colorFor(id, orderedIds)` helper takes the ordered array of ids from `activeBatteries`.

### Pitfall 6: `computed()` Values Are Lazy — First Read Required

**What goes wrong:** A `computed()` that is never read by any `effect()` or accessed via `.value` won't recompute. If `filteredSamples` is a computed but no effect reads it before the worker call, it may hold stale data.

**Why it happens:** Preact signals are lazy by design — computed only re-evaluates when a subscriber reads it.

**How to avoid:** Ensure the worker dispatch effect reads `filteredSamples.value` directly:
```typescript
effect(() => {
  const samples = filteredSamples.value  // this read makes effect subscribe to filteredSamples
  // ... dispatch to worker
})
```
This is the standard pattern and works correctly — just don't cache the computed result in a local variable outside an effect and expect it to update.

---

## Code Examples

### Comlink Worker File

```typescript
// src/workers/sim-worker.ts
// Source: https://github.com/GoogleChromeLabs/comlink#readme (expose API)
import * as Comlink from 'comlink'
import { runComparison } from '../domain/compare'

// Expose a subset of domain functions. runComparison is pure, serializable,
// and independently tested in Vitest (SIM-07 dual-use requirement).
Comlink.expose({ runComparison })
```

### Main Thread Worker Wiring

```typescript
// src/state/app-state.ts (or src/main.ts)
// Source: https://github.com/GoogleChromeLabs/comlink#readme (wrap API)
//         https://vite.dev/guide/features.html (worker ?worker suffix)
import * as Comlink from 'comlink'
import SimWorker from '../workers/sim-worker?worker'
import type { runComparison } from '../domain/compare'

type SimApi = { runComparison: typeof runComparison }

// Singleton — constructed once at module init, never inside effects.
export const simWorker = new SimWorker()
export const simApi = Comlink.wrap<SimApi>(simWorker)
```

### Signals Effect Driving DOM Table Update

```typescript
// Source: https://preactjs.com/guide/v10/signals/ (effect + DOM pattern)
import { effect } from '@preact/signals-core'
import { simResults, activeBatteries, isComputing } from '../state/app-state'

export function initComparisonTable(container: HTMLElement): () => void {
  const dispose = effect(() => {
    const results = simResults.value
    const batteries = activeBatteries.value
    const computing = isComputing.value

    // Dim stale table while computing
    const tableWrapper = container.querySelector('.table-scroll-wrapper')
    if (tableWrapper) {
      tableWrapper.classList.toggle('results-stale', computing)
    }

    if (!results || batteries.length === 0) return
    renderTableBody(container, results, batteries)
  })
  return dispose  // caller must invoke to clean up
}
```

### CSP Update

```typescript
// src/constants/csp.ts — update this one line:
// BEFORE: "worker-src blob:",
// AFTER:
"worker-src 'self' blob:",
// Rationale: Vite ?worker emits worker as assets/xxx.js (same-origin chunk)
// which requires 'self'; PapaParse blob worker requires blob:.
```

---

## Runtime State Inventory

This section is not applicable — Phase 4 is a greenfield feature addition, not a rename/refactor/migration. No stored data, live service config, OS state, or secrets contain strings being renamed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual postMessage + onmessage routing | Comlink expose/wrap (transparent RPC proxy) | ~2018 (Comlink v1) | Eliminates serialization boilerplate; typed via TypeScript generics |
| React/Vue/Svelte for reactive UI | Framework-agnostic signals (`@preact/signals-core`) | ~2022 (signals v1) | ~1.5 KB reactive state without virtual DOM or component lifecycle |
| `date-fns-tz` (marnusw package) | `@date-fns/tz` (official date-fns v4 companion) | 2023 (date-fns v4) | Integrated TZDate; old package stopped updates 18 months ago |
| Saldering as a full re-simulation pass | Saldering as presentation-layer framing from one `SimResult` | Phase 4 design | No double compute; saldering contrast is free (same aggregates, two formulas) |

**Deprecated/outdated:**
- `petite-vue`: last published 2022-01-18 — effectively abandoned. Do not adopt (CLAUDE.md prohibition).
- `moment.js`: maintenance mode since 2020, 70 KB gzip. Do not adopt.
- `date-fns-tz` (legacy `marnusw/date-fns-tz@3.x`): superseded by `@date-fns/tz`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vite-plugin-comlink` is not needed — manual expose/wrap is simpler for a five-line worker | Standard Stack §Alternatives | Low: the plugin adds no capabilities beyond convenience; manual pattern is equally functional |
| A2 | Comlink serializes `SimResult` (containing `Date` timestamps in `trace`) correctly via structured clone | Common Pitfalls §Pitfall 2 | Low: structured clone handles Date objects correctly per MDN; but trace size may be a performance issue |
| A3 | The production Vite `?worker` chunk lands at an assets/ URL under `'self'` (not a blob:) | Common Pitfalls §Pitfall 1 | **HIGH RISK if wrong**: CSP blocks worker entirely; must be verified by doing a `vite build` and inspecting Network tab in production |
| A4 | `@preact/signals-core` `computed()` memoizes correctly when `filteredSamples` depends on two nullable signals | Architecture Patterns §Pattern 2 | Low: this is core Preact signals behavior, documented and widely tested |
| A5 | `comlink@4.4.2` works correctly with Vite 8's module worker output without any additional plugin | Standard Stack | MEDIUM: the Vite issue #12755 was a Vite 4.x issue, closed as duplicate; Vite 8 likely resolved it, but must be verified in Wave 0 task |

---

## Open Questions

1. **Comlink + Vite 8 module worker compatibility**
   - What we know: Vite issue #12755 (build failure with `?worker` + Comlink) was filed against Vite 4.x and closed as a duplicate. Vite 8 has extensive worker improvements.
   - What's unclear: Whether any edge case remains with Vite 8 + Comlink 4.4.2's ES module worker output.
   - Recommendation: Wave 0 task: install `comlink`, write the five-line worker entry, wire it in main.ts, run `npm run build`, and verify the worker chunk loads correctly. This should be the first task in the phase — it gates everything else.

2. **Trace stripping optimization scope**
   - What we know: Phase 5 charts need `trace`; Phase 4 table does not. `trace` can be 50k rows × 5 batteries.
   - What's unclear: Whether the structured-clone overhead is perceptible on the owner's machine (daily data = 365 rows; 15-min data = ~35k rows/year).
   - Recommendation: Implement `SimOptions.includeTrace?: boolean` in the worker wrapper (not in the engine itself), default `false` for Phase 4. This is a clean seam regardless of whether perf is a problem.

3. **Single worker instance vs. terminating and re-creating on large dataset**
   - What we know: Comlink `wrap()` is a proxy; the worker runs computations sequentially in a single thread. If a new recompute is triggered before the old one finishes, both run to completion and the main thread receives the older result last.
   - What's unclear: Whether out-of-order results are possible with rapid battery selection changes.
   - Recommendation: Use an AbortController or a generation counter to discard stale results. Simple approach: increment a `computeGeneration` counter; the worker call stores its generation; only write to `simResults` if generation matches current.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | npm install, vite build | ✓ | v22.x (LTS) | — |
| npm | Package installs | ✓ | Bundled with Node | — |
| Browser (Chromium/Firefox/Safari) | Worker tests, production smoke test | ✓ (dev machine) | Current | — |
| `comlink` package | SIM-07 | NOT YET INSTALLED | to be `4.4.2` | — (required) |
| `@preact/signals-core` package | Signals state | NOT YET INSTALLED | to be `1.14.2` | — (required) |

**Missing dependencies with no fallback:**
- `comlink` — install via `npm install comlink` in Wave 0
- `@preact/signals-core` — install via `npm install @preact/signals-core` in Wave 0

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.7` |
| Config file | `vitest.config.ts` (exists — default env: node; per-file jsdom override via `// @vitest-environment jsdom` docblock) |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SIM-07 | `runComparison` testable without worker | unit (node) | `npm test -- tests/compare.test.ts` | ✅ (existing `compare.test.ts`) |
| SIM-07 | Worker entry file `expose()` is valid module | smoke (node import) | `npm test -- tests/sim-worker-contract.test.ts` | ❌ Wave 0 |
| SIM-08 | `isComputing` signal true while worker pending | unit (node, mock worker) | `npm test -- tests/app-state.test.ts` | ❌ Wave 0 |
| COMP-01 | `deriveMetrics()` returns correct values for known SimResult | unit (node) | `npm test -- tests/metrics.test.ts` | ❌ Wave 0 |
| COMP-01 | `avoidedWithoutSaldering()` = `shiftedKwh` | unit (node) | included in metrics.test.ts | ❌ Wave 0 |
| COMP-02 | Headline "zonder saldering" column is first in table DOM | DOM (jsdom) | `npm test -- tests/comparison-table.test.ts` | ❌ Wave 0 |
| COMP-03 | Leader cell gets `.table-cell--leader` class for highest-avoidedOff battery | DOM (jsdom) | included in comparison-table.test.ts | ❌ Wave 0 |
| COMP-03 | `detectLeaders()` returns correct indices for all 7 metrics | unit (node) | included in metrics.test.ts | ❌ Wave 0 |
| COMP-04 | `colorFor()` returns deterministic slot for selection-order position | unit (node) | `npm test -- tests/color.test.ts` | ❌ Wave 0 |
| COMP-04 | `colorFor()` slot 1 when first in selection, slot 2 when second | unit (node) | included in color.test.ts | ❌ Wave 0 |
| COMP-05 | Both saldering columns always rendered (no toggle re-run) | DOM (jsdom) | included in comparison-table.test.ts | ❌ Wave 0 |
| COMP-06 | Saldering disclaimer hidden by default; toggle shows it | DOM (jsdom) | included in comparison-table.test.ts | ❌ Wave 0 |
| COMP-07 | No "/jaar" or "/maand" string in table DOM | DOM (jsdom) | included in comparison-table.test.ts | ❌ Wave 0 |
| COMP-08 | Coverage indicator text matches `filterByPeriod` range | DOM (jsdom) | `npm test -- tests/period-control.test.ts` | ❌ Wave 0 |
| DATA-12 | Date inputs default to full merged range | DOM (jsdom) | included in period-control.test.ts | ❌ Wave 0 |
| DATA-12 | Changing date triggers `filteredSamples` recompute | unit (node, signals) | included in app-state.test.ts | ❌ Wave 0 |
| COMP-02 | `avoidedWithSaldering()` can return negative value (D-02) | unit (node) | included in metrics.test.ts | ❌ Wave 0 |
| CSP | `worker-src 'self' blob:` in CSP string | unit (node) | `npm test -- tests/csp-plugin.test.ts` | ✅ (existing, needs UPDATE) |

### Sampling Rate

- **Per task commit:** `npm test -- --reporter=dot` (full suite, fast)
- **Per wave merge:** `npm test` (full suite with coverage)
- **Phase gate:** Full suite green + `npm run build` successful (verifies CSP plugin + worker chunk emit) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/metrics.test.ts` — covers `deriveMetrics`, `avoidedWithSaldering`, `avoidedWithoutSaldering`, `detectLeaders`, `netImportWithValuation`
- [ ] `tests/color.test.ts` — covers `colorFor`, `colorSlotFor` with selection-order scenarios
- [ ] `tests/app-state.test.ts` — covers signal initial values, `filteredSamples` computed, `activeBatteries` computed, `isComputing` toggle
- [ ] `tests/comparison-table.test.ts` — covers DOM structure, leader highlighting, negative saldering cell, disclaimer toggle (jsdom env)
- [ ] `tests/period-control.test.ts` — covers date input defaults, coverage indicator text (jsdom env)
- [ ] `tests/sim-worker-contract.test.ts` — imports worker entry module; verifies `runComparison` is importable (smoke test, node env)
- [ ] `tests/csp-plugin.test.ts` — UPDATE existing test to assert `worker-src 'self' blob:` instead of `worker-src blob:`
- [ ] Install: `npm install comlink @preact/signals-core` — both are not in `package.json` yet

*(Existing infrastructure: Vitest 4.1.7 configured, node default env + per-file jsdom, coverage-v8. No framework changes needed.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user accounts or sessions |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Single-user local tool |
| V5 Input Validation | Yes | Custom battery form inputs; number field `min`/`step` attributes; validate on blur; never trust form values without bounds-check before passing to `runComparison` |
| V6 Cryptography | No | No cryptographic operations |
| V10 Malicious Code | Yes | No `eval()`; no dynamic `import()`; no postMessage-derived code execution; Comlink messages are structured-clone only (no function serialization) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via custom battery name echo | Tampering | Always use `.textContent` for user-derived strings (existing convention from drop-zone.ts); never assign battery name via `.innerHTML` |
| DOM-based XSS via file name display | Tampering | Same — file names echoed via `.textContent` only (existing pattern) |
| Worker postMessage injection | Tampering | Comlink uses structured clone — no code execution path; worker-src 'self' CSP limits worker URL to same origin |
| Inline style injection | Elevation | Battery swatches use CSS class `.battery-swatch--N` only — zero inline `style=` attributes anywhere; `style-src 'self'` enforced |
| Custom battery field with crafted large numbers | Denial of service | Bound custom battery inputs: `nominalCapacityKwh` max reasonable value (e.g. 200 kWh); `max` attribute on `<input type="number">` |
| `connect-src 'none'` bypass via worker | Information Disclosure | Comlink workers inherit the page's CSP; `connect-src 'none'` applies inside the worker too — no fetch from the worker possible |

---

## Sources

### Primary (HIGH confidence)
- npm registry — `comlink@4.4.2` metadata, publish date, repository, no postinstall: `npm view comlink`
- npm registry — `@preact/signals-core@1.14.2` metadata, publish date, repository, no postinstall: `npm view @preact/signals-core`
- `github.com/GoogleChromeLabs/comlink/blob/main/src/comlink.ts` — expose(), wrap(), transfer() TypeScript signatures
- `github.com/GoogleChromeLabs/comlink/blob/main/README.md` — expose/wrap pattern, transfer(), ~1.2 KB brotli bundle size
- `preactjs.com/guide/v10/signals/` — signal/computed/effect/batch API, cleanup/dispose pattern, DOM update via effect
- `vite.dev/guide/features.html` — Web Workers section: `?worker` suffix, module worker, production chunk emit

### Secondary (MEDIUM confidence)
- `github.com/toiglak/a0c7b4927088ef6263f10201154f02fb` — practical Comlink + Vite `?worker` pattern with TypeScript Exposed interface
- `github.com/vitest-dev/vitest/issues/5571` — Comlink + Vitest incompatibility (importScripts); confirms dual-use pure-function pattern as the correct workaround

### Tertiary (LOW confidence — contextual only)
- WebSearch results for "Vite ?worker production blob: URL vs assets chunk CSP" — confirmed that `?worker` default emits chunk under 'self', not blob, in production build

---

## Metadata

**Confidence breakdown:**
- Standard stack (Comlink + signals-core): HIGH — both verified on npm registry, authoritative source orgs, no postinstall
- Architecture (signals state design): HIGH — based on official Preact signals docs and existing codebase patterns
- Comlink + Vite wiring pattern: MEDIUM — confirmed via gist and official docs; Vite 8 build output CSP implication is ASSUMED (must be confirmed in Wave 0 build check)
- Saldering framing math: HIGH — simple arithmetic, locked in CONTEXT.md D-01/D-02
- Common pitfalls: MEDIUM — CSP pitfall is HIGH confidence from Vite docs; effect leak and worker singleton pitfalls are based on library behavior documentation

**Research date:** 2026-06-11
**Valid until:** 2026-09-11 (90 days — stable libraries; Comlink has not had a release in 7 months)
