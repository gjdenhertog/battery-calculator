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
    public readonly actual: string
  ) {
    super(
      `Fout in bestand "${fileName}", rij ${rowNumber}, kolom "${columnName}": verwacht ${expected}, gekregen "${actual}".`
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
    public readonly fileName: string
  ) {
    super(`Bestand "${fileName}" heeft een niet-ondersteunde encoding.`)
    this.name = 'UnsupportedEncodingError'
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Battery simulator contracts (D-01, D-08, BATT-01..03)
// ---------------------------------------------------------------------------

/**
 * Physical specification of a single battery model (BATT-01..03, D-08).
 *
 * Invariants:
 * - nominalCapacityKwh > 0.
 * - dodFraction is in (0, 1]: 1.0 when the vendor quotes "usable" capacity
 *   (Sessy, Tesla, Huawei) — do NOT double-discount (D-08 Pitfall 2).
 * - roundTripEfficiency is in (0, 1]: sqrt() is applied each way by the
 *   simulator so charge and discharge each bear sqrt(rte) loss (SIM-03).
 * - maxChargeKw and maxDischargeKw > 0: power limits clamp energy per interval.
 * - datasheetUrl is a reachable HTTPS URL citing the source of the specs (BATT-01).
 */
export interface BatteryConfig {
  /** Unique machine-readable identifier (e.g. "sessy-5") */
  id: string
  /** Human-readable product name (e.g. "Sessy 5 kWh") */
  name: string
  /** Nominal (rated) capacity in kWh. Usable = nominalCapacityKwh × dodFraction */
  nominalCapacityKwh: number
  /**
   * Depth-of-discharge fraction in (0, 1].
   * Set to 1.0 when the vendor quotes "usable" capacity (D-08): do NOT
   * double-discount by also applying a < 1 dodFraction on top.
   */
  dodFraction: number
  /**
   * Round-trip efficiency in (0, 1].
   * sqrt() applied each way: chargeEff = dischargeEff = sqrt(roundTripEfficiency) (SIM-03).
   */
  roundTripEfficiency: number
  /** Maximum charge power in kW (grid/solar → battery). Clamps kWh per interval. */
  maxChargeKw: number
  /** Maximum discharge power in kW (battery → loads). Clamps kWh per interval. */
  maxDischargeKw: number
  /** HTTPS URL to the product datasheet or spec page (BATT-01: cited in source) */
  datasheetUrl: string
}

/**
 * Per-interval simulation trace row (D-01).
 *
 * Invariants:
 * - timestamp is a UTC Date marking the END of the interval (DATA-07 convention).
 * - socKwh >= 0 and socKwh <= nominalCapacityKwh × dodFraction.
 * - chargedKwh is grid-side (i.e. before efficiency loss going into the cell).
 *   This matches criterion 2: a 2.2 kW charger over a 0.25 h slot charges 0.55 kWh
 *   from the grid perspective, even if less lands in the cell (A-1).
 * - residualImportKwh and residualExportKwh >= 0 (DATA-06 convention carried through).
 */
export interface TraceRow {
  /** UTC Date — the end of the interval (DATA-07 convention) */
  timestamp: Date
  /** State of charge at the end of this interval in kWh (cell-side) */
  socKwh: number
  /**
   * Energy charged from the grid/solar into the battery this interval in kWh (grid-side, A-1).
   * A 2.2 kW charger × 0.25 h = 0.55 kWh grid-side (criterion 2).
   */
  chargedKwh: number
  /** Energy discharged from the battery to loads this interval in kWh (grid-side) */
  dischargedKwh: number
  /** Residual grid import after battery discharge this interval in kWh (>= 0, DATA-06) */
  residualImportKwh: number
  /** Residual solar export after battery charge this interval in kWh (>= 0, DATA-06) */
  residualExportKwh: number
}

/**
 * Summary result of simulating one battery over the full series (D-01).
 *
 * Invariants:
 * - shiftedKwh >= 0: total energy the battery moved from grid-import to self-consumption.
 * - residualImportKwh + residualExportKwh are the "what would remain" totals.
 * - totalImportKwh / totalExportKwh are the unmodified sums from the input series
 *   (useful for computing self-consumption % in the UI).
 * - coarseCadenceWarning = true when the dominant interval exceeds the threshold (D-04):
 *   daily or hourly data cannot resolve a midday solar peak, making the result optimistic.
 * - trace[] is the per-interval breakdown; aligns 1:1 with the input IntervalSample[].
 */
export interface SimResult {
  /** Total kWh shifted from grid import to self-consumption by the battery */
  shiftedKwh: number
  /** Total residual grid import over the period in kWh */
  residualImportKwh: number
  /** Total residual solar export (feed-in) over the period in kWh */
  residualExportKwh: number
  /** Total grid import from the input series in kWh (no battery; baseline) */
  totalImportKwh: number
  /** Total solar export from the input series in kWh (no battery; baseline) */
  totalExportKwh: number
  /** Number of calendar days covered by the simulation period */
  periodDays: number
  /**
   * True when the dominant interval cadence exceeds the coarse threshold (D-04).
   * Hourly or daily data cannot resolve intra-hour solar peaks; the result will
   * be optimistically high. Default threshold: 60 minutes (see SimOptions).
   */
  coarseCadenceWarning: boolean
  /** Per-interval trace rows aligned 1:1 with the input IntervalSample array */
  trace: TraceRow[]
}

/**
 * Options to tune the battery simulation (D-04).
 *
 * All fields are optional; the simulator applies documented defaults.
 */
export interface SimOptions {
  /**
   * Cadence threshold in minutes above which coarseCadenceWarning is set to true (D-04).
   * Default: 60 minutes (hourly or coarser data triggers the warning).
   */
  coarseCadenceThresholdMinutes?: number
}
