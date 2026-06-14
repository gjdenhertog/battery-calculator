/**
 * tests/terminology-audit.test.ts — UX-05 + UX-06 CI grep contract lock
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * If any test in this file fails it means a banned term or banned UI pattern
 * has been introduced into src/ — the build must be blocked.
 *
 * Pattern derived from tests/csp-plugin.test.ts (Phase 1 contract lock style).
 *
 * Scope: scans src/ only (not tests/), so the banned literals living in this
 * test file under tests/ are safe and will NOT self-invalidate.
 *
 * Allowed identifiers (must NOT be in banned lists):
 * - "solar surplus" — allowed as internal code/identifier (UX-05)
 * - "residualExportKwh" — code field name in type system, not displayed
 * - "teruglevering" — canonical user-facing term for solar surplus
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Recursively collect all .ts and .html files under a directory.
 */
function allSrcFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  return entries.flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return allSrcFiles(full)
    if (full.endsWith('.ts') || full.endsWith('.html')) return [full]
    return []
  })
}

/**
 * Scan all src/ files for any of the given banned terms.
 * Returns an array of `"<file>: \"<term>\""` strings for every hit found.
 * An empty array means no violations.
 */
function findBanned(terms: string[]): string[] {
  const srcDir = join(import.meta.dirname, '..', 'src')
  const hits: string[] = []
  for (const file of allSrcFiles(srcDir)) {
    const content = readFileSync(file, 'utf-8')
    for (const term of terms) {
      if (content.includes(term)) {
        hits.push(`${file}: "${term}"`)
      }
    }
  }
  return hits
}

describe('UX-05 terminology audit', () => {
  it('src/ contains zero occurrences of banned solar-production terms', () => {
    // Banned: misleading English / Dutch solar-production terminology.
    // "solar surplus" and "residualExportKwh" are NOT in this list — they are
    // canonical allowed identifiers (internal code use, not UI-facing labels).
    const banned = [
      'solar production',
      'solar generation',
      'zonne-opwekking',
      'zonne-opbrengst',
    ]
    const hits = findBanned(banned)
    expect(hits, `Banned terminology found in src/:\n${hits.join('\n')}`).toHaveLength(0)
  })
})

describe('UX-06 no-CTA audit', () => {
  it('src/ contains no email fields, contact forms, or offerte patterns', () => {
    // Banned: email/contact/lead-capture CTA markers that must never appear in src/.
    // This guards against accidental introduction of lead-capture forms.
    const banned = ['type="email"', 'type="tel"', 'offerte']
    const hits = findBanned(banned)
    expect(hits, `Banned CTA pattern found in src/:\n${hits.join('\n')}`).toHaveLength(0)
  })
})
