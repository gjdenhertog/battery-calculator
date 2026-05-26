# Pitfalls Research

**Domain:** Client-side residential battery sizing calculator (NL, P1 meter data)
**Researched:** 2026-05-26
**Confidence:** HIGH for battery-modeling and P1/NL-data pitfalls (verified against DSMR specs, HomeWizard docs, NL saldering regulation, Sessy public specs). MEDIUM for UX/comparison pitfalls (informed by domain literature and competitor patterns). HIGH for GitHub Pages deployment (well-documented).

This file catalogs the failure modes that produce *confidently wrong* output — the kind of output that drives a user to buy the wrong battery. Programming bugs are secondary; modeling errors are primary.

---

## Critical Pitfalls

### Pitfall 1: Confusing cumulative meter readings with interval flows

**What goes wrong:**
DSMR/P1 telegrams report **cumulative** kWh totals (OBIS 1-0:1.8.1 "delivered to client T1", 1-0:1.8.2 "T2", 1-0:2.8.1/2.8.2 for "delivered by client"). A naive parser that treats those values as "kWh in this interval" will produce numbers that grow monotonically across the day — i.e. an average house "consumes" 12,000 kWh in a single 15-min slot. HomeWizard's CSV export can also include both cumulative `total_power_import_t1_kwh` style columns *and* derived 15-min deltas; mixing them silently breaks the simulation.

Conversely, some exports (e.g. provider kwartierwaarden CSVs from Vandebron, ANWB Energie, Eneco) are already pre-differenced *interval flows in kWh per 15-min*. Re-differencing those gives nonsense (first interval becomes huge, rest become near-zero or negative).

**Why it happens:**
- "kWh" is the unit for both representations.
- Headers don't always make it explicit ("Verbruik (kWh)" could be either).
- HomeWizard exports the same data in two adjacent columns and inviting the wrong choice.

**How to avoid:**
- Build an explicit format adapter per source (HomeWizard, Vandebron, ANWB, Eneco, Frank, Tibber export, Enexis MijnAansluiting). Each adapter declares `series_type: "cumulative" | "interval"`.
- After parsing, run a **monotonicity check**: if a series is declared `interval` but every value is ≥ previous, flag as probably cumulative.
- If declared `cumulative` but values ever decrease (other than a meter swap), flag.
- Surface the detected interpretation in the UI: "Detected: HomeWizard cumulative kWh totals, converted to 15-min intervals."

**Warning signs:**
- First interval has a value of thousands of kWh, rest are 0–2 kWh.
- Total import for one day equals roughly the cumulative meter reading itself.
- "Self-consumption" comes out >100% or <0%.

**Test fixtures (mandatory before Phase 2 ships):**
- HomeWizard CSV with cumulative T1/T2 + return T1/T2 columns.
- One provider export with pre-differenced 15-min `verbruik`/`teruglevering` columns.
- A malformed file where someone manually replaced commas with semicolons.

**Phase to address:** Parsing/normalization phase (Phase 2 in expected roadmap). This is the most expensive bug to discover late — every downstream chart is wrong.

---

### Pitfall 2: Sign convention errors on import vs export

**What goes wrong:**
Different sources encode "energy flowing out of the house to the grid" differently:
- HomeWizard P1: separate `total_power_export_kwh` column (always positive, conventional).
- Some smart-plug-style exports: a single `power_kw` column that goes **negative when exporting**.
- A few EU-format exports: a single `kwh` column with implicit sign by separate `direction` column.
- DSMR raw telegrams: separate OBIS codes 1.8.x for delivered *to* client and 2.8.x for delivered *by* client — both positive integers, semantics carried in the code.

A single sign flip anywhere — parser → normalized series → simulation — produces a result that is not just slightly off but **completely backwards**: the battery "charges from grid imports" and "discharges into solar peaks." Self-consumption goes deeply negative; alternatively the bug masks itself and just makes the battery look useless.

**Why it happens:**
- Vanilla TypeScript without a strong type wrapper around "directional kWh"; raw `number` everywhere invites flips.
- Reviewing it visually on a chart looks "reasonable" because energy histograms always look spiky and noisy.

**How to avoid:**
- Define a single canonical normalized shape: `{ timestamp, importKwh: number ≥ 0, exportKwh: number ≥ 0 }` per interval. Never a single signed `net` field in the core data model.
- Use a branded type (`type ImportKwh = number & { __brand: 'import' }`) or at least a class wrapper at the boundary between parser and simulator.
- Assert in unit tests: for a sample day with solar, `sum(exportKwh) > 0` and `sum(importKwh) > 0` and a midday interval has `exportKwh > 0 && importKwh == 0` (or close to it).
- Sanity sentinel: compute total import and total export over the whole file; if export > import for a typical NL household (which is plausible only with very large PV), surface a confirmation prompt.

**Warning signs:**
- Battery "charges" at night (when there's no solar export).
- Self-consumption % comes out negative or >100%.
- A solar-peak hour shows zero export.

**Phase to address:** Parser phase (Phase 2). Add invariant tests to CI.

---

### Pitfall 3: Treating capacity as usable energy (ignoring DoD and round-trip efficiency)

**What goes wrong:**
Naively modeling "Sessy 5 kWh" as a 5 kWh bucket where 1 kWh in equals 1 kWh out. The reality:
- Sessy 5 kWh has ~85% round-trip efficiency (some sources cite 88% at full load). So 1 kWh charged returns ~0.92 kWh × 0.92 kWh ≈ 0.85 kWh.
- LFP batteries are typically rated for ~90–100% DoD, but the *usable* capacity advertised already bakes DoD in — yet for the Custom battery option, users may enter nominal capacity, not usable.

The compound error: a "5 kWh" battery modeled as 5 kWh usable with 100% RTE will appear ~18% more effective than it really is. Multiplied over a year, that's the difference between recommending a 5 kWh and a 7 kWh model.

**Why it happens:**
- "Round-trip efficiency" is invisible in marketing copy; users assume 1:1.
- DoD is conflated with capacity in spec sheets.
- LiFePO4 popularity has trained people to assume "modern = lossless."

**How to avoid:**
- Battery model **must** include `nominalCapacityKwh`, `usableCapacityKwh` (or `dodFraction`), and `roundTripEfficiency`. Use them all in the simulator.
- Bookkeeping convention: store SoC in usable-kWh units (0 → `usableCapacityKwh`). On charge from grid/solar, subtract loss: `socDelta = chargeInputKwh × sqrt(rte)`. On discharge to home: `outputKwh = socDrawnKwh × sqrt(rte)`. (Splitting losses symmetrically across charge and discharge is the cleanest accounting; alternative is to apply full loss on discharge only — pick one and document it.)
- Default catalog entries pre-populated with verified specs; the Sessy 5 kWh default should be `nominalCapacityKwh: 5.0, usableCapacityKwh: 5.0, rte: 0.85, maxChargeKw: 2.2, maxDischargeKw: 1.7` (per Sessy public specs).
- In the result panel: show "Theoretical max if battery were lossless: X kWh shifted. Actual estimate: Y kWh shifted." So the user sees the gap.

**Warning signs:**
- Total kWh discharged > total kWh charged.
- "% of solar export captured" ≈ identical to "% of solar export delivered to home."
- Sanity test: charging 5 kWh battery with 6 kWh of solar surplus then drawing 6 kWh of evening load returns >5 kWh — it should return ~4.25 kWh.

**Phase to address:** Battery simulation phase (Phase 3). Unit-test the simulator with a known-input, hand-computed expected-output fixture.

---

### Pitfall 4: Ignoring max charge/discharge power (instantaneous capacity is not the same as throughput)

**What goes wrong:**
A 5 kWh battery is **not** "a bucket that empties when full." Sessy 5 kWh can only absorb 2.2 kW. If a household generates 4 kW of solar surplus at noon, only 2.2 kW (= 0.55 kWh per 15-min interval) goes into the battery; the remaining 1.8 kW continues to be exported. A naive simulation that just caps cumulative SoC at capacity will:
- Massively overstate shifted energy on sunny days (battery "absorbs" the entire 4 kW peak).
- Massively understate residual export.
- Make small batteries appear to track large batteries closely on sunny days, hiding the real differentiator between a 5 kWh and a 10 kWh unit.

Similarly on discharge: a 1.7 kW discharge cap means an evening 3 kW load (oven + dishwasher) still pulls 1.3 kW from the grid even if the battery is full.

**Why it happens:**
- The capacity number is what everyone talks about; power ratings are buried in datasheets.
- The math is harder: you can't just compare daily-sum solar export to daily-sum battery capacity; you have to walk intervals and clamp per-interval flows.

**How to avoid:**
- Simulator iterates per-interval; each interval clamps charge by `min(availableSurplusKwh, maxChargeKw × intervalHours, capacityRemainingKwh)` and discharge symmetrically.
- The interval resolution matters: at 15-min intervals you'll miss sub-interval peaks (a 6 kW solar burst that lasts 10 min then drops to 1 kW averages to a 2 kW interval — which the battery *can* absorb). Document this honestly: "We compute at the resolution of your data. Sub-interval peaks may be averaged out, slightly overstating capture."
- Test fixture: a synthetic file with one 15-min interval of `exportKwh = 1.5` (= 6 kW average) feeding a 2 kW-max battery should charge by `2 kW × 0.25 h = 0.5 kWh`, not 1.5 kWh.

**Warning signs:**
- On a sunny day, the simulated residual export = 0 even with a small battery.
- A 5 kWh and a 15 kWh battery produce nearly identical shifted-kWh totals.
- "kWh shifted" grows linearly with capacity well past what daily surplus could support.

**Phase to address:** Battery simulation phase (Phase 3). This is co-equal in importance with Pitfall 3.

---

### Pitfall 5: Off-by-one bucket alignment & DST handling

**What goes wrong:**
Three interlocking timestamp pitfalls:

1. **Convention drift.** Some sources stamp intervals at the *start* (00:00 = the 00:00–00:15 slot), some at the *end* (00:15 = same slot). Mixing two files with different conventions during merge gives ghost intervals.
2. **End-of-day misattribution.** A row stamped `2025-09-30 24:00:00` (or `2025-10-01 00:00:00`, depending on convention) might be the last interval of Sept or the first of Oct. Group-by-date silently shifts a day's worth of consumption.
3. **DST transitions in Europe/Amsterdam.** On the spring-forward Sunday (last Sunday of March), the local hour 02:00–03:00 *doesn't exist*. On the fall-back Sunday (last Sunday of October), the hour 02:00–03:00 occurs **twice** with the same wall-clock labels. A parser that uses naive local timestamps will either drop intervals (spring) or merge two distinct intervals (fall), corrupting one day per file by 4 × 15-min rows.

Provider exports inconsistently handle this. Some give UTC, some give CET/CEST without offset, some give local with offset. HomeWizard 15-min CSVs use local time without explicit TZ.

**Why it happens:**
- JavaScript `new Date("2025-10-26 02:30")` interprets in local timezone but is ambiguous on the fall-back day; the implementation will pick one of the two and silently lose the other.
- "It works for my March test file" → ship → first user uploads October data → silent corruption.

**How to avoid:**
- All internal timestamps are UTC `Date` objects (or epoch ms). Parsing layer is the only place that knows about Europe/Amsterdam.
- Use Temporal API or date-fns-tz / Luxon for the parsing layer. **Do not** use raw `new Date(string)` for ambiguous local strings — explicitly attach the `Europe/Amsterdam` zone.
- For ambiguous fall-back hours: detect that two rows have the same local wall-clock and treat the second as `+1h offset`, the first as the original offset.
- For spring-forward: detect that the local hour is missing; the simulator must not assume "23 intervals = bug."
- Document the convention (start-of-interval) and force-convert all sources to it.
- **Mandatory test fixture: one CSV that crosses the last Sunday of March 2026 (March 29) and one that crosses the last Sunday of October 2026 (October 25).** Without these, DST bugs ship.

**Warning signs:**
- A day's total import/export is suddenly 4 × 15-min slots too high or too low at the end of March or October.
- Day-by-day chart shows a one-day spike at DST transitions.
- Per-day interval count is not always 96 (and not always 92 or 100 on transition days).

**Phase to address:** Parser/normalization phase (Phase 2). Add the DST fixtures to CI fixtures *before* shipping the parser.

---

### Pitfall 6: NL CSV format quirks (semicolon delimiter, decimal comma, date format)

**What goes wrong:**
NL Excel exports almost always use:
- **Semicolon** (`;`) as field delimiter (because comma is decimal separator).
- **Decimal comma** (`0,256` not `0.256`) inside numeric values.
- **Date format `DD-MM-YYYY`** or `D/M/YYYY` (ambiguous with US `M/D/YYYY`).

A standard CSV parser configured for `,` delimiter and dot-decimals will fail silently in several ways:
- The whole file parses as a single column.
- Numbers parse as strings (`"0,256"`) and any arithmetic produces NaN or string concatenation.
- A date "03-05-2026" parses as either 3 May (NL) or March 5 (US) — and for any day ≤ 12, the mistake is undetectable.

HomeWizard's CSV export uses `.` as decimal point per their docs, but provider exports (Vandebron, Eneco) commonly use `,` — so format-specific adapters are needed.

**Why it happens:**
- Devs test with their own HomeWizard file, ship, then a user uploads a provider export.
- Modern CSV libraries auto-detect delimiter but date format is much harder to auto-detect.

**How to avoid:**
- Use a real CSV parser (Papa Parse) with explicit delimiter and quote configuration per format adapter. Don't roll your own.
- For decimal parsing: regex match `^-?\d+(,\d+)?$` in addition to dot variant.
- For dates: ISO 8601 is unambiguous; for `DD-MM-YYYY` or `MM-DD-YYYY` formats, require an explicit format string per adapter. If a value's day-component is > 12, you can lock the format; otherwise default to NL `DD-MM-YYYY` and surface the assumption ("Interpreting dates as DD-MM-YYYY (Dutch format). Toggle if wrong.").
- Test fixtures must include: NL provider CSV with `;` + decimal-comma; HomeWizard CSV with `,` + decimal-dot.

**Warning signs:**
- Parsed numbers are all NaN.
- All rows parse into a single column.
- Dates near month-start show suspicious clustering.
- Sum of monthly imports for a full year matches the meter reading off by exactly 365 days (date shift).

**Phase to address:** Parser phase (Phase 2). The adapter framework needs to support per-source delimiter/decimal/date configuration from day one.

---

### Pitfall 7: Wh vs kWh, W vs kW unit mismatches

**What goes wrong:**
P1 raw telegrams typically report in Wh and W. Most CSV exports convert to kWh and kW, but not all. A mixed Wh/kWh import silently inflates numbers by 1000×, making a typical 3500 kWh/yr household look like a small data center.

**Why it happens:**
- Column headers like `"Verbruik"` don't carry units; `"Verbruik (Wh)"` and `"Verbruik (kWh)"` differ by one character.
- Some adapters convert at parse time, others assume the simulator does it.

**How to avoid:**
- Normalize at the parser boundary to a single internal unit (kWh for energy, kW for power). The normalized record type makes units explicit.
- Sanity check on parse: typical NL household 1-day total import is 5–30 kWh. If a parsed day's total > 200 kWh, flag.
- Per-adapter unit metadata is part of the format declaration.

**Warning signs:**
- Annual consumption in thousands of MWh.
- Battery capacity gets emptied in 0.001 second.
- "Self-consumption: 0.0001%."

**Phase to address:** Parser phase (Phase 2). Sanity-check ranges as a downstream validation step.

---

### Pitfall 8: Multi-tariff (T1/T2) double-counting or undercounting

**What goes wrong:**
DSMR meters maintain separate registers for T1 (low/night/weekend) and T2 (normal/day). HomeWizard CSV may export them as separate columns. The total import for an interval is `T1 + T2`, not either alone.

Pitfalls:
- Adapter reads only T1 → undercount by ~60% (most usage is T2).
- Adapter reads T1 and T2 in different columns and sums them, but later a similar file has a single combined `total_import_kwh` column — adapter double-counts.
- Only one tariff is active in any given interval (the meter only increments one register at a time), so a file with both columns is correct to sum them. But a downstream tariff calculation that splits "this interval was T1 vs T2" needs the per-interval delta of each register — not the assumption "9pm = T1."

**Why it happens:**
- NL household tariff schedules vary (typically T2 = weekday 07:00–23:00, T1 = nights + weekends, but contracts differ).
- Single-tariff (enkeltarief) households have T1 always 0 — adapter that treats missing T1 as "bug" rejects valid files.

**How to avoid:**
- Adapter declares which columns to sum. Sum at parse time; downstream sees a single `importKwh` value.
- Treat tariff-split as a v2 concern (since we're kWh-only for v1, tariffs don't affect the simulation).
- Validate: if both T1 and T2 columns exist and one is always 0, treat as enkeltarief and pass-through.

**Warning signs:**
- Total daily import roughly half of expected.
- Total daily import exactly double-counted on test files.

**Phase to address:** Parser phase (Phase 2). Include both single-tariff and dual-tariff fixtures.

---

### Pitfall 9: Saldering on/off is not a binary "battery worthwhile or not"

**What goes wrong:**
A naive saldering toggle implies:
- Saldering ON: every kWh exported is worth a kWh imported (zero-cost), so a battery is never economically useful.
- Saldering OFF: every kWh exported is worth €0 (worst-case feed-in price), so a battery is maximally useful.

Both are wrong in 2026 reality:

**Saldering "ON" (current legal status through 2026):**
- Already capped to 64% offset in 2026 (per the political agreement).
- Subject to per-supplier **terugleverkosten** (feed-in surcharges) of €0.02–€0.18/kWh that effectively *penalize* exporting even with saldering active. Households with large PV systems can pay hundreds of euros/year in terugleverkosten regardless of saldering.
- Cannot offset *more* than your annual consumption; surplus beyond that pays only the low terugleververgoeding (€0.04–€0.08/kWh).
- Many contracts (especially fixed-price) have lower or zero terugleverkosten in exchange for lower feed-in compensation.

**Saldering "OFF" (2027+):**
- Minimum 50% of bare supply tariff is mandated through Jan 2030. Not zero.
- After 2030, "redelijke vergoeding" — variable by supplier.

A binary toggle that reports "kWh of grid import avoided" is honest. A binary toggle that reports "€ saved" or "is the battery worth it?" is misleading.

**Why it happens:**
- Saldering is genuinely complex; the political situation has shifted multiple times.
- "Saldering on/off" is intuitive language but elides the cap, the terugleverkosten, and the per-supplier variance.

**How to avoid:**
- v1 explicitly reports **kWh only** (already in scope). The saldering toggle changes the *narrative* around the result, not the result's units.
- Label the toggle precisely: "Saldering scenario: assume full netting of export against import" vs. "Saldering scenario: assume export has zero offset value."
- Include a small disclaimer near the toggle: "Saldering is being phased out in 2027 and is capped at 64% in 2026. Many contracts also charge terugleverkosten. This toggle simplifies the comparison; for € figures, see [future milestone]."
- Anti-feature: do not report any € figures in v1. (Already PROJECT.md scope.)

**Warning signs:**
- User testing reveals "so the battery is useless?" reaction to saldering-on result.
- Tempted to add a "€ saved" headline before the financial milestone is built.

**Phase to address:** Output/UX phase (Phase 4). Add the disclaimer copy *before* the saldering toggle ships. Domain copy review by someone NL-savvy is worth budgeting.

---

### Pitfall 10: Extrapolating partial-period data to a full year

**What goes wrong:**
A user uploads 6 weeks of February–March data, the calculator computes "kWh shifted = 110," and the user (or the UI) extrapolates to "≈ 950 kWh/year." But:
- Winter has near-zero solar surplus; the battery is barely used.
- The 110 kWh extrapolated × (52/6) overstates winter contribution if the user reads it as "per year."
- The honest extrapolation has to account for seasonality, which requires either ≥ 1 full year of data or a seasonality model — neither of which fits v1's scope.

Conversely, uploading July–August data extrapolated to a year overstates everything because peak solar months drive nearly all battery activity.

**Why it happens:**
- Users naturally want yearly numbers ("payback period," "per year savings").
- Extrapolation by ratio (period × 365/period_days) is trivial to code and dangerously seductive.

**How to avoid:**
- **Never auto-extrapolate to "per year" in v1.** Report results for the exact uploaded period: "Over the 43 days you uploaded (March 14 – April 26), the battery would have shifted X kWh."
- If users want a yearly estimate, show it only when ≥ 12 months are uploaded; otherwise show: "Upload a full year of data to see annual estimates."
- Show period coverage visibly: "Your data covers 43 days, mostly spring. Battery performance is highly seasonal — winter months see ~5× less activity than summer."
- For partial-year, include a calendar visualization showing which months are covered.

**Warning signs:**
- Roadmap PR adds a `/year` field without seasonality logic.
- Result UI shows a `× 12` or `× 365 / N` calculation anywhere.

**Phase to address:** Output/UX phase (Phase 4). Set this as an explicit anti-feature in the UI spec.

---

### Pitfall 11: Comparison table framing makes one battery look universally better

**What goes wrong:**
A side-by-side table that surfaces "self-consumption %" as the headline metric will rank a 10 kWh battery above a 5 kWh battery on nearly every household — even when the 5 kWh model gives 80% of the benefit at 50% of the cost. Common framing errors:

- **Headline metric is self-consumption %**, not "kWh of grid import avoided." Self-consumption % grows with capacity sublinearly (diminishing returns), but the headline doesn't show diminishing returns.
- **No price column.** A spec-driven comparison without €/Wh context can rank a €6,000 battery above a €2,500 battery without flagging the cost gap.
- **No "capacity per kWh shifted" efficiency ratio.** A user can't see that battery A delivers 850 kWh/yr at 5 kWh capacity and battery B delivers 920 kWh/yr at 10 kWh capacity — i.e. B is much less *capacity-efficient*.
- **All batteries displayed in same color/weight**, no indication of which is most-recommended for that user's data.

**Why it happens:**
- "Bigger is better" is the natural sort.
- Battery prices are out of scope for v1 (no € reporting), but the *user* knows the prices and will read more into the comparison than is there.

**How to avoid:**
- Headline metric: **"kWh grid import avoided per year of data"** (with explicit period framing per Pitfall 10).
- Secondary metrics: self-consumption %, residual import, residual feed-in.
- Add a "marginal capture rate" column: `shiftedKwh / capacityKwh`. This makes diminishing returns visible without involving €.
- Even though v1 omits €, show capacity column prominently — users will eyeball price-per-kWh themselves.
- Default sort: by `shiftedKwh` descending, but include the marginal rate so smaller batteries don't look uniformly worse.
- Recommend a single battery? **Don't, in v1.** Show the data; let the user decide. ("Recommendation engine" is a v2 concern with financial modeling.)

**Warning signs:**
- Default sort makes the most-expensive battery first every time.
- User testing: "so I should just get the biggest one, right?"
- No way for a user to tell at a glance that diminishing returns exist.

**Phase to address:** Output/UX phase (Phase 4). Comparison-table design review with at least one non-engineer NL user.

---

### Pitfall 12: P1-derived solar isn't true solar production

**What goes wrong:**
PROJECT.md notes: "P1-derived solar (no separate solar CSV in v1)." But what we can derive from P1 is **net export** to the grid (`grid_export`), which equals `solar_production - self_consumed_solar`. We **cannot** see the self-consumed portion — the appliance running during the solar peak invisibly reduces the export signal.

Implication for battery simulation: the "available solar surplus" the battery can charge from is `grid_export` (correct), but if the simulation pretends it's seeing total solar production, it will:
- Think the household is "solar-poor" because export is small even when production is large.
- Sometimes assume zero solar at moments when production is significant but fully consumed locally (e.g. an EV charging during a sunny midday).

For *this specific tool*, charging only from `grid_export` is actually the *correct* model — because we're simulating a behind-the-meter battery that charges from whatever excess flows back. The pitfall is in *language*: don't say "your solar production" anywhere in the UI; say "your solar export" or "energy returned to grid."

**Why it happens:**
- Marketing temptation to say "we analyzed your solar production."
- Charts labeled "solar generation" when they actually show grid export.

**How to avoid:**
- Strict terminology in code, in copy, in charts: `gridExport`, `gridImport`, `solarSurplus` (= same as export). Never `solarProduction`, `solarGeneration` in v1.
- Disclaimer near the result: "We use grid export as a proxy for solar surplus. Self-consumed solar (energy your house used while the sun was shining) is invisible to the smart meter and does not need to be modeled — the battery can only capture what would otherwise be exported."
- Document this assumption in PROJECT.md and reference it in the result UI.

**Warning signs:**
- "Solar production" appears in any UI string.
- Result text implies the calculator knows the user's PV array size.

**Phase to address:** Output/UX phase (Phase 4). Audit all strings during the copy review.

---

### Pitfall 13: Privacy promise broken by analytics, error reporting, or external resources

**What goes wrong:**
PROJECT.md states: "Privacy promise: uploaded CSVs never leave the browser." Several ways to silently break this:

- **Analytics script** (Plausible, GA, Umami) that captures form events including filename or content of file inputs. Many JS frameworks bubble file input metadata.
- **Sentry (or other error reporting) catches a parse error and includes the row data in the error context.** Real-world Sentry incidents have caught full CSV rows in `error.message` strings or `console.error(row)` calls. Sentry's PII scrubbing helps for known patterns (credit cards) but doesn't recognize energy meter readings as sensitive.
- **External font/CDN/CSS calls** that allow third-party domains to set referrer cookies or read URL fragments — minor but breaks the airtight-claim.
- **Chrome extension** with broad permissions can read DOM. Out of our control, but worth noting in the privacy copy.
- **Service worker** that caches uploaded files in IndexedDB without explicit user action and persists across sessions.
- **`drag-and-drop` events** that hand the File object to a third-party widget (e.g. an embedded uploader from a UI library).
- **`window.onerror` reporting** to any third party.

**Why it happens:**
- "Privacy" is treated as a feature flag rather than a continuous discipline.
- Standard frontend tooling (Sentry, Plausible) is added later in the project without privacy review.

**How to avoid:**
- **No third-party scripts in v1.** No analytics, no error reporting, no fonts from Google, no CDN dependencies. Bundle everything.
- If analytics is added later, use server-less, content-blind analytics (e.g. plain page-view counter via GitHub Pages access logs — already non-personal) and *never* event analytics that touch the file inputs.
- If error reporting is added, it must (a) be opt-in, (b) strip all parsed-row data from error contexts, (c) never include the parsed-data object or file content in error messages.
- Content Security Policy header set restrictively (in `<meta>` tag for GitHub Pages since we can't set HTTP headers). Block `connect-src`, `script-src` to self.
- Privacy verification: a manual test where the user opens DevTools → Network tab → uploads a CSV → confirms zero network requests fire during parse and compute. Automate this as a Playwright test if possible.
- Privacy copy: "Open your browser's Network tab and watch — uploading and processing your file makes zero network requests."

**Warning signs:**
- Any `<script src="https://...">` outside the build output.
- Any `fetch()` or `XHR` call in the parse or simulate paths.
- npm dependency that has a "telemetry" or "analytics" option enabled by default.
- Sentry, LogRocket, Datadog, Hotjar in dependencies.

**Phase to address:** Setup/scaffolding phase (Phase 1) — establish the no-third-party rule and the CSP. Re-verify in CI on every release.

---

### Pitfall 14: GitHub Pages base-path issues break asset loading

**What goes wrong:**
GitHub Pages serves project repos under `https://<user>.github.io/<repo>/`. Vite's default `base: '/'` produces absolute asset paths like `/assets/index-abc.js` — which 404 on GitHub Pages because the actual path is `/<repo>/assets/index-abc.js`. The site loads `index.html` then breaks silently with a white screen.

Adjacent issues:
- If the project is later moved to `<user>.github.io` (user/org pages, root-served), the `base` setting needs to change back.
- Custom domain (CNAME) requires `base: '/'` again.
- Direct navigation to a deep route (if any client-side routing is added) returns the 404.html page, not the SPA. (Likely not a v1 issue — single-page calculator — but flagging for later.)
- Browser cache: when `base` is wrong then fixed, users with cached `index.html` keep hitting 404 on assets. Cache-busting via Vite's content hashing helps but the HTML file itself needs no-cache headers (which GitHub Pages does send, but verify).

**Why it happens:**
- Local `npm run dev` and `npm run preview` work because they serve from `/`.
- The break only appears on actual GitHub Pages, often *after* you've claimed "it works."

**How to avoid:**
- Set `base: '/battery-calculator/'` (or whatever the repo name is) in `vite.config.ts`. Use an env-var fallback for local: `base: process.env.GITHUB_PAGES ? '/battery-calculator/' : '/'`.
- Deploy workflow uses `gh-pages` branch or `gh-pages` action; verify the workflow before relying on it.
- After every release: open the deployed URL in a fresh incognito window, hard reload, confirm assets load (check Network tab for any 404s).
- For deep links (not relevant in v1 but if hash-routing is added): use hash routes (`#/some-path`) rather than browser history routes. Hash routes don't require a 404.html fallback.
- Add `404.html` that copies `index.html` content as a defensive measure even if no SPA routing.

**Warning signs:**
- White screen on deploy, console shows `GET /assets/... 404`.
- Works on `localhost:5173` but not on `*.github.io`.
- Works on direct `index.html` URL but not on directory URL (or vice versa).

**Phase to address:** Setup/scaffolding phase (Phase 1). Deploy a "hello world" version *first*, before writing any parsing code, to confirm the deploy pipeline. Catching this in Phase 1 prevents a "we can't ship" panic in Phase 5.

---

### Pitfall 15: Glossy charts on noisy/sparse data erode trust

**What goes wrong:**
A "sample week energy flow chart" rendered as a polished area-chart can imply false precision. Specific failure modes:
- Smoothed curves on 15-min step data suggest continuous measurements.
- Filled areas under noisy curves create visually heavy "evidence" for what is statistically thin.
- A monthly-bars chart from 6 weeks of data shows partially-filled bars without flagging it.
- Tooltips with 2 decimal kWh ("1.27 kWh") imply precision the simulation doesn't have.

**Why it happens:**
- Default chart libraries (Chart.js, ApexCharts, Recharts) all favor visual polish.
- "Pretty chart" is satisfying to ship.

**How to avoid:**
- Step-style charts for energy interval data (not smoothed lines). Step matches the discrete measurement reality.
- Monthly bars: show calendar-coverage indicators (a horizontal segment under each month showing what fraction was uploaded).
- Round display values to 1 decimal kWh for results, 0 decimals for totals ≥ 100 kWh.
- "Sample week" should be labeled clearly: "Example week (week of Jul 14, the median-export week in your data)." Show *why* this week was chosen.
- A second small chart showing the residual flows (what the battery couldn't capture) — equally prominent — keeps the result honest.

**Warning signs:**
- Demo screenshots look amazing.
- Tooltips show 4 decimal places.
- Monthly bar chart with February at 1/3 height looks like "low February consumption" rather than "1/3 of February in dataset."

**Phase to address:** Output/UX phase (Phase 4). Chart-style review during design.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single-format parser (HomeWizard only), defer multi-format adapter framework | Faster Phase 2 ship | Every new format becomes a special-case branch; adapter framework retrofit is painful | Acceptable for *very first internal demo*; never for a v1 ship since multi-source is in scope |
| Skip DST fixtures because "the dev tested with summer data" | Faster Phase 2 ship | Silent data corruption on October files; user reports "weird numbers" with no clear cause | Never |
| Use `new Date(string)` instead of explicit timezone parsing | Less dependency weight | Wrong by 1 hour for half the year; ambiguous on DST transition | Never for this domain |
| Hardcode Sessy specs in simulator rather than data-driven catalog | Faster Phase 3 ship | Adding 5 more batteries requires code change per battery | Acceptable for Phase 3 prototype; not for v1 |
| Skip simulator unit tests with hand-computed expectations | Faster Phase 3 ship | Future refactors silently change battery output; comparison results drift | Never — this is the core value of the tool |
| Render numbers with full float precision (e.g. `2.3456789`) | Less formatting code | False precision; users distrust when they spot it | Never |
| Add a "yearly estimate" extrapolation for partial-period data | Easy to code, easy to ship | Misleads users into wrong battery; reputational damage | Never in v1 |
| Single signed `net_kwh` field in normalized data shape | Slightly less code | Sign bugs cascade silently | Never |
| Use a CDN-hosted chart library | Quick prototyping | Breaks privacy promise | Never |
| Skip CSP because "GitHub Pages doesn't let me set headers anyway" | One less thing to configure | Future analytics/Sentry addition silently leaks | Use `<meta http-equiv="Content-Security-Policy">` |
| "Auto-detect" CSV format from headers without explicit per-format adapter | Slick UX | Ambiguous files misclassified; debugging which adapter ran is nightmare | Use heuristic-then-confirm: detect, but show user what was detected and let them override |

---

## Integration Gotchas

Common mistakes when connecting to external services. (Sparse: v1 has no external integrations by design.)

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Browser File API | Assuming `file.text()` handles all encodings; NL files sometimes are Windows-1252 (cp1252) not UTF-8 | Read as ArrayBuffer, detect BOM, fall back to TextDecoder with `'windows-1252'` if UTF-8 produces replacement characters |
| Browser localStorage | Caching last-uploaded file content in localStorage "for convenience" | Don't. Persisting user data on-device beyond the active tab violates the privacy spirit. Catalog selections / preferences only |
| GitHub Pages deployment | Pushing built `dist/` to `main` branch | Use `gh-pages` branch or GitHub Actions deployment; keep source separate from build artifacts |
| Future: Service worker for offline | Caching uploaded CSV data in IDB | If added, scope SW to assets only; never cache user file content |
| Future: Battery price API | Calling external pricing API from client | Breaks privacy posture (third-party calls); bundle prices as JSON with last-updated date |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows. Scale here is per-file size, not user count.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Parsing large CSVs synchronously, blocking the main thread | UI freezes for several seconds; "page unresponsive" dialog | Use streaming parser (Papa Parse with `step` callback) and yield to event loop every N rows; consider Web Worker | A full year of 1-second P1 data is ~31M rows; even 15-min data for 3 years is ~100k rows |
| Holding full raw parsed data + normalized data + simulation result simultaneously | Memory pressure on mobile; tab killed | Discard raw after normalization; keep only the normalized series | ~250k intervals × 5 batteries × full result records ≈ tens of MB |
| Re-running the entire simulation on every UI toggle change | Sluggish toggle response | Memoize per (battery × saldering × period) tuple; invalidate only on input change | Becomes painful at 5+ batteries selected |
| Charting all intervals as individual points | Browser hang on render | Downsample to display resolution (Canvas-based libraries handle this; SVG libraries don't) | >5000 points crashes most SVG chart libs |
| Loading all chart libraries unconditionally | Slow first paint | Code-split charts; defer non-critical visualizations | Bundle > ~500 KB starts hurting GitHub Pages cold-load |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Parsing CSV with `eval` or `Function` (e.g. for "convert formula" features) | Arbitrary code execution from a crafted file | Never use dynamic evaluation; use a strict parser library |
| Rendering user-uploaded filename in HTML without escaping | XSS via filename like `<script>...</script>.csv` | Escape filenames in any UI display; use textContent not innerHTML |
| Custom battery spec form without input validation | Negative capacity, infinite-power battery → NaN cascade, possibly DoS-like memory blowup | Validate ranges: capacity 0.1–100 kWh, power 0.1–20 kW, efficiency 0.5–1.0, DoD 0.1–1.0 |
| Trusting CSV cell content as valid number → using in array index | Crashes / undefined behavior | Validate all parsed numbers with `Number.isFinite` |
| Service worker scope too broad if added later | SW cached old buggy version persists across user reloads | Scope SW carefully; include a kill-switch path |
| Embedding user-uploaded data in URL hash (e.g. for "shareable link") | Breaks privacy promise (URL gets logged in browser history, referrer headers leak) | Don't add share-link feature in v1; if added later, share-link must encode parameters only, never uploaded data |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Hiding the assumptions ("RTE 85%, DoD 100%, max charge 2.2 kW") behind the result | User can't sanity-check; trust evaporates when they spot a discrepancy | Show assumptions next to each result; collapsible "How we calculated this" panel |
| Recommending a specific battery as "best" | User feels manipulated, especially if the recommendation aligns with the most expensive option | Show data, let user decide; if recommendations come later, base on user-stated budget |
| Result page that loads with no progress indicator during long parses | User refreshes, loses upload | Visible progress: "Parsing row 12,000 of 35,000…"; disable interactions during compute |
| Error messages that say "parse failed" without context | User can't fix the upload | Errors that name the row, the column, the expected format: "Row 234: expected number in 'Verbruik (kWh)', got '0,432 kWh'. (Did you select the right format?)" |
| Battery catalog with marketing-style descriptions | Confuses the analytic context | Spec-driven cards: capacity, power, RTE, DoD, country of manufacture. One sentence of context, no marketing copy |
| Saldering toggle without explanation | User doesn't understand which scenario to use | Tooltip: "Saldering is the NL net-metering scheme being phased out by 2027. Toggle ON simulates today (2026); OFF simulates after phase-out, when surplus has lower compensation." |
| Comparison table without a "what does this mean for me?" interpretation | Numbers without narrative; user bounces | One-paragraph interpretation under the table written in plain language, referencing their data: "Over the 6 months of data you uploaded, the Sessy 5 kWh would have replaced 412 kWh of your grid imports — about 9% of your total consumption." |
| Showing only happy-path results | User doesn't see the tradeoffs | Always show residual import and residual feed-in alongside shifted kWh — the energy the battery *couldn't* capture is as informative as what it could |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces. Run this checklist before each phase transition.

- [ ] **CSV parsing:** Often missing decimal-comma handling, DST transition fixtures, multi-tariff handling, Wh/kWh sanity checks. Verify with all sample files in fixture set.
- [ ] **Battery simulation:** Often missing RTE, DoD, max charge/discharge power limits. Verify with hand-computed fixture: 1.5 kWh export interval into 2 kW Sessy should charge ~0.5 kWh after losses.
- [ ] **Sign conventions:** Often missing invariant checks. Verify: no normalized interval should have both `import > 0` and `export > 0` simultaneously (one direction at a time per interval).
- [ ] **Timezone handling:** Often missing DST fixtures. Verify: parse a file containing 2026-03-29 (spring forward) and 2026-10-25 (fall back); confirm 92 and 100 intervals respectively.
- [ ] **Saldering toggle:** Often missing disclaimer copy that explains it's a simplification. Verify: text near toggle mentions terugleverkosten exist and 2027 phase-out.
- [ ] **Period framing:** Often missing the warning that uploaded data is partial. Verify: result UI never shows a "/year" figure for <12 months of data.
- [ ] **Self-consumption vs grid-import-avoided:** Often missing the more honest framing. Verify: headline metric is "kWh grid import avoided"; self-consumption % is secondary.
- [ ] **Comparison table:** Often missing capacity-efficiency column. Verify: marginal capture rate visible without scrolling.
- [ ] **Privacy:** Often broken by added dependency. Verify: open Network tab on deployed site, upload a file, compute, confirm zero requests beyond initial asset load.
- [ ] **GitHub Pages deployment:** Often missing base-path config. Verify: incognito-fresh load of deployed URL renders correctly; deep paths work or are absent.
- [ ] **Battery catalog:** Often missing real-world verified specs. Verify: each catalog entry's RTE, DoD, max power cited to a source (datasheet URL in code comment).
- [ ] **Error messages:** Often generic. Verify: a malformed file produces an error naming the row, column, expected format, and one suggested fix.
- [ ] **Assumptions display:** Often hidden. Verify: every result number on screen can be traced to a displayed assumption (RTE, DoD, etc.).

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cumulative-vs-interval misclassification | MEDIUM | Add the adapter declaration & monotonicity check; re-test fixtures; release patch noting "earlier results may have been wrong for X format" |
| Sign convention flip | LOW–MEDIUM | Fix the parser; rebuild branded types; add the invariant test; results for affected formats become correct on next compute |
| Missing RTE/DoD/power limits | HIGH | All historical results conceptually wrong by 15–30%; cannot retroactively recompute without re-uploaded data. Best is to ship the fix, update the methodology page, and trust users will re-upload |
| DST bug | MEDIUM | Add Europe/Amsterdam-aware parser; re-test with DST fixtures; one day per file may be off in older results |
| Privacy leak (third-party script captured data) | HIGH (reputational) | Remove the script immediately; publish a transparent post-mortem; consider DPIA filing if PII actually transmitted; replace with bundle-only alternative |
| GitHub Pages base path | LOW | Fix `vite.config.ts`, redeploy; users hit-cached may need hard-reload |
| Wrong battery recommendation due to comparison framing | MEDIUM (reputational) | Restructure the comparison UI; consider a "what changed" note; don't silently change methodology |
| False precision in displayed numbers | LOW | Update formatting; ship in next release |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. (Phase numbering is suggestive; actual roadmap may differ.)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1: Cumulative vs interval | Phase 2 (Parsing) | Monotonicity check in adapter; UI shows detected interpretation |
| #2: Sign convention | Phase 2 (Parsing) | Branded types; invariant tests in CI |
| #3: Capacity ignoring DoD/RTE | Phase 3 (Simulation) | Hand-computed fixture test; assumptions visible in result UI |
| #4: Power limits ignored | Phase 3 (Simulation) | Per-interval clamping test; comparison across capacities shows differentiation |
| #5: DST / bucket alignment | Phase 2 (Parsing) | DST transition fixtures in CI |
| #6: NL CSV quirks (delimiter, decimal, date) | Phase 2 (Parsing) | Per-format fixtures including provider exports |
| #7: Wh vs kWh | Phase 2 (Parsing) | Normalized type + sanity range checks |
| #8: Multi-tariff T1/T2 | Phase 2 (Parsing) | Single-tariff and dual-tariff fixtures |
| #9: Saldering oversimplification | Phase 4 (Output/UX) | Disclaimer copy reviewed with NL user |
| #10: Period extrapolation | Phase 4 (Output/UX) | No `/year` figure for <12 months data; explicit period framing |
| #11: Comparison framing | Phase 4 (Output/UX) | Headline metric is grid-avoided kWh; marginal rate column present |
| #12: P1-derived "solar" terminology | Phase 4 (Output/UX) | String audit: no "solar production" anywhere |
| #13: Privacy leaks | Phase 1 (Setup) + every phase | No third-party scripts; CSP set; Network-tab verification before each release |
| #14: GitHub Pages base path | Phase 1 (Setup) | Hello-world deploy succeeds before any feature work |
| #15: Chart polish vs noise | Phase 4 (Output/UX) | Step charts for intervals; coverage indicators; rounded display |

---

## Sources

**P1 / DSMR / NL energy data:**
- [HomeWizard: How to export and use .CSV files](https://helpdesk.homewizard.com/en/articles/6664029-how-to-export-and-use-csv-files)
- [Dutch DSMR smart meter with P1 port — Domoticz Wiki](https://wiki.domoticz.com/Dutch_DSMR_smart_meter_with_P1_port)
- [Kwartierwaardes stroom downloaden — Jeroen.nl](https://jeroen.nl/blog/stroom-kwartierdata-verzamelen-downloaden-importeren-aanvragen)
- [DSMR-P1-parser (lvzon/dsmr-p1-parser)](https://github.com/lvzon/dsmr-p1-parser)
- [Kwartierwaarden uitleg — DuurzameTech.nl](https://duurzametech.nl/meer/terminologie/kwartierwaarden-gedetailleerd-inzicht-in-energieverbruik/)
- [Measuring Solar Panel Output With the P1 Port — Homey](https://homey.app/en-us/wiki/measuring-solar-panel-output-with-the-p1-port/)
- [P1 meter how to interpret values — Home Assistant Community](https://community.home-assistant.io/t/p1-meter-how-to-interpret-values/397437)

**Battery modeling:**
- [Round-Trip Efficiency Explained — Sunpal Energy](https://www.sunpal-energy.com/round-trip-efficiency-explained-why-your-energy-storage-system-loses-20-of-your-power/)
- [Battery Roundtrip Efficiency — HOMER Pro](https://support.ul-renewables.com/homer-manuals-pro/battery_roundtrip_efficiency.html)
- [Stop Guessing: 5 Common Home Battery Sizing Mistakes — Anern](https://www.anernstore.com/blogs/diy-solar-guides/home-battery-sizing-mistakes)
- [Sessy Home Battery — Ekiz Energie product page](https://ekizenergie.com/en/product/sessy-home-battery-5-kwh-white/)
- [Sessy Home Battery review (6 months use)](https://cloud-infra.engineer/6-months-sessy-home-battery-experience/)
- [Self-consumption vs self-sufficiency — Solar Monkey](https://solarmonkey.io/self-consumption-and-self-sufficiency-whats-the-difference/)
- [Self-sufficiency ratio: an insufficient metric for domestic PV-battery systems? (ResearchGate)](https://www.researchgate.net/publication/329174975_Self-sufficiency_ratio_an_insufficient_metric_for_domestic_PV-battery_systems)

**NL saldering / terugleverkosten:**
- [Salderingsregeling stopt in 2027 — Rijksoverheid](https://www.rijksoverheid.nl/onderwerpen/energie-thuis/salderingsregeling)
- [Alles wat je in 2026 moet weten over salderen — Vandebron](https://vandebron.nl/blog/alles-wat-je-nu-moet-weten-over-salderen)
- [Solar Panels in Netherlands 2026 guide — The Dutch Daily](https://thedutchdaily.nl/solar-panels-in-netherlands-2026-end-of-net-metering-return-costs-dynamic-pricing-guide/)
- [Terugleverkosten 2026 — Pure Energie](https://pure-energie.nl/groene-stroom/tarieven/terugleverbijdrage/)
- [Salderingsregeling — Milieu Centraal](https://www.milieucentraal.nl/energie-besparen/zonnepanelen/salderingsregeling-voor-zonnepanelen/)

**CSV / locale / timezone:**
- [How to change Excel CSV delimiter to comma or semicolon — Ablebits](https://www.ablebits.com/office-addins-blog/change-excel-csv-delimiter/)
- [Europe/Amsterdam DST 2026 — Daylight Savings reference](https://daylight-savings.com/eu/holland/amsterdam/)
- [Interval data conventions — Bayou Energy docs](https://docs.bayou.energy/docs/interval-data)

**GitHub Pages / Vite:**
- [Vite project showing 404 pages when uploaded to GitHub Pages — GitHub Discussions](https://github.com/orgs/community/discussions/61478)
- [GitHub Pages SPA 404s — Fix Base Path Issues — devactivity.com](https://devactivity.com/posts/apps-tools/unlocking-spa-deployment-solving-github-pages-404s-for-enhanced-engineering-productivity/)
- [Resolving Vite v5 Build 404 Error — Medium](https://medium.com/@aleksej.gudkov/resolving-vite-v5-4-2-build-404-error-e1f13914f2d7)

**Privacy / error reporting:**
- [Sentry — Protecting User Privacy in Session Replay](https://docs.sentry.io/security-legal-pii/scrubbing/protecting-user-privacy/)
- [Removing PII from Sentry — advena.hashnode.dev](https://advena.hashnode.dev/removing-personal-information-pii-from-sentry-error-monitoring-in-javascript)

---
*Pitfalls research for: client-side residential battery sizing calculator, Netherlands*
*Researched: 2026-05-26*
