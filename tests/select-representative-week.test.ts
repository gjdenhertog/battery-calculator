/**
 * tests/select-representative-week.test.ts — contract tests for VIZ-02 heuristic
 *
 * Runs in the DEFAULT node environment (no per-file environment override needed).
 * Tests: highest-teruglevering week selection, tie-break (first wins),
 * and a dataset < 7 days returning a single span (never null).
 */
import { describe, it, expect } from 'vitest'
import { TZDate } from '@date-fns/tz'
import { selectRepresentativeWeek } from '../src/domain/select-representative-week'
import type { TraceRow } from '../src/domain/types'

const AMSTERDAM = 'Europe/Amsterdam'

// Factory: create a minimal TraceRow with a UTC Date string and optional residualExportKwh
function makeTraceRow(isoDate: string, residualExportKwh = 0, chargedKwh = 0): TraceRow {
  return {
    timestamp: new Date(isoDate),
    socKwh: 0,
    chargedKwh,
    dischargedKwh: 0,
    residualImportKwh: 0,
    residualExportKwh,
  }
}

// Build a week of rows (Mon-Sun) starting from a given ISO Monday date
// Each row gets 1 reading per day at noon Amsterdam (noon UTC is afternoon Amsterdam)
function buildWeek(mondayIso: string, exportPerDay: number): TraceRow[] {
  const monday = new Date(mondayIso)
  const rows: TraceRow[] = []
  for (let d = 0; d < 7; d++) {
    const ts = new Date(monday.getTime() + d * 24 * 60 * 60 * 1000)
    rows.push(makeTraceRow(ts.toISOString(), exportPerDay))
  }
  return rows
}

describe('selectRepresentativeWeek', () => {
  describe('highest-teruglevering week selection', () => {
    it('returns the week with the highest sum of residualExportKwh', () => {
      // Week A: Mon 2025-06-02, low export (7 kWh total)
      // Week B: Mon 2025-06-09, high export (35 kWh total — 5 kWh/day)
      // Week C: Mon 2025-06-16, medium export (14 kWh total — 2 kWh/day)
      const rows = [
        ...buildWeek('2025-06-02T10:00:00Z', 1),  // 7 kWh/week
        ...buildWeek('2025-06-09T10:00:00Z', 5),  // 35 kWh/week — WINNER
        ...buildWeek('2025-06-16T10:00:00Z', 2),  // 14 kWh/week
      ]
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      // startTs is Monday 2025-06-09 in Amsterdam local time
      // In UTC (CEST = +02:00): 2025-06-09T00:00:00+02:00 = 2025-06-08T22:00:00Z
      // Check Amsterdam-local date of startTs
      const startLocal = new TZDate(result.startTs, AMSTERDAM)
      expect(startLocal.getFullYear()).toBe(2025)
      expect(startLocal.getMonth()).toBe(5) // June = month index 5
      expect(startLocal.getDate()).toBe(9)  // 9th
    })

    it('weekLabel contains the Amsterdam-local start and end dates', () => {
      const rows = buildWeek('2025-06-09T10:00:00Z', 5)
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      // Week is Mon 9 Jun through Sun 15 Jun 2025
      expect(result.weekLabel).toContain('9')
      expect(result.weekLabel).toContain('15')
      expect(result.weekLabel).toContain('juni')
      expect(result.weekLabel).toContain('2025')
    })

    it('returns a positive startTs (valid ms timestamp)', () => {
      const rows = buildWeek('2025-06-09T10:00:00Z', 5)
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      expect(result.startTs).toBeGreaterThan(0)
      expect(result.endTs).toBeGreaterThan(result.startTs)
    })

    it('endTs is after startTs', () => {
      const rows = buildWeek('2025-06-09T10:00:00Z', 5)
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      expect(result.endTs).toBeGreaterThan(result.startTs)
    })
  })

  describe('tie-break: first (earliest) week wins', () => {
    it('when two weeks have equal export sums, returns the first (earlier) week', () => {
      // Both weeks have the same export sum (7 kWh total = 1 kWh/day × 7 days)
      const week1 = buildWeek('2025-06-02T10:00:00Z', 1) // Mon 2025-06-02
      const week2 = buildWeek('2025-06-09T10:00:00Z', 1) // Mon 2025-06-09

      const rows = [...week1, ...week2]
      const result = selectRepresentativeWeek(rows, AMSTERDAM)

      // First week (Mon 2025-06-02 Amsterdam) should win the tie
      // In UTC (CEST +02:00): 2025-06-02T00:00:00+02:00 = 2025-06-01T22:00:00Z
      const startLocal = new TZDate(result.startTs, AMSTERDAM)
      expect(startLocal.getFullYear()).toBe(2025)
      expect(startLocal.getMonth()).toBe(5) // June = month index 5
      expect(startLocal.getDate()).toBe(2)  // 2nd
    })
  })

  describe('dataset < 7 days: returns single span, never null', () => {
    it('returns a non-null result for a single-row dataset', () => {
      const rows = [makeTraceRow('2025-06-10T12:00:00Z', 3.0)]
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      expect(result).not.toBeNull()
      expect(result).toBeDefined()
    })

    it('returns a non-null result for a 3-day dataset', () => {
      const rows = [
        makeTraceRow('2025-06-10T12:00:00Z', 1.0),
        makeTraceRow('2025-06-11T12:00:00Z', 2.0),
        makeTraceRow('2025-06-12T12:00:00Z', 1.5),
      ]
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      expect(result).not.toBeNull()
      expect(result.startTs).toBeGreaterThan(0)
    })

    it('returns valid startTs and endTs for a 3-day dataset (endTs > startTs)', () => {
      const rows = [
        makeTraceRow('2025-06-10T12:00:00Z', 1.0),
        makeTraceRow('2025-06-11T12:00:00Z', 2.0),
        makeTraceRow('2025-06-12T12:00:00Z', 1.5),
      ]
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      expect(result.endTs).toBeGreaterThan(result.startTs)
    })

    it('weekLabel is a non-empty string for a 3-day dataset', () => {
      const rows = [
        makeTraceRow('2025-06-10T12:00:00Z', 1.0),
        makeTraceRow('2025-06-11T12:00:00Z', 2.0),
        makeTraceRow('2025-06-12T12:00:00Z', 1.5),
      ]
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      expect(result.weekLabel).toBeTruthy()
      expect(result.weekLabel.length).toBeGreaterThan(0)
    })
  })

  describe('weekLabel format', () => {
    it('weekLabel uses NL full month name (e.g. "juni")', () => {
      const rows = buildWeek('2025-06-09T10:00:00Z', 2)
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      // June in Dutch is "juni"
      expect(result.weekLabel).toContain('juni')
    })

    it('weekLabel includes the year', () => {
      const rows = buildWeek('2025-06-09T10:00:00Z', 2)
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      expect(result.weekLabel).toContain('2025')
    })

    it('weekLabel contains an en-dash or hyphen separator between day numbers', () => {
      const rows = buildWeek('2025-06-09T10:00:00Z', 2)
      const result = selectRepresentativeWeek(rows, AMSTERDAM)
      // Format: "9–15 juni 2025" — en dash or regular dash
      expect(result.weekLabel).toMatch(/\d+[–-]\d+/)
    })
  })
})
