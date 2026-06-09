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
  },
  {
    id: 'sessy-10',
    name: 'Sessy 10 kWh',
    nominalCapacityKwh: 10.0,
    dodFraction: 1.0, // vendor quotes usable capacity — no double-discount (D-08)
    roundTripEfficiency: 0.85,
    maxChargeKw: 2.2,
    maxDischargeKw: 1.7,
    datasheetUrl: 'https://www.sessy.nl/sessy-10-kwh/',
  },
  {
    id: 'zonneplan-10',
    name: 'Zonneplan Thuisbatterij 10 kWh',
    nominalCapacityKwh: 10.0,
    dodFraction: 0.95, // [ASSUMED] A-5: Zonneplan quotes nominal; 95% DoD is a plausible mid-point
    roundTripEfficiency: 0.90,
    maxChargeKw: 4.4,
    maxDischargeKw: 4.4,
    datasheetUrl: 'https://www.zonneplan.nl/thuisbatterij/10-kwh-thuisbatterij',
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
  },
  {
    id: 'huawei-luna-5',
    name: 'Huawei LUNA2000-5-S0',
    nominalCapacityKwh: 5.0,
    dodFraction: 1.0, // vendor quotes usable capacity — no double-discount (D-08)
    roundTripEfficiency: 0.95,
    maxChargeKw: 2.5,
    maxDischargeKw: 2.5,
    datasheetUrl: 'https://solar.huawei.com/en/products/luna2000-5-10-15-s0/specs/',
  },
  {
    id: 'victron-ess-10',
    name: 'Victron ESS (MultiPlus-II + 10 kWh)',
    nominalCapacityKwh: 10.0,
    dodFraction: 0.90, // [ASSUMED] A-6: typical LFP recommendation; gross capacity quoted
    roundTripEfficiency: 0.85, // [ASSUMED] A-7: inverter + battery round-trip mid-point
    maxChargeKw: 3.0,
    maxDischargeKw: 3.0,
    datasheetUrl: 'https://www.victronenergy.com/live/ess:start',
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
  },
] as const
