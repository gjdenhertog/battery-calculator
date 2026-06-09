/**
 * tests/compare.test.ts — multi-battery comparison aggregator contract (SIM-06)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Validates that runComparison() preserves input order, handles mixed catalog +
 * custom batteries, returns empty for empty input, and does not mutate inputs.
 *
 * If any test in this file fails it means a future edit broke the pure comparison
 * aggregator — runComparison must remain a thin order-preserving .map over simulate().
 */
import { describe, it, expect } from 'vitest'
import { runComparison } from '../src/domain/compare'
import { simulate } from '../src/domain/simulate'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'
import type { IntervalSample, BatteryConfig } from '../src/domain/types'

/** Build a minimal IntervalSample with controllable import/export values */
function sample(utcMs: number, gridImportKwh = 0.1, gridExportKwh = 0.05): IntervalSample {
  return {
    timestamp: new Date(utcMs),
    gridImportKwh,
    gridExportKwh,
  }
}

// Base time: 2026-01-15 08:00 UTC, 15-min intervals
const T0 = Date.UTC(2026, 0, 15, 8, 0, 0)
const INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Build a sample array: alternating surplus / demand so batteries with different
 * capacities shift measurably different amounts (makes shiftedKwh distinguishable).
 *
 * Even-indexed: 0.5 kWh export (solar surplus → battery charges)
 * Odd-indexed:  0.4 kWh import (demand → battery discharges)
 * 8 intervals = 4 charge + 4 discharge rounds
 */
const SAMPLES: IntervalSample[] = Array.from({ length: 8 }, (_, i) =>
  i % 2 === 0
    ? sample(T0 + i * INTERVAL_MS, 0.0, 0.5)   // surplus: export=0.5, import=0
    : sample(T0 + i * INTERVAL_MS, 0.4, 0.0),  // demand: import=0.4, export=0
)

/**
 * A custom battery with deliberately different specs from all catalog entries:
 * tiny 1 kWh usable, low power limits → produces smaller shiftedKwh than most
 * catalog entries, making per-index alignment observable in the assertion.
 */
const CUSTOM_BATTERY: BatteryConfig = {
  id: 'custom-tiny',
  name: 'Custom Tiny 1 kWh',
  nominalCapacityKwh: 1.0,
  dodFraction: 1.0,
  roundTripEfficiency: 0.80,
  maxChargeKw: 0.5,
  maxDischargeKw: 0.5,
  datasheetUrl: 'https://example.com/custom-tiny',
}

describe('runComparison', () => {
  it('returns results aligned by index — results[i] matches simulate(samples, batteries[i]) (SIM-06)', () => {
    const batteries = [BATTERY_CATALOG[0], BATTERY_CATALOG[1], CUSTOM_BATTERY]
    const results = runComparison(SAMPLES, batteries)

    expect(results).toHaveLength(3)

    // Each result must equal what simulate() produces independently
    for (let i = 0; i < batteries.length; i++) {
      const expected = simulate(SAMPLES, batteries[i])
      expect(results[i].shiftedKwh).toBeCloseTo(expected.shiftedKwh, 9)
      expect(results[i].residualImportKwh).toBeCloseTo(expected.residualImportKwh, 9)
      expect(results[i].residualExportKwh).toBeCloseTo(expected.residualExportKwh, 9)
      expect(results[i].periodDays).toBeCloseTo(expected.periodDays, 9)
    }
  })

  it('results have distinguishable shiftedKwh values — ordering is observable (SIM-06)', () => {
    // Sessy-5 (5 kWh) vs custom-tiny (1 kWh) must differ in shifted energy.
    // This catches a trivial all-zeros implementation that would appear "ordered".
    const batteries = [BATTERY_CATALOG[0], CUSTOM_BATTERY]
    const results = runComparison(SAMPLES, batteries)

    expect(results[0].shiftedKwh).toBeGreaterThan(0)
    expect(results[1].shiftedKwh).toBeGreaterThan(0)
    // Sessy-5 can store more, so it should shift at least as much as the tiny battery
    expect(results[0].shiftedKwh).toBeGreaterThanOrEqual(results[1].shiftedKwh)
  })

  it('mixed [catalog, catalog, custom] array returns one SimResult per battery (ROADMAP criterion 6)', () => {
    const batteries: BatteryConfig[] = [BATTERY_CATALOG[0], BATTERY_CATALOG[3], CUSTOM_BATTERY]
    const results = runComparison(SAMPLES, batteries)

    expect(results).toHaveLength(3)
    // All three results must be valid SimResult objects
    for (const r of results) {
      expect(typeof r.shiftedKwh).toBe('number')
      expect(typeof r.residualImportKwh).toBe('number')
      expect(typeof r.periodDays).toBe('number')
      expect(Array.isArray(r.trace)).toBe(true)
    }
  })

  it('returns [] for empty batteries array (BATT-05: no cap enforced here)', () => {
    const results = runComparison(SAMPLES, [])
    expect(results).toEqual([])
  })

  it('does not mutate the samples array', () => {
    const samplesCopy = SAMPLES.map((s) => ({ ...s }))
    runComparison(SAMPLES, [BATTERY_CATALOG[0]])
    expect(SAMPLES).toHaveLength(samplesCopy.length)
    for (let i = 0; i < SAMPLES.length; i++) {
      expect(SAMPLES[i].timestamp.getTime()).toBe(samplesCopy[i].timestamp.getTime())
      expect(SAMPLES[i].gridImportKwh).toBe(samplesCopy[i].gridImportKwh)
      expect(SAMPLES[i].gridExportKwh).toBe(samplesCopy[i].gridExportKwh)
    }
  })

  it('does not mutate the batteries array', () => {
    const batteries = [BATTERY_CATALOG[0], BATTERY_CATALOG[1], CUSTOM_BATTERY]
    const battsCopy = [...batteries]
    runComparison(SAMPLES, batteries)
    expect(batteries).toHaveLength(battsCopy.length)
    for (let i = 0; i < batteries.length; i++) {
      expect(batteries[i].id).toBe(battsCopy[i].id)
    }
  })

  it('single battery returns a single-element array aligned to index 0', () => {
    const batteries = [BATTERY_CATALOG[2]]
    const results = runComparison(SAMPLES, batteries)
    const expected = simulate(SAMPLES, batteries[0])
    expect(results).toHaveLength(1)
    expect(results[0].shiftedKwh).toBeCloseTo(expected.shiftedKwh, 9)
  })

  it('empty samples yields all-zero SimResults for each battery (simulate handles empty gracefully)', () => {
    const batteries = [BATTERY_CATALOG[0], CUSTOM_BATTERY]
    const results = runComparison([], batteries)
    expect(results).toHaveLength(2)
    for (const r of results) {
      expect(r.shiftedKwh).toBe(0)
      expect(r.periodDays).toBe(0)
      expect(r.trace).toEqual([])
    }
  })
})
