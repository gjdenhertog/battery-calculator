/**
 * src/ui/battery-picker.ts — battery spec-card picker (BATT-03, BATT-04, BATT-05, D-05, D-06)
 *
 * initBatteryPicker() wires the battery card grid inside #drop-zone-region.
 * Renders spec cards from BATTERY_CATALOG; Sessy 5 pre-checked (BATT-03).
 * Custom "+ Eigen batterij" card at the end (D-06).
 *
 * XSS safety: ALL user-derived strings (custom battery name) use .textContent.
 * No inline style assignments — all state via CSS class swaps (style-src 'self' CSP).
 */
import { effect } from '@preact/signals-core'
import { selectedBatteries, customBattery, scheduleRecompute } from '../state/app-state'
import { BATTERY_CATALOG } from '../domain/battery-catalog'
import type { BatteryConfig } from '../domain/types'
import { colorSlotFor } from '../helpers/color'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SELECTED = 5

// ---------------------------------------------------------------------------
// Effect disposal (RESEARCH Pitfall 3 — always capture dispose)
// ---------------------------------------------------------------------------

const _disposeFns: Array<() => void> = []

// ---------------------------------------------------------------------------
// Spec row helpers
// ---------------------------------------------------------------------------

/**
 * Append a dt+dd pair to a dl element.
 * value is always set via textContent — XSS safe.
 */
function appendSpec(dl: HTMLElement, label: string, value: string): void {
  const dt = document.createElement('dt')
  dt.textContent = label // textContent — XSS safe; static label string

  const dd = document.createElement('dd')
  dd.textContent = value // textContent — XSS safe; formatted number string

  dl.appendChild(dt)
  dl.appendChild(dd)
}

// ---------------------------------------------------------------------------
// Spec card builder
// ---------------------------------------------------------------------------

/**
 * Build a battery spec <li> card.
 * NOTE: swatch slot is determined by position in selectedBatteries at render time;
 * the reactive effect re-renders slot classes on every selection change.
 */
function buildSpecCard(
  battery: BatteryConfig,
  checked: boolean,
  disabled: boolean,
  orderedSelectedIds: string[],
): HTMLLIElement {
  const li = document.createElement('li')
  li.className = [
    'battery-card',
    checked ? 'battery-card--selected' : '',
    disabled ? 'battery-card--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ')
  li.dataset.batteryId = battery.id // Phase 5 hook

  const label = document.createElement('label')
  label.className = 'battery-card__label'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.className = 'battery-card__checkbox'
  checkbox.checked = checked
  checkbox.disabled = disabled
  if (disabled && !checked) {
    checkbox.title = 'Deselecteer een batterij om een andere te kiezen'
  }

  const slotN = colorSlotFor(battery.id, orderedSelectedIds)
  const swatch = document.createElement('span')
  swatch.className = `battery-card__swatch battery-swatch--${slotN}`

  const name = document.createElement('span')
  name.className = 'battery-card__name'
  name.textContent = battery.name // textContent — XSS safe

  label.appendChild(checkbox)
  label.appendChild(swatch)
  label.appendChild(name)
  li.appendChild(label)

  // Spec rows (D-05)
  const dl = document.createElement('dl')
  dl.className = 'battery-card__specs'

  appendSpec(dl, 'Capaciteit', `${battery.nominalCapacityKwh.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`)
  appendSpec(dl, 'Bruikbaar', `${Math.round(battery.dodFraction * 100)} %`)
  appendSpec(dl, 'Rendement', `${Math.round(battery.roundTripEfficiency * 100)} %`)
  appendSpec(dl, 'Max laden', `${battery.maxChargeKw.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`)
  appendSpec(dl, 'Max ontladen', `${battery.maxDischargeKw.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`)

  li.appendChild(dl)
  return li
}

// ---------------------------------------------------------------------------
// Custom battery card builder
// ---------------------------------------------------------------------------

function buildCustomCard(): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'battery-card battery-card--custom'
  li.dataset.batteryId = 'custom'

  // Expand/collapse button
  const expandBtn = document.createElement('button')
  expandBtn.type = 'button'
  expandBtn.className = 'battery-card__expand'
  expandBtn.setAttribute('aria-expanded', 'false')
  expandBtn.textContent = '+ Eigen batterij' // textContent — XSS safe; static string

  // Custom battery form (initially hidden)
  const form = document.createElement('form')
  form.className = 'custom-battery-form'
  form.setAttribute('novalidate', '')
  form.hidden = true

  // Status alert for incomplete custom battery
  const incompleteAlert = document.createElement('span')
  incompleteAlert.setAttribute('role', 'alert')
  incompleteAlert.className = 'custom-battery-incomplete'
  incompleteAlert.hidden = true
  incompleteAlert.textContent =
    'Eigen batterij niet meegenomen — vul minimaal de capaciteit in.' // textContent — static string

  // ── Field definitions — placeholders use Sessy 5 defaults (UI-SPEC §2) ──
  const fieldDefs: Array<{
    label: string
    id: string
    min: string
    step: string
    max: string
    placeholder: string
    field: keyof Pick<
      BatteryConfig,
      | 'nominalCapacityKwh'
      | 'dodFraction'
      | 'roundTripEfficiency'
      | 'maxChargeKw'
      | 'maxDischargeKw'
    >
    scale?: number // multiply input by this before writing to BatteryConfig
    required?: boolean
  }> = [
    {
      label: 'Capaciteit (kWh)',
      id: 'custom-capacity',
      min: '0.1',
      step: '0.1',
      max: '200',
      placeholder: '5,0',
      field: 'nominalCapacityKwh',
      required: true,
    },
    {
      label: 'Bruikbaar (%)',
      id: 'custom-dod',
      min: '1',
      step: '1',
      max: '100',
      placeholder: '100',
      field: 'dodFraction',
      scale: 0.01, // input is 0–100, stored as 0–1
    },
    {
      label: 'Rendement (%)',
      id: 'custom-efficiency',
      min: '1',
      step: '1',
      max: '100',
      placeholder: '85',
      field: 'roundTripEfficiency',
      scale: 0.01, // input is 0–100, stored as 0–1
    },
    {
      label: 'Max laden (kW)',
      id: 'custom-charge',
      min: '0.1',
      step: '0.1',
      max: '100',
      placeholder: '2,2',
      field: 'maxChargeKw',
    },
    {
      label: 'Max ontladen (kW)',
      id: 'custom-discharge',
      min: '0.1',
      step: '0.1',
      max: '100',
      placeholder: '1,7',
      field: 'maxDischargeKw',
    },
  ]

  const inputEls: Map<string, HTMLInputElement> = new Map()

  for (const def of fieldDefs) {
    const fieldLabel = document.createElement('label')
    fieldLabel.className = 'custom-battery-form__label'

    const labelText = document.createElement('span')
    labelText.className = 'custom-battery-form__label-text'
    labelText.textContent = def.label // textContent — static string

    const input = document.createElement('input')
    input.type = 'number'
    input.id = def.id
    input.className = 'custom-battery-form__input'
    input.min = def.min
    input.step = def.step
    input.max = def.max
    input.placeholder = def.placeholder
    input.setAttribute('aria-label', def.label)

    const errorSpan = document.createElement('span')
    errorSpan.setAttribute('role', 'alert')
    errorSpan.className = 'input-error'
    errorSpan.id = `${def.id}-error`
    errorSpan.hidden = true

    input.setAttribute('aria-describedby', errorSpan.id)

    inputEls.set(def.field, input)

    fieldLabel.appendChild(labelText)
    fieldLabel.appendChild(input)
    fieldLabel.appendChild(errorSpan)
    form.appendChild(fieldLabel)
  }

  // ── Debounced validation + signal write (D-07: 400ms) ───────────────────
  let _debounce: ReturnType<typeof setTimeout> | null = null

  function validateAndWrite(): void {
    const capacityInput = inputEls.get('nominalCapacityKwh')!
    const capacityVal = parseFloat(capacityInput.value)

    const isCapacityValid =
      !Number.isNaN(capacityVal) && capacityVal > 0 && capacityVal <= 200

    // Clear all error states first
    for (const def of fieldDefs) {
      const inp = inputEls.get(def.field)!
      const errSpan = form.querySelector(`#${def.id}-error`) as HTMLSpanElement
      inp.classList.remove('input--invalid')
      if (errSpan) errSpan.hidden = true
    }

    if (!isCapacityValid && capacityInput.value !== '') {
      // Mark capacity field invalid
      capacityInput.classList.add('input--invalid')
      const errSpan = form.querySelector(`#custom-capacity-error`) as HTMLSpanElement
      if (errSpan) {
        errSpan.textContent = 'Vul een geldige capaciteit in (0,1 – 200 kWh).' // textContent — static string
        errSpan.hidden = false
      }
      customBattery.value = null
      incompleteAlert.hidden = false
      scheduleRecompute(false) // debounced for continuous input
      return
    }

    if (!isCapacityValid) {
      // Capacity empty — not yet filled
      customBattery.value = null
      incompleteAlert.hidden = false
      scheduleRecompute(false)
      return
    }

    // Build partial BatteryConfig from filled fields
    const partial: Partial<BatteryConfig> & { nominalCapacityKwh: number } = {
      id: 'custom',
      name: 'Eigen batterij',
      nominalCapacityKwh: capacityVal,
    }

    for (const def of fieldDefs) {
      if (def.field === 'nominalCapacityKwh') continue
      const inp = inputEls.get(def.field)!
      const raw = parseFloat(inp.value)
      if (!Number.isNaN(raw) && raw > 0) {
        const scale = def.scale ?? 1
        ;(partial as Record<string, unknown>)[def.field] = raw * scale
      }
    }

    // Apply defaults for unfilled optional fields (use Sessy 5 defaults)
    if (partial.dodFraction === undefined) partial.dodFraction = 1.0
    if (partial.roundTripEfficiency === undefined) partial.roundTripEfficiency = 0.85
    if (partial.maxChargeKw === undefined) partial.maxChargeKw = 2.2
    if (partial.maxDischargeKw === undefined) partial.maxDischargeKw = 1.7

    customBattery.value = partial as BatteryConfig
    incompleteAlert.hidden = true
    scheduleRecompute(false) // debounced (D-07)
  }

  function scheduledValidate(): void {
    if (_debounce !== null) clearTimeout(_debounce)
    _debounce = setTimeout(validateAndWrite, 400)
  }

  // Wire input + blur events (UI-SPEC §2: validate on blur/input debounced)
  for (const inp of inputEls.values()) {
    inp.addEventListener('input', scheduledValidate)
    inp.addEventListener('blur', () => {
      // Blur fires immediately (not debounced) for better UX feedback
      if (_debounce !== null) {
        clearTimeout(_debounce)
        _debounce = null
      }
      validateAndWrite()
    })
  }

  // ── Toggle expand/collapse ───────────────────────────────────────────────
  expandBtn.addEventListener('click', () => {
    const isExpanded = expandBtn.getAttribute('aria-expanded') === 'true'
    expandBtn.setAttribute('aria-expanded', String(!isExpanded))
    form.hidden = isExpanded
    incompleteAlert.hidden = isExpanded

    if (!isExpanded) {
      // Expanding — trigger initial validate to set signal state
      validateAndWrite()
    } else {
      // Collapsing — clear custom battery from signal
      customBattery.value = null
      scheduleRecompute(true)
    }
  })

  li.appendChild(expandBtn)
  li.appendChild(form)
  li.appendChild(incompleteAlert)
  return li
}

// ---------------------------------------------------------------------------
// Max-5 cap note
// ---------------------------------------------------------------------------

function buildCapNote(): HTMLParagraphElement {
  const p = document.createElement('p')
  p.className = 'picker-cap-note'
  p.textContent = 'Maximaal 5 batterijen geselecteerd.' // textContent — static string
  return p
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Wire the battery spec-card picker inside the given region.
 *
 * Renders a <section aria-label="Batterijkeuze"> with a card grid of all
 * BATTERY_CATALOG entries, pre-checking Sessy 5 (BATT-03). Appends a custom
 * battery card at the end (D-06). Enforces a max-5 selection cap (BATT-05).
 *
 * Writes selectedBatteries and customBattery signals on interaction.
 * Calls scheduleRecompute(true) on discrete selection changes.
 *
 * @param region - The #drop-zone-region HTMLElement.
 */
export function initBatteryPicker(region: HTMLElement): void {
  // ── Build section ────────────────────────────────────────────────────────
  const section = document.createElement('section')
  section.setAttribute('aria-label', 'Batterijkeuze')

  const heading = document.createElement('h2')
  heading.textContent = 'Kies batterijen' // textContent — static string
  section.appendChild(heading)

  const ul = document.createElement('ul')
  ul.setAttribute('role', 'list')
  ul.className = 'battery-picker'

  // ── Build a <li> per catalog battery ─────────────────────────────────────
  const catalogBatteries = Array.from(BATTERY_CATALOG)

  // Map batteryId → the <li> element (for reactive effect updates)
  const cardMap = new Map<string, HTMLLIElement>()
  // Map batteryId → the checkbox inside the card
  const checkboxMap = new Map<string, HTMLInputElement>()

  for (const battery of catalogBatteries) {
    const isChecked = selectedBatteries.value.some((b) => b.id === battery.id)
    const orderedSelectedIds = selectedBatteries.value.map((b) => b.id)
    const isDisabled = !isChecked && selectedBatteries.value.length >= MAX_SELECTED

    const li = buildSpecCard(battery, isChecked, isDisabled, orderedSelectedIds)
    const checkbox = li.querySelector('input[type="checkbox"]') as HTMLInputElement

    // ── Checkbox change → write selectedBatteries signal ──────────────────
    checkbox.addEventListener('change', () => {
      const currentlyChecked = checkbox.checked

      if (currentlyChecked) {
        // Guard: defensive check (disabled card should not be clickable)
        if (selectedBatteries.value.length >= MAX_SELECTED) {
          checkbox.checked = false
          return
        }
        // Append in selection order (Pitfall 5: never sort)
        selectedBatteries.value = [...selectedBatteries.value, battery]
      } else {
        selectedBatteries.value = selectedBatteries.value.filter((b) => b.id !== battery.id)
      }

      scheduleRecompute(true) // discrete change → immediate
    })

    cardMap.set(battery.id, li)
    checkboxMap.set(battery.id, checkbox)
    ul.appendChild(li)
  }

  // ── Custom battery card ────────────────────────────────────────────────
  const customCard = buildCustomCard()
  ul.appendChild(customCard)

  section.appendChild(ul)

  // ── Cap note (shown/hidden by reactive effect) ─────────────────────────
  const capNote = buildCapNote()
  capNote.hidden = true
  section.appendChild(capNote)

  region.appendChild(section)

  // ── Reactive effect: update card visual states on selection change ─────
  _disposeFns.push(
    effect(() => {
      const selected = selectedBatteries.value
      const selectedIds = selected.map((b) => b.id)
      const atCap = selected.length >= MAX_SELECTED

      for (const battery of catalogBatteries) {
        const li = cardMap.get(battery.id)!
        const checkbox = checkboxMap.get(battery.id)!
        const isChecked = selectedIds.includes(battery.id)
        const isDisabled = !isChecked && atCap

        // Update classes (CSS class state machine — no inline styles)
        li.classList.toggle('battery-card--selected', isChecked)
        li.classList.toggle('battery-card--disabled', isDisabled)

        // Update checkbox state
        checkbox.checked = isChecked
        checkbox.disabled = isDisabled
        if (isDisabled) {
          checkbox.title = 'Deselecteer een batterij om een andere te kiezen'
        } else {
          checkbox.removeAttribute('title')
        }

        // Update swatch slot class (selection order may have changed)
        const swatch = li.querySelector('.battery-card__swatch') as HTMLSpanElement | null
        if (swatch) {
          // Remove all battery-swatch--N classes
          for (let i = 1; i <= 5; i++) {
            swatch.classList.remove(`battery-swatch--${i}`)
          }
          const slotN = colorSlotFor(battery.id, selectedIds)
          swatch.classList.add(`battery-swatch--${slotN}`)
        }
      }

      // Show/hide cap note
      capNote.hidden = !atCap
    }),
  )
}

/**
 * Dispose all effects created by initBatteryPicker.
 * Call on hot-reload or component teardown.
 */
export function teardownBatteryPicker(): void {
  _disposeFns.forEach((d) => d())
  _disposeFns.length = 0
}
