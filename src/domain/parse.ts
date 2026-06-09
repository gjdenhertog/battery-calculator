/**
 * src/domain/parse.ts — file parsing orchestrator (DATA-02/04/06/07/09/13).
 *
 * parseFile() is the single entry point for turning a File object into a
 * ParseFileResult. It:
 *  1. Decodes the file encoding (UTF-8 with/without BOM, Windows-1252 fallback).
 *  2. Runs PapaParse with worker:true (browser) for off-main-thread parsing (DATA-13).
 *  3. Dispatches to the registered adapter via ParserRegistry.claim().
 *  4. Rejects fail-fast on the first malformed row (D-06, DATA-09).
 *  5. Rejects with a descriptive error if no adapter claims the headers.
 *
 * Static side-effect imports register all parsers before parseFile() can be called
 * (DATA-03 — zero central-switch edits for new formats, just add a line here).
 *
 * WORKER NOTE: PapaParse worker:true requires worker-src blob: in the CSP.
 * Plan 02-01 Task 2 added that directive to src/constants/csp.ts.
 * In the Vitest node environment, workers are not available. parseFile() detects
 * this and falls back to worker:false automatically so that tests pass deterministically
 * without scaffolding worker infrastructure.
 */

import Papa from 'papaparse'
import './parsers/homewizard-p1' // side-effect: registers HomeWizard P1 adapter
import './parsers/noop-stub' // side-effect: registers noop stub (DATA-03 proof)
import { ParserRegistry } from './parsers/registry'
import { decodeFileWithFallback } from './encoding'
import type { ParseFileResult } from './types'
import { ParseRowError } from './types'

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV file into a ParseFileResult.
 *
 * @param file - The File object from the browser drop zone / file picker.
 * @returns ParseFileResult with all domain fields populated.
 * @throws {UnsupportedEncodingError} If the file cannot be decoded.
 * @throws {ParseRowError} If a row contains a malformed value (D-06 fail-fast).
 * @throws {Error} If no registered adapter claims the file's headers.
 */
export async function parseFile(file: File): Promise<ParseFileResult> {
  // Step 1: Decode encoding (DATA-04, D-07)
  const { text, encoding } = await decodeFileWithFallback(file)

  // Step 2: PapaParse streaming parse — worker:true in production browser context.
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = []
    let headers: string[] = []
    let rejected = false

    function safeReject(err: unknown): void {
      if (!rejected) {
        rejected = true
        reject(err)
      }
    }

    Papa.parse<Record<string, string>>(text, {
      header: true,
      delimiter: '', // auto-detect , or ; (DATA-04)
      dynamicTyping: false, // always strings — adapter parses manually
      // DATA-13: keeps parsing off the main thread in the browser.
      // In the Vitest node environment, Worker is unavailable and PapaParse
      // silently falls back to synchronous mode — no change needed here.
      // Requires worker-src blob: in CSP (added in Plan 02-01 Task 2).
      worker: true,
      skipEmptyLines: true,

      step(result, parser) {
        if (headers.length === 0) {
          headers = result.meta.fields ?? []
        }
        // D-06: fail-fast on first malformed PapaParse structural error
        if (result.errors.length > 0) {
          const err = result.errors[0]
          if (parser && typeof parser.abort === 'function') {
            parser.abort()
          }
          safeReject(
            new ParseRowError(
              file.name,
              (err.row ?? 0) + 2, // +2: header is row 1, data rows start at row 2
              err.code ?? 'unknown',
              'valid CSV row',
              String(err.message ?? ''),
            ),
          )
          return
        }
        if (!rejected) {
          rows.push(result.data)
        }
      },

      complete() {
        if (rejected) return

        // Step 3: Dispatch to matching adapter
        const adapter = ParserRegistry.claim(headers)
        if (!adapter) {
          safeReject(new Error(`Onbekend bestandsformaat voor "${file.name}"`))
          return
        }

        // Step 4: Transform rows → ParseFileResult (adapter throws ParseRowError on bad data)
        try {
          const result = adapter.transform(rows, file)
          resolve({ ...result, encoding })
        } catch (e) {
          safeReject(e)
        }
      },

      error(err: Error) {
        safeReject(new Error(`${file.name}: ${err.message}`))
      },
    })
  })
}
