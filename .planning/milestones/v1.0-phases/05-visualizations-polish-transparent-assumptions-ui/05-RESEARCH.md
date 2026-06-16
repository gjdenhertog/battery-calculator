# Phase 5: Visualizations, Polish, Transparent-Assumptions UI — Research

**Researched:** 2026-06-14
**Domain:** uPlot chart integration, DST-safe month bucketing, CSS-only tooltip pattern, Vitest CI grep audits
**Confidence:** HIGH — all major claims verified against live source files and official uPlot TypeScript definitions

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: One battery at a time on the flow chart via dropdown; default first-selected battery.
- D-02: Four series as step lines — grid import, grid export, battery charge, battery discharge. No SoC line.
- D-03: Week label = dated caption with reason (highest-teruglevering week).
- D-04: Bar height = kWh self-consumed (shiftedKwh) per month per battery, Europe/Amsterdam local months.
- D-05: Partial months drawn with distinct treatment (lower alpha) + "(deels)" label. No extrapolation.
- D-06: Sparse data (0–1 full months) renders with "weinig data" note — does not hide the chart.
- D-07: One collapsible "Hoe is dit berekend?" panel with "Waarom geen euro's?" as a subsection.
- D-08: Saldering caveat in BOTH the co-located Phase 4 disclaimer AND the transparency panel (full).
- D-09: "Waarom geen euro's?" states only the why — no v2 promise of a euro feature.
- D-10: "Teruglevering" is the canonical user-facing term for solar surplus.
- D-11: Tooltips = dotted-underline term, hover on desktop + tap-to-toggle on mobile. Not native title=.
- D-12: Honest-terminology audit (UX-05) enforced by automated CI Vitest grep test.
- D-13: Mobile is CSS-only reflow of Phase 4's responsive-ready structure at 375px.
- D-14: No-CTA audit (UX-06) enforced by the same CI grep test as D-12.

### Claude's Discretion
- Charting library integration mechanics (uPlot init, axis/grid/legend styling, stepped-path config, resize handling).
- Internal file layout for new chart/UI modules (e.g. `src/ui/charts/...`).
- Exact set of tooltipped terms and glossary copy (within D-11 constraints).
- Visual treatment specifics for partial-month bars (opacity-based as specified in UI-SPEC).
- Panel copy wording (within D-07/D-08/D-09 constraints).
- uPlot resize/responsive behavior specifics for charts on narrow screens.

### Deferred Ideas (OUT OF SCOPE)
- Multiple custom batteries + saldering-OFF-by-default (Phase 6).
- Terugleverkosten €/kWh input (SALD-02), year-by-year saldering schedule (SALD-01).
- Dynamic-price battery dispatch (DYN), € / payback / ROI outputs (FIN).
- kWh↔% toggle on monthly bars.
- State-of-charge line / net-grid collapse on the flow chart.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIZ-01 | Grouped-bar chart: self-consumption per month per selected battery | bucketByMonth() pure helper + uPlot.paths.bars() builder |
| VIZ-02 | Sample-week flow chart: grid import/export + battery charge/discharge as step lines for representative week (highest-export) | selectRepresentativeWeek() pure helper + uPlot.paths.stepped() builder |
| VIZ-03 | Charts use step lines (never interpolated) for quantized energy data | uPlot.paths.stepped({align: 1}) — confirmed in uPlot.d.ts and demos |
| VIZ-04 | All numbers ≤ 1 decimal place; UI unit-formatter helper covered by test | formatKwh() already in format.ts; needs formatAxisKwh() adapter + tests |
| UX-01 | Collapsible "Hoe is dit berekend?" panel listing simulator assumptions in plain Dutch | Native HTML `<details>`/`<summary>` — no JS needed for open/close |
| UX-02 | "Waarom geen euro's?" explainer — why kWh only, no euro promise | Subsection inside UX-01 panel per D-07 |
| UX-03 | Full Dutch UI; technical terms have hover/tap tooltips | CSS ::after pseudo-element + JS touchstart toggle, no native title= |
| UX-04 | Results layout readable on 375px mobile — no horizontal scroll for headline numbers | CSS-only @media (max-width: 480px) reflow using Phase 4 data-metric/data-label hooks |
| UX-05 | Terminology audit: zero banned terms in src/ (enforced by CI grep) | Vitest node-env test reading src/ files via fs.readFileSync (Phase 1/2 pattern) |
| UX-06 | No email/account/contact/offerte CTA (enforced by CI grep) | Same Vitest test file as UX-05; additional banned patterns |
</phase_requirements>

---

## Summary

Phase 5 is a pure consumer-surface layer: it consumes the already-proven `SimResult[]` from Phase 4 signals and renders two uPlot charts, a transparency panel, and Dutch-language polish. No new physics, no new data layer.

**The stack is locked.** uPlot `^1.6.32` is the one new runtime dependency. The rest of the work is: (1) two pure helper modules (`bucketByMonth`, `selectRepresentativeWeek`), (2) thin DOM adapters that mount uPlot charts inside `#results-region`, (3) four new CSS files, (4) the transparency panel and tooltips in HTML/TS, and (5) two Vitest CI grep tests (terminology + CTA audits).

All Phase 4 contracts verified live in the codebase — `SimResult.trace`, `TraceRow` fields, `colorFor()`, `colorSlotFor()`, `formatKwh()`, the signals store, and `#results-region` mount point are exactly as CONTEXT.md describes. No assumptions needed about existing code.

**Primary recommendation:** Decompose into waves: Wave 0 = install uPlot + Wave 0 test stub; Wave 1 = pure domain helpers (bucketByMonth, selectRepresentativeWeek, formatAxisKwh) + tests; Wave 2 = CSS files (charts.css, tooltips.css, transparency-panel.css, mobile-reflow.css); Wave 3 = chart DOM adapters + transparency panel + tooltip JS; Wave 4 = CI grep tests; Wave 5 = main.ts wiring + live human-verify.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Month bucketing (VIZ-01 data prep) | Pure domain (node-safe) | — | No browser globals needed; must be testable without canvas |
| Week selection heuristic (VIZ-02 data prep) | Pure domain (node-safe) | — | Same — pure function over TraceRow[] |
| Number formatting for axis ticks | Pure domain (node-safe) | — | Extension of existing format.ts |
| uPlot chart mounting + resize | Browser DOM adapter | — | Requires HTMLElement + ResizeObserver; isolated in src/ui/charts/ |
| Reactive re-render on signal change | Browser DOM adapter | Preact signals effect() | effect() subscription pattern already established in comparison-table.ts |
| Transparency panel | Browser DOM | — | Native <details>/<summary>; no JS for open/close |
| Tooltip show/hide (desktop hover) | CSS-only | — | :hover::after pseudo-element in tooltips.css |
| Tooltip show/hide (mobile tap) | JS touchstart handler | CSS class toggle | .term-tooltip--open class toggled by JS event listener |
| Mobile layout reflow | CSS-only | — | @media (max-width: 480px) in mobile-reflow.css |
| Terminology + CTA audit | CI / Vitest node-env | — | fs.readFileSync grep; same pattern as Phase 1 CSP test |

---

## Standard Stack

### Core (LOCKED — do not alter versions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| uPlot | `^1.6.32` | Time-series + grouped-bar charts | LOCKED per CLAUDE.md; ~22 KB gz; native stepped paths + bars builder; canvas render (CSP-safe) |
| @preact/signals-core | `^1.14.2` (already installed) | Reactive state subscription for chart re-render | Already in use; `effect()` pattern established |
| @date-fns/tz + date-fns | `^1.5.0` + `^4.4.0` (already installed) | Europe/Amsterdam month bucketing across DST | Already in use; `TZDate` pattern established in gaps.ts |

### Supporting (already installed, reused)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | `~5.6` | Type system | Always |
| Vitest | `^4.1.7` | Unit tests (node-env) + DOM tests (jsdom) | Pure helpers in node-env; chart mount tests in jsdom |
| jsdom | `^29.0.0` | DOM environment for chart mount tests | Only for tests that need HTMLElement |

### No New Dependencies Beyond uPlot

The entire phase is implemented with uPlot + existing installed packages. No additional runtime dependencies.

**Installation (Wave 0 action):**
```bash
npm install uplot@^1.6.32
```

**Version verification:** `npm view uplot version` returns `1.6.32` as of 2026-06-14. [VERIFIED: npm registry]

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| uplot | npm | ~7 years | Multi-million/month | github.com/leeoniya/uPlot | N/A (slopcheck unavailable) | Approved — official GitHub repo, 1500+ commits, single well-known maintainer (Leon Sorokin), actively maintained, cited in CLAUDE.md |

slopcheck was unavailable at research time. uPlot is tagged `[CITED: github.com/leeoniya/uPlot]` — verified via official GitHub repository (1500+ commits, known author, long history, listed in CLAUDE.md as locked choice). Registry existence confirmed via `npm view uplot version`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[signals store]
   simResults: SimResult[] | null
   activeBatteries: BatteryConfig[]
   isComputing: boolean
         |
         | effect() subscription
         v
[src/ui/charts/monthly-bars.ts]        [src/ui/charts/flow-chart.ts]
  bucketByMonth(trace, zone)             selectRepresentativeWeek(trace, zone)
  → MonthBucket[]                        → { startTs, endTs, weekLabel }
  uPlot.paths.bars()                     uPlot.paths.stepped({ align: 1 })
  uPlot.setData() on update              uPlot.setData() on update
  ResizeObserver → setSize()             ResizeObserver → setSize()
         |                                      |
         v                                      v
  <div#chart-monthly>                    <div#chart-flow>
  <canvas> (uPlot renders here)          <canvas> (uPlot renders here)
  HTML legend below canvas               HTML legend below canvas
  "(deels)" annotations below x-axis    week caption above chart
         |
         v
[src/ui/transparency-panel.ts]
  <details>/<summary> — native open/close
  assumptions list + "Waarom geen euro's?"
         |
         v
[src/styles/tooltips.css]
  .term-tooltip::after — CSS :hover/:focus-visible
  .term-tooltip--open — JS touchstart toggle
         |
         v
[tests/terminology-audit.test.ts]     [Vitest CI grep]
  fs.readdirSync(src/) → banned term check
  UX-05 + UX-06 combined in one file
```

### Recommended Project Structure

```
src/
├── domain/
│   ├── bucket-by-month.ts       # new: pure MonthBucket[] helper (VIZ-01)
│   └── select-representative-week.ts  # new: pure week selection (VIZ-02)
├── helpers/
│   └── format.ts                # extend: add formatAxisKwh() (VIZ-04)
├── ui/
│   ├── charts/
│   │   ├── monthly-bars.ts      # new: uPlot grouped-bar chart adapter
│   │   └── flow-chart.ts        # new: uPlot step-line chart adapter
│   ├── transparency-panel.ts    # new: <details> panel DOM builder
│   └── tooltips.ts              # new: touchstart tap-toggle handler
├── styles/
│   ├── charts.css               # new: chart-section, chart-wrapper, legend
│   ├── tooltips.css             # new: .term-tooltip + ::after rules
│   ├── transparency-panel.css   # new: .transparency-panel__* rules
│   └── mobile-reflow.css        # new: @media (max-width: 480px) reflows
tests/
└── terminology-audit.test.ts    # new: UX-05 + UX-06 CI grep tests
```

### Pattern 1: uPlot Initialization (Constructor + Data Format)

**What:** uPlot takes `(opts, data, targetElement)` where `data` is `AlignedData` — a tuple where `data[0]` is the x-axis array (timestamps in seconds for time-series, or category indices for bars) and `data[1..N]` are y-axis series arrays.

**Source:** `github.com/leeoniya/uPlot/dist/uPlot.d.ts` [VERIFIED: official repo]

```typescript
// Source: uPlot.d.ts constructor signature
// data[0] = x-axis (Unix timestamps in SECONDS for time charts,
//            or ordinal indices 0,1,2... for bar charts with string labels)
// data[1..N] = y-axis series (number | null)[]

const data: uPlot.AlignedData = [
  timestamps,   // number[] — Unix seconds (NOT milliseconds)
  series1,      // (number | null)[]
  series2,      // (number | null)[]
]

const u = new uPlot(opts, data, containerElement)
```

**Critical:** uPlot x-axis timestamps are Unix SECONDS (not milliseconds). `TraceRow.timestamp` is a `Date` — convert with `row.timestamp.getTime() / 1000`.

**uPlot stylesheet import (DECIDED — see Open Question resolution / WARNING-4):** uPlot ships `uplot/dist/uPlot.min.css`, a **class-only stylesheet** (e.g. `.u-wrap`, `.u-over`, `.u-axis`, `.u-legend` rules) — it contains **no inline-style injection and no `@import`/`url()` network fetch**, and the chart itself renders to `<canvas>`. It is served as a same-origin bundled stylesheet under `style-src 'self'`, so importing it is CSP-safe. The chart adapters MUST import it **unconditionally** at module top: `import 'uplot/dist/uPlot.min.css'`. This is a deterministic decision — there is no runtime "confirm if CSP-safe" branch.

### Pattern 2: Stepped-Line Path Builder (VIZ-03)

**What:** `uPlot.paths.stepped({ align: 1 })` creates a step-after path builder. `align: 1` means the horizontal segment extends to the right of each data point (step AFTER the value changes) — the correct interpretation for energy-per-interval data where the value is the amount during the preceding interval.

**Source:** `github.com/leeoniya/uPlot/dist/uPlot.d.ts` + `demos/line-paths.html` [VERIFIED: official repo]

```typescript
// Source: uPlot.d.ts + demos/line-paths.html
const steppedBuilder = uPlot.paths.stepped({ align: 1 }) // step-after

const opts: uPlot.Options = {
  width: container.offsetWidth,
  height: 320,
  tzDate: (ts) => uPlot.tzDate(ts, 'Europe/Amsterdam'),
  series: [
    {},  // x-axis series placeholder (required as index 0)
    {
      label: 'Grid import',
      stroke: resolvedColor,  // hex string resolved from CSS var
      paths: steppedBuilder,
      width: 2,
      points: { show: false },
    },
    // ... more series
  ],
  axes: [
    { /* x-axis — time; uPlot handles tick formatting */ },
    {
      label: 'kWh',
      values: (_u, splits) => splits.map(v => formatAxisKwh(v)),
    },
  ],
}
```

### Pattern 3: Grouped-Bar Chart (VIZ-01) — COMMITTED APPROACH

**Decision (resolves Open Question 1, satisfies ROADMAP success criterion 1 + D-04):** Render a **single grouped-bar chart** with **one bar series per selected battery**, x-axis = ordinal month indices `0..N-1` with NL month tick labels. Bars are drawn with `uPlot.paths.bars()` and uPlot's **native multi-series side-by-side grouping** — when more than one `bars()` series shares the same x ordinal scale, uPlot offsets each series' bars within the per-ordinal slot automatically (the `size` factor governs slot fill). This is the literal "grouped per month, one bar per selected battery" layout the ROADMAP and D-04 require; colors come from `colorFor()` so they match the comparison table.

**This does NOT use the demo `seriesBarsPlugin`/`quadtree.js`/`distr.js` files** (those are demo-only and not in the npm package — Pitfall 5). The native `uPlot.paths.bars()` builder applied per-series is sufficient for 2–5 battery series and keeps the implementation inside the published package surface.

**Source:** `github.com/leeoniya/uPlot/demos/line-paths.html` (bars builder) + `dist/uPlot.d.ts` `BarsPathBuilderOpts` [VERIFIED: official repo]

```typescript
// Source: uPlot.d.ts BarsPathBuilderOpts + demos
// One bars() builder shared/created per battery series.
// size: [groupFactor, maxPx] — groupFactor < 1 leaves a gap so adjacent
// month groups and adjacent battery bars read as distinct.
const barsBuilder = uPlot.paths.bars({
  size: [0.6, 60],   // 60% of available slot, 60px max bar width
  align: 0,          // center the group on the tick
})

// data[0] = [0, 1, 2, ...] (month ordinals)
// data[1..M] = per-battery shiftedKwh-per-month arrays
// Each series i (1..M) uses paths: barsBuilder and stroke/fill = colorFor()-resolved hex.
// uPlot draws series 1..M side-by-side within each x ordinal = grouped bars.
```

**Why this satisfies VIZ-01 (the "grouped-bar" contract):** the chart is one chart, with months on the x-axis and, within each month, one bar per selected battery placed side by side and colored by `colorFor()` — exactly ROADMAP criterion 1 and D-04. No stacked-per-battery fallback is used; the per-battery bars are grouped in a single chart.

### Pattern 3a: Ordinal Month Axis Labels (VIZ-01) — COMMITTED APPROACH

**Decision (resolves Open Question 2):** The bars chart x-axis is a numeric ordinal scale (`0,1,2,...`). Map each integer split to its pre-computed NL month label via `axes[0].values`:

```typescript
// Source: uPlot.d.ts Axis.values signature [VERIFIED: official repo]
// monthLabels: string[] is built from MonthBucket.monthLabel (Plan 01), index-aligned to data[0].
axes: [
  {
    values: (_u, splits) => splits.map(i => monthLabels[Math.round(i)] ?? ''),
  },
  {
    values: (_u, splits) => splits.map(v => formatAxisKwh(v)),
  },
]
```

`Math.round(i)` guards against uPlot generating fractional splits on a numeric scale; out-of-range indices render as an empty string (no stray tick label). This is the committed pattern — the adapter does not defer this to runtime experimentation.

### Pattern 3b: Partial-Month Opacity (VIZ-01 / D-05) — COMMITTED APPROACH

**Decision (resolves Open Question 3):** Partial-month bars are drawn at lower fill opacity **within the same per-battery series** (no second "partial" series, no second data pass). Plan 01's `MonthBucket` already carries an `isPartial: boolean` per month — the adapter reads that flag directly and supplies a per-bar fill via the bars builder's `disp.fill.values` (a per-data-index value function), returning the full-opacity battery color for `!isPartial` indices and a lower-alpha variant of the same color for `isPartial` indices:

```typescript
// Source: uPlot.d.ts BarsPathBuilderOpts.disp [VERIFIED: official repo]
// buckets[i].isPartial drives the per-bar fill alpha — one pass, one series per battery.
const barsBuilder = uPlot.paths.bars({
  size: [0.6, 60],
  align: 0,
  disp: {
    fill: {
      unit: 3,                       // raw CSS-color values, per data index
      values: (_u, _seriesIdx) =>
        buckets.map(b => b.isPartial ? partialColor : fullColor),
    },
  },
})
// fullColor    = resolved battery hex (full opacity)
// partialColor = same hex at lower alpha (color-mix(... 40%) or rgba on the resolved hex)
```

Because `MonthBucket.isPartial` is computed once in the pure helper (Plan 01), the adapter needs **no second pass** to determine opacity — it maps the existing bucket array. Full months render at full alpha; partial months at lower alpha; and the `(deels)` text label (D-05) is added as a `.chart-partial-label` DOM span below the axis. No extrapolation — the real (lower) `shiftedKwh` value is plotted as-is.

### Pattern 4: Timezone Display (tzDate option)

**What:** uPlot's `tzDate` option converts Unix-second timestamps to a `DateZoned` for axis label rendering in a named IANA timezone. The static method `uPlot.tzDate(ts, tz)` performs this conversion.

**Source:** `github.com/leeoniya/uPlot/demos/timezones-dst.html` [VERIFIED: official repo]

```typescript
// Source: demos/timezones-dst.html
// Inside uPlot opts:
tzDate: ts => uPlot.tzDate(ts, 'Europe/Amsterdam'),

// This makes uPlot render axis time labels in Amsterdam local time,
// correctly handling DST transitions (CET/CEST).
// The tzDate is uPlot's own static method — NOT TZDate from @date-fns/tz.
// The two are independent: @date-fns/tz is used in domain helpers;
// uPlot.tzDate is used only in chart display config.
```

### Pattern 5: Resize Handling (ResizeObserver + setSize)

**What:** uPlot does not auto-resize. A `ResizeObserver` on the chart container element calls `chart.setSize({ width, height })` when the container changes size.

**Source:** `github.com/leeoniya/uPlot/dist/uPlot.d.ts` `setSize` signature [VERIFIED: official repo]

```typescript
// Source: uPlot.d.ts
// setSize(opts: { width: number; height: number }): void

let chart: uPlot | null = null
const CHART_HEIGHT = 320

const observer = new ResizeObserver(() => {
  if (chart && container.offsetWidth > 0) {
    // Debounce 100ms to avoid thrashing on drag-resize
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      chart!.setSize({ width: container.offsetWidth, height: CHART_HEIGHT })
    }, 100)
  }
})
observer.observe(container)

// Cleanup: observer.disconnect() + chart.destroy() on teardown
```

**CSP note:** `setSize()` sets canvas `width`/`height` HTML attributes — NOT inline CSS `style=`. CSP-safe. [VERIFIED: uPlot source behavior described in 05-UI-SPEC.md CSP section]

### Pattern 6: setData for Reactive Re-render

**What:** When signals change (new `SimResult[]` arrives), call `chart.setData(newData)` instead of destroying and recreating the chart.

**Source:** `github.com/leeoniya/uPlot/dist/uPlot.d.ts` [VERIFIED: official repo]

```typescript
// Source: uPlot.d.ts
// setData(data: uPlot.AlignedData, resetScales?: boolean): void

// Inside effect():
const dispose = effect(() => {
  const results = simResults.value
  if (!results || !chart) return
  const newData = buildBarData(results)  // pure transform
  chart.setData(newData)  // updates canvas without full rebuild
  updateLegend()           // update HTML legend below canvas
})
```

### Pattern 7: Color Resolution from CSS Custom Properties

**What:** uPlot series `stroke` accepts a hex string. CSS custom properties (`var(--color-battery-N)`) must be resolved to hex values at chart-mount time via `getComputedStyle`.

**Source:** 05-UI-SPEC.md §"Per-Battery Color Slots in Charts" [VERIFIED: project source]

```typescript
// Resolve CSS var to hex string at mount time
function resolveColor(cssVar: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar.replace('var(', '').replace(')', '').trim())
    .trim()
}

// colorFor() returns 'var(--color-battery-N)'
const hex = resolveColor(colorFor(battery.id, orderedIds))
// hex is e.g. '#2563eb' — pass this to series.stroke
```

### Pattern 8: Phase 1 / Phase 2 CI Grep Test Pattern (for UX-05 / UX-06)

**What:** Vitest node-env tests use `fs` to scan `src/` files for banned strings. A grep that finds a match fails the test. This is the established contract-locking pattern.

**Source:** `tests/csp-plugin.test.ts` (Phase 1), `tests/dst-fixtures.test.ts` (Phase 2) [VERIFIED: codebase]

```typescript
// Source: Pattern derived from existing tests/csp-plugin.test.ts style
// Node env (no jsdom annotation needed)
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { globSync } from 'fs' // Node 22 has globSync

function scanSrc(banned: string[]): string[] {
  // Recursively find all .ts and .html files in src/
  // Return any banned term found, with file+line context
}

describe('UX-05 terminology audit', () => {
  it('src/ contains zero occurrences of banned solar-production terms', () => {
    const hits = scanSrc(['solar production', 'solar generation', 'zonne-opwekking', 'zonne-opbrengst'])
    expect(hits).toHaveLength(0)
  })
})

describe('UX-06 no-CTA audit', () => {
  it('src/ contains no email fields, contact forms, or offerte CTAs', () => {
    const hits = scanSrc(['type="email"', 'type="tel"', 'offerte'])
    expect(hits).toHaveLength(0)
  })
})
```

**Note:** Node 22 ships `fs.globSync` natively. For the test to find files correctly, use `readdirSync` recursively or Node's `fs.globSync('src/**/*.ts')`. The Phase 2 DST test uses `readFileSync` from `fs` directly — same pattern applies.

### Anti-Patterns to Avoid

- **uPlot inline style:** Never assign `element.style.left = ...` for chart overlays. uPlot's built-in cursor tooltip injects inline styles — do NOT use uPlot's built-in tooltip (CSP violation). Use CSS `::after` for term tooltips and omit chart cursor tooltips entirely or render them as absolutely-positioned DOM elements with CSS classes.
- **Raw Date.getMonth() for month bucketing:** Using `new Date(ts).getMonth()` is UTC month, not Amsterdam local month. Always use `new TZDate(ts, 'Europe/Amsterdam').getMonth()` for local-month assignment (see gaps.ts pattern).
- **Milliseconds in uPlot x-axis:** uPlot expects Unix SECONDS on the x-axis for time charts (not milliseconds). `Date.getTime()` returns ms — divide by 1000.
- **Recreating uPlot on every signal update:** Call `chart.setData(newData)` for data changes; only destroy + recreate on battery count or series structure changes.
- **Hard-coded hex colors:** Always resolve from CSS custom properties at mount time (`getComputedStyle`). This ensures chart colors match the table's CSS-variable-driven colors.
- **uPlot native legend:** uPlot's built-in legend renders via DOM but may conflict with CSP in some configurations. The UI-SPEC mandates a custom HTML legend below the canvas — follow that.
- **Importing the demo grouped-bars plugin:** Do NOT copy `seriesBarsPlugin` / `quadtree.js` / `distr.js` — they are demo files, not in the npm package. The committed grouped layout uses only the published `uPlot.paths.bars()` builder (Pattern 3).

---

## Reusing Phase 4 Contracts — Verified Signatures

All of the following were read directly from the live source code.

### `SimResult` and `TraceRow` (src/domain/types.ts)

```typescript
// [VERIFIED: src/domain/types.ts — read 2026-06-14]
interface TraceRow {
  timestamp: Date              // UTC Date, end of interval
  socKwh: number
  chargedKwh: number           // grid-side charge energy this interval
  dischargedKwh: number        // grid-side discharge energy this interval
  residualImportKwh: number    // >= 0 (DATA-06)
  residualExportKwh: number    // >= 0 (DATA-06) — teruglevering; used in week heuristic
}

interface SimResult {
  shiftedKwh: number           // total energy shifted (bar chart uses this per month)
  residualImportKwh: number
  residualExportKwh: number
  totalImportKwh: number
  totalExportKwh: number
  periodDays: number
  coarseCadenceWarning: boolean
  trace: TraceRow[]            // 1:1 with input IntervalSample[]
}
```

### `colorFor()` and `colorSlotFor()` (src/helpers/color.ts)

```typescript
// [VERIFIED: src/helpers/color.ts — read 2026-06-14]
// Both are pure functions, safe in node env.
colorFor(batteryId: string, orderedSelection: string[]): string
// Returns: 'var(--color-battery-1)' .. 'var(--color-battery-5)'
// Falls back to slot 1 if not found or >5 batteries.

colorSlotFor(batteryId: string, orderedSelection: string[]): number
// Returns: 1..5 (capped). Used for .battery-swatch--N CSS class.
```

### `formatKwh()` and friends (src/helpers/format.ts)

```typescript
// [VERIFIED: src/helpers/format.ts — read 2026-06-14]
formatKwh(n: number): string    // "12.3 kWh" — 1 decimal + suffix
formatPct(n: number): string    // "42.1 %" — 1 decimal + %
formatRatio(n: number): string  // "0.63" — 2 decimals, no suffix

// NEW helper to add (VIZ-04 / UI-SPEC §"New Pure Domain Helpers"):
// formatAxisKwh(n: number): string — same as formatKwh but without " kWh" suffix
// Purpose: compact uPlot axis tick labels (e.g. "3.2" not "3.2 kWh")
// Location: extend src/helpers/format.ts
// Test: add to tests/format.test.ts
```

### Signals Store (src/state/signals.ts + app-state.ts)

```typescript
// [VERIFIED: src/state/signals.ts — read 2026-06-14]
simResults: Signal<SimResult[] | null>   // charts subscribe here
activeBatteries: Signal<BatteryConfig[]> // ordered selection for colorFor()
isComputing: Signal<boolean>             // charts can dim while computing
```

Charts use `effect(() => { const results = simResults.value; ... })` — same pattern as `initComparisonTable()` in `src/ui/comparison-table.ts`. [VERIFIED: src/ui/comparison-table.ts — read 2026-06-14]

### `#results-region` Mount Point (src/shell.ts)

```typescript
// [VERIFIED: src/shell.ts — read 2026-06-14]
// <section id="results-region" aria-label="Vergelijkingsresultaten">
// Phase 4 fills this with the comparison table.
// Phase 5 appends: chart sections + transparency panel BELOW the table.
// initComparisonTable() renders into this container.
// Phase 5 chart adapters APPEND to this container, not replace it.
```

### CSP (src/constants/csp.ts)

```typescript
// [VERIFIED: src/constants/csp.ts — read 2026-06-14]
"style-src 'self'"    // No inline style= anywhere — uPlot canvas draws are exempt;
                       // uPlot.min.css is a same-origin bundled stylesheet (class-only) — allowed
"connect-src 'none'"  // uPlot uses no network
"worker-src 'self' blob:"  // Unchanged — uPlot adds no workers
// Phase 5 requires ZERO changes to the CSP.
```

---

## Month Bucketing Across DST — Pure Function Design

**Problem:** `new Date(ts).getMonth()` returns UTC month. For Europe/Amsterdam, a timestamp at e.g. `2025-03-29T23:30:00Z` is actually `2025-03-30T01:30:00+02:00` — it belongs to March in UTC but April in Amsterdam. The bucket-by-month function must use Amsterdam local month.

**Solution:** Reuse the `TZDate` pattern already established in `src/domain/gaps.ts`:

```typescript
// [ASSUMED] — derived from established TZDate pattern in gaps.ts
import { TZDate } from '@date-fns/tz'

const AMSTERDAM = 'Europe/Amsterdam'

function localMonthKey(ts: Date): string {
  // TZDate wraps the UTC ms into Amsterdam local time
  const local = new TZDate(ts.getTime(), AMSTERDAM)
  // getMonth() on TZDate returns the Amsterdam local month (0-indexed)
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}`
}
```

**Partial month detection (D-05 / D-06):**
- A month is "full" if both its first and last calendar day appear in the trace.
- The first and last months of any dataset are partial unless the data starts exactly on the 1st and ends on the last day.
- Implementation: after bucketing, check if the first day of the month and the last day appear in the sample timestamps for that bucket. If not, `isPartial: true`.
- **This `isPartial` flag is the sole input to the chart's partial-month opacity (Pattern 3b) — the adapter does no second-pass detection.**

**Sparse data (D-06):** When `< 2` full months exist, render the 1–2 partial bars with the "weinig data" note (Dutch copy from UI-SPEC). Do not hide the chart.

---

## Highest-Teruglevering Week Heuristic — Pure Function Design

**Problem:** Select a 7-day Mon–Sun window from the trace with the highest sum of `residualExportKwh`.

**Design:**
1. Group `TraceRow[]` by Amsterdam-local calendar week (ISO week, Mon–Sun).
2. Sum `residualExportKwh` per week.
3. Return the week with the highest sum; tie-break: first (earliest) week wins.
4. Return `{ startTs: number, endTs: number, weekLabel: string }` where `weekLabel` is the Dutch dated caption text: `"8–14 juni 2025"` (Amsterdam local dates).

**Week boundary:** Use `startOfWeek(TZDate, { weekStartsOn: 1 })` from date-fns + the `@date-fns/tz` TZDate to find Monday boundaries in Amsterdam time. [ASSUMED — derived from date-fns docs and TZDate pattern; not directly verified via date-fns API call, but the TZDate + date-fns function combination is the established project pattern]

**Edge case:** If the dataset is less than 7 days, return the only available period as the "week" (with a partial span). Return whatever is available — do not crash or return null.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-series + bar charting | Custom canvas rendering | uPlot 1.6.32 | 22 KB, stepped paths built-in, bars built-in, ResizeObserver integration straightforward |
| DST-aware date math | Manual UTC offset arithmetic | @date-fns/tz TZDate + date-fns | Already in project; TZDate.getMonth() returns local month; handles all DST edges |
| Tooltip positioning | JS absolute-position calculation | CSS `::after` pseudo-element | CSP-safe; no `element.style.left`; handles viewport edge via `max-width` |
| Responsive chart resize | Media query on canvas | ResizeObserver + uPlot.setSize() | Correct approach; media queries cannot resize a canvas element |

**Key insight:** The month-bucketing and week-selection logic is genuinely testable as pure functions WITHOUT any chart library. Isolating them in `src/domain/` (not `src/ui/charts/`) keeps them testable in the node Vitest env and independent of uPlot's canvas context.

---

## Common Pitfalls

### Pitfall 1: uPlot Milliseconds vs Seconds
**What goes wrong:** Passing `Date.getTime()` (milliseconds) directly to uPlot x-axis produces a chart rendered at dates in year ~2058.
**Why it happens:** uPlot expects Unix SECONDS on the x-axis for time-series charts.
**How to avoid:** Always divide: `row.timestamp.getTime() / 1000`.
**Warning signs:** Chart renders with x-axis in year 50000+.

### Pitfall 2: CSS Custom Properties in uPlot Series Stroke
**What goes wrong:** Passing `'var(--color-battery-1)'` as `series.stroke` produces a gray/invisible line because uPlot passes the string directly to `canvas.strokeStyle`, which cannot resolve CSS variables.
**Why it happens:** The canvas 2D context does not resolve CSS custom properties.
**How to avoid:** Resolve at mount time: `getComputedStyle(document.documentElement).getPropertyValue('--color-battery-1').trim()`.
**Warning signs:** All chart lines appear as gray or default color.

### Pitfall 3: UTC Month vs Amsterdam Local Month
**What goes wrong:** `new Date(ts).getMonth()` buckets a late-Amsterdam-evening timestamp into the previous UTC month.
**Why it happens:** UTC midnight is 1 or 2 hours behind Amsterdam local time.
**How to avoid:** Always use `new TZDate(ts, 'Europe/Amsterdam').getMonth()` for bucketing.
**Warning signs:** The last 1–2 hours of each day's data appear in the wrong month bar.

### Pitfall 4: uPlot Tooltip Plugin Injects Inline Styles
**What goes wrong:** Using uPlot's built-in cursor tooltip (`cursor: { tooltip: true }` or the `tooltip` plugin) injects `style="left: ...px; top: ...px"` on a DOM element, violating `style-src 'self'`.
**Why it happens:** uPlot's tooltip positions itself via inline style.
**How to avoid:** Do NOT use uPlot's tooltip plugin. Use CSS `::after` pseudo-elements for term tooltips (already specified in UI-SPEC). If chart value readouts on hover are needed, render a DOM overlay with CSS class positioning only.
**Warning signs:** Browser CSP console error: "Refused to apply inline style".

### Pitfall 5: Grouped Bars Demo Plugin Is Not In The npm Package
**What goes wrong:** uPlot's grouped-bar **demo** uses a `seriesBarsPlugin` that depends on `quadtree.js` and `distr.js` helper files — these are demo files, NOT part of the uPlot npm package. Copying demo code naively throws `quadtree is not defined`.
**Why it happens:** The demo's distribution algorithm lives in repo demo helpers, not the published library.
**How to avoid:** Use the COMMITTED approach (Pattern 3): one `uPlot.paths.bars()` series per battery on a shared ordinal x-scale; uPlot's native multi-series bar offsetting groups them side-by-side. Do NOT import the demo plugin or its helper files.
**Warning signs:** `quadtree is not defined` / `distr is not defined` in the browser console.

### Pitfall 6: effect() Cleanup and uPlot Destroy
**What goes wrong:** Creating a `new uPlot(...)` inside an `effect()` callback without calling `chart.destroy()` on cleanup leads to multiple chart instances attached to the same container.
**Why it happens:** `effect()` runs every time signals change; if the chart is rebuilt on each run, stale canvas elements accumulate.
**How to avoid:** Create the uPlot instance ONCE outside the effect; use `chart.setData()` inside the effect for data updates. Only destroy + recreate when the series structure changes (different number of batteries).
**Warning signs:** Multiple overlapping canvas elements in `#chart-monthly` or `#chart-flow`.

### Pitfall 7: ResizeObserver Firing Before uPlot Init
**What goes wrong:** The ResizeObserver callback fires immediately after `.observe()` (some browsers), before the uPlot instance is created, causing `chart.setSize()` to throw.
**Why it happens:** ResizeObserver fires synchronously on first observation in some environments.
**How to avoid:** Guard with `if (chart) chart.setSize(...)` before the chart is initialized.

### Pitfall 8: Tooltip CSS content: attr() and XSS
**What goes wrong:** If `data-tooltip` content were ever interpolated from user-uploaded CSV data, the CSS `content: attr(data-tooltip)` would render that content as text. While CSS `content` does not execute scripts, it could render unexpected strings.
**Why it happens:** Potential confusion about what populates `data-tooltip`.
**How to avoid:** `data-tooltip` content is always author-defined hard-coded strings (7 fixed glossary terms). Never interpolate user data into `data-tooltip`. Already established in UI-SPEC §"XSS safety". [VERIFIED: 05-UI-SPEC.md]

---

## Code Examples

### Monthly Bars Data Format for uPlot

```typescript
// Source: uPlot.d.ts AlignedData type + project pattern
// For N months, M selected batteries:
// data[0] = month ordinal indices [0, 1, 2, ..., N-1]
// data[1] = battery 1 shiftedKwh per month [(number | null)[], length N]
// data[2] = battery 2 shiftedKwh per month
// Partial months: pass the real (lower) kWh value — opacity via the bars()
// builder disp.fill keyed off MonthBucket.isPartial (Pattern 3b), NOT a second series.

const monthData: uPlot.AlignedData = [
  monthBuckets.map((_, i) => i),      // [0, 1, 2, ...]
  monthBuckets.map(b => b.batteryA),  // [3.2, 5.1, null, ...]
  monthBuckets.map(b => b.batteryB),
]
```

### Step-Line Data Format for Flow Chart

```typescript
// Source: uPlot.d.ts AlignedData type
// TraceRow.timestamp.getTime() / 1000 = Unix seconds
const flowData: uPlot.AlignedData = [
  weekRows.map(r => r.timestamp.getTime() / 1000),   // [number]
  weekRows.map(r => r.residualImportKwh),              // grid import
  weekRows.map(r => r.residualExportKwh),              // teruglevering
  weekRows.map(r => r.chargedKwh),                     // battery charge
  weekRows.map(r => r.dischargedKwh),                  // battery discharge
]
```

### Resolving Battery Color for uPlot

```typescript
// Source: src/helpers/color.ts colorFor() + uPlot series stroke requirement
function resolveBatteryColor(batteryId: string, orderedIds: string[]): string {
  const cssVar = colorFor(batteryId, orderedIds)
    .replace('var(', '').replace(')', '').trim()
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar).trim()
  // Returns e.g. '#2563eb'
}
```

### TZDate Month Bucketing

```typescript
// Source: established TZDate pattern from src/domain/gaps.ts
import { TZDate } from '@date-fns/tz'

const AMSTERDAM = 'Europe/Amsterdam'

function getAmsterdamMonthKey(utcDate: Date): string {
  const local = new TZDate(utcDate.getTime(), AMSTERDAM)
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}`
}
// e.g. "2025-06" for June 2025 in Amsterdam local time
```

### Vitest CI Grep Test (UX-05 / UX-06)

```typescript
// Source: pattern from tests/csp-plugin.test.ts (Phase 1)
// Node env — no @vitest-environment annotation needed
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

function allSrcFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  return entries.flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return allSrcFiles(full)
    if (full.endsWith('.ts') || full.endsWith('.html')) return [full]
    return []
  })
}

function findBanned(terms: string[]): string[] {
  const srcDir = join(import.meta.dirname, '..', 'src')
  const hits: string[] = []
  for (const file of allSrcFiles(srcDir)) {
    const content = readFileSync(file, 'utf-8')
    for (const term of terms) {
      if (content.includes(term)) {
        hits.push(`${file}: "${term}"`)
      }
    }
  }
  return hits
}

describe('UX-05 terminology audit', () => {
  it('src/ contains zero occurrences of banned solar-production terms', () => {
    const hits = findBanned(['solar production', 'solar generation', 'zonne-opwekking', 'zonne-opbrengst'])
    expect(hits).toHaveLength(0)
  })
})

describe('UX-06 no-CTA audit', () => {
  it('src/ contains no email fields, contact forms, or offerte patterns', () => {
    const hits = findBanned(['type="email"', 'type="tel"', 'offerte', 'vraag offerte'])
    expect(hits).toHaveLength(0)
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `title=""` HTML attribute for tooltips | CSS `::after` pseudo-element + JS tap-toggle | Phase 5 design decision | Works on touch devices; CSP-safe; accessible via `:focus-visible` |
| Native `Date.getMonth()` for bucketing | `TZDate(ts, 'Europe/Amsterdam').getMonth()` | Phase 2 precedent | Correct DST handling |
| uPlot milliseconds (common mistake) | uPlot Unix seconds | — (uPlot has always used seconds) | Charts render at correct dates |
| Inline style assignments for overlays | CSS class + `::after` content | Phase 1 CSP locked | Passes `style-src 'self'` |

**Deprecated/outdated:**
- `uPlot` versions before 1.6: bars path builder added in 1.6; project is locked to `^1.6.32` which is current.
- uPlot's built-in `drawStyle: 1` series property: this is a shorthand that was used in older demos; the current preferred approach for stepped lines is `paths: uPlot.paths.stepped({ align: 1 })` for explicit control.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `date-fns` `startOfWeek(tzDate, { weekStartsOn: 1 })` works with TZDate to find Monday boundaries in Amsterdam local time | Month Bucketing / Week Heuristic | Week boundaries could be off by 1 day at DST transitions; needs a fixture test to confirm |
| A2 | `TZDate.getFullYear()` and `TZDate.getMonth()` return Amsterdam local values (not UTC) | Month Bucketing | Buckets would be wrong by 1–2 hours at DST edge; verify with a DST-crossing fixture |
| A3 | `uPlot.paths.bars()` applied per-series on a shared ordinal x-scale renders side-by-side grouped bars without the demo seriesBarsPlugin | Pattern 3 / Open Question 1 (RESOLVED) | If native offsetting overlaps bars, the adapter must set per-series `disp.x0`/`disp.size` from the published `bars()` API to offset within each ordinal slot — still inside the npm package, no quadtree/distr demo files. Verify in the Plan 03 jsdom + live human-verify. |

**Note on A3:** The committed grouped-bar layout (Pattern 3) stays entirely within the published `uPlot.paths.bars()` API. If uPlot's automatic multi-series offsetting needs an explicit nudge, the documented `disp.x0`/`disp.size` per-series offset (also part of `BarsPathBuilderOpts`) is the in-package fallback — the demo `seriesBarsPlugin`/`quadtree.js`/`distr.js` files are never used.

---

## Open Questions (RESOLVED)

All three open questions are resolved with committed approaches below. Plan 03 encodes these decisions; the executor does not re-decide them at runtime.

1. **Grouped bars: native bars() per-series vs demo plugin — RESOLVED: native `uPlot.paths.bars()`, one series per battery.**
   - **Resolution:** Render a single grouped-bar chart with one `uPlot.paths.bars()` series per selected battery on a shared ordinal x-scale; uPlot draws the per-battery bars side-by-side within each month slot (Pattern 3). This is the literal "grouped per month, one bar per selected battery, colored via colorFor()" layout required by **ROADMAP success criterion 1** and **CONTEXT D-04**.
   - **Why this satisfies VIZ-01's "grouped-bar" contract:** one chart, months on the x-axis, one colored bar per battery grouped within each month — no stacked-per-battery fallback. The demo `seriesBarsPlugin` (`quadtree.js`/`distr.js`, not in the npm package) is explicitly NOT used; if native offsetting needs a nudge, the published `disp.x0`/`disp.size` `bars()` options are the in-package mechanism (Assumption A3 note).

2. **Ordinal axis tick format for month labels — RESOLVED: `axes[0].values` index→label mapping.**
   - **Resolution:** The bars x-axis is a numeric ordinal scale; map each split to a pre-computed NL month label via `axes[0].values: (_u, splits) => splits.map(i => monthLabels[Math.round(i)] ?? '')`, where `monthLabels` is built from `MonthBucket.monthLabel` (Plan 01), index-aligned to `data[0]` (Pattern 3a). `Math.round` + `?? ''` guard fractional/out-of-range splits.

3. **Per-bar partial-month opacity — RESOLVED: single-series `disp.fill` keyed off `MonthBucket.isPartial`.**
   - **Resolution:** Lower-opacity partial bars are produced **within the same per-battery series** via the `bars()` builder `disp.fill.values` function, returning full-alpha battery color for `!isPartial` indices and a lower-alpha variant for `isPartial` indices (Pattern 3b). **No second "partial" series and no second data pass** — Plan 01's `MonthBucket.isPartial` flag (computed once in the pure helper) is the sole input, so Plan 01's output shape already serves this with no rework. The `(deels)` text label (D-05) is a `.chart-partial-label` DOM span; the plotted value is the real (lower) `shiftedKwh` — no extrapolation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest + Vite | ✓ | 22.x LTS (inferred from CI config) | — |
| npm | uPlot install | ✓ | Available (package.json present) | — |
| uPlot | Charts | ✗ (not yet installed) | Will be `^1.6.32` | — |
| @date-fns/tz | Month bucketing | ✓ `^1.5.0` (package.json) | `^1.5.0` | — |
| date-fns | Week boundary math | ✓ `^4.4.0` (package.json) | `^4.4.0` | — |
| @preact/signals-core | Chart reactivity | ✓ `^1.14.2` (package.json) | `^1.14.2` | — |
| jsdom | Chart mount tests | ✓ `^29.0.0` (package.json) | `^29.0.0` | — |

**Missing dependencies with no fallback:**
- uPlot `^1.6.32` — must be installed in Wave 0 before any chart code compiles.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.7` |
| Config file | `vitest.config.ts` — default env: `node`; per-file jsdom via `// @vitest-environment jsdom` |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZ-01 | `bucketByMonth()` returns correct MonthBucket[] with isPartial flags | unit | `npm test -- bucket-by-month` | ❌ Wave 1 |
| VIZ-01 | `bucketByMonth()` handles DST month boundary (2026-03-29 straddles Feb/Mar) | unit | `npm test -- bucket-by-month` | ❌ Wave 1 |
| VIZ-01 | `bucketByMonth()` sparse case (<2 full months) returns all-partial array | unit | `npm test -- bucket-by-month` | ❌ Wave 1 |
| VIZ-02 | `selectRepresentativeWeek()` returns week with highest sum of residualExportKwh | unit | `npm test -- select-representative-week` | ❌ Wave 1 |
| VIZ-02 | `selectRepresentativeWeek()` tie-breaks to first week | unit | `npm test -- select-representative-week` | ❌ Wave 1 |
| VIZ-02 | `selectRepresentativeWeek()` handles dataset < 7 days (returns single span) | unit | `npm test -- select-representative-week` | ❌ Wave 1 |
| VIZ-03 | Flow chart uses stepped path (not smooth): verified by uPlot config inspection | unit (jsdom) | `npm test -- flow-chart` | ❌ Wave 2 |
| VIZ-04 | `formatAxisKwh(3.14159)` returns `"3.1"` (no suffix, 1 decimal) | unit | `npm test -- format` | ❌ (extend existing format.test.ts, Wave 1) |
| VIZ-04 | No raw float rendering in chart DOM: axis ticks use formatAxisKwh | unit (jsdom) | `npm test -- monthly-bars` | ❌ Wave 2 |
| UX-01 | `<details>` element renders with correct aria-label and summary text | unit (jsdom) | `npm test -- transparency-panel` | ❌ Wave 2 |
| UX-02 | "Waarom geen euro's?" heading present inside the panel | unit (jsdom) | `npm test -- transparency-panel` | ❌ Wave 2 |
| UX-03 | `.term-tooltip` span has tabindex="0" and data-tooltip attribute | unit (jsdom) | `npm test -- tooltips` | ❌ Wave 2 |
| UX-04 | Charts do not overflow viewport at 375px (CSS contract test) | manual visual | — | manual |
| UX-05 | `src/` grep: zero occurrences of banned terminology | CI grep | `npm test -- terminology-audit` | ❌ Wave 1 |
| UX-06 | `src/` grep: no email/CTA/offerte patterns | CI grep | `npm test -- terminology-audit` | ❌ Wave 1 |

### Sampling Rate

- **Per task commit:** `npm test -- --reporter=dot` (fast, all tests)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave Test-File Origins

> Wave 0 (pre-execution) installs the one new dependency only. The pure-helper/audit test files are created in their owning Wave 1 plans (Plan 01 / Plan 02); the jsdom DOM-adapter test files are created in their owning Wave 2 plans (Plan 03 / Plan 04) alongside the adapters they cover. None of the jsdom adapter tests are Wave 0 pre-stubs.

- **Pre-execution dependency (Wave 0):** `npm install uplot@^1.6.32` — install the one new runtime dep.
- **Wave 1 (Plan 01) test files:** `tests/bucket-by-month.test.ts` (VIZ-01), `tests/select-representative-week.test.ts` (VIZ-02), `tests/format.test.ts` extension for `formatAxisKwh` (VIZ-04). Node-env.
- **Wave 1 (Plan 02) test file:** `tests/terminology-audit.test.ts` (UX-05 + UX-06 combined CI grep). Node-env.
- **Wave 2 (Plan 03) test files:** `tests/monthly-bars.test.ts` (VIZ-01 DOM + VIZ-04), `tests/flow-chart.test.ts` (VIZ-02/03 + dropdown). jsdom — created alongside their adapters, not as Wave 0 stubs.
- **Wave 2 (Plan 04) test files:** `tests/transparency-panel.test.ts` (UX-01 + UX-02), `tests/tooltips.test.ts` (UX-03). jsdom — created alongside the panel/tooltip modules, not as Wave 0 stubs.

---

## Security Domain

`security_enforcement` key is absent from `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this app |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No user roles |
| V5 Input Validation | yes (limited) | `data-tooltip` is author-defined static strings only — never user CSV data. Verified in UI-SPEC. |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for Vanilla TS + canvas UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via chart battery name (custom battery) | Tampering | `.textContent` for all user-derived strings in chart legend — pattern from comparison-table.ts |
| Inline style injection via uPlot tooltip plugin | Tampering | Do not use uPlot's built-in tooltip; use CSS `::after` pseudo-element |
| Injecting `data-tooltip` from user CSV data | Tampering | `data-tooltip` must be static author-defined copy only — verified by code review |
| uPlot importing network resources (CDN fonts etc.) | Info Disclosure | uPlot is fully bundled; `connect-src 'none'` blocks any network attempt; canvas rendering uses system font |

---

## Sources

### Primary (HIGH confidence)

- `src/domain/types.ts` — `SimResult`, `TraceRow` exact field names and types [VERIFIED: live codebase 2026-06-14]
- `src/helpers/color.ts` — `colorFor()`, `colorSlotFor()` exact signatures [VERIFIED: live codebase 2026-06-14]
- `src/helpers/format.ts` — `formatKwh()`, `formatPct()`, `formatRatio()` exact signatures [VERIFIED: live codebase 2026-06-14]
- `src/state/signals.ts` + `src/state/app-state.ts` — signal names, types, `scheduleRecompute` [VERIFIED: live codebase 2026-06-14]
- `src/shell.ts` — `#results-region` selector and shell structure [VERIFIED: live codebase 2026-06-14]
- `src/constants/csp.ts` — current CSP directives (no changes needed) [VERIFIED: live codebase 2026-06-14]
- `src/styles/tokens.css` — all CSS custom property names and values [VERIFIED: live codebase 2026-06-14]
- `src/domain/gaps.ts` — `TZDate` usage pattern for Amsterdam local time [VERIFIED: live codebase 2026-06-14]
- `github.com/leeoniya/uPlot/dist/uPlot.d.ts` — constructor, `AlignedData`, `stepped()`, `bars()`, `BarsPathBuilderOpts` (`size`, `align`, `disp`, `disp.fill`, `disp.x0`), `setSize()`, `setData()`, `tzDate`, `Axis.values`, `PathBuilderFactories` [VERIFIED: fetched via GitHub API 2026-06-14]
- `github.com/leeoniya/uPlot/demos/timezones-dst.html` — `tzDate: ts => uPlot.tzDate(ts, zone)` pattern [VERIFIED: fetched via GitHub API 2026-06-14]
- `github.com/leeoniya/uPlot/demos/line-paths.html` — `stepped({align: -1/1})` and `bars({size})` usage [VERIFIED: fetched via GitHub API 2026-06-14]
- `tests/csp-plugin.test.ts` — Phase 1 CI grep test pattern for UX-05/06 [VERIFIED: live codebase 2026-06-14]
- npm registry — `uplot@1.6.32` is current latest [VERIFIED: npm view uplot version 2026-06-14]
- `.planning/phases/05-visualizations-polish-transparent-assumptions-ui/05-UI-SPEC.md` — UI design contract [VERIFIED: live planning file 2026-06-14]
- `.planning/phases/05-visualizations-polish-transparent-assumptions-ui/05-CONTEXT.md` — decisions [VERIFIED: live planning file 2026-06-14]

### Secondary (MEDIUM confidence)

- `package.json` — all currently installed dependencies and their locked versions [VERIFIED: live 2026-06-14]
- `vitest.config.ts` — test environment defaults (node), setupFiles pattern [VERIFIED: live 2026-06-14]
- `src/ui/comparison-table.ts` — `effect()` pattern for reactive table; `data-metric` / `data-label` hooks for mobile reflow [VERIFIED: live 2026-06-14]

### Tertiary (LOW confidence)

- None in this research — all critical claims verified from live sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — uPlot confirmed on npm registry, version confirmed, API confirmed from .d.ts in official repo
- Architecture: HIGH — all Phase 4 contracts read from live source files
- uPlot API mechanics: HIGH — confirmed from official .d.ts and demos via GitHub API
- Month bucketing pattern: HIGH — TZDate pattern confirmed from gaps.ts; exact month-bucketing logic is ASSUMED (A1, A2)
- Grouped-bar layout: MEDIUM-HIGH — committed to native `uPlot.paths.bars()` per-series (Pattern 3); A3 covers the in-package `disp.x0`/`disp.size` fallback if automatic offsetting needs a nudge (verified in Plan 03 jsdom + live)
- Pitfalls: HIGH — grounded in actual uPlot source behavior and CSP constraints verified from live code

**Research date:** 2026-06-14
**Valid until:** 2026-09-14 (stable stack; uPlot rarely makes breaking changes; date-fns pattern is stable)
