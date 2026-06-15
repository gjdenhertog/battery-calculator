/**
 * src/domain/simulate.ts — pure per-interval battery dispatch (SIM-01..05, BATT-04, D-04..D-07)
 *
 * Pure function — no browser globals, safe to run in a Node environment.
 *
 * Algorithm (Convention A — SIM-03, RESEARCH.md Pattern 2):
 *  1. Validate the BatteryConfig at entry; throw InvalidBatteryConfigError on range violations.
 *  2. Derive per-interval durations from timestamp deltas (D-05): intervalHoursFor().
 *     First sample uses the next delta as fallback; single sample defaults to 15 min.
 *  3. Detect coarse cadence: median interval > threshold → coarseCadenceWarning (D-04).
 *  4. Walk samples in array order (D-06: soc starts at 0):
 *     a. net = gridExportKwh − gridImportKwh (D-07)
 *     b. net > 0 (surplus/charge):
 *          headroomGridSide = (usable − soc) / eff
 *          gridSideCharge   = min(net, maxChargeKw × h, headroomGridSide)
 *          soc              = min(soc + gridSideCharge × eff, usable)   [hard cap SIM-04]
 *          chargedKwh       = gridSideCharge  [grid-side, A-1]
 *          residualExport   = gridExportKwh − gridSideCharge
 *          residualImport   = gridImportKwh  [preserved: real import not zeroed on mixed intervals]
 *     c. net < 0 (demand/discharge):
 *          delivered        = min(−net, soc × eff, maxDischargeKw × h)
 *          soc             −= delivered / eff  [remove pre-loss energy]
 *          if soc < 0: soc = 0  [guard float underrun]
 *          dischargedKwh    = delivered
 *          residualImport   = gridImportKwh − delivered  [net demand satisfied; real import base]
 *          residualExport   = gridExportKwh  [preserved: real export not zeroed on mixed intervals]
 *  5. Accumulate: shiftedKwh += dischargedKwh; totals; push TraceRow.
 *  6. Compute periodDays from last.timestamp − first.timestamp (0 for empty/single).
 */
import type { IntervalSample, BatteryConfig, SimResult, SimOptions, TraceRow } from './types'

// ---------------------------------------------------------------------------
// Custom error for invalid BatteryConfig (T-03-03 — Security V5)
// ---------------------------------------------------------------------------

/**
 * Thrown by simulate() when a custom BatteryConfig carries out-of-range values
 * that would otherwise cause NaN-poisoned aggregates (T-03-03).
 *
 * The error message is in Dutch per the project's NL-only v1 constraint.
 */
export class InvalidBatteryConfigError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string
  ) {
    super(`Ongeldige batterijconfiguratie: veld "${field}" — ${reason}.`)
    this.name = 'InvalidBatteryConfigError'
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive per-interval durations in hours from sample timestamp deltas (D-05).
 *
 * Mirrors src/domain/merge.ts inferDominantCadence: median inter-sample delta
 * plus a small-input (< 2 samples) fallback to 15 minutes.
 *
 * Differences from inferDominantCadence:
 *  - Returns number[] (one value per sample, not a single dominant cadence).
 *  - Divides by 3_600_000 for hours, not 60_000 for minutes.
 *  - First sample uses the NEXT delta (deltasMs[0]) as its fallback, or the
 *    median if only one sample is in the array (D-05 first-sample rule).
 *
 * @param samples  Array of IntervalSample sorted ascending by timestamp.
 * @returns        Array of the same length as samples; hours[i] is the
 *                 duration of the interval ending at samples[i].timestamp.
 */
function intervalHoursFor(samples: IntervalSample[]): number[] {
  const n = samples.length
  if (n === 0) return []

  // Collect inter-sample deltas in milliseconds
  const deltasMs: number[] = []
  for (let i = 1; i < n; i++) {
    deltasMs.push(samples[i].timestamp.getTime() - samples[i - 1].timestamp.getTime())
  }

  // Median delta for coarse-cadence detection and single-sample fallback.
  // Same median formula as merge.ts inferDominantCadence (sort + midpoint index).
  const medianMs: number =
    deltasMs.length === 0
      ? 15 * 60_000 // single-sample: 15-min default
      : [...deltasMs].sort((a, b) => a - b)[Math.floor(deltasMs.length / 2)]

  const hours: number[] = new Array(n)
  // First sample: use the NEXT delta (deltasMs[0]) if available, else median.
  hours[0] = (deltasMs[0] ?? medianMs) / 3_600_000
  for (let i = 1; i < n; i++) {
    hours[i] = deltasMs[i - 1] / 3_600_000
  }
  return hours
}

/**
 * Compute the median inter-sample interval in minutes.
 * Returns the 15-min default when fewer than 2 samples are present.
 * Reused for coarseCadenceWarning (D-04) after the main loop.
 */
function medianIntervalMinutes(samples: IntervalSample[]): number {
  if (samples.length < 2) return 15
  const diffs = samples
    .slice(1)
    .map((s, i) => (s.timestamp.getTime() - samples[i].timestamp.getTime()) / 60_000)
  diffs.sort((a, b) => a - b)
  return diffs[Math.floor(diffs.length / 2)]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Simulate one battery over a series of metered intervals (SIM-01).
 *
 * @param samples  Sorted IntervalSample[] (ascending by timestamp). Not mutated.
 * @param config   BatteryConfig spec. Range-validated at entry (T-03-03).
 * @param options  Optional tuning (coarseCadenceThresholdMinutes — default 60).
 * @returns        SimResult with energy aggregates, per-interval trace, and honesty flags.
 */
export function simulate(
  samples: IntervalSample[],
  config: BatteryConfig,
  options?: SimOptions
): SimResult {
  // --- Range-check the custom config (T-03-03, Security V5) ---
  if (config.nominalCapacityKwh <= 0) {
    throw new InvalidBatteryConfigError(
      'nominalCapacityKwh',
      `moet groter zijn dan 0, was ${config.nominalCapacityKwh}`
    )
  }
  if (config.dodFraction <= 0 || config.dodFraction > 1) {
    throw new InvalidBatteryConfigError(
      'dodFraction',
      `moet in (0, 1] liggen, was ${config.dodFraction}`
    )
  }
  if (config.roundTripEfficiency <= 0 || config.roundTripEfficiency > 1) {
    throw new InvalidBatteryConfigError(
      'roundTripEfficiency',
      `moet in (0, 1] liggen, was ${config.roundTripEfficiency}`
    )
  }
  if (config.maxChargeKw < 0) {
    throw new InvalidBatteryConfigError('maxChargeKw', `moet >= 0 zijn, was ${config.maxChargeKw}`)
  }
  if (config.maxDischargeKw < 0) {
    throw new InvalidBatteryConfigError(
      'maxDischargeKw',
      `moet >= 0 zijn, was ${config.maxDischargeKw}`
    )
  }

  // --- Empty-input shortcut ---
  if (samples.length === 0) {
    return {
      shiftedKwh: 0,
      residualImportKwh: 0,
      residualExportKwh: 0,
      totalImportKwh: 0,
      totalExportKwh: 0,
      periodDays: 0,
      coarseCadenceWarning: false,
      trace: [],
    }
  }

  // --- Physics constants ---
  const usable = config.nominalCapacityKwh * config.dodFraction // SIM-04 hard cap
  const eff = Math.sqrt(config.roundTripEfficiency) // sqrt(rte) each way (SIM-03)

  // --- Interval durations (D-05) ---
  const hours = intervalHoursFor(samples)

  // --- Coarse-cadence detection (D-04) ---
  const threshold = options?.coarseCadenceThresholdMinutes ?? 60
  const coarseCadenceWarning = medianIntervalMinutes(samples) > threshold

  // --- Dispatch state machine (D-06/D-07, SIM-02/03/04) ---
  let soc = 0 // state of charge in cell; starts empty (D-06)

  let totalShifted = 0
  let totalResidualImport = 0
  let totalResidualExport = 0
  let totalImport = 0
  let totalExport = 0

  const trace: TraceRow[] = []

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const h = hours[i]

    totalImport += s.gridImportKwh
    totalExport += s.gridExportKwh

    const net = s.gridExportKwh - s.gridImportKwh // positive = surplus/charge (D-07)

    let charged = 0
    let discharged = 0
    let residualImport = s.gridImportKwh
    let residualExport = s.gridExportKwh

    if (net > 0) {
      // ---- Charge path (net surplus) ----
      // headroomGridSide: how much can we take from grid before the cell is full?
      // soc + gridSideCharge × eff ≤ usable  →  gridSideCharge ≤ (usable − soc) / eff
      const headroomGridSide = (usable - soc) / eff
      const gridSideCharge = Math.min(net, config.maxChargeKw * h, headroomGridSide)
      const intoCell = gridSideCharge * eff
      soc = Math.min(soc + intoCell, usable) // hard cap (SIM-04)
      charged = gridSideCharge // grid-side (A-1; criterion 2 expects 0.55)
      residualExport = s.gridExportKwh - gridSideCharge
      residualImport = s.gridImportKwh // preserve real grid draw on mixed intervals (CR-01)
    } else if (net < 0) {
      // ---- Discharge path (net demand) ----
      const demand = -net
      // Maximum deliverable: limited by SoC (pre-loss energy × eff = max deliverable)
      //   and by the discharge power limit
      const delivered = Math.min(demand, soc * eff, config.maxDischargeKw * h)
      soc -= delivered / eff // remove the pre-loss cell energy
      if (soc < 0) soc = 0 // guard floating-point underrun
      discharged = delivered
      residualImport = s.gridImportKwh - delivered // real import base minus what battery covered (CR-01)
      residualExport = s.gridExportKwh // preserve real export on mixed intervals (CR-01)
    }

    totalShifted += discharged
    totalResidualImport += residualImport
    totalResidualExport += residualExport

    trace.push({
      timestamp: s.timestamp,
      socKwh: soc,
      chargedKwh: charged,
      dischargedKwh: discharged,
      residualImportKwh: residualImport,
      residualExportKwh: residualExport,
    })
  }

  // periodDays: calendar span from first to last timestamp (0 for single sample)
  const firstTs = samples[0].timestamp.getTime()
  const lastTs = samples[samples.length - 1].timestamp.getTime()
  const periodDays = (lastTs - firstTs) / 86_400_000

  return {
    shiftedKwh: totalShifted,
    residualImportKwh: totalResidualImport,
    residualExportKwh: totalResidualExport,
    totalImportKwh: totalImport,
    totalExportKwh: totalExport,
    periodDays,
    coarseCadenceWarning,
    trace,
  }
}
