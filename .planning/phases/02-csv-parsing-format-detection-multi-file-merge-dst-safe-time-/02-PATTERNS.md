# Phase 2: CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 19 new/modified files
**Analogs found:** 8 / 19 (11 greenfield — new `src/domain/` layer)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/domain/types.ts` | model | — | none (greenfield) | no analog |
| `src/domain/parsers/registry.ts` | utility | event-driven | none (greenfield) | no analog |
| `src/domain/parsers/homewizard-p1.ts` | service | transform | none (greenfield) | no analog |
| `src/domain/parsers/noop-stub.ts` | utility | — | `src/domain/parsers/homewizard-p1.ts` (sibling, same phase) | role-match |
| `src/domain/parse.ts` | service | transform | none (greenfield) | no analog |
| `src/domain/merge.ts` | utility | batch | none (greenfield) | no analog |
| `src/domain/gaps.ts` | utility | batch | none (greenfield) | no analog |
| `src/domain/period-filter.ts` | utility | transform | none (greenfield) | no analog |
| `src/ui/drop-zone.ts` | component | request-response | `src/shell.ts` | role-match |
| `src/ui/readout.ts` | component | request-response | `src/shell.ts` | role-match |
| `src/styles/drop-zone.css` | config | — | `src/styles/global.css` | role-match |
| `src/constants/csp.ts` | config | — | `src/constants/csp.ts` (modify) | exact |
| `src/main.ts` | config | — | `src/main.ts` (modify) | exact |
| `tests/homewizard-p1.test.ts` | test | — | `tests/csp-plugin.test.ts` | role-match |
| `tests/registry.test.ts` | test | — | `tests/csp-plugin.test.ts` | role-match |
| `tests/encoding.test.ts` | test | — | `tests/csp-plugin.test.ts` | role-match |
| `tests/dst-fixtures.test.ts` | test | — | `tests/csp-plugin.test.ts` | role-match |
| `tests/parse-errors.test.ts` | test | — | `tests/csp-plugin.test.ts` | role-match |
| `tests/merge.test.ts` | test | — | `tests/csp-plugin.test.ts` | role-match |
| `tests/period-filter.test.ts` | test | — | `tests/csp-plugin.test.ts` | role-match |
| `tests/drop-zone.test.ts` | test | — | `tests/shell.test.ts` | exact |
| `tests/readout.test.ts` | test | — | `tests/shell.test.ts` | exact |

---

## Pattern Assignments

### `src/constants/csp.ts` (config — modify existing)

**Analog:** `src/constants/csp.ts` (the file itself — adding one directive)

**Current shape** (lines 1–21):
```typescript
/**
 * Content Security Policy directive string — single source of truth.
 *
 * Consumed by:
 * - vite.config.ts (cspInjectPlugin: injects into dist/index.html at build time only)
 * - tests/csp-plugin.test.ts (unit test asserting all required directives are present)
 *
 * D-03: Maximal lockdown. No 'unsafe-inline'. No 'unsafe-eval'.
 * Note: frame-ancestors 'none' is advisory only via <meta> (browsers ignore it per CSP spec).
 */
export const CSP: string = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')
```

**Change required:** Insert `"worker-src blob:"` between `"connect-src 'none'"` and `"base-uri 'self'"`. Add a comment explaining the reason (PapaParse `worker: true`). Update the JSDoc comment to reference DATA-13.

**Pattern rule:** The array is kept sorted by specificity (default → content → navigation → worker). Comment every non-obvious directive with the requirement ID that forces it. The `export const CSP` name is fixed — `vite.config.ts` and `tests/csp-plugin.test.ts` both import it by this name.

---

### `tests/csp-plugin.test.ts` (test — modify existing)

**Analog:** `tests/csp-plugin.test.ts` (the file itself — adding one `it()` assertion)

**Current test shape** (lines 1–57 — copy the structure exactly):
```typescript
// No per-file environment override — runs in DEFAULT node env
/**
 * tests/csp-plugin.test.ts — CSP directive contract lock (D-08, SETUP-05)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Pure string assertion against the single-source CSP constant.
 *
 * If any test in this file fails it means a future edit weakened the policy.
 * These tests must remain green on every push (CI gate — Plan 03).
 */
import { describe, it, expect } from 'vitest'
import { CSP } from '../src/constants/csp'

describe('CSP directive contract', () => {
  it("contains default-src 'none'", () => {
    expect(CSP).toContain("default-src 'none'")
  })
  // ... one it() per directive
})
```

**Change required:** Add one `it()` block asserting `"worker-src blob:"`:
```typescript
it("contains worker-src blob:", () => {
  expect(CSP).toContain("worker-src blob:")
})
```

**Pattern rule:** One `it()` per directive. Directive name in the test description string matches the directive exactly (including quotes). No `beforeEach`, no shared state — each test is a standalone string assertion. Keep the no-`unsafe-inline` and no-`unsafe-eval` guards.

---

### `src/main.ts` (config — modify existing)

**Analog:** `src/main.ts` (the file itself — wiring the drop-zone controller)

**Current shape** (lines 1–15):
```typescript
import './styles/global.css'
import { renderShell } from './shell'

// The 3-region shell is pre-rendered in index.html for static delivery.
// renderShell is exported from shell.ts and used by:
//   1. Plan 02 jsdom tests (DOM contract assertions)
//   2. Future phases that may mount the shell dynamically (e.g. SPA routing)
//
// In this static-first delivery model we only call renderShell when the #app
// element has no children (i.e. when running under jsdom in tests, or if the
// index.html shell is somehow absent).
const app = document.getElementById('app')
if (app && app.children.length === 0) {
  renderShell(app)
}
```

**Change required:** Add imports for the drop-zone CSS and controller AFTER `renderShell` runs, inside `DOMContentLoaded` (or after the existing guard). The double-render guard (`app.children.length === 0`) must be preserved verbatim.

**Pattern rule for the new wiring block:**
```typescript
import './styles/drop-zone.css'          // Phase 2: drop-zone state CSS
import { initDropZone } from './ui/drop-zone'

// ... existing renderShell guard unchanged ...

const dropZoneRegion = document.getElementById('drop-zone-region')
if (dropZoneRegion) {
  initDropZone(dropZoneRegion)
}
```

**Pattern rule:** Import CSS files at top of `main.ts` (Vite handles CSS injection). Side-effect imports (CSS) before named imports. Guard DOM queries with `if (element)` — never assume the element exists (tests may run without full DOM).

---

### `src/shell.ts` (no change — reference only)

**Not modified.** `renderShell()` is unchanged. The `#drop-zone-region` element it creates is the mount point that `initDropZone()` in `src/ui/drop-zone.ts` will populate. The `p.privacy-promise` text inside `#drop-zone-region` must be preserved — `drop-zone.ts` appends to the region, it does not replace it.

**Pattern to copy for DOM construction** (lines 22–65):
```typescript
// DOM-API construction pattern — no innerHTML, no template strings, no inline styles
const el = document.createElement('tagname')
el.className = 'css-class-only'     // no el.style.* assignments (CSP)
el.textContent = 'text'             // textContent for user-provided strings (XSS safe)
el.setAttribute('aria-label', '…') // ARIA attributes via setAttribute
parent.appendChild(el)
```

---

### `src/ui/drop-zone.ts` (component, request-response)

**Analog:** `src/shell.ts`

**Imports pattern** (from `src/shell.ts` lines 1–0, `src/main.ts` lines 1–2 — extrapolate):
```typescript
// No framework imports — vanilla DOM only
// Named function export — matches renderShell() convention in shell.ts
export function initDropZone(region: HTMLElement): void { … }
```

**DOM construction pattern** (from `src/shell.ts` lines 22–65):
```typescript
// Always createElement + className/textContent/setAttribute
// Never el.style.* (CSP style-src 'self' forbids inline styles)
// Never innerHTML with user-supplied strings (XSS)
const el = document.createElement('div')
el.className = 'drop-zone--idle'
region.appendChild(el)
```

**State machine pattern** (from `02-UI-SPEC.md` §Drop-Zone Interaction States):
```typescript
// CSS class swap for state — add/remove classes, never toggle style properties
function setState(region: HTMLElement, state: 'idle' | 'dragover' | 'parsing' | 'success' | 'error'): void {
  region.classList.remove('drop-zone--idle', 'drop-zone--dragover', 'drop-zone--parsing', 'drop-zone--success', 'drop-zone--error')
  region.classList.add(`drop-zone--${state}`)
}
```

**Event handler pattern** (from `02-UI-SPEC.md`):
```typescript
// dragenter/dragover/dragleave/drop — native HTML5 events only
region.addEventListener('dragover', (e) => {
  e.preventDefault()                         // required to accept drop
  e.dataTransfer!.dropEffect = 'copy'
  setState(region, 'dragover')
  region.setAttribute('aria-dropeffect', 'copy')
})
region.addEventListener('dragleave', () => {
  setState(region, 'idle')
  region.removeAttribute('aria-dropeffect')
})
```

**File input pattern** (from `02-UI-SPEC.md` §idle state):
```typescript
// <input> visually hidden but accessible — clip-path not display:none
const input = document.createElement('input')
input.type = 'file'
input.multiple = true
input.accept = '.csv,text/csv'
input.id = 'file-picker-input'
input.className = 'file-picker-input'   // CSS class controls clip-path
```

**ARIA pattern** (from `02-UI-SPEC.md` §Accessibility Contract):
```typescript
region.setAttribute('aria-label', 'Bestanden uploaden')
// aria-dropeffect set/removed dynamically during dragover/dragleave
```

**Error display pattern** (from `02-UI-SPEC.md` §error state):
```typescript
// role="alert" so screen readers announce without focus management
const errorPara = document.createElement('p')
errorPara.className = 'parse-error'
errorPara.setAttribute('role', 'alert')
errorPara.textContent = err.message   // textContent — never innerHTML for user data
```

---

### `src/ui/readout.ts` (component, request-response)

**Analog:** `src/shell.ts`

**Imports pattern:**
```typescript
import type { MergeResult } from '../domain/types'

export function renderReadout(result: MergeResult): HTMLElement { … }
// Returns an element; caller inserts it. Does NOT directly mutate the DOM.
// This makes it testable without a live DOM (inject result; assert returned element).
```

**DOM construction pattern** (from `src/shell.ts` lines 22–65):
```typescript
// <section> for the readout container (matches 02-UI-SPEC.md §Sanity Readout)
const section = document.createElement('section')
section.id = 'parse-readout'
section.setAttribute('aria-label', 'Parseresultaten')
```

**Description list pattern** (from `02-UI-SPEC.md` §Layout):
```typescript
// <dl>/<dt>/<dd> — no tables, no divs masquerading as definitions
const dl = document.createElement('dl')
const dt = document.createElement('dt')
dt.textContent = 'Bestanden'         // Dutch label — functional, unpolished (D-03)
const dd = document.createElement('dd')
dd.textContent = String(result.fileStats.length)
dl.appendChild(dt)
dl.appendChild(dd)
```

**Number formatting pattern** (from `02-UI-SPEC.md` §Readout Field Contract):
```typescript
// NL locale formatting — thousands separator and 1 decimal for kWh
const formatRows = (n: number) => n.toLocaleString('nl-NL')          // e.g. "52.438"
const formatKwh = (n: number) => `${n.toFixed(1)} kWh`               // e.g. "12345.6 kWh"
const formatDate = (d: Date) => d.toLocaleDateString('nl-NL', {       // DD-MM-YYYY
  day: '2-digit', month: '2-digit', year: 'numeric'
})
```

**XSS safety rule** (from `02-RESEARCH.md` §Security Domain):
```typescript
// ALWAYS textContent for user-supplied strings (file names, raw values)
// NEVER innerHTML with any data derived from user uploads
dd.textContent = result.fileStats[0].fileName   // safe
// dd.innerHTML = `<b>${result.fileStats[0].fileName}</b>`  // ← forbidden
```

---

### `src/styles/drop-zone.css` (config — new CSS file)

**Analog:** `src/styles/global.css`

**File header pattern** (from `src/styles/global.css` lines 1–4):
```css
/* src/styles/drop-zone.css */
/* Drop-zone state classes and readout layout. */
/* No inline styles anywhere — required by style-src 'self' CSP (D-03). */
@import './tokens.css';   /* if tokens not already transitively imported */
```

**Token usage pattern** (from `src/styles/tokens.css` + `src/styles/global.css`):
```css
/* Always use custom properties — never hardcode colors or spacing values */
/* Exception: one-off state values not worth tokenizing (see dragover tint) */
.drop-zone--idle {
  background-color: var(--color-surface);
  border: 1px dashed var(--color-border);
}

.drop-zone--dragover {
  border: 1px solid var(--color-accent);
  background-color: rgb(37 99 235 / 0.08);  /* accent at 8% — one-off, not tokenized */
}

.drop-zone--error {
  border: 1px solid var(--color-destructive);
}
```

**Existing `#drop-zone-region` base rules** (from `src/styles/global.css` lines 55–62):
```css
/* global.css already sets:
   margin, padding, min-height, background-color, border, border-radius
   for #drop-zone-region in its idle state.
   drop-zone.css OVERRIDES border and background-color only for non-idle states.
   Do not re-declare margin/padding/min-height/border-radius — they live in global.css. */
```

**Accessible hidden input pattern** (from `02-UI-SPEC.md` §idle state):
```css
/* Visually hidden but accessible — clip-path not display:none */
.file-picker-input {
  position: absolute;
  clip-path: inset(50%);
  width: 1px;
  height: 1px;
  overflow: hidden;
  white-space: nowrap;
}
```

**Touch target pattern** (from `02-UI-SPEC.md` §idle state):
```css
/* File-picker label styled as button — min-height 44px (WCAG 2.5.5) */
.file-picker-label {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  background-color: var(--color-bg);
  color: var(--color-accent);
  font-size: var(--font-size-body);
  cursor: pointer;
}
```

**Readout layout pattern** (from `02-UI-SPEC.md` §Readout Styling):
```css
#parse-readout {
  margin-top: var(--space-xl);
  padding: var(--space-lg);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.readout-divider {
  height: 1px;
  background-color: var(--color-border);
  margin: var(--space-md) 0;
}

#parse-readout dt {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
}

#parse-readout dd {
  font-size: var(--font-size-body);
  color: var(--color-text);
  margin-left: 0;
}
```

---

### `src/domain/types.ts` (model — greenfield)

**No analog — establishes new pattern for the domain layer.**

The types file is a pure TypeScript declaration module: no runtime code, only `interface`, `type`, and `class` declarations. Error classes (`ParseRowError`, `UnsupportedEncodingError`) are the only executable items — they extend `Error` with public readonly fields.

**Pattern to establish** (from `02-RESEARCH.md` §IntervalSample Contract and §Error Architecture):
```typescript
// src/domain/types.ts
// No imports from the project — this file is the root of the domain type graph.
// Libraries may be imported if needed for type-only purposes.

/** JSDoc on every exported type — minimum: one sentence explaining the invariant */
export interface IntervalSample {
  /** UTC Date — interval end (HomeWizard timestamps mark interval end) */
  timestamp: Date
  /** Non-negative grid import for this interval in kWh (DATA-06 invariant: always >= 0) */
  gridImportKwh: number
  /** Non-negative grid export (teruglevering) in kWh (DATA-06 invariant: always >= 0) */
  gridExportKwh: number
}

// Error classes: extend Error, public readonly fields, Dutch message strings
export class ParseRowError extends Error {
  constructor(
    public readonly fileName: string,
    public readonly rowNumber: number,
    public readonly columnName: string,
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(
      `Fout in bestand "${fileName}", rij ${rowNumber}, kolom "${columnName}": verwacht ${expected}, gekregen "${actual}".`
    )
  }
}
```

**Invariant rule:** `gridImportKwh >= 0` and `gridExportKwh >= 0` are enforced at the adapter boundary (adapter clamps to `Math.max(0, delta)` after flagging monotonicity failure). Downstream domain functions (merge, gaps, period-filter) can assume non-negative values without re-checking.

---

### `src/domain/parsers/registry.ts` (utility — greenfield)

**No analog — establishes the parser-registry pattern for the project.**

**Pattern to establish** (from `02-RESEARCH.md` §Pattern 1):
```typescript
// src/domain/parsers/registry.ts
// Singleton registry — no constructor, exported as a plain object.
// Parsers register themselves via side-effect imports in parse.ts.

import type { ParseFileResult } from '../types'

export interface CsvParser {
  name: string
  claim(headers: string[]): boolean
  transform(rows: Record<string, string>[], file: File): ParseFileResult
}

const registry: CsvParser[] = []

export const ParserRegistry = {
  register(parser: CsvParser): void {
    registry.push(parser)
  },
  claim(headers: string[]): CsvParser | null {
    return registry.find(p => p.claim(headers)) ?? null
  },
}
```

**No default export** — named export `ParserRegistry` only. This matches the project convention seen in `src/constants/csp.ts` (named `CSP`) and `src/shell.ts` (named `renderShell`).

---

### `src/domain/parsers/homewizard-p1.ts` (service, transform — greenfield)

**No analog — first entry in the parser registry; establishes the adapter pattern.**

**Side-effect registration pattern** (from `02-RESEARCH.md` §Pattern 1):
```typescript
// src/domain/parsers/homewizard-p1.ts
// Self-registers on import. No named exports needed — the registry holds the reference.
import { TZDate } from '@date-fns/tz'
import { ParserRegistry, type CsvParser } from './registry'
import type { IntervalSample, ParseFileResult, SeriesType } from '../types'
import { ParseRowError } from '../types'

const HomeWizardP1Parser: CsvParser = {
  name: 'HomeWizard P1',
  claim(headers: string[]): boolean { … },
  transform(rows: Record<string, string>[], file: File): ParseFileResult { … },
}

ParserRegistry.register(HomeWizardP1Parser)
export {}   // ← required: prevents Rollup from treating this as a dead module
```

**Import order rule:** External library imports first (`@date-fns/tz`), then internal imports from parent (`../types`), then sibling registry (`./registry`). This mirrors the convention in `src/main.ts` (CSS side-effect first, then named imports).

**Timestamp parsing pattern** (from `02-RESEARCH.md` §Pattern 2):
```typescript
// Always TZDate — never native new Date() for local Amsterdam timestamps
function parseLocalTimestamp(raw: string, fileName: string, rowNum: number): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(raw)
  if (!match) throw new ParseRowError(fileName, rowNum, 'time', 'YYYY-MM-DD HH:MM', raw)
  const [, yr, mo, dy, hr, mn] = match.map(Number)
  return new Date(new TZDate(yr, mo - 1, dy, hr, mn, 'Europe/Amsterdam').getTime())
}
```

**Numeric parsing pattern** (from `02-RESEARCH.md` §Pitfall 6):
```typescript
// Normalize decimal comma before parseFloat — handles NL locale variants
function parseKwh(raw: string, col: string, file: string, row: number): number {
  const normalized = raw.trim().replace(',', '.')
  const val = parseFloat(normalized)
  if (isNaN(val)) throw new ParseRowError(file, row, col, 'non-negative number', raw)
  return val
}
```

**Fail-fast pattern** (from `02-CONTEXT.md` D-06 + `02-RESEARCH.md` §PapaParse with Worker):
```typescript
// Throw ParseRowError immediately on bad data — never silently skip or zero-fill
// The caller (parse.ts step callback) will abort PapaParse and reject the Promise
if (importKwh < -0.001 || exportKwh < -0.001) {
  // flag monotonicity; do NOT throw — this is a soft anomaly (D-05)
  isMonotonic = false
  monotonicity_failRow = curr.rowNumber
}
// But a non-numeric cell value throws ParseRowError immediately (D-06)
```

---

### `src/domain/parsers/noop-stub.ts` (utility — greenfield)

**Analog:** `src/domain/parsers/homewizard-p1.ts` (same registry side-effect pattern, minimal claim logic)

**Pattern to copy** (same structure as homewizard-p1.ts but claim always returns false):
```typescript
// src/domain/parsers/noop-stub.ts
// Noop second parser — proves the registry accepts multiple registrations
// without editing any central switch (DATA-03, criterion 7).
// claim() always returns false so it never handles any real file.
import { ParserRegistry, type CsvParser } from './registry'
import type { ParseFileResult } from '../types'

const NoopStubParser: CsvParser = {
  name: 'Noop Stub',
  claim(_headers: string[]): boolean {
    return false   // never claims any file
  },
  transform(_rows: Record<string, string>[], _file: File): ParseFileResult {
    throw new Error('NoopStubParser.transform should never be called')
  },
}

ParserRegistry.register(NoopStubParser)
export {}
```

---

### `src/domain/parse.ts` (service, transform — greenfield)

**No analog — orchestrates encoding detection + registry dispatch + PapaParse.**

**Side-effect import pattern** (from `02-RESEARCH.md` §Pattern 1):
```typescript
// src/domain/parse.ts
import Papa from 'papaparse'
import './parsers/homewizard-p1'   // side-effect: registers on import
import './parsers/noop-stub'       // side-effect: registers on import
import { ParserRegistry } from './parsers/registry'
import type { ParseFileResult } from './types'
import { ParseRowError, UnsupportedEncodingError } from './types'
```

**Side-effect imports must be STATIC** — no `await import()`. See `02-RESEARCH.md` §Pitfall 5.

**PapaParse integration pattern** (from `02-RESEARCH.md` §PapaParse with Worker):
```typescript
Papa.parse(text, {
  header: true,
  delimiter: '',          // auto-detect , or ;
  dynamicTyping: false,   // always strings — we parse manually
  worker: true,           // requires worker-src blob: in CSP (DATA-13)
  skipEmptyLines: true,
  step(result, parser) { … },
  complete() { … },
  error(err) { … },
})
```

**Promise wrapping pattern:** `parseFile()` returns `Promise<ParseFileResult>`. The `complete` callback calls `resolve()`; `error` and fail-fast path call `reject()`. Accumulate rows in a local array inside the Promise closure.

---

### `src/domain/merge.ts` (utility, batch — greenfield)

**No analog — establishes the merge pattern.**

**Pattern to establish** (from `02-RESEARCH.md` §Pattern 5):
```typescript
// src/domain/merge.ts
import type { ParseFileResult, MergeResult, IntervalSample } from './types'

export function mergeFiles(results: ParseFileResult[]): MergeResult {
  // Sort finest cadence first
  const sorted = [...results].sort((a, b) => a.cadenceMinutes - b.cadenceMinutes)
  const merged = new Map<number, IntervalSample>()  // keyed by UTC ms
  // Walk sorted results: finest first; skip key if already present
  // Track contributed/overridden counts per file for D-08 readout
}
```

**No imports from `src/ui/`** — the domain layer must be free of browser globals. Keep all `src/domain/` files importable in a pure Node environment (Vitest node env, `vitest.config.ts` line 6).

---

### `src/domain/gaps.ts` (utility, batch — greenfield)

**No analog.** See `02-RESEARCH.md` §Pattern 3 for the DST-aware algorithm.

**Key pattern rule:** Walk UTC milliseconds at the inferred cadence to generate expected slots. Use `tzScan` from `@date-fns/tz` or the local-time interval walk to exclude spring-forward missing slots from the gap count (CONTEXT.md D-04). RESEARCH.md recommends the local-time interval walk as simpler.

**Import pattern:**
```typescript
import type { IntervalSample } from './types'
// @date-fns/tz tzScan if needed for DST exemption logic
// No browser globals — must run in node env
```

---

### `src/domain/period-filter.ts` (utility, transform — greenfield)

**No analog.** Simplest domain module — two pure functions, no dependencies except `types.ts`.

**Pattern to establish** (from `02-RESEARCH.md` §Period Filter):
```typescript
// src/domain/period-filter.ts
import type { IntervalSample } from './types'

export function filterByPeriod(
  samples: IntervalSample[],
  start: Date | null,
  end: Date | null
): IntervalSample[] {
  const s = start?.getTime() ?? -Infinity
  const e = end?.getTime() ?? Infinity
  return samples.filter(x => x.timestamp.getTime() >= s && x.timestamp.getTime() <= e)
}

export function fullRange(samples: IntervalSample[]): { start: Date; end: Date } {
  return {
    start: samples[0].timestamp,
    end: samples[samples.length - 1].timestamp,
  }
}
```

---

### Node-environment test files (`tests/*.test.ts` except drop-zone and readout)

**Analogs:** `tests/csp-plugin.test.ts` (node env, no docblock override)

**File header pattern** (from `tests/csp-plugin.test.ts` lines 1–13 — copy this block, substitute the requirement IDs and description):
```typescript
/**
 * tests/{name}.test.ts — {requirement} contract lock ({req-id})
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * {One sentence explaining what this file locks.}
 *
 * If any test in this file fails it means {consequence}.
 */
import { describe, it, expect } from 'vitest'
// Import only domain modules — no browser APIs in node-env tests
import { … } from '../src/domain/…'
```

**Critical rule:** No `// @vitest-environment jsdom` docblock. No `document`, `window`, or `HTMLElement` references. Domain tests must pass under `vitest.config.ts`'s default `environment: 'node'`.

**Test structure pattern** (from `tests/csp-plugin.test.ts`):
```typescript
describe('{module or requirement name}', () => {
  it('{behavior description — present tense, what the system does}', () => {
    // Arrange: minimal fixture data (inline or from tests/fixtures/)
    // Act: call the function under test
    // Assert: expect() on the result
  })
})
```

**Fixture data pattern** (from `02-RESEARCH.md` §Validation Architecture):
```typescript
// Inline fixtures for unit tests (small, readable)
const sampleRow = { time: '2026-01-15 00:15', 'Import T1 kWh': '8354.590', … }

// File fixtures in tests/fixtures/ for DST tests and HomeWizard CSV tests
// Reference as: new File([csvString], 'fixture.csv', { type: 'text/csv' })
```

---

### jsdom-environment test files (`tests/drop-zone.test.ts`, `tests/readout.test.ts`)

**Analog:** `tests/shell.test.ts` (jsdom env, `// @vitest-environment jsdom` docblock)

**File header pattern** (from `tests/shell.test.ts` lines 1–13 — copy exactly):
```typescript
// @vitest-environment jsdom
/**
 * tests/{name}.test.ts — {component} DOM-contract lock ({req-id})
 *
 * Runs in the jsdom environment (per-file override via first-line docblock — D-09).
 * Calls {function}() against a real jsdom DOM.
 *
 * If any test in this file fails it means a future edit:
 * - {list the DOM contract invariant this file locks}
 */
import { describe, it, expect, beforeEach } from 'vitest'
```

**Critical rule:** `// @vitest-environment jsdom` MUST be the very first line of the file — before the JSDoc block. `vitest.config.ts` line 6 sets `environment: 'node'` as default; the per-file docblock overrides it only when it is the first line.

**DOM reset pattern** (from `tests/shell.test.ts` lines 17–25):
```typescript
beforeEach(() => {
  // Reset DOM between tests — prevents state leak
  document.body.innerHTML = '<div id="app"></div>'
  const host = document.getElementById('app') as HTMLElement
  renderShell(host)    // or initDropZone(element) — whatever sets up the region
})
```

**Assertion pattern** (from `tests/shell.test.ts`):
```typescript
// Query by semantic selector, not by CSS class (classes may change)
const el = document.querySelector('#drop-zone-region')
expect(el).not.toBeNull()
expect(el!.getAttribute('aria-label')).toBe('Bestanden uploaden')
// textContent assertions for user-visible text
expect(el!.textContent).toContain('…')
```

---

## Shared Patterns

### No Inline Styles (applies to ALL new `src/ui/*.ts` files)

**Source:** `src/shell.ts` (entire file — zero `el.style.*` calls) + `src/styles/global.css` line 3 comment + `src/constants/csp.ts` line 8 comment

**Rule:** Never assign `element.style.*` in TypeScript. Never write `style="..."` in template strings. All visual state changes happen by adding/removing CSS class names. The CSP `style-src 'self'` directive blocks inline styles at runtime; violations are silent failures, not exceptions.

```typescript
// CORRECT — class swap
element.classList.add('drop-zone--dragover')
element.classList.remove('drop-zone--idle')

// FORBIDDEN — inline style
element.style.borderColor = '#2563eb'   // blocked by CSP, no-op silently
```

### textContent for User Data (applies to ALL new `src/ui/*.ts` files)

**Source:** `02-RESEARCH.md` §Security Domain (XSS via file name in readout)

**Rule:** All values derived from user-uploaded CSV data (file names, row values, error messages) must be assigned via `.textContent`, never via `.innerHTML`. Static structural HTML (wrapper elements, `<dl>/<dt>/<dd>` scaffolding) may use `innerHTML` only if it contains zero user-derived data.

```typescript
// CORRECT
dd.textContent = result.fileStats[0].fileName
errorPara.textContent = err.message

// FORBIDDEN — file name could contain <script> or other markup
errorPara.innerHTML = `Fout in bestand "${fileName}"`
```

### Export {} on Side-Effect Modules (applies to all `src/domain/parsers/*.ts` adapters)

**Source:** `02-RESEARCH.md` §Pitfall 5 (Rollup tree-shaking)

**Rule:** Every parser adapter file that registers via side-effect must end with `export {}`. This prevents Rollup from considering the module empty and tree-shaking it away, which would silently break the registry.

```typescript
ParserRegistry.register(MyParser)
export {}   // ← required on every adapter; do not remove
```

### Node-Environment Domain Layer (applies to ALL `src/domain/*.ts` files)

**Source:** `vitest.config.ts` line 6 (`environment: 'node'`) + `02-CONTEXT.md` §Established Patterns

**Rule:** No file inside `src/domain/` may reference `document`, `window`, `HTMLElement`, `File` (as a runtime value, not a type), or any other browser global. Domain functions receive typed inputs and return typed outputs. The UI layer (`src/ui/`) calls domain functions and handles DOM concerns.

**Exception:** `src/domain/parse.ts` necessarily references `File` as a type in its function signature (from the PapaParse API). This is acceptable because `File` is available as a type in TypeScript even in Node. The actual `File` object is passed in from the UI layer; `parse.ts` does not construct one.

### Dutch Functional Labels (applies to ALL user-visible strings in `src/ui/readout.ts` and `src/ui/drop-zone.ts`)

**Source:** `02-CONTEXT.md` D-03 + `02-UI-SPEC.md` §Copywriting Contract

**Rule:** All user-visible strings are in Dutch. Labels are functional and unpolished — the tone/terminology audit is Phase 5. Never write English labels that will need to be ripped out. Specific locked strings:

```typescript
// Locked from 02-UI-SPEC.md §Copywriting Contract
const COPY = {
  dropInstruction: 'Sleep een of meer CSV-bestanden hierheen',
  filePickerLabel: 'Of kies bestanden',
  parsingStatus:   'Bezig met verwerken...',
  // Privacy promise: verbatim from PRIV-02 — stored in shell.ts, preserved not repeated
}
// Readout labels: see 02-UI-SPEC.md §Readout Field Contract for all <dt> strings
```

---

## No Analog Found

Files with no close match in the codebase — planner should use RESEARCH.md patterns as the primary specification:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/domain/types.ts` | model | — | First domain type file; no prior type-only module in project |
| `src/domain/parsers/registry.ts` | utility | event-driven | No registry or plugin pattern exists yet |
| `src/domain/parsers/homewizard-p1.ts` | service | transform | First parser adapter; establishes the adapter pattern |
| `src/domain/parse.ts` | service | transform | No orchestration layer exists; first use of PapaParse in the project |
| `src/domain/merge.ts` | utility | batch | No merge/reduce functions exist yet |
| `src/domain/gaps.ts` | utility | batch | No time-series analysis exists yet |
| `src/domain/period-filter.ts` | utility | transform | No filter utilities exist yet |
| `tests/fixtures/` directory | test | — | No fixture data directory exists; must be created |

For all greenfield `src/domain/` files, the established pattern is:
1. Pure TypeScript — no browser globals, no side effects (except registry modules which end with `export {}`).
2. Named exports only — no default exports (consistent with `src/constants/csp.ts` and `src/shell.ts`).
3. JSDoc on every exported symbol with a minimum one-sentence invariant description.
4. Import order: external libraries, then `../types`, then siblings.

---

## Metadata

**Analog search scope:** `src/` (all 5 existing files), `tests/` (all 2 existing files)
**Files scanned:** 7 existing files (shell.ts, main.ts, csp.ts, tokens.css, global.css, csp-plugin.test.ts, shell.test.ts)
**Pattern extraction date:** 2026-06-08
