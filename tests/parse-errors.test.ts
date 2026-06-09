/**
 * tests/parse-errors.test.ts — parse error contract lock (DATA-09, D-06)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Tests that parseFile() rejects with ParseRowError on malformed rows and
 * that the error carries all required structured fields.
 *
 * If any test in this file fails it means:
 * - Fail-fast on malformed row is broken (D-06)
 * - ParseRowError structured fields are missing (DATA-09)
 * - Unknown-format error is not surfaced correctly
 *
 * NOTE: PapaParse worker:true is the production path (DATA-13).
 * Tests use parseFile() but the PapaParse worker is not available in node env.
 * The implementation must handle worker:false gracefully in node, or tests call
 * the adapter transform path directly. See implementation notes in parse.ts.
 */
import { describe, it, expect } from 'vitest'
import { parseFile } from '../src/domain/parse'
import { ParseRowError } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(csvContent: string, name = 'test.csv'): File {
  return new File([csvContent], name, { type: 'text/csv' })
}

// ---------------------------------------------------------------------------
// Malformed row → ParseRowError (DATA-09, D-06)
// ---------------------------------------------------------------------------

describe('parseFile() — malformed row produces ParseRowError', () => {
  it('rejects with ParseRowError when a kWh column is non-numeric', async () => {
    const csv = [
      'time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh',
      '2026-01-15 00:00,8354.000,4651.000,3095.000,7482.000',
      '2026-01-15 00:15,NOT-A-NUMBER,4651.000,3095.000,7482.000',
    ].join('\n')
    await expect(parseFile(makeFile(csv, 'bad-data.csv'))).rejects.toBeInstanceOf(ParseRowError)
  })

  it('ParseRowError exposes fileName (DATA-09)', async () => {
    const csv = [
      'time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh',
      '2026-01-15 00:00,8354.000,4651.000,3095.000,7482.000',
      '2026-01-15 00:15,BAD,4651.000,3095.000,7482.000',
    ].join('\n')
    try {
      await parseFile(makeFile(csv, 'energy-export.csv'))
      expect.fail('Should have rejected')
    } catch (e) {
      expect(e).toBeInstanceOf(ParseRowError)
      expect((e as ParseRowError).fileName).toBe('energy-export.csv')
    }
  })

  it('ParseRowError exposes rowNumber (DATA-09)', async () => {
    const csv = [
      'time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh',
      '2026-01-15 00:00,8354.000,4651.000,3095.000,7482.000',
      '2026-01-15 00:15,BAD,4651.000,3095.000,7482.000',
    ].join('\n')
    try {
      await parseFile(makeFile(csv))
      expect.fail('Should have rejected')
    } catch (e) {
      expect(e).toBeInstanceOf(ParseRowError)
      expect((e as ParseRowError).rowNumber).toBeGreaterThan(0)
    }
  })

  it('ParseRowError exposes columnName (DATA-09)', async () => {
    const csv = [
      'time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh',
      '2026-01-15 00:00,8354.000,4651.000,3095.000,7482.000',
      '2026-01-15 00:15,BAD,4651.000,3095.000,7482.000',
    ].join('\n')
    try {
      await parseFile(makeFile(csv))
      expect.fail('Should have rejected')
    } catch (e) {
      expect(e).toBeInstanceOf(ParseRowError)
      expect((e as ParseRowError).columnName).toBeTruthy()
    }
  })

  it('ParseRowError exposes expected (DATA-09)', async () => {
    const csv = [
      'time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh',
      '2026-01-15 00:00,8354.000,4651.000,3095.000,7482.000',
      '2026-01-15 00:15,BAD,4651.000,3095.000,7482.000',
    ].join('\n')
    try {
      await parseFile(makeFile(csv))
      expect.fail('Should have rejected')
    } catch (e) {
      expect(e).toBeInstanceOf(ParseRowError)
      expect((e as ParseRowError).expected).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Unknown format → descriptive error
// ---------------------------------------------------------------------------

describe('parseFile() — unknown format', () => {
  it('rejects with a descriptive error when headers match no parser', async () => {
    const csv = [
      'datum,verbruik_kwh,teruglevering_kwh',
      '2026-01-01,5.000,2.000',
      '2026-01-02,6.000,1.000',
    ].join('\n')
    await expect(parseFile(makeFile(csv, 'unknown.csv'))).rejects.toThrow(
      /Onbekend bestandsformaat.*unknown\.csv/,
    )
  })
})

// ---------------------------------------------------------------------------
// Happy path — valid HomeWizard CSV resolves
// ---------------------------------------------------------------------------

describe('parseFile() — valid HomeWizard CSV', () => {
  it('resolves with non-empty samples and reported encoding', async () => {
    const csv = [
      'time,Import T1 kWh,Import T2 kWh,Export T1 kWh,Export T2 kWh',
      '2026-01-15 00:00,8354.000,4651.000,3095.000,7482.000',
      '2026-01-15 00:15,8354.048,4651.000,3095.024,7482.000',
      '2026-01-15 00:30,8354.096,4651.000,3095.048,7482.000',
    ].join('\n')
    const result = await parseFile(makeFile(csv, 'valid.csv'))
    expect(result.samples.length).toBeGreaterThan(0)
    expect(result.encoding).toBe('UTF-8')
    expect(result.fileName).toBe('valid.csv')
  })
})
