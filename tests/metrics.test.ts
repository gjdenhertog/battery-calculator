/**
 * tests/metrics.test.ts — contract tests for src/helpers/metrics.ts (COMP-01, D-01..D-04)
 *
 * Runs in the DEFAULT node environment (no per-file environment override needed).
 * Validates saldering framing, deriveMetrics aggregation, and detectLeaders logic.
 *
 * CRITICAL: includes D-02 honesty contract — avoidedWithSaldering CAN be negative
 * and must NOT be floored at 0.
 */
import { describe, it, expect } from 'vitest'
import type { SimResult } from '../src/domain/types'
import {
  avoidedWithoutSaldering,
  avoidedWithSaldering,
  netImportWithValuation,
  deriveMetrics,
  detectLeaders,
  type DerivedMetrics,
} from '../src/helpers/metrics'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a minimal SimResult literal (trace not used by helpers — empty is fine) */
function makeSimResult(
  shiftedKwh: number,
  residualImportKwh: number,
  residualExportKwh: number,
  totalImportKwh: number,
  totalExportKwh: number,
  periodDays = 30,
): SimResult {
  return {
    shiftedKwh,
    residualImportKwh,
    residualExportKwh,
    totalImportKwh,
    totalExportKwh,
    periodDays,
    coarseCadenceWarning: false,
    trace: [],
  }
}

// ---------------------------------------------------------------------------
// avoidedWithoutSaldering (D-01 OFF)
// ---------------------------------------------------------------------------

describe('avoidedWithoutSaldering', () => {
  it('equals sim.shiftedKwh exactly (D-01: OFF baseline = shifted)', () => {
    const sim = makeSimResult(120.5, 200, 50, 500, 300)
    expect(avoidedWithoutSaldering(sim)).toBeCloseTo(120.5, 9)
  })

  it('returns 0 when shiftedKwh is 0', () => {
    const sim = makeSimResult(0, 500, 100, 500, 100)
    expect(avoidedWithoutSaldering(sim)).toBeCloseTo(0, 9)
  })
})

// ---------------------------------------------------------------------------
// avoidedWithSaldering (D-01 ON, D-02 can-be-negative)
// ---------------------------------------------------------------------------

describe('avoidedWithSaldering', () => {
  it('computes baselineNet − batteryNet (normal positive case)', () => {
    // baselineNet = max(0, 1000 − 200) = 800
    // batteryNet  = max(0, 850 − 200) = 650
    // result = 800 − 650 = 150
    const sim = makeSimResult(150, 850, 200, 1000, 200)
    expect(avoidedWithSaldering(sim)).toBeCloseTo(150, 9)
  })

  it('returns a NEGATIVE value when round-trip loss outweighs saldering benefit (D-02 honesty contract)', () => {
    // Scenario: large export, battery adds round-trip losses.
    // totalImport = 100, totalExport = 300
    // baselineNet = max(0, 100 − 300) = 0 (net exporter — already covered by saldering)
    // residualImport = 80, residualExport = 250
    // batteryNet = max(0, 80 − 250) = 0
    // result = 0 − 0 = 0
    //
    // More revealing fixture: small surplus lost to round-trip inefficiency
    // totalImport = 200, totalExport = 50
    // baselineNet = max(0, 200 − 50) = 150
    // residualImport = 190, residualExport = 10
    // batteryNet = max(0, 190 − 10) = 180
    // result = 150 − 180 = -30 (negative! battery hurt the net position)
    const sim = makeSimResult(10, 190, 10, 200, 50)
    const result = avoidedWithSaldering(sim)
    // Must NOT be floored at 0
    expect(result).toBeLessThan(0)
  })

  it('returns 0 when baseline and battery net are equal', () => {
    // baselineNet = max(0, 500 − 200) = 300
    // batteryNet = max(0, 200 − 100) = 100
    // Hmm — let's pick: both produce same net
    // totalImport=500, totalExport=200 → baselineNet = 300
    // residualImport=200, residualExport=100 → batteryNet = 100
    // result = 200 (not 0) — let's use equal values
    const sim = makeSimResult(0, 300, 0, 300, 0)
    // baselineNet = 300, batteryNet = 300 → result = 0
    expect(avoidedWithSaldering(sim)).toBeCloseTo(0, 9)
  })

  it('returns 0 when baseline net is 0 (net exporter, battery adds no saldering benefit)', () => {
    // totalImport=100, totalExport=500 → baselineNet = max(0, -400) = 0
    // residualImport=90, residualExport=440 → batteryNet = max(0, -350) = 0
    // result = 0 − 0 = 0
    const sim = makeSimResult(10, 90, 440, 100, 500)
    expect(avoidedWithSaldering(sim)).toBeCloseTo(0, 9)
  })
})

// ---------------------------------------------------------------------------
// netImportWithValuation (D-04)
// ---------------------------------------------------------------------------

describe('netImportWithValuation', () => {
  it('returns residualImportKwh unchanged when feedInValue is 0 (no export credit)', () => {
    expect(netImportWithValuation(200, 50, 0)).toBeCloseTo(200, 9)
  })

  it('returns residualImport − residualExport when feedInValue is 1 (full 1:1 netting)', () => {
    expect(netImportWithValuation(200, 50, 1)).toBeCloseTo(150, 9)
  })

  it('feedInValue=0: zero import returns 0', () => {
    expect(netImportWithValuation(0, 100, 0)).toBeCloseTo(0, 9)
  })

  it('feedInValue=1: large export reduces net import to negative-like value', () => {
    // residualImport=50, residualExport=200, feedIn=1 → 50 − 200 = -150
    expect(netImportWithValuation(50, 200, 1)).toBeCloseTo(-150, 9)
  })
})

// ---------------------------------------------------------------------------
// deriveMetrics (COMP-01, T-04-04 NaN/Infinity guards)
// ---------------------------------------------------------------------------

describe('deriveMetrics', () => {
  it('computes selfConsumptionPct as shifted/totalImport×100', () => {
    // shiftedKwh=200, totalImport=800 → 25.0%
    const sim = makeSimResult(200, 600, 100, 800, 300)
    const m = deriveMetrics(sim, 5.0)
    expect(m.selfConsumptionPct).toBeCloseTo(25.0, 9)
  })

  it('clamps selfConsumptionPct at 100 (even if shifted > totalImport due to rounding)', () => {
    // shifted=1000, totalImport=500 → would be 200% without clamp
    const sim = makeSimResult(1000, 0, 0, 500, 0)
    const m = deriveMetrics(sim, 5.0)
    expect(m.selfConsumptionPct).toBe(100)
  })

  it('returns 0 for selfConsumptionPct when totalImportKwh is 0 (T-04-04 NaN guard)', () => {
    const sim = makeSimResult(0, 0, 0, 0, 100)
    const m = deriveMetrics(sim, 5.0)
    expect(m.selfConsumptionPct).toBe(0)
    expect(Number.isFinite(m.selfConsumptionPct)).toBe(true)
    expect(Number.isNaN(m.selfConsumptionPct)).toBe(false)
  })

  it('computes marginalBenutting as shifted/usableCapacity', () => {
    // shiftedKwh=250, usable=5.0 → 50
    const sim = makeSimResult(250, 250, 50, 1000, 200)
    const m = deriveMetrics(sim, 5.0)
    expect(m.marginalBenutting).toBeCloseTo(50, 9)
  })

  it('returns 0 for marginalBenutting when usableCapacityKwh < 0.1 (T-04-04 division guard)', () => {
    const sim = makeSimResult(100, 50, 20, 500, 100)
    const m = deriveMetrics(sim, 0.05)  // < 0.1 threshold
    expect(m.marginalBenutting).toBe(0)
    expect(Number.isFinite(m.marginalBenutting)).toBe(true)
  })

  it('returns 0 for marginalBenutting when usableCapacityKwh is exactly 0 (T-04-04)', () => {
    const sim = makeSimResult(100, 50, 20, 500, 100)
    const m = deriveMetrics(sim, 0)
    expect(m.marginalBenutting).toBe(0)
  })

  it('passes through shiftedKwh, residualImportKwh, residualExportKwh verbatim', () => {
    const sim = makeSimResult(123.4, 456.7, 78.9, 1000, 200)
    const m = deriveMetrics(sim, 5.0)
    expect(m.shiftedKwh).toBeCloseTo(123.4, 9)
    expect(m.residualImportKwh).toBeCloseTo(456.7, 9)
    expect(m.residualExportKwh).toBeCloseTo(78.9, 9)
  })
})

// ---------------------------------------------------------------------------
// detectLeaders (COMP-03, D-11)
// ---------------------------------------------------------------------------

describe('detectLeaders', () => {
  // Three batteries with clearly different metrics
  const m0: DerivedMetrics = {
    avoidedOff: 300,    // HIGHEST → leader (idx 0)
    avoidedOn: 250,     // HIGHEST → leader (idx 0)
    selfConsumptionPct: 40,  // middle
    shiftedKwh: 300,    // HIGHEST → leader (idx 0)
    residualImportKwh: 500,  // HIGHEST residual → WORST (idx 2 below is leader)
    residualExportKwh: 200,  // middle
    marginalBenutting: 60,   // HIGHEST → leader (idx 0)
  }
  const m1: DerivedMetrics = {
    avoidedOff: 200,
    avoidedOn: 150,
    selfConsumptionPct: 60,  // HIGHEST → leader (idx 1)
    shiftedKwh: 200,
    residualImportKwh: 400,  // middle
    residualExportKwh: 150,  // middle
    marginalBenutting: 40,
  }
  const m2: DerivedMetrics = {
    avoidedOff: 100,
    avoidedOn: 50,
    selfConsumptionPct: 20,
    shiftedKwh: 100,
    residualImportKwh: 200,  // LOWEST residual → BEST for import (idx 2)
    residualExportKwh: 80,   // LOWEST residual → BEST for export (idx 2)
    marginalBenutting: 20,
  }

  it('returns the MAX index for avoidedOff (higher-is-better)', () => {
    const leaders = detectLeaders([m0, m1, m2])
    expect(leaders.get('avoidedOff')).toBe(0)
  })

  it('returns the MAX index for avoidedOn (higher-is-better)', () => {
    const leaders = detectLeaders([m0, m1, m2])
    expect(leaders.get('avoidedOn')).toBe(0)
  })

  it('returns the MAX index for selfConsumptionPct (higher-is-better)', () => {
    const leaders = detectLeaders([m0, m1, m2])
    expect(leaders.get('selfConsumptionPct')).toBe(1)
  })

  it('returns the MAX index for shiftedKwh (higher-is-better)', () => {
    const leaders = detectLeaders([m0, m1, m2])
    expect(leaders.get('shiftedKwh')).toBe(0)
  })

  it('returns the MAX index for marginalBenutting (higher-is-better)', () => {
    const leaders = detectLeaders([m0, m1, m2])
    expect(leaders.get('marginalBenutting')).toBe(0)
  })

  it('returns the MIN index for residualImportKwh (lower-is-better)', () => {
    const leaders = detectLeaders([m0, m1, m2])
    expect(leaders.get('residualImportKwh')).toBe(2)
  })

  it('returns the MIN index for residualExportKwh (lower-is-better)', () => {
    const leaders = detectLeaders([m0, m1, m2])
    expect(leaders.get('residualExportKwh')).toBe(2)
  })

  it('returns an empty map for an empty array', () => {
    const leaders = detectLeaders([])
    expect(leaders.size).toBe(0)
  })

  it('returns index 0 for a single-battery array (only contestant is leader)', () => {
    const leaders = detectLeaders([m0])
    expect(leaders.get('avoidedOff')).toBe(0)
    expect(leaders.get('residualImportKwh')).toBe(0)
  })
})
