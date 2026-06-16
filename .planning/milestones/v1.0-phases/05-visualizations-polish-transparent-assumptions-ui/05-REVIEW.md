---
phase: 05-visualizations-polish-transparent-assumptions-ui
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/domain/bucket-by-month.ts
  - src/domain/select-representative-week.ts
  - src/helpers/format.ts
  - src/main.ts
  - src/ui/charts/chart-tooltip.ts
  - src/ui/charts/flow-chart.ts
  - src/ui/charts/monthly-bars.ts
  - src/ui/tooltips.ts
  - src/ui/transparency-panel.ts
  - src/styles/charts.css
  - src/styles/mobile-reflow.css
  - src/styles/tooltips.css
  - src/styles/transparency-panel.css
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 5 visualization, polish, and transparency surfaces: two pure domain
helpers (`bucketByMonth`, `selectRepresentativeWeek`), the formatter additions, the two
uPlot chart adapters, the new CSP-safe hover-tooltip plugin, the term-tooltip wiring,
the transparency panel builder, and four stylesheets.

**Privacy/CSP:** Clean. No network calls carry user data. CSP `connect-src 'none'` is
untouched. All inline styling uses CSSOM property assignment (`el.style.backgroundColor`,
`el.style.transform`) which is *not* blocked by `style-src 'self'` — this is correctly
applied and is not a violation. No `setAttribute('style')`, no `<style>` injection, no
parsed inline-style strings in the four CSS files.

**XSS:** Clean. Every user-derived string (custom battery name) routes through
`.textContent` in the legend, dropdown options, and both tooltips. No `.innerHTML` with
variable content.

**Key concerns:** Two correctness defects warrant blocking. (1) A 6th active battery
(5 catalog + 1 custom) produces a legend/chart color mismatch because `colorSlotFor`
caps at slot 5 while `colorFor` wraps to slot 1 — they disagree for the same battery.
(2) Both chart `ResizeObserver` debounce callbacks dereference `chart!` after a 100 ms
delay without re-checking for null, so a state change during that window throws and is
swallowed only by luck (it runs outside the effect's try/catch). The remaining warnings
concern DST-week arithmetic, the flow-chart's distance-based emphasis heuristic, dropdown
state desync, and a duplicated catch/empty-state block.

## Critical Issues

### CR-01: 6th active battery gets mismatched legend vs. chart color

**File:** `src/ui/charts/monthly-bars.ts:131-152` (legend) and `:228` (chart bars); `src/helpers/color.ts:25-45`; `src/ui/charts/flow-chart.ts:68-74`

**Issue:** The picker allows `MAX_SELECTED = 5` catalog batteries (`src/ui/battery-picker.ts:21`), and `activeBatteries` appends a valid custom battery on top (`src/state/signals.ts:90-94`), so up to **6** batteries reach the charts. The two color helpers disagree past index 4:

- `colorSlotFor` (used by the monthly-bars **legend** swatch class `battery-swatch--N`) does `Math.min(idx + 1, 5)` — the 6th battery (idx 5) → slot **5** (red `#e11d48`).
- `colorFor` (used by the monthly-bars **bar fill/stroke** and the entire **flow chart** stroke) does `if (idx >= COLOR_SLOTS.length) return COLOR_SLOTS[0]` — the 6th battery (idx 5) → slot **1** (blue `#2563eb`).

Result: with 6 active batteries the 6th battery's legend swatch is red but its chart bars/line are blue. This breaks the COMP-04 "legend color matches the rendered series" contract that the whole charting design relies on for identification. The monthly-bars hover tooltip uses `resolvedColors[i]` (from `colorFor`) so it agrees with the bar but disagrees with the legend — the user sees two different colors labeled for the same battery.

**Fix:** Make both helpers use identical wrap/clamp semantics. Either clamp `colorFor` to the last slot to match `colorSlotFor`, or wrap `colorSlotFor` to slot 1 to match `colorFor`. Clamping both to the last defined slot is the least surprising:
```ts
// color.ts
export function colorFor(batteryId: string, orderedSelection: string[]): string {
  const idx = orderedSelection.indexOf(batteryId)
  if (idx === -1) return COLOR_SLOTS[0]
  return COLOR_SLOTS[Math.min(idx, COLOR_SLOTS.length - 1)]
}
export function colorSlotFor(batteryId: string, orderedSelection: string[]): number {
  const idx = orderedSelection.indexOf(batteryId)
  if (idx === -1) return 1
  return Math.min(idx + 1, COLOR_SLOTS.length)
}
```
Note that clamping causes the 5th and 6th batteries to *share* a color — that is a separate UX problem, but at least legend, bar, and tooltip then agree. The cleanest fix is to forbid a 6th colored series (e.g. cap active batteries at 5 for charting) so every series stays uniquely colored.

### CR-02: ResizeObserver debounce callback dereferences `chart!` after it may be nulled

**File:** `src/ui/charts/flow-chart.ts:374-381`; `src/ui/charts/monthly-bars.ts:349-356`

**Issue:** Both adapters guard the *outer* observer callback with `if (chart && container.offsetWidth > 0)`, then schedule a 100 ms `setTimeout` whose body calls `chart!.setSize(...)` with a non-null assertion. Between scheduling and firing, the reactive `effect` can run and set `chart = null` (empty state: user unchecks all batteries, clears the period, or an upload error fires `simResults = null`). When the timer then fires, `chart!.setSize` dereferences `null` and throws `TypeError: Cannot read properties of null`.

This throw escapes the effect's `try/catch` (it runs in a detached timer callback), so it surfaces as an unhandled exception / uncaught error in the console rather than the graceful error UI. The non-null assertion (`chart!`) also actively hides the bug from the type checker.

**Fix:** Re-check `chart` inside the timer body (the value can change between schedule and fire):
```ts
resizeTimer = setTimeout(() => {
  if (chart && container.offsetWidth > 0) {
    chart.setSize({ width: container.offsetWidth, height: CHART_HEIGHT })
  }
}, 100)
```
Apply the same change in both `flow-chart.ts` and `monthly-bars.ts`.

## Warnings

### WR-01: Representative-week end timestamp is wrong across DST transitions

**File:** `src/domain/select-representative-week.ts:86`

**Issue:** `weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000 - 1` assumes every week is exactly 168 hours. In `Europe/Amsterdam` the spring-forward week is 167 h and the fall-back week is 169 h. For the spring week, the computed `weekEndMs` lands ~1 h into the *following* Monday; `endLocal.getDate()` / `getMonth()` then read the wrong local day, so the `weekLabel` can show an 8-day span or the wrong end date, and `filterWeekRows` (flow-chart.ts:222) pulls in an extra hour of the next week. For the fall-back week it stops ~1 h short. The week-selection sum itself is correct (it buckets by `startOfWeek`), only the end boundary is wrong.

**Fix:** Derive the end from the local week, not fixed ms. Compute `endOfWeek(new TZDate(weekStartMs, zone), { weekStartsOn: 1 })` (date-fns) and use its `.getTime()`, or add 7 days via `addDays(TZDate, 7)` then subtract 1 ms — both honor the local DST offset.

### WR-02: Flow-chart hover emphasis compares kWh magnitude to a pixel-derived y value

**File:** `src/ui/charts/flow-chart.ts:269-294`

**Issue:** The emphasis heuristic picks the series whose value at `idx` is closest to `yVal`, where `yVal = u.posToVal(topInOver, 'y')` is the cursor's data-space y. Four series (grid import, teruglevering, laden, ontladen) share one y-scale, so "nearest by value" only emphasizes the series the cursor is vertically nearest to — but the four series live in very different magnitude bands (import can be kWh-scale while laden/ontladen are fractions of a kWh per 15 min). The emphasized series is therefore frequently *not* the one the user is pointing at, just the one whose magnitude happens to sit near the crosshair. This is misleading rather than crashing.

**Fix:** Either drop value-based emphasis and emphasize nothing (show all four equally), or emphasize the series whose *plotted pixel position* at `idx` is nearest the cursor pixel (`u.valToPos(value, 'y')` vs `topInOver`) rather than comparing raw data values.

### WR-03: Flow-chart dropdown `select.value` can silently desync from `selectedBatteryId`

**File:** `src/ui/charts/flow-chart.ts:421-429`

**Issue:** When the previously-selected battery is removed from the set, the effect resets `selectedBatteryId = batteries[0].id` and calls `populateDropdown(...)`. `populateDropdown` (lines 162-168) sets `select.value` to the selected id *if present, else falls back to `batteries[0].id`* — but it never writes that fallback back into the module-level `selectedBatteryId`. In the normal effect path they happen to agree, but the two are maintained independently in two places, so any future divergence (e.g. an id present in `ids` but not equal to `selectedBatteryId`) leaves the `<select>` showing one battery while `rerenderForSelectedBattery` computes another. The `change` handler then compares `domRefs.select.value` against a possibly-stale `selectedBatteryId`.

**Fix:** Make `populateDropdown` return the id it actually selected and assign it back: `selectedBatteryId = populateDropdown(select, batteries, selectedBatteryId)`. Keep a single source of truth for the current selection.

### WR-04: Empty-state branch leaves `selectedBatteryId`/`lastBatteryCount` reset but ResizeObserver still attached to a dead chart wrapper

**File:** `src/ui/charts/flow-chart.ts:384-398`; `src/ui/charts/monthly-bars.ts:359-373`

**Issue:** On the empty-state path, the effect clears `container.innerHTML` and sets `chart = null` / `domRefs = null`, but the `ResizeObserver` keeps observing `container` (correct) while any in-flight debounce timer is not cleared. Combined with CR-02, a pending resize timer scheduled just before the empty-state transition will fire against a nulled `chart`. Even after CR-02's null-guard, the stale `resizeTimer` handle is never cleared on empty-state, so it can fire a no-op late. Minor, but it compounds CR-02.

**Fix:** In the empty-state branch, also `if (resizeTimer !== null) { clearTimeout(resizeTimer); resizeTimer = null }`.

### WR-05: `bucketByMonth` `isPartial` mislabels a genuinely complete month that the trace legitimately lacks an edge day for

**File:** `src/domain/bucket-by-month.ts:86`

**Issue:** `isPartial` is `!localDays.has(1) || !localDays.has(lastDay)`. A dataset that starts at, say, 2025-06-02 and is otherwise complete through June flags June as partial because day 1 is absent — which is the intended semantics. But the same rule also flags a month as *complete* (`isPartial = false`) when only days 1 and the last day are present and everything in between is missing (e.g. two isolated rows). The check verifies the two edge days exist, not that the month is densely covered, so a sparse month with rows only on the 1st and 30th is reported as a full month. Given the chart annotates partial months at lower opacity and drives the "Weinig data" note off `!isPartial` counts, this can under-warn on sparse data.

**Fix:** If density matters, additionally require a minimum day-count (e.g. `localDays.size >= daysInMonth(year, month1) - tolerance`) or check for internal gaps. If edge-day presence is genuinely the intended contract, document it explicitly so the limitation is a known trade-off rather than a latent surprise.

### WR-06: Duplicated empty-state + error-state teardown block across both chart adapters

**File:** `src/ui/charts/flow-chart.ts:389-398, 462-474`; `src/ui/charts/monthly-bars.ts:364-373, 415-427`

**Issue:** The empty-state reset (`container.innerHTML = ''; chart = null; domRefs = null; ...`) and the `catch` error-state block (build a `role="alert"` `<p class="results-error">` with an identical Dutch message, reset the same fields) are near-verbatim duplicated within each file and structurally duplicated across both files. The identical Dutch error string `'Grafiek kon niet worden geladen...'` is repeated four times. Drift risk: a copy fix to one site silently diverges from the others.

**Fix:** Extract a shared `renderChartError(container)` helper and a `resetChartState()` closure (or a small shared module under `src/ui/charts/`), and hoist the error string to a single `const`.

## Info

### IN-01: `chart-tooltip.ts` `showAt` accepts `wrapperH` but never uses it

**File:** `src/ui/charts/chart-tooltip.ts:89-103`

**Issue:** `showAt(..., wrapperH)` only does `void wrapperH // reserved for future vertical clamping`. The parameter and the `wrapRect.height` argument at the call site (flow-chart/monthly-bars via the plugin) are dead. Vertical clamping is genuinely absent: a tooltip near the bottom edge with `flipBelow === false` translates `-100%` up (fine) but one near the top with `flipBelow === true` can still overflow downward past the wrapper since `overflow: hidden` on `.chart-wrapper` will clip it.

**Fix:** Either implement the vertical clamp using `wrapperH` and `el.offsetHeight`, or remove the unused parameter to keep the signature honest.

### IN-02: `formatAxisKwh` is identical to inlined `toFixed(1)` and duplicates `formatKwh` logic

**File:** `src/helpers/format.ts:38-40`

**Issue:** `formatAxisKwh(n) => n.toFixed(1)` is a one-liner wrapper. Not a bug, but it is the kind of trivial indirection that tends to drift from `formatKwh` (which is `${n.toFixed(1)} kWh`). Fine as a named seam for axis formatting; just noting the two must stay in lockstep on decimal count.

**Fix:** None required. Optionally add a shared private `kwh1(n)` both call to lock the decimal precision in one place.

### IN-03: `hexToRgba` silently falls back to brand blue on malformed hex

**File:** `src/ui/charts/monthly-bars.ts:69-80`

**Issue:** On a non-`#abc`/`#aabbcc` input, `parseInt` yields `NaN` and the function returns hardcoded `rgba(37, 99, 235, alpha)` (slot-1 blue). This masks a misconfigured color token as a silent blue bar rather than surfacing it. Acceptable defensive default, but worth a comment that this fallback color is intentionally slot-1.

**Fix:** None required; consider logging in dev builds when the fallback engages.

### IN-04: `initTooltips()` attaches non-removable document listeners with no idempotency guard

**File:** `src/ui/tooltips.ts:66-98`

**Issue:** `initTooltips` adds anonymous `touchstart` and `keydown` listeners to `document` and returns `void` — there is no teardown and no guard against double-attachment. `main.ts` calls it exactly once, so this is fine today, but under Vite HMR (which `main.ts` wires `dispose` for the charts but not for tooltips) the listeners accumulate on each hot update. The handlers are cheap and idempotent in behavior, so this is cosmetic, not a leak that affects correctness.

**Fix:** Optionally return a disposer (named handlers + `removeEventListener`) and call it from the `import.meta.hot.dispose` block in `main.ts` alongside the chart disposers.

### IN-05: `select-representative-week` empty-trace branch returns `weekLabel: ''` that would render as a blank caption

**File:** `src/domain/select-representative-week.ts:41-44`

**Issue:** The empty-trace guard returns `{ startTs: 0, endTs: 0, weekLabel: '' }`. The flow-chart caption interpolates this directly: `Voorbeeldweek:  — de week met de meeste teruglevering...` (double space, dangling em-dash). In practice the flow chart's outer guard (`results.length !== batteries.length`, empty `batteries`) prevents reaching this with an empty trace, but a battery whose `result.trace` is empty (zero-length filtered period) would slip through and render the malformed caption.

**Fix:** Have the caller skip caption rendering when `week.startTs === 0 && week.endTs === 0`, or have the empty branch return a sentinel the caller checks.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
