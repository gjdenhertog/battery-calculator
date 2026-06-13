/**
 * src/ui/period-control.ts — interactive period-narrowing control (DATA-12, D-19)
 *
 * initPeriodControl() renders the date-range inputs and coverage indicator inside the
 * given container. Wires date change events to update periodFrom/periodTo signals →
 * immediate worker recompute. Coverage indicator updates reactively from coverageDays.
 *
 * No inline style assignments — all state via CSS classes (style-src 'self' CSP).
 * XSS safety: all cell values are formatted numbers, not user-derived HTML strings.
 *
 * Requirements: DATA-12, D-19, COMP-07, COMP-08
 */
import { effect } from '@preact/signals-core'
import {
  parsedSamples,
  periodFrom,
  periodTo,
  coverageDays,
  scheduleRecompute,
} from '../state/app-state'
import { fullRange } from '../domain/period-filter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date as a YYYY-MM-DD string for use in <input type="date"> value/min/max.
 * Uses UTC date components to avoid timezone shifts on the date input.
 */
function toDateInputValue(d: Date): string {
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD string from a date input into a UTC Date at midnight.
 * Returns null if the string is empty or invalid.
 */
function parseDateInputValue(value: string): Date | null {
  if (!value) return null
  const d = new Date(`${value}T00:00:00Z`)
  if (isNaN(d.getTime())) return null
  return d
}

/**
 * Update the coverage indicator text reactively from the days count.
 * Singular: "1 dag aan data". Plural: "{N} dagen aan data" (COMP-08).
 */
function updateCoverageIndicator(el: HTMLElement, days: number): void {
  // textContent — formatted integer, no user data
  el.textContent = days === 1 ? '1 dag aan data' : `${days} dagen aan data`
}

// ---------------------------------------------------------------------------
// Dispose management
// ---------------------------------------------------------------------------

const _disposeFns: Array<() => void> = []

/**
 * Dispose all effects created by initPeriodControl.
 * Call on hot-reload, routing teardown, or in test afterEach to prevent
 * effect accumulation across repeated initPeriodControl() calls (Pitfall 3).
 */
export function teardownPeriodControl(): void {
  _disposeFns.forEach((d) => d())
  _disposeFns.length = 0
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Render the period-narrowing control (date inputs + coverage indicator) inside
 * the given container element. Uses a persistent disposed effect for reactivity.
 *
 * Effect lifecycle:
 * - parsedSamples effect: sets input min/max/value when samples are available
 * - coverageDays effect: updates the coverage indicator text reactively
 *
 * Both effects are stored in _disposeFns (Pitfall 3 — avoid effect accumulation).
 *
 * @param container - The #results-region HTMLElement (or any parent container).
 */
export function initPeriodControl(container: HTMLElement): void {
  // ── Build the section ──────────────────────────────────────────────────────
  const section = document.createElement('section')
  section.setAttribute('aria-label', 'Analyseperiode')

  const heading = document.createElement('h2')
  heading.className = 'results-section-heading'
  heading.textContent = 'Analyseperiode'
  section.appendChild(heading)

  // ── Date inputs row ────────────────────────────────────────────────────────
  const inputsRow = document.createElement('div')
  inputsRow.className = 'period-inputs'

  // "Van" (from) label + input
  const fromLabel = document.createElement('label')
  fromLabel.textContent = 'Van'
  fromLabel.htmlFor = 'period-from'
  fromLabel.className = 'period-label'

  const fromInput = document.createElement('input')
  fromInput.type = 'date'
  fromInput.className = 'period-input'
  fromInput.id = 'period-from'

  fromLabel.appendChild(fromInput)
  inputsRow.appendChild(fromLabel)

  // "Tot" (to) label + input
  const toLabel = document.createElement('label')
  toLabel.textContent = 'Tot'
  toLabel.htmlFor = 'period-to'
  toLabel.className = 'period-label'

  const toInput = document.createElement('input')
  toInput.type = 'date'
  toInput.className = 'period-input'
  toInput.id = 'period-to'

  toLabel.appendChild(toInput)
  inputsRow.appendChild(toLabel)

  section.appendChild(inputsRow)

  // ── Coverage indicator (COMP-08) ──────────────────────────────────────────
  const coverageP = document.createElement('p')
  coverageP.className = 'period-coverage'
  coverageP.setAttribute('aria-live', 'polite')
  section.appendChild(coverageP)

  // ── Period framing note (COMP-07: no "/jaar"/"/maand") ────────────────────
  const framingNote = document.createElement('p')
  framingNote.className = 'period-framing-note'
  framingNote.textContent = 'Alle getallen gelden over de periode die je hebt geüpload.'
  section.appendChild(framingNote)

  container.appendChild(section)

  // ── Effect 1: update inputs when parsedSamples change ─────────────────────
  _disposeFns.push(
    effect(() => {
      const samples = parsedSamples.value
      if (samples.length === 0) return

      const range = fullRange(samples)
      const minStr = toDateInputValue(range.start)
      const maxStr = toDateInputValue(range.end)

      fromInput.min = minStr
      fromInput.max = maxStr
      toInput.min = minStr
      toInput.max = maxStr

      // Default both values to the full range (D-19)
      if (!fromInput.value) fromInput.value = minStr
      if (!toInput.value) toInput.value = maxStr
    }),
  )

  // ── Event: "Van" change ────────────────────────────────────────────────────
  fromInput.addEventListener('change', () => {
    const from = parseDateInputValue(fromInput.value)
    if (!from) return

    // Clamp: if Van > Tot, set Tot = Van (UI-SPEC interaction contract)
    const to = parseDateInputValue(toInput.value)
    if (to && from > to) {
      toInput.value = fromInput.value
      periodTo.value = from
    }

    periodFrom.value = from
    scheduleRecompute(true) // discrete event — immediate recompute (D-07)
  })

  // ── Event: "Tot" change ────────────────────────────────────────────────────
  toInput.addEventListener('change', () => {
    const to = parseDateInputValue(toInput.value)
    if (!to) return

    // Clamp: if Tot < Van, set Van = Tot
    const from = parseDateInputValue(fromInput.value)
    if (from && to < from) {
      fromInput.value = toInput.value
      periodFrom.value = to
    }

    periodTo.value = to
    scheduleRecompute(true) // discrete event — immediate recompute (D-07)
  })

  // ── Effect 2: reactive coverage indicator from coverageDays computed ───────
  _disposeFns.push(
    effect(() => {
      const days = coverageDays.value
      updateCoverageIndicator(coverageP, days)
    }),
  )
}
