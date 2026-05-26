# Architecture Research

**Domain:** Client-side time-series simulation tool (home battery sizing calculator)
**Researched:** 2026-05-26
**Confidence:** HIGH

This document answers the seven architecture questions for a fully client-side, vanilla TypeScript + Vite single-page app that ingests energy CSV exports, simulates battery behavior, and renders a comparison table + charts. All findings are scoped to a static GitHub Pages deployment with no backend.

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER (DOM)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  Upload  │  │  Period  │  │ Battery  │  │ Comparison Table │    │
│  │ Dropzone │  │ Selector │  │  Picker  │  │   + Charts View  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘    │
│       │             │             │                  │              │
│       └─────────────┴─────────────┴──────────────────┘              │
│                            │ subscribe / emit                       │
├────────────────────────────┼────────────────────────────────────────┤
│                       STATE LAYER (signals)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  files[]   period   batteries[]   saldering   results[]      │  │
│  │  (atoms)   (atom)   (atom)        (atom)      (computed)     │  │
│  └──────────────────────────────────────────────────────────────┘  │
├────────────────────────────┼────────────────────────────────────────┤
│                      DOMAIN LAYER (pure TS)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Format  │→ │  Parser  │→ │Normalizer│→ │     Merger       │   │
│  │ Detector │  │ Registry │  │ (canon.) │  │  (overlap rule)  │   │
│  └──────────┘  └──────────┘  └────┬─────┘  └────────┬─────────┘   │
│                                   │                  │              │
│                                   ▼                  ▼              │
│                            IntervalSample[]   IntervalSample[]      │
│                                                      │              │
│                            ┌─────────────────────────┘              │
│                            ▼                                         │
│                   ┌──────────────────┐    ┌───────────────────┐    │
│                   │ Period Filter    │ →  │  Battery Sim      │    │
│                   │ (pure fn)        │    │  (pure fn)        │    │
│                   └──────────────────┘    └─────────┬─────────┘    │
│                                                     │               │
│                                                     ▼               │
│                                          ┌───────────────────────┐ │
│                                          │ Comparison Aggregator │ │
│                                          │ (map sim over Battery │ │
│                                          │  candidates)          │ │
│                                          └───────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                       I/O & WORKER LAYER                             │
│  ┌──────────────────────────┐    ┌────────────────────────────┐    │
│  │  parser.worker.ts        │    │  simulator.worker.ts       │    │
│  │  (file → IntervalSample[])│    │  (samples × battery → Result)│  │
│  └──────────────────────────┘    └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

The split is deliberate: the **Domain Layer is pure TypeScript with zero DOM/browser dependencies**. Workers are I/O adapters that import the same pure domain functions; the simulator running in a worker is the same code that runs in a unit test.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Format Detector** | Sniff a file's source format from a sample of bytes / first N lines (header signature, delimiter, column names). Returns a `FormatId` or `'unknown'`. | Ordered list of "match probes," each returning a confidence score; highest wins. |
| **Parser Registry** | Map `FormatId → Parser`. Dispatches a raw file to the right parser. | A `Map<FormatId, Parser>` populated at module load; new formats register by import side-effect or explicit `register()` call. |
| **Parser (per format)** | Pure function: `(rawText, parseOptions) → RawSample[]` for one source format. Owns delimiter, encoding, header skipping, locale (NL decimal commas). | One file per format under `src/domain/parsers/`. Uses PapaParse for tokenization, then maps columns. |
| **Normalizer** | Convert `RawSample[]` from any parser into the canonical `IntervalSample[]` shape with consistent units (kWh) and timezone (Europe/Amsterdam) and an explicit `intervalSeconds` field. | Format-specific normalizers live next to each parser; output is a uniform stream. |
| **Multi-file Merger** | Combine `IntervalSample[]` streams from N files. Resolve overlaps by **higher-resolution wins** (shorter `intervalSeconds`). Detect gaps, log them. | Sort by start time, walk both streams with a two-pointer merge; chunk decisions are at the sample level. |
| **Period Selector / Filter** | Slice `IntervalSample[]` to a user-chosen `[start, end]`. | Pure binary-search slice. |
| **Battery Model + Simulator** | Pure function: `(samples, BatteryConfig) → SimResult`. Walks samples chronologically; for each export sample, charge battery up to its constraints; for each import sample, discharge battery; tracks state of charge, kWh shifted, kWh lost to efficiency, residual import/export. | Single `simulate()` function. No globals, no time/Date inside the loop (timestamps come from samples). |
| **Saldering Toggle** | Configuration flag passed to the simulator/aggregator. In v1 it does **not** change the simulation math (which is in kWh) — it only changes how results are *presented* and which residual metrics are highlighted. Reserve a hook in `SimOptions` so v2 (€) can branch on it cleanly. | Plain boolean on `SimOptions`. |
| **Comparison Aggregator** | Run `simulate()` N times (one per candidate battery) over the same period-filtered series. Collect into `ComparisonResult`. | `batteries.map(b => simulate(samples, b))`. Embarrassingly parallel — natural fit for one worker per battery, but in v1 a single worker is enough. |
| **Presentation** | Render the comparison table and charts from `ComparisonResult`. The chart library reads the same data structure. | Vanilla DOM helpers + one chart library (Chart.js or uPlot). |
| **State** | Hold `files`, `period`, `batteries`, `saldering`, `results`. Notify subscribers on change. In-memory only; reset on reload. | Signals / atoms (see Pattern 2). |

### Validating the proposed split

The user's proposed split is sound. Three refinements:

1. **Source detection is not a separate "step in the pipeline"; it's a strategy used by the parser registry.** Treat it as a function `detectFormat(file): FormatId`, called once per file at the upload boundary. Don't model it as a long-lived component.
2. **Normalizer should live with each parser, not as a global step.** A "normalize" stage that knows about every source format is exactly the kind of switch-statement that grows brittle. Each parser is responsible for emitting the canonical `IntervalSample[]` shape. The "normalizer concept" then collapses into "every parser implements the same return type."
3. **Saldering does not belong as a component in v1.** It's a flag, not a module. If you give it a module, you'll be tempted to put pricing logic in it before the data model exists. Defer until v2.

**Leaky boundaries seen in similar tools:**

- **Parsers reaching into the UI** to surface "couldn't parse row 47" warnings. Fix: parsers return `{samples, warnings}`; UI decides how to render warnings.
- **The simulator pulling timezone/clock state from the environment.** Fix: the simulator only reads timestamps from samples; it never calls `new Date()` or `Date.now()`.
- **Charts coupled to the simulator output shape.** Fix: a thin "view-model" mapper translates `ComparisonResult → ChartData`. Then a chart library swap is a one-file change.
- **State store leaking parser internals** (file objects, parse progress events). Fix: state holds normalized domain objects; transient parse state lives inside the parser worker call.

## Recommended Project Structure

```
src/
├── domain/                       # Pure TS, no DOM, no browser APIs, no I/O
│   ├── types.ts                  # IntervalSample, BatteryConfig, SimResult, ComparisonResult, FormatId
│   ├── parsers/
│   │   ├── index.ts              # Parser registry + detectFormat()
│   │   ├── parser.ts             # Parser interface
│   │   ├── homewizard-p1.ts      # First concrete parser (v1)
│   │   ├── homewizard-p1.test.ts # Unit test with fixture CSV
│   │   └── __fixtures__/
│   │       └── homewizard-sample.csv
│   ├── merge/
│   │   ├── merger.ts             # Multi-file overlap resolution
│   │   └── merger.test.ts
│   ├── period/
│   │   └── filter.ts             # Period slicing
│   ├── simulator/
│   │   ├── simulator.ts          # Pure simulate() function
│   │   ├── simulator.test.ts     # Fixture-driven tests
│   │   ├── battery-model.ts      # State-of-charge math, efficiency, DoD
│   │   └── __fixtures__/
│   │       └── one-week-known-result.json
│   ├── compare/
│   │   └── aggregator.ts         # Map sim over N batteries
│   └── catalog/
│       └── batteries.ts          # Bundled JSON of curated NL batteries
├── workers/                      # Worker shells; thin adapters around domain/
│   ├── parser.worker.ts          # Imports domain/parsers, exposes via Comlink
│   └── simulator.worker.ts       # Imports domain/simulator + compare
├── state/                        # Reactive state, framework-agnostic
│   ├── store.ts                  # Atoms + computed signals
│   └── pipeline.ts               # Wires state changes → worker calls → results
├── ui/                           # DOM rendering, event handlers
│   ├── dropzone.ts
│   ├── period-selector.ts
│   ├── battery-picker.ts
│   ├── comparison-table.ts
│   ├── charts/
│   │   ├── monthly-bars.ts
│   │   └── sample-week.ts
│   └── view-model.ts             # SimResult → ChartData translator
├── main.ts                       # Bootstrap: wire UI to state to workers
└── index.html
```

### Structure Rationale

- **`domain/` has zero browser dependencies.** It can be unit-tested with Vitest in a Node environment. This is the single most important rule of the codebase; everything else falls out of it.
- **`workers/` are adapters, not logic.** A worker file is ~20 lines that imports a pure function and calls Comlink's `expose()`. If a worker file grows past 50 lines, logic is leaking into the wrong layer.
- **`state/` is separate from `ui/`.** A future redesign of the UI should not require touching state. State is also the only layer that talks to workers; UI never invokes a worker directly.
- **`parsers/` is per-format, one file each.** Adding a new format = adding a new file + one line in the registry. No central switch.
- **Tests live next to source.** Fixture CSVs and known-result JSON live in `__fixtures__/` directories. This keeps the test data discoverable when changing the corresponding code.

## Architectural Patterns

### Pattern 1: Parser Registry (extensibility for new CSV formats)

**What:** A registry maps `FormatId` to a `Parser` implementation. Format detection is itself a list of probes that each parser can register. Adding a new source = adding a new file that exports a `Parser` and registers it.

**When to use:** Whenever the project anticipates a growing list of source formats with similar output shapes — the explicit goal of this project.

**Trade-offs:** Slight indirection vs. a switch statement. Pays for itself the moment you add the second format, and prevents the "central switch" anti-pattern (anti-pattern 1 below).

**Example:**

```typescript
// src/domain/parsers/parser.ts
export interface Parser {
  id: FormatId;
  displayName: string;
  // Confidence in [0..1]; 0 = "definitely not me", 1 = "definitely me".
  detect(sample: string): number;
  parse(rawText: string): { samples: IntervalSample[]; warnings: ParseWarning[] };
}

// src/domain/parsers/index.ts
const parsers: Parser[] = [];
export function register(p: Parser) { parsers.push(p); }
export function detectFormat(sample: string): Parser | null {
  const ranked = parsers
    .map(p => ({ p, score: p.detect(sample) }))
    .filter(x => x.score > 0.5)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.p ?? null;
}

// src/domain/parsers/homewizard-p1.ts
import { register } from './index';
const homewizardP1: Parser = {
  id: 'homewizard-p1',
  displayName: 'HomeWizard P1',
  detect: (sample) => sample.includes('Energie geleverd') ? 0.95 : 0,
  parse: (raw) => { /* PapaParse, then map columns, return canonical shape */ },
};
register(homewizardP1);
```

A new format ("Eneco export") is a single new file with a `register()` call. The detector, registry, and call sites do not change.

### Pattern 2: Reactive State with Atoms + Computed Signals (vanilla TS)

**What:** Use a tiny signals library (Preact Signals standalone, ~1.7 KB, or nanostores, ~300 B) to model state as atoms (`files`, `period`, `batteries`, `saldering`) and derive `results` as a computed value. UI components subscribe to atoms and re-render the affected DOM nodes. The "settings change → sim re-runs → table updates" flow falls out of the dependency graph automatically — no manual event wiring.

**When to use:** Vanilla TS apps where you want reactive updates without coupling to a framework. Both libraries are framework-agnostic and work in plain DOM code.

**Trade-offs:**
- vs **plain observers / event bus**: signals eliminate the bookkeeping of "who needs to be notified when X changes"; the dependency graph is implicit and correct.
- vs **just recompute on demand**: recompute-on-demand is fine if there's exactly one trigger (a "Run" button). The moment you want live updates as the user drags a slider, signals win.
- **Preact Signals (recommended for v1):** Best DX, shallow reactivity (which is all this app needs — `IntervalSample[]` is replaced wholesale, not mutated). [ts-reactive-comparison](https://github.com/transitive-bullshit/ts-reactive-comparison) calls it the best standalone option.
- **Nanostores:** Slightly smaller, slightly more awkward for computed values, but legitimately tiny if bundle size becomes critical.
- **Vue's `@vue/reactivity`:** Most mature, supports deep reactivity, but heavier and pulls in framework-y vocabulary.

**Example:**

```typescript
// src/state/store.ts
import { signal, computed } from '@preact/signals-core';

export const files = signal<ParsedFile[]>([]);
export const period = signal<{ start: Date; end: Date } | null>(null);
export const batteries = signal<BatteryConfig[]>([defaultSessy]);
export const saldering = signal<boolean>(true);

export const mergedSamples = computed(() => mergeAll(files.value));
export const filteredSamples = computed(() =>
  period.value ? sliceByPeriod(mergedSamples.value, period.value) : mergedSamples.value
);

// results is async-shaped because the simulator runs in a worker
export const results = signal<ComparisonResult | 'pending' | null>(null);

// src/state/pipeline.ts — re-run simulation when inputs change
import { effect } from '@preact/signals-core';
import { runComparison } from '../workers/simulator-client'; // Comlink wrapper

effect(() => {
  const samples = filteredSamples.value;
  const bats = batteries.value;
  const sal = saldering.value;
  if (!samples.length || !bats.length) return;
  results.value = 'pending';
  runComparison(samples, bats, { saldering: sal })
    .then(r => results.value = r);
});
```

The `effect()` re-fires whenever any of its dependencies change. No event bus, no manual dirty-tracking.

### Pattern 3: Pure-Function Simulator (testability)

**What:** The simulator is a single pure function of the form `simulate(samples: IntervalSample[], battery: BatteryConfig, options: SimOptions): SimResult`. It does not read the clock, does not touch the DOM, does not import anything browser-specific, and produces identical output for identical input.

**When to use:** Whenever the math is the heart of the product and correctness matters more than convenience. This describes the battery sizing question exactly.

**Trade-offs:** Requires discipline about not "reaching out." The reward is that a fixture-driven test suite catches every change in behavior, and the same function runs in a worker, a Node test, or (later) a CLI without modification.

**Example:**

```typescript
// src/domain/simulator/simulator.ts
export function simulate(
  samples: IntervalSample[],
  battery: BatteryConfig,
  options: SimOptions,
): SimResult {
  const usableCapacityKwh = battery.capacityKwh * battery.depthOfDischarge;
  const sqrtEff = Math.sqrt(battery.roundTripEfficiency); // half loss on charge, half on discharge
  let socKwh = 0;
  let shiftedKwh = 0;
  let residualImport = 0;
  let residualExport = 0;

  for (const s of samples) {
    const hours = s.intervalSeconds / 3600;
    const maxChargeKwh = battery.maxChargeKw * hours;
    const maxDischargeKwh = battery.maxDischargeKw * hours;

    if (s.gridExportKwh > 0) {
      const room = usableCapacityKwh - socKwh;
      const acceptable = Math.min(s.gridExportKwh, maxChargeKwh, room / sqrtEff);
      socKwh += acceptable * sqrtEff;
      residualExport += s.gridExportKwh - acceptable;
    }
    if (s.gridImportKwh > 0) {
      const deliverable = Math.min(s.gridImportKwh, maxDischargeKwh, socKwh * sqrtEff);
      socKwh -= deliverable / sqrtEff;
      shiftedKwh += deliverable;
      residualImport += s.gridImportKwh - deliverable;
    }
  }

  return { shiftedKwh, residualImport, residualExport, /* ... */ };
}

// src/domain/simulator/simulator.test.ts
import { describe, it, expect } from 'vitest';
import { simulate } from './simulator';
import fixture from './__fixtures__/one-week-known-result.json';

describe('simulate', () => {
  it('matches hand-computed result for a one-week fixture', () => {
    const result = simulate(fixture.samples, fixture.battery, { saldering: true });
    expect(result.shiftedKwh).toBeCloseTo(fixture.expected.shiftedKwh, 3);
    expect(result.residualImport).toBeCloseTo(fixture.expected.residualImport, 3);
  });

  it('is idempotent', () => {
    const a = simulate(fixture.samples, fixture.battery, { saldering: true });
    const b = simulate(fixture.samples, fixture.battery, { saldering: true });
    expect(a).toEqual(b);
  });
});
```

Fixtures should include: a hand-computed week, an all-import day (battery never charges), an all-export day (battery never discharges, then fills), a midday solar peak that exceeds `maxChargeKw` (the "small battery can't catch the peak" case the project explicitly cares about), and an end-of-period non-empty battery.

### Pattern 4: Workers as Adapters (not as logic owners)

**What:** Each worker file is a thin Comlink-exposed wrapper around a domain function. The worker imports the pure function and exposes it; the worker itself contains no logic.

**When to use:** As soon as a domain function is large enough to block the main thread (see Performance section below).

**Trade-offs:** Comlink adds ~1.1 KB. In return, calling a worker function looks like an `await` on a normal function, with full TypeScript types via `Remote<T>` ([Comlink](https://github.com/GoogleChromeLabs/comlink)).

**Example:**

```typescript
// src/workers/simulator.worker.ts
import * as Comlink from 'comlink';
import { simulate } from '../domain/simulator/simulator';
import { runComparison } from '../domain/compare/aggregator';
Comlink.expose({ simulate, runComparison });

// src/workers/simulator-client.ts
import * as Comlink from 'comlink';
const worker = new Worker(new URL('./simulator.worker.ts', import.meta.url), { type: 'module' });
export const simWorker = Comlink.wrap<{
  simulate: typeof import('../domain/simulator/simulator').simulate;
  runComparison: typeof import('../domain/compare/aggregator').runComparison;
}>(worker);
```

Vite supports `new Worker(new URL(..., import.meta.url), { type: 'module' })` natively — no extra plugin needed.

## Data Flow

### Request Flow (drop a file → see a comparison table)

```
User drops files                                                            [UI]
    │
    ▼
ui/dropzone.ts → state.files.push(File)                                     [UI → State]
    │
    ▼
effect() sees files change → spawn parserWorker.parse(file) per file        [State → Worker]
    │
    ▼
parser.worker.ts:                                                           [Worker, off main thread]
   detectFormat(sample)
   → registry.lookup(formatId).parse(rawText)
   → returns { samples: IntervalSample[], warnings }
    │
    ▼
state.parsedFiles[i] = result                                               [Worker → State]
    │
    ▼
computed: mergedSamples = mergeAll(parsedFiles)                             [State, pure]
   (sort by timestamp; overlap → higher-resolution wins)
    │
    ▼
computed: filteredSamples = sliceByPeriod(mergedSamples, period)            [State, pure]
    │
    ▼
effect() sees filteredSamples or batteries change                           [State]
    │
    ▼
simulator.worker.runComparison(samples, batteries, options)                 [Worker, off main thread]
   → for each battery: simulate(samples, battery, options) → SimResult
   → returns ComparisonResult
    │
    ▼
state.results = ComparisonResult                                            [Worker → State]
    │
    ▼
ui/comparison-table.ts and ui/charts/* re-render from results               [State → UI]
   (view-model.ts maps SimResult → ChartData first)
```

### Data shape at each step

| Step | Type | Example fields |
|------|------|----------------|
| File upload | `File` (browser) | `name`, `size`, `lastModified` |
| Raw parse | `RawSample[]` (format-specific) | Whatever the source CSV columns are |
| **Canonical** (after normalize) | `IntervalSample[]` | `timestamp: Date`, `intervalSeconds: number`, `gridImportKwh: number`, `gridExportKwh: number`, `sourceFormat: FormatId` |
| Merged | `IntervalSample[]` | Same shape, deduplicated, sorted |
| Filtered | `IntervalSample[]` | Same shape, sliced to period |
| Sim per battery | `SimResult` | `battery: BatteryConfig`, `shiftedKwh`, `residualImport`, `residualExport`, `selfConsumptionPct`, `monthlyBreakdown: MonthBucket[]`, `sampleWeekFlow: FlowPoint[]` |
| Comparison | `ComparisonResult` | `{ period, results: SimResult[] }` |
| Chart input | `ChartData` (per chart) | Plot-shape (Chart.js datasets, uPlot arrays) |

**The canonical `IntervalSample[]` is the single contract that decouples the entire pipeline.** Everything upstream produces it; everything downstream consumes it. Every parser, however weird the source, lands here. Every consumer — merger, filter, simulator, charts — reads only this shape.

### State Management

```
[Signals: files | period | batteries | saldering]
       │
       │ (atom .value writes trigger dependents)
       ▼
[Computed: mergedSamples → filteredSamples]
       │
       │ (computed re-evaluates when reads change)
       ▼
[Effect: trigger worker.runComparison(...)]
       │
       │ (async; writes signal when done)
       ▼
[Signal: results]
       │
       │ (subscribed by UI)
       ▼
[UI re-renders affected nodes]
```

Use `@preact/signals-core` for v1 unless bundle size becomes a hard constraint, in which case switch to `nanostores`. Both work in vanilla TS without any framework. ([nanostores](https://github.com/nanostores/nanostores))

### Key Data Flows

1. **Add a file:** `files.push(File)` → parse-worker per file → `parsedFiles[i]` update → `mergedSamples` recompute → `filteredSamples` recompute → sim-worker re-run → `results` update → UI re-render.
2. **Change period:** `period.value = ...` → `filteredSamples` recompute → sim-worker re-run → UI re-render. (Parsers do not re-run; merge does not re-run.)
3. **Toggle a battery candidate:** `batteries.value = [...]` → sim-worker re-run (only the simulator step; samples are reused).
4. **Toggle saldering:** in v1, only affects the table's "savings" framing, not the math. Reflect this by making `saldering` a presentation-layer dependency, not a sim input. Wire it as a `SimOptions` field anyway so v2 (€) can read it without restructuring.

## Performance Considerations

The project's data scale (35k rows for a year of 15-min P1; 100k+ for multi-file) drives every performance decision below.

### Main-thread blocking threshold

The accepted threshold for a "long task" in browsers is **50 ms** — past this point the page is considered unresponsive and user interactions queue up; past **100 ms** users perceive sluggishness; past several hundred ms the freeze is obvious ([web.dev: Optimize long tasks](https://web.dev/articles/optimize-long-tasks), [MDN: blockingDuration](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming/blockingDuration)).

### Estimated cost per stage (order-of-magnitude, modern laptop)

| Stage | 35k rows (1 year) | 100k rows (multi-file) | 350k rows (5 years, 5-min) |
|-------|-------------------|------------------------|----------------------------|
| Parse (PapaParse, header-mapped) | ~80–200 ms | ~250–600 ms | ~1.0–2.5 s |
| Merge (two-pointer) | < 10 ms | ~30 ms | ~150 ms |
| Filter (binary slice) | < 1 ms | < 1 ms | ~1 ms |
| Simulate (one battery, simple loop) | ~10–30 ms | ~30–80 ms | ~100–300 ms |
| Simulate (N=5 batteries) | ~50–150 ms | ~150–400 ms | ~500 ms–1.5 s |
| Chart render | depends on library | depends | depends |

Numbers are estimates from prior in-browser CSV + numeric loop work; verify with a microbenchmark in Phase 0. Even modest assumptions put **parsing and N-battery simulation past the 50 ms threshold for any realistic file size.**

### Worker recommendation

- **Parsing: run in a worker.** PapaParse's official guidance is `worker: true` for files > 1 MB ([PapaParse docs](https://www.papaparse.com/)). A year of P1 data is ~2–4 MB. Worker mode is one line: `Papa.parse(text, { worker: true, ... })` — but the project's parser layer is more complex than raw PapaParse, so wrap the full parser (PapaParse + column mapping + canonical shape) in a Comlink worker.
- **Simulator: run in a worker.** Even one battery on 100k rows is near the threshold; N=5 batteries is firmly past it. The simulation is embarrassingly parallel across batteries, so wrap the whole `runComparison` in a single worker; if you later want true parallelism, fan out one worker per battery.
- **Merger and filter: stay on main thread.** Both are O(n) with tiny per-row cost; they will not block at the data sizes this project handles.

### Implementation order for workers

1. **Phase 0/1**: Build everything on the main thread. Get correctness first. The pure-function discipline makes the worker move trivial later.
2. **Phase 2 (multi-file or year-of-data)**: Move parser to a worker once any realistic file noticeably stalls the dropzone.
3. **Phase 2/3 (comparison view)**: Move simulator to a worker once N-battery comparison stalls slider interactions.

Use [Comlink](https://github.com/GoogleChromeLabs/comlink) for the move — it preserves the function-call ergonomics and TypeScript types of the domain functions ([blog.johnnyreilly](https://blog.johnnyreilly.com/2020/02/21/web-workers-comlink-typescript-and-react), [LogRocket](https://blog.logrocket.com/comlink-web-workers-match-made-in-heaven/)).

### Transfer cost

Worker `postMessage` copies data by structured clone. 100k `IntervalSample` objects (~50 bytes each) ≈ 5 MB of clone. This is a few tens of ms — acceptable. If it ever isn't, switch to a columnar layout (`{ timestamps: Float64Array, gridImportKwh: Float32Array, ... }`) and transfer the typed arrays — zero-copy. Don't optimize prematurely; measure first.

## Scaling Considerations

This is a single-user client-side calculator, so "scaling" means data size per session, not concurrent users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| ≤ 35k rows (1 year, 15-min) | No workers needed. Everything on main thread is fine for a "click Run" UX. Use workers anyway for clean architecture from day 1. |
| 35k–500k rows | Parser worker + simulator worker (the recommended v1 default). |
| 500k–5M rows | Columnar typed-array data layout + transferable buffers. Stream parsing (PapaParse `step`) instead of full-file. Consider IndexedDB for between-session persistence. |
| > 5M rows | Out of scope. NL household data won't realistically reach this. If you do, this is no longer a "calculator" — it's analytics tooling and needs a different architecture. |

### Scaling Priorities

1. **First bottleneck: parse latency on multi-file upload.** Mitigation: parser worker + show a per-file progress signal.
2. **Second bottleneck: simulation re-run latency on slider drag.** Mitigation: simulator worker; debounce slider input (~150 ms) so we don't queue up sims faster than they complete.
3. **Third bottleneck: chart rendering on 100k+ points.** Mitigation: downsample for display (largest-triangle-three-buckets) — but render from full data. Or pick a high-perf chart lib (uPlot) over Chart.js if this bites.

## Build Order Implications

This maps directly to phase planning. The order is bottom-up by dependency: build leaves first, then trunks, then UI on top.

### Round 1 — Standalone leaves (build independently, no UI)

These can be developed and unit-tested with zero browser dependencies.

1. **`domain/types.ts`** — `IntervalSample`, `BatteryConfig`, `SimResult`, etc. Defines the contracts.
2. **`domain/parsers/homewizard-p1.ts`** + fixture CSV + tests. First concrete parser. Vendors the canonical shape.
3. **`domain/parsers/index.ts`** — registry + `detectFormat()`. Trivial once one parser exists.
4. **`domain/simulator/simulator.ts`** + hand-computed fixture + tests. Most important code in the project.
5. **`domain/merge/merger.ts`** + tests for overlap resolution.
6. **`domain/period/filter.ts`** + tests.

These six files are the heart of the product. They can be developed in any order and built before any UI exists. **A milestone "domain complete, all tests green" is a real, demonstrable checkpoint.**

### Round 2 — Aggregation and workers

7. **`domain/compare/aggregator.ts`** — depends on simulator.
8. **`domain/catalog/batteries.ts`** — static JSON of curated NL batteries; depends on `BatteryConfig` type.
9. **`workers/parser.worker.ts` + `simulator.worker.ts`** — depend on the domain functions they wrap. Trivial wrappers.

### Round 3 — Wiring

10. **`state/store.ts`** — signals for files, period, batteries, saldering, results.
11. **`state/pipeline.ts`** — `effect()` blocks that connect state changes to worker calls.

### Round 4 — Surface (leaves of the tree, depend on everything below)

12. **`ui/dropzone.ts`** — first interactive surface.
13. **`ui/battery-picker.ts`** — depends on catalog + state.
14. **`ui/period-selector.ts`** — depends on merged samples being available.
15. **`ui/comparison-table.ts`** — depends on results signal.
16. **`ui/charts/*` + `view-model.ts`** — last; depend on results.
17. **`main.ts`** — bootstrap, ~30 lines.

### Roadmap implication

The simulator and at least one parser can be built and proven correct **before any UI exists**. That's a unit-testable Phase 1 with a tangible "deliverable" (fixture-passing tests + `npm run dev:cli` against a sample file). UI is genuinely a Phase 2+ concern. This shape avoids the common trap of building dropzones before knowing what the math should output.

## Anti-Patterns

### Anti-Pattern 1: Central switch statement for source formats

**What people do:** A `parseAnyCsv(file)` function with `switch (formatId) { case 'p1': ... case 'eneco': ... }`. Or worse, format detection and column mapping interleaved in one giant function.

**Why it's wrong:** Every new format edits the same file. Conflicts compound across PRs. Format-specific edge cases leak into shared code. Detection logic for one source can subtly change behavior for another.

**Do this instead:** Parser Registry (Pattern 1). Each format is one file. The registry never needs to be edited when adding a format.

### Anti-Pattern 2: Simulator that reads the clock or the DOM

**What people do:** The simulator calls `Date.now()` to time itself, or reads a checkbox directly to decide which mode it's in, or imports a state module to read battery config.

**Why it's wrong:** The simulator becomes untestable except by mounting the whole app. Bugs become non-reproducible. The simulator becomes the dirtiest, most-coupled file in the codebase — the exact opposite of what you want for the heart of the product.

**Do this instead:** `simulate(samples, battery, options) → SimResult`. Inputs in, output out, no I/O. Drive it from fixtures. The worker, the UI, and the test runner all call the same function the same way.

### Anti-Pattern 3: State store that holds File objects, raw text, or parser progress

**What people do:** `store.files = [File, File, File]` (browser objects) plus `store.rawText = [string, string, string]` plus `store.parseProgress = [0.3, 1.0, 0.7]`.

**Why it's wrong:** State now contains transient I/O concerns. Serializing state for debugging or persistence becomes impossible. File objects are not equal-comparable, so reactive computeds re-fire on identity changes.

**Do this instead:** State holds domain objects (`ParsedFile = { name, samples, warnings, formatId }`). Files are consumed by the parser at the upload boundary and discarded. Progress is a transient parser-call concern, not state.

### Anti-Pattern 4: Saldering as a branch in simulator math (v1)

**What people do:** `if (options.saldering) socKwh -= ...else socKwh -= ...` in v1, anticipating future € work.

**Why it's wrong:** Saldering in v1 does not change the kWh math — kWh shifted is the same regardless. Adding the branch now invites bugs and obscures the actual model. When v2 introduces €, the branch belongs in the pricing layer, not the simulator.

**Do this instead:** Pass `saldering` through `SimOptions` so the interface is stable, but make the v1 simulator ignore it. The comparison table reads `saldering` to choose its column headers.

### Anti-Pattern 5: Charts coupled to `SimResult` shape

**What people do:** Chart rendering code reaches into `SimResult.monthlyBreakdown[i].importKwh` directly.

**Why it's wrong:** Swapping chart libraries or changing the result shape means touching every chart. The result type becomes pinned by chart concerns.

**Do this instead:** A `view-model.ts` translates `SimResult → ChartData`. Charts consume `ChartData`. Both sides evolve independently.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| (none) | — | Project explicitly forbids network calls with user data. No external services. |

The architecture's most important integration point is that there are **no external integrations**. This shapes everything: no auth, no fetch, no API client layer, no error retry logic, no CORS. The "service boundary" is the worker boundary, which is in-process.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ State | Signals (subscribe / `.value =`) | UI never calls workers or domain directly. |
| State ↔ Worker | Comlink RPC (async function calls) | State exposes `await worker.runComparison(...)` semantics; never raw `postMessage`. |
| Worker ↔ Domain | Plain function calls | Worker is a thin adapter; the import graph from worker to domain is shallow. |
| Domain modules | Plain function calls + shared types | No circular imports; types in `domain/types.ts` is everyone's dependency. |
| Parser Registry ↔ Concrete Parsers | `register()` side-effect at module load | New parsers are added by import. Detector ranks all registered parsers. |

## Sources

- [web.dev: Optimize long tasks](https://web.dev/articles/optimize-long-tasks) — 50 ms long-task threshold.
- [MDN: PerformanceLongAnimationFrameTiming.blockingDuration](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming/blockingDuration) — definition of blocking duration.
- [PapaParse documentation](https://www.papaparse.com/) — `worker: true` recommended for files > 1 MB.
- [GoogleChromeLabs/comlink](https://github.com/GoogleChromeLabs/comlink) — RPC wrapper for Web Workers.
- [Web Workers, comlink, TypeScript and React (johnnyreilly blog)](https://blog.johnnyreilly.com/2020/02/21/web-workers-comlink-typescript-and-react) — TypeScript wiring with Comlink.
- [Comlink and web workers: a match made in heaven (LogRocket)](https://blog.logrocket.com/comlink-web-workers-match-made-in-heaven/) — Comlink usage patterns.
- [ts-reactive-comparison](https://github.com/transitive-bullshit/ts-reactive-comparison) — survey of TS reactive libraries; Preact Signals rated best for standalone.
- [nanostores](https://github.com/nanostores/nanostores) — tiny framework-agnostic state manager.
- [Hexagonal Architecture (Ports and Adapters) overview (Code Soapbox)](https://codesoapbox.dev/ports-adapters-aka-hexagonal-architecture-explained/) — domain-core / adapter separation used in this design.
- [Merge Intervals algorithm reference](https://js.muthu.co/posts/given-a-collection-of-intervals-merge-all-overlapping-intervals/) — sort-and-walk pattern used by the multi-file merger.

---
*Architecture research for: client-side time-series simulation tool (home battery sizing calculator)*
*Researched: 2026-05-26*
