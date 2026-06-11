/**
 * src/helpers/metrics.ts — presentation-layer metric derivations (COMP-01, D-01..D-04)
 *
 * Pure functions — no browser globals, safe to run in a Node environment.
 * Vitest node env. Saldering framing is a Phase 4 presentation layer — NOT in the engine.
 */
import type { SimResult } from '../domain/types'

// ---------------------------------------------------------------------------
// Saldering framing functions (D-01, D-02)
// ---------------------------------------------------------------------------

/** D-01: Saldering OFF — avoided = kWh shifted (export worth nothing) */
export function avoidedWithoutSaldering(sim: SimResult): number {
  return sim.shiftedKwh
}

/**
 * D-01: Saldering ON — 1:1 annual netting; CAN be negative (D-02: don't floor).
 *
 * Computes: max(0, baselineImport − baselineExport) − max(0, residualImport − residualExport)
 *
 * A negative result means round-trip losses outweigh the saldering benefit —
 * shown as-is, NOT floored at 0. The UI renders negative values in destructive color.
 */
export function avoidedWithSaldering(sim: SimResult): number {
  const baselineNet = Math.max(0, sim.totalImportKwh - sim.totalExportKwh)
  const batteryNet  = Math.max(0, sim.residualImportKwh - sim.residualExportKwh)
  return baselineNet - batteryNet  // can be negative — D-02: show as-is
}

/**
 * D-04: Pluggable feed-in valuation seam (v1: feedInValue = 0 or 1).
 *
 * feedInValue = 0: export has no value (post-saldering world) → net import = residualImport
 * feedInValue = 1: full 1:1 netting (current saldering) → net import = residualImport − residualExport
 */
export function netImportWithValuation(
  residualImportKwh: number,
  residualExportKwh: number,
  feedInValue: 0 | 1,
): number {
  return residualImportKwh - feedInValue * residualExportKwh
}

// ---------------------------------------------------------------------------
// Derived metrics interface and aggregator (COMP-01, D-09..D-11)
// ---------------------------------------------------------------------------

/** All per-battery derived metrics shown in the comparison table */
export interface DerivedMetrics {
  /** kWh netto-import vermeden zonder saldering (D-01 OFF) */
  avoidedOff:         number
  /** kWh netto-import vermeden met saldering (D-01 ON — can be negative per D-02) */
  avoidedOn:          number
  /** Zelfverbruik % — clamped to [0, 100] for display */
  selfConsumptionPct: number
  /** Verschoven kWh — raw shiftedKwh from SimResult */
  shiftedKwh:         number
  /** Rest-import kWh */
  residualImportKwh:  number
  /** Rest-teruglevering kWh */
  residualExportKwh:  number
  /** Marginale benutting — shiftedKwh / usableCapacityKwh */
  marginalBenutting:  number
}

/**
 * Derive all table metrics from a SimResult + usable capacity.
 *
 * Guards:
 * - selfConsumptionPct returns 0 when totalImportKwh is 0 (T-04-04: no NaN/Infinity)
 * - marginalBenutting returns 0 when usableCapacityKwh < 0.1 (T-04-04: denominator guard)
 */
export function deriveMetrics(sim: SimResult, usableCapacityKwh: number): DerivedMetrics {
  return {
    avoidedOff:         avoidedWithoutSaldering(sim),
    avoidedOn:          avoidedWithSaldering(sim),
    selfConsumptionPct: sim.totalImportKwh > 0
      ? Math.min(100, (sim.shiftedKwh / sim.totalImportKwh) * 100) : 0,
    shiftedKwh:         sim.shiftedKwh,
    residualImportKwh:  sim.residualImportKwh,
    residualExportKwh:  sim.residualExportKwh,
    marginalBenutting:  usableCapacityKwh >= 0.1
      ? sim.shiftedKwh / usableCapacityKwh : 0,
  }
}

// ---------------------------------------------------------------------------
// Leader detection (COMP-03, D-11)
// ---------------------------------------------------------------------------

/** Union type of all metric keys in DerivedMetrics */
export type MetricKey = keyof DerivedMetrics

/**
 * Metrics where the highest value wins.
 * The complement (residualImportKwh, residualExportKwh) uses lowest-wins logic.
 */
export const HIGHER_IS_BETTER: Set<MetricKey> = new Set([
  'avoidedOff', 'avoidedOn', 'selfConsumptionPct', 'shiftedKwh', 'marginalBenutting',
])

/**
 * For each metric, find the index of the battery with the best value.
 *
 * "Best" = highest for HIGHER_IS_BETTER metrics; lowest for residualImport/Export.
 * Returns a Map<MetricKey, number> where the value is the 0-based battery index.
 * A metric is omitted from the map if all is empty.
 */
export function detectLeaders(all: DerivedMetrics[]): Map<MetricKey, number> {
  const keys: MetricKey[] = [
    'avoidedOff', 'avoidedOn', 'selfConsumptionPct', 'shiftedKwh',
    'residualImportKwh', 'residualExportKwh', 'marginalBenutting',
  ]
  const leaders = new Map<MetricKey, number>()
  for (const key of keys) {
    let best = -1
    let bestVal = HIGHER_IS_BETTER.has(key) ? -Infinity : Infinity
    all.forEach((m, i) => {
      const v = m[key]
      if (HIGHER_IS_BETTER.has(key) ? v > bestVal : v < bestVal) {
        bestVal = v; best = i
      }
    })
    if (best >= 0) leaders.set(key, best)
  }
  return leaders
}
