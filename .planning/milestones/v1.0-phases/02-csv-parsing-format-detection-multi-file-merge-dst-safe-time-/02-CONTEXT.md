# Phase 2: CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

A pure data layer that turns one or more uploaded HomeWizard P1 CSVs into a
single canonical, DST-safe `IntervalSample[]` — two non-negative fields per
interval (`gridImportKwh` / `gridExportKwh`, never a signed `net`), UTC `Date`
timestamps (Europe/Amsterdam ↔ UTC conversion only inside the parser via
`@date-fns/tz` `TZDate`), declared `series_type` (cumulative vs interval),
multi-file merge where finer resolution wins, a sub-period filter, and a sanity
readout. Delivered via a parser-registry pattern (new formats = one new file,
registered by import side-effect, no central switch). Fixture-locked in CI,
including the 2026-03-29 (92 intervals) and 2026-10-25 (100 intervals) DST days.

This phase **does** ship a minimal interactive UI: the Phase 1 drop-zone mount
point becomes a real drag-drop + always-visible file-picker that parses on drop
(PapaParse `worker: true`) and renders the sanity readout. It does **not** ship
the comparison table, reactive signals state, simulator workers, or any
period-filter UI control — those are Phase 4.

Requirements covered: DATA-01..13 (13 total).

</domain>

<decisions>
## Implementation Decisions

### Phase-2 UI surface
- **D-01:** Phase 2 ships a **real minimal drop-zone + live sanity readout**,
  replacing the bare Phase 1 mount point in place. Drag-drop + an
  always-visible file-picker button (DATA-01); parses on drop and renders the
  readout so the pipeline is human-verifiable end-to-end (criteria 1 & 3).
  Phase 4 later re-wires this region with signals/workers/comparison —
  Phase 2's UI is the throwaway-grade proof, not the final interaction. This
  resolves the roadmap-goal tension ("before any UI exists" vs. "user sees a
  readout") in favor of a minimal, real, replaceable UI.
- **D-02:** The sub-period filter (DATA-12) ships as a **pure, tested function
  only** — `filterByPeriod(samples, start, end)` plus default-to-full-range
  logic. **No interactive date control** this phase; that lands in Phase 4 with
  the reactive state. Criterion 5 is unit-tested, not click-tested, in Phase 2.
- **D-03:** Phase-2 readout labels are **functional Dutch, unpolished**. The
  app is NL-only, so don't ship English that Phase 5's terminology audit must
  rip out — but tone, tooltips, and the full copy/terminology pass are
  explicitly Phase 5's job, not this phase's.

### Gap detection & handling
- **D-04:** A **gap = a missing expected interval at the auto-detected
  cadence.** Infer the dominant cadence (e.g. 15-min) from the data, then any
  empty slot between first and last sample is a gap. **DST-aware**: the
  missing spring-forward hour and the repeated fall-back hour are NOT gaps.
- **D-05:** **Flag-and-count only — never fabricate data.** Gaps are counted
  (and their ranges surfaced in the readout), but `IntervalSample[]` contains
  only real samples. No zero-fill, no synthetic intervals. The simulator
  (Phase 3) sees true data; gaps simply mean less period coverage. No hard
  block on gappy input.

### Bad-data & encoding policy
- **D-06:** **Fail-fast on a malformed row.** A single unparseable row (bad
  number, wrong column count, etc.) aborts that file's parse and surfaces the
  DATA-09 error: file name, row number, column, and expected format. No silent
  partial results — data integrity is treated as sacred over leniency.
- **D-07:** **UTF-8 first, Windows-1252 fallback.** Try UTF-8 (with/without
  BOM per DATA-04); on decode failure, retry as Windows-1252 (the common NL/EU
  legacy encoding) and proceed if it yields clean rows. The **encoding actually
  used is noted in the readout.** If neither decodes cleanly, fail with a
  specific "unsupported file encoding" message.

### Sanity readout honesty
- **D-08:** Beyond the six required DATA-11 fields (file count, total rows,
  date range, total import kWh, total export kWh, gap count), the readout also
  shows, per file: **detected resolution** (15-min / hourly — makes the
  finer-wins merge rule visible), **declared `series_type` + monotonicity-check
  result** (surfaces meter resets / wrong-column errors, DATA-05),
  **first-interval anomaly flag** when it fires (DATA-05 requires anomalies be
  flagged not silently propagated), and **per-file row range in the merge**
  (samples contributed vs. overridden by a finer file — proves DATA-10
  visibly).
- **D-09:** **Suspicious-but-parseable values get soft warnings, never a
  block.** Implausible interval kWh, export at an impossible hour, etc. produce
  a "please sanity-check" note in the readout without altering data or stopping
  the pipeline — consistent with the non-blocking, never-fabricate stance from
  D-05.

### Claude's Discretion
- Exact `IntervalSample` field shape beyond the locked `gridImportKwh` /
  `gridExportKwh` / UTC-`Date` timestamp / `series_type` contract.
- Parser-registry mechanics: how a parser declares it can claim a given file
  (header sniffing strategy), registry data structure, and the noop
  second-parser stub used to prove the registry (criterion 7).
- Worker boundary: PapaParse `worker: true` is required (DATA-13); whether any
  post-parse transform (normalize / merge / DST bucketing) also runs off the
  main thread is left to research/planning (Phase 4 owns the heavier worker
  story).
- Cadence-detection algorithm details and the plausibility thresholds behind
  D-09's soft warnings.
- Minimal drop-zone styling — inherit Phase 1 design tokens; no new system.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project, requirements & roadmap (read first)
- `.planning/REQUIREMENTS.md` — DATA-01..13 full text and traceability (the
  acceptance contract for this phase).
- `.planning/ROADMAP.md` §"Phase 2" — goal + 7 success criteria, plus the
  **Research flag** (needs a real HomeWizard P1 CSV sample to confirm column
  names, unit conventions, and cumulative-vs-15-min-delta column choice;
  encoding-fallback decision — now made in D-07).
- `.planning/PROJECT.md` — constraints (client-side only, no network with user
  data, NL-only) and Key Decisions table (overlap resolution = finer wins;
  P1-derived solar, no separate solar CSV).
- `CLAUDE.md` — **LOCKED stack/versions.** `papaparse@^5.5.3`
  (+ `@types/papaparse@^5`), `date-fns@^4.3.0` + `@date-fns/tz@^1.5.0`,
  Vitest `^4.1.7`, Vite `^8`, TS `~5.6`. See CLAUDE.md §"Library-by-Library
  Rationale" for PapaParse `step`/`worker:true`/`delimiter` usage and the
  `TZDate` DST-bucketing approach. Do not re-research or re-version these.

### Prior-phase decisions carried forward
- `.planning/phases/01-setup-deploy-plumbing-privacy-rules/01-CONTEXT.md` —
  D-01 (3-region shell; drop-zone region is THIS phase's mount point), D-05
  (design tokens to reuse for the minimal readout styling), D-09 (domain-layer
  tests run in **node env**; jsdom only for DOM-contract tests — the minimal
  drop-zone UI is the narrow jsdom exception, parser/merge/DST tests stay node).
  Maximal-lockdown CSP (`connect-src 'none'`) — the parser must NEVER fetch
  anything; all decode/parse is in-browser.

### Sample data (REQUIRED before writing the concrete adapter)
- A real HomeWizard P1 CSV export — not yet in the repo. `/gsd-plan-phase 2`
  must obtain one (from the project owner) to confirm exact column names, unit
  conventions, decimal-comma / `;`-delimiter / DD-MM-YYYY variants, and whether
  the energy columns are cumulative meter totals or per-interval deltas, before
  the HomeWizard adapter is finalized.

No external ADRs or third-party specs beyond the above — requirements are fully
captured in REQUIREMENTS.md and the decisions section.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shell.ts` `renderShell()` — builds the 3-region shell; the
  `main#drop-zone-region` element (currently carrying only the privacy promise)
  is the mount point Phase 2's real drop-zone + readout fill in place. Keep the
  verbatim privacy-promise `<p class="privacy-promise">` intact.
- `src/styles/tokens.css` / `src/styles/global.css` — design-token baseline
  (colors, spacing, system-font stack) to style the minimal readout without a
  new system. No inline `style=` (CSP D-03 forbids it).
- `src/main.ts` — entry point with a double-render guard; wires the drop-zone
  region.

### Established Patterns
- **Test env split (Phase 1 D-09):** domain logic (parsers, merge, DST
  bucketing, gap detection, period filter) → **node** env; DOM-contract tests
  (the drop-zone UI) → **jsdom**. Keep the data layer free of browser globals
  so it runs green under `npm test` from clean Node (mirrors Phase 3 criterion).
- **CSP strictness:** no inline scripts/styles, `connect-src 'none'`. PapaParse
  `worker: true` spins a same-origin worker (a blob/module worker) — confirm it
  doesn't trip the CSP during planning; this is a known integration point.
- Greenfield domain layer: `src/domain/parsers/` does not exist yet — this
  phase establishes the directory + registry pattern that Phase 3's simulator
  and catalog will sit beside.

### Integration Points
- Drop-zone region (`#drop-zone-region`) ← Phase 2 real drop-zone (replaced
  again, richer, in Phase 4).
- The canonical `IntervalSample[]` produced here is the input contract for
  Phase 3's `simulate()` — its field shape (`gridImportKwh`, `gridExportKwh`,
  UTC `Date`) must be stable before Phase 3 starts.
- Runtime deps NOT yet installed (only devDependencies present): this phase
  adds `papaparse`, `@types/papaparse`, `date-fns`, `@date-fns/tz` to
  `package.json`.

</code_context>

<specifics>
## Specific Ideas

- The readout is the phase's honesty surface: it should make the merge rule
  (finer wins), the series classification, and any data anomalies *visible*
  rather than hidden — see D-08. This is more important than its visual polish
  (D-03 defers polish to Phase 5).
- Fail-fast on bad rows (D-06) but robust encoding fallback (D-07) are
  deliberately asymmetric: structural integrity is non-negotiable, but a
  recoverable whole-file decoding issue should "just work" with a noted
  fallback rather than rejecting an otherwise-valid export.
- Criterion 7's registry proof: include a noop second-parser stub that
  exercises the registry with zero edits to any central switch.

</specifics>

<deferred>
## Deferred Ideas

- **Interactive period-filter control (date pickers)** — pure function only in
  Phase 2 (D-02); the UI control lands in Phase 4 with reactive state.
- **Additional NL parser formats** (energy-provider exports beyond HomeWizard
  P1) — the registry is built to accept them one-file-at-a-time, but v1 ships
  only the HomeWizard P1 adapter (DATA-02); more added as sample files are
  collected (PROJECT.md Context).
- **Full Dutch copy / tone / tooltips / terminology audit** — Phase 5.
- **User-driven exclusion of flagged intervals** — considered for D-09 but
  deferred; Phase 2 warns, never lets the user mutate the series (keeps this
  phase's UI state minimal).

None of the above are scope creep into Phase 2 — they are deliberately later.

</deferred>

---

*Phase: 2-CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series*
*Context gathered: 2026-06-08*
