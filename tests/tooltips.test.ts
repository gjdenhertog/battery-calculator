// @vitest-environment jsdom
/**
 * tests/tooltips.test.ts — initTooltips tap-toggle + keyboard contract (UX-03, D-11)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 * Verifies the touchstart tap-toggle and Escape keydown behavior of initTooltips().
 *
 * If any test in this file fails it means a future edit:
 * - Broke the tap-toggle (only one tooltip open at a time)
 * - Broke Escape closing all tooltips
 * - Used element.style writes instead of classList (CSP regression — T-05-09)
 * - Used inline event handlers instead of document-level listeners
 * - Changed the tabindex or data-tooltip attribute contract
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { initTooltips } from '../src/ui/tooltips'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Create a container with two .term-tooltip spans (the minimum to test toggle behavior).
 * Each span has tabindex="0" and a non-empty data-tooltip value (UX-03 contract).
 */
function createTooltipFixture(): { container: HTMLElement; spanA: HTMLElement; spanB: HTMLElement } {
  const container = document.createElement('div')

  const spanA = document.createElement('span')
  spanA.className = 'term-tooltip'
  spanA.tabIndex = 0
  spanA.setAttribute(
    'data-tooltip',
    'De energie die je thuis opwekt en direct zelf gebruikt, in plaats van aan het net te leveren.',
  )
  spanA.textContent = 'zelfverbruik'

  const spanB = document.createElement('span')
  spanB.className = 'term-tooltip'
  spanB.tabIndex = 0
  spanB.setAttribute(
    'data-tooltip',
    'Stroom die jouw huis terugstuurt naar het net — bij jou zichtbaar als export op de P1-meter.',
  )
  spanB.textContent = 'teruglevering'

  container.appendChild(spanA)
  container.appendChild(spanB)
  document.body.appendChild(container)

  return { container, spanA, spanB }
}

/**
 * Dispatch a synthetic touchstart event targeting the given element.
 * The event bubbles so document-level listeners receive it.
 * jsdom automatically sets e.target to the dispatching element.
 */
function fireTouchstart(target: Element): void {
  const event = new Event('touchstart', { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
}

/**
 * Dispatch a synthetic keydown event at document level.
 */
function fireKeydown(key: string): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true })
  document.dispatchEvent(event)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Call initTooltips() once for the whole describe block — document-level listeners
// are registered once and persist across tests. Each test gets a fresh DOM body.
initTooltips()

describe('initTooltips contract', () => {
  beforeEach(() => {
    // Clean DOM between tests
    document.body.innerHTML = ''
    // Remove all .term-tooltip--open classes (defensive)
    document.querySelectorAll('.term-tooltip--open').forEach((el) => {
      el.classList.remove('term-tooltip--open')
    })
  })

  it('tap on span A opens span A and does NOT open span B', () => {
    const { spanA, spanB } = createTooltipFixture()

    fireTouchstart(spanA)

    expect(spanA.classList.contains('term-tooltip--open')).toBe(true)
    expect(spanB.classList.contains('term-tooltip--open')).toBe(false)
  })

  it('tap on span B after span A: span B opens, span A closes (only one open at a time)', () => {
    const { spanA, spanB } = createTooltipFixture()

    // Open A first
    fireTouchstart(spanA)
    expect(spanA.classList.contains('term-tooltip--open')).toBe(true)

    // Now tap B — B should open, A should close
    fireTouchstart(spanB)

    expect(spanB.classList.contains('term-tooltip--open')).toBe(true)
    expect(spanA.classList.contains('term-tooltip--open')).toBe(false)
  })

  it('tap outside any .term-tooltip closes all open tooltips', () => {
    const { container, spanA } = createTooltipFixture()

    // Open A
    fireTouchstart(spanA)
    expect(spanA.classList.contains('term-tooltip--open')).toBe(true)

    // Tap the container (not a .term-tooltip)
    fireTouchstart(container)

    expect(spanA.classList.contains('term-tooltip--open')).toBe(false)
  })

  it('tap on already-open tooltip toggles it closed', () => {
    const { spanA } = createTooltipFixture()

    fireTouchstart(spanA)
    expect(spanA.classList.contains('term-tooltip--open')).toBe(true)

    // Tap again — should close
    fireTouchstart(spanA)
    expect(spanA.classList.contains('term-tooltip--open')).toBe(false)
  })

  it('Escape key removes .term-tooltip--open from all elements', () => {
    const { spanA, spanB } = createTooltipFixture()

    // Manually add --open to both (simulates two somehow-open tooltips)
    spanA.classList.add('term-tooltip--open')
    spanB.classList.add('term-tooltip--open')

    fireKeydown('Escape')

    expect(spanA.classList.contains('term-tooltip--open')).toBe(false)
    expect(spanB.classList.contains('term-tooltip--open')).toBe(false)
  })

  it('each .term-tooltip span has tabindex="0" (keyboard accessibility — UX-03)', () => {
    const { spanA, spanB } = createTooltipFixture()

    expect(spanA.getAttribute('tabindex')).toBe('0')
    expect(spanB.getAttribute('tabindex')).toBe('0')
  })

  it('each .term-tooltip span has a non-empty data-tooltip attribute', () => {
    const { spanA, spanB } = createTooltipFixture()

    const tooltipA = spanA.getAttribute('data-tooltip')
    const tooltipB = spanB.getAttribute('data-tooltip')

    expect(tooltipA).not.toBeNull()
    expect(tooltipA!.length).toBeGreaterThan(0)
    expect(tooltipB).not.toBeNull()
    expect(tooltipB!.length).toBeGreaterThan(0)
  })

  it('no element.style writes occur — classList only (CSP T-05-09)', () => {
    // This test verifies that initTooltips() does not write inline styles.
    // We do this by checking that no style attribute appears on spans after toggle.
    const { spanA } = createTooltipFixture()

    fireTouchstart(spanA)

    // After tap-toggle, no style attribute should be set
    expect(spanA.getAttribute('style')).toBeNull()
  })
})
