/**
 * src/domain/parsers/noop-stub.ts — noop second parser (DATA-03 proof).
 *
 * Proves that adding a new format requires only:
 * 1. Create this file (a CsvParser that registers itself on import).
 * 2. Add a static side-effect import in src/domain/parse.ts.
 * Zero edits to ParserRegistry or any central switch (DATA-03).
 *
 * claim() always returns false so this parser never handles any real file.
 * transform() throws — it should never be called.
 */

import { ParserRegistry } from './registry'
import type { CsvParser } from './registry'
import type { ParseFileResult } from '../types'

const NoopStubParser: CsvParser = {
  name: 'Noop Stub',

  /** Always returns false — this parser never claims any file. */
  claim(_headers: string[]): boolean {
    return false
  },

  /** Should never be called — noop stub never claims a file. */
  transform(_rows: Record<string, string>[], _file: File): ParseFileResult {
    throw new Error('NoopStubParser.transform should never be called')
  },
}

ParserRegistry.register(NoopStubParser)
export {}
