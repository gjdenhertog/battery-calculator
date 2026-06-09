/**
 * src/domain/parsers/homewizard-p1.ts — HomeWizard P1 CSV adapter.
 *
 * Self-registers with ParserRegistry on import (DATA-03 side-effect pattern).
 * Handles cumulative meter readings → per-interval deltas (DATA-05).
 * DST-safe timestamp parsing via TZDate("Europe/Amsterdam") (DATA-07).
 * Tolerates extra trailing columns (L1/L2/L3 max W) and both 15-min and
 * daily cadence (upstream finding from plan 02-01 real fixtures).
 *
 * DATA-02: Claims CSV files whose headers include the 5 required columns.
 * DATA-04: Decimal comma normalisation ("8354,590" → 8354.590).
 * DATA-05: cumulative→delta, firstIntervalAnomalyFlag, monotonicity flag.
 * DATA-06: gridImportKwh and gridExportKwh are always clamped to >= 0.
 * DATA-07: All timestamps are UTC Date objects.
 * D-06: ParseRowError thrown immediately on non-numeric or malformed timestamp.
 */

import { TZDate } from '@date-fns/tz'
import { ParseRowError } from '../types'
import type { IntervalSample, ParseFileResult, SeriesType } from '../types'
import { ParserRegistry } from './registry'
import type { CsvParser } from './registry'

// ---------------------------------------------------------------------------
// Required header columns (upstream: real samples also have L1/L2/L3 max W)
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS = [
  'time',
  'Import T1 kWh',
  'Import T2 kWh',
  'Export T1 kWh',
  'Export T2 kWh',
] as const

// ---------------------------------------------------------------------------
// Internal row representation after parsing
// ---------------------------------------------------------------------------

interface ParsedRow {
  rowNumber: number
  timestamp: Date
  importT1: number
  importT2: number
  exportT1: number
  exportT2: number
}

// ---------------------------------------------------------------------------
// Numeric helper — handles decimal comma (Pitfall 6)
// ---------------------------------------------------------------------------

function parseKwh(raw: string, col: string, fileName: string, rowNum: number): number {
  const normalized = raw.trim().replace(',', '.')
  const val = parseFloat(normalized)
  if (isNaN(val)) {
    throw new ParseRowError(fileName, rowNum, col, 'non-negative number', raw)
  }
  return val
}

// ---------------------------------------------------------------------------
// Timestamp helper — TZDate("Europe/Amsterdam") → UTC Date (DATA-07, Pitfall 1)
//
// Supports two formats:
//   "YYYY-MM-DD HH:MM"  — 15-min or hourly export
//   "YYYY-MM-DD"        — daily export (treated as midnight Amsterdam time)
// ---------------------------------------------------------------------------

function parseLocalTimestamp(raw: string, fileName: string, rowNum: number): Date {
  const trimmed = raw.trim()

  // Try "YYYY-MM-DD HH:MM" first
  const fullMatch = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(trimmed)
  if (fullMatch) {
    const [, yr, mo, dy, hr, mn] = fullMatch.map(Number)
    return new Date(new TZDate(yr, mo - 1, dy, hr, mn, 'Europe/Amsterdam').getTime())
  }

  // Try "YYYY-MM-DD" (daily granularity — midnight Amsterdam time)
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateMatch) {
    const [, yr, mo, dy] = dateMatch.map(Number)
    return new Date(new TZDate(yr, mo - 1, dy, 0, 0, 'Europe/Amsterdam').getTime())
  }

  throw new ParseRowError(fileName, rowNum, 'time', 'YYYY-MM-DD HH:MM or YYYY-MM-DD', raw)
}

// ---------------------------------------------------------------------------
// Cadence inference — median interval in minutes
// ---------------------------------------------------------------------------

function inferCadence(samples: IntervalSample[]): number {
  if (samples.length < 2) return 15
  const diffs = samples
    .slice(1)
    .map((s, i) => (s.timestamp.getTime() - samples[i].timestamp.getTime()) / 60000)
  diffs.sort((a, b) => a - b)
  return diffs[Math.floor(diffs.length / 2)]
}

// ---------------------------------------------------------------------------
// HomeWizard P1 Parser adapter
// ---------------------------------------------------------------------------

const HomeWizardP1Parser: CsvParser = {
  name: 'HomeWizard P1',

  /**
   * Returns true if all 5 required HomeWizard headers are present.
   * Extra columns (e.g., L1/L2/L3 max W) are ignored — they are silently
   * passed over by PapaParse header:true and never referenced.
   */
  claim(headers: string[]): boolean {
    return REQUIRED_HEADERS.every(h => headers.includes(h))
  },

  /**
   * Transform raw PapaParse rows into a ParseFileResult.
   *
   * Algorithm:
   * 1. Parse all rows into typed ParsedRow objects (throws ParseRowError on bad data).
   * 2. Starting from index 1, compute per-interval deltas.
   * 3. Flag monotonicity failure on negative delta (D-05 flag-not-fabricate).
   * 4. Clamp each delta to Math.max(0, delta) AFTER flagging (DATA-06).
   * 5. Return ParseFileResult with firstIntervalAnomalyFlag: true (row[0] discarded).
   */
  transform(rows: Record<string, string>[], file: File): ParseFileResult {
    const seriesType: SeriesType = 'cumulative'
    const fileName = file.name

    // Step 1: Parse all rows into typed objects.
    const parsed: ParsedRow[] = rows.map((row, i) => {
      const rowNumber = i + 2 // 1-indexed; header is row 1
      return {
        rowNumber,
        timestamp: parseLocalTimestamp(row['time'], fileName, rowNumber),
        importT1: parseKwh(row['Import T1 kWh'], 'Import T1 kWh', fileName, rowNumber),
        importT2: parseKwh(row['Import T2 kWh'], 'Import T2 kWh', fileName, rowNumber),
        exportT1: parseKwh(row['Export T1 kWh'], 'Export T1 kWh', fileName, rowNumber),
        exportT2: parseKwh(row['Export T2 kWh'], 'Export T2 kWh', fileName, rowNumber),
      }
    })

    // Step 2–4: Cumulative → delta conversion, starting from index 1.
    const samples: IntervalSample[] = []
    let isMonotonic = true
    let monotonicity_failRow: number | undefined

    for (let i = 1; i < parsed.length; i++) {
      const prev = parsed[i - 1]
      const curr = parsed[i]
      const importKwh = curr.importT1 + curr.importT2 - (prev.importT1 + prev.importT2)
      const exportKwh = curr.exportT1 + curr.exportT2 - (prev.exportT1 + prev.exportT2)

      // D-05: flag-not-fabricate — flag first violation, continue processing
      if (importKwh < -0.001 || exportKwh < -0.001) {
        if (isMonotonic) {
          isMonotonic = false
          monotonicity_failRow = curr.rowNumber
        }
      }

      samples.push({
        timestamp: curr.timestamp,
        gridImportKwh: Math.max(0, importKwh),
        gridExportKwh: Math.max(0, exportKwh),
      })
    }

    return {
      fileName,
      encoding: 'UTF-8', // placeholder — overwritten by parseFile() after encoding detection
      seriesType,
      cadenceMinutes: inferCadence(samples),
      samples,
      rowCount: rows.length,
      isMonotonic,
      monotonicity_failRow,
      firstIntervalAnomalyFlag: true, // always true for cumulative (row[0] discarded)
      softWarnings: [],
    }
  },
}

// Side-effect registration — runs when this module is first imported.
// parse.ts imports this file statically; Rollup keeps it because of export {}.
ParserRegistry.register(HomeWizardP1Parser)
export {}
