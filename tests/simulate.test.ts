/**
 * tests/simulate.test.ts — pure battery dispatch engine contract lock
 *   (SIM-01..05, BATT-04, D-04, D-05, D-06, D-07)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Locks the hand-computed dispatch physics: power clamping (SIM-02), symmetric
 * sqrt(rte) round-trip efficiency (SIM-03), depth-of-discharge usable cap (SIM-04),
 * empty initial SoC (D-06), net-within-interval balance (D-07), timestamp-delta
 * interval durations (D-05), and the coarse-cadence honesty flag (D-04).
 *
 * If any test in this file fails it means:
 *  - The dispatch arithmetic has been broken (most critical: criterion 2/3 values)
 *  - The DoD cap is not being enforced (socKwh exceeds nominal × dod)
 *  - The battery is discharging phantom day-one energy (D-06 violation)
 *  - The coarse-cadence flag is silently suppressed (D-04 honesty breach)
 *  - A custom BatteryConfig no longer runs identically to a catalog entry (BATT-04)
 */
import { describe, it, expect } from 'vitest'
import { simulate } from '../src/domain/simulate'
import type { IntervalSample, BatteryConfig } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Helpers — copied from tests/merge.test.ts (shared idiom, PATTERNS.md)
// ---------------------------------------------------------------------------

/** Build a minimal IntervalSample from a UTC millisecond timestamp */
function sample(utcMs: number, importKwh = 0.1, exportKwh = 0.05): IntervalSample {
  return {
    timestamp: new Date(utcMs),
    gridImportKwh: importKwh,
    gridExportKwh: exportKwh,
  }
}

/** Build a contiguous sequence of 15-min samples starting at startUtcMs */
function contiguous15min(startUtcMs: number, count: number): IntervalSample[] {
  const interval = 15 * 60 * 1000
  return Array.from({ length: count }, (_, i) => sample(startUtcMs + i * interval))
}

/** Build a contiguous sequence of daily (24h) samples starting at startUtcMs */
function contiguousDaily(startUtcMs: number, count: number): IntervalSample[] {
  const interval = 24 * 60 * 60 * 1000
  return Array.from({ length: count }, (_, i) => sample(startUtcMs + i * interval))
}

// ---------------------------------------------------------------------------
// Fixture battery configurations
// ---------------------------------------------------------------------------

/**
 * Sessy 5 kWh — the NL default battery (BATT-03).
 * Asymmetric: 2.2 kW charge, 1.7 kW discharge (Pitfall 4 from RESEARCH.md).
 * RTE 85%, 5 kWh usable (dodFraction = 1.0 — vendor quotes usable capacity).
 */
const SESSY_5: BatteryConfig = {
  id: 'sessy-5',
  name: 'Sessy 5 kWh',
  nominalCapacityKwh: 5.0,
  dodFraction: 1.0,
  roundTripEfficiency: 0.85,
  maxChargeKw: 2.2,
  maxDischargeKw: 1.7,
  datasheetUrl: 'https://www.sessy.nl/specificaties/',
}

/**
 * Synthetic criterion-3 battery.
 * 5 kWh nominal @ 0.90 DoD = 4.5 kWh usable cap.
 * Large power limits (100 kW) so charge/discharge clamps never bind —
 * only the DoD cap and sqrt(rte) are exercised.
 *
 * Expected: charge enough surplus to pin SoC at 4.5 kWh usable,
 * then discharge → delivered = 4.5 × sqrt(0.9) ≈ 4.269 kWh (criterion 3).
 *
 * Math comment (capacity-clamped round-trip):
 *   usable = 5.0 × 0.90 = 4.5 kWh
 *   eff = sqrt(0.9) ≈ 0.94868
 *   charge surplus = 10 kWh >> headroomGridSide = (4.5 - 0) / 0.94868 ≈ 4.743
 *   → gridSideCharge = min(10, 100*h, 4.743) = 4.743 (approx)
 *   → intoCell = 4.743 × 0.94868 ≈ 4.5 → soc pins to 4.5 (hard cap, SIM-04)
 *   discharge demand = 10 kWh >> soc * eff = 4.5 × 0.94868 ≈ 4.269
 *   → delivered = min(10, 4.269, 100*h) = 4.269 kWh ✓
 *
 * A pure 6-in / 6-out WITHOUT the cap would yield 6 × 0.94868 × 0.94868 ≈ 5.4 kWh
 * and would FAIL the criterion. The cap is doing the work.
 */
const CRIT3: BatteryConfig = {
  id: 'crit3',
  name: 'Synthetic criterion-3 battery',
  nominalCapacityKwh: 5.0,
  dodFraction: 0.90,
  roundTripEfficiency: 0.90,
  maxChargeKw: 100,   // intentionally large — power clamp must not bind
  maxDischargeKw: 100, // intentionally large — power clamp must not bind
  datasheetUrl: 'https://example.com/crit3',
}

// Anchored timestamps — hourly cadence, 5 representative intervals
const T0 = Date.UTC(2026, 0, 15, 8, 0, 0)  // 08:00 UTC
const T1 = T0 + 60 * 60 * 1000              // 09:00
const T2 = T1 + 60 * 60 * 1000              // 10:00
const T3 = T2 + 60 * 60 * 1000              // 11:00
const T4 = T3 + 60 * 60 * 1000              // 12:00

// 15-min timestamps for criterion-2 fixture
const Q0 = Date.UTC(2026, 0, 20, 12, 0, 0)  // 12:00 UTC
const Q1 = Q0 + 15 * 60 * 1000              // 12:15

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('simulate', () => {
  // -------------------------------------------------------------------------
  // Criterion 2 (SIM-02): power clamp on charge
  // -------------------------------------------------------------------------
  it('power clamp — small battery cant catch the peak (criterion 2)', () => {
    // 1.5 kWh export in a single 15-min interval (0.25 h), Sessy 5 kWh (2.2 kW):
    //   powerClamp = 2.2 × 0.25 = 0.55 kWh
    //   net = 1.5 − 0 = +1.5 kWh
    //   gridSideCharge = min(1.5, 0.55, headroom) = 0.55
    //   residualExport = 1.5 − 0.55 = 0.95 kWh
    const result = simulate([sample(Q0, 0, 0), sample(Q1, 0, 1.5)], SESSY_5)
    // trace[0] is the first sample (0 import, 0 export) — no charge/discharge
    // trace[1] is the 1.5 kWh export interval — power clamp binds
    expect(result.trace[1].chargedKwh).toBeCloseTo(0.55, 3)
    expect(result.trace[1].residualExportKwh).toBeCloseTo(0.95, 3)
    // No residual import (pure net-export interval)
    expect(result.trace[1].residualImportKwh).toBeCloseTo(0, 3)
  })

  // -------------------------------------------------------------------------
  // Criterion 3 (SIM-03/04): capacity-clamped round-trip, sqrt(rte) each way
  // -------------------------------------------------------------------------
  it('round-trip — DoD cap + sqrt(rte) each way (criterion 3)', () => {
    // Two-sample input: a large charge interval then a large discharge interval.
    // The battery is CRIT3: 5 kWh nominal × 0.90 DoD = 4.5 kWh usable.
    //
    // Interval 1 (h = 1 hour, from T0→T1): export = 10 kWh, import = 0
    //   eff = sqrt(0.9) ≈ 0.94868
    //   headroomGridSide = (4.5 − 0) / 0.94868 ≈ 4.743
    //   gridSideCharge = min(10, 100×1, 4.743) = 4.743
    //   intoCell = 4.743 × 0.94868 ≈ 4.5 → soc = min(0 + 4.5, 4.5) = 4.5 (cap engaged)
    //
    // Interval 2 (h = 1 hour, from T1→T2): import = 10 kWh, export = 0
    //   demand = 10 kWh
    //   soc × eff = 4.5 × 0.94868 ≈ 4.269
    //   delivered = min(10, 4.269, 100×1) = 4.269
    const result = simulate(
      [
        sample(T0, 0, 10),   // large export → charge up to usable cap
        sample(T1, 0, 10),   // still charging
        sample(T2, 10, 0),   // large import → discharge
      ],
      CRIT3,
    )
    // Find the trace row for T2 (index 2) — discharge happens here
    const dischargeRow = result.trace[2]
    expect(dischargeRow.dischargedKwh).toBeCloseTo(4.269, 2)

    // SoC must never exceed usable = 5.0 × 0.90 = 4.5 kWh
    const maxSoc = Math.max(...result.trace.map((r) => r.socKwh))
    expect(maxSoc).toBeLessThanOrEqual(4.5 + 1e-9)  // floating-point tolerance
  })

  // -------------------------------------------------------------------------
  // DoD cap invariant (SIM-04)
  // -------------------------------------------------------------------------
  it('DoD cap — socKwh never exceeds nominal×dod across all intervals', () => {
    // Multi-interval series mixing export and import with SESSY_5 (5 kWh usable).
    // usable = 5.0 × 1.0 = 5.0 kWh for Sessy; usable = 4.5 for CRIT3.
    const start = Date.UTC(2026, 0, 10, 0, 0, 0)
    const samples = Array.from({ length: 20 }, (_, i) =>
      sample(
        start + i * 15 * 60 * 1000,
        i % 3 === 0 ? 0 : 0.3,  // alternating import/export pattern
        i % 3 === 0 ? 2.0 : 0,
      ),
    )

    const resultSessy = simulate(samples, SESSY_5)
    const usableSessy = SESSY_5.nominalCapacityKwh * SESSY_5.dodFraction  // 5.0
    for (const row of resultSessy.trace) {
      expect(row.socKwh).toBeLessThanOrEqual(usableSessy + 1e-9)
      expect(row.socKwh).toBeGreaterThanOrEqual(-1e-9)
    }

    const resultCrit3 = simulate(samples, CRIT3)
    const usableCrit3 = CRIT3.nominalCapacityKwh * CRIT3.dodFraction  // 4.5
    for (const row of resultCrit3.trace) {
      expect(row.socKwh).toBeLessThanOrEqual(usableCrit3 + 1e-9)
      expect(row.socKwh).toBeGreaterThanOrEqual(-1e-9)
    }
  })

  // -------------------------------------------------------------------------
  // Multi-day no-export (D-06): empty initial SoC, no phantom discharge
  // -------------------------------------------------------------------------
  it('multi-day no-export — battery never discharges phantom energy (D-06)', () => {
    // All-import, zero-export over 3 days × 4 intervals.
    // SoC stays 0 throughout; shiftedKwh must be 0; all import is residual.
    const start = Date.UTC(2026, 1, 1, 0, 0, 0)
    const purlyImport = Array.from({ length: 12 }, (_, i) =>
      sample(start + i * 60 * 60 * 1000, 0.5, 0),  // 0.5 kWh import, 0 export
    )

    const result = simulate(purlyImport, SESSY_5)
    expect(result.shiftedKwh).toBe(0)
    // Total import = 12 × 0.5 = 6.0 kWh; all must appear as residual
    expect(result.residualImportKwh).toBeCloseTo(6.0, 3)
    expect(result.totalImportKwh).toBeCloseTo(6.0, 3)
    expect(result.totalExportKwh).toBeCloseTo(0, 3)
    // All trace rows must have 0 soc (battery never charged)
    for (const row of result.trace) {
      expect(row.socKwh).toBe(0)
      expect(row.dischargedKwh).toBe(0)
      expect(row.chargedKwh).toBe(0)
    }
  })

  // -------------------------------------------------------------------------
  // Coarse cadence (D-04): daily data sets coarseCadenceWarning
  // -------------------------------------------------------------------------
  it('coarse cadence — daily-cadence samples set coarseCadenceWarning true (D-04)', () => {
    // Daily cadence (24h intervals) must trigger the honesty flag.
    const start = Date.UTC(2026, 0, 1, 0, 0, 0)
    const dailySamples = contiguousDaily(start, 7)  // 7 daily samples

    const result = simulate(dailySamples, SESSY_5)
    expect(result.coarseCadenceWarning).toBe(true)
  })

  it('coarse cadence — 15-min samples do NOT set coarseCadenceWarning', () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0)
    const fineSamples = contiguous15min(start, 8)

    const result = simulate(fineSamples, SESSY_5)
    expect(result.coarseCadenceWarning).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Interval duration / first-sample fallback (D-05)
  // -------------------------------------------------------------------------
  it('interval duration — 2-sample input produces no NaN in any aggregate', () => {
    // 2 samples: first has no predecessor → must use next delta as fallback (D-05)
    const result = simulate([sample(T0, 0.2, 0), sample(T1, 0, 0.3)], SESSY_5)
    expect(Number.isNaN(result.shiftedKwh)).toBe(false)
    expect(Number.isNaN(result.residualImportKwh)).toBe(false)
    expect(Number.isNaN(result.residualExportKwh)).toBe(false)
    expect(Number.isNaN(result.periodDays)).toBe(false)
    for (const row of result.trace) {
      expect(Number.isNaN(row.socKwh)).toBe(false)
      expect(Number.isNaN(row.chargedKwh)).toBe(false)
      expect(Number.isNaN(row.dischargedKwh)).toBe(false)
    }
  })

  it('interval duration — single-sample input falls back to sane default, no crash', () => {
    // A single sample has no deltas at all; intervalHoursFor() must use the
    // 15-min default (D-05 single-sample fallback).
    const result = simulate([sample(T0, 0.1, 0.2)], SESSY_5)
    expect(Number.isNaN(result.shiftedKwh)).toBe(false)
    expect(result.trace).toHaveLength(1)
    // Single sample → periodDays = 0 (first === last)
    expect(result.periodDays).toBe(0)
  })

  it('interval duration — empty input returns zeroed SimResult, empty trace', () => {
    const result = simulate([], SESSY_5)
    expect(result.shiftedKwh).toBe(0)
    expect(result.trace).toHaveLength(0)
    expect(result.coarseCadenceWarning).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Discharge clamp binds independently (SIM-02, Pitfall 4)
  // -------------------------------------------------------------------------
  it('discharge clamp — Sessy 1.7 kW discharge clamp is independent of 2.2 kW charge clamp', () => {
    // To exercise discharge clamp: first charge the battery, then present a large import.
    // Sessy: maxDischargeKw = 1.7 kW. Over a 1h interval, max discharge = 1.7 kWh.
    // We provide a 3 kWh import demand → clamp binds at 1.7 kWh.
    const samples = [
      sample(T0, 0, 3.0),   // 3 kWh export → charges battery (3.0 > 2.2*1h = 2.2, clamped)
      sample(T1, 3.0, 0),   // 3 kWh import → discharge demand 3, but maxDischargeKw×1h = 1.7
    ]
    const result = simulate(samples, SESSY_5)
    // Discharge must be clamped at 1.7 × 1h = 1.7 kWh (not 3.0 or 2.2)
    expect(result.trace[1].dischargedKwh).toBeLessThanOrEqual(1.7 + 1e-9)
    // There should be residual import since demand (3.0) > delivered (≤1.7)
    expect(result.trace[1].residualImportKwh).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // Custom BatteryConfig (BATT-04): runs identically to an equivalent catalog entry
  // -------------------------------------------------------------------------
  it('custom — a custom BatteryConfig runs identically to an equivalent catalog entry', () => {
    // Build a custom BatteryConfig with the same spec as SESSY_5 (different id/name/url)
    const customSessy: BatteryConfig = {
      id: 'my-custom-battery',
      name: 'My Custom Battery (same as Sessy 5)',
      nominalCapacityKwh: 5.0,
      dodFraction: 1.0,
      roundTripEfficiency: 0.85,
      maxChargeKw: 2.2,
      maxDischargeKw: 1.7,
      datasheetUrl: 'https://example.com/custom',
    }

    const samples = [
      sample(Q0, 0, 1.5),    // export interval — exercises charge clamp
      sample(Q1, 0.5, 0),    // import interval — exercises discharge
    ]

    const resultCatalog = simulate(samples, SESSY_5)
    const resultCustom = simulate(samples, customSessy)

    // All aggregates must match (BATT-04)
    expect(resultCustom.shiftedKwh).toBeCloseTo(resultCatalog.shiftedKwh, 6)
    expect(resultCustom.residualImportKwh).toBeCloseTo(resultCatalog.residualImportKwh, 6)
    expect(resultCustom.residualExportKwh).toBeCloseTo(resultCatalog.residualExportKwh, 6)
    expect(resultCustom.totalImportKwh).toBeCloseTo(resultCatalog.totalImportKwh, 6)
    expect(resultCustom.totalExportKwh).toBeCloseTo(resultCatalog.totalExportKwh, 6)
    expect(resultCustom.trace).toHaveLength(resultCatalog.trace.length)
    for (let i = 0; i < resultCatalog.trace.length; i++) {
      expect(resultCustom.trace[i].socKwh).toBeCloseTo(resultCatalog.trace[i].socKwh, 6)
      expect(resultCustom.trace[i].chargedKwh).toBeCloseTo(resultCatalog.trace[i].chargedKwh, 6)
      expect(resultCustom.trace[i].dischargedKwh).toBeCloseTo(
        resultCatalog.trace[i].dischargedKwh,
        6,
      )
    }
  })

  // -------------------------------------------------------------------------
  // Criterion 1 (SIM-05): one-week hand-computed aggregate fixture
  // -------------------------------------------------------------------------
  it('one-week aggregate — hand-computed shiftedKwh/residualImport/residualExport (criterion 1)', () => {
    /**
     * Hand-tabulated intervals for Sessy 5 kWh (hourly cadence):
     *
     * eff = sqrt(0.85) ≈ 0.92195
     * usable = 5.0 × 1.0 = 5.0 kWh
     * maxChargeKw × 1h = 2.2 kWh
     * maxDischargeKw × 1h = 1.7 kWh
     *
     * Interval | import | export | net   | action            | gridSideCharge | delivered | soc_after | residImport | residExport
     * T0       |   0.5  |   0.0  | -0.5  | discharge         | 0              | min(0.5, 0*eff, 1.7) = 0 (soc=0) | 0      | 0.5         | 0
     * T1       |   0.0  |   1.5  | +1.5  | charge            | min(1.5, 2.2, 5.0/0.92195) = min(1.5, 2.2, 5.423) = 1.5 | 0      | 1.5*0.92195 = 1.3829 | 0           | 0
     *           (headroomGridSide = (5.0 - 0)/0.92195 = 5.423, so not binding)
     *           → gridSideCharge = 1.5, intoCell = 1.5 × 0.92195 = 1.3829, soc = 1.3829
     * T2       |   0.8  |   0.0  | -0.8  | discharge         | 0              | min(0.8, 1.3829*0.92195, 1.7) = min(0.8, 1.2747, 1.7) = 0.8 | soc -= 0.8/0.92195 = 0.8678; soc = 1.3829 - 0.8678 = 0.5151 | 0 | 0
     * T3       |   0.0  |   2.0  | +2.0  | charge            | min(2.0, 2.2, (5.0-0.5151)/0.92195) = min(2.0, 2.2, 4.876) = 2.0 |    | 2.0*0.92195 = 1.8439 + 0.5151 = 2.3590 | 0 | 0
     * T4       |   1.0  |   0.0  | -1.0  | discharge         | 0              | min(1.0, 2.3590*0.92195, 1.7) = min(1.0, 2.175, 1.7) = 1.0 | soc -= 1.0/0.92195 = 1.0847; soc = 2.3590 - 1.0847 = 1.2743 | 0 | 0
     *
     * Aggregates:
     *   totalImportKwh  = 0.5 + 0 + 0.8 + 0 + 1.0 = 2.3
     *   totalExportKwh  = 0 + 1.5 + 0 + 2.0 + 0 = 3.5
     *   shiftedKwh      = sum(dischargedKwh) = 0 + 0 + 0.8 + 0 + 1.0 = 1.8
     *   residualImport  = 0.5 + 0 + 0 + 0 + 0 = 0.5
     *   residualExport  = 0 + 0 + 0 + 0 + 0 = 0
     *
     * Note: T1 net export = 1.5 < headroomGridSide → charge is not clamped by capacity,
     * only by the 2.2 kW power limit (but 1.5 < 2.2, so not clamped by power either).
     * residualExport = gridExportKwh - gridSideCharge = 1.5 - 1.5 = 0 for T1.
     * Similarly T3 gridSideCharge = 2.0 kWh < 2.2 kW×1h → 0 residual.
     */
    const fiveIntervals = [
      sample(T0, 0.5, 0.0),   // T0: import only; battery is empty — no discharge
      sample(T1, 0.0, 1.5),   // T1: export; charge (full 1.5 kWh within power + capacity limits)
      sample(T2, 0.8, 0.0),   // T2: import; discharge 0.8 kWh (within SoC + discharge limit)
      sample(T3, 0.0, 2.0),   // T3: export; charge full 2.0 kWh
      sample(T4, 1.0, 0.0),   // T4: import; discharge 1.0 kWh (within SoC + discharge limit)
    ]

    const result = simulate(fiveIntervals, SESSY_5)

    expect(result.totalImportKwh).toBeCloseTo(2.3, 3)
    expect(result.totalExportKwh).toBeCloseTo(3.5, 3)
    expect(result.shiftedKwh).toBeCloseTo(1.8, 3)
    expect(result.residualImportKwh).toBeCloseTo(0.5, 3)
    expect(result.residualExportKwh).toBeCloseTo(0.0, 3)
  })

  // -------------------------------------------------------------------------
  // Threat model T-03-03: malformed custom BatteryConfig throws a clear error
  // -------------------------------------------------------------------------
  it('invalid config — throws on negative nominalCapacityKwh', () => {
    const bad: BatteryConfig = { ...SESSY_5, nominalCapacityKwh: -1 }
    expect(() => simulate([sample(T0)], bad)).toThrow()
  })

  it('invalid config — throws on dodFraction > 1', () => {
    const bad: BatteryConfig = { ...SESSY_5, dodFraction: 1.5 }
    expect(() => simulate([sample(T0)], bad)).toThrow()
  })

  it('invalid config — throws on roundTripEfficiency <= 0', () => {
    const bad: BatteryConfig = { ...SESSY_5, roundTripEfficiency: 0 }
    expect(() => simulate([sample(T0)], bad)).toThrow()
  })

  it('invalid config — throws on negative maxChargeKw', () => {
    const bad: BatteryConfig = { ...SESSY_5, maxChargeKw: -0.1 }
    expect(() => simulate([sample(T0)], bad)).toThrow()
  })

  // -------------------------------------------------------------------------
  // Mixed-interval residual conservation (CR-01 gap closure)
  // Exercises samples where BOTH gridImportKwh > 0 AND gridExportKwh > 0.
  // Real HomeWizard P1 15-min buckets routinely carry both flows in the same
  // interval (morning solar surplus + brief demand spike within the bucket).
  // The corrected contract preserves the non-dominant flow instead of zeroing it.
  // -------------------------------------------------------------------------

  it('mixed interval — charge branch preserves real gridImportKwh (CR-01 probe)', () => {
    /**
     * Sample: gridImportKwh = 2, gridExportKwh = 3 → net = +1 (charge path).
     * SESSY_5, empty SoC, ~1 h interval (T0 → T1, 1 h delta).
     *
     * Charge-branch math:
     *   eff = sqrt(0.85) ≈ 0.92195
     *   headroomGridSide = (5.0 − 0) / 0.92195 ≈ 5.423
     *   gridSideCharge = min(net=1, maxChargeKw×1h=2.2, headroom=5.423) = 1
     *   intoCell = 1 × 0.92195 ≈ 0.92195; soc ≈ 0.92195
     *   chargedKwh = 1
     *   residualExport = 3 − 1 = 2  (export reduced by charge)
     *   residualImport = 2           (CORRECTED: real import preserved, NOT zeroed)
     *
     * Conservation identity on the mixed row:
     *   residualImport + residualExport = 2 + 2 = 4
     *   gridImportKwh + gridExportKwh − chargedKwh − dischargedKwh = 2 + 3 − 1 − 0 = 4 ✓
     */
    const result = simulate(
      [
        sample(T0, 0, 0),          // lead sample; establishes ~1 h interval duration
        sample(T1, 2, 3),          // mixed: import=2, export=3 → net=+1 → charge
      ],
      SESSY_5,
    )
    const mixedRow = result.trace[1]

    // Probe assertion (this FAILS against the unmodified simulate.ts — RED state)
    expect(mixedRow.residualImportKwh).toBeCloseTo(2, 3)

    // Residual export is reduced by the charge
    expect(mixedRow.residualExportKwh).toBeCloseTo(2, 3)

    // chargedKwh = gridSideCharge = 1
    expect(mixedRow.chargedKwh).toBeCloseTo(1, 3)

    // Energy conservation on the mixed row:
    //   residualImport + residualExport == gridImportKwh + gridExportKwh − chargedKwh − dischargedKwh
    const conservation =
      mixedRow.residualImportKwh +
      mixedRow.residualExportKwh -
      (2 + 3 - mixedRow.chargedKwh - mixedRow.dischargedKwh)
    expect(conservation).toBeCloseTo(0, 3)
  })

  it('mixed interval — discharge branch preserves real gridExportKwh (CR-01 probe)', () => {
    /**
     * Sample: gridImportKwh = 3, gridExportKwh = 1 → net = -2 (discharge path).
     * SESSY_5, empty SoC → delivered = 0 (nothing to discharge).
     *
     * Discharge-branch math:
     *   demand = 2
     *   soc × eff = 0 × eff = 0; delivered = min(2, 0, 1.7×1) = 0
     *   residualImport = gridImportKwh − delivered = 3 − 0 = 3  (CORRECTED)
     *   residualExport = gridExportKwh = 1                        (CORRECTED: NOT zeroed)
     *
     * Conservation identity:
     *   residualImport + residualExport = 3 + 1 = 4
     *   gridImportKwh + gridExportKwh − chargedKwh − dischargedKwh = 3 + 1 − 0 − 0 = 4 ✓
     */
    const result = simulate(
      [
        sample(T0, 0, 0),          // lead sample
        sample(T1, 3, 1),          // mixed: import=3, export=1 → net=-2 → discharge path
      ],
      SESSY_5,
    )
    const mixedRow = result.trace[1]

    // Probe assertion (this FAILS against the unmodified simulate.ts — RED state)
    expect(mixedRow.residualExportKwh).toBeCloseTo(1, 3)

    // residualImport = gridImportKwh − delivered = 3 − 0 (empty battery)
    expect(mixedRow.residualImportKwh).toBeCloseTo(3, 3)

    // Nothing discharged from empty battery
    expect(mixedRow.dischargedKwh).toBeCloseTo(0, 3)

    // Energy conservation on the mixed row
    const conservation =
      mixedRow.residualImportKwh +
      mixedRow.residualExportKwh -
      (3 + 1 - mixedRow.chargedKwh - mixedRow.dischargedKwh)
    expect(conservation).toBeCloseTo(0, 3)
  })
})
