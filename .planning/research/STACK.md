# Stack Research

**Domain:** Fully client-side static calculator (single-purpose web app) — Battery Calculator (NL)
**Researched:** 2026-05-26
**Confidence:** HIGH (versions verified against npm registry and GitHub release tags on 2026-05-26; rationales cross-checked against official docs and changelogs)

> Scope reminder: The baseline (Vanilla TypeScript + Vite, no framework, static build, GitHub Pages, bundled JSON catalog) is already chosen and **not** under review. This document recommends the *supporting* libraries that slot inside that baseline.

---

## Recommended Stack

### Core Technologies (already chosen — locking versions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Vite** | `^8.0.14` (released 2026-05-21) | Build tool, dev server, static bundler | Native ESM dev, Rollup-based production build; Vite 8 is the current stable major and the version Vitest 4.1+ co-installs against. `base: './'` or `'/battery-calculator/'` is the only config needed for GitHub Pages. |
| **TypeScript** | `^5.6.x` (whichever matches Vite 8 starter; `~5.6` is the current LTS-ish line) | Type system | Catches CSV/timestamp/battery-spec misalignment cheaply. No runtime cost; Vite handles transpile via esbuild. |
| **Node.js** | `lts/*` in CI (currently 22.x LTS) | Build runtime only — not shipped | Matches `actions/setup-node@v6` default. |

### Supporting Libraries (recommendations)

| Library | Version | Purpose | When to Use | Bundle (gzip) |
|---------|---------|---------|-------------|---------------|
| **papaparse** | `^5.5.3` | CSV parsing in the browser | Always. Handles File objects, streaming (`step`), `worker: true`, configurable `delimiter`, header inference, type coercion. | **~6.9 KB** |
| **uPlot** | `^1.6.32` | Time-series + bar charts | Always for the sample-week energy chart and monthly self-consumption bars. | **~21.9 KB** |
| **@preact/signals-core** | `^1.14.2` | Framework-agnostic reactive state | Always — wraps UI state (selected batteries, period, saldering toggle, parsed series) so DOM updates stay consistent without a framework. | **~1.5 KB** |
| **@date-fns/tz** | `^1.5.0` (paired with `date-fns@^4.3.0`) | Europe/Amsterdam timezone + DST math | Always — needed to bucket timestamps into local-time 15-min/hourly bins correctly across the March/October DST transitions. | **~3 KB** (`TZDate` + minimal date-fns fns used) |

That is the full client-side dependency list. **Total runtime cost: ~33 KB gzipped** for parser + chart + reactivity + tz-aware dates — well within budget for a "single-purpose calculator, not an app shell."

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **vitest** `^4.1.7` | Unit + integration tests | Vitest 4.1 added native Vite 8 support (uses the installed Vite, no second copy). Configure `environment: 'jsdom'` only for the few tests that touch DOM; keep parser/sim tests in pure node env for speed. |
| **@vitest/coverage-v8** `^4.1.x` | Coverage reports | V8 provider is faster than istanbul and ships with Vitest's own version. |
| **@types/papaparse** `^5.x` | TypeScript types for Papa | Papa Parse ships JS; types are a separate package. |
| **eslint** `^9.x` (flat config) + **@typescript-eslint** `^8.x` | Linting | Flat config (`eslint.config.js`) is the only supported format in ESLint 9. |
| **prettier** `^3.x` | Formatting | Pair with `eslint-config-prettier` to disable conflicts. |
| **GitHub Actions** (see workflow below) | Deploy | Use the official `actions/*-pages@v5/v6` chain — no third-party deploy action needed. |

---

## Installation

```bash
# Scaffold (one-time)
npm create vite@latest battery-calculator -- --template vanilla-ts

# Runtime deps (all shipped to the browser)
npm install papaparse uplot @preact/signals-core date-fns @date-fns/tz

# Types + dev tooling
npm install -D @types/papaparse vitest @vitest/coverage-v8 jsdom \
  eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

---

## Library-by-Library Rationale

### 1. CSV Parsing → **papaparse 5.5.3**

**Confidence: HIGH** (verified against npm registry + official docs at papaparse.com)

- Streams via `step` callback so a 50k-row P1 export never sits in memory as one array.
- `worker: true` moves parsing off the main thread for free — keeps the UI responsive on a large drop.
- `delimiter: ';'` (or `delimiter: ''` for auto-detect) handles the Dutch `;`-delimited variant that providers love.
- Accepts a `File` object directly: `Papa.parse(file, { worker: true, step, complete })` — no FileReader plumbing.
- Zero dependencies. ~6.9 KB gzipped.

**BOM caveat (verified):** Papa exposes `Papa.BYTE_ORDER_MARK = '\uFEFF'` and treats it as a "bad delimiter," but the docs do not guarantee header BOM stripping in every code path. **Action: in the format-detection layer, explicitly strip a leading `\uFEFF` from the first header before matching.** That's a 1-line defensive measure, not a reason to reject the library.

**Why not the alternatives?**
- **csv-parse** (Node-first, requires browser shims, larger).
- **PapaParse forks (`sonthanhdan/papa-parse` etc.)** — unmaintained drift; stay on `mholt/PapaParse`.
- **Hand-rolled split-on-comma parser** — guarantees future bugs with quoted fields, escaped quotes, embedded newlines in HomeWizard's German-locale exports.

### 2. Time-Series Date Handling → **date-fns 4 + @date-fns/tz 1.5**

**Confidence: HIGH** (npm registry + date-fns v4 release blog)

Why not native `Date`? `Date` is system-local; the build runs on CI in UTC, the user's browser may be in any timezone, but **the data itself is in Europe/Amsterdam local time** (P1 timestamps are wall-clock). Doing 15-min bucketing with raw `Date` will silently drop or duplicate a row at the DST flip every March and October.

Why **date-fns v4 + @date-fns/tz** specifically:
- date-fns v4 is the current line (`4.3.0`, released 2026-05-22). v4 introduced first-class time-zone support via the `@date-fns/tz` companion package, which provides `TZDate` — a `Date` subclass that performs all calculations in a named IANA zone.
- Tree-shakes: you import only `startOfHour`, `addMinutes`, `differenceInMinutes`, etc. Realistic shipped weight is ~3 KB gz.
- IANA database is supplied by the platform `Intl` API — no embedded TZ blob, no monthly bundle bloat to keep up with politicians moving DST rules.

**Why not Temporal API (native) yet?** caniuse shows ~67% support (Chrome 144+, Firefox 139+, Edge 144+). Safari ships it disabled-by-default in Tech Preview only. For a tool whose users are NL homeowners — many on iOS — that's a no-go without a 60 KB polyfill (`@js-temporal/polyfill@0.5.1`, last published 2025-03-31). Revisit in a year; until then date-fns is the pragmatic call.

**Why not Luxon / Day.js / Moment?**
- **Luxon**: ~36 KB gz with embedded TZ data — heavier with no upside over date-fns v4 for our use case.
- **Day.js**: lightweight, but TZ support is plugin-based and historically lossy at DST edges; date-fns's `TZDate` is the safer abstraction for bucketing.
- **Moment**: officially in maintenance mode since 2020; do not use in new code.

### 3. Charting → **uPlot 1.6.32**

**Confidence: HIGH** (npm + bundlephobia + leeoniya/uPlot README, cross-checked with comparison article)

Recommended for both required charts (monthly self-consumption bars, sample-week energy flow).

| Library | Latest | gzip | Time-series fit | Bars fit | Verdict |
|---|---|---|---|---|---|
| **uPlot 1.6.32** | 2025-03 | **~22 KB** | Excellent — purpose-built | Yes (1.6 added bars) | **Pick** |
| Chart.js 4.5.1 | 2025-10 | ~68 KB | Good, generic | Excellent | Heavier for similar polish |
| ECharts 6.1.0 | 2026-05 | ~130 KB+ (tree-shaken) | Excellent | Excellent | Way overkill for two charts |
| Observable Plot 0.6.17 | 2025-02 | **~128 KB** (pulls d3) | Great DX | Yes | Bundle alone is 4× the rest of the app |
| D3 directly | — | varies | Maximal control | Manual axes | Wrong abstraction level for a 2-chart UI |

Why **uPlot** wins for this project:
- Smallest competent option (~22 KB) and benchmarks better than Chart.js / ECharts for live updates on 1k–10k points — relevant when the user narrows the period and we re-bin.
- Native support for the chart types we need: time-series lines/areas + bars (added in 1.6).
- Plain JS API, no React/Vue baggage; works with vanilla TS unchanged.
- Active: latest commit on `master` is recent, 1500+ commits, single maintainer (Leon Sorokin) who responds on GitHub.

uPlot's known weaknesses are acceptable for us:
- "No data processing" — we already own that layer (simulation engine).
- "No animations" — calculator users want answers, not transitions.
- "Docs are sparse" — true; budget half a day for the first chart, then it's copy-paste.

**When to switch to Chart.js instead:** if early users say "the charts look ugly" and we want default polish without writing axis/legend code. That's a v2 problem.

### 4. Reactive UI Primitives → **@preact/signals-core 1.14.2** + tagged-template DOM

**Confidence: HIGH** (npm + Preact signals docs)

For a vanilla-TS app with ~3 interactive controls (battery picker, period slider, saldering toggle) feeding ~2 charts and a table, **a full web-component framework is overkill**. The minimal pattern:

- **State layer**: `@preact/signals-core` (~1.5 KB gz). Three primitives — `signal`, `computed`, `effect`. No framework adapter needed.
- **Render layer**: plain DOM updates inside `effect()` callbacks, or tagged-template string assignment to `innerHTML` for static-shape regions (sanitized inputs only — all our data is user-uploaded numbers, no XSS surface).

```ts
import { signal, computed, effect } from '@preact/signals-core';

const selectedBatteries = signal<Battery[]>([]);
const period           = signal<{ from: Date; to: Date }>(...);
const results          = computed(() => simulate(parsedSeries.value, selectedBatteries.value, period.value));

effect(() => renderTable(results.value));
effect(() => updateChart(results.value));
```

That's the whole reactivity story. Total cost: 1.5 KB gz, zero build-time magic, no shadow DOM, no virtual DOM.

**Why not the alternatives?**

| Option | Why not |
|---|---|
| **Lit 3.3.3** | Excellent (~6 KB gz, web standards, reactive controllers). But components + shadow DOM + decorators are extra ceremony for a 4-control UI. Reach for it if/when the app grows to 10+ widgets. |
| **Alpine.js 3.15.12** | HTML-attribute-driven; great for sprinkles on server-rendered pages. Mismatches a TS-first, computation-heavy app where state lives in JS, not in markup. |
| **petite-vue 0.4.1** | **DEAD** — last published 2022-01-18 (npm registry confirmed). Do not adopt. |
| **Vanilla DOM only** (no signals) | Fine until you add the second interaction, at which point you'll write a signals library badly. Just pay the 1.5 KB up front. |
| **Lit signals (`@lit-labs/signals`)** | Same underlying TC39 Signals proposal but coupled to Lit; without Lit components there's no benefit over `@preact/signals-core`. |

### 5. Testing → **Vitest 4.1.7** (confirmed)

**Confidence: HIGH** (Vitest 4.1 blog + npm)

Vitest is the obvious and correct pick — it shares Vite's config and transformer, so there's literally nothing to set up beyond:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',          // default; override per-file with @vitest-environment jsdom
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
```

Vitest 4.1 uses the installed Vite 8 instead of bundling its own, so they stay in lockstep.

**What to test (prioritised):**

1. **CSV format detection** — given a fixture file, returns the right adapter. Cheap, high-value, regression magnet as new formats get added.
2. **CSV parser adapters** — each adapter (HomeWizard P1, provider exports) parses a known fixture to the normalised series shape. Property: row count, sum of imports, sum of exports, timestamp monotonicity.
3. **Series merge** — overlapping timestamps from two files: higher-resolution source wins. Property: output resolution >= max input resolution at every bucket.
4. **Bucketing / DST** — explicit fixtures with timestamps spanning the spring-forward (2026-03-29 02:00 → 03:00) and fall-back (2026-10-25 03:00 → 02:00) edges in Europe/Amsterdam. This is the bug class that will burn us if untested.
5. **Battery simulation engine** — given a deterministic short series + battery spec, exact expected kWh shifted. Cover edge cases: battery full mid-day, battery empty overnight, charge-power cap hit, DoD cap hit.
6. **Aggregation helpers** — monthly bars match per-bucket sums.

**What NOT to test (deliberately):** chart rendering pixels (visual regression is high-cost / low-value here); upload-form drag-drop interactions (manual smoke test is enough for v1).

### 6. GitHub Pages Deploy → official `actions/*-pages` chain

**Confidence: HIGH** (verified against the actual `vite/docs/guide/static-deploy-github-pages.yaml` on `main` and against live GitHub release tags for each action on 2026-05-26)

**Repo path convention:** the repo will live at `github.com/<user>/battery-calculator` → site URL `https://<user>.github.io/battery-calculator/`. So `vite.config.ts` needs:

```ts
import { defineConfig } from 'vite';
export default defineConfig({
  base: '/battery-calculator/',
});
```

(If a custom domain is added later, switch to `base: '/'`.)

**The workflow** — drop into `.github/workflows/deploy.yml`, lifted from Vite's current upstream sample:

```yaml
name: Deploy static content to Pages
on:
  push: { branches: ['main'] }
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: lts/*, cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with: { path: './dist' }
      - id: deployment
        uses: actions/deploy-pages@v5
```

**One-time setup:** Repo → Settings → Pages → Source = "GitHub Actions" (not "Deploy from branch"). Without this, the workflow's `deploy-pages` step 404s.

**Do not use** third-party deploy actions (`peaceiris/actions-gh-pages`, `JamesIves/github-pages-deploy-action`, etc.). The official chain is the supported path now that GitHub Pages has first-class Actions deployment.

### 7. File Upload UX → **Native HTML5 drag-and-drop** (no library)

**Confidence: HIGH** (browser API stability + bundle math; FilePond/Uppy assessment from comparison sources)

For "drop one or more CSV files, parse them" the native APIs are sufficient and the smaller libraries are still bigger than the entire rest of our payload:

- `<input type="file" multiple accept=".csv,text/csv">` — gives you a file picker for free, accessible, keyboard-navigable.
- A `<label>` wrapping a drop zone with `dragover` / `drop` event handlers — ~30 lines of TS.
- Per-file progress: drive a per-file progress bar from Papa Parse's `step` callback by tracking `parser.streamer._input.length` or, more reliably, by counting rows against an estimated total from `file.size / averageRowBytes`. Approximate is fine — users want feedback that the parser is alive, not bank-grade accuracy.

**Why not FilePond / Uppy?**
- **FilePond** core is ~45 KB gz; Uppy core ~45 KB and full Dashboard >100 KB. Both target the "upload to a server" use case (chunked, resumable, tus, retries) which is exactly the use case we explicitly don't have — there's no server. Adopting either would more than double total bundle size to solve a problem we don't have.
- **Dropzone** is the closest "looks decent out of the box" lib but still ~25 KB gz and styled in a way that fights any custom CSS.

The 30 lines of vanilla code is a one-time cost and stays under your control.

---

## Alternatives Considered (summary)

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| **uPlot** | Chart.js 4.5.1 | If early users criticise visual polish and you want default-pretty axes/legends without writing them |
| **uPlot** | ECharts 6.1.0 | Only if a future milestone adds 5+ chart types or genuinely huge (>100k point) datasets |
| **uPlot** | Observable Plot | Only inside an Observable notebook context; never for a bundle-sensitive static site |
| **@preact/signals-core** | Lit 3 | If the UI grows to 10+ interactive widgets that benefit from component encapsulation |
| **@date-fns/tz** | `@js-temporal/polyfill` | When Safari ships Temporal (likely 2027); then drop date-fns entirely |
| **papaparse** | Hand-rolled parser | Never — false economy |
| **Native drag-drop** | FilePond | If a future milestone needs image previews, cropping, or paid Pintura editor integration (none of which apply here) |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| **petite-vue** | Last published 2022-01-18; effectively abandoned (npm registry confirmed) | `@preact/signals-core` for state; native DOM for templates |
| **Moment.js** | In maintenance mode since 2020; 70 KB gz; mutable date objects encourage bugs | `date-fns` v4 + `@date-fns/tz` |
| **date-fns-tz** (the legacy `marnusw/date-fns-tz` package, v3.2.0, 2024) | Superseded by official `@date-fns/tz` integrated with date-fns v4; the old package has not been updated in ~18 months | `@date-fns/tz` |
| **Observable Plot for a tiny calculator** | 128 KB gzipped — bigger than every other dependency combined | uPlot |
| **D3 directly** | Wrong level of abstraction for 2 chart types; you'll write more code than the rest of the app | uPlot |
| **FilePond / Uppy / Dropzone** | Built for "upload to a server" — we have no server, and the libs are bigger than our shipped CSV-handling code | Native HTML5 drag-and-drop |
| **Native `Date` for bucketing** | Silently wrong at the March/October DST flips in `Europe/Amsterdam` | `@date-fns/tz` `TZDate` |
| **Temporal polyfill (`@js-temporal/polyfill@0.5.1`) as the primary date layer** | 60 KB gz polyfill that ~33% of users (incl. iOS Safari) will still need to download in 2026 | date-fns v4; revisit Temporal natively in ~2027 |
| **A framework (React/Vue/Svelte) "just for the UI"** | Already excluded by project constraint; signals + DOM is sufficient | `@preact/signals-core` |
| **Third-party GitHub Pages actions** (peaceiris, JamesIves) | Official `actions/*-pages` chain is now the supported, documented path | `configure-pages@v6` + `upload-pages-artifact@v5` + `deploy-pages@v5` |
| **Web Workers via manual `new Worker()` plumbing** | Papa Parse already does this via `worker: true`; Vite has a `?worker` import suffix when we genuinely need a custom one | `Papa.parse(file, { worker: true })` first |

---

## Stack Patterns by Variant

**If first user feedback says "charts look ugly":**
- Add Chart.js 4.5.1 *alongside* uPlot for the bar chart only, or
- Spend a day on uPlot custom styling (axis fonts, grid colours, legend) — usually enough.
- Don't replace wholesale; the time-series chart still belongs to uPlot.

**If file sizes routinely exceed ~5M rows (unlikely for a year of 15-min P1 data ≈ 35k rows):**
- Move the simulation engine into a dedicated Web Worker via Vite's `import Worker from './sim.ts?worker'` syntax. Papa already handles parsing in a worker; this would unblock the simulation pass too.

**If a future milestone adds dynamic pricing:**
- The price stream is another CSV (or fetched on demand from a Tibber/ANWB-style export). Same parsing layer; no new dependency needed.

**If Safari ships Temporal natively (likely 2027):**
- Replace date-fns + `@date-fns/tz` with `Temporal.ZonedDateTime` for ~3 KB net savings and a cleaner API. Single-day refactor at that point because all date math lives in one module.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `vite@^8` | `vitest@^4.1` | Vitest 4.1 explicitly uses the installed Vite 8 instead of bundling its own. Earlier Vitest versions ship their own Vite copy → version skew bugs. |
| `date-fns@^4` | `@date-fns/tz@^1.5` | `@date-fns/tz` was rewritten for date-fns v4; do not mix with date-fns v3. |
| `papaparse@5.x` | `@types/papaparse@5.x` | Major versions track each other; pin both to `^5`. |
| `uplot@1.6.x` | any Vite/TS | Ships its own `.d.ts`. No peer deps. |
| `@preact/signals-core@1.x` | no peer deps | Works standalone; the `@preact/signals` (with React/Preact integration) package is *not* needed. |
| `actions/checkout@v6` + `actions/setup-node@v6` | GitHub-hosted `ubuntu-latest` (Ubuntu 24.04 as of May 2026) | Both are the current major; v6 added Node 22 default. |
| `actions/configure-pages@v6` + `upload-pages-artifact@v5` + `deploy-pages@v5` | Pages source set to "GitHub Actions" | The version asymmetry (`v6`/`v5`/`v5`) is correct — verified against live GitHub release tags 2026-05-26. |

---

## Sources

Authoritative (HIGH confidence):
- npm registry API — version + publish-date lookup for all packages (queried 2026-05-26): `papaparse@5.5.3`, `uplot@1.6.32`, `chart.js@4.5.1`, `vite@8.0.14`, `vitest@4.1.7`, `lit@3.3.3`, `@lit/reactive-element@2.1.2`, `echarts@6.1.0`, `@observablehq/plot@0.6.17`, `@preact/signals-core@1.14.2`, `date-fns@4.3.0`, `date-fns-tz@3.2.0` (legacy), `@date-fns/tz@1.5.0`, `alpinejs@3.15.12`, `petite-vue@0.4.1` (last 2022-01), `@js-temporal/polyfill@0.5.1`.
- GitHub Releases API — actual latest tags for `actions/checkout` (v6.0.2), `actions/setup-node` (v6.4.0), `actions/configure-pages` (v6.0.0), `actions/upload-pages-artifact` (v5.0.0), `actions/deploy-pages` (v5.0.0).
- `vitejs/vite` repo `docs/guide/static-deploy-github-pages.yaml` on `main` — canonical Pages workflow.
- bundlephobia API — gzip sizes for `papaparse`, `uplot`, `chart.js`, `@observablehq/plot`, `lit`.
- [Papa Parse docs](https://www.papaparse.com/docs) — `step` streaming API, File-object support, `delimiter` config, BOM exposure.
- [uPlot README](https://github.com/leeoniya/uPlot) — feature/non-feature list, bundle target.
- [caniuse: Temporal API](https://caniuse.com/temporal) — ~67% native support, Safari not yet shipped.
- [date-fns v4 release blog](https://blog.date-fns.org/v40-with-time-zone-support/) — `TZDate` + `@date-fns/tz` story.

Cross-reference (MEDIUM confidence):
- [Vitest 4.1 announcement](https://vitest.dev/blog/vitest-4-1.html) — Vite 8 co-install behaviour.
- [Vite static deploy guide](https://vite.dev/guide/static-deploy) — Pages workflow shape.
- [Lit signals docs](https://lit.dev/docs/data/signals/) — TC39 signals direction; informs the "signals-core alone is enough" call.
- [Preact signals guide](https://preactjs.com/guide/v10/signals/) — `signal` / `computed` / `effect` API.

Unverified beyond the comparison article (LOW confidence — flagged but non-blocking):
- Specific FilePond / Uppy gzip numbers (cited from one comparison article; the conclusion holds even if numbers are ±50% — both are bigger than our recommended approach).

---

*Stack research for: client-side static calculator (battery-calculator, NL)*
*Researched: 2026-05-26*
