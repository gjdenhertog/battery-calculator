/**
 * src/state/signals.ts — worker-free reactive signal graph (SIM-07, SIM-08, DATA-12)
 *
 * Pure signals and computed signals — no browser Worker, no Comlink, no async.
 * Safe to import in a Node test environment without a Worker global.
 *
 * app-state.ts re-exports everything from here and adds the Comlink worker
 * singleton + scheduleRecompute on top. Test only THIS module, not app-state.ts.
 *
 * Signal contract (Phase 4 UI-SPEC Signals State Contract):
 *   parsedSamples     — raw merged samples from the last successful CSV parse
 *   selectedBatteries — batteries checked in the picker (default: [BATTERY_CATALOG[0]] = Sessy 5)
 *   customBattery     — partial BatteryConfig from the custom form, or null
 *   periodFrom        — lower period bound (Date) or null (full range)
 *   periodTo          — upper period bound (Date) or null (full range)
 *   simResults        — last worker result array, or null
 *   isComputing       — true while the worker is running
 *   computeError      — Dutch error message string, or null
 *
 * Computed contract:
 *   filteredSamples   — parsedSamples filtered by [periodFrom, periodTo] (DATA-12)
 *   coverageDays      — calendar days spanned by filteredSamples (0 if <2 samples)
 *   activeBatteries   — selectedBatteries + valid customBattery appended (if nominalCapacityKwh > 0)
 */
import { signal, computed } from '@preact/signals-core'
import type { IntervalSample, BatteryConfig, SimResult } from '../domain/types'
import { filterByPeriod } from '../domain/period-filter'
import { BATTERY_CATALOG } from '../domain/battery-catalog'

// ---------------------------------------------------------------------------
// Writable signals (UI-SPEC Signals State Contract)
// ---------------------------------------------------------------------------

/** Raw merged samples from the last successful CSV parse. Initial: empty array. */
export const parsedSamples = signal<IntervalSample[]>([])

/** Batteries selected in the picker. Initial: [Sessy 5] (BATT-03 NL default). */
export const selectedBatteries = signal<BatteryConfig[]>([BATTERY_CATALOG[0]])

/**
 * Partial config from the custom battery form, or null when not configured.
 * Only appended to activeBatteries when nominalCapacityKwh > 0 (T-04-06).
 */
export const customBattery = signal<Partial<BatteryConfig> | null>(null)

/** Lower period bound for filtering samples. Null = open left (full range). */
export const periodFrom = signal<Date | null>(null)

/** Upper period bound for filtering samples. Null = open right (full range). */
export const periodTo = signal<Date | null>(null)

/** Last worker result array. Null before first compute or after a parse error. */
export const simResults = signal<SimResult[] | null>(null)

/** True while a runComparison worker call is in-flight (SIM-08 stale-dim trigger). */
export const isComputing = signal(false)

/** Dutch error message from the last failed worker call, or null. */
export const computeError = signal<string | null>(null)

// ---------------------------------------------------------------------------
// Computed signals (read-only; react automatically to writable signal changes)
// ---------------------------------------------------------------------------

/**
 * parsedSamples narrowed to [periodFrom, periodTo] (DATA-12).
 * Delegates to filterByPeriod — returns the full set when both bounds are null.
 */
export const filteredSamples = computed(() =>
  filterByPeriod(parsedSamples.value, periodFrom.value, periodTo.value),
)

/**
 * Calendar days spanned by filteredSamples (ceil of millisecond delta ÷ 86_400_000).
 * Returns 0 when there are fewer than 2 samples (DATA-12 coverage indicator).
 */
export const coverageDays = computed(() => {
  const s = filteredSamples.value
  if (s.length < 2) return 0
  return Math.ceil(
    (s[s.length - 1].timestamp.getTime() - s[0].timestamp.getTime()) / 86_400_000,
  )
})

/**
 * Active battery set for the next runComparison call.
 * selectedBatteries with a valid customBattery appended at the end.
 * A custom battery is valid when nominalCapacityKwh > 0 (T-04-06 DoS guard).
 */
export const activeBatteries = computed(() => {
  const cb = customBattery.value
  const valid = cb !== null && (cb.nominalCapacityKwh ?? 0) > 0 ? [cb as BatteryConfig] : []
  return [...selectedBatteries.value, ...valid]
})
