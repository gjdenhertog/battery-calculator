/**
 * tests/merge.test.ts — merge and gap detection contract lock (DATA-10, DATA-11, D-04, D-05)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Covers two functional areas:
 *  1. DST-aware gap detection (detectGaps) — Tasks 2 assertions
 *  2. Finer-wins multi-file merge (mergeFiles) — Task 3 assertions
 *
 * If any test in this file fails it means:
 *  - A future edit broke the finer-wins merge rule (DATA-10)
 *  - Gap counting is wrong or DST transitions are being incorrectly counted (D-04)
 *  - Gap detection is fabricating synthetic samples (D-05)
 */
import { describe, it, expect } from 'vitest'
import { TZDate } from '@date-fns/tz'
import { detectGaps } from '../src/domain/gaps'
import { mergeFiles } from '../src/domain/merge'
import type { IntervalSample, ParseFileResult } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal IntervalSample from a UTC millisecond timestamp */
function sample(utcMs: number, importKwh = 0.1, exportKwh = 0.05): IntervalSample {
  return {
    timestamp: new Date(utcMs),
    gridImportKwh: importKwh,
    gridExportKwh: exportKwh,
  }
}

/** Build a contiguous sequence of 15-min samples starting at startUtcMs */
function contiguous15min(startUtcMs: number, count: number): IntervalSample[] {
  const interval = 15 * 60 * 1000
  return Array.from({ length: count }, (_, i) => sample(startUtcMs + i * interval))
}

/** Build a contiguous sequence of 60-min samples starting at startUtcMs */
function contiguous60min(startUtcMs: number, count: number): IntervalSample[] {
  const interval = 60 * 60 * 1000
  return Array.from({ length: count }, (_, i) => sample(startUtcMs + i * interval))
}

/** Build a minimal ParseFileResult for use as merge input */
function makeParseResult(
  fileName: string,
  cadenceMinutes: number,
  samples: IntervalSample[],
  overrides: Partial<ParseFileResult> = {}
): ParseFileResult {
  return {
    fileName,
    encoding: 'UTF-8',
    seriesType: 'interval',
    cadenceMinutes,
    samples,
    rowCount: samples.length,
    isMonotonic: true,
    firstIntervalAnomalyFlag: false,
    softWarnings: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// detectGaps — Task 2 assertions
// ---------------------------------------------------------------------------

describe('detectGaps', () => {
  it('returns gapCount 0 for a fully contiguous 15-min series', () => {
    // 96 samples = one normal 24-hour day at 15 min
    const start = Date.UTC(2026, 0, 15, 0, 0, 0) // 2026-01-15 00:00 UTC
    const samples = contiguous15min(start, 96)
    const result = detectGaps(samples, 15)
    expect(result.count).toBe(0)
    expect(result.ranges).toHaveLength(0)
  })

  it('returns gapCount 1 when one interior 15-min slot is removed (D-04)', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    const samples = contiguous15min(start, 96)
    // Remove the 48th sample (midday slot)
    const withGap = [...samples.slice(0, 47), ...samples.slice(48)]
    const result = detectGaps(withGap, 15)
    expect(result.count).toBe(1)
    expect(result.ranges).toHaveLength(1)
    // The gap range should point to the missing slot
    expect(result.ranges[0].from.getTime()).toBe(samples[47].timestamp.getTime())
    expect(result.ranges[0].to.getTime()).toBe(samples[47].timestamp.getTime())
  })

  it('returns gapCount 3 when three consecutive interior slots are removed', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    const samples = contiguous15min(start, 96)
    // Remove samples 10, 11, 12 (indices — 3 consecutive missing slots)
    const withGap = [...samples.slice(0, 10), ...samples.slice(13)]
    const result = detectGaps(withGap, 15)
    expect(result.count).toBe(3)
    // All three are consecutive — expect exactly 1 merged gap range
    expect(result.ranges).toHaveLength(1)
    expect(result.ranges[0].from.getTime()).toBe(samples[10].timestamp.getTime())
    expect(result.ranges[0].to.getTime()).toBe(samples[12].timestamp.getTime())
  })

  it('does not count the spring-forward missing local hour as gaps (Pitfall 4, D-04)', () => {
    // 2026-03-29: spring forward at 02:00 AMS local → clocks jump to 03:00
    // The day has only 23 local hours = 92 fifteen-minute intervals.
    // The UTC range 01:00-02:00 corresponds to the skipped local 02:00-03:00 block.
    // A correct 15-min series for this day has 92 samples; gap detection must yield 0 gaps.

    // Build the spring-forward day series directly from UTC ms
    // 2026-03-29 00:00 AMS = 2026-03-28 23:00 UTC (CET is UTC+1)
    // Spring forward happens at 02:00 AMS local = 01:00 UTC
    // After forward, 03:00 AMS = 02:00 UTC
    // So the 92 valid 15-min slots are:
    //   2026-03-28 23:00 UTC .. 2026-03-29 00:45 UTC (7 slots: local midnight to 01:45 AMS)
    //   then gap in local time (02:00-02:59 AMS doesn't exist)
    //   2026-03-29 01:00 UTC onwards (01:00 UTC = 03:00 AMS after spring forward)
    //   continuing until 2026-03-29 22:45 UTC = 2026-03-29 23:45 AMS (last slot)

    // Parse the spring-forward fixture CSV to get real UTC timestamps (TZDate imported at top)

    // Build 92 sample timestamps for 2026-03-29 Amsterdam
    // Start: 2026-03-29 00:00 AMS local (first delta row)
    // The fixture starts at 2026-03-28 23:45 as ref, first delta is at 2026-03-29 00:00 AMS
    const springSamples: IntervalSample[] = []
    let localHour = 0
    let localMin = 0
    let added = 0

    // Walk through all expected 15-min slots for 2026-03-29 Amsterdam
    // Skip the nonexistent 02:00-02:59 local hour (spring forward)
    while (added < 92) {
      // Skip times in the spring-forward gap: 02:00-02:59 local
      if (localHour === 2) {
        localHour = 3
        localMin = 0
      }
      if (localHour >= 24) break

      const tzDate = new TZDate(2026, 2, 29, localHour, localMin, 'Europe/Amsterdam')
      springSamples.push(sample(tzDate.getTime()))

      localMin += 15
      if (localMin >= 60) {
        localMin = 0
        localHour += 1
      }
      added++
    }

    expect(springSamples).toHaveLength(92)
    const result = detectGaps(springSamples, 15)
    expect(result.count).toBe(0)
  })

  it('does not count the fall-back repeated local hour as gaps (D-04)', () => {
    // 2026-10-25: fall back at 03:00 AMS local → clocks go back to 02:00
    // The day has 25 local hours = 100 fifteen-minute intervals.
    // A correct 15-min series has 100 samples; gap detection must yield 0 gaps.
    // (TZDate imported at top)

    // Build 100 sample timestamps for 2026-10-25 Amsterdam
    // Walk in UTC ms at 15-min cadence from midnight AMS to end of day
    // Midnight AMS = 2026-10-24 22:00 UTC (CEST is UTC+2; fall-back to CET=UTC+1 at 03:00 local)
    const dayStart = new TZDate(2026, 9, 25, 0, 0, 'Europe/Amsterdam')
    const fallSamples: IntervalSample[] = []

    // Walk 100 UTC slots at 15-min cadence from the AMS midnight
    const interval = 15 * 60 * 1000
    for (let i = 0; i < 100; i++) {
      fallSamples.push(sample(dayStart.getTime() + i * interval))
    }

    expect(fallSamples).toHaveLength(100)
    const result = detectGaps(fallSamples, 15)
    expect(result.count).toBe(0)
  })

  it('never inserts synthetic samples — input length unchanged (D-05)', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    const samples = contiguous15min(start, 96)
    // Remove one sample
    const withGap = [...samples.slice(0, 47), ...samples.slice(48)]
    detectGaps(withGap, 15)
    // Input still has 95 samples — detectGaps must not mutate the input
    expect(withGap).toHaveLength(95)
  })

  it('returns gapCount 0 for a single sample (no interval = no gaps)', () => {
    const s = [sample(Date.UTC(2026, 0, 15, 12, 0, 0))]
    const result = detectGaps(s, 15)
    expect(result.count).toBe(0)
  })

  it('handles hourly cadence correctly', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    const samples = contiguous60min(start, 24)
    // Remove sample at index 12
    const withGap = [...samples.slice(0, 12), ...samples.slice(13)]
    const result = detectGaps(withGap, 60)
    expect(result.count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// mergeFiles — Task 3 assertions (filled in by Task 3)
// ---------------------------------------------------------------------------

describe('mergeFiles', () => {
  it('produces a merged series sorted ascending by timestamp', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    const samples15 = contiguous15min(start, 8) // 8 × 15-min
    const result15 = makeParseResult('fine.csv', 15, samples15)
    const merged = mergeFiles([result15])
    const times = merged.samples.map((s) => s.timestamp.getTime())
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1])
    }
  })

  it('finer-resolution (15-min) file values win on overlapping timestamps (DATA-10)', () => {
    // 15-min file has 4 samples; hourly file has 1 sample at the same timestamp
    // as the 15-min file's first sample, but with different kWh values
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)

    // fine: 15-min, starts at T0 with importKwh=0.048
    const fine = contiguous15min(start, 4)
    // Overwrite values to something distinctive
    const fineWithValues: IntervalSample[] = fine.map((s) => ({
      ...s,
      gridImportKwh: 0.048,
      gridExportKwh: 0.024,
    }))

    // coarse: hourly, one sample at exactly T0 with different values
    const coarseAt = [
      sample(start, 5.0, 2.5), // same timestamp, different values
    ]

    const result15 = makeParseResult('fine.csv', 15, fineWithValues)
    const result60 = makeParseResult('coarse.csv', 60, coarseAt)

    const merged = mergeFiles([result60, result15]) // pass coarse first (order must not matter)

    // The overlapping timestamp must carry the fine-file values (DATA-10)
    const overlap = merged.samples.find((s) => s.timestamp.getTime() === start)
    expect(overlap).toBeDefined()
    expect(overlap!.gridImportKwh).toBeCloseTo(0.048)
    expect(overlap!.gridExportKwh).toBeCloseTo(0.024)
  })

  it('records rowsOverridden for the coarser file (D-08)', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    // fine: 4 × 15-min samples
    const fine = contiguous15min(start, 4).map((s) => ({
      ...s,
      gridImportKwh: 0.048,
      gridExportKwh: 0.024,
    }))
    // coarse: 1 hourly sample that overlaps the fine file's first timestamp
    const coarse = [sample(start, 5.0, 2.5)]

    const result15 = makeParseResult('fine.csv', 15, fine)
    const result60 = makeParseResult('coarse.csv', 60, coarse)

    const merged = mergeFiles([result60, result15])

    const coarseStat = merged.fileStats.find((f) => f.fileName === 'coarse.csv')
    expect(coarseStat).toBeDefined()
    expect(coarseStat!.rowsOverridden).toBe(1) // the overlapping sample was overridden
    expect(coarseStat!.rowsContributed).toBe(0) // none of coarse contributed to output
  })

  it('records rowsContributed for the finer file (D-08)', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    const fine = contiguous15min(start, 4).map((s) => ({
      ...s,
      gridImportKwh: 0.048,
      gridExportKwh: 0.024,
    }))
    const coarse = [sample(start, 5.0, 2.5)]

    const result15 = makeParseResult('fine.csv', 15, fine)
    const result60 = makeParseResult('coarse.csv', 60, coarse)

    const merged = mergeFiles([result60, result15])

    const fineStat = merged.fileStats.find((f) => f.fileName === 'fine.csv')
    expect(fineStat).toBeDefined()
    expect(fineStat!.rowsContributed).toBe(4) // all 4 fine samples contributed
    expect(fineStat!.rowsOverridden).toBe(0)
  })

  it('populates gapCount from detectGaps over the merged series (DATA-11)', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    const samples = contiguous15min(start, 8)
    // Remove index 4 to introduce a gap
    const withGap = [...samples.slice(0, 4), ...samples.slice(5)]
    const result = makeParseResult('gappy.csv', 15, withGap)

    const merged = mergeFiles([result])
    expect(merged.gapCount).toBe(1)
    expect(merged.gapRanges).toHaveLength(1)
  })

  it('includes fileStats with DATA-05 fields (isMonotonic, firstIntervalAnomalyFlag)', () => {
    const start = Date.UTC(2026, 0, 15, 0, 0, 0)
    const samples = contiguous15min(start, 4)
    const result = makeParseResult('file.csv', 15, samples, {
      isMonotonic: false,
      monotonicity_failRow: 3,
      firstIntervalAnomalyFlag: true,
      softWarnings: ['Suspicious value at row 5'],
    })

    const merged = mergeFiles([result])
    const stat = merged.fileStats[0]
    expect(stat.isMonotonic).toBe(false)
    expect(stat.monotonicity_failRow).toBe(3)
    expect(stat.firstIntervalAnomalyFlag).toBe(true)
    expect(stat.softWarnings).toContain('Suspicious value at row 5')
  })
})
