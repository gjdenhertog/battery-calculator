/**
 * src/ui/charts/flow-chart.ts — uPlot 4-series step-line chart adapter (VIZ-02, VIZ-03)
 *
 * Renders four step-line series for ONE battery's representative week:
 *   1. Grid import (residualImportKwh) — battery slot color (primary)
 *   2. Teruglevering (residualExportKwh) — --color-text-muted (#71717a)
 *   3. Laden / Battery charge (chargedKwh) — green (#16a34a)
 *   4. Ontladen / Battery discharge (dischargedKwh) — amber (#d97706)
 *
 * Battery is chosen via a <select> dropdown listing all active batteries (D-01).
 * The representative week is the Mon-Sun window with highest residualExportKwh
 * (selectRepresentativeWeek from Plan 01). Step lines NEVER use smooth interpolation (VIZ-03).
 *
 * XSS safety: ALL user-derived strings (custom battery name) use .textContent — never .innerHTML.
 * No inline style assignments — all state via CSS class swaps (style-src 'self' CSP).
 * No built-in uPlot tooltip (Pitfall 4 — would inject inline style, violating CSP).
 *
 * CSP note: uPlot.min.css is a class-only same-origin bundled stylesheet (no inline-style
 * injection, no url()/@import network fetch) — imported unconditionally per plan spec.
 *
 * Requirements: VIZ-02, VIZ-03, D-01, D-02, D-03, T-05-05, T-05-06
 */
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { effect } from '@preact/signals-core'
import { simResults, activeBatteries, isComputing } from '../../state/app-state'
import { colorFor } from '../../helpers/color'
import { formatAxisKwh } from '../../helpers/format'
import { selectRepresentativeWeek } from '../../domain/select-representative-week'
import type { BatteryConfig, TraceRow } from '../../domain/types'

// IANA timezone — always Amsterdam for production (D-03)
const ZONE = 'Europe/Amsterdam'

// Chart height — fixed per UI-SPEC Component Inventory 2
const CHART_HEIGHT = 320

// Four series fixed colors (UI-SPEC color table)
// Series 1 (grid import): battery's slot color — resolved at mount
// Series 2 (teruglevering): muted text color
const COLOR_TERUGLEVERING = '#71717a' // --color-text-muted
// Series 3 (laden/charge): green
const COLOR_LADEN = '#16a34a'
// Series 4 (ontladen/discharge): amber
const COLOR_ONTLADEN = '#d97706'

// ---------------------------------------------------------------------------
// Color resolution (Pattern 7 / Pitfall 2)
// ---------------------------------------------------------------------------

/**
 * Resolve a CSS custom property returned by colorFor() to a hex string.
 */
function resolveBatteryColor(batteryId: string, orderedIds: string[]): string {
  const cssVar = colorFor(batteryId, orderedIds)
    .replace('var(', '')
    .replace(')', '')
    .trim()
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || '#2563eb'
}

/**
 * Resolve a CSS custom property name (without var()) to its hex value.
 */
function resolveCssVar(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || varName
}

// ---------------------------------------------------------------------------
// DOM section builder
// ---------------------------------------------------------------------------

interface FlowChartDOMRefs {
  section: HTMLElement
  select: HTMLSelectElement
  caption: HTMLParagraphElement
  chartWrapper: HTMLElement
  legend: HTMLElement
}

function buildSectionDOM(container: HTMLElement): FlowChartDOMRefs {
  container.innerHTML = ''

  const section = document.createElement('section')
  section.className = 'chart-section'
  section.setAttribute('aria-label', 'Energiestroom voorbeeldweek')

  // Header: heading + battery dropdown
  const header = document.createElement('div')
  header.className = 'chart-section__header'

  const heading = document.createElement('h2')
  heading.className = 'results-section-heading'
  heading.textContent = 'Energiestroom voorbeeldweek'
  header.appendChild(heading)

  const selectLabel = document.createElement('label')
  selectLabel.className = 'chart-battery-select__label'
  selectLabel.htmlFor = 'flow-chart-battery'
  selectLabel.textContent = 'Batterij: '

  const select = document.createElement('select')
  select.id = 'flow-chart-battery'
  select.className = 'chart-battery-select'
  selectLabel.appendChild(select)
  header.appendChild(selectLabel)
  section.appendChild(header)

  // Week caption
  const caption = document.createElement('p')
  caption.className = 'chart-week-caption'
  section.appendChild(caption)

  // Chart canvas wrapper
  const chartWrapper = document.createElement('div')
  chartWrapper.className = 'chart-wrapper'
  chartWrapper.id = 'chart-flow'
  section.appendChild(chartWrapper)

  // Legend
  const legend = document.createElement('div')
  legend.className = 'chart-legend'
  section.appendChild(legend)

  container.appendChild(section)

  return { section, select, caption, chartWrapper, legend }
}

// ---------------------------------------------------------------------------
// Dropdown population
// ---------------------------------------------------------------------------

function populateDropdown(
  select: HTMLSelectElement,
  batteries: BatteryConfig[],
  selectedId: string,
): void {
  select.innerHTML = ''
  for (const battery of batteries) {
    const option = document.createElement('option')
    option.value = battery.id
    option.textContent = battery.name // textContent — XSS safe (custom battery name)
    select.appendChild(option)
  }
  // Set selected value (if it's in the list)
  const ids = batteries.map((b) => b.id)
  if (ids.includes(selectedId)) {
    select.value = selectedId
  } else if (batteries.length > 0) {
    select.value = batteries[0].id
  }
}

// ---------------------------------------------------------------------------
// Legend builder (4 fixed series)
// ---------------------------------------------------------------------------

function buildLegend(
  legend: HTMLElement,
  battery: BatteryConfig,
  orderedIds: string[],
): void {
  legend.innerHTML = ''

  const resolvedBatteryColor = resolveBatteryColor(battery.id, orderedIds)
  // Try to resolve CSS var for muted text
  const mutedColor = resolveCssVar('--color-text-muted') || COLOR_TERUGLEVERING

  const series = [
    { label: 'Grid import', color: resolvedBatteryColor },
    { label: 'Teruglevering', color: mutedColor },
    { label: 'Laden', color: COLOR_LADEN },
    { label: 'Ontladen', color: COLOR_ONTLADEN },
  ]

  for (const s of series) {
    const item = document.createElement('div')
    item.className = 'chart-legend__item'

    const swatch = document.createElement('span')
    swatch.className = 'chart-legend__swatch'
    // Use data-series-color attribute for color — CSS can consume it via attr()
    // No inline style= used (CSP style-src 'self' compliance; canvas series colors are CSP-exempt)
    swatch.setAttribute('data-series-color', s.color)

    const labelEl = document.createElement('span')
    labelEl.className = 'chart-legend__label'
    labelEl.textContent = s.label // textContent — static copy, not user data

    item.appendChild(swatch)
    item.appendChild(labelEl)
    legend.appendChild(item)
  }
}

// ---------------------------------------------------------------------------
// Week data extraction
// ---------------------------------------------------------------------------

/**
 * Filter trace rows to those within [startTs, endTs] (both inclusive, ms).
 */
function filterWeekRows(trace: TraceRow[], startTs: number, endTs: number): TraceRow[] {
  return trace.filter(
    (r) => r.timestamp.getTime() >= startTs && r.timestamp.getTime() <= endTs,
  )
}

/**
 * Build uPlot AlignedData for the 4-series step-line chart.
 * data[0] = Unix SECONDS (not ms!) — Pitfall 1
 * data[1] = residualImportKwh (grid import)
 * data[2] = residualExportKwh (teruglevering)
 * data[3] = chargedKwh (laden)
 * data[4] = dischargedKwh (ontladen)
 */
function buildFlowData(rows: TraceRow[]): uPlot.AlignedData {
  if (rows.length === 0) {
    return [[], [], [], [], []] as unknown as uPlot.AlignedData
  }
  return [
    rows.map((r) => r.timestamp.getTime() / 1000), // SECONDS — Pitfall 1
    rows.map((r) => r.residualImportKwh),
    rows.map((r) => r.residualExportKwh),
    rows.map((r) => r.chargedKwh),
    rows.map((r) => r.dischargedKwh),
  ] as uPlot.AlignedData
}

// ---------------------------------------------------------------------------
// uPlot options builder
// ---------------------------------------------------------------------------

function buildFlowOpts(
  battery: BatteryConfig,
  orderedIds: string[],
  containerWidth: number,
): uPlot.Options {
  const steppedBuilder = uPlot.paths.stepped({ align: 1 }) // step-after (VIZ-03)
  const batteryColor = resolveBatteryColor(battery.id, orderedIds)
  // Try to resolve muted color from CSS vars; fall back to hardcoded value
  const mutedColor = resolveCssVar('--color-text-muted') || COLOR_TERUGLEVERING

  return {
    width: containerWidth,
    height: CHART_HEIGHT,
    // tzDate: render x-axis in Amsterdam local time (Pattern 4 / Pitfall 1)
    tzDate: (ts) => uPlot.tzDate(ts, 'Europe/Amsterdam'),
    series: [
      {}, // x-axis placeholder (required by uPlot)
      {
        label: 'Grid import',
        stroke: batteryColor,
        paths: steppedBuilder,
        width: 2,
        points: { show: false },
      },
      {
        label: 'Teruglevering',
        stroke: mutedColor,
        paths: steppedBuilder,
        width: 2,
        points: { show: false },
      },
      {
        label: 'Laden',
        stroke: COLOR_LADEN,
        paths: steppedBuilder,
        width: 2,
        points: { show: false },
      },
      {
        label: 'Ontladen',
        stroke: COLOR_ONTLADEN,
        paths: steppedBuilder,
        width: 2,
        points: { show: false },
      },
    ],
    axes: [
      {
        // x-axis: time in Amsterdam local time (tzDate handles display)
      },
      {
        // y-axis: kWh ticks via formatAxisKwh (VIZ-04)
        values: (_u: uPlot, splits: number[]) => splits.map((v) => formatAxisKwh(v)),
        label: 'kWh',
      },
    ],
    legend: { show: false }, // Custom DOM legend (CSP safety, Pitfall 4)
    cursor: { show: false }, // No built-in cursor/tooltip (CSP safety, Pitfall 4)
    padding: [8, 0, 0, 0],
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Mount the sample-week energy flow step-line chart inside the given container.
 *
 * Returns a dispose function — call it when the UI is torn down to avoid effect leaks.
 * Follows the comparison-table.ts effect() pattern:
 * - Creates uPlot once; calls setData on signal update
 * - Destroys + recreates only when battery (series) structure changes
 * - Battery <select> dropdown lists all active batteries; defaulting to first
 * - ResizeObserver created once, guarded with `if (chart)`
 *
 * @param container - HTMLElement to mount the chart section into
 * @returns dispose function (the effect disposer + ResizeObserver disconnect)
 */
export function initFlowChart(container: HTMLElement): () => void {
  let chart: uPlot | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  let selectedBatteryId: string | null = null
  let domRefs: FlowChartDOMRefs | null = null
  let changeHandler: (() => void) | null = null

  // ResizeObserver created ONCE — outside the effect (Pitfall 7 guard)
  const observer = new ResizeObserver(() => {
    if (chart && container.offsetWidth > 0) {
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        chart!.setSize({ width: container.offsetWidth, height: CHART_HEIGHT })
      }, 100)
    }
  })
  observer.observe(container)

  const disposeEffect = effect(() => {
    const results = simResults.value
    const batteries = activeBatteries.value
    const computing = isComputing.value

    // Empty state: no results or no batteries
    if (!results || batteries.length === 0 || results.length !== batteries.length) {
      if (!computing) {
        container.innerHTML = ''
      }
      chart = null
      domRefs = null
      selectedBatteryId = null
      return
    }

    try {
      // Ensure DOM section exists
      if (!domRefs) {
        domRefs = buildSectionDOM(container)

        // Wire the change handler ONCE when DOM is first built
        changeHandler = () => {
          const newId = domRefs!.select.value
          if (newId !== selectedBatteryId) {
            selectedBatteryId = newId
            // Force a re-render of the current data with the new battery
            rerenderForSelectedBattery()
          }
        }
        domRefs.select.addEventListener('change', changeHandler)
      }

      const { select, caption, chartWrapper, legend } = domRefs
      const orderedIds = batteries.map((b) => b.id)

      // Determine selected battery id (default to first if current selection is gone)
      if (
        selectedBatteryId === null ||
        !orderedIds.includes(selectedBatteryId)
      ) {
        selectedBatteryId = batteries[0].id
      }

      // Populate dropdown
      populateDropdown(select, batteries, selectedBatteryId)

      // Find selected battery + result
      const selectedIdx = batteries.findIndex((b) => b.id === selectedBatteryId)
      const selectedBattery = batteries[selectedIdx] ?? batteries[0]
      const selectedResult = results[selectedIdx] ?? results[0]

      if (!selectedBattery || !selectedResult) return

      // Select representative week
      const week = selectRepresentativeWeek(selectedResult.trace, ZONE)

      // Filter trace to the representative week rows
      const weekRows = filterWeekRows(selectedResult.trace, week.startTs, week.endTs)

      // Update week caption (D-03)
      caption.textContent = `Voorbeeldweek: ${week.weekLabel} — de week met de meeste teruglevering in je data.`

      // Update legend
      buildLegend(legend, selectedBattery, orderedIds)

      // Build flow data
      const data = buildFlowData(weekRows)

      if (chart) {
        // Update existing chart data (Pattern 6)
        chart.setData(data)
      } else {
        // First render or after teardown: create uPlot
        chartWrapper.innerHTML = ''
        const opts = buildFlowOpts(selectedBattery, orderedIds, chartWrapper.offsetWidth || 600)
        chart = new uPlot(opts, data, chartWrapper)
      }
    } catch {
      // Error state
      container.innerHTML = ''
      const p = document.createElement('p')
      p.setAttribute('role', 'alert')
      p.className = 'results-error'
      p.textContent =
        'Grafiek kon niet worden geladen. Probeer een ander tijdvenster of herlaad de pagina.'
      container.appendChild(p)
      chart = null
      domRefs = null
      selectedBatteryId = null
    }
  })

  // ---------------------------------------------------------------------------
  // Re-render helper called on dropdown change (not an effect — avoids effect nesting)
  // ---------------------------------------------------------------------------

  function rerenderForSelectedBattery(): void {
    const results = simResults.value
    const batteries = activeBatteries.value

    if (!results || !batteries.length || !domRefs || !selectedBatteryId) return

    const orderedIds = batteries.map((b) => b.id)
    const { caption, chartWrapper, legend } = domRefs

    const selectedIdx = batteries.findIndex((b) => b.id === selectedBatteryId)
    const selectedBattery = batteries[selectedIdx] ?? batteries[0]
    const selectedResult = results[selectedIdx] ?? results[0]

    if (!selectedBattery || !selectedResult) return

    // Select representative week for the new battery
    const week = selectRepresentativeWeek(selectedResult.trace, ZONE)
    const weekRows = filterWeekRows(selectedResult.trace, week.startTs, week.endTs)

    // Update caption
    caption.textContent = `Voorbeeldweek: ${week.weekLabel} — de week met de meeste teruglevering in je data.`

    // Update legend with new battery color
    buildLegend(legend, selectedBattery, orderedIds)

    // Update chart data and (if series-1 color changed) recreate with new opts
    const data = buildFlowData(weekRows)

    if (chart) {
      // Rebuild opts to update the battery slot color (series-1 stroke may change)
      chart.destroy()
      chart = null
      chartWrapper.innerHTML = ''
    }

    const opts = buildFlowOpts(selectedBattery, orderedIds, chartWrapper.offsetWidth || 600)
    chart = new uPlot(opts, data, chartWrapper)
  }

  // Return combined dispose function
  return () => {
    disposeEffect()
    observer.disconnect()
    if (resizeTimer !== null) clearTimeout(resizeTimer)
    if (changeHandler && domRefs) {
      domRefs.select.removeEventListener('change', changeHandler)
    }
    if (chart) {
      chart.destroy()
      chart = null
    }
  }
}
