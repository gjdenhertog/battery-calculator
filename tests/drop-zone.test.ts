// @vitest-environment jsdom
/**
 * tests/drop-zone.test.ts — initDropZone DOM-contract lock (DATA-01, DATA-13, T-02-10)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 * Calls initDropZone() against a real jsdom DOM seeded with the Phase 1 shell.
 *
 * If any test in this file fails it means a future edit:
 * - Removed the always-visible file input/picker (DATA-01 regression)
 * - Destroyed the p.privacy-promise (PRIV-02 regression)
 * - Removed the aria-label from the drop-zone region (a11y regression)
 * - Broke the dragover state machine (CSS class or aria-dropeffect)
 * - Used inline styles (CSP style-src 'self' violation)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderShell } from '../src/shell'
import { initDropZone } from '../src/ui/drop-zone'

// ---------------------------------------------------------------------------
// DOM setup
// ---------------------------------------------------------------------------

function setupDropZone(): HTMLElement {
  // Full shell setup — mirrors what index.html provides in the browser
  document.body.innerHTML = '<div id="app"></div>'
  const host = document.getElementById('app') as HTMLElement
  renderShell(host)

  const region = document.getElementById('drop-zone-region') as HTMLElement
  initDropZone(region)
  return region
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initDropZone DOM contract', () => {
  let region: HTMLElement

  beforeEach(() => {
    region = setupDropZone()
  })

  // ── DATA-01: always-visible file picker ─────────────────────────────────

  it('adds an input[type=file] to the region (DATA-01 picker always present)', () => {
    const input = region.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
  })

  it('file input has multiple attribute (DATA-01 multi-file)', () => {
    const input = region.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.multiple).toBe(true)
  })

  it('file input accepts .csv and text/csv (DATA-01)', () => {
    const input = region.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.accept).toContain('.csv')
  })

  it('file picker has an associated <label> (a11y — label links to input)', () => {
    const input = region.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.id).not.toBe('')
    const label = region.querySelector(`label[for="${input.id}"]`)
    expect(label).not.toBeNull()
  })

  it('file-picker label has class "file-picker-label"', () => {
    const label = region.querySelector('.file-picker-label')
    expect(label).not.toBeNull()
  })

  it('file-picker label has Dutch text "Of kies bestanden"', () => {
    const label = region.querySelector('.file-picker-label')
    expect(label).not.toBeNull()
    // textContent includes the label text (the input is nested inside)
    expect(label!.textContent).toContain('Of kies bestanden')
  })

  // ── PRIV-02: privacy promise preserved ──────────────────────────────────

  it('p.privacy-promise still exists after initDropZone (PRIV-02 preserved)', () => {
    const privacyP = region.querySelector('p.privacy-promise')
    expect(privacyP).not.toBeNull()
  })

  it('p.privacy-promise retains the verbatim PRIV-02 text after initDropZone', () => {
    const privacyP = region.querySelector('p.privacy-promise')
    expect(privacyP).not.toBeNull()
    expect(privacyP!.textContent).toContain(
      'Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden'
    )
  })

  // ── ARIA contract ────────────────────────────────────────────────────────

  it('#drop-zone-region has aria-label="Bestanden uploaden"', () => {
    expect(region.getAttribute('aria-label')).toBe('Bestanden uploaden')
  })

  it('#drop-zone-region starts in idle state (drop-zone--idle class)', () => {
    expect(region.classList.contains('drop-zone--idle')).toBe(true)
  })

  // ── Drop instruction ─────────────────────────────────────────────────────

  it('renders the Dutch drop instruction text', () => {
    expect(region.textContent).toContain('Sleep een of meer CSV-bestanden hierheen')
  })

  // ── Dragover state machine ───────────────────────────────────────────────
  // Note: jsdom does not implement DragEvent; we dispatch plain Events with the
  // correct type string. The drop-zone controller only reads e.preventDefault(),
  // e.dataTransfer?.dropEffect, and the event type — all compatible with MouseEvent.

  it('adds drop-zone--dragover class on dragover event', () => {
    const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true })
    region.dispatchEvent(dragOverEvent)
    expect(region.classList.contains('drop-zone--dragover')).toBe(true)
  })

  it('sets aria-dropeffect="copy" on dragover', () => {
    const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true })
    region.dispatchEvent(dragOverEvent)
    expect(region.getAttribute('aria-dropeffect')).toBe('copy')
  })

  it('removes drop-zone--dragover class on dragleave (leaving to null)', () => {
    // First trigger dragover
    region.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true }))
    expect(region.classList.contains('drop-zone--dragover')).toBe(true)

    // Then trigger dragleave with relatedTarget outside the region (null = leaving the document)
    region.dispatchEvent(
      new MouseEvent('dragleave', { bubbles: true, cancelable: true, relatedTarget: null })
    )
    expect(region.classList.contains('drop-zone--dragover')).toBe(false)
    expect(region.classList.contains('drop-zone--idle')).toBe(true)
  })

  it('removes aria-dropeffect on dragleave', () => {
    region.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true }))
    region.dispatchEvent(
      new MouseEvent('dragleave', { bubbles: true, cancelable: true, relatedTarget: null })
    )
    expect(region.hasAttribute('aria-dropeffect')).toBe(false)
  })

  // ── No inline styles ─────────────────────────────────────────────────────

  it('does not set inline style on the region element', () => {
    // After init and state changes, no style attribute should be set
    expect(region.getAttribute('style')).toBeNull()
  })
})
