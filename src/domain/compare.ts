/**
 * src/domain/compare.ts — multi-battery comparison aggregator (SIM-06)
 *
 * Pure function — no browser globals, safe to run in a Node environment.
 *
 * The 5-battery UI cap (BATT-05) and saldering framing are deferred to Phase 4 —
 * runComparison imposes no limit and returns one SimResult per battery in input order.
 */
import { simulate } from './simulate'
import type { IntervalSample, BatteryConfig, SimResult, SimOptions } from './types'

/**
 * Run the battery dispatch simulator over each battery in `batteries` and return
 * one SimResult per battery, in the same order as the input array (SIM-06).
 *
 * Order is preserved by construction: Array.map() guarantees result[i] corresponds
 * to batteries[i]. No battery-count cap is applied here (BATT-05 is a Phase 4 UI
 * concern). Custom batteries mix freely with catalog entries — both share the same
 * BatteryConfig shape and flow through simulate() identically (D-10).
 *
 * @param samples   Sorted IntervalSample[] (ascending by timestamp). Not mutated.
 * @param batteries Array of BatteryConfig to compare. Not mutated. May be empty.
 * @param options   Optional SimOptions forwarded to each simulate() call.
 * @returns         SimResult[] of the same length as batteries, index-aligned.
 */
export function runComparison(
  samples: IntervalSample[],
  batteries: BatteryConfig[],
  options?: SimOptions
): SimResult[] {
  return batteries.map((b) => simulate(samples, b, options))
}
