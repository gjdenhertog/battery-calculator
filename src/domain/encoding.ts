/**
 * src/domain/encoding.ts — file encoding detection with UTF-8 → Windows-1252 fallback.
 *
 * DATA-04: Handles UTF-8 (with/without BOM) and Windows-1252 (common in NL provider exports).
 * D-07: UTF-8 is tried first. If it fails, Windows-1252 is tried. If neither works,
 *       UnsupportedEncodingError is thrown naming the file.
 *
 * All decoding is done via the browser-native TextDecoder API (available in Node 22 LTS
 * via the built-in `util` module shim, backed by full ICU). No extra bundle weight.
 */

import { UnsupportedEncodingError } from './types'

/**
 * Decode a File to a string, auto-detecting encoding.
 *
 * Detection order (D-07):
 *  1. UTF-8 with `fatal: true` — invalid bytes throw, BOM is stripped automatically.
 *  2. Windows-1252 — fallback for NL provider exports that use legacy encoding.
 *  3. UnsupportedEncodingError — if neither succeeds.
 *
 * @param file - The File object to decode (provided by the browser File API).
 * @returns The decoded text and the encoding used.
 * @throws {UnsupportedEncodingError} When neither UTF-8 nor Windows-1252 can decode the file.
 */
export async function decodeFileWithFallback(
  file: File,
): Promise<{ text: string; encoding: 'UTF-8' | 'Windows-1252' }> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Attempt UTF-8 with fatal mode — invalid byte sequences throw a TypeError.
  // TextDecoder with ignoreBOM: false (default) strips the UTF-8 BOM (EF BB BF)
  // automatically, so the decoded string will NOT start with U+FEFF.
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text, encoding: 'UTF-8' }
  } catch {
    // UTF-8 failed: fall through to Windows-1252
  }

  // Attempt Windows-1252 — a superset of latin1, common in Dutch energy provider exports.
  // TextDecoder('windows-1252') may not be available in Node.js builds without full ICU.
  // Node 22 LTS ships with full ICU by default (verified per RESEARCH.md §Pitfall 7).
  try {
    const text = new TextDecoder('windows-1252').decode(bytes)
    return { text, encoding: 'Windows-1252' }
  } catch {
    // Windows-1252 also failed — throw UnsupportedEncodingError
  }

  throw new UnsupportedEncodingError(file.name)
}
