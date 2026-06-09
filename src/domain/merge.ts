/**
 * src/domain/merge.ts — finer-wins multi-file merge with per-file stats (DATA-10, DATA-11)
 *
 * Pure function — no browser globals, safe to run in a Node environment.
 *
 * Algorithm (DATA-10 / RESEARCH.md §Pattern 5):
 *  1. Sort input files by cadenceMinutes ascending (finest resolution first).
 *  2. Insert samples into a Map<utcMs, IntervalSample> — skip any key that
 *     already exists (the finest file's value always wins).
 *  3. Track per-file rowsContributed and rowsOverridden counts (D-08).
 *  4. Sort the merged samples ascending by timestamp.
 *  5. Infer dominant cadence from the merged series (median inter-sample delta).
 *  6. Call detectGaps(mergedSamples, dominantCadence) to populate gapCount/gapRanges.
 *  7. Build fileStats carrying each file's DATA-05 fields.
 */
import type { ParseFileResult, MergeResult, FileStat, IntervalSample } from './types'
import { detectGaps } from './gaps'

/**
 * Merge one or more ParseFileResults into a unified, sorted IntervalSample[].
 *
 * On timestamp conflicts the finest-cadence (smallest cadenceMinutes) file wins.
 * Per-file statistics track which samples contributed to and which were overridden
 * in the merged output (D-08). Gap detection is DST-aware (D-04).
 *
 * @param results  One or more parse results. Must not be empty.
 * @returns        MergeResult with merged samples, gap report, and per-file stats.
 */
export function mergeFiles(results: ParseFileResult[]): MergeResult {
  // Sort finest cadence first (smallest cadenceMinutes = finest resolution)
  const sorted = [...results].sort((a, b) => a.cadenceMinutes - b.cadenceMinutes)

  // Map from UTC ms → IntervalSample (first inserted value wins = finest file wins)
  const merged = new Map<number, IntervalSample>()

  // Track per-file contribution counts
  const contributed = new Map<string, number>()
  const overridden = new Map<string, number>()

  for (const result of sorted) {
    contributed.set(result.fileName, 0)
    overridden.set(result.fileName, 0)
  }

  for (const result of sorted) {
    for (const s of result.samples) {
      const key = s.timestamp.getTime()
      if (!merged.has(key)) {
        merged.set(key, s)
        contributed.set(result.fileName, (contributed.get(result.fileName) ?? 0) + 1)
      } else {
        // A finer file already owns this slot — this file's sample is overridden
        overridden.set(result.fileName, (overridden.get(result.fileName) ?? 0) + 1)
      }
    }
  }

  // Sort merged samples ascending by timestamp
  const mergedSamples = [...merged.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  )

  // Infer dominant cadence from the merged series (median inter-sample delta in minutes)
  const dominantCadence = inferDominantCadence(mergedSamples, sorted)

  // DST-aware gap detection over the merged series
  const gapReport = detectGaps(mergedSamples, dominantCadence)

  // Build per-file stats carrying DATA-05 fields
  const fileStats: FileStat[] = sorted.map((result) => ({
    fileName: result.fileName,
    encoding: result.encoding,
    seriesType: result.seriesType,
    cadenceMinutes: result.cadenceMinutes,
    rowCount: result.rowCount,
    rowsContributed: contributed.get(result.fileName) ?? 0,
    rowsOverridden: overridden.get(result.fileName) ?? 0,
    isMonotonic: result.isMonotonic,
    monotonicity_failRow: result.monotonicity_failRow,
    firstIntervalAnomalyFlag: result.firstIntervalAnomalyFlag,
    softWarnings: result.softWarnings ?? [],
  }))

  return {
    samples: mergedSamples,
    gapCount: gapReport.count,
    gapRanges: gapReport.ranges,
    fileStats,
  }
}

/**
 * Infer the dominant cadence for gap detection over the merged series.
 *
 * Prefers the finest input file's cadenceMinutes. Falls back to computing the
 * median inter-sample delta from the merged series (handles edge cases like a
 * single-file input or a series with very few samples).
 */
function inferDominantCadence(
  mergedSamples: IntervalSample[],
  sortedResults: ParseFileResult[],
): number {
  // Use the finest file's declared cadence if available (most reliable)
  if (sortedResults.length > 0) {
    return sortedResults[0].cadenceMinutes
  }

  // Fall back to median inter-sample delta
  if (mergedSamples.length < 2) return 15
  const diffs = mergedSamples
    .slice(1)
    .map((s, i) => (s.timestamp.getTime() - mergedSamples[i].timestamp.getTime()) / 60_000)
  diffs.sort((a, b) => a - b)
  return diffs[Math.floor(diffs.length / 2)]
}
