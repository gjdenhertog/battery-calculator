/**
 * src/domain/period-filter.ts — pure sub-period filter (DATA-12, D-02)
 *
 * Pure functions with no browser globals. Safe to run in a Node environment.
 * The interactive date-picker UI is deferred to Phase 4 — this phase ships
 * only the tested pure function.
 */
import type { IntervalSample } from './types'

/**
 * Narrow an array of samples to those whose timestamp falls within [start, end]
 * (inclusive at both ends).
 *
 * Null bounds default to ±Infinity so the function returns the full input when
 * called as filterByPeriod(samples, null, null) — DATA-12 / D-02.
 *
 * @param samples  Source samples; not mutated.
 * @param start    Lower inclusive bound (UTC Date), or null for open left.
 * @param end      Upper inclusive bound (UTC Date), or null for open right.
 * @returns        A new array containing only the samples within the bounds.
 */
export function filterByPeriod(
  samples: IntervalSample[],
  start: Date | null,
  end: Date | null,
): IntervalSample[] {
  const s = start?.getTime() ?? -Infinity
  const e = end?.getTime() ?? Infinity
  return samples.filter(
    (x) => x.timestamp.getTime() >= s && x.timestamp.getTime() <= e,
  )
}

/**
 * Return the date range spanning the full dataset.
 *
 * @param samples  Non-empty sorted sample array.
 * @returns        { start: first timestamp, end: last timestamp }
 */
export function fullRange(samples: IntervalSample[]): { start: Date; end: Date } {
  return {
    start: samples[0].timestamp,
    end: samples[samples.length - 1].timestamp,
  }
}
