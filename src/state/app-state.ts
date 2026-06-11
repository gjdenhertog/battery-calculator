/**
 * src/state/app-state.ts — reactive state store: worker singleton + recompute (SIM-07, SIM-08)
 *
 * Owns the Comlink sim worker singleton (constructed ONCE at module init — never inside
 * effects or functions, per RESEARCH Pitfall 4). Provides scheduleRecompute() with a
 * debounce + generation counter to discard stale out-of-order worker results (RESEARCH
 * Open Q3 / Pitfall 4: prevents flickering isComputing and last-worker-wins corruption).
 *
 * All writable signals and computed signals are imported from signals.ts (worker-free)
 * and re-exported so callers have a single import point: '../state/app-state'.
 *
 * XSS safety: computeError is set from internal catch blocks (no user-derived HTML).
 * No DOM access here — only signals and async worker calls.
 */
import * as Comlink from 'comlink'
import SimWorker from '../workers/sim-worker?worker'
import type { runComparison } from '../domain/compare'
import { batch } from '@preact/signals-core'

// Re-export the worker-free signal graph so callers import from one place.
export {
  parsedSamples,
  selectedBatteries,
  customBattery,
  periodFrom,
  periodTo,
  simResults,
  isComputing,
  computeError,
  filteredSamples,
  coverageDays,
  activeBatteries,
} from './signals'

// Import for internal use in scheduleRecompute.
import {
  filteredSamples,
  activeBatteries,
  simResults,
  isComputing,
  computeError,
} from './signals'

// ---------------------------------------------------------------------------
// Worker singleton (Pitfall 4: construct once at module scope, never in effects)
// ---------------------------------------------------------------------------

type SimApi = { runComparison: typeof runComparison }

/**
 * Single Comlink worker instance. Constructed at module initialisation so the
 * worker script is loaded exactly once per page lifecycle. Never re-constructed
 * on recompute (Pitfall 4 guard).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const _simWorker = new SimWorker()

/**
 * Comlink proxy for the sim worker. Call simApi.runComparison(samples, batteries)
 * from any module that needs direct worker access (e.g. one-off calls from tests).
 */
export const simApi = Comlink.wrap<SimApi>(_simWorker)

// ---------------------------------------------------------------------------
// Generation-guarded debounced recompute (RESEARCH Open Q3 / Pitfall 4)
// ---------------------------------------------------------------------------

let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Module-level generation counter. Incremented on every scheduled compute attempt.
 * Each async worker call captures its own generation at launch; if a newer call
 * fires before the old one resolves, the older result is discarded (T-04-07 guard).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
let _generation = 0

/**
 * Schedule a battery simulation recompute.
 *
 * Debounced: rapid calls collapse into one worker invocation (D-07, 400ms delay
 * for continuous input such as custom battery field edits). Discrete events
 * (checkbox toggle, date change, file upload) should pass `immediate = true`
 * to bypass the delay.
 *
 * Generation guard: if another scheduleRecompute() fires while the worker is
 * still running, only the newest result is written to simResults — older
 * out-of-order results are silently discarded (T-04-07 stale-result mitigation).
 *
 * @param immediate  When true, skips the 400ms debounce and fires at the next
 *                   event-loop turn (setTimeout 0). Default: false.
 */
export function scheduleRecompute(immediate = false): void {
  if (_debounceTimer !== null) clearTimeout(_debounceTimer)

  const delay = immediate ? 0 : 400 // D-07: 400ms for continuous input

  _debounceTimer = setTimeout(() => {
    void _runCompute()
  }, delay)
}

async function _runCompute(): Promise<void> {
  const samples = filteredSamples.value
  const batteries = activeBatteries.value

  // Skip if there is nothing to simulate.
  if (samples.length === 0 || batteries.length === 0) return

  // Capture generation before the await boundary (RESEARCH Open Q3).
  const myGen = ++_generation

  batch(() => {
    isComputing.value = true
    computeError.value = null
  })

  try {
    const results = await simApi.runComparison(samples, batteries)

    // Discard superseded results (T-04-07: only newest myGen writes).
    if (myGen !== _generation) return

    batch(() => {
      simResults.value = results
      isComputing.value = false
    })
  } catch {
    // Discard error from a superseded call.
    if (myGen !== _generation) return

    batch(() => {
      computeError.value =
        'Berekening mislukt. Controleer of je gegevens volledig zijn en probeer het opnieuw.'
      simResults.value = null
      isComputing.value = false
    })
  }
}

// Export batch for consumers that need atomic multi-signal writes (e.g. drop-zone).
export { batch }
