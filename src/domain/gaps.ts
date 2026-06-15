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
import { addDays } from 'date-fns'
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
  cadenceMinutes: number
): { count: number; ranges: Array<{ from: Date; to: Date }> } {
  if (samples.length <= 1) {
    return { count: 0, ranges: [] }
  }

  // Build set of actual UTC ms values present in the series
  const actual = new Set(samples.map((s) => s.timestamp.getTime()))

  // Generate expected slots by walking in LOCAL Amsterdam time.
  //
  // Sub-day cadences (15/30/60 min) divide evenly into the DST shift, so a
  // fixed UTC-ms step lands on the correct local slots and naturally skips the
  // nonexistent spring-forward hour. Daily cadence is NOT a fixed ms amount
  // across DST (a local day is 23h/24h/25h), so it must step by local calendar
  // day via addDays() on a TZDate — otherwise the walk drifts an hour at each
  // transition (overshoot → early loop exit in spring; phantom slot in fall).
  const intervalMs = cadenceMinutes * 60 * 1000
  const isDaily = cadenceMinutes >= 1440
  const dayStep = isDaily ? Math.max(1, Math.round(cadenceMinutes / 1440)) : 0
  const firstUtcMs = samples[0].timestamp.getTime()
  const lastUtcMs = samples[samples.length - 1].timestamp.getTime()

  const expectedSlots: number[] = []
  let current = new TZDate(firstUtcMs, AMSTERDAM)

  while (current.getTime() <= lastUtcMs) {
    expectedSlots.push(current.getTime())
    current = isDaily
      ? addDays(current, dayStep) // local-calendar step → DST-correct for daily
      : new TZDate(current.getTime() + intervalMs, AMSTERDAM)
  }

  // Missing = expected slots absent from the actual series.
  const missingSet = new Set(expectedSlots.filter((ts) => !actual.has(ts)))

  if (missingSet.size === 0) {
    return { count: 0, ranges: [] }
  }

  // Group missing slots into contiguous ranges by ADJACENCY in the expected
  // sequence (a present slot breaks a run) — independent of any fixed ms step,
  // so it stays correct across DST and for daily cadence.
  const ranges: Array<{ from: Date; to: Date }> = []
  let runStart: number | null = null
  let runEnd: number | null = null

  for (const ts of expectedSlots) {
    if (missingSet.has(ts)) {
      if (runStart === null) runStart = ts
      runEnd = ts
    } else if (runStart !== null) {
      ranges.push({ from: new Date(runStart), to: new Date(runEnd as number) })
      runStart = null
      runEnd = null
    }
  }
  if (runStart !== null) {
    ranges.push({ from: new Date(runStart), to: new Date(runEnd as number) })
  }

  return { count: missingSet.size, ranges }
}
