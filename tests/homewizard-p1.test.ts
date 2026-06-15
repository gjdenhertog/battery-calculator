/**
 * tests/homewizard-p1.test.ts — HomeWizard P1 adapter contract lock (DATA-02/05/06/07)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Tests the HomeWizardP1Parser via the ParserRegistry after importing the adapter
 * as a side-effect. All test data is inline — no fixture files needed here.
 *
 * If any test in this file fails it means:
 * - Header claim detection is broken (DATA-02)
 * - Cumulative→delta conversion is wrong (DATA-05)
 * - Monotonicity flag or first-interval flag is missing (DATA-05)
 * - Non-negative invariant violated (DATA-06)
 * - UTC timestamp conversion is broken (DATA-07)
 */
import { describe, it, expect } from 'vitest'
import '../src/domain/parsers/homewizard-p1'
import '../src/domain/parsers/noop-stub'
import { ParserRegistry } from '../src/domain/parsers/registry'
import { ParseRowError } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name = 'test.csv'): File {
  return new File([''], name, { type: 'text/csv' })
}

/** Minimal HomeWizard P1 row with default values. */
function makeRow(
  time: string,
  importT1: string,
  importT2: string,
  exportT1: string,
  exportT2: string
): Record<string, string> {
  return {
    time,
    'Import T1 kWh': importT1,
    'Import T2 kWh': importT2,
    'Export T1 kWh': exportT1,
    'Export T2 kWh': exportT2,
  }
}

// ---------------------------------------------------------------------------
// Claim tests (DATA-02)
// ---------------------------------------------------------------------------

describe('HomeWizard P1 Parser — claim()', () => {
  it('returns true for HomeWizard P1 headers', () => {
    const headers = ['time', 'Import T1 kWh', 'Import T2 kWh', 'Export T1 kWh', 'Export T2 kWh']
    const adapter = ParserRegistry.claim(headers)
    expect(adapter).not.toBeNull()
    expect(adapter?.name).toBe('HomeWizard P1')
  })

  it('returns true even with extra trailing columns (L1/L2/L3 max W)', () => {
    const headers = [
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
      'L1 max W',
      'L2 max W',
      'L3 max W',
    ]
    const adapter = ParserRegistry.claim(headers)
    expect(adapter).not.toBeNull()
    expect(adapter?.name).toBe('HomeWizard P1')
  })

  it('returns null for unrelated headers', () => {
    const adapter = ParserRegistry.claim(['datum', 'verbruik', 'teruglevering'])
    expect(adapter).toBeNull()
  })

  it('returns null for empty headers', () => {
    const adapter = ParserRegistry.claim([])
    expect(adapter).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Transform tests — basic delta conversion (DATA-05, DATA-06)
// ---------------------------------------------------------------------------

describe('HomeWizard P1 Parser — transform()', () => {
  it('produces samples.length === rawRows - 1 (first row consumed as reference)', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354.000', '4651.000', '3095.000', '7482.000'),
      makeRow('2026-01-15 00:15', '8354.048', '4651.000', '3095.024', '7482.000'),
      makeRow('2026-01-15 00:30', '8354.096', '4651.000', '3095.048', '7482.000'),
    ]
    const adapter = ParserRegistry.claim(Object.keys(rows[0]))!
    const result = adapter.transform(rows, makeFile())
    expect(result.samples.length).toBe(2) // 3 rows - 1 = 2 samples
  })

  it('sets firstIntervalAnomalyFlag to true for cumulative series', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354.000', '4651.000', '3095.000', '7482.000'),
      makeRow('2026-01-15 00:15', '8354.048', '4651.000', '3095.024', '7482.000'),
    ]
    const adapter = ParserRegistry.claim(Object.keys(rows[0]))!
    const result = adapter.transform(rows, makeFile())
    expect(result.firstIntervalAnomalyFlag).toBe(true)
  })

  it('computes correct deltas from cumulative values', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354.000', '0.000', '3095.000', '0.000'),
      makeRow('2026-01-15 00:15', '8354.100', '0.000', '3095.200', '0.000'),
    ]
    const adapter = ParserRegistry.claim(Object.keys(rows[0]))!
    const result = adapter.transform(rows, makeFile())
    expect(result.samples.length).toBe(1)
    expect(result.samples[0].gridImportKwh).toBeCloseTo(0.1, 5)
    expect(result.samples[0].gridExportKwh).toBeCloseTo(0.2, 5)
  })

  it('sums T1+T2 for both import and export deltas', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '100.000', '200.000', '50.000', '100.000'),
      makeRow('2026-01-15 00:15', '100.050', '200.030', '50.020', '100.010'),
    ]
    const adapter = ParserRegistry.claim(Object.keys(rows[0]))!
    const result = adapter.transform(rows, makeFile())
    expect(result.samples[0].gridImportKwh).toBeCloseTo(0.05 + 0.03, 5)
    expect(result.samples[0].gridExportKwh).toBeCloseTo(0.02 + 0.01, 5)
  })

  it('all samples have gridImportKwh >= 0 (DATA-06 invariant)', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354.000', '4651.000', '3095.000', '7482.000'),
      makeRow('2026-01-15 00:15', '8354.048', '4651.000', '3095.024', '7482.000'),
      makeRow('2026-01-15 00:30', '8354.096', '4651.000', '3095.048', '7482.000'),
    ]
    const adapter = ParserRegistry.claim(Object.keys(rows[0]))!
    const result = adapter.transform(rows, makeFile())
    for (const s of result.samples) {
      expect(s.gridImportKwh).toBeGreaterThanOrEqual(0)
      expect(s.gridExportKwh).toBeGreaterThanOrEqual(0)
    }
  })

  it('clamps negative delta to 0 but sets isMonotonic false and records failRow', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354.100', '0.000', '0.000', '0.000'),
      makeRow('2026-01-15 00:15', '8354.050', '0.000', '0.000', '0.000'), // regresses
      makeRow('2026-01-15 00:30', '8354.200', '0.000', '0.000', '0.000'),
    ]
    const adapter = ParserRegistry.claim(Object.keys(rows[0]))!
    const result = adapter.transform(rows, makeFile())
    expect(result.isMonotonic).toBe(false)
    expect(result.monotonicity_failRow).toBeDefined()
    // The clamped sample must be 0, not negative
    expect(result.samples[0].gridImportKwh).toBe(0)
  })

  it('keeps isMonotonic true when all values are non-decreasing', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '100.000', '0.000', '0.000', '0.000'),
      makeRow('2026-01-15 00:15', '100.100', '0.000', '0.000', '0.000'),
      makeRow('2026-01-15 00:30', '100.200', '0.000', '0.000', '0.000'),
    ]
    const adapter = ParserRegistry.claim(Object.keys(rows[0]))!
    const result = adapter.transform(rows, makeFile())
    expect(result.isMonotonic).toBe(true)
    expect(result.monotonicity_failRow).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Decimal comma handling (DATA-04, Pitfall 6)
// ---------------------------------------------------------------------------

describe('HomeWizard P1 Parser — decimal comma handling', () => {
  it('parses a decimal comma value correctly', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354,000', '0,000', '0,000', '0,000'),
      makeRow('2026-01-15 00:15', '8354,100', '0,000', '0,000', '0,000'),
    ]
    const adapter = ParserRegistry.claim([
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
    ])!
    const result = adapter.transform(rows, makeFile())
    expect(result.samples[0].gridImportKwh).toBeCloseTo(0.1, 5)
  })

  it('decimal comma result equals dot-decimal equivalent', () => {
    const rowsComma = [
      makeRow('2026-01-15 00:00', '8354,542', '4651,780', '3095,875', '7482,698'),
      makeRow('2026-01-15 00:15', '8354,590', '4651,780', '3095,899', '7482,698'),
    ]
    const rowsDot = [
      makeRow('2026-01-15 00:00', '8354.542', '4651.780', '3095.875', '7482.698'),
      makeRow('2026-01-15 00:15', '8354.590', '4651.780', '3095.899', '7482.698'),
    ]
    const adapter = ParserRegistry.claim([
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
    ])!
    const commaResult = adapter.transform(rowsComma, makeFile())
    const dotResult = adapter.transform(rowsDot, makeFile())
    expect(commaResult.samples[0].gridImportKwh).toBeCloseTo(dotResult.samples[0].gridImportKwh, 5)
    expect(commaResult.samples[0].gridExportKwh).toBeCloseTo(dotResult.samples[0].gridExportKwh, 5)
  })
})

// ---------------------------------------------------------------------------
// Timestamp UTC conversion (DATA-07)
// ---------------------------------------------------------------------------

describe('HomeWizard P1 Parser — timestamp UTC conversion (DATA-07)', () => {
  it('converts Amsterdam winter local time to correct UTC', () => {
    // Amsterdam is UTC+1 in winter (CET). 12:00 local = 11:00 UTC.
    const rows = [
      makeRow('2026-01-15 11:45', '100.000', '0.000', '0.000', '0.000'),
      makeRow('2026-01-15 12:00', '100.100', '0.000', '0.000', '0.000'),
    ]
    const adapter = ParserRegistry.claim([
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
    ])!
    const result = adapter.transform(rows, makeFile())
    const ts = result.samples[0].timestamp
    // 2026-01-15 12:00 Amsterdam (UTC+1) = 2026-01-15 11:00 UTC
    expect(ts.getUTCFullYear()).toBe(2026)
    expect(ts.getUTCMonth()).toBe(0) // January = 0
    expect(ts.getUTCDate()).toBe(15)
    expect(ts.getUTCHours()).toBe(11)
    expect(ts.getUTCMinutes()).toBe(0)
  })

  it('timestamp is a Date instance (not a string or number)', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '100.000', '0.000', '0.000', '0.000'),
      makeRow('2026-01-15 00:15', '100.100', '0.000', '0.000', '0.000'),
    ]
    const adapter = ParserRegistry.claim([
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
    ])!
    const result = adapter.transform(rows, makeFile())
    expect(result.samples[0].timestamp).toBeInstanceOf(Date)
  })
})

// ---------------------------------------------------------------------------
// ParseRowError on malformed values (D-06)
// ---------------------------------------------------------------------------

describe('HomeWizard P1 Parser — ParseRowError on malformed data (D-06)', () => {
  it('throws ParseRowError when a kWh column is non-numeric', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354.000', '0.000', '0.000', '0.000'),
      makeRow('2026-01-15 00:15', 'NIET-NUMERIEK', '0.000', '0.000', '0.000'),
    ]
    const adapter = ParserRegistry.claim([
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
    ])!
    expect(() => adapter.transform(rows, makeFile('energy.csv'))).toThrow(ParseRowError)
  })

  it('ParseRowError carries fileName, rowNumber, columnName, expected', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354.000', '0.000', '0.000', '0.000'),
      makeRow('2026-01-15 00:15', 'bad-value', '0.000', '0.000', '0.000'),
    ]
    const adapter = ParserRegistry.claim([
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
    ])!
    try {
      adapter.transform(rows, makeFile('p1-export.csv'))
      expect.fail('Should have thrown ParseRowError')
    } catch (e) {
      expect(e).toBeInstanceOf(ParseRowError)
      const err = e as ParseRowError
      expect(err.fileName).toBe('p1-export.csv')
      expect(err.rowNumber).toBeGreaterThan(0)
      expect(err.columnName).toBe('Import T1 kWh')
      expect(err.expected).toBeTruthy()
    }
  })

  it('throws ParseRowError when timestamp format is invalid', () => {
    const rows = [
      makeRow('2026-01-15 00:00', '8354.000', '0.000', '0.000', '0.000'),
      makeRow('not-a-date', '8354.100', '0.000', '0.000', '0.000'),
    ]
    const adapter = ParserRegistry.claim([
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
    ])!
    expect(() => adapter.transform(rows, makeFile())).toThrow(ParseRowError)
  })
})

// ---------------------------------------------------------------------------
// Noop stub proves the registry (DATA-03)
// ---------------------------------------------------------------------------

describe('Noop stub parser', () => {
  it('does not prevent HomeWizard adapter from claiming its headers', () => {
    const headers = ['time', 'Import T1 kWh', 'Import T2 kWh', 'Export T1 kWh', 'Export T2 kWh']
    const adapter = ParserRegistry.claim(headers)
    expect(adapter?.name).toBe('HomeWizard P1')
  })

  it('noop stub returns null for HomeWizard headers (claim always false)', () => {
    // The registry returns the FIRST match; if noop stub claimed every header,
    // it would shadow the HomeWizard adapter. Verify it doesn't.
    const headers = ['time', 'Import T1 kWh', 'Import T2 kWh', 'Export T1 kWh', 'Export T2 kWh']
    const adapter = ParserRegistry.claim(headers)
    expect(adapter?.name).not.toBe('Noop Stub')
  })

  it('noop stub returns null for arbitrary headers too', () => {
    // No adapter should claim these — even noop-stub must return false
    const adapter = ParserRegistry.claim(['col_a', 'col_b'])
    expect(adapter).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Daily-cadence tolerance (real HomeWizard sample)
// ---------------------------------------------------------------------------

describe('HomeWizard P1 Parser — daily granularity tolerance', () => {
  it('handles daily cadence rows (YYYY-MM-DD without time)', () => {
    const makeDaily = (date: string, importT1: string): Record<string, string> => ({
      time: date,
      'Import T1 kWh': importT1,
      'Import T2 kWh': '0.000',
      'Export T1 kWh': '0.000',
      'Export T2 kWh': '0.000',
    })
    const rows = [
      makeDaily('2025-01-01', '5000.000'),
      makeDaily('2025-01-02', '5010.000'),
      makeDaily('2025-01-03', '5025.000'),
    ]
    const adapter = ParserRegistry.claim([
      'time',
      'Import T1 kWh',
      'Import T2 kWh',
      'Export T1 kWh',
      'Export T2 kWh',
    ])!
    const result = adapter.transform(rows, makeFile())
    expect(result.samples.length).toBe(2)
    expect(result.samples[0].gridImportKwh).toBeCloseTo(10, 3)
    expect(result.samples[1].gridImportKwh).toBeCloseTo(15, 3)
  })
})
