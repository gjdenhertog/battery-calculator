/**
 * src/domain/types.ts — canonical domain type contract for Phase 2+.
 *
 * This file is the root of the domain type graph. It has no imports from
 * the project. All downstream modules (parsers, merge, gaps, period-filter)
 * import from here.
 *
 * DATA-06: gridImportKwh and gridExportKwh are always non-negative.
 * DATA-07: All timestamps are UTC Date objects.
 * DATA-09: ParseRowError carries structured context for user-facing error messages.
 */

// ---------------------------------------------------------------------------
// Core sample type
// ---------------------------------------------------------------------------

/**
 * One metered interval (one row after cumulative-to-delta conversion).
 *
 * Invariants:
 * - timestamp is a UTC Date marking the END of the interval (HomeWizard convention).
 * - gridImportKwh >= 0 (DATA-06 invariant; enforced at adapter boundary).
 * - gridExportKwh >= 0 (DATA-06 invariant; enforced at adapter boundary).
 */
export interface IntervalSample {
  /** UTC Date — the end of the interval (HomeWizard timestamps mark the interval end) */
  timestamp: Date
  /** Non-negative grid import for this interval in kWh (DATA-06 invariant: always >= 0) */
  gridImportKwh: number
  /** Non-negative grid export (feed-in / teruglevering) in kWh (DATA-06 invariant: always >= 0) */
  gridExportKwh: number
}

// ---------------------------------------------------------------------------
// Series classification
// ---------------------------------------------------------------------------

/**
 * How energy values in the source CSV are expressed.
 * - 'cumulative': rows are running meter totals; deltas must be computed.
 * - 'interval': rows are already per-interval energy values.
 */
export type SeriesType = 'cumulative' | 'interval'

// ---------------------------------------------------------------------------
// Per-file parse result
// ---------------------------------------------------------------------------

/**
 * Statistics for a single file's contribution within a MergeResult.
 * Used by MergeResult.fileStats (DATA-08 / D-08).
 */
export interface FileStat {
  /** Original file name as provided by the browser File object */
  fileName: string
  /** Detected file encoding */
  encoding: 'UTF-8' | 'Windows-1252'
  /** Whether source values are cumulative meter totals or per-interval readings */
  seriesType: SeriesType
  /** Dominant interval length in minutes (typically 15 or 60) */
  cadenceMinutes: number
  /** Total data rows parsed (excluding the header row) */
  rowCount: number
  /** Samples from this file that appear in the merged output */
  rowsContributed: number
  /** Samples from this file that were overridden by a finer-resolution file */
  rowsOverridden: number
  /** False if any computed delta was negative (possible meter reset / data error) */
  isMonotonic: boolean
  /** 1-indexed row number where monotonicity first broke, if !isMonotonic */
  monotonicity_failRow?: number
  /** True for cumulative series (first row is discarded as a reference; cannot produce a delta) */
  firstIntervalAnomalyFlag: boolean
  /** Human-readable soft-warning strings for suspicious-but-parseable values (D-09) */
  softWarnings: string[]
}

/**
 * Result from parsing a single CSV file.
 *
 * Produced by a CsvParser.transform() call. Consumed by mergeFiles().
 */
export interface ParseFileResult {
  /** Original file name as provided by the browser File object */
  fileName: string
  /** Detected file encoding */
  encoding: 'UTF-8' | 'Windows-1252'
  /** Whether source values are cumulative meter totals or per-interval readings */
  seriesType: SeriesType
  /** Dominant interval length in minutes (typically 15 or 60) */
  cadenceMinutes: number
  /** Parsed interval samples, sorted by timestamp ascending */
  samples: IntervalSample[]
  /** Total data rows parsed (excluding the header row) */
  rowCount: number
  /** False if any computed delta was negative (possible meter reset / data error) */
  isMonotonic: boolean
  /** 1-indexed row number where monotonicity first broke, if !isMonotonic */
  monotonicity_failRow?: number
  /** True for cumulative series (first row is discarded as reference) */
  firstIntervalAnomalyFlag: boolean
  /** Human-readable soft-warning strings for suspicious-but-parseable values (D-09) */
  softWarnings?: string[]
}

// ---------------------------------------------------------------------------
// Merge result
// ---------------------------------------------------------------------------

/**
 * Result of merging one or more ParseFileResults into a unified time series.
 *
 * The finer-resolution file wins on timestamp conflicts (DATA-10).
 * Gap detection is DST-aware: spring-forward missing hour and fall-back
 * extra hour are not counted as gaps (CONTEXT.md D-04).
 */
export interface MergeResult {
  /** Merged interval samples sorted by timestamp ascending */
  samples: IntervalSample[]
  /** Number of missing expected intervals (gaps) in the merged series */
  gapCount: number
  /** Contiguous gap ranges (each range spans one or more missing intervals) */
  gapRanges: Array<{ from: Date; to: Date }>
  /** Per-file statistics including contribution and override counts (D-08) */
  fileStats: FileStat[]
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown by a parser on a malformed data row (DATA-09 / D-06).
 *
 * Carries structured context so the UI can render a precise Dutch error message.
 * The error message string is in Dutch per the project's NL-only v1 constraint.
 */
export class ParseRowError extends Error {
  constructor(
    /** File name where the error occurred */
    public readonly fileName: string,
    /** 1-indexed row number (matching CSV line number including header as row 1) */
    public readonly rowNumber: number,
    /** Column name where the unexpected value was found */
    public readonly columnName: string,
    /** Human-readable description of the expected value format */
    public readonly expected: string,
    /** The raw cell value that failed validation */
    public readonly actual: string,
  ) {
    super(
      `Fout in bestand "${fileName}", rij ${rowNumber}, kolom "${columnName}": verwacht ${expected}, gekregen "${actual}".`,
    )
    this.name = 'ParseRowError'
  }
}

/**
 * Thrown when a file cannot be decoded as either UTF-8 or Windows-1252.
 *
 * Encoding detection order: UTF-8 (with BOM, fatal mode), then Windows-1252.
 * If neither succeeds, this error is thrown.
 */
export class UnsupportedEncodingError extends Error {
  constructor(
    /** File name that could not be decoded */
    public readonly fileName: string,
  ) {
    super(`Bestand "${fileName}" heeft een niet-ondersteunde encoding.`)
    this.name = 'UnsupportedEncodingError'
  }
}
