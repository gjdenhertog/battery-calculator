/**
 * src/domain/bucket-by-month.ts — Amsterdam-local month aggregator (VIZ-01)
 *
 * Pure function — no browser globals, safe to run in a Node environment.
 *
 * Groups a TraceRow[] into calendar months in the Europe/Amsterdam timezone.
 * Uses TZDate (not raw Date.getMonth()) to avoid the Amsterdam-UTC offset
 * causing late-evening rows to bucket into the wrong UTC month (Pitfall 3).
 *
 * isPartial semantics (D-05):
 *   A month is "full" only if BOTH its 1st and last calendar day appear in
 *   the local-day numbers present in that month's bucket. If either is absent
 *   the month is partial. All months in a dataset spanning <2 full months
 *   are partial — the chart shows them with lower opacity rather than hiding.
 */
import { TZDate } from '@date-fns/tz'
import type { TraceRow } from './types'

/** NL abbreviated month names indexed 0 (Jan) to 11 (Dec) */
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** Return the number of days in a given calendar month (1-based month) */
function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

export interface MonthBucket {
  /** "YYYY-MM" key for sorting and deduplication */
  monthKey: string
  /** Abbreviated NL month + 2-digit year, e.g. "jun '25" */
  monthLabel: string
  /** Sum of chargedKwh for rows in this Amsterdam-local month (grid-side energy shifted) */
  shiftedKwh: number
  /** true if the month's 1st or last calendar day is absent from the trace */
  isPartial: boolean
}

/**
 * Bucket a TraceRow[] into Amsterdam-local calendar months.
 *
 * @param trace  Per-interval simulation trace rows (not mutated).
 * @param zone   IANA timezone name — always pass 'Europe/Amsterdam' in production.
 * @returns      MonthBucket[] sorted ascending by monthKey.
 *               Never returns an empty array for a non-empty trace.
 */
export function bucketByMonth(trace: TraceRow[], zone: string): MonthBucket[] {
  if (trace.length === 0) return []

  // Intermediate accumulator keyed by "YYYY-MM"
  type MonthAccum = {
    monthKey: string
    year: number
    month0: number // 0-indexed month (getMonth() style)
    shiftedKwh: number
    localDays: Set<number> // local calendar days seen in this bucket
  }

  const buckets = new Map<string, MonthAccum>()

  for (const row of trace) {
    // Pitfall 3: use TZDate to get Amsterdam local year/month — NOT raw Date
    const local = new TZDate(row.timestamp.getTime(), zone)
    const year = local.getFullYear()
    const month0 = local.getMonth() // 0-indexed
    const day = local.getDate()     // 1-indexed local calendar day
    const monthKey = `${year}-${String(month0 + 1).padStart(2, '0')}`

    let accum = buckets.get(monthKey)
    if (!accum) {
      accum = { monthKey, year, month0, shiftedKwh: 0, localDays: new Set() }
      buckets.set(monthKey, accum)
    }
    accum.shiftedKwh += row.chargedKwh
    accum.localDays.add(day)
  }

  // Convert to MonthBucket[], computing isPartial and monthLabel
  const result: MonthBucket[] = []

  for (const accum of buckets.values()) {
    const { year, month0, monthKey, shiftedKwh, localDays } = accum
    const month1 = month0 + 1 // 1-indexed for daysInMonth
    const lastDay = daysInMonth(year, month1)

    // Full only if both day 1 and last day of month are present
    const isPartial = !localDays.has(1) || !localDays.has(lastDay)

    const yearShort = String(year).slice(-2)
    const monthLabel = `${NL_MONTHS[month0]} '${yearShort}`

    result.push({ monthKey, monthLabel, shiftedKwh, isPartial })
  }

  // Sort by monthKey ascending (lexicographic = chronological for YYYY-MM)
  result.sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  return result
}
