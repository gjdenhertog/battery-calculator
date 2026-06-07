// @vitest-environment jsdom
/**
 * tests/shell.test.ts — Shell DOM-contract lock (D-08, PRIV-02, D-01)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock — D-09).
 * Calls renderShell() against a real jsdom DOM — does NOT hand-author the shell HTML.
 *
 * If any test in this file fails it means a future edit:
 * - Removed a required shell region
 * - Changed the app title
 * - Altered the verbatim privacy promise (U+2014 em dash required)
 * - Added text to the results region (D-02: must stay bare)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderShell } from '../src/shell'

describe('Shell DOM contract', () => {
  let host: HTMLElement

  beforeEach(() => {
    // Reset DOM between tests
    document.body.innerHTML = '<div id="app"></div>'
    host = document.getElementById('app') as HTMLElement
    renderShell(host)
  })

  it('renders header[role="banner"]', () => {
    const header = document.querySelector('header[role="banner"]')
    expect(header).not.toBeNull()
  })

  it('renders #drop-zone-region', () => {
    const dropZone = document.querySelector('#drop-zone-region')
    expect(dropZone).not.toBeNull()
  })

  it('renders #results-region', () => {
    const results = document.querySelector('#results-region')
    expect(results).not.toBeNull()
  })

  it('h1 textContent is exactly "Thuisbatterij Calculator"', () => {
    const h1 = document.querySelector('header[role="banner"] h1')
    expect(h1).not.toBeNull()
    expect(h1!.textContent).toBe('Thuisbatterij Calculator')
  })

  it('#drop-zone-region contains the verbatim privacy promise (U+2014 em dash)', () => {
    const dropZone = document.querySelector('#drop-zone-region')
    expect(dropZone).not.toBeNull()
    expect(dropZone!.textContent).toContain(
      'Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden'
    )
  })

  it('#results-region has aria-label "Vergelijkingsresultaten"', () => {
    const results = document.querySelector('#results-region')
    expect(results).not.toBeNull()
    expect(results!.getAttribute('aria-label')).toBe('Vergelijkingsresultaten')
  })

  it('#results-region is bare — does NOT contain the privacy promise (D-02)', () => {
    const results = document.querySelector('#results-region')
    expect(results).not.toBeNull()
    expect(results!.textContent?.trim()).not.toContain('Je data blijft op je eigen apparaat')
  })
})
