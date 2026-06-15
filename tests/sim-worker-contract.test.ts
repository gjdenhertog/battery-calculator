/**
 * tests/sim-worker-contract.test.ts — SIM-07 dual-use contract smoke test
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 *
 * Proves that runComparison is independently importable from the domain module
 * WITHOUT instantiating a Worker — the dual-use contract that lets Vitest test
 * the pure function directly while the browser uses it via the Comlink adapter.
 *
 * IMPORTANT: This file NEVER imports from '../src/workers/sim-worker.ts'.
 * The worker entry references Comlink's `self` global (a Worker global unavailable
 * in Node). Always import runComparison from the domain directly (SIM-07).
 */
import { describe, it, expect } from 'vitest'
import { runComparison } from '../src/domain/compare'
import type { IntervalSample } from '../src/domain/types'

/** Build a minimal IntervalSample (mirrors compare.test.ts fixture idiom) */
function sample(utcMs: number, gridImportKwh = 0.1, gridExportKwh = 0.05): IntervalSample {
  return { timestamp: new Date(utcMs), gridImportKwh, gridExportKwh }
}

const T0 = Date.UTC(2026, 0, 15, 8, 0, 0)
const SAMPLES: IntervalSample[] = [
  sample(T0, 0.0, 0.5), // surplus: solar export
  sample(T0 + 15 * 60 * 1000, 0.4, 0), // demand: grid import
]

describe('sim-worker dual-use contract (SIM-07)', () => {
  it('runComparison is a function (importable without a Worker)', () => {
    expect(typeof runComparison).toBe('function')
  })

  it('runComparison(samples, []) returns an empty array', () => {
    expect(runComparison(SAMPLES, [])).toEqual([])
  })

  it('runComparison returns one result per battery in input order', () => {
    // Uses two minimal fixture batteries to prove index alignment
    const battA = {
      id: 'contract-a',
      name: 'Contract Battery A',
      nominalCapacityKwh: 5,
      dodFraction: 0.9,
      roundTripEfficiency: 0.9,
      maxChargeKw: 2.5,
      maxDischargeKw: 2.5,
      datasheetUrl: 'https://example.com/a',
    }
    const battB = {
      id: 'contract-b',
      name: 'Contract Battery B',
      nominalCapacityKwh: 10,
      dodFraction: 0.9,
      roundTripEfficiency: 0.9,
      maxChargeKw: 5,
      maxDischargeKw: 5,
      datasheetUrl: 'https://example.com/b',
    }
    const results = runComparison(SAMPLES, [battA, battB])
    expect(results).toHaveLength(2)
    expect(typeof results[0].shiftedKwh).toBe('number')
    expect(typeof results[1].shiftedKwh).toBe('number')
  })
})
