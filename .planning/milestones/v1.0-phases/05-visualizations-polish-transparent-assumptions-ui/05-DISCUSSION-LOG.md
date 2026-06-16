# Phase 5: Visualizations, Polish, Transparent-Assumptions UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 5-Visualizations, Polish, Transparent-Assumptions UI
**Areas discussed:** Sample-week flow chart, Monthly self-consumption bars, Assumptions + "geen euro's" panel, Dutch vocabulary & tooltips

---

## Sample-week flow chart (VIZ-02/03)

### Which battery does the flow chart display?

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown selector | Default first-selected (Sessy 5), dropdown to switch which battery's flows are shown | ✓ |
| First selected only | Always show first-selected; no extra control | |
| Leader by kWh avoided | Show whichever battery avoided most grid import (shifts with selection) | |

**User's choice:** Dropdown selector
**Notes:** Resolves the core tension that each battery has its own per-interval trace — one battery shown at a time, user can explore each.

### Which series go on the flow chart?

| Option | Description | Selected |
|--------|-------------|----------|
| All four | Grid import, grid export, battery charge, battery discharge — exactly what VIZ-02 names | ✓ |
| Four + battery SoC | The four flows plus a state-of-charge line (second y-axis) | |
| Net grid + battery only | Collapse import/export into one signed net line + charge/discharge | |

**User's choice:** All four (step lines, uPlot stepped paths per VIZ-03)
**Notes:** Keeps the import/export split the rest of the tool emphasizes.

### How explicit is the chosen-week label?

| Option | Description | Selected |
|--------|-------------|----------|
| Caption with dates + reason | "Voorbeeldweek: 8–14 juni — de week met de meeste teruglevering in je data." | ✓ |
| Short caption only | "Voorbeeldweek met de meeste teruglevering." (no dates) | |

**User's choice:** Caption with dates + reason
**Notes:** Full transparency about the highest-teruglevering heuristic.

---

## Monthly self-consumption bars (VIZ-01)

### What does each bar's height represent?

| Option | Description | Selected |
|--------|-------------|----------|
| kWh self-consumed | shiftedKwh bucketed by month; same unit as headline metric | ✓ |
| Self-consumption % | % of month's solar surplus captured | |
| Both (toggle) | Switch y-axis between kWh and % | |

**User's choice:** kWh self-consumed
**Notes:** Concrete energy, sums across months, consistent with kWh-first framing.

### How are partial months shown honestly (no extrapolation cue)?

| Option | Description | Selected |
|--------|-------------|----------|
| Render as-is + label | Real partial bar, hatched/lighter, "(deels)" label | ✓ |
| Render as-is, footnote only | Bar normal; partial months explained in a caption | |
| Omit partial months | Only fully-covered months shown | |

**User's choice:** Render as-is + label
**Notes:** Shows the real lower number, never scaled up.

### What should the bars area do with 0–1 full months of data?

| Option | Description | Selected |
|--------|-------------|----------|
| Show what exists + note | Render 1–2 partial bars with a "weinig data" note | ✓ |
| Hide chart, show message | Replace chart with "te weinig data" message | |

**User's choice:** Show what exists + note
**Notes:** The common ~43-day owner dataset must still produce a visible, honest chart.

---

## Assumptions + "geen euro's" panel (UX-01/UX-02)

### How are the two explainers structured and placed?

| Option | Description | Selected |
|--------|-------------|----------|
| One panel, two sections | Single collapsible "Hoe is dit berekend?" with "Waarom geen euro's?" as a subsection | ✓ |
| Two separate collapsibles | Two independent collapsible blocks | |
| Inline links → modal | Small links opening modals | |

**User's choice:** One panel, two sections
**Notes:** One transparency place, less clutter.

### How does the panel relate to the Phase 4 saldering disclaimer?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both, panel expands | Short disclaimer stays at columns; panel restates saldering fully | ✓ |
| Move it all to the panel | Remove column disclaimer; caveat only in panel | |

**User's choice:** Keep both, panel expands
**Notes:** Disclaimer = glance, panel = depth.

### What should "Waarom geen euro's?" promise about v2?

| Option | Description | Selected |
|--------|-------------|----------|
| Concrete but non-committal | v1 = kWh; v2 will add euros once price input lands (no dates) | |
| Just the why, no v2 | Explain only why v1 avoids euros; promise nothing | ✓ |

**User's choice:** Just the why, no v2
**Notes:** Avoids over-promising; boundary statement, not a teaser.

---

## Dutch vocabulary & tooltips (UX-03/UX-05)

### Canonical user-facing term for solar surplus to the grid?

| Option | Description | Selected |
|--------|-------------|----------|
| Teruglevering | Standard NL term, already in Phase 4 columns | ✓ |
| Overschot / zonne-overschot | Frames as surplus; risk of drifting toward banned "zonne-opwekking" | |
| Teruglevering + overschot | Two words for one idea | |

**User's choice:** Teruglevering
**Notes:** Consistent across UI; resists implying we measure solar production.

### How do technical-term tooltips work across desktop and mobile?

| Option | Description | Selected |
|--------|-------------|----------|
| Dotted underline, hover+tap | Dotted underline; hover (desktop) + tap-toggle (mobile) | ✓ |
| Info "i" icon | (i) icon next to each term | |
| Native title attribute | Plain HTML title="" (no touch/keyboard support) | |

**User's choice:** Dotted underline, hover+tap
**Notes:** Discoverable and touch-accessible (satisfies UX-03 hover/tap).

### How is the UX-05 terminology audit enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| CI test (automated grep) | Vitest/CI greps src/ for banned terms; fails build | ✓ |
| One-time manual audit | Grep + cleanup once, no permanent test | |

**User's choice:** CI test (automated grep)
**Notes:** Matches Phase 1/2 contract-locking test style; also extended to UX-06 no-CTA audit.

---

## Mobile & CTA audit (UX-04/UX-06) — decided with defaults

User chose "Decide with defaults" at the wrap-up gate:
- **UX-04 mobile:** CSS-only reflow of Phase 4's responsive-ready structure (table → stacked per-battery cards; charts shrink/scroll; headline numbers never overflow 375px). No rebuild.
- **UX-06 no-CTA:** enforced by the same CI grep test as the terminology audit (email/account/contact/"vraag offerte aan" markers) plus a manual review checklist item.

---

## Claude's Discretion

- uPlot integration mechanics (init, axis/grid/legend styling, stepped-path config, resize).
- Internal file layout for new chart/UI modules and CSS files.
- Exact set of tooltip-ed terms and glossary copy.
- Visual treatment specifics for partial-month bars (hatch vs opacity) and empty/sparse/loading copy.
- Panel copy wording (within the structure/content constraints above).

## Deferred Ideas

- Multiple custom batteries + saldering-OFF-by-default → Phase 6.
- Terugleverkosten €/kWh (SALD-02), year-by-year saldering schedule (SALD-01), dynamic-price dispatch (DYN), € / payback / ROI (FIN) → v2.
- kWh↔% toggle on monthly bars — considered, rejected for v1 (over-built).
- State-of-charge line / net-grid collapse on flow chart — considered, rejected to keep four-series split clean.
