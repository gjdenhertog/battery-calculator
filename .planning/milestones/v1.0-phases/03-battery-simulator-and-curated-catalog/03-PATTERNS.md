# Phase 3: Battery Simulator and Curated Catalog - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 8 (4 new source, 1 extended source, 3 new tests)
**Analogs found:** 8 / 8

All new files drop into the existing `src/domain/` and `tests/` directories beside the
already-tested Phase 2 pure-domain modules. Every analog is a **pure, node-env, no-browser**
domain file — an exact tier match for this phase (SIM-01 / criterion 4).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/domain/types.ts` (EXTEND) | model / type contract | n/a (declarations) | `src/domain/types.ts` (self — existing `IntervalSample`/`MergeResult` block) | exact |
| `src/domain/simulate.ts` (NEW) | service / pure compute | transform (samples → SimResult) | `src/domain/merge.ts` (esp. `inferDominantCadence`) + `src/domain/gaps.ts` | exact (role + pure-transform flow) |
| `src/domain/compare.ts` (NEW) | service / pure compute | transform (`.map` fan-out) | `src/domain/period-filter.ts` (thin pure wrapper over `IntervalSample[]`) | exact |
| `src/domain/battery-catalog.ts` (NEW) | config / static data | data (typed array export) | `src/domain/types.ts` interface block + `src/domain/parsers/registry.ts` (typed singleton export) | role-match |
| `tests/simulate.test.ts` (NEW) | test | n/a | `tests/merge.test.ts` (fixture builders + `describe`/`it`) | exact |
| `tests/compare.test.ts` (NEW) | test | n/a | `tests/period-filter.test.ts` (order/identity assertions) | exact |
| `tests/catalog.test.ts` (NEW) | test | n/a | `tests/registry.test.ts` (shape/entry assertions) | role-match |

**Key convention across ALL analogs:** every domain `.ts` file opens with a block comment
naming the file, citing the requirement IDs it satisfies, and stating
"Pure function — no browser globals, safe to run in a Node environment." New files MUST
follow this header convention (see `merge.ts` lines 1-15, `gaps.ts` lines 1-15,
`period-filter.ts` lines 1-7).

---

## Pattern Assignments

### `src/domain/types.ts` (EXTEND — model)

**Analog:** `src/domain/types.ts` (self — the existing `IntervalSample` / `MergeResult` declarations)

Add `BatteryConfig`, `TraceRow`, `SimResult`, `SimOptions` beside the existing interfaces.
Do NOT create a new types file — the existing one is "the root of the domain type graph"
(line 3-6) and everything imports from it. Match its style exactly:
`export interface`, JSDoc on every field, invariant notes referencing decision/requirement IDs.

**Existing interface declaration style** (lines 25-32 — copy this shape for new interfaces):
```typescript
/**
 * One metered interval (one row after cumulative-to-delta conversion).
 *
 * Invariants:
 * - timestamp is a UTC Date marking the END of the interval (HomeWizard convention).
 * - gridImportKwh >= 0 (DATA-06 invariant; enforced at adapter boundary).
 */
export interface IntervalSample {
  /** UTC Date — the end of the interval (HomeWizard timestamps mark the interval end) */
  timestamp: Date
  /** Non-negative grid import for this interval in kWh (DATA-06 invariant: always >= 0) */
  gridImportKwh: number
  /** Non-negative grid export (feed-in / teruglevering) in kWh (DATA-06 invariant: always >= 0) */
  gridExportKwh: number
}
```

**New interfaces to add** (shapes from RESEARCH.md §Code Examples lines 438-475; field names
are Claude's discretion per D-01/D-08, but these are the locked contract):
```typescript
export interface BatteryConfig {
  id: string
  name: string
  nominalCapacityKwh: number
  dodFraction: number          // 1.0 when vendor quotes "usable" (Sessy/Tesla/Huawei)
  roundTripEfficiency: number  // 0..1; sqrt() applied each way (SIM-03)
  maxChargeKw: number
  maxDischargeKw: number
  datasheetUrl: string         // BATT-01: cited in source
}

export interface TraceRow {
  timestamp: Date              // reuse the UTC-Date convention (DATA-07)
  socKwh: number
  chargedKwh: number           // grid-side (criterion 2 → 0.55); document the choice (A-1)
  dischargedKwh: number
  residualImportKwh: number
  residualExportKwh: number
}

export interface SimResult {
  shiftedKwh: number
  residualImportKwh: number
  residualExportKwh: number
  totalImportKwh: number
  totalExportKwh: number
  periodDays: number
  coarseCadenceWarning: boolean // D-04
  trace: TraceRow[]
}

export interface SimOptions {
  coarseCadenceThresholdMinutes?: number // default ~60 (discretion, D-04)
}
```

**Validation-error pattern** (if `simulate` validates custom BatteryConfig per Security
Domain V5 — reuse the existing custom-Error-subclass convention, lines 138-156):
```typescript
export class ParseRowError extends Error {
  constructor(
    public readonly fileName: string,
    public readonly rowNumber: number,
    /* ...structured context fields... */
  ) {
    super(`Fout in bestand "${fileName}", rij ${rowNumber}, ...`)
    this.name = 'ParseRowError'
  }
}
```
A new `InvalidBatteryConfigError extends Error` (Dutch message, `this.name` set) would
mirror this if the planner chooses to throw on `NaN`/negative custom fields rather than
propagate `NaN`. Keep the NL-message convention.

---

### `src/domain/simulate.ts` (NEW — service, transform)

**Analog:** `src/domain/merge.ts` (header + `inferDominantCadence` median-delta helper) and
`src/domain/gaps.ts` (UTC-ms delta math, `samples.length <= 1` guard).

**File-header + import pattern** (merge.ts lines 1-17 — copy structure):
```typescript
/**
 * src/domain/simulate.ts — pure per-interval battery dispatch (SIM-01..04, D-04..D-07)
 *
 * Pure function — no browser globals, safe to run in a Node environment.
 *
 * Algorithm: ...
 */
import type { IntervalSample, BatteryConfig, SimResult, SimOptions } from './types'
```
Note: `import type` for type-only imports (used in merge.ts line 16, period-filter.ts line 8,
gaps.ts line 18). Do NOT import `cadenceMinutes`/`ParseFileResult` (D-05 anti-pattern).

**Interval-duration helper — the D-05 twin of `inferDominantCadence`** (merge.ts lines 99-115).
This is the load-bearing analog. Copy the median-delta + small-input-fallback shape:
```typescript
// merge.ts inferDominantCadence — the pattern to mirror for intervalHoursFor():
function inferDominantCadence(
  mergedSamples: IntervalSample[],
  sortedResults: ParseFileResult[],
): number {
  if (sortedResults.length > 0) {
    return sortedResults[0].cadenceMinutes
  }
  // Fall back to median inter-sample delta
  if (mergedSamples.length < 2) return 15
  const diffs = mergedSamples
    .slice(1)
    .map((s, i) => (s.timestamp.getTime() - mergedSamples[i].timestamp.getTime()) / 60_000)
  diffs.sort((a, b) => a - b)
  return diffs[Math.floor(diffs.length / 2)]
}
```
The new `intervalHoursFor(samples)` differs in three ways (per RESEARCH.md Pattern 1,
lines 300-318): (1) returns a `number[]` (per-interval, not one dominant value),
(2) divides by `3_600_000` for hours not `60_000` for minutes, (3) first sample uses the
**next** delta as fallback (`hours[0] = deltasMs[0] ?? medianMs`). Same `getTime()` subtraction,
same `.sort((a,b)=>a-b)[Math.floor(len/2)]` median, same `<2`-sample 15-min default.

**UTC-ms delta + length-guard pattern** (gaps.ts lines 33, 38 — reuse for the duration scan):
```typescript
if (samples.length <= 1) {            // degenerate-input guard (D-05 single-sample case)
  return { count: 0, ranges: [] }
}
const actual = new Set(samples.map((s) => s.timestamp.getTime()))  // getTime() ms math
```

**Coarse-cadence flag (D-04):** compute the median interval (same median helper) and set
`coarseCadenceWarning = medianMinutes > (options?.coarseCadenceThresholdMinutes ?? 60)`.
No analog has this exact flag, but the median-delta computation is the `inferDominantCadence`
pattern above; the boolean threshold is novel-but-trivial.

**Core dispatch state machine (SIM-02/03/04, D-06/D-07):** no codebase analog — this IS the
deliverable arithmetic. Use RESEARCH.md Pattern 2 (lines 324-358) verbatim as the reference
(Convention A: `socKwh` = energy in cell, `eff = Math.sqrt(rte)` applied each way, cap
`soc ≤ nominalCapacityKwh × dodFraction`, empty start `soc = 0`). Report `chargedKwh`
grid-side (matches criterion 2 → 0.55; A-1).

---

### `src/domain/compare.ts` (NEW — service, fan-out transform)

**Analog:** `src/domain/period-filter.ts` (thinnest pure wrapper over `IntervalSample[]` in
the codebase — same "tiny pure function, deferred UI" framing).

**Header + thin-function pattern** (period-filter.ts lines 1-32):
```typescript
/**
 * src/domain/period-filter.ts — pure sub-period filter (DATA-12, D-02)
 *
 * Pure functions with no browser globals. Safe to run in a Node environment.
 * The interactive date-picker UI is deferred to Phase 4 — this phase ships
 * only the tested pure function.
 */
import type { IntervalSample } from './types'

export function filterByPeriod(
  samples: IntervalSample[],
  start: Date | null,
  end: Date | null,
): IntervalSample[] {
  /* ... pure, returns a NEW array, does not mutate input ... */
}
```
`runComparison` is the same shape (RESEARCH.md Pattern 3, lines 362-369): a one-liner
`batteries.map((b) => simulate(samples, b, options))`. The header should note "the 5-battery
UI cap (BATT-05) and saldering framing are deferred to Phase 4" — mirroring period-filter's
"date-picker UI is deferred to Phase 4" note (lines 5-6). Import `simulate` from `./simulate`,
types from `./types`.

---

### `src/domain/battery-catalog.ts` (NEW — config, static data)

**Analog:** `src/domain/types.ts` (typed-export convention) + `src/domain/parsers/registry.ts`
(a typed, code-reviewed module-level data export with a header comment).

Ship as a `.ts` typed export, not `.json` (RESEARCH.md lines 292, A-8: compile-time validation
of the `BatteryConfig` shape, BATT-02). Header comment documents the
"usable-vs-DoD" convention (set `dodFraction: 1.0` for vendors quoting usable — Pitfall 2,
RESEARCH.md lines 236, 401-405) and notes each entry's datasheet URL is cited.

```typescript
/**
 * src/domain/battery-catalog.ts — curated NL battery catalog (BATT-01..03)
 *
 * Bundled at build time (no fetch; CSP connect-src 'none'). Each entry cites a
 * datasheetUrl. Convention: dodFraction = 1.0 when the vendor quotes "usable"
 * capacity (Sessy/Tesla/Huawei) — do NOT double-discount.
 */
import type { BatteryConfig } from './types'

export const BATTERY_CATALOG: readonly BatteryConfig[] = [
  // Sessy 5 kWh MUST be first/default (BATT-03)
  { id: 'sessy-5', name: 'Sessy 5 kWh', nominalCapacityKwh: 5.0, dodFraction: 1.0,
    roundTripEfficiency: 0.85, maxChargeKw: 2.2, maxDischargeKw: 1.7,
    datasheetUrl: 'https://www.sessy.nl/specificaties/' },
  // ...6 more entries from RESEARCH.md catalog table (lines 178-186)
] as const
```
Exact 7-entry lineup + specs in RESEARCH.md lines 176-233 (Sessy 5, Sessy 10, Zonneplan 10,
Powerwall 3, Huawei LUNA2000-5, Victron ESS, Marstek Venus E; Growatt optional 8th).

---

### `tests/simulate.test.ts` (NEW — test)

**Analog:** `tests/merge.test.ts` (fixture builders + `describe`/`it` structure for a pure
domain function).

**Imports + fixture-builder pattern** (merge.test.ts lines 14-42 — copy `sample()` verbatim;
it is the shared idiom flagged in RESEARCH.md line 542):
```typescript
import { describe, it, expect } from 'vitest'
import { simulate } from '../src/domain/simulate'
import type { IntervalSample, BatteryConfig } from '../src/domain/types'

/** Build a minimal IntervalSample from a UTC millisecond timestamp */
function sample(utcMs: number, importKwh = 0.1, exportKwh = 0.05): IntervalSample {
  return {
    timestamp: new Date(utcMs),
    gridImportKwh: importKwh,
    gridExportKwh: exportKwh,
  }
}

/** Build a contiguous sequence of 15-min samples starting at startUtcMs */
function contiguous15min(startUtcMs: number, count: number): IntervalSample[] {
  const interval = 15 * 60 * 1000
  return Array.from({ length: count }, (_, i) => sample(startUtcMs + i * interval))
}
```
Add a `contiguousDaily(startUtcMs, count)` variant (24h interval) for the D-04 coarse-cadence
fixture — same `Array.from`/interval idiom as `contiguous60min` (merge.test.ts lines 38-42).

**Anchored-timestamp constants** (period-filter.test.ts lines 26-30 — reuse `Date.UTC(...)`
+ derived offsets for readable fixtures):
```typescript
const T0 = Date.UTC(2026, 0, 15, 8, 0, 0)
const T1 = T0 + 60 * 60 * 1000
```

**`describe`/`it` + float-tolerance assertion pattern** (merge.test.ts lines 69-90 for the
block shape; `toBeCloseTo` is mandated by RESEARCH.md lines 385, 92 — criterion 1 needs 3-dp,
sqrt produces irrationals). Use `-t` test names matching the Test Map (RESEARCH.md lines 521-530):
```typescript
describe('simulate', () => {
  it('clamps charge by max power — small battery cant catch the peak (criterion 2)', () => {
    // 1.5 kWh export, 15-min interval (0.25h), Sessy 2.2 kW → 2.2 * 0.25 = 0.55 kWh charged
    const result = simulate([sample(T0, 0, 0), sample(T1, 0, 1.5)], SESSY_5)
    expect(result.trace[1].chargedKwh).toBeCloseTo(0.55, 3)
    expect(result.trace[1].residualExportKwh).toBeCloseTo(0.95, 3)
  })

  it('honors DoD cap + sqrt(rte) each way on round-trip (criterion 3)', () => {
    // 5 kWh nominal @ 0.90 DoD = 4.5 usable cap; discharge → 4.5 * sqrt(0.9) ≈ 4.269
    // MUST engage the cap — a literal 6-in/6-out with no cap yields 5.4 and FAILS.
    expect(delivered).toBeCloseTo(4.269, 2)
  })
})
```
Required fixtures (RESEARCH.md Edge-case table lines 156-166): power-clamp (0.55),
capacity-clamped round-trip (~4.269), multi-day no-export (`shiftedKwh = 0`, D-06),
daily-cadence (`coarseCadenceWarning === true`, D-04), first-sample/single-sample fallback
(no `NaN`, D-05), discharge-clamp-binds-independently (Sessy 1.7 kW), `socKwh ≥ 0` invariant,
and custom BatteryConfig runs identically (BATT-04).

---

### `tests/compare.test.ts` (NEW — test)

**Analog:** `tests/period-filter.test.ts` (order/identity assertions on a thin pure function).

Reuse the `sample()` builder and `describe`/`it` shape. Core assertion is **input-order
preservation** (SIM-06) and mixed catalog+custom — assert `result` length equals `batteries`
length and `result[i]` corresponds to `batteries[i]`. The identity/no-mutation assertion style
is in period-filter.test.ts lines 81-85:
```typescript
it('does not mutate the input array', () => {
  const copy = [...SAMPLES]
  filterByPeriod(SAMPLES, new Date(T1), new Date(T3))
  expect(SAMPLES).toEqual(copy)
})
```
For compare: `runComparison(samples, [batA, batB, custom])` → assert
`result.map(r => r.shiftedKwh)` lines up by passing distinct batteries whose ordering is
observable, and confirm `result.length === 3`.

---

### `tests/catalog.test.ts` (NEW — test)

**Analog:** `tests/registry.test.ts` (asserting on a typed exported data structure + its entries).

**Imports + entry-shape assertions** (registry.test.ts lines 15-17 for import style):
```typescript
import { describe, it, expect } from 'vitest'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'
import type { BatteryConfig } from '../src/domain/types'

describe('BATTERY_CATALOG', () => {
  it('ships 6–8 entries with Sessy 5 kWh first (BATT-03)', () => {
    expect(BATTERY_CATALOG.length).toBeGreaterThanOrEqual(6)
    expect(BATTERY_CATALOG[0].id).toBe('sessy-5')
  })

  it('every entry carries all five physics fields + datasheetUrl (BATT-02)', () => {
    for (const b of BATTERY_CATALOG) {
      expect(b.nominalCapacityKwh).toBeGreaterThan(0)
      expect(b.dodFraction).toBeGreaterThan(0)
      expect(b.dodFraction).toBeLessThanOrEqual(1)
      expect(b.roundTripEfficiency).toBeGreaterThan(0)
      expect(b.maxChargeKw).toBeGreaterThan(0)
      expect(b.maxDischargeKw).toBeGreaterThan(0)
      expect(b.datasheetUrl).toMatch(/^https?:\/\//)
    }
  })
})
```

---

## Shared Patterns

### Pure-domain file header (apply to ALL new source files)
**Source:** `src/domain/merge.ts` lines 1-15, `src/domain/gaps.ts` lines 1-15,
`src/domain/period-filter.ts` lines 1-7
**Apply to:** `simulate.ts`, `compare.ts`, `battery-catalog.ts`
Every domain file opens with a block comment: filename + one-line purpose + requirement IDs,
then the line **"Pure function — no browser globals, safe to run in a Node environment."**,
then (for compute files) a numbered Algorithm description. This is the project's house style.

### Type-only imports from the single root types module
**Source:** `merge.ts` line 16, `gaps.ts` line 18, `period-filter.ts` line 8
**Apply to:** every new source + test file
```typescript
import type { IntervalSample } from './types'           // source files
import type { IntervalSample } from '../src/domain/types' // test files
```
Never re-declare domain types locally; always import from `src/domain/types.ts` (the
"root of the domain type graph", types.ts line 3-6). New types (`BatteryConfig`, `SimResult`,
etc.) live there too.

### `sample(utcMs, importKwh?, exportKwh?)` fixture builder
**Source:** `tests/merge.test.ts` lines 23-30 (the param-defaulted variant) — also in
`tests/period-filter.test.ts` lines 17-23 (no-arg variant)
**Apply to:** `tests/simulate.test.ts`, `tests/compare.test.ts`
Copy verbatim. RESEARCH.md line 542 explicitly calls for this shared builder. Prefer the
merge.test.ts version with `importKwh`/`exportKwh` params since sim fixtures need varied flows.

### Float-tolerance assertions
**Source:** mandated by RESEARCH.md lines 385, 92 (no exact codebase analog uses `toBeCloseTo`
on kWh yet — existing tests assert `getTime()` integers exactly)
**Apply to:** all energy-value assertions in `tests/simulate.test.ts` / `tests/compare.test.ts`
Use `expect(x).toBeCloseTo(value, 3)` for aggregates (criterion 1 = 3 dp) and
`toBeCloseTo(4.269, 2)` for the sqrt-bearing round-trip. Reserve exact `.toBe()` for
integer counts, timestamps (`getTime()`), and array lengths (as registry/merge tests do).

### Median-delta + small-input fallback (cadence/duration detection)
**Source:** `src/domain/merge.ts` `inferDominantCadence` lines 99-115
**Apply to:** `simulate.ts` `intervalHoursFor()` and the coarse-cadence median (D-04/D-05)
`samples.slice(1).map((s,i)=> delta).sort((a,b)=>a-b)[Math.floor(len/2)]`, with a
`< 2` samples → default branch. RESEARCH.md "Don't Hand-Roll" (lines 383) is explicit:
do not write a fresh delta-scanner; reuse this DST-tested shape.

### Test-file purpose docblock + node-env default
**Source:** `tests/merge.test.ts` lines 1-13, `tests/period-filter.test.ts` lines 1-11
**Apply to:** all three new test files
Each test file opens with a docblock stating what it locks and the consequence of failure,
and the note "Runs in the DEFAULT node environment (no per-file environment override)."
Do NOT add a `// @vitest-environment jsdom` docblock — these are pure-domain tests
(SIM-01 / criterion 4). `vitest.config.ts` already defaults `environment: 'node'` and
includes `tests/**/*.test.ts`, so no config change is needed.

---

## No Analog Found

No file is fully without an analog. The two genuinely **novel** pieces are arithmetic, not
file-structure, and are covered by RESEARCH.md reference snippets rather than codebase analogs:

| Element | Role | Data Flow | Reason / Source to use instead |
|---------|------|-----------|--------------------------------|
| Core dispatch state machine (in `simulate.ts`) | compute | transform | No battery/SoC simulation exists yet. Use RESEARCH.md Pattern 2 (lines 324-358), Convention A. This is the deliverable arithmetic — intentionally hand-written. |
| `coarseCadenceWarning` boolean flag (in `simulate.ts`) | compute | n/a | No existing flag-on-result pattern with a threshold; the median computation reuses `inferDominantCadence`, only the `> threshold` boolean is new (trivial). |
| `toBeCloseTo` energy assertions (in tests) | test | n/a | Existing tests assert integer `getTime()` exactly; float-kWh tolerance is new but standard Vitest (RESEARCH.md lines 385). |

## Metadata

**Analog search scope:** `src/domain/` (types.ts, merge.ts, gaps.ts, period-filter.ts,
parsers/registry.ts), `tests/` (merge.test.ts, period-filter.test.ts, registry.test.ts),
`vitest.config.ts`
**Files scanned:** 9 read in full or in part (all under 333 lines; no large-file paging needed)
**Pattern extraction date:** 2026-06-09
