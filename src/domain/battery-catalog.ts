/**
 * src/domain/battery-catalog.ts — curated NL battery catalog (BATT-01..03)
 *
 * Pure data — bundled at build time, no fetch (CSP connect-src 'none').
 *
 * Convention: dodFraction = 1.0 when the vendor quotes "usable" capacity
 * (Sessy, Tesla, Huawei) — do NOT double-discount by also reducing dodFraction.
 * When a datasheet says "usable: X kWh", set nominalCapacityKwh = X and
 * dodFraction = 1.0. Only set dodFraction < 1.0 when the datasheet quotes a
 * gross/nominal capacity with a separate DoD% figure (e.g. Victron, Marstek,
 * Zonneplan).
 *
 * Each entry's datasheetUrl is the primary citation for the spec figures (BATT-01).
 * Figures marked [ASSUMED] are defensible v1 defaults for a consumer sizing
 * gut-check (A-2, A-3, A-5, A-6, A-7 from RESEARCH.md); not a billing engine.
 *
 * assumedFields is the machine-readable mirror of the prose [ASSUMED] comments
 * above each spec field. It lists which of the five physics fields are assumed
 * (not datasheet-cited). Empty array [] means all values are vendor-cited.
 * Custom batteries omit assumedFields (all user-provided ⇒ no assumed fields).
 */
import type { BatteryConfig } from './types'

export const BATTERY_CATALOG: readonly BatteryConfig[] = [
  // Sessy 5 kWh MUST be index 0 (BATT-03: default battery for NL row-house profile)
  {
    id: 'sessy-5',
    name: 'Sessy 5 kWh',
    nominalCapacityKwh: 5.0,
    dodFraction: 1.0, // vendor quotes usable capacity — no double-discount (D-08)
    roundTripEfficiency: 0.85,
    maxChargeKw: 2.2,
    maxDischargeKw: 1.7,
    datasheetUrl: 'https://www.sessy.nl/specificaties/',
    assumedFields: [], // all values are datasheet-cited
  },
  {
    id: 'sessy-10',
    name: 'Sessy 10 kWh',
    nominalCapacityKwh: 10.0,
    dodFraction: 1.0, // vendor quotes usable capacity — no double-discount (D-08)
    roundTripEfficiency: 0.85, // [ASSUMED] same inverter as Sessy 5 kWh
    maxChargeKw: 2.2, // [ASSUMED] same inverter as Sessy 5 kWh
    maxDischargeKw: 1.7, // [ASSUMED] same inverter as Sessy 5 kWh
    datasheetUrl: 'https://www.sessy.nl/sessy-10-kwh/',
    assumedFields: ['roundTripEfficiency', 'maxChargeKw', 'maxDischargeKw'],
  },
  {
    id: 'zonneplan-10',
    name: 'Zonneplan Thuisbatterij 10 kWh',
    nominalCapacityKwh: 10.0,
    dodFraction: 0.95, // [ASSUMED] A-5: Zonneplan quotes nominal; 95% DoD is a plausible mid-point
    roundTripEfficiency: 0.9, // [ASSUMED] typical AC-coupled round-trip mid-point
    maxChargeKw: 4.4,
    maxDischargeKw: 4.4,
    datasheetUrl: 'https://www.zonneplan.nl/thuisbatterij/10-kwh-thuisbatterij',
    assumedFields: ['dodFraction', 'roundTripEfficiency'],
  },
  {
    id: 'powerwall-3',
    name: 'Tesla Powerwall 3',
    nominalCapacityKwh: 13.5,
    dodFraction: 1.0, // vendor quotes usable capacity — no double-discount (D-08)
    roundTripEfficiency: 0.975,
    maxChargeKw: 5.0,
    maxDischargeKw: 10.0, // 10 kW on-grid NL (A-4); limited to 5 kW off-grid
    datasheetUrl:
      'https://energylibrary.tesla.com/docs/Public/EnergyStorage/Powerwall/3/Datasheet/en-uk/Powerwall-3-Datasheet-EN.pdf',
    assumedFields: [], // all values are datasheet-cited
  },
  {
    id: 'huawei-luna-5',
    name: 'Huawei LUNA2000-5-S0',
    nominalCapacityKwh: 5.0,
    dodFraction: 1.0, // vendor quotes usable capacity — no double-discount (D-08)
    roundTripEfficiency: 0.95, // [ASSUMED] datasheet cites DC RTE; AC RTE assumed
    maxChargeKw: 2.5,
    maxDischargeKw: 2.5,
    datasheetUrl: 'https://solar.huawei.com/en/products/luna2000-5-10-15-s0/specs/',
    assumedFields: ['roundTripEfficiency'],
  },
  {
    id: 'victron-ess-10',
    name: 'Victron ESS (MultiPlus-II + 10 kWh)',
    nominalCapacityKwh: 10.0,
    dodFraction: 0.9, // [ASSUMED] A-6: typical LFP recommendation; gross capacity quoted
    roundTripEfficiency: 0.85, // [ASSUMED] A-7: inverter + battery round-trip mid-point
    maxChargeKw: 3.0, // [ASSUMED] representative DIY config
    maxDischargeKw: 3.0, // [ASSUMED] representative DIY config
    datasheetUrl: 'https://www.victronenergy.com/live/ess:start',
    assumedFields: ['dodFraction', 'roundTripEfficiency', 'maxChargeKw', 'maxDischargeKw'],
  },
  {
    id: 'marstek-venus-e',
    name: 'Marstek Venus E 5,12 kWh',
    nominalCapacityKwh: 5.12,
    dodFraction: 0.95, // [ASSUMED] A-2/A-3: gross capacity; 95% DoD plausible mid-point
    roundTripEfficiency: 0.825,
    maxChargeKw: 2.5,
    maxDischargeKw: 2.5,
    datasheetUrl:
      'https://www.marstek.nl/product/marstek-venus-e-3-0-plug-charge-thuisbatterij-5-12-kwh-incl-p1-meter/',
    assumedFields: ['dodFraction'],
  },
  {
    id: 'enphase-5p',
    name: 'Enphase IQ Battery 5P',
    nominalCapacityKwh: 5.0, // CITED — "Usable capacity 5.0 kWh" (DSH-00857-1.0)
    dodFraction: 1.0, // CITED convention — vendor quotes USABLE capacity; no double-discount (D-08)
    roundTripEfficiency: 0.9, // CITED — "AC round-trip efficiency 90%" (DSH-00857-1.0)
    maxChargeKw: 3.2, // [ASSUMED] datasheet publishes continuous OUTPUT (discharge) only; charge assumed symmetric
    maxDischargeKw: 3.2, // CITED — "Rated (continuous) output apparent power 3.2 kVA" @ 230 VAC
    datasheetUrl: 'https://enphase.com/en-gb/download/iq-battery-5p-data-sheet',
    assumedFields: ['maxChargeKw'],
  },
] as const
