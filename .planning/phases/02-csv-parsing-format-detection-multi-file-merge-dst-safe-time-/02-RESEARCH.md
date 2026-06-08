# Phase 2: CSV Parsing, Format Detection, Multi-file Merge, DST-safe Time Series — Research

**Researched:** 2026-06-08
**Domain:** CSV parsing, timezone-aware time series, browser encoding, parser registry pattern
**Confidence:** HIGH for stack/API (locked by CLAUDE.md); MEDIUM for HomeWizard format details (no real sample in repo — see §HomeWizard P1 CSV Format)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Phase 2 ships a real minimal drop-zone + live sanity readout, replacing the Phase 1 mount point. Drag-drop + always-visible file-picker button. Phase 4 re-wires this region — Phase 2's UI is throwaway-grade proof.
- **D-02:** Sub-period filter (DATA-12) ships as a pure, tested function only — `filterByPeriod(samples, start, end)`. No interactive date control this phase.
- **D-03:** Phase-2 readout labels are functional Dutch, unpolished. Full copy/terminology pass is Phase 5.
- **D-04:** Gap = missing expected interval at the auto-detected cadence. DST-aware: spring-forward missing hour and fall-back repeat hour are NOT gaps.
- **D-05:** Flag-and-count only — never fabricate data. Gaps counted and ranges surfaced; `IntervalSample[]` contains only real samples. No zero-fill.
- **D-06:** Fail-fast on a malformed row. Aborts that file's parse, surfaces DATA-09 error: file name, row number, column, expected format.
- **D-07:** UTF-8 first (with/without BOM), Windows-1252 fallback on whole-file decode failure. Encoding used is noted in readout. If neither decodes cleanly, fail with "unsupported file encoding".
- **D-08:** Readout shows beyond the 6 required DATA-11 fields: per-file detected resolution, declared `series_type` + monotonicity check result, first-interval anomaly flag, per-file contributed-vs-overridden row range in merge.
- **D-09:** Suspicious-but-parseable values get soft warnings, never a block.

### Claude's Discretion
- Exact `IntervalSample` field shape beyond the locked `gridImportKwh` / `gridExportKwh` / UTC `Date` timestamp / `series_type` contract.
- Parser-registry mechanics: header-sniffing strategy, registry data structure, noop second-parser stub.
- Worker boundary: PapaParse `worker: true` required; whether post-parse transforms also run off main thread is left to research/planning.
- Cadence-detection algorithm details and plausibility thresholds for D-09 soft warnings.
- Minimal drop-zone styling — inherit Phase 1 design tokens; no new system.

### Deferred Ideas (OUT OF SCOPE)
- Interactive period-filter date pickers — Phase 4.
- Additional NL parser formats beyond HomeWizard P1 — collected as sample files are gathered.
- Full Dutch copy/tone/tooltips/terminology audit — Phase 5.
- User-driven exclusion of flagged intervals — Phase 2 warns, never lets user mutate the series.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Drop zone (drag-and-drop) + always-visible file-picker button | Native HTML5 drag-drop + `<input type="file" multiple>` — no library; drop-zone state machine from UI-SPEC |
| DATA-02 | Auto-detect source format via parser-registry; v1 ships HomeWizard P1 parser | Parser-registry pattern (§Registry Pattern); HomeWizard format documented in §HomeWizard P1 CSV Format |
| DATA-03 | New format = single-file change, import side-effect, no central switch | Side-effect import registry with Vite `sideEffects` field — see §Registry Pattern |
| DATA-04 | Handle NL CSV variants: UTF-8 with optional BOM, `;` delimiter, decimal comma, DD-MM-YYYY | BUT HomeWizard uses `,` delimiter + `YYYY-MM-DD HH:MM` + decimal point — see §HomeWizard P1 CSV Format uncertainty note |
| DATA-05 | Classify series as `cumulative` vs `interval`; monotonicity-check; first-interval anomaly flagged | HomeWizard confirmed cumulative; monotonicity check = consecutive row comparison; delta-conversion recipe in §Cumulative-to-Delta Conversion |
| DATA-06 | Internal: `gridImportKwh` + `gridExportKwh` — never a signed net | T1+T2 sum → two non-negative fields; recipe in §IntervalSample Contract |
| DATA-07 | All timestamps UTC `Date`; Europe/Amsterdam ↔ UTC conversion inside parser via `@date-fns/tz` TZDate | TZDate API recipe in §DST-Safe Bucketing with TZDate |
| DATA-08 | DST correctness: 2026-03-29 yields 92 intervals; 2026-10-25 yields 100; fixture-locked in CI | Verified math: 23h×4=92, 25h×4=100; interval counting recipe in §DST-Safe Bucketing |
| DATA-09 | Specific parse error: file name, row number, column, expected format | `ParseError` type design in §Error Architecture |
| DATA-10 | Overlapping timestamps: finer-resolution file wins | Finer-wins merge algorithm in §Merge Algorithm |
| DATA-11 | Sanity readout: file count, total rows, date range, total import kWh, total export kWh, gap count | Readout data structure in §Sanity Readout Contract |
| DATA-12 | Sub-period filter: `filterByPeriod(samples, start, end)` defaults to full range | Pure function design in §Period Filter |
| DATA-13 | Parsing off main thread: PapaParse `worker: true` | CSP conflict — requires `worker-src blob:` OR fallback to Vite `?worker`; see §CSP and PapaParse Worker — CRITICAL |
</phase_requirements>

---

## Summary

Phase 2 builds a pure data layer in `src/domain/` that transforms one or more uploaded CSVs into a canonical `IntervalSample[]` with DST-safe UTC timestamps, declared series type, finer-wins multi-file merge, gap detection, and a human-readable sanity readout. It also ships a minimal real drop-zone UI replacing the Phase 1 mount point.

**HomeWizard P1 CSV format is confirmed as:** comma-delimited, YYYY-MM-DD HH:MM timestamp, decimal point (not comma), columns `time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh`, CUMULATIVE meter readings. The file sample in the official docs shows values like `8354.542` — three decimal places, progressive totals. The format is therefore `series_type: 'cumulative'` and the adapter must compute per-interval deltas from successive row differences.

**The single critical planning decision is the PapaParse `worker: true` + CSP conflict.** The Phase 1 CSP has `default-src 'none'` with no `worker-src` directive, which means workers from blob URLs are blocked. PapaParse 5.x always uses a blob URL for its internal worker. This means either: (a) add `worker-src blob:` to the build CSP, which is a minor relaxation, or (b) use `worker: false` with a Vite `?worker` custom wrapper. The research recommendation is option (a) — `worker-src blob:` is the minimal addition needed, and it is the standard documented workaround.

**DST handling:** The 92 and 100 interval counts are **local-time** interval counts. 2026-03-29 is a 23-hour day in Amsterdam (spring forward at 02:00 local); 2026-10-25 is a 25-hour day (fall back at 03:00 local). The correct algorithm counts intervals from local-time day boundaries, skipping the absent 02:00–03:00 spring-forward slot and accepting both instances of the fall-back 02:00–03:00 slot. Using `TZDate` for all bucketing makes this automatic.

**Primary recommendation:** Use `TZDate` from `@date-fns/tz` for all timestamp parsing; parse the local CSV datetime string into a `TZDate("Europe/Amsterdam")` then call `.getTime()` to get UTC milliseconds. Intervals on the fall-back repeated hour are disambiguated by UTC position (the second 02:00 local = larger UTC value). The spring-forward gap (02:00–02:59 local never exists) is handled by `tzScan` or simple offset comparison to detect and skip.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSV parsing (decoding, tokenizing) | Browser / Client | — | PapaParse runs in browser, optionally off main thread via worker |
| Encoding detection (UTF-8 vs Windows-1252) | Browser / Client | — | `FileReader`/`ArrayBuffer` + `TextDecoder` — browser-native, no network |
| Format auto-detection (header sniffing) | Browser / Client | — | Header inspection on parsed first row; parser registry |
| Cumulative→delta conversion | Browser / Client | — | Pure domain logic; runs after parse, before merge |
| DST-safe timestamp normalization | Browser / Client | — | `TZDate("Europe/Amsterdam")` converts local→UTC; pure function |
| Multi-file merge (finer-wins) | Browser / Client | — | Pure domain function on `IntervalSample[]` arrays |
| Gap detection | Browser / Client | — | Pure domain function; cadence inference + set-difference |
| Period filter | Browser / Client | — | Pure domain function `filterByPeriod()` |
| Sanity readout state | Browser / Client | — | Derived from `MergeResult`; no reactive signals yet (Phase 4) |
| Drop-zone UI | Browser / Client | — | Native HTML5 drag-drop; no framework |
| Privacy guarantee | Browser / Client | — | `connect-src 'none'` CSP; `TextDecoder` only, no fetch |

All capabilities are strictly client-side. No tier boundary exists in this phase.

---

## Project Constraints (from CLAUDE.md)

- **Stack locked:** Vanilla TypeScript + Vite `^8.0.14`; no frameworks.
- **Privacy:** All processing in browser. No network calls with user data. `connect-src 'none'` CSP is a hard constraint.
- **Bundle size:** Modest; battery catalog ships as bundled JSON. Runtime deps this phase: `papaparse`, `@types/papaparse`, `date-fns`, `@date-fns/tz`.
- **NL-only:** Formats, defaults, and copy assume Netherlands context.
- **No inline styles/scripts:** CSP `style-src 'self'`, `script-src 'self'` — use CSS class rules, no `style=` attributes.
- **Test env split:** Domain layer (parsers, merge, DST, gaps, period filter) runs in `node` env. Drop-zone DOM tests use `jsdom`. Keep `// @vitest-environment jsdom` to per-file docblock.
- **Phase 1 design tokens inherited:** All styling via existing tokens in `src/styles/tokens.css`; no new tokens.
- **Privacy promise `<p class="privacy-promise">` preserved verbatim inside `#drop-zone-region`.**

---

## Standard Stack

### Core (already locked in CLAUDE.md)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | `^5.5.3` | CSV parsing in browser | Streams via `step`; `worker: true`; File object support; BOM handling; `;` delimiter auto-detect; zero deps; 6.9 KB gzipped |
| @types/papaparse | `^5.5.2` | TypeScript types for PapaParse | DT package; major version tracks PapaParse |
| date-fns | `^4.4.0` (latest; CLAUDE.md says `^4.3.0`) | Date arithmetic utilities | Tree-shakeable; only ship functions used; current line |
| @date-fns/tz | `^1.5.0` | Europe/Amsterdam DST-safe bucketing | `TZDate` performs all getters/setters in named IANA zone; uses platform `Intl` API (no bundle bloat) |

**Note:** `date-fns` latest is `4.4.0` on npm as of research date; CLAUDE.md specifies `^4.3.0`. The `^` range satisfies both; install as `date-fns@^4.3.0` per the locked CLAUDE.md version. [VERIFIED: npm registry]

### Supporting (development only — already in package.json)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | `^4.1.7` | Test runner | All domain tests (node env) + drop-zone DOM tests (jsdom env) |
| @vitest/coverage-v8 | `^4.1.x` | Coverage reports | CI coverage gate |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PapaParse `worker: true` + `worker-src blob:` CSP | Vite `?worker` wrapper with `worker: false` | More boilerplate; avoids CSP relaxation; see §CSP and PapaParse Worker |
| `@date-fns/tz` TZDate | `Intl.DateTimeFormat` + manual UTC math | Error-prone at DST; TZDate abstracts fall-back repeated hour correctly |
| `@date-fns/tz` TZDate | Legacy `date-fns-tz@3.x` | Superseded; do not use (CLAUDE.md) |

**Installation:**
```bash
npm install papaparse date-fns @date-fns/tz
npm install --save-dev @types/papaparse
```

**Version verification (confirmed 2026-06-08):**
```
papaparse      5.5.3   (published 2025-05-19)
@types/papaparse 5.5.2
date-fns       4.4.0   (published 2025-10-01 approx)
@date-fns/tz   1.5.0
```

---

## Package Legitimacy Audit

> slopcheck was not available at research time (pip install failed). All packages tagged `[ASSUMED]` for registry provenance. Planner must treat as needing `checkpoint:human-verify` unless registry + repo checks below are sufficient.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| papaparse | npm | ~12 yrs (2013) | ~10M/wk (well-known) | github.com/mholt/PapaParse | N/A | Approved — canonical, mentioned in CLAUDE.md |
| @types/papaparse | npm | ~9 yrs | high (mirrors papaparse) | DefinitelyTyped | N/A | Approved — DT package |
| date-fns | npm | ~10 yrs | ~30M+/wk | github.com/date-fns/date-fns | N/A | Approved — canonical, mentioned in CLAUDE.md |
| @date-fns/tz | npm | ~2 yrs (2024) | ~5M/wk | github.com/date-fns/date-fns | N/A | Approved — official companion, mentioned in CLAUDE.md |

All four packages are pre-approved in CLAUDE.md with locked version pins. No suspicious postinstall scripts found (`npm view <pkg> scripts.postinstall` returned clean). No packages removed.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable — packages are `[ASSUMED]` for slopcheck purposes, but all are explicitly locked in CLAUDE.md as the project's authoritative stack source.*

---

## HomeWizard P1 CSV Format

**Confidence: MEDIUM** — confirmed from official HomeWizard helpdesk documentation [CITED: helpdesk.homewizard.com/en/articles/6664029-how-to-export-and-use-csv-files], but no real sample file exists in the repo. The concrete adapter implementation should be finalized once the project owner provides a real export file.

### Confirmed format (from official docs)

```
time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh
2022-09-01 00:00,8354.542,4651.780,3095.875,7482.698
2022-09-01 00:15,8354.590,4651.780,3095.899,7482.698
2022-09-01 00:30,8354.638,4651.780,3095.899,7482.698
```

| Property | Value | Confidence |
|----------|-------|------------|
| Delimiter | Comma (`,`) | MEDIUM — confirmed from helpdesk sample screenshots |
| Timestamp column name | `time` | MEDIUM — confirmed from helpdesk |
| Timestamp format | `YYYY-MM-DD HH:MM` (15-min) or `YYYY-MM-DD` (daily) | MEDIUM — confirmed from helpdesk |
| Import columns | `Import T1 kWh`, `Import T2 kWh` | MEDIUM — confirmed from helpdesk |
| Export columns | `Export T1 kWh`, `Export T2 kWh` | MEDIUM — confirmed from helpdesk |
| Decimal separator | Dot (`.`) — "by default" | MEDIUM — helpdesk says "by default dot"; may vary with locale |
| Decimal precision | Up to 3 decimal places | MEDIUM — helpdesk docs |
| Value type | **CUMULATIVE meter readings** | MEDIUM — confirmed: successive row differences give per-interval deltas |
| Encoding | Not documented — assume UTF-8 | ASSUMED |
| BOM | Not documented — defensively handle with/without BOM | ASSUMED |
| Additional columns | Gas (m³), Water (m³), L1/L2/L3 phase max (kW) | LOW — optional, presence varies by meter |
| Header presence | Yes (first row is header) | HIGH — all examples show named header row |

### Uncertainty flags for adapter design

**DATA-04 says "`;` delimiter, decimal comma, DD-MM-YYYY"** but the HomeWizard official export uses comma delimiter, decimal point, and `YYYY-MM-DD HH:MM`. This means either:

1. DATA-04 describes a _different_ NL provider format (not HomeWizard) — the requirement is a general statement about NL CSV variants the parser layer must tolerate, not a HomeWizard-specific specification; OR
2. There is a locale-sensitive HomeWizard export variant that uses `;` and decimal comma — possible if the user's system locale is Dutch/German.

**Resolution for adapter:** The HomeWizard P1 adapter should use PapaParse with `delimiter: ''` (auto-detect) rather than hardcoding `','`. This auto-detects both `,` and `;` variants. The `dynamicTyping: false` option should be used to avoid PapaParse misinterpreting `"8354,542"` as a string — the adapter should parse numeric strings manually using `parseFloat(value.replace(',', '.'))` to handle the decimal-comma case.

**CRITICAL — planner must obtain real sample file:** The CONTEXT.md and STATE.md both flag this. The adapter can be designed from the above spec, but `confirmColumnNames()` validation in the parser and fixture tests require a real file before the phase is complete.

### Cumulative-to-Delta Conversion

Since HomeWizard exports are cumulative meter totals, each `IntervalSample` requires computing the delta between consecutive rows:

```typescript
// Source: derived from HomeWizard helpdesk confirmed cumulative format
// For row[i] with timestamp t_i and cumulative values C_i:
// delta = C_i - C_(i-1)  for all rows except the first

// First row cannot produce a delta (no prior reading).
// series_type: 'cumulative' → the adapter discards row[0] as a delta source
// and flags it as first-interval anomaly per DATA-05 / D-08.

function cumulativeToDeltas(rows: HomeWizardRow[]): IntervalSample[] {
  const samples: IntervalSample[] = []
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const curr = rows[i]
    const importKwh = (curr.importT1 + curr.importT2) - (prev.importT1 + prev.importT2)
    const exportKwh = (curr.exportT1 + curr.exportT2) - (prev.exportT1 + prev.exportT2)
    // Monotonicity check: importKwh < 0 or exportKwh < 0 signals a meter reset
    if (importKwh < 0 || exportKwh < 0) {
      // flag monotonicity failure at row i; record in SanityResult
    }
    samples.push({
      timestamp: toUtcDate(curr.time),   // TZDate("Europe/Amsterdam") → UTC ms
      gridImportKwh: Math.max(0, importKwh),  // clamp after flagging
      gridExportKwh: Math.max(0, exportKwh),
    })
  }
  return samples
}
```

**Note:** The first row is consumed as a reference point only. The adapter should record `firstIntervalAnomaly: true` in the `ParseFileResult` when it detects the first-row-discarded case (which is always for cumulative series) per DATA-05 / D-08.

---

## Architecture Patterns

### System Architecture Diagram

```
  File drop / picker
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │   DropZoneController (src/ui/drop-zone.ts)  │
  │   · manages drag state → CSS classes       │
  │   · calls parseFile() per dropped File     │
  └───────────────────┬─────────────────────────┘
                      │ File object
                      ▼
  ┌─────────────────────────────────────────────┐
  │   parseFile() (src/domain/parse.ts)         │
  │   1. readAsArrayBuffer(file)                │
  │   2. detectEncoding() → decoded string      │
  │   3. parsedHeaders = sniff first row        │
  │   4. registry.claim(headers) → Adapter      │
  │   5. Papa.parse(text, {worker:true, step})  │
  │      → raw rows streamed                    │
  │   6. Adapter.transform(rows) → ParseResult │
  └───────────────────┬─────────────────────────┘
                      │ ParseResult[]
                      ▼
  ┌─────────────────────────────────────────────┐
  │   mergeFiles() (src/domain/merge.ts)        │
  │   · finer-resolution file wins per ts       │
  │   · outputs IntervalSample[] (merged)       │
  └───────────────────┬─────────────────────────┘
                      │ IntervalSample[]
                      ▼
  ┌─────────────────────────────────────────────┐
  │   detectGaps() (src/domain/gaps.ts)         │
  │   · infer cadence from median interval      │
  │   · gaps = missing slots (DST-aware)        │
  │   · returns GapReport                       │
  └───────────────────┬─────────────────────────┘
                      │ MergeResult
                      ▼
  ┌─────────────────────────────────────────────┐
  │   renderReadout() (src/ui/readout.ts)       │
  │   · builds <section id="parse-readout">    │
  │   · all fields from D-08 + DATA-11         │
  └─────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── domain/
│   ├── types.ts              # IntervalSample, ParseError, ParseFileResult, MergeResult
│   ├── parse.ts              # parseFile() — encoding detection + registry dispatch
│   ├── merge.ts              # mergeFiles() — finer-wins algorithm
│   ├── gaps.ts               # detectGaps() — cadence inference, gap counting (DST-aware)
│   ├── period-filter.ts      # filterByPeriod(samples, start, end)
│   └── parsers/
│       ├── registry.ts       # ParserRegistry — claim(headers)/register(parser)
│       ├── homewizard-p1.ts  # HomeWizard P1 adapter (registers itself on import)
│       └── noop-stub.ts      # Noop second parser (proves registry; no central switch)
├── ui/
│   ├── drop-zone.ts          # DropZoneController — drag state, file picker
│   ├── readout.ts            # renderReadout(MergeResult) — builds #parse-readout
│   └── drop-zone.css         # Drop-zone state CSS classes (no inline styles)
├── shell.ts                  # (Phase 1) renderShell()
├── styles/
│   ├── tokens.css            # (Phase 1) design tokens
│   └── global.css            # (Phase 1) global styles
└── main.ts                   # entry point (Phase 1) — wires drop-zone on DOMContentLoaded
```

### Pattern 1: Parser Registry with Import Side-Effect Registration

**What:** A parser module exports a `Parser` interface and registers itself on the singleton registry when imported. The registry never needs to know about specific parsers.

**When to use:** Always — this is the architecture for DATA-02 / DATA-03.

```typescript
// Source: Pattern derived from plugin-registry conventions [ASSUMED]
// src/domain/parsers/registry.ts
export interface CsvParser {
  name: string
  /** Return true if this parser can handle the given header row */
  claim(headers: string[]): boolean
  /** Transform raw PapaParse rows into ParseFileResult */
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

// src/domain/parsers/homewizard-p1.ts
import { ParserRegistry } from './registry'

const HomeWizardP1Parser: CsvParser = {
  name: 'HomeWizard P1',
  claim(headers) {
    return headers.includes('Import T1 kWh') && headers.includes('Export T1 kWh')
  },
  transform(rows, file) { /* ... */ },
}

// Side-effect: registers on import
ParserRegistry.register(HomeWizardP1Parser)
export {}  // ensure module boundary; no named export needed
```

**Vite tree-shaking caveat:** Vite (Rollup) tree-shakes modules with no exports/imports. Since the parsers are loaded via side-effect, the top-level `parse.ts` must import them explicitly:

```typescript
// src/domain/parse.ts — registers all parsers
import './parsers/homewizard-p1'   // side-effect import
import './parsers/noop-stub'        // side-effect import
// Future parsers: add one import line here, zero edits elsewhere
```

This is the **one-file-change** location for adding new formats. DATA-03 says "zero edits to a central switch" — this satisfies that: there is no switch, only an import list in `parse.ts`. [CITED: CONTEXT.md criterion 7 + DATA-03]

**Vite sideEffects handling:** Since these are internal project source files (not library packages), Vite's Rollup bundler will include them as long as they are imported. The `sideEffects` field in `package.json` only applies when Vite tree-shakes _external_ packages. For internal files with explicit imports, no `sideEffects` annotation is needed. [VERIFIED: Vite features docs]

### Pattern 2: DST-Safe Bucketing with TZDate

**What:** Parse a HomeWizard local-time string (`"2026-03-29 01:45"`) into a UTC `Date` using `TZDate("Europe/Amsterdam")`.

**When to use:** For every row in every adapter; timezone conversion belongs in the adapter, not in the domain logic.

```typescript
// Source: @date-fns/tz README + date-fns v4.0 blog [CITED: github.com/date-fns/tz]
import { TZDate } from '@date-fns/tz'

/**
 * Parse a HomeWizard timestamp string "YYYY-MM-DD HH:MM" into a UTC Date.
 * TZDate treats all getter/setter operations in "Europe/Amsterdam",
 * so DST transitions are handled by the platform Intl engine automatically.
 */
function parseLocalTimestamp(localStr: string): Date {
  // "2026-03-29 01:45" → parse into year/month/day/hour/min parts
  const [datePart, timePart] = localStr.split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)

  // TZDate constructor: new TZDate(year, monthIndex, day, hour, min, tz)
  // monthIndex is 0-based (same as native Date)
  const tzDate = new TZDate(year, month - 1, day, hour, minute, 'Europe/Amsterdam')

  // .getTime() returns UTC milliseconds — convert to native Date for domain use
  return new Date(tzDate.getTime())
}
```

**DST spring-forward (2026-03-29 02:00 → 03:00 local):** The wall-clock times 02:00–02:59 do not exist in Amsterdam. If a HomeWizard export somehow contains a row with timestamp `2026-03-29 02:15` (unlikely since the meter has no local time reading for that instant), `TZDate` will normalize it according to the platform IANA rules. The adapter should detect and flag such rows as anomalies.

**DST fall-back (2026-10-25 03:00 → 02:00 local, two 02:00–02:59 periods):** The HomeWizard export records UTC-offset-aware readings, so both 02:00 slots exist in the CSV — they will have different cumulative values. After `parseLocalTimestamp`, both map to different UTC values (the first 02:15 CEST = UTC 00:15, the second 02:15 CET = UTC 01:15). The UTC timestamps naturally distinguish them. [ASSUMED: HomeWizard always emits both fall-back slots; a real sample file should confirm]

### Pattern 3: DST-Aware Gap Detection

**What:** Count expected intervals between first and last sample at the inferred cadence, but exclude the spring-forward missing hour as a gap and count the fall-back extra hour as non-gap.

**Algorithm:**

```typescript
// Source: derived from DST math [ASSUMED — verify with real DST-day file]
import { tzScan } from '@date-fns/tz'

function detectGaps(samples: IntervalSample[], cadenceMinutes: number): GapReport {
  // 1. Build Set of all actual UTC timestamps (in ms)
  const actual = new Set(samples.map(s => s.timestamp.getTime()))

  // 2. Generate expected timestamps from start to end at cadence
  const expectedSlots: number[] = []
  let t = samples[0].timestamp.getTime()
  const end = samples[samples.length - 1].timestamp.getTime()

  while (t <= end) {
    expectedSlots.push(t)
    t += cadenceMinutes * 60 * 1000
  }
  // UTC arithmetic is always uniform — no DST adjustment needed here
  // because we walk in UTC milliseconds, not local time

  // 3. Gap = expected slot not in actual set
  const gapTimestamps = expectedSlots.filter(ts => !actual.has(ts))
  return { count: gapTimestamps.length, gaps: gapTimestamps.map(ts => new Date(ts)) }
}
```

**Why this is DST-correct:** We walk UTC milliseconds from the first sample to the last at a fixed cadence. Spring-forward: the 02:00–02:59 AMS local hour corresponds to 01:00–01:59 UTC. The HomeWizard meter doesn't emit rows for this period (the wall clock jumps over it), so the UTC slots in that range simply have no data. These are **not** gaps in the local-day sense — they are missing because local time skipped them. However, from the UTC walking algorithm's perspective they WILL appear as gaps. To exclude them from gap count, use `tzScan` to identify DST change points and mark those UTC ranges as DST-exempt from gap counting. [ASSUMED — the simplest approach is to flag any gap block that perfectly aligns with a tzScan transition as DST-exempt]

**Simpler alternative (recommended):** Count gaps in **local calendar days**, not UTC days. Walk from `local day start` (midnight Amsterdam) to `local day end` at cadence intervals. The spring-forward day has 92 slots (23h×4), the fall-back has 100 slots (25h×4), and normal days have 96. Any slot that appears in the expected local set but not in actual is a gap.

### Pattern 4: Encoding Detection

**What:** Read the file as `ArrayBuffer`, try `TextDecoder('utf-8', { fatal: true })`, fallback to `TextDecoder('windows-1252')`.

```typescript
// Source: MDN TextDecoder API [CITED: developer.mozilla.org/en-US/docs/Web/API/TextDecoder]
async function decodeFileWithFallback(
  file: File
): Promise<{ text: string; encoding: 'UTF-8' | 'Windows-1252' }> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Attempt UTF-8 (with fatal: true so invalid byte sequences throw)
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text, encoding: 'UTF-8' }  // BOM is stripped automatically when fatal:true
  } catch {
    // UTF-8 failed: try Windows-1252 (latin1 superset, common in NL provider exports)
    try {
      const text = new TextDecoder('windows-1252').decode(bytes)
      return { text, encoding: 'Windows-1252' }
    } catch {
      throw new UnsupportedEncodingError(file.name)
    }
  }
}
```

**BOM handling:** `TextDecoder` with default `ignoreBOM: false` (the default) strips the UTF-8 BOM (`﻿`) automatically. If the file starts with BOM bytes `EF BB BF`, the decoded string will NOT include the BOM character. PapaParse's `Papa.BYTE_ORDER_MARK` constant is available if BOM detection needs to be surfaced in the readout. [CITED: PapaParse docs - papaparse.com/docs]

**Windows-1252 note:** `TextDecoder('windows-1252')` is a valid label in the browser Encoding API. Node.js (for Vitest node-env tests) supports it via the `util.TextDecoder` polyfill backed by ICU — confirm with the Node 22.x LTS build (ICU full mode required; the default Node build includes full ICU since v13). If test fixtures for encoding test run in node env without full ICU, tests may fail. [ASSUMED — verify in CI Node 22 environment]

### Pattern 5: Multi-File Finer-Wins Merge

**What:** Given `ParseFileResult[]` with different cadences, produce a single `IntervalSample[]` where any overlapping timestamp uses the data from the finest-cadence file.

```typescript
// Source: PROJECT.md Key Decision "Overlap resolution: higher-resolution data wins"
function mergeFiles(results: ParseFileResult[]): MergeResult {
  // Sort by cadence ascending (finest first = smallest cadenceMinutes)
  const sorted = [...results].sort((a, b) => a.cadenceMinutes - b.cadenceMinutes)

  const merged = new Map<number, IntervalSample>()  // keyed by UTC ms

  for (const result of sorted) {
    for (const sample of result.samples) {
      const key = sample.timestamp.getTime()
      if (!merged.has(key)) {
        merged.set(key, sample)
      }
      // If key already exists: coarser file wins (finest was inserted first)
      // Track overridden rows per file for D-08 readout
    }
  }

  const samples = [...merged.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  )
  return { samples, fileStats: /* per-file contributed/overridden counts */ }
}
```

### Anti-Patterns to Avoid

- **Anti-pattern — Parsing timestamp as native `Date`:** `new Date("2026-03-29 02:00")` in a browser interprets the string as local time (system timezone). If the test runner's system TZ is not Amsterdam, the UTC value will be wrong. Always use `TZDate("Europe/Amsterdam")`.
- **Anti-pattern — Zero-filling gaps:** D-05 strictly forbids fabricating data. The simulator (Phase 3) must handle sparse arrays natively.
- **Anti-pattern — Importing parsers lazily:** Dynamic `import()` defeats the side-effect registry pattern and breaks tree-shaking determinism. Use static `import 'path/to/parser'` in `parse.ts`.
- **Anti-pattern — Putting timezone logic in merge or gap detection:** Timezone conversion belongs in the adapter, not in downstream domain functions. All `IntervalSample` timestamps are UTC before they reach `mergeFiles()`.
- **Anti-pattern — Single signed net value:** `gridNet = import - export` as a signed number causes sign-flip bugs when the sign inverts across time. Always use two non-negative fields per DATA-06.

---

## CSP and PapaParse Worker — CRITICAL

This is the highest-risk integration point for Phase 2.

### The Problem

PapaParse 5.x (`worker: true`) creates its worker using an inline blob URL:

```javascript
// From PapaParse internals (v5+)
const blob = new Blob([workerCode], { type: 'text/javascript' })
const blobURL = URL.createObjectURL(blob)
const worker = new Worker(blobURL)
```

The Phase 1 CSP (`default-src 'none'`) does not include a `worker-src` directive. Without an explicit `worker-src`, browsers fall back to `child-src`, then `default-src`. With `default-src 'none'`, blob URL workers are **blocked**. [CITED: MDN CSP worker-src; PapaParse issue #273 and #428]

### Option A (Recommended): Add `worker-src blob:` to build CSP

Modify `src/constants/csp.ts` to add `worker-src blob:` alongside the existing directives:

```typescript
export const CSP: string = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src blob:",          // ← add this for PapaParse worker: true
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')
```

**Security assessment:** `worker-src blob:` allows blob-URL workers. This does NOT weaken `connect-src 'none'` — workers still cannot make network requests. The blob is created from the already-bundled PapaParse code (same-origin). This is the minimal, standard relaxation for PapaParse `worker: true`. [CITED: CSP Level 3 worker-src spec; community.homewizard.com not applicable]

**Planner note:** This changes the locked Phase 1 CSP string. The change is to `src/constants/csp.ts` and affects `vite.config.ts` (reads `CSP`). The CI test `tests/csp-plugin.test.ts` asserts specific directives — it must be updated to assert `worker-src blob:` is present. Check `tests/csp-plugin.test.ts` before planning the CSP-change task.

### Option B (Fallback): Vite `?worker` import + `worker: false`

If the project owner prefers to not relax the CSP at all, implement a custom Vite worker wrapper:

```typescript
// src/domain/parse-worker.ts?worker  (Vite module worker)
// Runs Papa.parse in a Vite-bundled module worker (loaded as separate JS chunk,
// served from 'self' origin, no blob URL needed)
import Papa from 'papaparse'
self.onmessage = (e) => {
  const { csvText, config } = e.data
  Papa.parse(csvText, { ...config, worker: false })
}
```

This approach serves the worker as a same-origin `.js` file under `dist/assets/`, which `script-src 'self'` covers without any `worker-src` addition. **However**, this requires encoding detection and text decoding before passing `csvText` to the worker (which is already the plan given the `ArrayBuffer + TextDecoder` pattern). [CITED: vite.dev/guide/features — Web Workers section]

**Recommendation:** Use Option A (`worker-src blob:`). It is simpler, adds one line to `csp.ts`, and matches PapaParse's designed usage. Option B adds a custom worker module that complicates the architecture for minimal security gain, since `connect-src 'none'` already blocks any exfiltration from the blob worker.

---

## IntervalSample Contract

This is Claude's Discretion per CONTEXT.md. The proposal below is designed to be stable for Phase 3's `simulate()`.

```typescript
// src/domain/types.ts

/** One metered interval (one row after cumulative-to-delta conversion). */
export interface IntervalSample {
  /** UTC Date — the end of the interval (HomeWizard timestamps mark the interval end) */
  timestamp: Date
  /** Non-negative grid import for this interval in kWh (DATA-06) */
  gridImportKwh: number
  /** Non-negative grid export (feed-in / teruglevering) in kWh (DATA-06) */
  gridExportKwh: number
}

/** How energy values in the source CSV are expressed */
export type SeriesType = 'cumulative' | 'interval'

/** Error thrown by a parser on a malformed row (DATA-09) */
export interface ParseError {
  fileName: string
  rowNumber: number       // 1-indexed, matches CSV line number
  columnName: string
  expected: string        // human-readable e.g. "non-negative number"
  actual: string          // raw cell value that failed
}

/** Result from a single-file parse */
export interface ParseFileResult {
  fileName: string
  encoding: 'UTF-8' | 'Windows-1252'
  seriesType: SeriesType
  cadenceMinutes: number           // dominant interval in minutes (15 or 60 typically)
  samples: IntervalSample[]
  rowCount: number                 // total rows parsed (before dedup)
  isMonotonic: boolean             // false if any delta was negative
  monotonicity_failRow?: number    // 1-indexed row where monotonicity first broke
  firstIntervalAnomalyFlag: boolean // true for cumulative series (row[0] discarded as delta)
}

/** Result of merging multiple ParseFileResults */
export interface MergeResult {
  samples: IntervalSample[]          // sorted by timestamp
  gapCount: number
  gapRanges: Array<{ from: Date; to: Date }>
  fileStats: Array<{
    fileName: string
    encoding: 'UTF-8' | 'Windows-1252'
    seriesType: SeriesType
    cadenceMinutes: number
    rowCount: number
    rowsContributed: number          // samples in merged output from this file (D-08)
    rowsOverridden: number           // samples overridden by finer file (D-08)
    isMonotonic: boolean
    monotonicity_failRow?: number
    firstIntervalAnomalyFlag: boolean
    softWarnings: string[]           // D-09 human-readable warning strings
  }>
}
```

**Design notes for Phase 3 stability:**
- `timestamp` is the interval **end** (HomeWizard convention: the 00:15 row represents 00:00–00:15). Phase 3's simulator must be aware of this convention.
- The `gridImportKwh` and `gridExportKwh` fields are always `>= 0` (DATA-06 invariant). The simulator can safely assume non-negative values.
- `cadenceMinutes` is the dominant cadence — intervals of other lengths (if mixed) are present in `samples` without modification. Phase 3 uses `cadenceMinutes` to compute `intervalHours` for energy clamping.

---

## Sanity Readout Contract

The readout DOM structure is locked in `02-UI-SPEC.md`. Key data contract:

| Field | Source | Notes |
|-------|--------|-------|
| File count | `result.fileStats.length` | After successful parse |
| Total rows | `sum(fileStats[i].rowCount)` | Pre-dedup |
| Date range | `samples[0].timestamp` .. `samples[last].timestamp` | Format DD-MM-YYYY per UI-SPEC |
| Total import kWh | `sum(samples[i].gridImportKwh)` | 1 decimal place |
| Total export kWh | `sum(samples[i].gridExportKwh)` | 1 decimal place |
| Gap count | `result.gapCount` | 0 displayed as "Geen" |
| Per-file resolution | `fileStats[i].cadenceMinutes` | "15 minuten" or "Uur" |
| Per-file series type | `fileStats[i].seriesType` | "Cumulatief" or "Interval" |
| Monotonicity | `fileStats[i].isMonotonic` | "Ja" or "Nee — mogelijke meterswap op rij {n}" |
| First interval | `fileStats[i].firstIntervalAnomalyFlag` | "OK" or "Aanpassing toegepast" |
| Rows contributed | `fileStats[i].rowsContributed` | — |
| Rows overridden | `fileStats[i].rowsOverridden` | — |
| Encoding | `fileStats[i].encoding` | "UTF-8" or "Windows-1252 (fallback)" |

---

## Period Filter

```typescript
// src/domain/period-filter.ts
// Pure function — DATA-12, D-02

export function filterByPeriod(
  samples: IntervalSample[],
  start: Date | null,
  end: Date | null
): IntervalSample[] {
  const s = start?.getTime() ?? -Infinity
  const e = end?.getTime() ?? Infinity
  return samples.filter(x => x.timestamp.getTime() >= s && x.timestamp.getTime() <= e)
}

/** Returns { start: Date, end: Date } spanning the full dataset */
export function fullRange(samples: IntervalSample[]): { start: Date; end: Date } {
  return {
    start: samples[0].timestamp,
    end: samples[samples.length - 1].timestamp,
  }
}
```

---

## Error Architecture

```typescript
// src/domain/types.ts (additional error types)

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

export class UnsupportedEncodingError extends Error {
  constructor(public readonly fileName: string) {
    super(`Bestand "${fileName}" heeft een niet-ondersteunde encoding.`)
  }
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing (delimiter detection, quoted fields, BOM) | Custom string splitter | PapaParse | Handles edge cases: BOM, embedded newlines, escaped quotes, mixed line endings |
| DST-aware timestamp conversion | Manual UTC offset arithmetic | `@date-fns/tz` TZDate | Platform Intl engine handles DST rule changes; manual arithmetic is wrong at fold/gap boundaries |
| Timezone DST scan | Custom UTC-offset diff loop | `tzScan` from `@date-fns/tz` | Returns exact DST change points with offset deltas |
| Encoding detection auto-detect library | chardet / jschardet package | `TextDecoder(enc, {fatal: true})` + try/catch | Browser-native API; no extra bundle weight; only two encodings needed (UTF-8 + Windows-1252) |
| Worker thread management | Manual `new Worker()` + message protocol | PapaParse `worker: true` (or Vite `?worker`) | PapaParse handles postMessage protocol internally |

**Key insight:** The two hardest problems in this phase (CSV parsing and DST bucketing) are already solved by the locked stack. Build only the domain glue (adapter, registry, merge, gap detection).

---

## Common Pitfalls

### Pitfall 1: Native `Date` for Local Timestamp Parsing
**What goes wrong:** `new Date("2026-03-29 02:00")` parses as local system timezone in Chrome/Node but as UTC in some contexts. On a CI machine with TZ=UTC, the timestamp will be wrong by +1 or +2 hours.
**Why it happens:** The ECMA spec says date-only strings are UTC; date+time strings are local system time.
**How to avoid:** Always use `TZDate(year, month-1, day, hour, min, "Europe/Amsterdam")`.
**Warning signs:** Spring/fall DST fixture tests fail on CI but pass locally.

### Pitfall 2: PapaParse Worker Blob URL Blocked by CSP
**What goes wrong:** `Papa.parse(file, { worker: true })` silently falls back to synchronous parsing or throws, freezing the UI on large files.
**Why it happens:** `default-src 'none'` blocks blob URL workers.
**How to avoid:** Add `worker-src blob:` to `csp.ts` (Option A) before Phase 2 merge.
**Warning signs:** No error thrown; worker never fires; UI freezes on 50k-row file.

### Pitfall 3: First Row Cumulative Delta is Wrong
**What goes wrong:** Computing delta for row[0] uses an implicit "prior reading = 0", yielding an enormous spurious import kWh equal to the current meter total.
**Why it happens:** Forgetting that cumulative series cannot compute a delta for the first row.
**How to avoid:** Start delta loop at index 1 (row[1] - row[0]); discard row[0] as a reference-only reading; flag `firstIntervalAnomalyFlag: true`.
**Warning signs:** First sample's `gridImportKwh` is thousands of kWh.

### Pitfall 4: Gap Count Includes Spring-Forward Skipped Hour
**What goes wrong:** Gap detection counts the spring-forward missing 02:00–02:59 slot as 4 missing intervals.
**Why it happens:** Walking UTC milliseconds at cadence generates expected slots that never existed in local time.
**How to avoid:** Use `tzScan("Europe/Amsterdam", {start, end})` to mark DST transition slots as exempt from gap counting; or walk in local-time intervals.
**Warning signs:** Spring-forward day reports 4 extra gaps; DATA-08 fixture test fails.

### Pitfall 5: Side-Effect Import Tree-Shaken Away
**What goes wrong:** `import './parsers/homewizard-p1'` is removed by Rollup because the module has no named exports.
**Why it happens:** Rollup considers modules with no exported symbols as purgeable if `sideEffects: false` is set in a parent package.
**How to avoid:** In internal source files, `export {}` ensures the module is not considered empty. For additional safety, ensure no `sideEffects: false` blanket is set in `package.json` that would cover src/ files.
**Warning signs:** `registry.claim(headers)` always returns null; "Onbekend formaat" error for all files.

### Pitfall 6: Decimal Comma Parsing
**What goes wrong:** `parseFloat("8354,542")` returns `8354` (stops at comma). If some HomeWizard locales export decimal commas, all values are truncated.
**Why it happens:** JavaScript `parseFloat` does not support decimal comma.
**How to avoid:** Normalize all numeric strings before parsing: `parseFloat(raw.replace(',', '.'))`.
**Warning signs:** All kWh values are whole integers; totals differ from meter display.

### Pitfall 7: `TextDecoder('windows-1252')` Unavailable in Node Vitest Tests
**What goes wrong:** `new TextDecoder('windows-1252')` throws in Vitest node environment because Node was built without full ICU.
**Why it happens:** Node.js slim ICU builds do not include all legacy encodings.
**How to avoid:** Check Node version supports it: `Node 22 LTS` ships with full ICU. Add a smoke-test fixture for Windows-1252 decoding in CI. If needed, add `--icu-data-dir` or use `full-icu` npm package.
**Warning signs:** `RangeError: The "windows-1252" encoding is not supported` in CI.

---

## Code Examples

### HomeWizard P1 Adapter Sketch

```typescript
// Source: HomeWizard helpdesk format + project type contracts [CITED: helpdesk.homewizard.com/...]
// src/domain/parsers/homewizard-p1.ts
import { TZDate } from '@date-fns/tz'
import { ParserRegistry, type CsvParser } from './registry'
import type { IntervalSample, ParseFileResult, SeriesType } from '../types'
import { ParseRowError } from '../types'

const REQUIRED_HEADERS = ['time', 'Import T1 kWh', 'Import T2 kWh', 'Export T1 kWh', 'Export T2 kWh']

const HomeWizardP1Parser: CsvParser = {
  name: 'HomeWizard P1',

  claim(headers: string[]): boolean {
    return REQUIRED_HEADERS.every(h => headers.includes(h))
  },

  transform(rows: Record<string, string>[], file: File): ParseFileResult {
    const seriesType: SeriesType = 'cumulative'
    const cumulativeRows = rows.map((row, i) => ({
      rowNumber: i + 2,  // 1-indexed, header is row 1
      timestamp: parseLocalTimestamp(row['time'], file.name, i + 2),
      importT1: parseKwh(row['Import T1 kWh'], 'Import T1 kWh', file.name, i + 2),
      importT2: parseKwh(row['Import T2 kWh'], 'Import T2 kWh', file.name, i + 2),
      exportT1: parseKwh(row['Export T1 kWh'], 'Export T1 kWh', file.name, i + 2),
      exportT2: parseKwh(row['Export T2 kWh'], 'Export T2 kWh', file.name, i + 2),
    }))

    const samples: IntervalSample[] = []
    let isMonotonic = true
    let monotonicity_failRow: number | undefined

    for (let i = 1; i < cumulativeRows.length; i++) {
      const prev = cumulativeRows[i - 1]
      const curr = cumulativeRows[i]
      const importKwh = (curr.importT1 + curr.importT2) - (prev.importT1 + prev.importT2)
      const exportKwh = (curr.exportT1 + curr.exportT2) - (prev.exportT1 + prev.exportT2)

      if (importKwh < -0.001 || exportKwh < -0.001) {
        if (isMonotonic) {
          isMonotonic = false
          monotonicity_failRow = curr.rowNumber
        }
      }

      samples.push({
        timestamp: curr.timestamp,
        gridImportKwh: Math.max(0, importKwh),
        gridExportKwh: Math.max(0, exportKwh),
      })
    }

    return {
      fileName: file.name,
      encoding: 'UTF-8',  // set by caller after encoding detection
      seriesType,
      cadenceMinutes: inferCadence(samples),
      samples,
      rowCount: rows.length,
      isMonotonic,
      monotonicity_failRow,
      firstIntervalAnomalyFlag: true,  // always true for cumulative (row[0] discarded)
    }
  },
}

ParserRegistry.register(HomeWizardP1Parser)
export {}

function parseLocalTimestamp(raw: string, fileName: string, rowNum: number): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(raw)
  if (!match) throw new ParseRowError(fileName, rowNum, 'time', 'YYYY-MM-DD HH:MM', raw)
  const [, yr, mo, dy, hr, mn] = match.map(Number)
  return new Date(new TZDate(yr, mo - 1, dy, hr, mn, 'Europe/Amsterdam').getTime())
}

function parseKwh(raw: string, col: string, file: string, row: number): number {
  const normalized = raw.replace(',', '.')
  const val = parseFloat(normalized)
  if (isNaN(val)) throw new ParseRowError(file, row, col, 'non-negative number', raw)
  return val
}

function inferCadence(samples: IntervalSample[]): number {
  if (samples.length < 2) return 15
  const diffs = samples.slice(1).map((s, i) =>
    (s.timestamp.getTime() - samples[i].timestamp.getTime()) / 60000
  )
  diffs.sort((a, b) => a - b)
  return diffs[Math.floor(diffs.length / 2)]  // median cadence in minutes
}
```

### PapaParse with Worker and Encoding

```typescript
// Source: PapaParse docs [CITED: papaparse.com/docs]
// src/domain/parse.ts
import Papa from 'papaparse'
import './parsers/homewizard-p1'  // side-effect registration
import './parsers/noop-stub'       // side-effect registration
import { ParserRegistry } from './parsers/registry'
import { decodeFileWithFallback } from './encoding'

export async function parseFile(file: File): Promise<ParseFileResult> {
  const { text, encoding } = await decodeFileWithFallback(file)

  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = []
    let headers: string[] = []

    Papa.parse(text, {
      header: true,
      delimiter: '',          // auto-detect , or ;
      dynamicTyping: false,   // always strings — we parse manually
      worker: true,           // requires worker-src blob: in CSP
      skipEmptyLines: true,
      step(result, parser) {
        if (headers.length === 0) {
          headers = result.meta.fields ?? []
        }
        if (result.errors.length > 0) {
          // D-06: fail-fast on first malformed row
          const err = result.errors[0]
          parser.abort()
          reject(new ParseRowError(file.name, err.row + 2, err.code, 'valid CSV row', ''))
          return
        }
        rows.push(result.data as Record<string, string>)
      },
      complete() {
        const adapter = ParserRegistry.claim(headers)
        if (!adapter) {
          reject(new Error(`Onbekend bestandsformaat voor "${file.name}"`))
          return
        }
        try {
          const result = adapter.transform(rows, file)
          resolve({ ...result, encoding })
        } catch (e) {
          reject(e)
        }
      },
      error(err) {
        reject(new Error(`${file.name}: ${err.message}`))
      },
    })
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `date-fns-tz` (marnusw/date-fns-tz) | `@date-fns/tz` (official, date-fns org) | date-fns v4.0 (Sep 2024) | Old package not updated; `@date-fns/tz` is the maintained companion |
| Manual TZ offset arithmetic | `TZDate("Europe/Amsterdam")` | date-fns v4.0 | Platform Intl engine; no embedded TZ blob |
| PapaParse with external `SCRIPT_PATH` | PapaParse 5.x inline blob worker | PapaParse 5.0.0 | Simpler worker setup but now requires `worker-src blob:` |

**Deprecated/outdated:**
- `date-fns-tz@3.x` (marnusw): not updated since 2024; do not use. Use `@date-fns/tz@^1.5` (CLAUDE.md).
- `Papa.SCRIPT_PATH` manual configuration: only needed for ancient bundler setups; PapaParse 5.x handles blob internally.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HomeWizard CSV uses comma delimiter and YYYY-MM-DD HH:MM format (dot decimal) | HomeWizard P1 CSV Format | Adapter fails to parse; requires delimiter/date-format fix in adapter |
| A2 | HomeWizard may also have a semicolon/decimal-comma locale variant | HomeWizard P1 CSV Format | DATA-04 requirement not met; auto-detect delimiter (`delimiter: ''`) mitigates |
| A3 | HomeWizard export includes both fall-back DST slots (two 02:00–02:59 local rows) | DST-Safe Bucketing | Fall-back fixture test has only 99 not 100 intervals if meter skips one slot |
| A4 | `TextDecoder('windows-1252')` is available in Node 22 LTS Vitest environment | Pattern 4 / Encoding | Windows-1252 fixture test fails in CI if Node built without full ICU |
| A5 | HomeWizard timestamps mark interval END (the 00:15 row = 00:00–00:15 interval) | IntervalSample Contract | Phase 3 simulator's interval energy calculation uses wrong half |
| A6 | No other CSV columns (Gas, Water, L1–L3) need parsing in Phase 2 | HomeWizard P1 CSV Format | Extra columns are silently ignored by PapaParse `header: true`; safe |
| A7 | slopcheck package legitimacy is not independently verified (tool unavailable) | Package Legitimacy Audit | All four packages are in CLAUDE.md locked stack — risk is very low |

---

## Open Questions

1. **HomeWizard exact format (CRITICAL)**
   - What we know: Official helpdesk confirms comma-delimited, YYYY-MM-DD HH:MM, dot decimal, cumulative columns named `Import T1 kWh` / `Export T1 kWh`.
   - What's unclear: Does the locale-sensitive export variant use `;` + decimal comma? Does it include a BOM? Does it emit both DST fall-back slots?
   - Recommendation: Plan a task "Obtain and commit a real HomeWizard P1 CSV fixture" as Wave 0 prerequisite. Design the adapter to auto-detect delimiter and normalize decimal comma/point. The CI fixture tests for DATA-08 should be gated on obtaining the real file.

2. **CSP `worker-src blob:` vs Option B custom worker**
   - What we know: PapaParse `worker: true` requires `worker-src blob:`. Option B (Vite `?worker`) avoids CSP relaxation but adds complexity.
   - What's unclear: Project owner's preference on CSP strictness vs simplicity.
   - Recommendation: Plan for Option A (`worker-src blob:`). If the project owner wants to avoid any CSP relaxation, plan Option B instead — flag this as a planning decision checkpoint.

3. **DST gap exemption: tzScan vs local-time interval walk**
   - What we know: Both approaches produce correct 92/100 interval counts.
   - What's unclear: Which is simpler to test and explain in the readout.
   - Recommendation: Use local-time interval walk (simpler, self-documenting). Reserve `tzScan` for `detectGaps()` if edge cases require it.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 LTS | Test runner, build | ✓ | (per package.json devDependencies Node 22) | — |
| npm | Package install | ✓ | (project has package.json) | — |
| `TextDecoder('windows-1252')` | Encoding fallback | [ASSUMED ✓] | Node 22 LTS has full ICU | If missing: skip Windows-1252 fixture in node env; only test in jsdom |
| PapaParse `worker: true` | DATA-13 | Blocked by CSP | — | `worker-src blob:` addition OR Vite `?worker` fallback |
| Browser `Intl.DateTimeFormat` (IANA tz) | TZDate DST | ✓ all modern browsers + jsdom 29 | — | — |

**Missing dependencies with no fallback:**
- PapaParse `worker: true` is blocked by current CSP — requires a planning decision (Option A or B above) before implementation.

**Missing dependencies with fallback:**
- `TextDecoder('windows-1252')` in node env — fall back to jsdom-only encoding test if node ICU is slim.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.7` |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test` |
| Full suite command | `npm run test -- --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Drop zone accepts files; file-picker visible | DOM/jsdom | `npm test -- tests/drop-zone.test.ts` | ❌ Wave 0 |
| DATA-02 | HomeWizard P1 file produces IntervalSample[] with non-negative values | unit (node) | `npm test -- tests/homewizard-p1.test.ts` | ❌ Wave 0 |
| DATA-03 | Noop second parser registered without editing central switch | unit (node) | `npm test -- tests/registry.test.ts` | ❌ Wave 0 |
| DATA-04 | UTF-8 + BOM parses correctly; `;` delimiter auto-detected | unit (node) | `npm test -- tests/encoding.test.ts` | ❌ Wave 0 |
| DATA-05 | Cumulative series classified; monotonicity failure detected; first-interval flagged | unit (node) | `npm test -- tests/homewizard-p1.test.ts` | ❌ Wave 0 |
| DATA-06 | `gridImportKwh >= 0` and `gridExportKwh >= 0` invariant on all samples | unit (node) | `npm test -- tests/homewizard-p1.test.ts` | ❌ Wave 0 |
| DATA-07 | Timestamps are UTC `Date` instances; not local TZ | unit (node) | `npm test -- tests/homewizard-p1.test.ts` | ❌ Wave 0 |
| DATA-08 | 2026-03-29 fixture: exactly 92 intervals; 2026-10-25 fixture: exactly 100 | unit (node) | `npm test -- tests/dst-fixtures.test.ts` | ❌ Wave 0 |
| DATA-09 | Malformed row produces ParseRowError with file/row/col/expected | unit (node) | `npm test -- tests/parse-errors.test.ts` | ❌ Wave 0 |
| DATA-10 | Overlapping files: finer cadence wins; coarser overridden | unit (node) | `npm test -- tests/merge.test.ts` | ❌ Wave 0 |
| DATA-11 | Sanity readout DOM: all 6 required fields present after parse | DOM/jsdom | `npm test -- tests/readout.test.ts` | ❌ Wave 0 |
| DATA-12 | `filterByPeriod` narrows; defaults to full range | unit (node) | `npm test -- tests/period-filter.test.ts` | ❌ Wave 0 |
| DATA-13 | Large file does not freeze UI (worker active) | manual-only (can't assert worker threading in Vitest) | Manual browser test — 50k+ row CSV | N/A |

### Sampling Rate

- **Per task commit:** `npm test` (full suite, fast — pure node functions)
- **Per wave merge:** `npm test -- --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/homewizard-p1.test.ts` — covers DATA-02, DATA-05, DATA-06, DATA-07
- [ ] `tests/registry.test.ts` — covers DATA-03
- [ ] `tests/encoding.test.ts` — covers DATA-04, D-07
- [ ] `tests/dst-fixtures.test.ts` — covers DATA-08 (requires DST fixture CSVs)
- [ ] `tests/parse-errors.test.ts` — covers DATA-09
- [ ] `tests/merge.test.ts` — covers DATA-10
- [ ] `tests/drop-zone.test.ts` — covers DATA-01 (jsdom; `// @vitest-environment jsdom` docblock required)
- [ ] `tests/readout.test.ts` — covers DATA-11 (jsdom)
- [ ] `tests/period-filter.test.ts` — covers DATA-12
- [ ] `tests/fixtures/` — DST fixture CSV files for DATA-08 (2026-03-29 spring day, 2026-10-25 fall day)
- [ ] `tests/fixtures/` — HomeWizard P1 real sample CSV (gated on project owner providing file)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | All CSV values validated before use; `ParseRowError` on malformed input |
| V6 Cryptography | no | — |

### Known Threat Patterns for CSV Parsing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Formula injection in CSV (e.g. `=CMD(...)`) | Tampering | CSV values are only ever interpreted as numbers/timestamps — never rendered as innerHTML or passed to `eval`. PapaParse `header:true` + manual `parseFloat` prevents formula execution |
| Excessively large file (DoS) | Denial of Service | PapaParse streaming (`step` callback) + `worker: true` prevents main-thread block. No hard file size limit — the phase parses what it receives. Phase 4 may add UI indicator |
| Malicious CSV content sent off-device | Information Disclosure | `connect-src 'none'` CSP; no `fetch()` or XHR in domain layer |
| Prototype pollution via CSV keys | Tampering | PapaParse `header:true` creates plain objects; do not use `JSON.parse` on CSV headers. Avoid using `eval`, `Function()`, or dynamic property access on CSV header names |
| XSS via file name in readout | Tampering | `textContent` assignment (not `innerHTML`) for all user-supplied strings in readout DOM |

---

## Sources

### Primary (HIGH confidence)
- `CLAUDE.md` — locked stack versions (papaparse@^5.5.3, @date-fns/tz@^1.5.0, date-fns@^4.3.0, Vitest@^4.1.7)
- `02-CONTEXT.md` — locked decisions D-01..D-09 and requirements DATA-01..13
- `02-UI-SPEC.md` — drop-zone state machine and readout field contract
- `.planning/REQUIREMENTS.md` — DATA requirements full text
- Phase 1 artifacts (`src/constants/csp.ts`, `vitest.config.ts`, `src/styles/tokens.css`) — existing CSP and token contracts

### Secondary (MEDIUM confidence)
- [HomeWizard helpdesk CSV export guide](https://helpdesk.homewizard.com/en/articles/6664029-how-to-export-and-use-csv-files) — column names, timestamp format, cumulative nature confirmed
- [PapaParse docs](https://www.papaparse.com/docs) — `step`, `worker: true`, `delimiter`, BOM constant
- [@date-fns/tz README (GitHub)](https://github.com/date-fns/tz) — `TZDate` constructor, `tz()` function, `tzScan()` API
- [date-fns v4.0 blog](https://blog.date-fns.org/v40-with-time-zone-support/) — TZDate DST architecture
- [Vite Web Workers docs](https://vite.dev/guide/features) — `?worker` import, production bundling behavior
- [PapaParse issue #273](https://github.com/mholt/PapaParse/issues/273) — blob URL worker mechanism
- npm registry — verified versions: papaparse@5.5.3, @types/papaparse@5.5.2, date-fns@4.4.0, @date-fns/tz@1.5.0

### Tertiary (LOW confidence)
- [timeanddate.com Amsterdam DST 2026](https://www.timeanddate.com/time/change/netherlands/amsterdam) — confirms spring forward 2026-03-29 02:00 and fall back 2026-10-25 03:00
- Community discussions about PapaParse CSP and blob workers — `worker-src blob:` requirement corroborated across multiple GitHub issues

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked by CLAUDE.md; npm versions verified
- HomeWizard P1 CSV format: MEDIUM — official helpdesk docs; no real sample file in repo
- Architecture patterns: HIGH — derived from locked decisions (CONTEXT.md) + confirmed library APIs
- CSP/worker conflict: HIGH — confirmed from PapaParse source + CSP spec behavior
- DST interval math: HIGH — verified arithmetically (23×4=92, 25×4=100)
- Pitfalls: MEDIUM/HIGH — most based on known library behaviors + CSP spec

**Research date:** 2026-06-08
**Valid until:** 2026-09-08 (90 days — papaparse, date-fns are stable libraries; HomeWizard format may change with app updates)
