/**
 * src/domain/gaps.ts — DST-aware gap detection (DATA-11, D-04, D-05)
 *
 * Pure function — no browser globals, safe to run in a Node environment.
 *
 * Algorithm: Walk the expected UTC timestamps at the given cadence, but
 * generate expected slots by stepping in local Europe/Amsterdam time via
 * TZDate. This means the nonexistent 02:00–02:59 spring-forward block is
 * never generated as an expected slot (the local clock never has those times),
 * and both instances of the fall-back 02:00–02:59 block (UTC+2 and UTC+1)
 * produce distinct UTC values that each appear once in the expected set.
 *
 * Gap = expected slot not present in the actual sample set.
 * Never fabricates data — only counts and reports (D-05).
 */
import { TZDate } from '@date-fns/tz'
import type { IntervalSample } from './types'

const AMSTERDAM = 'Europe/Amsterdam'

/**
 * Detect missing intervals in a sorted sample array.
 *
 * @param samples         Sorted IntervalSample[] (ascending by timestamp). Not mutated.
 * @param cadenceMinutes  Dominant interval length in minutes (typically 15 or 60).
 * @returns               Gap count and contiguous gap ranges.
 */
export function detectGaps(
  samples: IntervalSample[],
  cadenceMinutes: number,
): { count: number; ranges: Array<{ from: Date; to: Date }> } {
  if (samples.length <= 1) {
    return { count: 0, ranges: [] }
  }

  // Build set of actual UTC ms values present in the series
  const actual = new Set(samples.map((s) => s.timestamp.getTime()))

  // Generate expected slots by walking in local Amsterdam time.
  // Using TZDate ensures the spring-forward gap (02:00–02:59 local) never
  // appears in the expected set, and both fall-back slots produce distinct
  // UTC values that are both expected.
  const intervalMs = cadenceMinutes * 60 * 1000
  const firstUtcMs = samples[0].timestamp.getTime()
  const lastUtcMs = samples[samples.length - 1].timestamp.getTime()

  // Convert first UTC timestamp to a TZDate in Amsterdam to start the walk
  const firstTzDate = new TZDate(firstUtcMs, AMSTERDAM)

  const expectedSlots: number[] = []
  let current = firstTzDate

  // Walk forward by adding cadenceMinutes to the local TZDate.
  // TZDate arithmetic respects DST: adding minutes in local time naturally
  // skips the nonexistent spring-forward hour and handles the repeated
  // fall-back hour correctly (both produce different UTC values).
  while (current.getTime() <= lastUtcMs) {
    expectedSlots.push(current.getTime())
    // Advance by cadence in UTC ms (uniform step), then re-wrap into TZDate
    // to stay in local time context for DST boundary detection.
    current = new TZDate(current.getTime() + intervalMs, AMSTERDAM)
  }

  // Find missing slots (expected but not in actual)
  const missing = expectedSlots.filter((ts) => !actual.has(ts))

  if (missing.length === 0) {
    return { count: 0, ranges: [] }
  }

  // Group consecutive missing slots into contiguous ranges
  const ranges: Array<{ from: Date; to: Date }> = []
  let rangeStart = missing[0]
  let rangeEnd = missing[0]

  for (let i = 1; i < missing.length; i++) {
    const expected = rangeEnd + intervalMs
    if (missing[i] === expected) {
      // Consecutive — extend current range
      rangeEnd = missing[i]
    } else {
      // Break in continuity — emit current range, start new one
      ranges.push({ from: new Date(rangeStart), to: new Date(rangeEnd) })
      rangeStart = missing[i]
      rangeEnd = missing[i]
    }
  }
  // Emit final range
  ranges.push({ from: new Date(rangeStart), to: new Date(rangeEnd) })

  return { count: missing.length, ranges }
}
