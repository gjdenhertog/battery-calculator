/**
 * src/ui/comparison-table.ts — comparison table renderer (COMP-01..08, D-08..D-11)
 *
 * initComparisonTable() wires the reactive effect that rebuilds the table whenever
 * simResults, activeBatteries, isComputing, or computeError signals change.
 * Returns the effect dispose function — callers must store and invoke it on teardown.
 *
 * XSS safety: ALL user-derived strings (custom battery name) use .textContent — never .innerHTML.
 * No inline style assignments — all state via CSS class swaps (style-src 'self' CSP).
 *
 * Requirements: COMP-01, COMP-02, COMP-03, COMP-05, COMP-06, COMP-07, COMP-08,
 *               D-02, D-08, D-09, D-10, D-11, D-12, D-13, D-14, SIM-08
 */
import { effect } from '@preact/signals-core'
import { simResults, activeBatteries, isComputing, computeError } from '../state/app-state'
import { deriveMetrics, detectLeaders } from '../helpers/metrics'
import { colorSlotFor } from '../helpers/color'
import { formatKwh, formatPct, formatRatio } from '../helpers/format'
import type { SimResult, BatteryConfig } from '../domain/types'

// ---------------------------------------------------------------------------
// Verbatim saldering disclaimer copy (COMP-06 — locked text, do NOT edit)
// ---------------------------------------------------------------------------

const SALDERING_DISCLAIMER_COPY =
  'De kolom "met saldering" berekent de netto jaarverrekening (1:1 import versus export). ' +
  'Dat is een versimpeling: vanaf 2026 is saldering al afgebouwd naar 64% van het ' +
  'leveringstarief. Terugleverkosten betaal je bovendien altijd, ongeacht de saldering. ' +
  'Een vloer van 50% van het kale leveringstarief blijft gelden tot en met 2030. ' +
  'De kolom "zonder saldering" laat zien wat een batterij oplevert in de situatie ' +
  'waarvoor je hem koopt: de toekomst na afschaffing van saldering.'

// Verbatim cadence banner copy (D-13 — locked text, do NOT edit)
const CADENCE_BANNER_COPY =
  'Dagdata overschat sterk wat een batterij opvangt — ' +
  'upload 15-minuten P1-data voor een betrouwbare schatting.'

// Verbatim negative-ON note copy (D-02 — shown when any avoidedOn ≤ 0)
const NEGATIVE_ON_NOTE_COPY =
  'Met huidige saldering levert een batterij nu nog niets op — het verlies bij ' +
  'op- en ontladen is groter dan de winst.'

// ---------------------------------------------------------------------------
// Empty / error / compute state renderers
// ---------------------------------------------------------------------------

function renderEmpty(container: HTMLElement): void {
  container.innerHTML = ''
  const p = document.createElement('p')
  p.className = 'results-empty'
  p.textContent = 'Selecteer minimaal één batterij om te vergelijken.'
  container.appendChild(p)
}

function renderError(container: HTMLElement, message: string): void {
  container.innerHTML = ''
  const p = document.createElement('p')
  p.setAttribute('role', 'alert')
  p.className = 'results-error'
  p.textContent = message // textContent — internal error string, not user data
  container.appendChild(p)
}

function renderComputeIndicator(container: HTMLElement): void {
  // The compute indicator appears alongside the stale table (SIM-08).
  // Remove any existing indicator first to avoid duplicates.
  const existing = container.querySelector('.compute-indicator')
  if (existing) existing.remove()

  const p = document.createElement('p')
  p.className = 'compute-indicator'
  p.setAttribute('aria-live', 'polite')
  p.setAttribute('aria-busy', 'true')
  p.textContent = 'Rekenen...'
  // Insert before any table-scroll-wrapper so indicator is above the stale table
  const tableWrapper = container.querySelector('.table-scroll-wrapper')
  if (tableWrapper) {
    container.insertBefore(p, tableWrapper)
  } else {
    container.appendChild(p)
  }
}

function removeComputeIndicator(container: HTMLElement): void {
  const existing = container.querySelector('.compute-indicator')
  if (existing) existing.remove()
}

// ---------------------------------------------------------------------------
// Table header builder (two-row thead: group + label)
// ---------------------------------------------------------------------------

function buildThead(table: HTMLTableElement): void {
  const thead = document.createElement('thead')

  // Row 1: group headers
  const groupRow = document.createElement('tr')
  groupRow.className = 'thead-group-row'

  const thBatterij = document.createElement('th')
  thBatterij.setAttribute('rowspan', '2')
  thBatterij.textContent = 'Batterij'
  thBatterij.dataset.metric = 'batterij'
  groupRow.appendChild(thBatterij)

  // Parent header spanning columns 2+3 (kWh netto-import vermeden)
  const thSalderingGroup = document.createElement('th')
  thSalderingGroup.setAttribute('colspan', '2')
  thSalderingGroup.className = 'col-saldering-group__header'
  thSalderingGroup.textContent = 'kWh netto-import vermeden'
  // Info button for saldering disclaimer (COMP-06)
  const infoBtn = document.createElement('button')
  infoBtn.className = 'saldering-info-btn'
  infoBtn.setAttribute('aria-expanded', 'false')
  infoBtn.setAttribute('aria-controls', 'saldering-disclaimer')
  infoBtn.setAttribute('aria-label', 'Meer over de salderingsvereenvoudiging')
  infoBtn.type = 'button'
  infoBtn.textContent = 'i'
  thSalderingGroup.appendChild(infoBtn)
  groupRow.appendChild(thSalderingGroup)

  const thZelfverbruik = document.createElement('th')
  thZelfverbruik.setAttribute('rowspan', '2')
  thZelfverbruik.textContent = 'Zelfverbruik %'
  thZelfverbruik.dataset.metric = 'selfConsumptionPct'
  groupRow.appendChild(thZelfverbruik)

  const thVerschoven = document.createElement('th')
  thVerschoven.setAttribute('rowspan', '2')
  thVerschoven.textContent = 'Verschoven kWh'
  thVerschoven.dataset.metric = 'shiftedKwh'
  groupRow.appendChild(thVerschoven)

  const thRestImport = document.createElement('th')
  thRestImport.setAttribute('rowspan', '2')
  thRestImport.textContent = 'Rest-import kWh'
  thRestImport.dataset.metric = 'residualImportKwh'
  groupRow.appendChild(thRestImport)

  const thRestExport = document.createElement('th')
  thRestExport.setAttribute('rowspan', '2')
  thRestExport.textContent = 'Rest-teruglevering kWh'
  thRestExport.dataset.metric = 'residualExportKwh'
  groupRow.appendChild(thRestExport)

  const thMarginaal = document.createElement('th')
  thMarginaal.setAttribute('rowspan', '2')
  thMarginaal.textContent = 'Marginale benutting kWh/kWh'
  thMarginaal.setAttribute('title', 'Verschoven kWh gedeeld door bruikbare capaciteit kWh')
  thMarginaal.dataset.metric = 'marginalBenutting'
  groupRow.appendChild(thMarginaal)

  thead.appendChild(groupRow)

  // Row 2: sub-label headers for the saldering pair (COMP-02: zonder first)
  const labelRow = document.createElement('tr')
  labelRow.className = 'thead-label-row'

  const thZonder = document.createElement('th')
  thZonder.className = 'col-primary'
  thZonder.textContent = 'zonder saldering'
  thZonder.dataset.metric = 'avoidedOff'
  labelRow.appendChild(thZonder)

  const thMet = document.createElement('th')
  thMet.className = 'col-muted'
  thMet.textContent = 'met saldering'
  thMet.dataset.metric = 'avoidedOn'
  labelRow.appendChild(thMet)

  thead.appendChild(labelRow)
  table.appendChild(thead)
}

// ---------------------------------------------------------------------------
// Metric cell helper
// ---------------------------------------------------------------------------

function createMetricCell(
  value: string,
  metricKey: string,
  labelText: string,
  rowIdx: number,
  leaders: Map<string, number>,
  extraClasses: string[] = [],
): HTMLTableCellElement {
  const td = document.createElement('td')
  const isLeader = leaders.get(metricKey) === rowIdx
  const classes = [
    isLeader ? 'table-cell--leader' : '',
    ...extraClasses,
  ].filter(Boolean)
  if (classes.length > 0) td.className = classes.join(' ')
  td.dataset.metric = metricKey // D-12 Phase 5 hook
  td.dataset.label = labelText   // D-12 Phase 5 stacked card reflow
  td.textContent = value         // textContent — formatted number string, never user HTML
  return td
}

// ---------------------------------------------------------------------------
// Battery row builder
// ---------------------------------------------------------------------------

function buildBatteryRow(
  battery: BatteryConfig,
  result: SimResult,
  rowIdx: number,
  orderedIds: string[],
  leaders: Map<string, number>,
): HTMLTableRowElement {
  const usableCapacity = battery.nominalCapacityKwh * battery.dodFraction
  const m = deriveMetrics(result, usableCapacity)
  const slot = colorSlotFor(battery.id, orderedIds)

  const tr = document.createElement('tr')
  tr.className = 'battery-row'
  tr.dataset.batteryId = battery.id // D-12 Phase 5 hook

  // Name cell with color swatch
  const tdName = document.createElement('td')
  tdName.className = 'battery-row__name'

  const swatch = document.createElement('span')
  swatch.className = `battery-swatch battery-swatch--${slot}`

  const nameSpan = document.createElement('span')
  nameSpan.className = 'battery-row__label'
  nameSpan.textContent = battery.name // textContent — XSS safe (custom battery name)

  tdName.appendChild(swatch)
  tdName.appendChild(nameSpan)
  tr.appendChild(tdName)

  // Column 2: kWh netto-import vermeden — zonder saldering (primary)
  const avoidedOffCell = createMetricCell(
    formatKwh(m.avoidedOff),
    'avoidedOff',
    'zonder saldering',
    rowIdx,
    leaders,
    ['col-primary'],
  )
  tr.appendChild(avoidedOffCell)

  // Column 3: kWh netto-import vermeden — met saldering (muted)
  // D-02: negative values shown as-is with .table-cell--negative, NOT floored
  const avoidedOnNegative = m.avoidedOn <= 0
  // Format with U+2212 proper minus sign for negative values
  const avoidedOnText = m.avoidedOn < 0
    ? `−${formatKwh(Math.abs(m.avoidedOn))}`
    : formatKwh(m.avoidedOn)
  const avoidedOnClasses = ['col-muted']
  if (avoidedOnNegative) avoidedOnClasses.push('table-cell--negative')
  const avoidedOnCell = createMetricCell(
    avoidedOnText,
    'avoidedOn',
    'met saldering',
    rowIdx,
    leaders,
    avoidedOnClasses,
  )
  tr.appendChild(avoidedOnCell)

  // Column 4: Zelfverbruik %
  tr.appendChild(createMetricCell(
    formatPct(m.selfConsumptionPct),
    'selfConsumptionPct',
    'Zelfverbruik %',
    rowIdx,
    leaders,
  ))

  // Column 5: Verschoven kWh
  tr.appendChild(createMetricCell(
    formatKwh(m.shiftedKwh),
    'shiftedKwh',
    'Verschoven kWh',
    rowIdx,
    leaders,
  ))

  // Column 6: Rest-import kWh
  tr.appendChild(createMetricCell(
    formatKwh(m.residualImportKwh),
    'residualImportKwh',
    'Rest-import kWh',
    rowIdx,
    leaders,
  ))

  // Column 7: Rest-teruglevering kWh
  tr.appendChild(createMetricCell(
    formatKwh(m.residualExportKwh),
    'residualExportKwh',
    'Rest-teruglevering kWh',
    rowIdx,
    leaders,
  ))

  // Column 8: Marginale benutting
  tr.appendChild(createMetricCell(
    formatRatio(m.marginalBenutting),
    'marginalBenutting',
    'Marginale benutting kWh/kWh',
    rowIdx,
    leaders,
  ))

  return tr
}

// ---------------------------------------------------------------------------
// Wire saldering disclaimer toggle (COMP-06 / D-14)
// ---------------------------------------------------------------------------

function wireSalderingDisclaimer(container: HTMLElement): void {
  const btn = container.querySelector('.saldering-info-btn') as HTMLButtonElement | null
  const disclaimer = container.querySelector('#saldering-disclaimer') as HTMLElement | null
  if (!btn || !disclaimer) return

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true'
    btn.setAttribute('aria-expanded', String(!expanded))
    disclaimer.hidden = expanded
  })
}

// ---------------------------------------------------------------------------
// Full table renderer
// ---------------------------------------------------------------------------

function renderTable(
  container: HTMLElement,
  results: SimResult[],
  batteries: BatteryConfig[],
): void {
  container.innerHTML = ''

  const orderedIds = batteries.map((b) => b.id)
  const allMetrics = results.map((r, i) =>
    deriveMetrics(r, batteries[i].nominalCapacityKwh * batteries[i].dodFraction)
  )
  const leaders = detectLeaders(allMetrics)

  // Coarse-cadence banner (D-13) — above the table when any result has the warning
  const hasCoarseWarning = results.some((r) => r.coarseCadenceWarning === true)
  if (hasCoarseWarning) {
    const banner = document.createElement('div')
    banner.setAttribute('role', 'alert')
    banner.className = 'cadence-banner'
    const bannerText = document.createElement('p')
    bannerText.className = 'cadence-banner__text'
    bannerText.textContent = CADENCE_BANNER_COPY // textContent — static copy, not user data
    banner.appendChild(bannerText)
    container.appendChild(banner)
  }

  // Table scroll wrapper (D-12 responsive)
  const scrollWrapper = document.createElement('div')
  scrollWrapper.className = 'table-scroll-wrapper'

  const table = document.createElement('table')
  table.className = 'comparison-table'

  buildThead(table)

  const tbody = document.createElement('tbody')
  batteries.forEach((battery, i) => {
    // Defensive: skip any index without a corresponding result (belt-and-suspenders;
    // the effect-level guard above is the primary defence against mismatched lengths).
    if (i >= results.length) return
    tbody.appendChild(buildBatteryRow(battery, results[i], i, orderedIds, leaders))
  })
  table.appendChild(tbody)
  scrollWrapper.appendChild(table)
  container.appendChild(scrollWrapper)

  // Saldering disclaimer (COMP-06 / D-14) — below the table, hidden by default
  const disclaimer = document.createElement('div')
  disclaimer.id = 'saldering-disclaimer'
  disclaimer.className = 'saldering-disclaimer'
  disclaimer.hidden = true
  disclaimer.textContent = SALDERING_DISCLAIMER_COPY // textContent — static locked copy
  container.appendChild(disclaimer)

  // Wire the "i" button to toggle the disclaimer
  wireSalderingDisclaimer(container)

  // Negative-ON note (D-02) — below the table when any battery's avoidedOn <= 0
  const hasNegativeOn = allMetrics.some((m) => m.avoidedOn <= 0)
  if (hasNegativeOn) {
    const noteP = document.createElement('p')
    noteP.className = 'saldering-negative-note'
    noteP.textContent = NEGATIVE_ON_NOTE_COPY // textContent — static copy
    container.appendChild(noteP)
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Wire the reactive comparison table inside the given container element.
 *
 * The table rebuilds whenever simResults, activeBatteries, isComputing, or
 * computeError signals change. Handles empty, error, stale/computing, and
 * populated states (SIM-08 stale-dim pattern).
 *
 * @param container - The #results-region HTMLElement from the Phase 1 shell.
 * @returns A dispose function — call it when the UI is torn down to avoid effect leaks.
 */
export function initComparisonTable(container: HTMLElement): () => void {
  return effect(() => {
    const results = simResults.value
    const batteries = activeBatteries.value
    const computing = isComputing.value
    const error = computeError.value

    // SIM-08: dim the stale table while computing
    const tableWrapper = container.querySelector('.table-scroll-wrapper')
    if (tableWrapper) {
      tableWrapper.classList.toggle('results-stale', computing)
    }

    // Show or remove the "Rekenen..." indicator
    if (computing) {
      renderComputeIndicator(container)
    } else {
      removeComputeIndicator(container)
    }

    // Error state takes priority
    if (error) {
      renderError(container, error)
      return
    }

    // No batteries or no results yet — show empty state
    if (!results || batteries.length === 0) {
      if (!computing) {
        renderEmpty(container)
      }
      return
    }

    // Guard against transient results/batteries length mismatch.
    // This happens when the user toggles a battery and selectedBatteries updates
    // synchronously (re-running this effect via activeBatteries) BEFORE the new
    // recompute has landed. Keep the stale table in place and show the compute
    // indicator — a fresh effect run will arrive once simResults catches up.
    if (results.length !== batteries.length) {
      renderComputeIndicator(container)
      return
    }

    // Render the full table (rebuilds on every signal change)
    renderTable(container, results, batteries)

    // Re-apply stale class after table rebuild (renderTable clears innerHTML)
    const newWrapper = container.querySelector('.table-scroll-wrapper')
    if (newWrapper) {
      newWrapper.classList.toggle('results-stale', computing)
    }

    // Re-render compute indicator above the table after rebuild
    if (computing) {
      renderComputeIndicator(container)
    }
  })
}
