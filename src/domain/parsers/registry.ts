/**
 * src/domain/parsers/registry.ts — parser registry singleton (DATA-02, DATA-03).
 *
 * Parsers register themselves by calling ParserRegistry.register() as a
 * side-effect of being imported. The registry never needs to enumerate
 * known parsers — each parser file registers itself.
 *
 * Adding a new format requires only:
 * 1. Create a new parser file that calls ParserRegistry.register() on import.
 * 2. Add a static side-effect import in src/domain/parse.ts.
 * Zero edits to this file or any central switch (DATA-03).
 */

import type { ParseFileResult } from '../types'

// ---------------------------------------------------------------------------
// CsvParser interface
// ---------------------------------------------------------------------------

/**
 * Contract that every CSV parser adapter must implement.
 *
 * A parser registers itself with ParserRegistry.register() as a module
 * side-effect, then the registry dispatches to it via claim() sniffing.
 */
export interface CsvParser {
  /** Human-readable parser name (used in error messages and readout) */
  name: string

  /**
   * Returns true if this parser can handle a CSV with the given header row.
   *
   * Called with the parsed header column names. The first parser that returns
   * true is selected; order is registration order.
   */
  claim(headers: string[]): boolean

  /**
   * Transform raw PapaParse rows into a ParseFileResult.
   *
   * @param rows - Array of row objects keyed by column name (from PapaParse header:true).
   * @param file - The original File object (used for file.name in error messages).
   */
  transform(rows: Record<string, string>[], file: File): ParseFileResult
}

// ---------------------------------------------------------------------------
// Registry singleton
// ---------------------------------------------------------------------------

/** Internal list of registered parsers, in registration order. */
const registry: CsvParser[] = []

/**
 * Singleton registry for CSV parser adapters.
 *
 * Parsers register via side-effect imports in src/domain/parse.ts.
 * claim() returns the first matching parser or null.
 */
export const ParserRegistry = {
  /**
   * Register a parser adapter.
   *
   * Called once per adapter as a module-load side effect.
   * Parsers are stored in registration order; claim() returns the first match.
   */
  register(parser: CsvParser): void {
    registry.push(parser)
  },

  /**
   * Find the first registered parser that claims the given headers.
   *
   * @param headers - Column names from the CSV header row.
   * @returns The first matching CsvParser, or null if none match.
   */
  claim(headers: string[]): CsvParser | null {
    return registry.find((p) => p.claim(headers)) ?? null
  },
}
