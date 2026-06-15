/**
 * tests/app-state.test.ts — signal graph contract lock (SIM-07, SIM-08, DATA-12)
 *
 * Runs in the DEFAULT node environment (no Worker global).
 *
 * IMPORTANT: This file imports from '../src/state/signals' (the worker-free
 * sub-module), NOT from '../src/state/app-state'. The app-state module uses the
 * Vite '?worker' import suffix to construct the Comlink worker — that suffix is
 * not available in a Node Vitest environment. signals.ts is explicitly the
 * testable surface. app-state.ts re-exports everything from signals.ts, so the
 * tested contracts apply equally to both modules in the browser.
 *
 * Tests verify:
 *   - Initial values (Sessy 5 pre-selected, empty samples, null bounds)
 *   - filteredSamples computed re-derives when parsedSamples / period signals change
 *   - coverageDays computed for a 2-sample fixture spanning N days
 *   - activeBatteries computed with/without a valid customBattery
 *   - Integration: setting parsedSamples makes filteredSamples reflect it (Task 2 re-wire)
 *   - customBatteries collection + salderingOn boolean signal contract (Phase 6 D-09, D-06)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  parsedSamples,
  selectedBatteries,
  customBatteries,
  salderingOn,
  periodFrom,
  periodTo,
  simResults,
  isComputing,
  computeError,
  filteredSamples,
  coverageDays,
  activeBatteries,
} from '../src/state/signals'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'
import type { IntervalSample, BatteryConfig } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function sample(utcMs: number, gridImportKwh = 0.1, gridExportKwh = 0.05): IntervalSample {
  return { timestamp: new Date(utcMs), gridImportKwh, gridExportKwh }
}

const T0 = Date.UTC(2026, 0, 15, 0, 0, 0)  // 2026-01-15T00:00:00Z
const ONE_DAY_MS = 86_400_000

// ---------------------------------------------------------------------------
// Reset signals before each test to ensure test isolation
// ---------------------------------------------------------------------------

beforeEach(() => {
  parsedSamples.value = []
  selectedBatteries.value = [BATTERY_CATALOG[0]]
  customBatteries.value = []
  salderingOn.value = false
  periodFrom.value = null
  periodTo.value = null
  simResults.value = null
  isComputing.value = false
  computeError.value = null
})

// ---------------------------------------------------------------------------
// Initial values
// ---------------------------------------------------------------------------

describe('initial signal values', () => {
  it('parsedSamples starts as an empty array', () => {
    expect(parsedSamples.value).toEqual([])
  })

  it('selectedBatteries starts with BATTERY_CATALOG[0] (Sessy 5 — BATT-03)', () => {
    expect(selectedBatteries.value).toHaveLength(1)
    expect(selectedBatteries.value[0]).toBe(BATTERY_CATALOG[0])
    expect(selectedBatteries.value[0].id).toBe('sessy-5')
  })

  it('periodFrom starts as null (open left = full range)', () => {
    expect(periodFrom.value).toBeNull()
  })

  it('periodTo starts as null (open right = full range)', () => {
    expect(periodTo.value).toBeNull()
  })

  it('simResults starts as null', () => {
    expect(simResults.value).toBeNull()
  })

  it('isComputing starts as false', () => {
    expect(isComputing.value).toBe(false)
  })

  it('computeError starts as null', () => {
    expect(computeError.value).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// filteredSamples computed
// ---------------------------------------------------------------------------

describe('filteredSamples computed', () => {
  it('equals full input when both periodFrom and periodTo are null', () => {
    const fixture = [
      sample(T0),
      sample(T0 + ONE_DAY_MS),
      sample(T0 + 2 * ONE_DAY_MS),
    ]
    parsedSamples.value = fixture

    expect(filteredSamples.value).toHaveLength(3)
    expect(filteredSamples.value).toEqual(fixture)
  })

  it('narrows to samples within [periodFrom, periodTo] when both are set', () => {
    const t1 = T0 + ONE_DAY_MS
    const t2 = T0 + 2 * ONE_DAY_MS
    const t3 = T0 + 3 * ONE_DAY_MS
    const fixture = [sample(T0), sample(t1), sample(t2), sample(t3)]
    parsedSamples.value = fixture

    periodFrom.value = new Date(t1)
    periodTo.value = new Date(t2)

    const result = filteredSamples.value
    expect(result).toHaveLength(2)
    expect(result[0].timestamp.getTime()).toBe(t1)
    expect(result[1].timestamp.getTime()).toBe(t2)
  })

  it('re-derives when parsedSamples changes (Task 2 re-wire integration)', () => {
    // Empty initially
    expect(filteredSamples.value).toHaveLength(0)

    // After setting parsedSamples, filteredSamples reflects it
    const fixture = [sample(T0), sample(T0 + ONE_DAY_MS)]
    parsedSamples.value = fixture

    expect(filteredSamples.value).toHaveLength(2)
    expect(filteredSamples.value[0].timestamp.getTime()).toBe(T0)
  })

  it('re-derives when periodFrom changes', () => {
    const t1 = T0 + ONE_DAY_MS
    const fixture = [sample(T0), sample(t1)]
    parsedSamples.value = fixture

    // Initially both samples visible
    expect(filteredSamples.value).toHaveLength(2)

    // After setting periodFrom to t1, only the second sample remains
    periodFrom.value = new Date(t1)
    expect(filteredSamples.value).toHaveLength(1)
    expect(filteredSamples.value[0].timestamp.getTime()).toBe(t1)
  })
})

// ---------------------------------------------------------------------------
// coverageDays computed
// ---------------------------------------------------------------------------

describe('coverageDays computed', () => {
  it('returns 0 when parsedSamples is empty', () => {
    expect(coverageDays.value).toBe(0)
  })

  it('returns 0 when filteredSamples has only 1 sample', () => {
    parsedSamples.value = [sample(T0)]
    expect(coverageDays.value).toBe(0)
  })

  it('returns 1 for two samples exactly 1 day apart (ceiling)', () => {
    parsedSamples.value = [sample(T0), sample(T0 + ONE_DAY_MS)]
    expect(coverageDays.value).toBe(1)
  })

  it('returns 7 for samples spanning 7 days', () => {
    parsedSamples.value = [sample(T0), sample(T0 + 7 * ONE_DAY_MS)]
    expect(coverageDays.value).toBe(7)
  })

  it('ceil-rounds up fractional days', () => {
    // 1.5 days → Math.ceil(1.5) = 2
    parsedSamples.value = [sample(T0), sample(T0 + Math.round(1.5 * ONE_DAY_MS))]
    expect(coverageDays.value).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// activeBatteries computed
// ---------------------------------------------------------------------------

describe('activeBatteries computed', () => {
  it('returns selectedBatteries when customBatteries is empty (D-09)', () => {
    expect(activeBatteries.value).toHaveLength(1)
    expect(activeBatteries.value[0].id).toBe('sessy-5')
  })

  it('excludes a custom battery with nominalCapacityKwh = 0 (invalid — T-04-06)', () => {
    customBatteries.value = [
      {
        id: 'invalid-1',
        name: 'Invalid',
        nominalCapacityKwh: 0,
        dodFraction: 1.0,
        roundTripEfficiency: 0.85,
        maxChargeKw: 2.2,
        maxDischargeKw: 1.7,
        datasheetUrl: 'https://example.com',
      },
    ]
    expect(activeBatteries.value).toHaveLength(1)
  })

  it('excludes a custom battery with missing nominalCapacityKwh (T-04-06)', () => {
    // nominalCapacityKwh defaults to 0 for undefined — use 0 explicitly
    customBatteries.value = [
      {
        id: 'invalid-2',
        name: 'No Capacity',
        nominalCapacityKwh: 0,
        dodFraction: 1.0,
        roundTripEfficiency: 0.85,
        maxChargeKw: 2.2,
        maxDischargeKw: 1.7,
        datasheetUrl: 'https://example.com',
      },
    ]
    expect(activeBatteries.value).toHaveLength(1)
  })

  it('appends a valid custom battery (nominalCapacityKwh > 0) at the end', () => {
    const custom: BatteryConfig = {
      id: 'my-battery',
      name: 'My Battery',
      nominalCapacityKwh: 10,
      dodFraction: 0.9,
      roundTripEfficiency: 0.9,
      maxChargeKw: 3,
      maxDischargeKw: 3,
      datasheetUrl: 'https://example.com',
    }
    customBatteries.value = [custom]

    const result = activeBatteries.value
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('sessy-5')
    expect(result[1].id).toBe('my-battery')
  })

  it('re-derives when selectedBatteries changes', () => {
    // Add a second catalog battery
    selectedBatteries.value = [BATTERY_CATALOG[0], BATTERY_CATALOG[1]]
    expect(activeBatteries.value).toHaveLength(2)
  })

  it('preserves selection order (selectedBatteries first, customBatteries last)', () => {
    selectedBatteries.value = [BATTERY_CATALOG[1], BATTERY_CATALOG[0]]
    customBatteries.value = [
      {
        id: 'custom',
        name: 'Eigen batterij',
        nominalCapacityKwh: 5,
        dodFraction: 1.0,
        roundTripEfficiency: 0.85,
        maxChargeKw: 2.2,
        maxDischargeKw: 1.7,
        datasheetUrl: 'https://example.com',
      },
    ]

    const result = activeBatteries.value
    expect(result).toHaveLength(3)
    expect(result[0].id).toBe(BATTERY_CATALOG[1].id)
    expect(result[1].id).toBe(BATTERY_CATALOG[0].id)
    expect(result[2].id).toBe('custom')
  })
})

// ---------------------------------------------------------------------------
// Fixture helpers for customBatteries tests
// ---------------------------------------------------------------------------

function makeBattery(overrides: Partial<BatteryConfig> = {}): BatteryConfig {
  return {
    id: 'custom-1',
    name: 'Eigen batterij 1',
    nominalCapacityKwh: 5,
    dodFraction: 1.0,
    roundTripEfficiency: 0.85,
    maxChargeKw: 2.2,
    maxDischargeKw: 1.7,
    datasheetUrl: 'https://example.com',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// customBatteries + salderingOn signal contract (Phase 6 D-09, D-06)
// ---------------------------------------------------------------------------

describe('customBatteries + salderingOn signal contract', () => {
  it('salderingOn defaults to false (D-06)', () => {
    expect(salderingOn.value).toBe(false)
  })

  it('customBatteries defaults to [] and activeBatteries equals [BATTERY_CATALOG[0]] with default selection', () => {
    expect(customBatteries.value).toEqual([])
    expect(activeBatteries.value).toHaveLength(1)
    expect(activeBatteries.value.map((b) => b.id)).toEqual(['sessy-5'])
  })

  it('pushing one valid custom (nominalCapacityKwh: 6) makes activeBatteries length 2 with the custom last', () => {
    const valid = makeBattery({ id: 'custom-1', nominalCapacityKwh: 6 })
    customBatteries.value = [valid]

    const result = activeBatteries.value
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('sessy-5')
    expect(result[1].id).toBe('custom-1')
  })

  it('a custom with nominalCapacityKwh: 0 is excluded from activeBatteries (length stays 1)', () => {
    const invalid = makeBattery({ id: 'custom-1', nominalCapacityKwh: 0 })
    customBatteries.value = [invalid]

    expect(activeBatteries.value).toHaveLength(1)
    expect(activeBatteries.value.map((b) => b.id)).toEqual(['sessy-5'])
  })

  it('two valid customs appear in activeBatteries in array order (custom-1 before custom-2)', () => {
    const first = makeBattery({ id: 'custom-1', nominalCapacityKwh: 4 })
    const second = makeBattery({ id: 'custom-2', nominalCapacityKwh: 8, name: 'Eigen batterij 2' })
    customBatteries.value = [first, second]

    const result = activeBatteries.value
    expect(result).toHaveLength(3)
    expect(result.map((b) => b.id)).toEqual(['sessy-5', 'custom-1', 'custom-2'])
  })
})
