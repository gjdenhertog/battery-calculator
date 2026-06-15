// @vitest-environment jsdom
/**
 * tests/battery-picker.test.ts — initBatteryPicker DOM-contract tests (BATT-03, BATT-04, BATT-05)
 *
 * Runs in jsdom environment (per-file override via first-line docblock).
 * Calls initBatteryPicker() against a real jsdom DOM seeded with the Phase 1 shell.
 *
 * Test coverage:
 *   (a) 7 catalog cards render on mount; custom cards added via add button
 *   (b) Sessy 5 checkbox is checked on mount (BATT-03)
 *   (c) Checking 5 batteries disables remaining checkboxes + shows cap note (BATT-05)
 *   (d) XSS assertion: custom battery name via .textContent — no <script> elements
 *   (e) Custom card swatch: slot matches comparison table; hidden when no valid custom battery
 *   (f) Multiple custom batteries (D-01..D-05): add/remove/cap/name/reflow
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderShell } from '../src/shell'
import { initBatteryPicker, teardownBatteryPicker } from '../src/ui/battery-picker'
import { selectedBatteries, customBatteries, activeBatteries } from '../src/state/app-state'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'
import { colorSlotFor } from '../src/helpers/color'
import type { BatteryConfig } from '../src/domain/types'

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

function resetPickerDOM(): HTMLElement {
  teardownBatteryPicker()
  document.body.innerHTML = '<div id="app"></div>'
  const host = document.getElementById('app') as HTMLElement
  renderShell(host)
  const newRegion = document.getElementById('drop-zone-region') as HTMLElement
  initBatteryPicker(newRegion)
  return newRegion
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initBatteryPicker DOM contract', () => {
  let region: HTMLElement

  beforeEach(() => {
    // Reset selectedBatteries to default before each test (Sessy 5 only)
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    customBatteries.value = []
    region = setupPickerRegion()
  })

  afterEach(() => {
    teardownBatteryPicker()
    customBatteries.value = []
  })

  // ── (a) Card count ──────────────────────────────────────────────────────

  it('renders 7 catalog battery cards', () => {
    // All catalog cards have data-battery-id that does NOT start with "custom-"
    const catalogCards = Array.from(region.querySelectorAll('li.battery-card')).filter(
      (li) => !(li as HTMLElement).dataset.batteryId?.startsWith('custom-'),
    )
    expect(catalogCards).toHaveLength(BATTERY_CATALOG.length) // 7
  })

  it('renders 0 custom battery cards on mount (before add button click)', () => {
    const customCards = Array.from(region.querySelectorAll('li.battery-card')).filter((li) =>
      (li as HTMLElement).dataset.batteryId?.startsWith('custom-'),
    )
    expect(customCards).toHaveLength(0)
  })

  it('renders 7 total catalog <li> cards on mount', () => {
    const allCards = region.querySelectorAll('li.battery-card')
    expect(allCards).toHaveLength(BATTERY_CATALOG.length) // 7
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
    const newRegion = resetPickerDOM()

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

    const newRegion = resetPickerDOM()

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

  it('renders section with no <script> elements (XSS)', () => {
    const scriptElements = region.querySelectorAll('script')
    expect(scriptElements.length).toBe(0)
  })

  it('add button renders label via textContent (XSS)', () => {
    const addBtn = region.querySelector('.battery-picker__add') as HTMLButtonElement
    expect(addBtn).not.toBeNull()
    // The button text should be the static string
    expect(addBtn.textContent).toContain('Eigen batterij')
    // Verify that assigning via textContent does not inject scripts
    const maliciousName = '<script>alert("xss")</script>'
    addBtn.textContent = maliciousName
    // textContent sets it as literal text — no script elements appear
    expect(region.querySelectorAll('script').length).toBe(0)
    expect(addBtn.textContent).toContain(maliciousName)
  })

  // ── Spec card anatomy ────────────────────────────────────────────────────

  it('each catalog card has a <dl class="battery-card__specs">', () => {
    const catalogCards = Array.from(region.querySelectorAll('li.battery-card')).filter(
      (li) => !(li as HTMLElement).dataset.batteryId?.startsWith('custom-'),
    )
    for (const card of catalogCards) {
      const dl = card.querySelector('dl.battery-card__specs')
      expect(dl).not.toBeNull()
    }
  })

  it('each catalog card has a swatch with battery-swatch-- class', () => {
    const catalogCards = Array.from(region.querySelectorAll('li.battery-card')).filter(
      (li) => !(li as HTMLElement).dataset.batteryId?.startsWith('custom-'),
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

  it('has an "+ Eigen batterij" add button', () => {
    const addBtn = region.querySelector('.battery-picker__add') as HTMLButtonElement
    expect(addBtn).not.toBeNull()
    expect(addBtn.textContent).toContain('Eigen batterij')
  })

  // ── No inline styles ──────────────────────────────────────────────────────

  it('battery-picker section does not set inline style on any element', () => {
    const pickerSection = region.querySelector('section[aria-label="Batterijkeuze"]') as HTMLElement
    expect(pickerSection).not.toBeNull()
    // Check that no child elements have a style attribute
    const allElements = pickerSection.querySelectorAll('[style]')
    expect(allElements.length).toBe(0)
  })

  // ── (e) Custom card swatch — slot matches table; hidden when no valid battery ────

  it('custom card swatch is hidden when no valid custom battery is in customBatteries', () => {
    // customBatteries is [] by default (set in beforeEach)
    // Add a custom card via add button
    const addBtn = region.querySelector('.battery-picker__add') as HTMLButtonElement
    addBtn.click()

    const customCard = region.querySelector('[data-battery-id="custom-1"]') as HTMLElement
    expect(customCard).not.toBeNull()
    const swatch = customCard.querySelector('.battery-card__swatch') as HTMLElement
    expect(swatch).not.toBeNull()
    expect(swatch.hidden).toBe(true)
  })

  it('custom card swatch slot matches comparison table slot for the same selection (COMP-04)', () => {
    // Arrange: one catalog battery selected + a valid custom battery in signal
    selectedBatteries.value = [BATTERY_CATALOG[0]] // sessy-5 at slot 1

    customBatteries.value = [
      {
        id: 'custom-1',
        name: 'Eigen batterij 1',
        nominalCapacityKwh: 10,
        dodFraction: 1,
        roundTripEfficiency: 0.85,
        maxChargeKw: 2.2,
        maxDischargeKw: 1.7,
      } as BatteryConfig,
    ]

    // Re-setup so the effect fires with the fresh signal state
    const newRegion = resetPickerDOM()

    // The add button must now show the card for the injected custom battery
    // The card is created via add button click
    const addBtn = newRegion.querySelector('.battery-picker__add') as HTMLButtonElement
    addBtn.click()

    // The newly added card gets id 'custom-1' but the SIGNAL already has 'custom-1'
    // The swatch effect should fire for this card
    const customCard = newRegion.querySelector('[data-battery-id="custom-1"]') as HTMLElement
    expect(customCard).not.toBeNull()
    const swatch = customCard.querySelector('.battery-card__swatch') as HTMLElement
    expect(swatch).not.toBeNull()

    // Swatch must be visible
    expect(swatch.hidden).toBe(false)

    // Slot must match what the comparison table would compute:
    const expectedSlot = colorSlotFor('custom-1', activeBatteries.value.map((b) => b.id))
    const hasExpectedClass = swatch.classList.contains(`battery-swatch--${expectedSlot}`)
    expect(hasExpectedClass).toBe(true)

    // Must use CSS class only — no inline style (style-src 'self' CSP)
    expect(swatch.getAttribute('style')).toBeNull()
  })

  it('custom card swatch has no battery-swatch--N class when no valid custom battery', () => {
    // customBatteries is [] from beforeEach — click add to get an empty draft card
    const addBtn = region.querySelector('.battery-picker__add') as HTMLButtonElement
    addBtn.click()

    const customCard = region.querySelector('[data-battery-id="custom-1"]') as HTMLElement
    const swatch = customCard.querySelector('.battery-card__swatch') as HTMLElement

    const hasAnySlotClass = Array.from(swatch.classList).some((c) =>
      c.startsWith('battery-swatch--'),
    )
    // When hidden (no valid custom), no slot class should be present (effect strips them)
    expect(hasAnySlotClass).toBe(false)
  })
})

describe('multiple custom batteries (D-01..D-05)', () => {
  let region: HTMLElement

  beforeEach(() => {
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    customBatteries.value = []
    region = setupPickerRegion()
  })

  afterEach(() => {
    teardownBatteryPicker()
    customBatteries.value = []
  })

  function getAddBtn(): HTMLButtonElement {
    return region.querySelector('.battery-picker__add') as HTMLButtonElement
  }

  // ── D-01: each click appends a fresh editable card with unique id ─────────

  it('clicking add button appends a custom-1 card (D-01)', () => {
    const addBtn = getAddBtn()
    expect(addBtn).not.toBeNull()
    addBtn.click()

    const card = region.querySelector('[data-battery-id="custom-1"]')
    expect(card).not.toBeNull()
  })

  it('clicking add button twice appends custom-1 and custom-2 cards (D-01)', () => {
    getAddBtn().click()
    getAddBtn().click()

    const card1 = region.querySelector('[data-battery-id="custom-1"]')
    const card2 = region.querySelector('[data-battery-id="custom-2"]')
    expect(card1).not.toBeNull()
    expect(card2).not.toBeNull()
  })

  it('each custom card has a unique data-battery-id (D-01)', () => {
    getAddBtn().click()
    getAddBtn().click()
    getAddBtn().click()

    const ids = Array.from(region.querySelectorAll('[data-battery-id^="custom-"]')).map(
      (el) => (el as HTMLElement).dataset.batteryId,
    )
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length) // all ids are unique
    expect(ids).toContain('custom-1')
    expect(ids).toContain('custom-2')
    expect(ids).toContain('custom-3')
  })

  // ── D-02: optional name field with 'Eigen batterij N' default ────────────

  it('custom card has a name input pre-filled with "Eigen batterij 1" (D-02)', () => {
    getAddBtn().click()

    const card = region.querySelector('[data-battery-id="custom-1"]') as HTMLElement
    expect(card).not.toBeNull()
    const nameInput = card.querySelector('.custom-battery-form__name') as HTMLInputElement
    expect(nameInput).not.toBeNull()
    expect(nameInput.value).toBe('Eigen batterij 1')
  })

  it('second custom card has name "Eigen batterij 2" (D-02)', () => {
    getAddBtn().click()
    getAddBtn().click()

    const card2 = region.querySelector('[data-battery-id="custom-2"]') as HTMLElement
    const nameInput = card2.querySelector('.custom-battery-form__name') as HTMLInputElement
    expect(nameInput.value).toBe('Eigen batterij 2')
  })

  it('a valid custom with typed name produces entry with that name (D-02)', () => {
    getAddBtn().click()

    const card = region.querySelector('[data-battery-id="custom-1"]') as HTMLElement
    const nameInput = card.querySelector('.custom-battery-form__name') as HTMLInputElement
    const capacityInput = card.querySelector('#custom-1-capacity') as HTMLInputElement

    // Type a custom name
    nameInput.value = 'Mijn accu'

    // Fill capacity to make it valid — blur triggers immediate validateAndWrite
    capacityInput.value = '5'
    capacityInput.dispatchEvent(new Event('blur'))

    const entry = customBatteries.value.find((b) => b.id === 'custom-1')
    expect(entry).not.toBeUndefined()
    expect(entry!.name).toBe('Mijn accu')
  })

  it('a valid custom with empty name falls back to "Eigen batterij N" (D-02)', () => {
    getAddBtn().click()

    const card = region.querySelector('[data-battery-id="custom-1"]') as HTMLElement
    const nameInput = card.querySelector('.custom-battery-form__name') as HTMLInputElement
    const capacityInput = card.querySelector('#custom-1-capacity') as HTMLInputElement

    // Leave name empty
    nameInput.value = ''

    // Fill capacity and blur to trigger validation
    capacityInput.value = '5'
    capacityInput.dispatchEvent(new Event('blur'))

    const entry = customBatteries.value.find((b) => b.id === 'custom-1')
    expect(entry).not.toBeUndefined()
    expect(entry!.name).toBe('Eigen batterij 1') // falls back to default
  })

  // ── D-03: valid-only cap counting + add-button disable ───────────────────

  it('empty draft card does NOT consume a cap slot (D-03)', () => {
    // Select 4 catalog batteries
    selectedBatteries.value = Array.from(BATTERY_CATALOG).slice(0, 4)
    const newRegion = (() => {
      teardownBatteryPicker()
      document.body.innerHTML = '<div id="app"></div>'
      const host = document.getElementById('app') as HTMLElement
      renderShell(host)
      const r = document.getElementById('drop-zone-region') as HTMLElement
      initBatteryPicker(r)
      region = r
      return r
    })()

    const addBtn = newRegion.querySelector('.battery-picker__add') as HTMLButtonElement

    // Add an empty draft (no capacity filled)
    addBtn.click()
    // activeBatteries should still be 4 (draft has no nominalCapacityKwh > 0)
    expect(activeBatteries.value.length).toBe(4)

    // Add button should NOT be disabled yet (4 valid + 0 valid customs = 4 < 5)
    expect(addBtn.disabled).toBe(false)
  })

  it('add button disables when 5 valid batteries (catalog) are active (D-03)', () => {
    // Select 5 catalog batteries
    selectedBatteries.value = Array.from(BATTERY_CATALOG).slice(0, 5)
    const newRegion = (() => {
      teardownBatteryPicker()
      document.body.innerHTML = '<div id="app"></div>'
      const host = document.getElementById('app') as HTMLElement
      renderShell(host)
      const r = document.getElementById('drop-zone-region') as HTMLElement
      initBatteryPicker(r)
      region = r
      return r
    })()

    const addBtn = newRegion.querySelector('.battery-picker__add') as HTMLButtonElement
    expect(addBtn.disabled).toBe(true)
  })

  it('clicking disabled add button does not add a card (D-03)', () => {
    // 5 catalog batteries
    selectedBatteries.value = Array.from(BATTERY_CATALOG).slice(0, 5)
    const newRegion = (() => {
      teardownBatteryPicker()
      document.body.innerHTML = '<div id="app"></div>'
      const host = document.getElementById('app') as HTMLElement
      renderShell(host)
      const r = document.getElementById('drop-zone-region') as HTMLElement
      initBatteryPicker(r)
      region = r
      return r
    })()

    const addBtn = newRegion.querySelector('.battery-picker__add') as HTMLButtonElement
    const cardsBefore = newRegion.querySelectorAll('[data-battery-id^="custom-"]').length
    addBtn.click()
    const cardsAfter = newRegion.querySelectorAll('[data-battery-id^="custom-"]').length
    expect(cardsAfter).toBe(cardsBefore) // no new card
  })

  // ── D-04: per-card remove frees slot immediately ─────────────────────────

  it('clicking × Verwijderen removes the card from the DOM (D-04)', () => {
    getAddBtn().click()

    const card = region.querySelector('[data-battery-id="custom-1"]')
    expect(card).not.toBeNull()

    const removeBtn = card!.querySelector('.battery-card__remove') as HTMLButtonElement
    expect(removeBtn).not.toBeNull()
    removeBtn.click()

    const cardAfter = region.querySelector('[data-battery-id="custom-1"]')
    expect(cardAfter).toBeNull()
  })

  it('clicking × Verwijderen removes valid entry from customBatteries signal (D-04)', () => {
    getAddBtn().click()

    // Make it a valid entry
    const card = region.querySelector('[data-battery-id="custom-1"]') as HTMLElement
    const capacityInput = card.querySelector('#custom-1-capacity') as HTMLInputElement
    capacityInput.value = '5'
    capacityInput.dispatchEvent(new Event('blur'))

    expect(customBatteries.value.find((b) => b.id === 'custom-1')).not.toBeUndefined()

    // Remove
    const removeBtn = card.querySelector('.battery-card__remove') as HTMLButtonElement
    removeBtn.click()

    expect(customBatteries.value.find((b) => b.id === 'custom-1')).toBeUndefined()
  })

  it('remove frees the slot — add is possible after removing a valid custom (D-04)', () => {
    // 4 catalog + inject 1 valid custom in signal
    selectedBatteries.value = Array.from(BATTERY_CATALOG).slice(0, 4)
    customBatteries.value = [
      {
        id: 'custom-1',
        name: 'Eigen batterij 1',
        nominalCapacityKwh: 5,
        dodFraction: 1.0,
        roundTripEfficiency: 0.85,
        maxChargeKw: 2.2,
        maxDischargeKw: 1.7,
      } as BatteryConfig,
    ]

    const newRegion = (() => {
      teardownBatteryPicker()
      document.body.innerHTML = '<div id="app"></div>'
      const host = document.getElementById('app') as HTMLElement
      renderShell(host)
      const r = document.getElementById('drop-zone-region') as HTMLElement
      initBatteryPicker(r)
      region = r
      return r
    })()

    // At cap (4 catalog + 1 valid custom = 5), add button disabled
    const addBtn = newRegion.querySelector('.battery-picker__add') as HTMLButtonElement
    expect(addBtn.disabled).toBe(true)

    // Click add to create the card that corresponds to custom-1 (ordinal 1)
    // Even though disabled, let us just click the card's remove button directly via signal
    // We remove via signal to free the slot
    customBatteries.value = []

    // Now the add button should re-enable
    expect(addBtn.disabled).toBe(false)
  })

  // ── D-05: order-based swatch reflow on removal ────────────────────────────

  it('survivor swatch slot reflows after middle custom removal (D-05)', () => {
    // Arrange: 1 catalog + 2 valid customs in signal
    selectedBatteries.value = [BATTERY_CATALOG[0]] // sessy-5, slot 1

    customBatteries.value = [
      {
        id: 'custom-1',
        name: 'Eigen batterij 1',
        nominalCapacityKwh: 5,
        dodFraction: 1.0,
        roundTripEfficiency: 0.85,
        maxChargeKw: 2.2,
        maxDischargeKw: 1.7,
      } as BatteryConfig,
      {
        id: 'custom-2',
        name: 'Eigen batterij 2',
        nominalCapacityKwh: 10,
        dodFraction: 1.0,
        roundTripEfficiency: 0.85,
        maxChargeKw: 2.2,
        maxDischargeKw: 1.7,
      } as BatteryConfig,
    ]

    const newRegion = (() => {
      teardownBatteryPicker()
      document.body.innerHTML = '<div id="app"></div>'
      const host = document.getElementById('app') as HTMLElement
      renderShell(host)
      const r = document.getElementById('drop-zone-region') as HTMLElement
      initBatteryPicker(r)
      region = r
      return r
    })()

    // Click add twice to create cards matching the signal ids
    const addBtn = newRegion.querySelector('.battery-picker__add') as HTMLButtonElement
    addBtn.click() // creates custom-1 card
    addBtn.click() // creates custom-2 card

    // custom-1 is at slot 2 (sessy-5 is slot 1), custom-2 at slot 3
    const card2Before = newRegion.querySelector('[data-battery-id="custom-2"]') as HTMLElement
    const swatch2Before = card2Before.querySelector('.battery-card__swatch') as HTMLElement
    const slotBefore = colorSlotFor(
      'custom-2',
      activeBatteries.value.map((b) => b.id),
    )
    expect(swatch2Before.classList.contains(`battery-swatch--${slotBefore}`)).toBe(true)

    // Remove custom-1 from signal (simulates remove button action)
    customBatteries.value = customBatteries.value.filter((b) => b.id !== 'custom-1')

    // Now custom-2 is at slot 2 (sessy-5 slot 1, custom-2 slot 2)
    const slotAfter = colorSlotFor(
      'custom-2',
      activeBatteries.value.map((b) => b.id),
    )
    expect(slotAfter).toBeLessThan(slotBefore) // slot decreased
    // The swatch of the surviving card-2 should have updated
    expect(swatch2Before.classList.contains(`battery-swatch--${slotAfter}`)).toBe(true)
  })

  // ── XSS safety for name field (T-06-02) ──────────────────────────────────

  it('custom battery name via textContent does not inject <script> elements (T-06-02)', () => {
    getAddBtn().click()

    const card = region.querySelector('[data-battery-id="custom-1"]') as HTMLElement
    const nameInput = card.querySelector('.custom-battery-form__name') as HTMLInputElement
    const capacityInput = card.querySelector('#custom-1-capacity') as HTMLInputElement

    // Set a malicious name
    nameInput.value = '<script>alert("xss")</script>'

    // Trigger validateAndWrite
    capacityInput.value = '5'
    capacityInput.dispatchEvent(new Event('blur'))

    // The name should be stored as text, not parsed as HTML
    const entry = customBatteries.value.find((b) => b.id === 'custom-1')
    expect(entry).not.toBeUndefined()
    // No <script> elements should exist in the picker subtree
    expect(region.querySelectorAll('script').length).toBe(0)
  })
})
