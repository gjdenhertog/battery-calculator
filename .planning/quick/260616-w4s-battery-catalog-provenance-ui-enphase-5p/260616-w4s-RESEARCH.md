# Quick Task 260616-w4s — Research (orchestrator-verified)

**Researched:** 2026-06-16 (specs verified by the orchestrator against the official datasheet, not a subagent)

## Enphase IQ Battery 5P — datasheet-verified specs

Source datasheet: **DSH-00857-1.0** (United Kingdom / international), model **IQBATTERY-5P-1P-INT** — the EU single-phase variant relevant to NL.
datasheetUrl to cite: `https://enphase.com/en-gb/download/iq-battery-5p-data-sheet`

| Field | Value | Provenance |
|-------|-------|-----------|
| nominalCapacityKwh | **5.0** | CITED — "Usable capacity 5.0 kWh" |
| dodFraction | **1.0** | CITED convention — vendor quotes USABLE capacity → do not double-discount (matches Sessy/Tesla/Huawei handling) |
| roundTripEfficiency | **0.90** | CITED — "AC round-trip efficiency 90%" (AC→AC, the honest figure for a grid-kWh model; DC RTE is 96% — do NOT use that) |
| maxDischargeKw | **3.2** | CITED — "Rated (continuous) output apparent power 3.2 kVA" (13.91 A @ 230 VAC ⇒ 3.2 kW at unity PF) |
| maxChargeKw | **3.2** | **[ASSUMED]** — the datasheet publishes continuous OUTPUT (discharge) power only; charge assumed symmetric for this AC-coupled 6-microinverter unit |

Chemistry LFP; >60% capacity warranty up to 15 years / 6,000 cycles. AC-coupled, 230 VAC / 50 Hz.

**assumedFields for Enphase IQ Battery 5P = ["maxChargeKw"]** (everything else is datasheet-cited).

Catalog entry to add (id `enphase-5p`, name "Enphase IQ Battery 5P"):
```
nominalCapacityKwh: 5.0, dodFraction: 1.0, roundTripEfficiency: 0.9,
maxChargeKw: 3.2, maxDischargeKw: 3.2,
datasheetUrl: 'https://enphase.com/en-gb/download/iq-battery-5p-data-sheet',
assumedFields: ['maxChargeKw']
```

## Provenance map for the EXISTING 7 entries (from battery-catalog.ts [ASSUMED] comments + 03-RESEARCH.md)

`assumedFields` lists which of {nominalCapacityKwh, dodFraction, roundTripEfficiency, maxChargeKw, maxDischargeKw} are NOT datasheet-pinned:

| id | assumedFields |
|----|---------------|
| sessy-5 | [] (all cited) |
| sessy-10 | ['roundTripEfficiency','maxChargeKw','maxDischargeKw'] (assumed same inverter as 5 kWh) |
| zonneplan-10 | ['dodFraction','roundTripEfficiency'] |
| powerwall-3 | [] (all cited) |
| huawei-luna-5 | ['roundTripEfficiency'] |
| victron-ess-10 | ['dodFraction','roundTripEfficiency','maxChargeKw','maxDischargeKw'] (representative DIY config) |
| marstek-venus-e | ['dodFraction'] |
| enphase-5p | ['maxChargeKw'] |

## UI decisions (locked by user)
- Inline presentation: a small Dutch **"geschat"** badge next to each spec row whose field is in `assumedFields` (Capaciteit→nominalCapacityKwh, Bruikbaar→dodFraction, Rendement→roundTripEfficiency, Max laden→maxChargeKw, Max ontladen→maxDischargeKw).
- A **"📄 Datasheet"** link per battery card → `datasheetUrl`, opened in a new tab. Build via createElement + setAttribute(href/target=_blank/rel="noopener noreferrer") + textContent — NO innerHTML (XSS/CSP safe).
- Field→label mapping for the spec rows is in `buildSpecCard` (appendSpec calls) in src/ui/battery-picker.ts.

## Constraints
- Privacy guard (deploy.yml): catalog URLs already live in the minified JS bundle and the guard tolerates them (its `.map` line-exclusion drops the bundle line); links render at runtime so they're absent from static index.html. `npm run build` + the privacy-guard grep MUST still pass. Do NOT weaken the guard.
- Datasheet links are user-initiated navigations (target=_blank rel=noopener noreferrer) — NOT auto-fetched; they do not violate connect-src 'none'.
- Full local CI before done: `npm run typecheck && npm run build && npm run lint && npm run format:check && TZ=Europe/Amsterdam npm test`.
- Add/adjust tests: Enphase entry in the catalog contract test; `assumedFields` shape on every entry; badge + datasheet-link rendering in battery-picker tests; keep the XSS test green.
- NL-only, vanilla TS, no new deps.
