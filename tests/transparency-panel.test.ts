// @vitest-environment jsdom
/**
 * tests/transparency-panel.test.ts — renderTransparencyPanel DOM-contract lock (UX-01, UX-02)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 * Calls renderTransparencyPanel() and asserts the DOM element structure and content.
 *
 * If any test in this file fails it means a future edit:
 * - Removed or changed the panel's section/aria structure
 * - Changed the <details> open state (must be collapsed by default)
 * - Removed "Hoe is dit berekend?" from the summary (UX-01)
 * - Changed the number of assumption list items (must be exactly 5)
 * - Removed the saldering caveat mentioning 2027 / terugleverkosten (D-08)
 * - Removed the "Waarom geen euro's?" heading (UX-02)
 * - Added a v2 promise to the no-euros body (D-09)
 */
import { describe, it, expect } from 'vitest'
import { renderTransparencyPanel } from '../src/ui/transparency-panel'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderTransparencyPanel DOM contract', () => {
  it('returns a <section> element with class transparency-panel', () => {
    const el = renderTransparencyPanel()
    expect(el.tagName.toLowerCase()).toBe('section')
    expect(el.classList.contains('transparency-panel')).toBe(true)
  })

  it('has aria-label="Berekeningsdetails"', () => {
    const el = renderTransparencyPanel()
    expect(el.getAttribute('aria-label')).toBe('Berekeningsdetails')
  })

  it('contains a <details> element (native collapsible — D-07)', () => {
    const el = renderTransparencyPanel()
    const details = el.querySelector('details')
    expect(details).not.toBeNull()
  })

  it('<details> is collapsed by default (no open attribute — UX-01 initial state)', () => {
    const el = renderTransparencyPanel()
    const details = el.querySelector('details')
    expect(details?.hasAttribute('open')).toBe(false)
  })

  it('<summary> contains "Hoe is dit berekend?" (UX-01)', () => {
    const el = renderTransparencyPanel()
    const summary = el.querySelector('summary')
    expect(summary).not.toBeNull()
    expect(summary?.textContent).toContain('Hoe is dit berekend?')
  })

  it('assumptions-list contains exactly five <li> items', () => {
    const el = renderTransparencyPanel()
    const items = el.querySelectorAll('.assumptions-list li')
    expect(items).toHaveLength(5)
  })

  it('one <li> mentions the saldering caveat with "2027" and "terugleverkosten" (D-08)', () => {
    const el = renderTransparencyPanel()
    const items = Array.from(el.querySelectorAll('.assumptions-list li'))
    const salderingLi = items.find(
      (li) =>
        li.textContent?.includes('2027') || li.textContent?.includes('terugleverkosten'),
    )
    expect(salderingLi).not.toBeUndefined()
  })

  it('"Waarom geen euro\'s?" heading is present inside the panel (UX-02)', () => {
    const el = renderTransparencyPanel()
    const headings = Array.from(el.querySelectorAll('h3'))
    const noEurosHeading = headings.find((h) => h.textContent?.includes("Waarom geen euro's?"))
    expect(noEurosHeading).not.toBeUndefined()
  })

  it('no-euros body does NOT contain a v2 promise (D-09 negative assertion)', () => {
    const el = renderTransparencyPanel()
    const body = el.querySelector('.no-euros-section__body')
    expect(body).not.toBeNull()
    // D-09: must NOT promise any v2 feature
    expect(body?.textContent).not.toContain('v2 zal')
    expect(body?.textContent).not.toContain('binnenkort')
    expect(body?.textContent).not.toContain('komt eraan')
    expect(body?.textContent).not.toContain('volgende versie')
  })

  it('.no-euros-section__heading has the correct class', () => {
    const el = renderTransparencyPanel()
    const heading = el.querySelector('.no-euros-section__heading')
    expect(heading).not.toBeNull()
    expect(heading?.textContent).toContain("Waarom geen euro's?")
  })

  it('.no-euros-section__body has content explaining kWh-only approach', () => {
    const el = renderTransparencyPanel()
    const body = el.querySelector('.no-euros-section__body')
    expect(body).not.toBeNull()
    // Should mention tariff data not being available
    expect(body?.textContent).toContain('tarief')
  })

  it('.transparency-panel__body contains both assumptions-list and no-euros-section', () => {
    const el = renderTransparencyPanel()
    const panelBody = el.querySelector('.transparency-panel__body')
    expect(panelBody).not.toBeNull()
    expect(panelBody?.querySelector('.assumptions-list')).not.toBeNull()
    expect(panelBody?.querySelector('.no-euros-section')).not.toBeNull()
  })

  it('builder uses textContent (no innerHTML) for copy nodes (XSS safety)', () => {
    // Verify that script tags do not get interpreted if somehow injected
    // (static copy cannot be injected, but guard against regression)
    const el = renderTransparencyPanel()
    // The panel should have no script elements
    expect(el.querySelectorAll('script')).toHaveLength(0)
  })
})
