/**
 * tests/catalog.test.ts — battery catalog contract lock (BATT-01..03)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Validates that BATTERY_CATALOG ships the correct NL battery lineup with
 * all required physics fields, Sessy 5 kWh as the first/default entry, and
 * every datasheetUrl in valid URL format.
 *
 * If any test in this file fails it means a future edit broke the catalog
 * contract — adding or modifying an entry must not remove required fields,
 * change the default (index 0) battery, or introduce duplicate IDs.
 *
 * Requirement coverage: BATT-01 (datasheetUrl cited), BATT-02 (all five
 * physics fields present), BATT-03 (Sessy 5 kWh first/default).
 */
import { describe, it, expect } from 'vitest'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'
import type { BatteryConfig } from '../src/domain/types'

/** Valid spec-field keys that may appear in assumedFields */
const VALID_ASSUMED_KEYS = new Set<string>([
  'nominalCapacityKwh',
  'dodFraction',
  'roundTripEfficiency',
  'maxChargeKw',
  'maxDischargeKw',
])

describe('BATTERY_CATALOG', () => {
  it('ships between 6 and 8 entries with Sessy 5 kWh first (BATT-03)', () => {
    expect(BATTERY_CATALOG.length).toBeGreaterThanOrEqual(6)
    expect(BATTERY_CATALOG.length).toBeLessThanOrEqual(8)
    expect(BATTERY_CATALOG[0].id).toBe('sessy-5')
  })

  it('every entry carries all five physics fields + datasheetUrl (BATT-02)', () => {
    for (const b of BATTERY_CATALOG as BatteryConfig[]) {
      // All five physics fields must be present and positive
      expect(b.nominalCapacityKwh).toBeGreaterThan(0)
      expect(b.dodFraction).toBeGreaterThan(0)
      expect(b.dodFraction).toBeLessThanOrEqual(1)
      expect(b.roundTripEfficiency).toBeGreaterThan(0)
      expect(b.roundTripEfficiency).toBeLessThanOrEqual(1)
      expect(b.maxChargeKw).toBeGreaterThan(0)
      expect(b.maxDischargeKw).toBeGreaterThan(0)
      // datasheetUrl must be a valid http(s) URL (BATT-01)
      expect(b.datasheetUrl).toMatch(/^https?:\/\//)
    }
  })

  it('all catalog IDs are unique', () => {
    const ids = (BATTERY_CATALOG as BatteryConfig[]).map((b) => b.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('Sessy, Tesla, and Huawei entries use dodFraction 1.0 (no double-discount, D-08)', () => {
    const usableVendors = ['sessy-5', 'sessy-10', 'powerwall-3', 'huawei-luna-5']
    for (const id of usableVendors) {
      const entry = (BATTERY_CATALOG as BatteryConfig[]).find((b) => b.id === id)
      expect(entry).toBeDefined()
      expect(entry!.dodFraction).toBe(1.0)
    }
  })

  it('each entry has a non-empty string id and name', () => {
    for (const b of BATTERY_CATALOG as BatteryConfig[]) {
      expect(b.id.length).toBeGreaterThan(0)
      expect(b.name.length).toBeGreaterThan(0)
    }
  })

  // ── assumedFields shape lock (BATT-01 provenance) ──────────────────────────

  it('every entry with assumedFields has only valid spec-field keys (shape lock)', () => {
    for (const b of BATTERY_CATALOG as BatteryConfig[]) {
      if (b.assumedFields !== undefined) {
        expect(Array.isArray(b.assumedFields)).toBe(true)
        for (const key of b.assumedFields) {
          expect(VALID_ASSUMED_KEYS.has(key)).toBe(true)
        }
      }
    }
  })

  // ── Enphase IQ Battery 5P entry (datasheet-verified specs) ─────────────────

  it('enphase-5p entry exists with name "Enphase IQ Battery 5P"', () => {
    const entry = (BATTERY_CATALOG as BatteryConfig[]).find((b) => b.id === 'enphase-5p')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe('Enphase IQ Battery 5P')
  })

  it('enphase-5p has datasheet-verified specs (DSH-00857-1.0)', () => {
    const entry = (BATTERY_CATALOG as BatteryConfig[]).find((b) => b.id === 'enphase-5p')
    expect(entry).toBeDefined()
    expect(entry!.nominalCapacityKwh).toBe(5.0)
    expect(entry!.dodFraction).toBe(1.0)
    expect(entry!.roundTripEfficiency).toBe(0.9)
    expect(entry!.maxChargeKw).toBe(3.2)
    expect(entry!.maxDischargeKw).toBe(3.2)
    expect(entry!.datasheetUrl).toBe('https://enphase.com/en-gb/download/iq-battery-5p-data-sheet')
  })

  it("enphase-5p assumedFields deep-equals ['maxChargeKw']", () => {
    const entry = (BATTERY_CATALOG as BatteryConfig[]).find((b) => b.id === 'enphase-5p')
    expect(entry).toBeDefined()
    expect(entry!.assumedFields).toEqual(['maxChargeKw'])
  })

  it('catalog now ships exactly 8 entries', () => {
    expect(BATTERY_CATALOG.length).toBe(8)
  })
})
