/**
 * tests/period-filter.test.ts — period filter contract lock (DATA-12, D-02)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Validates that filterByPeriod() narrows samples inclusively and defaults to
 * the full range when both bounds are null, and that fullRange() returns the
 * correct first/last timestamps.
 *
 * If any test in this file fails it means a future edit broke the pure period
 * filter — the function must remain a pure transformation with no side effects.
 */
import { describe, it, expect } from 'vitest'
import { filterByPeriod, fullRange } from '../src/domain/period-filter'
import type { IntervalSample } from '../src/domain/types'

/** Build a minimal IntervalSample from a UTC millisecond timestamp */
function sample(utcMs: number): IntervalSample {
  return {
    timestamp: new Date(utcMs),
    gridImportKwh: 0.1,
    gridExportKwh: 0.05,
  }
}

// 5 samples at hourly intervals starting at 2026-01-15 08:00 UTC
const T0 = Date.UTC(2026, 0, 15, 8, 0, 0) // 08:00
const T1 = T0 + 60 * 60 * 1000 // 09:00
const T2 = T1 + 60 * 60 * 1000 // 10:00
const T3 = T2 + 60 * 60 * 1000 // 11:00
const T4 = T3 + 60 * 60 * 1000 // 12:00

const SAMPLES: IntervalSample[] = [sample(T0), sample(T1), sample(T2), sample(T3), sample(T4)]

describe('filterByPeriod', () => {
  it('returns all samples when both bounds are null (default full range — D-02)', () => {
    const result = filterByPeriod(SAMPLES, null, null)
    expect(result).toHaveLength(SAMPLES.length)
    expect(result).toEqual(SAMPLES)
  })

  it('includes both endpoints inclusively (lower bound)', () => {
    // start = T2 → should include T2, T3, T4 (3 samples)
    const result = filterByPeriod(SAMPLES, new Date(T2), null)
    expect(result).toHaveLength(3)
    expect(result[0].timestamp.getTime()).toBe(T2)
  })

  it('includes both endpoints inclusively (upper bound)', () => {
    // end = T2 → should include T0, T1, T2 (3 samples)
    const result = filterByPeriod(SAMPLES, null, new Date(T2))
    expect(result).toHaveLength(3)
    expect(result[result.length - 1].timestamp.getTime()).toBe(T2)
  })

  it('includes both endpoints when both bounds are set', () => {
    // start = T1, end = T3 → should include T1, T2, T3 (3 samples)
    const result = filterByPeriod(SAMPLES, new Date(T1), new Date(T3))
    expect(result).toHaveLength(3)
    expect(result[0].timestamp.getTime()).toBe(T1)
    expect(result[result.length - 1].timestamp.getTime()).toBe(T3)
  })

  it('returns empty array when no samples fall within bounds', () => {
    const beforeAll = new Date(T0 - 1)
    const result = filterByPeriod(SAMPLES, null, beforeAll)
    expect(result).toHaveLength(0)
  })

  it('returns exactly one sample when bounds equal a single timestamp', () => {
    const result = filterByPeriod(SAMPLES, new Date(T2), new Date(T2))
    expect(result).toHaveLength(1)
    expect(result[0].timestamp.getTime()).toBe(T2)
  })

  it('does not mutate the input array', () => {
    const copy = [...SAMPLES]
    filterByPeriod(SAMPLES, new Date(T1), new Date(T3))
    expect(SAMPLES).toEqual(copy)
  })
})

describe('fullRange', () => {
  it('returns the first and last timestamps from the sample array', () => {
    const range = fullRange(SAMPLES)
    expect(range.start.getTime()).toBe(T0)
    expect(range.end.getTime()).toBe(T4)
  })

  it('returns the same timestamp for both when there is only one sample', () => {
    const single = [sample(T2)]
    const range = fullRange(single)
    expect(range.start.getTime()).toBe(T2)
    expect(range.end.getTime()).toBe(T2)
  })
})
