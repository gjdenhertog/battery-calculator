/**
 * src/domain/select-representative-week.ts — highest-teruglevering week heuristic (VIZ-02)
 *
 * Pure function — no browser globals, safe to run in a Node environment.
 *
 * Selects the Mon–Sun week (Amsterdam local time) with the highest total
 * residualExportKwh (teruglevering). Tie-break: earliest week wins.
 *
 * Edge case: if the dataset spans fewer than 7 days, returns the only available
 * span — never returns null (Assumption A1).
 *
 * @see RESEARCH.md §"Highest-Teruglevering Week Heuristic"
 */
import { TZDate } from '@date-fns/tz'
import { startOfWeek } from 'date-fns'
import type { TraceRow } from './types'

/** NL abbreviated month names indexed 0 (Jan) to 11 (Dec) */
const NL_MONTHS_FULL = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

export interface RepresentativeWeek {
  /** Unix ms — Monday 00:00 Amsterdam (or earliest available row's week start) */
  startTs: number
  /** Unix ms — Sunday end Amsterdam (end of the 7-day span) */
  endTs: number
  /** Dutch dated caption e.g. "8–14 juni 2025" */
  weekLabel: string
}

/**
 * Select the Mon–Sun week in the trace with the highest sum of residualExportKwh.
 *
 * @param trace  Per-interval simulation trace rows (not mutated).
 * @param zone   IANA timezone name — always pass 'Europe/Amsterdam' in production.
 * @returns      RepresentativeWeek — never null; returns single span for <7-day datasets.
 */
export function selectRepresentativeWeek(trace: TraceRow[], zone: string): RepresentativeWeek {
  if (trace.length === 0) {
    // Empty trace: return epoch-based placeholder (callers should never reach this)
    return { startTs: 0, endTs: 0, weekLabel: '' }
  }

  // Accumulate residualExportKwh per Amsterdam-local Mon–Sun week
  // Key: Monday's UTC ms (as returned by startOfWeek on TZDate)
  type WeekAccum = {
    weekStartMs: number    // Monday 00:00 Amsterdam in UTC ms
    exportSum: number      // total residualExportKwh for this week
  }

  const weekMap = new Map<number, WeekAccum>()

  for (const row of trace) {
    // Wrap in TZDate to get Amsterdam local time for startOfWeek
    const local = new TZDate(row.timestamp.getTime(), zone)
    // startOfWeek in Amsterdam local time (weekStartsOn: 1 = Monday)
    const weekStart = startOfWeek(local, { weekStartsOn: 1 })
    const weekStartMs = weekStart.getTime()

    let accum = weekMap.get(weekStartMs)
    if (!accum) {
      accum = { weekStartMs, exportSum: 0 }
      weekMap.set(weekStartMs, accum)
    }
    accum.exportSum += row.residualExportKwh
  }

  // Find the week with the highest exportSum; tie-break = earliest week (smallest weekStartMs)
  let bestWeek: WeekAccum | null = null
  for (const accum of weekMap.values()) {
    if (
      bestWeek === null ||
      accum.exportSum > bestWeek.exportSum ||
      (accum.exportSum === bestWeek.exportSum && accum.weekStartMs < bestWeek.weekStartMs)
    ) {
      bestWeek = accum
    }
  }

  // bestWeek is always non-null because trace.length > 0
  const { weekStartMs } = bestWeek!

  // Compute end of the week: Sunday 23:59:59.999 = Monday + 7 days - 1 ms
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000 - 1

  // Build Amsterdam-local start and end for the label
  const startLocal = new TZDate(weekStartMs, zone)
  const endLocal = new TZDate(weekEndMs, zone)

  const startDay = startLocal.getDate()
  const endDay = endLocal.getDate()
  // Use the end date's month for the label (handles week spanning month boundary)
  const month = endLocal.getMonth() // 0-indexed
  const year = endLocal.getFullYear()

  const weekLabel = `${startDay}–${endDay} ${NL_MONTHS_FULL[month]} ${year}`

  return {
    startTs: weekStartMs,
    endTs: weekEndMs,
    weekLabel,
  }
}
