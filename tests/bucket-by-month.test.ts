/**
 * tests/bucket-by-month.test.ts — contract tests for src/domain/bucket-by-month.ts (VIZ-01)
 *
 * Runs in the DEFAULT node environment (no per-file environment override needed).
 * Fixture-locks the month bucketing, isPartial detection, sparse-data handling,
 * and DST month boundary correctness.
 */
import { describe, it, expect } from 'vitest'
import { bucketByMonth } from '../src/domain/bucket-by-month'
import type { TraceRow } from '../src/domain/types'

const AMSTERDAM = 'Europe/Amsterdam'

// Factory helper: create a minimal TraceRow with a UTC Date and optional chargedKwh
function makeTraceRow(isoDate: string, chargedKwh = 0): TraceRow {
  return {
    timestamp: new Date(isoDate),
    socKwh: 0,
    chargedKwh,
    dischargedKwh: chargedKwh,
    residualImportKwh: 0,
    residualExportKwh: 0,
  }
}

// Build a series covering every day of a month with a consistent chargedKwh value
function buildMonthRows(year: number, month: number, chargedKwhPerRow: number): TraceRow[] {
  // month is 1-based (1=Jan, 2=Feb, ...)
  const daysInMonth = new Date(year, month, 0).getDate() // day 0 of next month = last day of this month
  const rows: TraceRow[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`
    rows.push(makeTraceRow(iso, chargedKwhPerRow))
  }
  return rows
}

describe('bucketByMonth', () => {
  describe('full month case', () => {
    it('returns one bucket for a complete month with correct monthKey', () => {
      const rows = buildMonthRows(2025, 6, 1.5) // June 2025, full month
      const buckets = bucketByMonth(rows, AMSTERDAM)
      expect(buckets).toHaveLength(1)
      expect(buckets[0].monthKey).toBe('2025-06')
    })

    it('produces correct monthLabel for a full month (NL abbreviated + 2-digit year)', () => {
      const rows = buildMonthRows(2025, 6, 1.5)
      const buckets = bucketByMonth(rows, AMSTERDAM)
      expect(buckets[0].monthLabel).toBe("jun '25")
    })

    it('marks a full month as not partial (isPartial = false)', () => {
      const rows = buildMonthRows(2025, 6, 1.5)
      const buckets = bucketByMonth(rows, AMSTERDAM)
      expect(buckets[0].isPartial).toBe(false)
    })

    it('sums chargedKwh correctly for a full month', () => {
      const rows = buildMonthRows(2025, 6, 1.5)
      const buckets = bucketByMonth(rows, AMSTERDAM)
      // June has 30 days, 1.5 kWh per row
      expect(buckets[0].shiftedKwh).toBeCloseTo(30 * 1.5, 3)
    })

    it('sum of all bucket shiftedKwh reconciles to total chargedKwh in trace', () => {
      const rows = [...buildMonthRows(2025, 5, 2.0), ...buildMonthRows(2025, 6, 1.5)]
      const buckets = bucketByMonth(rows, AMSTERDAM)
      const totalFromBuckets = buckets.reduce((sum, b) => sum + b.shiftedKwh, 0)
      const totalFromTrace = rows.reduce((sum, r) => sum + r.chargedKwh, 0)
      expect(totalFromBuckets).toBeCloseTo(totalFromTrace, 3)
    })
  })

  describe('partial month case', () => {
    it('marks a partial first month (starts mid-month) as isPartial=true', () => {
      // Only days 15-30 of June 2025
      const rows: TraceRow[] = []
      for (let day = 15; day <= 30; day++) {
        rows.push(makeTraceRow(`2025-06-${String(day).padStart(2, '0')}T12:00:00Z`, 1.0))
      }
      const buckets = bucketByMonth(rows, AMSTERDAM)
      expect(buckets).toHaveLength(1)
      expect(buckets[0].isPartial).toBe(true)
    })

    it('marks a partial last month (ends mid-month) as isPartial=true', () => {
      // June 2025 full + July 2025 only days 1-15
      const rows = [...buildMonthRows(2025, 6, 1.0)]
      for (let day = 1; day <= 15; day++) {
        rows.push(makeTraceRow(`2025-07-${String(day).padStart(2, '0')}T12:00:00Z`, 1.0))
      }
      const buckets = bucketByMonth(rows, AMSTERDAM)
      expect(buckets).toHaveLength(2)
      expect(buckets[0].isPartial).toBe(false) // June full
      expect(buckets[1].isPartial).toBe(true) // July partial
    })
  })

  describe('DST boundary case', () => {
    it('buckets a late-evening Amsterdam timestamp (23:30 UTC = next local day) into the correct Amsterdam month', () => {
      // 2025-03-31T23:30:00Z = 2025-04-01T01:30:00+02:00 in Amsterdam (CEST)
      // So this row should bucket into April, NOT March
      const dstRow = makeTraceRow('2025-03-31T23:30:00Z', 1.0)
      // Add March rows (days 1-31 at noon UTC = daytime Amsterdam = same date in Amsterdam)
      const marchRows = buildMonthRows(2025, 3, 0.0)
      const rows = [...marchRows, dstRow]
      const buckets = bucketByMonth(rows, AMSTERDAM)

      // Should have both March and April buckets
      const monthKeys = buckets.map((b) => b.monthKey)
      expect(monthKeys).toContain('2025-04')
      // The dstRow should be in April's bucket, not March's
      const aprilBucket = buckets.find((b) => b.monthKey === '2025-04')
      expect(aprilBucket).toBeDefined()
      expect(aprilBucket!.shiftedKwh).toBeCloseTo(1.0, 3)
    })
  })

  describe('sparse / sub-2-full-months case', () => {
    it('returns non-empty array (never empty) for a dataset with <2 full months', () => {
      // Only 5 days — less than one full month
      const rows: TraceRow[] = []
      for (let day = 1; day <= 5; day++) {
        rows.push(makeTraceRow(`2025-06-${String(day).padStart(2, '0')}T12:00:00Z`, 1.0))
      }
      const buckets = bucketByMonth(rows, AMSTERDAM)
      expect(buckets.length).toBeGreaterThan(0)
    })

    it('marks all buckets as isPartial=true when dataset has <2 full months', () => {
      // Only 5 days — definitely partial
      const rows: TraceRow[] = []
      for (let day = 10; day <= 14; day++) {
        rows.push(makeTraceRow(`2025-06-${String(day).padStart(2, '0')}T12:00:00Z`, 1.0))
      }
      const buckets = bucketByMonth(rows, AMSTERDAM)
      expect(buckets.every((b) => b.isPartial)).toBe(true)
    })

    it('returns all-partial buckets when trace spans multiple months but none are full', () => {
      // 3 days in June and 3 days in July — no full month
      const rows = [
        makeTraceRow('2025-06-28T12:00:00Z', 1.0),
        makeTraceRow('2025-06-29T12:00:00Z', 1.0),
        makeTraceRow('2025-06-30T12:00:00Z', 1.0),
        makeTraceRow('2025-07-01T12:00:00Z', 1.0),
        makeTraceRow('2025-07-02T12:00:00Z', 1.0),
        makeTraceRow('2025-07-03T12:00:00Z', 1.0),
      ]
      const buckets = bucketByMonth(rows, AMSTERDAM)
      expect(buckets).toHaveLength(2)
      expect(buckets.every((b) => b.isPartial)).toBe(true)
    })
  })

  describe('multi-month ordering and NL labels', () => {
    it('returns buckets in chronological order (ascending monthKey)', () => {
      const rows = [
        ...buildMonthRows(2025, 8, 1.0),
        ...buildMonthRows(2025, 7, 1.0),
        ...buildMonthRows(2025, 6, 1.0),
      ]
      const buckets = bucketByMonth(rows, AMSTERDAM)
      const keys = buckets.map((b) => b.monthKey)
      expect(keys).toEqual(['2025-06', '2025-07', '2025-08'])
    })

    it('produces correct NL abbreviated month labels for all months', () => {
      const expected: Record<number, string> = {
        1: "jan '25",
        2: "feb '25",
        3: "mrt '25",
        4: "apr '25",
        5: "mei '25",
        6: "jun '25",
        7: "jul '25",
        8: "aug '25",
        9: "sep '25",
        10: "okt '25",
        11: "nov '25",
        12: "dec '25",
      }
      for (const [month, label] of Object.entries(expected)) {
        const rows = buildMonthRows(2025, Number(month), 1.0)
        const buckets = bucketByMonth(rows, AMSTERDAM)
        const firstBucket = buckets.find(
          (b) => b.monthKey === `2025-${String(Number(month)).padStart(2, '0')}`
        )
        expect(firstBucket?.monthLabel).toBe(label)
      }
    })
  })
})
