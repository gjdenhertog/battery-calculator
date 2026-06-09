/**
 * tests/dst-fixtures.test.ts — DST fixture validation (DATA-08)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Loads the two fixture CSVs from tests/fixtures/, parses them via the
 * HomeWizard P1 adapter transform path, and asserts exact interval counts.
 *
 * If any test in this file fails it means DST-safe timestamp conversion
 * is broken — spring-forward or fall-back interval count is wrong.
 *
 * DST math:
 * - 2026-03-29 spring forward: 23-hour day in Amsterdam → 92 intervals (23 × 4)
 * - 2026-10-25 fall back:      25-hour day in Amsterdam → 100 intervals (25 × 4)
 *
 * NOTE: Fixture files have 1 header + N data rows.
 * Spring fixture: 94 lines → 93 data rows → 92 samples (row[0] is reference).
 * Fall fixture:   102 lines → 101 data rows → 100 samples.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import '../src/domain/parsers/homewizard-p1'
import { ParserRegistry } from '../src/domain/parsers/registry'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(filename: string): File {
  const fixturePath = join(import.meta.dirname, 'fixtures', filename)
  const content = readFileSync(fixturePath, 'utf-8')
  return new File([content], filename, { type: 'text/csv' })
}

function parseFixture(filename: string) {
  const file = loadFixture(filename)
  const content = readFileSync(join(import.meta.dirname, 'fixtures', filename), 'utf-8')
  // Parse with PapaParse synchronously (worker:false for test harness)
  // We parse the raw CSV manually here to call the adapter transform directly
  const lines = content.split('\n').filter(l => l.trim() !== '')
  const headers = lines[0].split(',')
  const rows: Record<string, string>[] = lines.slice(1).map(line => {
    const values = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })
  const adapter = ParserRegistry.claim(headers)
  if (!adapter) {
    throw new Error(`No adapter found for fixture ${filename}`)
  }
  return adapter.transform(rows, file)
}

// ---------------------------------------------------------------------------
// Spring forward 2026-03-29 — 92 intervals (DATA-08)
// ---------------------------------------------------------------------------

describe('DST spring-forward fixture (2026-03-29)', () => {
  it('produces exactly 92 intervals for the spring-forward day', () => {
    const result = parseFixture('homewizard-spring-2026-03-29.csv')
    expect(result.samples.length).toBe(92)
  })

  it('all spring fixture samples have non-negative values (DATA-06)', () => {
    const result = parseFixture('homewizard-spring-2026-03-29.csv')
    for (const s of result.samples) {
      expect(s.gridImportKwh).toBeGreaterThanOrEqual(0)
      expect(s.gridExportKwh).toBeGreaterThanOrEqual(0)
    }
  })

  it('spring fixture timestamps are UTC Date instances (DATA-07)', () => {
    const result = parseFixture('homewizard-spring-2026-03-29.csv')
    for (const s of result.samples) {
      expect(s.timestamp).toBeInstanceOf(Date)
    }
  })
})

// ---------------------------------------------------------------------------
// Fall back 2026-10-25 — 100 intervals (DATA-08)
// ---------------------------------------------------------------------------

describe('DST fall-back fixture (2026-10-25)', () => {
  it('produces exactly 100 intervals for the fall-back day', () => {
    const result = parseFixture('homewizard-fall-2026-10-25.csv')
    expect(result.samples.length).toBe(100)
  })

  it('all fall fixture samples have non-negative values (DATA-06)', () => {
    const result = parseFixture('homewizard-fall-2026-10-25.csv')
    for (const s of result.samples) {
      expect(s.gridImportKwh).toBeGreaterThanOrEqual(0)
      expect(s.gridExportKwh).toBeGreaterThanOrEqual(0)
    }
  })

  it('fall fixture first-interval anomaly flag is true', () => {
    const result = parseFixture('homewizard-fall-2026-10-25.csv')
    expect(result.firstIntervalAnomalyFlag).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Real 15-minute fixture (upstream finding from 02-01)
// ---------------------------------------------------------------------------

describe('Real HomeWizard 15-min fixture', () => {
  it('parses the real 15-minute export with extra L1/L2/L3 columns', () => {
    const result = parseFixture('homewizard-real-sample-15-minutes.csv')
    expect(result.samples.length).toBeGreaterThan(0)
    expect(result.seriesType).toBe('cumulative')
  })

  it('all samples from real fixture have non-negative values', () => {
    const result = parseFixture('homewizard-real-sample-15-minutes.csv')
    for (const s of result.samples) {
      expect(s.gridImportKwh).toBeGreaterThanOrEqual(0)
      expect(s.gridExportKwh).toBeGreaterThanOrEqual(0)
    }
  })
})
