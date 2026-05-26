# Feature Research

**Domain:** Home battery sizing calculator (Netherlands, consumer-facing, client-side, CSV-driven)
**Researched:** 2026-05-26
**Confidence:** HIGH for NL tool inventory and table-stakes; MEDIUM for anti-feature framing (synthesized from competitor pattern analysis, not user studies)

---

## Competitive Landscape Snapshot

This section grounds every table below. The relevant comparables fall into four camps:

| Tool | Type | Data input | Multi-battery compare | Lead capture | Notes |
|------|------|-----------|----------------------|--------------|-------|
| **mark-vis/thuisbatterij-simulatie** (GitHub Pages) | Open-source, client-side simulator | P1 CSV, slimmemeterportal XLSX, simplified CSV | No (single config per run, multiple scenarios) | None | Closest direct comparable. Chart.js, dynamic pricing focus, JS custom formulas. NL. |
| **jeroen.nl/stroomanalyse** | Hosted analyzer with account | HomeWizard, Tibber, SolarEdge, Enphase CSVs (auto-detect) | Implicit (battery size recommendation, not side-by-side) | Free account required, NL server | Polished UX, "personal vs assumptions" framing. |
| **bereken-thuisbatterij.nl, thuisbatterijgids.net** | Hosted estimator (no CSV) | Form wizard (kWh/year, panels, postcode) | No (single recommendation) | bereken-thuisbatterij.nl: offerteAdviseur upsell. thuisbatterijgids: light. | Multi-step wizards, payback as headline. |
| **Sessy keuzehulp, Zonneplan, Essent calculator** | Vendor calculators | Form (consumption, panels, contract) | No (their product only) | Quote/contact path | Vendor-biased — recommendations always point to own product. |
| **ESB Networks Home Battery Calculator** (ToxicStarknova, GitHub) | Open-source, client-side (Ireland) | ESB Networks HDF + PVGIS | Yes via "Battery Size Optimisation Chart" (capacity sweep) | None | Strong model for capacity sweep + 4 strategies. Not NL but closest pattern reference. |
| **OpenSolar / Energy Toolbase / PVsyst** | Pro installer software | Project-level, hourly sims | Yes (scenario comparison within "project") | Pro accounts | Reference for sample-week energy flow charts and scenario tabs. |

**Key gap our tool fills:** A vendor-neutral, client-side, NL-localized, *multi-battery side-by-side* comparison driven by the user's own CSV. mark-vis is closest but doesn't compare batteries side-by-side; jeroen.nl requires an account; vendor tools are biased.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these and a Dutch homeowner evaluating a battery will close the tab. These are baseline credibility.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **CSV upload via drag-and-drop OR file picker** | Every modern data tool offers both; non-technical users overwhelmingly prefer drag-and-drop while power users prefer click-to-browse. | LOW | Must include both. Show clear drop zone with hint text ("Sleep je CSV hier of klik om te kiezen"). |
| **Auto-detect of common NL formats** | jeroen.nl auto-detects HomeWizard, Tibber, SolarEdge, Enphase. mark-vis auto-detects P1, simplified CSV, and slimmemeterportal XLSX. Users will not manually pick "what format is my file." | MEDIUM | Start with HomeWizard P1 (per PROJECT.md), expand as samples arrive. Detection by header sniffing + delimiter + decimal style. |
| **Pre-upload format guidance** | Best-practice CSV uploaders set expectations *before* file selection (allowed types, sample, structure). Reduces failed-upload frustration. | LOW | Show "Supported formats: HomeWizard P1 CSV (15-min export)" with a link to a sample file and "How to export from HomeWizard" walkthrough. |
| **Visible, explicit privacy promise on the upload screen** | This is the headline differentiator AND a table-stake for the privacy-conscious NL audience. Tools that send data anywhere face immediate trust friction. | LOW | "Je bestand verlaat je browser niet" with short rationale, ideally near the drop zone, not buried in a footer. |
| **No account / no email required to see results** | bereken-thuisbatterij.nl, thuisbatterijgids.net, mark-vis, ESB calculator — all show results without signup. jeroen.nl is the outlier and loses casual evaluators. | LOW | Hard guarantee — never gate any output behind a form. |
| **Period-selectable analysis** | Users uploading a year of data want to look at "last summer" or "last winter" independently. Every serious tool offers a date range picker. | MEDIUM | Default to full uploaded range; provide a draggable/pickable sub-range. |
| **Battery selection from a known list** | Users do not know their battery's spec sheet by heart. Sessy keuzehulp, vendor tools, and jeroen.nl all surface a catalog. | LOW | Curated 6–10 NL-popular models (per PROJECT.md): Sessy 5/10 kWh, Zonneplan, Tesla Powerwall, Huawei Luna, Victron, etc. |
| **Numerical headline result** | Every calculator surfaces a 1–3 number headline. For our v1 kWh-only stance, the headline is **kWh shifted from grid**, **self-consumption %**, and **residual feed-in kWh**. | LOW | Three big numbers above the fold of the result view. |
| **Per-battery summary table** | Comparison is the central interaction (per PROJECT.md). Table is universal — every comparison-capable tool uses one. | LOW | Rows = batteries, columns = key metrics. Highlight differences. |
| **Saldering on/off toggle** | The reason this tool exists *right now* is salderingsregeling phaseout (Jan 1 2027, hard cliff). Every NL tool published in 2025–2026 has a before/after view. | LOW | Single binary toggle for v1 (per PROJECT.md). |
| **At least one chart** | Numbers answer the decision; charts build intuition. Both mark-vis and bereken-thuisbatterij include charts. A purely tabular result feels incomplete. | MEDIUM | v1: monthly self-consumption bars + sample-week energy flow line chart (see PROJECT.md). |
| **Transparent assumptions panel** | bereken-thuisbatterij.nl exposes 13+ assumptions in a collapsible panel; this is increasingly expected in NL energy tools because trust in vendor calculators is low. Open-source energy modeling literature emphasizes assumption transparency for trust. | LOW | Collapsible "Hoe is dit berekend?" with every constant the simulator uses (RTE, DoD, charge/discharge limits per battery, saldering treatment). |
| **Source-data sanity readout** | Users want to confirm their upload was read correctly before trusting results. Show: detected format, date range covered, total kWh import, total kWh export, gaps. | LOW | A 4–6 line summary card immediately after parse. Catches "I uploaded the wrong file" early. |
| **Mobile-readable result view** | NL audience often opens energy tools on mobile. Result tables must not require horizontal scroll on phones. | MEDIUM | Stack comparison rows vertically on narrow screens. |
| **Plain-Dutch labels throughout** | Audience is regular consumers, not engineers. "Round-trip efficiency" → "Heen-en-terug rendement" with a tooltip. | LOW | Localization pass before launch. Loanwords like "saldering," "salderen," "teruglevering" are fine — they are the household-familiar terms. |
| **Error handling for malformed/empty CSVs** | A blank screen on parse failure is the fastest way to lose a user. Every well-built upload tool surfaces "we couldn't read this — here's why." | LOW | Specific errors ("found 0 export rows," "timestamp column not recognized") with the parsed sample shown back. |

---

### Differentiators (Competitive Advantage)

Features that distinguish this tool from existing NL options. Each maps directly to a competitor gap identified above.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **True multi-battery side-by-side comparison** | No NL tool surveyed does this. mark-vis runs one battery config per simulation. Vendor calculators show only their own product. Our tool runs N batteries against the same dataset in one pass and presents them in one table. This is THE differentiator from PROJECT.md. | MEDIUM | UX caveat: keep visible set to ≤5 simultaneously (NN/G best practice). Above that, comparison cognitive load collapses. Use a chip-style selector. |
| **"Show differences" toggle on the comparison table** | Best Buy-style — highlight rows where batteries actually differ vs identical. Reduces cognitive load when comparing 3+ batteries with overlapping specs. | LOW | One checkbox above the table; CSS class toggle. |
| **100% client-side, verifiable** | Privacy is not just a claim — the static GitHub Pages deploy is auditable. We can say "open Network tab and watch: zero requests after the bundle loads." This is uncopyable by hosted/SaaS competitors. | LOW | Lean into it. A small "verify yourself" hint with instructions. Open-sourcing the repo amplifies trust. |
| **Vendor-neutral catalog with no upsell** | bereken-thuisbatterij.nl funnels to OfferteAdviseur. Vendor tools recommend their own product. We list batteries with their specs and let the simulation decide. No "request quote" button anywhere. | LOW | Catalog JSON includes manufacturer URLs for *spec verification*, not lead-gen. |
| **Saldering on vs off shown as two columns, not two runs** | Existing tools require re-running with the toggle flipped. Showing both side-by-side in the same comparison table answers "is this battery still worth it after 2027?" in one glance. | MEDIUM | Doubles result columns (2 per battery: salderen on / off) OR adds a "saldering scenario" grouping. Decide in design phase based on table density. |
| **Honest "kWh only, no euros" framing in v1** | Every competitor leads with payback period in years — based on assumed tariffs that age badly. Our v1 explicitly leads with kWh and *says why we don't show euros yet*. This is contrarian honesty that builds trust with the financially literate audience. | LOW | Requires an explainer card on the result page: "We tonen geen euro's omdat tariefaannames per huishouden enorm verschillen. v2 zal dynamische tariefdata ondersteunen." |
| **Sample-week energy flow chart** | OpenSolar/PVsell research shows sample-day/sample-week beats yearly averages for intuition: users see "ah, on a sunny Saturday the battery filled by 11am and was empty by 9pm." Most NL consumer tools skip this entirely. | MEDIUM | Stacked area or line chart: solar produced, home consumed, battery SoC, grid import, grid export — over 7 days. Auto-pick a "representative sunny week" or let user pick. |
| **Side-by-side monthly self-consumption bars** | Grouped bar chart with one cluster per month, one bar per battery. Shows seasonality + battery sizing tradeoff in one image. | MEDIUM | Chart.js or similar. Color per battery, consistent across all charts. |
| **Multi-file merge with overlap resolution** | PROJECT.md specifies higher-resolution wins on overlap. jeroen.nl supports multi-file matched on timestamp but doesn't articulate overlap policy. Stating and visualizing the policy is a small differentiator. | MEDIUM | Show in the data sanity readout: "3 files merged, 14 days of overlap resolved using P1 data (higher resolution)." |
| **Shareable / reproducible result URL** | If config (selected batteries, saldering toggle, date range) is encoded in URL hash, users can share specific scenarios. No data leaves the browser because the CSV is not in the URL — only the configuration. | LOW | URL hash with JSON config; CSV stays in-memory only. |
| **Export results as CSV / PNG** | mark-vis exposes drill-down; ESB calculator exports HDF for downstream tariff tools. Lets advanced users take results to a spreadsheet for their own euro modeling — partial substitute for our v1 not having euros. | LOW | "Download comparison as CSV" button. |
| **Sessy 5 kWh as default + visible default-battery rationale** | Smart default reduces decision paralysis. Showing *why* this is the default ("NL-made, modular, fits ~3500 kWh/yr row-house") models the tool's reasoning. | LOW | One-line caption under the default selection. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that exist in competing tools but should be deliberately **not built**. Each includes the alternative.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Email/account gate before showing results** | Common growth tactic; jeroen.nl uses a free account, lead-gen calculators capture before reveal. Marketing logic: captured email = qualified lead. | Destroys the trust premise of this tool. Audience is researching skeptically; an email wall reads as "they're selling something." Also incompatible with the no-server privacy stance — collecting emails means a backend. | No gate, ever. Optional "save your scenario as a URL" instead of "save your scenario to your account." |
| **"Get a quote" or "Compare offers" CTA after results** | Standard NL energy site pattern (bereken-thuisbatterij → OfferteAdviseur, vendor tools → contact form). Common revenue path. | Re-introduces vendor bias the comparison-view differentiator was built to remove. Users will assume the simulation is rigged toward whichever battery the affiliate pays best. | Link out to each manufacturer's own spec page for verification; do not list resellers. |
| **Vendor-recommended "best battery for you" verdict** | Every form-based NL calculator picks a winner. Users like a clear answer. | A single verdict requires assumptions about tariffs, usage patterns, and backup priorities the tool doesn't yet model. A false-precision recommendation undermines the "we show the math" stance. | Surface metrics; let the user read the comparison and decide. Highlight which battery wins on each metric individually (most kWh shifted, best fit for current usage, smallest residual import) — but don't synthesize a single winner. |
| **Payback period / ROI / euro savings in v1** | THE headline metric on every NL competitor's result page. Audience deeply wants it. | Per PROJECT.md, v1 is kWh-only because euros need dynamic-pricing data we won't have until a later milestone. Showing euros with hand-waved tariff assumptions is exactly the dishonesty competitors are doing. | Explicit "why no euros yet" framing on results page. Promise euro support in a future milestone. Export-to-CSV lets advanced users do their own euro math. |
| **Account-saved scenarios / history** | Convenience feature; users uploading a year of data don't want to re-upload to revisit. | Requires a backend (violates "no server-side" constraint) or browser storage of CSV data (violates privacy framing if not extremely carefully scoped). | Shareable URL with config (not CSV) is the privacy-safe equivalent. Browser-local cache of the last-parsed dataset is acceptable IF clearly disclosed and clearable. |
| **Auto-fetch from HomeWizard / Tibber API** | Convenience: skip the CSV download step entirely. Some tools do this. | Requires user OAuth/credentials, which means either a backend or storing tokens in the browser; both undermine the "data never leaves" promise and the static-hosting model. | Best instructions to *export* the CSV. Make the export-and-upload flow as fast as possible. |
| **Real-time / live data dashboard** | "Mijn-thuisbatterij.nl" style — live monitoring. | Out of scope: this tool answers "should I buy a battery?", not "how is my existing battery doing?" Different product. | Stay focused on the sizing decision. |
| **Full physical battery model (degradation, temperature, inverter losses)** | Engineers will ask for it. | Per PROJECT.md, overkill for a consumer-grade sizing tool; complicates the explainer; longer simulation time. | Capacity + power + RTE + DoD model; document the simplification in the assumptions panel; link to PVsyst for users who want full fidelity. |
| **Battery brand reviews / star ratings / "Consumer reports"** | Trust-building feature on review sites. | Outside the tool's competence. Reviews date quickly and require maintenance. | Stick to specs (verifiable, slow-changing). |
| **Year-by-year saldering phaseout schedule modeling in v1** | More accurate than on/off toggle. | Per PROJECT.md, v1 keeps saldering as on/off. The phaseout schedule has been politically volatile (originally gradual, then 2027 cliff). A simpler toggle is more honest than a precise wrong model. | On/off toggle now; richer saldering modeling in a later milestone if the policy stabilizes. |
| **Solar production CSV upload (separate from P1)** | More accurate self-consumption modeling with inverter data. | Per PROJECT.md, v1 derives solar from P1 net flows. Adds parser surface area and confusion about which file goes where. | P1-derived solar in v1; defer to future milestone. |
| **Non-NL formats / regions** | Bigger addressable market. | Per PROJECT.md out-of-scope. Each region adds a parser, a battery catalog, a tariff model, a regulatory explainer. | NL-only v1; revisit after PMF. |
| **PDF report download** | bereken-thuisbatterij.nl offers one. Feels professional. | Adds a PDF dependency (jsPDF or similar) for marginal value. CSV + PNG export from result charts covers the use case. | "Print to PDF" via browser print stylesheet — zero dependencies, works fine. |
| **Tariff-aware "arbitrage" simulation (dynamic pricing buy-low/sell-high)** | mark-vis does this; some NL audiences with Tibber/Frank want it. | v1 is kWh-only and self-consumption-only. Arbitrage needs price data, fundamentally a different simulation mode. | Document as future milestone. The current saldering-on/off toggle covers the main 2027 question. |

---

## Patterns Worth Borrowing (Specific UX Patterns)

These are concrete UX patterns surfaced by competitor research, mapped to our v1 scope.

### Multi-battery comparison view (the central interaction)

- **Cap visible batteries at 5** (NN/G research consensus). PROJECT.md says "select multiple batteries to compare side-by-side" — pair with a chip-based selector that visibly limits to ~5 active comparisons.
- **Layout: rows = metrics, columns = batteries** (or transpose if there are only 2 batteries — fewer columns scan better). Let users see all metrics for one battery in one column.
- **"Show only differences" toggle** (Best Buy pattern). Hides rows where all batteries are within e.g. 2% of each other.
- **Color-per-battery, consistent across charts and table.** Don't make the user re-decode which color means which battery in each chart.
- **Per-row "winner" indicator** (subtle, not a green vs red gradient — a small checkmark or bold value). Surfaces the metric leader without synthesizing a verdict.

### Battery simulation outputs

- **Three big numbers above the fold:** kWh shifted, self-consumption %, residual import. Per-battery if comparing.
- **Monthly grouped bars** for seasonality intuition. PVsell, OpenSolar, ESB calculator all do this.
- **Sample-week energy flow chart** with: solar production, home load, battery SoC, grid import, grid export. OpenSolar's daily energy flow chart is the canonical pattern; "specific weeks beat yearly averages for intuition" is a documented finding. Auto-pick a sunny representative week with a "pick another week" control.
- **Drill-down hierarchy** (mark-vis pattern): monthly view → daily detail → hourly/15-min. Optional for v1 but a smart progressive-disclosure structure.
- **Avoid Sankey diagrams in v1.** Look impressive, hard to interpret correctly, fragile on mobile. Reconsider in v2 if a designer can validate.

### Upload-your-own-data UX (trust for non-technical users)

- **Visible drop zone with explicit "or click to browse" affordance.** Both interactions, one component.
- **Privacy promise next to the drop zone**, not in a footer. "Je bestand wordt lokaal verwerkt. Niets wordt geüpload." Optional small icon (closed-lock).
- **"How do I get this file?"** link next to the drop zone, with step-by-step for HomeWizard initially. Reduces "I don't know how to start" abandons.
- **Sample file link** for verification ("Test the tool first with this sample CSV"). Lets the curious-but-cautious play before uploading their own data.
- **Immediate post-parse readout** before showing battery selection: "Read 14,235 rows from 2025-01-01 to 2025-12-31. Total import: 3,420 kWh. Total export: 2,180 kWh. No gaps detected." This is both a sanity check and a trust signal (we read your data correctly).
- **Specific parse errors with what we found.** Not "invalid file" — "We expected a column called 'Export kWh' but didn't find one. Found columns: [list]."

### "I don't know my battery specs" path

- **Curated catalog as default path; "Custom" as escape hatch** (per PROJECT.md). Vendor + 6–10 popular NL models cover ~95% of evaluating users.
- **Default to Sessy 5 kWh** (per PROJECT.md) with one-line rationale shown.
- **Catalog entries show: brand, model, capacity (kWh), max charge/discharge (kW), DoD, RTE, manufacturer URL.** No price (prices change; we're not a reseller).
- **Custom config in a single expandable panel** with the same 4–5 fields. Pre-fill from the closest catalog entry the user last selected so "Custom" is not a blank slate.
- **No specs at all? Show generic small/medium/large presets** as a third option (5/10/15 kWh with sensible default kW and 90% RTE). Lets users explore without committing to a brand.

### Explaining saldering on vs off to non-experts

- **One-line preamble on the toggle:** "Saldering eindigt 1 januari 2027. Vergelijk hoe een batterij scoort in beide scenario's." No long explainer required at the toggle — context is established.
- **Both scenarios visible in the result, not one-or-the-other.** Two columns per battery (saldering on / saldering off) or a stacked-bar with both. Showing both removes the "ok but what about after 2027?" follow-up question.
- **Plain language in the explainer panel:** "Met saldering: elke kWh die je teruglevert telt 1-op-1 mee tegen je verbruik. Zonder saldering: je krijgt alleen de teruglevertarief (vaak ~30% van de inkoopprijs), dus elke kWh die de batterij thuis houdt is veel meer waard."
- **Don't model the year-by-year phaseout.** PROJECT.md correctly defers this. The political schedule has shifted from gradual to cliff; a simpler model ages better.

---

## Feature Dependencies

```
[CSV upload] (table stake)
    |
    +--> [Auto-detect format]
    |       |
    |       +--> [Format-specific parsers] (HomeWizard P1 first; more as samples arrive)
    |
    +--> [Multi-file merge with overlap resolution]
    |       |
    |       +--> [Higher-resolution-wins policy]
    |
    +--> [Post-parse sanity readout] (depends on parsed timeseries)
            |
            +--> [Period selector] (depends on parsed range)
                    |
                    +--> [Simulation engine]
                            |
                            +--> [Battery catalog selection] OR [Custom battery config]
                            |       |
                            |       +--> [Multi-battery selection] (table-stake: comparison)
                            |
                            +--> [Saldering on/off toggle]
                            |
                            +--> [Per-battery results: kWh shifted, self-consumption %, residual import]
                                    |
                                    +--> [Comparison table] (differentiator)
                                    |       |
                                    |       +--> [Show-differences toggle]
                                    |
                                    +--> [Monthly bar chart]
                                    |
                                    +--> [Sample-week energy flow chart]
                                    |
                                    +--> [Transparent assumptions panel]
                                    |
                                    +--> [CSV / PNG export]
                                    |
                                    +--> [Shareable URL with config]

[Privacy promise UI] ──enhances──> [CSV upload] (trust signal at drop zone)

[Format auto-detect] ──enables──> [Multi-file merge] (need to know what's in each file)

[Curated catalog] ──conflicts──> [Vendor "recommend best battery" verdict] (anti-feature)

[Account system] ──conflicts──> [Privacy promise] AND ──conflicts──> [Static GitHub Pages hosting]
```

### Dependency Notes

- **CSV upload requires auto-detect:** non-technical users will not pick a format. Auto-detect is gating.
- **Multi-file merge requires overlap policy:** the policy (higher-resolution wins) is a decision the comparison's correctness depends on. Document it in the sanity readout.
- **Period selector requires parsed timeseries:** can only narrow what's been read.
- **Comparison table requires multi-battery selection:** trivial single-battery view is not the value prop.
- **Saldering scenarios pair naturally with comparison table:** two scenarios × N batteries is one view, not two views.
- **Charts require simulation outputs:** all chart features sit downstream of the simulator.
- **Shareable URL requires config-only encoding** (not CSV) to preserve privacy.
- **Account system would conflict with privacy promise AND with the static-hosting constraint.** Listed as a hard "do not add" boundary.

---

## MVP Definition

### Launch With (v1)

Minimum to validate the proposition: "vendor-neutral, client-side, multi-battery, NL-localized comparison."

- [x] **Drag-and-drop CSV upload with file-picker fallback** — table stake
- [x] **HomeWizard P1 CSV auto-detect and parse** — single format to start (per PROJECT.md)
- [x] **Multi-file merge with higher-resolution-wins overlap policy** — per PROJECT.md
- [x] **Visible privacy promise at upload step** — uncopyable trust differentiator
- [x] **Post-parse sanity readout** (rows, date range, total import/export, gaps) — trust + error catching
- [x] **Period selector** defaulting to full range — per PROJECT.md
- [x] **Curated battery catalog** (~6–10 NL models) with Sessy 5 kWh default — per PROJECT.md
- [x] **Custom battery config** with capacity/kW/RTE/DoD — per PROJECT.md
- [x] **Multi-battery selection** (cap visible at 5) — central interaction per PROJECT.md
- [x] **Saldering on/off toggle, both scenarios visible** in results — the 2027 question
- [x] **Comparison table** with self-consumption %, kWh shifted, residual grid import, residual feed-in — per PROJECT.md
- [x] **Monthly self-consumption bar chart** (grouped per battery) — per PROJECT.md
- [x] **Sample-week energy flow chart** — per PROJECT.md
- [x] **Transparent assumptions panel** (collapsible) — competitive differentiator + trust
- [x] **"Why no euros yet" explainer** on results page — honest framing
- [x] **Mobile-readable result layout** — table stake
- [x] **Plain-Dutch labels** with tooltips for technical terms — table stake
- [x] **Specific error messages** on parse failure — table stake
- [x] **No account, no email gate, no quote CTA** — anti-feature guarantee

### Add After Validation (v1.x)

Features to add once v1 confirms the proposition is valued.

- [ ] **Additional NL CSV format parsers** (Essent, Eneco, Vandebron, Tibber, slimmemeterportal XLSX) — trigger: user feedback on which formats are blocking adoption
- [ ] **"Show only differences" toggle** on comparison table — trigger: feedback that 4–5 batteries feels cluttered
- [ ] **Shareable URL with config** — trigger: any user request to "save this view" or to share scenarios
- [ ] **CSV / PNG export of results** — trigger: power-user requests to do euro math elsewhere
- [ ] **Capacity sweep chart** (ESB-style "Battery Size Optimisation Chart": x = capacity, y = kWh shifted, one line per battery family) — trigger: users wanting to find their "sweet spot" capacity
- [ ] **Generic small/medium/large battery presets** for users without a brand in mind — trigger: catalog feels too brand-specific
- [ ] **"Pick another sample week" control** for the energy-flow chart — trigger: users wanting winter vs summer comparisons

### Future Consideration (v2+)

Defer until product-market fit established and the kWh-only model is validated.

- [ ] **Euro / payback modeling** with static and dynamic tariff support — biggest deferred feature; PROJECT.md explicitly future
- [ ] **Dynamic tariff support** (Tibber, ANWB Energie, Frank) with price-data import — required for euros
- [ ] **Year-by-year saldering phaseout modeling** — only if NL policy stabilizes enough to make precise modeling honest
- [ ] **Separate solar production CSV** (Enphase, SolarEdge, Growatt) — currently P1-derived, better fidelity later
- [ ] **Daily heatmap visualization** (24h × 365 day grid) — high information density, mobile-hostile, advanced users only
- [ ] **Battery degradation curves** over a multi-year horizon — only if a designer can keep it intuitive
- [ ] **Non-NL regions (BE, DE)** — explicit deferred per PROJECT.md; each region is a large scope addition

---

## Feature Prioritization Matrix

Selected features only; not exhaustive.

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CSV upload + drag-drop | HIGH | LOW | P1 |
| HomeWizard P1 parser | HIGH | MEDIUM | P1 |
| Privacy promise UI | HIGH | LOW | P1 |
| Post-parse sanity readout | HIGH | LOW | P1 |
| Period selector | MEDIUM | LOW | P1 |
| Battery catalog | HIGH | LOW | P1 |
| Custom battery config | MEDIUM | LOW | P1 |
| Multi-battery selection | HIGH | LOW | P1 |
| Saldering toggle with both visible | HIGH | MEDIUM | P1 |
| Comparison table | HIGH | MEDIUM | P1 |
| Monthly bar chart | HIGH | MEDIUM | P1 |
| Sample-week energy flow chart | HIGH | MEDIUM | P1 |
| Transparent assumptions panel | HIGH | LOW | P1 |
| "Why no euros yet" framing | MEDIUM | LOW | P1 |
| Plain-Dutch labels + tooltips | HIGH | LOW | P1 |
| Specific parse errors | HIGH | LOW | P1 |
| Show-only-differences toggle | MEDIUM | LOW | P2 |
| Shareable URL with config | MEDIUM | LOW | P2 |
| CSV / PNG export | MEDIUM | LOW | P2 |
| Additional NL CSV parsers | MEDIUM (per format) | MEDIUM | P2 |
| Capacity sweep chart | MEDIUM | MEDIUM | P2 |
| Generic battery presets | LOW | LOW | P2 |
| Euro / payback modeling | HIGH | HIGH | P3 (deferred per PROJECT.md) |
| Dynamic tariff support | HIGH | HIGH | P3 |
| Year-by-year saldering phaseout | LOW | HIGH | P3 |
| Separate solar CSV upload | MEDIUM | HIGH | P3 |
| Daily heatmap | LOW | MEDIUM | P3 |

**Priority key:** P1 = launch; P2 = add post-launch when validated; P3 = future milestone

---

## Competitor Feature Analysis

| Feature | mark-vis (closest comparable) | jeroen.nl | bereken-thuisbatterij.nl | Vendor calculators (Sessy/Zonneplan/Essent) | Our Approach |
|---------|------|------|------|------|------|
| **Client-side processing** | Yes | No (NL server) | Yes | Yes (mostly form-based) | Yes — explicit hard constraint |
| **CSV upload** | Yes (P1, simple, XLSX) | Yes (multi-format auto-detect) | No (form wizard) | No | Yes (HomeWizard P1 v1, more later) |
| **Auto-detect format** | Yes | Yes (best in class) | N/A | N/A | Yes |
| **Multi-battery side-by-side** | No (one config per run) | No (recommends one) | No (recommends one) | No (own product only) | **Yes — primary differentiator** |
| **Curated battery catalog** | Limited (custom-focused) | Yes (separate compare page) | Yes (60+ models) | N/A (their product) | Yes (6–10 NL models + custom) |
| **Saldering on/off** | Yes (two pricing modes) | Yes (current vs post-2027) | Yes (toggle) | Yes (typically) | Yes — and both visible simultaneously |
| **Account required** | No | Yes (free) | No | Quote/contact path | **No, ever** |
| **Lead capture** | None | Account signup | OfferteAdviseur upsell | Yes (sales funnel) | **None** |
| **Euro / payback** | Yes (deep) | Yes | Yes (headline) | Yes (headline) | **No in v1** (honest stance), euros in v2 |
| **Transparent assumptions** | Yes (open-source code) | Partial | Yes (collapsible) | Partial | Yes (collapsible panel) |
| **Sample-week / daily energy flow** | Yes (drill-down) | Partial | No | No | Yes (sample-week chart) |
| **Monthly bars** | Yes | Yes | No | Sometimes | Yes |
| **Vendor neutrality** | Yes | Mostly | Mixed (links to offers) | No (vendor-biased) | Yes — no resellers linked |
| **Shareable URL** | No | No (account-based) | No | No | Planned P2 |
| **Open source** | Yes (GitHub) | No | No | No | Recommended (amplifies privacy trust) |

---

## Sources

Competitor tools analyzed:
- [mark-vis Thuisbatterij Simulatie (custom data)](https://mark-vis.github.io/thuisbatterij-simulatie/custom_data.html) — closest open-source NL comparable
- [mark-vis Thuisbatterij Simulatie (technical details)](https://mark-vis.github.io/thuisbatterij-simulatie/technical.html) — simulation outputs and pricing modes
- [jeroen.nl Stroomanalyse](https://jeroen.nl/energie/stroomanalyse) — multi-format auto-detect, account-based
- [jeroen.nl thuisbatterij vergelijken](https://jeroen.nl/energie/opslaan/thuisbatterij/vergelijken) — consultative comparison
- [thuisbatterijgids.net calculator](https://thuisbatterijgids.net/calculator/) — multi-step wizard, assumptions panel
- [bereken-thuisbatterij.nl](https://bereken-thuisbatterij.nl/) — form wizard with affiliate funnel
- [Essent thuisbatterij berekenen](https://www.essent.nl/thuisbatterij/berekenen) — vendor form calculator
- [Sessy thuisbatterij keuzehulp](https://www.sessy.nl/) — vendor calculator
- [Zonneplan thuisbatterij capaciteit](https://www.zonneplan.nl/thuisbatterij/capaciteit) — vendor form
- [UGent Lemcko batterij-calculator](https://www.ugent.be/ea/emsme/lemcko/nl/onderzoek/rekentools/batterij-calculator.htm) — research-grade simple calc
- [Home Battery Calculator (ESB Networks, ToxicStarknova)](https://github.com/ToxicStarknova/homebatterycalculator) — Irish open-source, capacity sweep pattern
- [OpenSolar battery modeling docs](https://support.opensolar.com/hc/en-us/articles/12382460685455-How-OpenSolar-Models-Battery-Energy-Storage) — hour-by-hour simulation
- [HomeWizard CSV export docs](https://helpdesk.homewizard.com/en/articles/6664029-how-to-export-and-use-csv-files) — primary v1 input format reference

UX pattern sources:
- [NN/G Comparison Tables for Products, Services, and Features](https://www.nngroup.com/articles/comparison-tables/) — ≤5 items rule, layout best practices
- [Smashing Magazine: Designing The Perfect Feature Comparison Table](https://www.smashingmagazine.com/2017/08/designing-perfect-feature-comparison-table/) — comparison patterns
- [LogRocket: feature comparison tables UX](https://blog.logrocket.com/ux-design/ui-design-comparison-features/) — highlight differences toggle
- [Smashing Magazine: Designing An Attractive And Usable Data Importer](https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/) — CSV upload UX
- [Eleken: File upload UI tips](https://www.eleken.co/blog-posts/file-upload-ui) — drag-and-drop + fallback patterns
- [OneSchema: Building a CSV uploader](https://www.oneschema.co/blog/building-a-csv-uploader) — pre-upload guidance, error messaging
- [ImportCSV: Data import UX](https://www.importcsv.com/blog/data-import-ux) — non-technical user patterns

Domain / regulatory context:
- [Frank Energie: afschaffing salderingsregeling 2027](https://www.frankenergie.nl/nl/kennisbank/zonnepanelen/afschaffing-salderingsregeling) — Jan 1 2027 hard cliff (no gradual phaseout)
- [Zonneplan: impact afschaffen salderen](https://www.zonneplan.nl/thuisbatterij/de-impact-van-afschaffen-salderen) — battery rationale post-saldering
- [Solar2LED: salderingsregeling stopt 2027](https://solar2led.nl/thuisbatterij/salderingsregeling-stopt-in-2027-wat-betekent-dit-voor-je-zonnepanelen/) — consumer impact framing

---

*Feature research for: NL home battery sizing calculator (consumer, client-side, vendor-neutral)*
*Researched: 2026-05-26*
