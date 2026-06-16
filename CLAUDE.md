<!-- GSD:project-start source:PROJECT.md -->
## Project

**Battery Calculator**

A simple, fully client-side web app that helps regular Dutch consumers figure out which home battery best fits their home's actual power usage and solar generation. Users upload one or more energy CSV exports (P1 meter, energy provider), pick one or more candidate batteries, and get a comparison of how much energy each battery would have shifted from the grid to self-consumption over the period.

**Core Value:** The user uploads their own real CSV data and gets back a clear, honest comparison of which battery size makes sense for their house — without sending any data anywhere.

### Constraints

- **Tech stack**: Vanilla TypeScript + Vite — chosen for minimal dependencies, easy long-term maintenance, and clean GitHub Pages deploys.
- **Hosting**: GitHub Pages — implies static build output, no server-side code, no environment secrets, no API keys baked in.
- **Privacy**: All CSV parsing and computation must happen in the browser. No network calls with user data, ever. This is both a feature and a hard constraint.
- **Bundle size**: Should remain modest — this is a single-purpose calculator, not an app shell. Battery catalog ships as bundled JSON.
- **Region**: Netherlands-only for v1 — formats, default battery, saldering modeling all assume NL context.
- **Calculation fidelity**: Battery model is capacity + charge/discharge power + round-trip efficiency + depth of discharge. Detailed enough that a small battery can't absorb a midday solar peak, simple enough to explain to a non-engineer.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **vitest** `^4.1.7` | Unit + integration tests | Vitest 4.1 added native Vite 8 support (uses the installed Vite, no second copy). Configure `environment: 'jsdom'` only for the few tests that touch DOM; keep parser/sim tests in pure node env for speed. |
| **@vitest/coverage-v8** `^4.1.x` | Coverage reports | V8 provider is faster than istanbul and ships with Vitest's own version. |
| **@types/papaparse** `^5.x` | TypeScript types for Papa | Papa Parse ships JS; types are a separate package. |
| **eslint** `^9.x` (flat config) + **@typescript-eslint** `^8.x` | Linting | Flat config (`eslint.config.js`) is the only supported format in ESLint 9. |
| **prettier** `^3.x` | Formatting | Pair with `eslint-config-prettier` to disable conflicts. |
| **GitHub Actions** (see workflow below) | Deploy | Use the official `actions/*-pages@v5/v6` chain — no third-party deploy action needed. |
## Installation
# Scaffold (one-time)
# Runtime deps (all shipped to the browser)
# Types + dev tooling
## Library-by-Library Rationale
### 1. CSV Parsing → **papaparse 5.5.3**
- Streams via `step` callback so a 50k-row P1 export never sits in memory as one array.
- `worker: true` moves parsing off the main thread for free — keeps the UI responsive on a large drop.
- `delimiter: ';'` (or `delimiter: ''` for auto-detect) handles the Dutch `;`-delimited variant that providers love.
- Accepts a `File` object directly: `Papa.parse(file, { worker: true, step, complete })` — no FileReader plumbing.
- Zero dependencies. ~6.9 KB gzipped.
- **csv-parse** (Node-first, requires browser shims, larger).
- **PapaParse forks (`sonthanhdan/papa-parse` etc.)** — unmaintained drift; stay on `mholt/PapaParse`.
- **Hand-rolled split-on-comma parser** — guarantees future bugs with quoted fields, escaped quotes, embedded newlines in HomeWizard's German-locale exports.
### 2. Time-Series Date Handling → **date-fns 4 + @date-fns/tz 1.5**
- date-fns v4 is the current line (`4.3.0`, released 2026-05-22). v4 introduced first-class time-zone support via the `@date-fns/tz` companion package, which provides `TZDate` — a `Date` subclass that performs all calculations in a named IANA zone.
- Tree-shakes: you import only `startOfHour`, `addMinutes`, `differenceInMinutes`, etc. Realistic shipped weight is ~3 KB gz.
- IANA database is supplied by the platform `Intl` API — no embedded TZ blob, no monthly bundle bloat to keep up with politicians moving DST rules.
- **Luxon**: ~36 KB gz with embedded TZ data — heavier with no upside over date-fns v4 for our use case.
- **Day.js**: lightweight, but TZ support is plugin-based and historically lossy at DST edges; date-fns's `TZDate` is the safer abstraction for bucketing.
- **Moment**: officially in maintenance mode since 2020; do not use in new code.
### 3. Charting → **uPlot 1.6.32**
| Library | Latest | gzip | Time-series fit | Bars fit | Verdict |
|---|---|---|---|---|---|
| **uPlot 1.6.32** | 2025-03 | **~22 KB** | Excellent — purpose-built | Yes (1.6 added bars) | **Pick** |
| Chart.js 4.5.1 | 2025-10 | ~68 KB | Good, generic | Excellent | Heavier for similar polish |
| ECharts 6.1.0 | 2026-05 | ~130 KB+ (tree-shaken) | Excellent | Excellent | Way overkill for two charts |
| Observable Plot 0.6.17 | 2025-02 | **~128 KB** (pulls d3) | Great DX | Yes | Bundle alone is 4× the rest of the app |
| D3 directly | — | varies | Maximal control | Manual axes | Wrong abstraction level for a 2-chart UI |
- Smallest competent option (~22 KB) and benchmarks better than Chart.js / ECharts for live updates on 1k–10k points — relevant when the user narrows the period and we re-bin.
- Native support for the chart types we need: time-series lines/areas + bars (added in 1.6).
- Plain JS API, no React/Vue baggage; works with vanilla TS unchanged.
- Active: latest commit on `master` is recent, 1500+ commits, single maintainer (Leon Sorokin) who responds on GitHub.
- "No data processing" — we already own that layer (simulation engine).
- "No animations" — calculator users want answers, not transitions.
- "Docs are sparse" — true; budget half a day for the first chart, then it's copy-paste.
### 4. Reactive UI Primitives → **@preact/signals-core 1.14.2** + tagged-template DOM
- **State layer**: `@preact/signals-core` (~1.5 KB gz). Three primitives — `signal`, `computed`, `effect`. No framework adapter needed.
- **Render layer**: plain DOM updates inside `effect()` callbacks, or tagged-template string assignment to `innerHTML` for static-shape regions (sanitized inputs only — all our data is user-uploaded numbers, no XSS surface).
| Option | Why not |
|---|---|
| **Lit 3.3.3** | Excellent (~6 KB gz, web standards, reactive controllers). But components + shadow DOM + decorators are extra ceremony for a 4-control UI. Reach for it if/when the app grows to 10+ widgets. |
| **Alpine.js 3.15.12** | HTML-attribute-driven; great for sprinkles on server-rendered pages. Mismatches a TS-first, computation-heavy app where state lives in JS, not in markup. |
| **petite-vue 0.4.1** | **DEAD** — last published 2022-01-18 (npm registry confirmed). Do not adopt. |
| **Vanilla DOM only** (no signals) | Fine until you add the second interaction, at which point you'll write a signals library badly. Just pay the 1.5 KB up front. |
| **Lit signals (`@lit-labs/signals`)** | Same underlying TC39 Signals proposal but coupled to Lit; without Lit components there's no benefit over `@preact/signals-core`. |
### 5. Testing → **Vitest 4.1.7** (confirmed)
### 6. GitHub Pages Deploy → official `actions/*-pages` chain
### 7. File Upload UX → **Native HTML5 drag-and-drop** (no library)
- `<input type="file" multiple accept=".csv,text/csv">` — gives you a file picker for free, accessible, keyboard-navigable.
- A `<label>` wrapping a drop zone with `dragover` / `drop` event handlers — ~30 lines of TS.
- Per-file progress: drive a per-file progress bar from Papa Parse's `step` callback by tracking `parser.streamer._input.length` or, more reliably, by counting rows against an estimated total from `file.size / averageRowBytes`. Approximate is fine — users want feedback that the parser is alive, not bank-grade accuracy.
- **FilePond** core is ~45 KB gz; Uppy core ~45 KB and full Dashboard >100 KB. Both target the "upload to a server" use case (chunked, resumable, tus, retries) which is exactly the use case we explicitly don't have — there's no server. Adopting either would more than double total bundle size to solve a problem we don't have.
- **Dropzone** is the closest "looks decent out of the box" lib but still ~25 KB gz and styled in a way that fights any custom CSS.
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
## Stack Patterns by Variant
- Add Chart.js 4.5.1 *alongside* uPlot for the bar chart only, or
- Spend a day on uPlot custom styling (axis fonts, grid colours, legend) — usually enough.
- Don't replace wholesale; the time-series chart still belongs to uPlot.
- Move the simulation engine into a dedicated Web Worker via Vite's `import Worker from './sim.ts?worker'` syntax. Papa already handles parsing in a worker; this would unblock the simulation pass too.
- The price stream is another CSV (or fetched on demand from a Tibber/ANWB-style export). Same parsing layer; no new dependency needed.
- Replace date-fns + `@date-fns/tz` with `Temporal.ZonedDateTime` for ~3 KB net savings and a cleaner API. Single-day refactor at that point because all date math lives in one module.
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
| `actions/upload-artifact@v6` + `actions/download-artifact@v7` | used in `deploy.yml` CI→deploy handoff | **Distinct from the Pages chain above.** These are the Node 24 runtime bumps (upload v5 / download v5 & v6 still run Node 20, which GitHub removed from runners 2026-06-16 — do not use them). Latest are upload v7 (adds opt-in direct uploads + ESM) and download v8 (ESM + hash-mismatch-errors-by-default); we stay on v6/v7 as the minimal Node-24 bump with no breaking API changes for the simple `name`+`path` handoff. Do not downgrade to v4. |
## Sources
- npm registry API — version + publish-date lookup for all packages (queried 2026-05-26): `papaparse@5.5.3`, `uplot@1.6.32`, `chart.js@4.5.1`, `vite@8.0.14`, `vitest@4.1.7`, `lit@3.3.3`, `@lit/reactive-element@2.1.2`, `echarts@6.1.0`, `@observablehq/plot@0.6.17`, `@preact/signals-core@1.14.2`, `date-fns@4.3.0`, `date-fns-tz@3.2.0` (legacy), `@date-fns/tz@1.5.0`, `alpinejs@3.15.12`, `petite-vue@0.4.1` (last 2022-01), `@js-temporal/polyfill@0.5.1`.
- GitHub Releases API — actual latest tags for `actions/checkout` (v6.0.2), `actions/setup-node` (v6.4.0), `actions/configure-pages` (v6.0.0), `actions/upload-pages-artifact` (v5.0.0), `actions/deploy-pages` (v5.0.0).
- `vitejs/vite` repo `docs/guide/static-deploy-github-pages.yaml` on `main` — canonical Pages workflow.
- bundlephobia API — gzip sizes for `papaparse`, `uplot`, `chart.js`, `@observablehq/plot`, `lit`.
- [Papa Parse docs](https://www.papaparse.com/docs) — `step` streaming API, File-object support, `delimiter` config, BOM exposure.
- [uPlot README](https://github.com/leeoniya/uPlot) — feature/non-feature list, bundle target.
- [caniuse: Temporal API](https://caniuse.com/temporal) — ~67% native support, Safari not yet shipped.
- [date-fns v4 release blog](https://blog.date-fns.org/v40-with-time-zone-support/) — `TZDate` + `@date-fns/tz` story.
- [Vitest 4.1 announcement](https://vitest.dev/blog/vitest-4-1.html) — Vite 8 co-install behaviour.
- [Vite static deploy guide](https://vite.dev/guide/static-deploy) — Pages workflow shape.
- [Lit signals docs](https://lit.dev/docs/data/signals/) — TC39 signals direction; informs the "signals-core alone is enough" call.
- [Preact signals guide](https://preactjs.com/guide/v10/signals/) — `signal` / `computed` / `effect` API.
- Specific FilePond / Uppy gzip numbers (cited from one comparison article; the conclusion holds even if numbers are ±50% — both are bigger than our recommended approach).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
