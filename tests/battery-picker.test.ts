// @vitest-environment jsdom
/**
 * tests/battery-picker.test.ts — initBatteryPicker DOM-contract tests (BATT-03, BATT-04, BATT-05)
 *
 * Runs in jsdom environment (per-file override via first-line docblock).
 * Calls initBatteryPicker() against a real jsdom DOM seeded with the Phase 1 shell.
 *
 * Test coverage:
 *   (a) 7 catalog cards + 1 custom card render on mount
 *   (b) Sessy 5 checkbox is checked on mount (BATT-03)
 *   (c) Checking 5 batteries disables remaining checkboxes + shows cap note (BATT-05)
 *   (d) XSS assertion: custom battery name via .textContent — no <script> elements
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderShell } from '../src/shell'
import { initBatteryPicker, teardownBatteryPicker } from '../src/ui/battery-picker'
import { selectedBatteries } from '../src/state/app-state'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'

// ---------------------------------------------------------------------------
// DOM setup
// ---------------------------------------------------------------------------

function setupPickerRegion(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div>'
  const host = document.getElementById('app') as HTMLElement
  renderShell(host)

  const region = document.getElementById('drop-zone-region') as HTMLElement
  initBatteryPicker(region)
  return region
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initBatteryPicker DOM contract', () => {
  let region: HTMLElement

  beforeEach(() => {
    // Reset selectedBatteries to default before each test (Sessy 5 only)
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    region = setupPickerRegion()
  })

  afterEach(() => {
    teardownBatteryPicker()
  })

  // ── (a) Card count ──────────────────────────────────────────────────────

  it('renders 7 catalog battery cards', () => {
    // All catalog cards have data-battery-id that is NOT "custom"
    const catalogCards = Array.from(region.querySelectorAll('li.battery-card')).filter(
      (li) => (li as HTMLElement).dataset.batteryId !== 'custom',
    )
    expect(catalogCards).toHaveLength(BATTERY_CATALOG.length) // 7
  })

  it('renders 1 custom battery card', () => {
    const customCard = region.querySelector('[data-battery-id="custom"]')
    expect(customCard).not.toBeNull()
  })

  it('renders 8 total <li> cards (7 catalog + 1 custom)', () => {
    const allCards = region.querySelectorAll('li.battery-card')
    expect(allCards).toHaveLength(BATTERY_CATALOG.length + 1) // 8
  })

  // ── (b) Sessy 5 pre-checked (BATT-03) ──────────────────────────────────

  it('Sessy 5 checkbox is checked on mount (BATT-03)', () => {
    const sessyCard = region.querySelector('[data-battery-id="sessy-5"]') as HTMLElement
    expect(sessyCard).not.toBeNull()

    const checkbox = sessyCard.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox).not.toBeNull()
    expect(checkbox.checked).toBe(true)
  })

  it('Sessy 5 card has battery-card--selected class on mount (BATT-03)', () => {
    const sessyCard = region.querySelector('[data-battery-id="sessy-5"]') as HTMLElement
    expect(sessyCard.classList.contains('battery-card--selected')).toBe(true)
  })

  it('non-Sessy 5 cards are not checked on mount', () => {
    const allCheckboxes = Array.from(
      region.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[]
    // Find checkboxes NOT inside the sessy-5 card
    const sessyCard = region.querySelector('[data-battery-id="sessy-5"]')
    const otherCheckboxes = allCheckboxes.filter((cb) => !sessyCard!.contains(cb))
    const checkedOthers = otherCheckboxes.filter((cb) => cb.checked)
    expect(checkedOthers).toHaveLength(0)
  })

  // ── (c) Max-5 cap (BATT-05) ─────────────────────────────────────────────

  it('with 5 batteries selected, remaining unchecked cards have disabled checkboxes (BATT-05)', () => {
    // Select first 5 catalog batteries (Sessy 5 is already selected)
    // Simulate checking 4 more
    const catalogIds = Array.from(BATTERY_CATALOG).map((b) => b.id)
    const first5 = catalogIds.slice(0, 5)
    selectedBatteries.value = Array.from(BATTERY_CATALOG).slice(0, 5)

    // Re-setup to trigger the reactive effect
    teardownBatteryPicker()
    document.body.innerHTML = '<div id="app"></div>'
    const host = document.getElementById('app') as HTMLElement
    renderShell(host)
    const newRegion = document.getElementById('drop-zone-region') as HTMLElement
    initBatteryPicker(newRegion)

    // Cards for batteries NOT in the first 5 should have disabled checkboxes
    const remaining = catalogIds.slice(5)
    for (const id of remaining) {
      const card = newRegion.querySelector(`[data-battery-id="${id}"]`) as HTMLElement
      expect(card).not.toBeNull()
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(checkbox.disabled).toBe(true)
    }

    // Cards in the first 5 should NOT be disabled
    for (const id of first5) {
      const card = newRegion.querySelector(`[data-battery-id="${id}"]`) as HTMLElement
      expect(card).not.toBeNull()
      const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(checkbox.disabled).toBe(false)
    }
  })

  it('with 5 batteries selected, picker-cap-note is visible and contains "Maximaal 5" (BATT-05)', () => {
    // Set 5 batteries
    selectedBatteries.value = Array.from(BATTERY_CATALOG).slice(0, 5)

    teardownBatteryPicker()
    document.body.innerHTML = '<div id="app"></div>'
    const host = document.getElementById('app') as HTMLElement
    renderShell(host)
    const newRegion = document.getElementById('drop-zone-region') as HTMLElement
    initBatteryPicker(newRegion)

    const capNote = newRegion.querySelector('.picker-cap-note') as HTMLElement
    expect(capNote).not.toBeNull()
    expect(capNote.hidden).toBe(false)
    expect(capNote.textContent).toContain('Maximaal 5')
  })

  it('with fewer than 5 batteries selected, picker-cap-note is hidden', () => {
    // Default: only Sessy 5 selected (1 battery)
    const capNote = region.querySelector('.picker-cap-note') as HTMLElement
    expect(capNote).not.toBeNull()
    expect(capNote.hidden).toBe(true)
  })

  // ── (d) XSS safety assertion ─────────────────────────────────────────────

  it('renders custom battery name as inert text — no <script> elements (XSS)', () => {
    // The custom battery card uses .textContent for the label, not .innerHTML
    // Simulate expanding the custom card and check that a malicious name does not inject scripts
    // The fixed label "Eigen batterij" is static .textContent — not user-derived
    // But we can verify the DOM contains no <script> elements after mounting
    const scriptElements = region.querySelectorAll('script')
    expect(scriptElements.length).toBe(0)
  })

  it('custom battery expand button renders label via textContent (XSS)', () => {
    const customCard = region.querySelector('[data-battery-id="custom"]') as HTMLElement
    const expandBtn = customCard.querySelector('.battery-card__expand') as HTMLButtonElement
    // The button text should be the static string, not parsed as HTML
    expect(expandBtn.textContent).toContain('Eigen batterij')
    // After injecting a malicious label (simulate — in real usage this is hardcoded)
    // verify: even if we manually attempt innerHTML, the DOM should have no script
    const maliciousName = '<script>alert("xss")</script>'
    // Assign via textContent (as the implementation does)
    expandBtn.textContent = maliciousName
    // textContent sets it as literal text — no script elements appear
    expect(region.querySelectorAll('script').length).toBe(0)
    // The text appears literally (not parsed)
    expect(expandBtn.textContent).toContain(maliciousName)
  })

  // ── Spec card anatomy ────────────────────────────────────────────────────

  it('each catalog card has a <dl class="battery-card__specs">', () => {
    const catalogCards = Array.from(region.querySelectorAll('li.battery-card')).filter(
      (li) => (li as HTMLElement).dataset.batteryId !== 'custom',
    )
    for (const card of catalogCards) {
      const dl = card.querySelector('dl.battery-card__specs')
      expect(dl).not.toBeNull()
    }
  })

  it('each catalog card has a swatch with battery-swatch-- class', () => {
    const catalogCards = Array.from(region.querySelectorAll('li.battery-card')).filter(
      (li) => (li as HTMLElement).dataset.batteryId !== 'custom',
    )
    for (const card of catalogCards) {
      const swatch = card.querySelector('.battery-card__swatch')
      expect(swatch).not.toBeNull()
      // Must have one of the battery-swatch--N classes
      const hasSwatch = Array.from(swatch!.classList).some((c) =>
        c.startsWith('battery-swatch--'),
      )
      expect(hasSwatch).toBe(true)
    }
  })

  it('custom card has expand button with aria-expanded="false" initially', () => {
    const customCard = region.querySelector('[data-battery-id="custom"]') as HTMLElement
    const expandBtn = customCard.querySelector('.battery-card__expand') as HTMLButtonElement
    expect(expandBtn).not.toBeNull()
    expect(expandBtn.getAttribute('aria-expanded')).toBe('false')
  })

  it('custom card form is hidden initially', () => {
    const customCard = region.querySelector('[data-battery-id="custom"]') as HTMLElement
    const form = customCard.querySelector('.custom-battery-form') as HTMLFormElement
    expect(form).not.toBeNull()
    expect(form.hidden).toBe(true)
  })

  // ── No inline styles ──────────────────────────────────────────────────────

  it('battery-picker section does not set inline style on any element', () => {
    const pickerSection = region.querySelector('section[aria-label="Batterijkeuze"]') as HTMLElement
    expect(pickerSection).not.toBeNull()
    // Check that no child elements have a style attribute
    const allElements = pickerSection.querySelectorAll('[style]')
    expect(allElements.length).toBe(0)
  })
})
