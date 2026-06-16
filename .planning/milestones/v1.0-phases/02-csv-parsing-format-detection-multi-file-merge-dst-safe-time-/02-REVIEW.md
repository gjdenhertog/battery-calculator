---
phase: 02-csv-parsing-format-detection-multi-file-merge-dst-safe-time-
reviewed: 2026-06-09T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - src/constants/csp.ts
  - src/domain/encoding.ts
  - src/domain/gaps.ts
  - src/domain/merge.ts
  - src/domain/parse.ts
  - src/domain/parsers/homewizard-p1.ts
  - src/domain/parsers/noop-stub.ts
  - src/domain/parsers/registry.ts
  - src/domain/period-filter.ts
  - src/domain/types.ts
  - src/main.ts
  - src/styles/drop-zone.css
  - src/ui/drop-zone.ts
  - src/ui/readout.ts
  - tests/csp-plugin.test.ts
  - tests/drop-zone.test.ts
  - tests/dst-fixtures.test.ts
  - tests/encoding.test.ts
  - tests/homewizard-p1.test.ts
  - tests/merge.test.ts
  - tests/parse-errors.test.ts
  - tests/period-filter.test.ts
  - tests/readout.test.ts
  - tests/registry.test.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: resolved
resolved_in: 1fc21c2
resolution_note: "CR-01, CR-02, WR-01, WR-04, WR-05 fixed in 1fc21c2 (DST disambiguation + local-calendar gap walk + strict numeric parse + asserting tests + shared CSV filter). 4 Info findings left as-is. 134 tests pass."
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** resolved (Critical + Warning findings fixed in commit 1fc21c2; Info left as advisory)

## Summary

This phase implements CSV parsing, encoding detection, format-detection via a self-registering
parser registry, multi-file finer-wins merge, DST-aware gap detection, a sub-period filter, and a
drag-drop UI with a sanity readout. The privacy and XSS posture is genuinely strong: every
user-derived string reaches the DOM via `.textContent` (verified in `readout.ts` and `drop-zone.ts`,
and locked by `readout.test.ts`'s `<script>`-named-file test), `connect-src 'none'` is preserved,
and the CSP relaxation is correctly scoped to `worker-src blob:` only — it does **not** widen the
network surface. That part of the brief is satisfied.

However, the central DST guarantee (D-04 / DATA-11) is **broken in two distinct ways**, and both
are masked by tests that assert on the wrong quantity. The fall-back ambiguous local hour collapses
4 real intervals onto duplicate UTC timestamps in the HomeWizard adapter, and `detectGaps`
fabricates/drops slots at DST boundaries for daily-cadence series because its "local-time walk" is
actually a fixed UTC-millisecond walk. Both are correctness/data-loss defects on the exact code path
this phase exists to make correct.

Secondary issues: `parseFloat`-based numeric parsing silently accepts partial garbage (`"100abc"`)
in violation of the D-06 fail-fast contract, and several smaller robustness/consistency gaps.

## Critical Issues

### CR-01: Fall-back ambiguous hour collapses 4 real intervals to duplicate timestamps (data loss)

**File:** `src/domain/parsers/homewizard-p1.ts:70-88` (`parseLocalTimestamp`)
**Issue:**
On the October fall-back day the local clock runs `02:00–02:59` **twice** — once at UTC+2 (CEST)
and once at UTC+1 (CET). A real HomeWizard export therefore contains the textual timestamps
`02:00, 02:15, 02:30, 02:45` twice (verified in `tests/fixtures/homewizard-fall-2026-10-25.csv`
lines 11–14 and 15–18). `parseLocalTimestamp` constructs `new TZDate(yr, mo-1, dy, hr, mn, ...)`
which resolves an ambiguous local time to a **single** UTC instant (the first/CEST occurrence):

```
2026-10-25 02:30 AMS  ->  2026-10-25T00:30:00.000Z   (always the CEST branch)
```

So both occurrences of each `02:xx` row map to the **same** UTC timestamp. Measured against the real
fixture: 101 data rows produce only **97 distinct UTC timestamps** — 4 intervals are duplicated.

The adapter pushes all 100 (`101 - 1`) samples into an array without dedup, so
`dst-fixtures.test.ts` (which only checks `result.samples.length === 100`) passes and hides the bug.
But as soon as the series flows through `mergeFiles` (`merge.ts:34,48`), the
`Map<utcMs, IntervalSample>` dedups the 4 colliding keys — **silently dropping 4 intervals of real
grid import/export energy** and undercounting the user's totals on every fall-back day. This is the
precise scenario D-04 promised to handle ("both fall-back slots produce distinct UTC values").

**Fix:**
Detect the repeated-hour rows and disambiguate the second occurrence to the UTC+1 branch. Because
the rows arrive in file order, track when local time goes *backwards or repeats* within the fall-back
window and add one hour of offset to the UTC result for the second pass. A robust approach: parse to
the CEST instant, and if that instant is `<=` the previous row's instant (non-increasing) while the
local wall-clock advanced, re-resolve to the CET instant (`+3600_000` ms). Alternatively, key the
disambiguation off the cumulative meter reading being strictly greater than the prior row. Whatever
the mechanism, the adapter must emit **100 distinct UTC timestamps** for the fall-back fixture, and a
test must assert `new Set(samples.map(s => s.timestamp.getTime())).size === 100` (not just
`samples.length`).

---

### CR-02: detectGaps fabricates/misses slots at DST boundaries for daily cadence (false gaps + early termination)

**File:** `src/domain/gaps.ts:43-62`
**Issue:**
The module header and inline comments claim expected slots are generated "by walking in local
Amsterdam time" so DST is handled. They are not. Line 61 advances by a **fixed UTC-millisecond
step**:

```ts
current = new TZDate(current.getTime() + intervalMs, AMSTERDAM)
```

Re-wrapping the result in a `TZDate` changes nothing about the numeric instant — it is a pure UTC-ms
walk. For 15-min and 60-min cadences this happens to be correct (DST shifts are exact multiples of
the cadence), which is why `merge.test.ts` passes. But for **daily cadence** (which the HomeWizard
adapter legitimately produces — `inferCadence` returns ~1440 for daily exports, and the daily path is
tested in `homewizard-p1.test.ts:313-332`), a 24h UTC step drifts across DST:

- **Spring (23h day):** walking from `2026-03-28T23:00Z` by +1440min lands on `2026-03-29T23:00Z`,
  but the real next daily sample (midnight AMS, a 23h day) is `2026-03-29T22:00Z`. The walk overshoots,
  `current > lastUtcMs`, the loop exits early, and the third day is **never generated as expected** —
  a real missing day would go undetected.
- **Fall (25h day):** walking from `2026-10-24T22:00Z` by +1440min lands on `2026-10-25T22:00Z`,
  which does not exist (real sample is `2026-10-25T23:00Z`). `detectGaps` reports a **phantom gap**
  and the genuine sample is treated as unexpected.

Both reproduced directly against `@date-fns/tz`. This is a correctness defect on the DST path D-04
guarantees, and the gap count surfaces to the user in the readout ("Ontbrekende intervallen").

**Fix:**
Step in **local calendar time**, not UTC milliseconds. Use date-fns local arithmetic on the
`TZDate` (e.g. `addMinutes` / `addDays` from `date-fns`, which operate in the `TZDate`'s zone) so the
walk produces the correct number of slots per local day:

```ts
import { addMinutes } from 'date-fns'
// ...
let current = new TZDate(firstUtcMs, AMSTERDAM)
while (current.getTime() <= lastUtcMs) {
  expectedSlots.push(current.getTime())
  current = addMinutes(current, cadenceMinutes) // local-time step → DST-correct
}
```

Note the range-grouping at lines 76–89 also assumes a constant `intervalMs` between consecutive
expected slots; it must be reworked the same way (compare against the next expected slot, not
`rangeEnd + intervalMs`) once daily cadence is in scope. Add daily-cadence gap tests that cross both
the March and October transitions and assert `count === 0` for a complete daily series.

## Warnings

### WR-01: parseKwh silently accepts partial-garbage numbers, violating D-06 fail-fast

**File:** `src/domain/parsers/homewizard-p1.ts:53-60`
**Issue:**
`parseFloat` stops at the first non-numeric character instead of rejecting the whole token:
`parseFloat('100abc')` returns `100`, `parseFloat('8354.5xyz')` returns `8354.5`. A corrupted cell
therefore parses to a plausible-looking number and is accepted, directly contradicting the file's own
D-06 contract ("ParseRowError thrown immediately on non-numeric or malformed value"). Only a token
with no leading numeric prefix (e.g. `"NOT-A-NUMBER"`) is caught — which is exactly what the tests
use, so the gap is untested.

**Fix:**
Validate the full token. Either use `Number(normalized)` (which returns `NaN` for `"100abc"`) plus an
explicit empty-string guard, or test against a strict numeric regex before `parseFloat`:

```ts
const normalized = raw.trim().replace(',', '.')
if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) {
  throw new ParseRowError(fileName, rowNum, col, 'non-negative number', raw)
}
const val = Number(normalized)
```

### WR-02: parseKwh error message claims "non-negative number" but negatives are accepted

**File:** `src/domain/parsers/homewizard-p1.ts:53-60`
**Issue:**
The thrown `expected` string is `'non-negative number'`, yet `parseFloat('-5')` succeeds and a
negative cumulative reading flows through unchallenged. The message is misleading and a negative
absolute meter reading (as opposed to a negative *delta*, which is separately flagged via
`isMonotonic`) is never rejected or flagged. Either the validation or the message is wrong.

**Fix:**
Decide the contract. If absolute readings must be non-negative, reject `val < 0` explicitly. If
negatives are acceptable at the cell level (only deltas matter), change the `expected` string to
`'number'` to stop over-promising.

### WR-03: `.replace(',', '.')` only replaces the first comma — silent corruption on grouped numbers

**File:** `src/domain/parsers/homewizard-p1.ts:54`
**Issue:**
`String.replace` with a string argument replaces only the first match. A value such as
`"1,234,567"` becomes `"1.234,567"`, and `parseFloat` yields `1.234` — silent two-orders-of-magnitude
data corruption with no error. NL exports use comma-as-decimal so this is lower-probability, but a
mixed/grouped export from another locale would corrupt rather than fail-fast.

**Fix:**
Be explicit about the expected format. If only a single decimal comma is allowed, assert there is at
most one comma before replacing; if grouping separators are possible, strip them deliberately. At
minimum use a regex global replace only after validating the shape.

### WR-04: dst-fixtures.test.ts asserts the wrong quantity, masking CR-01

**File:** `tests/dst-fixtures.test.ts:88-91`
**Issue:**
The fall-back test asserts `result.samples.length === 100` but never checks that the 100 samples have
**distinct** timestamps. Because the adapter emits 100 array entries (4 of them colliding on UTC), the
assertion is green while the data is wrong (CR-01). A test that locks a DST guarantee must assert on
the property that actually matters.

**Fix:**
Add `expect(new Set(result.samples.map(s => s.timestamp.getTime())).size).toBe(100)` to the fall-back
case, and ideally assert the total energy is preserved through `mergeFiles`.

### WR-05: drop handler and file-picker handler use inconsistent file filtering

**File:** `src/ui/drop-zone.ts:206-211` vs `216-222`
**Issue:**
The `drop` handler filters to `.csv`/`text/csv` files and silently returns if none qualify
(`csvFiles.length === 0`). The file-picker `change` handler applies **no** filter and passes every
selected file straight to `processFiles`. The behaviors diverge: a non-CSV dropped file is ignored,
but a non-CSV picked file is parsed (and will fail downstream with an "unknown format" error). This is
inconsistent UX and means the `accept` attribute is the only guard on the picker path (which browsers
do not strictly enforce).

**Fix:**
Apply the same `.csv`/`text/csv` filter in the `change` handler, or factor the filter into a shared
helper used by both paths. Decide deliberately whether an empty filtered set should be a no-op or an
explicit "geen CSV-bestanden" message — currently the drop path silently does nothing.

### WR-06: mergeFiles assumes a non-empty input but the contract is unchecked

**File:** `src/domain/merge.ts:29-31`; `src/domain/period-filter.ts:40-45`
**Issue:**
`mergeFiles` documents "Must not be empty" but does not enforce it. With an empty `results` array,
`inferDominantCadence` is called with `sortedResults.length === 0`, falls through to the median path
with `mergedSamples.length < 2`, and returns the magic default `15` — then `detectGaps` short-circuits
on the empty series, so it happens not to crash, but the "non-empty" precondition is load-bearing and
silently relied upon. Similarly `fullRange` dereferences `samples[0]` / `samples[length-1]` and throws
on an empty array with no guard. `processFiles` calls `mergeFiles(parseResults)` where
`parseResults` could in principle be empty (e.g. all files filtered out upstream in a future change).

**Fix:**
Either throw an explicit, typed error at the top of `mergeFiles`/`fullRange` for empty input, or make
the empty case a well-defined return value. Don't rely on incidental non-crashing behavior.

## Info

### IN-01: gaps.ts module comment materially misdescribes the implementation

**File:** `src/domain/gaps.ts:7-14, 53-62`
**Issue:** The header and inline comments assert the walk steps "in local Amsterdam time" and that
"adding minutes in local time naturally skips the nonexistent spring-forward hour." The code adds a
fixed `intervalMs` in UTC and re-wraps — the TZDate wrapping has no effect on the instant. Even after
CR-02 is fixed, leaving prose that describes behavior the code never had is a maintenance trap.

**Fix:** After fixing CR-02, make the comments describe the actual local-time stepping; until then they
should not claim DST-correctness the code does not deliver.

### IN-02: inferDominantCadence median-fallback branch is dead code

**File:** `src/domain/merge.ts:99-115`
**Issue:** `mergeFiles` only ever calls `inferDominantCadence` with `sortedResults` derived from a
non-empty `results` (length ≥ 1 in every real call), so `sortedResults.length > 0` at line 104 is
always true and the entire median-computation block (lines 109–114) is unreachable. It reads as a
safety net but cannot execute given the caller.

**Fix:** Either remove the dead branch or genuinely route the single-file / few-sample case through it.
If kept, document that it is reachable only if the function is called directly outside `mergeFiles`.

### IN-03: Magic default cadence `15` and DOM id strings are unconstrained literals

**File:** `src/domain/merge.ts:109`; `src/domain/parsers/homewizard-p1.ts:95`; `src/ui/drop-zone.ts:44-45,159`
**Issue:** The fallback cadence `15` appears as a bare literal in two places, and DOM ids
(`'parse-readout'`, `'file-picker-input'`, status/error ids) are scattered string literals shared
across `drop-zone.ts` and `readout.ts` with no single source of truth. A typo in one location would
silently break the readout-removal/insert logic (`removeExistingReadout` keys off the literal
`'parse-readout'`).

**Fix:** Hoist the shared DOM ids and the default cadence into named constants in one module so the
producer and consumer cannot drift.

### IN-04: Resolutie readout label is binary and mislabels any non-60 cadence as "15 minuten"

**File:** `src/ui/readout.ts:110`
**Issue:** `stat.cadenceMinutes === 60 ? 'Uur' : '15 minuten'` renders **any** non-60 cadence as
"15 minuten" — including daily (1440) series, which would be shown to the user as "15 minuten". Given
the adapter explicitly supports daily exports, this readout is wrong for that case.

**Fix:** Map known cadences explicitly (`60 → 'Uur'`, `15 → '15 minuten'`, `1440 → 'Dag'`) and fall
back to a generic `${cadenceMinutes} min` for anything else, rather than a two-way branch.

---

_Reviewed: 2026-06-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
