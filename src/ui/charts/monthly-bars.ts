/**
 * src/ui/charts/monthly-bars.ts — uPlot grouped-bar chart adapter (VIZ-01, VIZ-04)
 *
 * Mounts a uPlot grouped-bar chart inside the given container.
 * One bars() series per selected battery, grouped side-by-side per month (ROADMAP
 * criterion 1 + D-04). Colors come from colorFor() to match the comparison table
 * (COMP-04). Partial months drawn at lower opacity + "(deels)" label (D-05).
 * Sparse data (< 2 full months) renders with a "Weinig data" note (D-06).
 *
 * XSS safety: ALL user-derived strings (custom battery name) use .textContent — never .innerHTML.
 * Hover readout uses a custom DOM tooltip (chart-tooltip.ts) positioned via CSSOM
 * (el.style.*), which style-src 'self' does NOT block — only parsed inline styles do.
 *
 * CSP note: uPlot.min.css is a class-only same-origin bundled stylesheet (no inline-style
 * injection, no url()/@import network fetch) — imported unconditionally per plan spec.
 *
 * Requirements: VIZ-01, VIZ-04, D-04, D-05, D-06, T-05-05, T-05-06
 */
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { effect } from '@preact/signals-core'
import { simResults, activeBatteries, isComputing } from '../../state/app-state'
import { colorFor, colorSlotFor } from '../../helpers/color'
import { formatAxisKwh, formatKwh } from '../../helpers/format'
import { bucketByMonth } from '../../domain/bucket-by-month'
import type { MonthBucket } from '../../domain/bucket-by-month'
import type { BatteryConfig } from '../../domain/types'
import { hoverTooltipPlugin } from './chart-tooltip'

// IANA timezone — always Amsterdam for production (D-04)
const ZONE = 'Europe/Amsterdam'

// Chart height — fixed per UI-SPEC Component Inventory 1
const CHART_HEIGHT = 280

// Full-month bar opacity (80%) and partial-month bar opacity (40%)
// Applied via disp.fill per bar (Pattern 3b / D-05)
const FULL_OPACITY = 0.8
const PARTIAL_OPACITY = 0.4

// Grouped-bar geometry (in x-scale data units, where each month = 1 unit).
// uPlot does NOT auto-offset multiple bars() series — they overlap unless we
// position each battery's bars ourselves via disp.x0/disp.size (the published
// facet API). GROUP_W is the share of a month slot the cluster occupies; the
// rest is the inter-month gap. INNER_GAP_FRAC adds a thin gap between bars.
const GROUP_W = 0.8
const INNER_GAP_FRAC = 0.12

// ---------------------------------------------------------------------------
// Color resolution (Pattern 7 / Pitfall 2)
// ---------------------------------------------------------------------------

/**
 * Resolve a CSS custom property returned by colorFor() to a hex string.
 * getComputedStyle cannot be called in a node environment; callers guard this.
 */
function resolveBatteryColor(batteryId: string, orderedIds: string[]): string {
  const cssVar = colorFor(batteryId, orderedIds).replace('var(', '').replace(')', '').trim()
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || '#2563eb'
}

/**
 * Apply alpha (0–1) to a hex color string.
 * Returns an rgba() string suitable for canvas fills.
 */
function hexToRgba(hex: string, alpha: number): string {
  // Normalize: strip # and handle shorthand (#abc → #aabbcc)
  const clean = hex.startsWith('#') ? hex.slice(1) : hex
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(37, 99, 235, ${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ---------------------------------------------------------------------------
// DOM section builder
// ---------------------------------------------------------------------------

function buildSectionDOM(container: HTMLElement): {
  section: HTMLElement
  chartWrapper: HTMLElement
  legend: HTMLElement
  partialLabelContainer: HTMLElement
  sparseNote: HTMLElement
} {
  container.innerHTML = ''

  const section = document.createElement('section')
  section.className = 'chart-section'
  section.setAttribute('aria-label', 'Maandelijks zelfverbruik')

  const heading = document.createElement('h2')
  heading.className = 'results-section-heading'
  heading.textContent = 'Zelfverbruik per maand'
  section.appendChild(heading)

  const chartWrapper = document.createElement('div')
  chartWrapper.className = 'chart-wrapper'
  chartWrapper.id = 'chart-monthly'
  section.appendChild(chartWrapper)

  const partialLabelContainer = document.createElement('div')
  partialLabelContainer.className = 'chart-partial-labels'
  section.appendChild(partialLabelContainer)

  const sparseNote = document.createElement('p')
  sparseNote.className = 'chart-sparse-note'
  sparseNote.hidden = true
  section.appendChild(sparseNote)

  const legend = document.createElement('div')
  legend.className = 'chart-legend'
  section.appendChild(legend)

  container.appendChild(section)

  return { section, chartWrapper, legend, partialLabelContainer, sparseNote }
}

// ---------------------------------------------------------------------------
// Legend builder
// ---------------------------------------------------------------------------

function buildLegend(legend: HTMLElement, batteries: BatteryConfig[]): void {
  legend.innerHTML = ''
  const orderedIds = batteries.map((b) => b.id)

  for (const battery of batteries) {
    const slot = colorSlotFor(battery.id, orderedIds)

    const item = document.createElement('div')
    item.className = 'chart-legend__item'

    const swatch = document.createElement('span')
    swatch.className = `chart-legend__swatch battery-swatch battery-swatch--${slot}`

    const label = document.createElement('span')
    label.className = 'chart-legend__label'
    label.textContent = battery.name // textContent — XSS safe (custom battery name)

    item.appendChild(swatch)
    item.appendChild(label)
    legend.appendChild(item)
  }
}

// ---------------------------------------------------------------------------
// Partial-month label builder (D-05)
// ---------------------------------------------------------------------------

function buildPartialLabels(container: HTMLElement, buckets: MonthBucket[]): void {
  container.innerHTML = ''
  const hasPartial = buckets.some((b) => b.isPartial)
  if (!hasPartial) return

  // Create a single "(deels)" label element spanning all partial months
  const label = document.createElement('span')
  label.className = 'chart-partial-label'
  label.textContent = '(deels) = maand niet volledig aanwezig in de data'
  container.appendChild(label)
}

// ---------------------------------------------------------------------------
// Sparse note (D-06)
// ---------------------------------------------------------------------------

function updateSparseNote(sparseNote: HTMLElement, buckets: MonthBucket[]): void {
  const fullMonthCount = buckets.filter((b) => !b.isPartial).length
  if (fullMonthCount < 2) {
    sparseNote.hidden = false
    sparseNote.textContent =
      'Weinig data — je hebt minder dan twee volledige maanden geüpload. ' +
      'Alle staven tonen de werkelijke data, niet een prognose.'
  } else {
    sparseNote.hidden = true
    sparseNote.textContent = ''
  }
}

// ---------------------------------------------------------------------------
// uPlot data + chart construction
// ---------------------------------------------------------------------------

/**
 * Build AlignedData for the grouped-bar chart.
 * data[0] = month ordinal indices [0, 1, ..., N-1]
 * data[1..M] = per-battery shiftedKwh arrays for each month
 */
function buildBarData(allBuckets: MonthBucket[][]): uPlot.AlignedData {
  if (allBuckets.length === 0 || allBuckets[0].length === 0) {
    return [[]] as uPlot.AlignedData
  }
  const monthCount = allBuckets[0].length
  const xAxis = Array.from({ length: monthCount }, (_, i) => i)
  const seriesData: (number | null)[][] = allBuckets.map((buckets) =>
    buckets.map((b) => b.shiftedKwh)
  )
  return [xAxis, ...seriesData] as uPlot.AlignedData
}

/**
 * Build uPlot opts for the grouped-bar chart.
 * One bars() series per battery; each battery's bars are offset side-by-side
 * within the month slot via disp.x0/disp.size (uPlot does not auto-group).
 */
function buildBarOpts(
  batteries: BatteryConfig[],
  allBuckets: MonthBucket[][],
  containerWidth: number,
  wrapper: HTMLElement
): uPlot.Options {
  const orderedIds = batteries.map((b) => b.id)
  // Use first battery's buckets for month labels (all batteries share same months)
  const primaryBuckets = allBuckets[0] ?? []
  const monthLabels = primaryBuckets.map((b) => b.monthLabel)
  const monthCount = primaryBuckets.length

  // Solid per-battery colors (match the comparison-table legend swatches).
  const resolvedColors = batteries.map((b) => resolveBatteryColor(b.id, orderedIds))

  // Group geometry (data units): each battery gets an equal sub-slot.
  const n = Math.max(1, batteries.length)
  const subW = GROUP_W / n
  const barW = subW * (1 - INNER_GAP_FRAC)

  // Helper: a disp-facet values() that honours uPlot's [idx0..idx1] range.
  const rangeValues =
    <T>(fn: (k: number) => T) =>
    (_u: uPlot, _seriesIdx: number, idx0: number, idx1: number): T[] => {
      const out: T[] = []
      for (let k = idx0; k <= idx1; k++) out.push(fn(k))
      return out
    }

  // Build per-battery series
  const series: uPlot.Series[] = [
    {}, // x-axis placeholder (required by uPlot)
    ...batteries.map((battery, i) => {
      const buckets = allBuckets[i] ?? primaryBuckets
      const resolvedHex = resolvedColors[i]
      const fullColor = hexToRgba(resolvedHex, FULL_OPACITY)
      const partialColor = hexToRgba(resolvedHex, PARTIAL_OPACITY)
      // Left edge of this battery's bar within month-slot m (centered cluster).
      const x0For = (k: number) => k - GROUP_W / 2 + i * subW + (subW - barW) / 2

      // One bars() builder per battery: disp.x0 + disp.size group them
      // side-by-side; disp.fill applies isPartial opacity (Pattern 3b / D-05).
      const barsBuilder = uPlot.paths.bars!({
        align: 0,
        disp: {
          x0: { unit: 1, values: rangeValues(x0For) }, // ScaleValue: x data units
          size: { unit: 1, values: rangeValues(() => barW) },
          fill: {
            unit: 3, // raw CSS-color values, per data index
            values: rangeValues((k) => (buckets[k]?.isPartial ? partialColor : fullColor)),
          },
        },
      })

      return {
        label: battery.name, // used internally; actual legend is our DOM legend
        stroke: resolvedHex,
        fill: fullColor,
        paths: barsBuilder,
        points: { show: false },
        width: 1,
      } satisfies uPlot.Series
    }),
  ]

  // Hover tooltip: hovered month + every battery's value, hovered bar emphasised.
  const barTooltip = hoverTooltipPlugin(wrapper, (_u, _idx, xVal) => {
    if (monthCount === 0) return null
    const mi = Math.max(0, Math.min(monthCount - 1, Math.round(xVal)))
    // Which battery sub-slot is the pointer over? (data-space → slot index)
    const offsetInGroup = xVal - (mi - GROUP_W / 2)
    const emph = Math.max(0, Math.min(n - 1, Math.floor(offsetInGroup / subW)))
    return {
      title: monthLabels[mi] ?? '',
      rows: batteries.map((b, i) => ({
        label: b.name,
        value: formatKwh(allBuckets[i]?.[mi]?.shiftedKwh ?? 0),
        color: resolvedColors[i],
        emphasis: i === emph,
      })),
    }
  })

  return {
    width: containerWidth,
    height: CHART_HEIGHT,
    series,
    scales: {
      // Pad x so the outer half-bars of the first/last month aren't clipped.
      x: { range: () => [-0.5 - GROUP_W / 2, monthCount - 1 + 0.5 + GROUP_W / 2] },
    },
    axes: [
      {
        // x-axis: one tick per month, centered under each cluster (Pattern 3a)
        splits: () => Array.from({ length: monthCount }, (_v, i) => i),
        values: (_u: uPlot, splits: number[]) =>
          splits.map((i) => monthLabels[Math.round(i)] ?? ''),
      },
      {
        // y-axis: kWh ticks via formatAxisKwh (VIZ-04)
        values: (_u: uPlot, splits: number[]) => splits.map((v) => formatAxisKwh(v)),
        label: 'kWh',
      },
    ],
    legend: { show: false }, // We render our own DOM legend (CSP safety)
    cursor: { show: true }, // CSP-safe crosshair; drives the hover tooltip
    plugins: [barTooltip],
    padding: [8, 0, 0, 0],
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Mount the monthly self-consumption grouped-bar chart inside the given container.
 *
 * Returns a dispose function — call it when the UI is torn down to avoid effect leaks.
 * Follows the comparison-table.ts effect() pattern:
 * - Creates uPlot once; calls setData on signal update
 * - Destroys + recreates only when battery count changes
 * - ResizeObserver created once, guarded with `if (chart)`
 *
 * @param container - HTMLElement to mount the chart section into
 * @returns dispose function (the effect disposer + ResizeObserver disconnect)
 */
export function initMonthlyBarsChart(container: HTMLElement): () => void {
  let chart: uPlot | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  let lastBatteryCount = 0
  let domRefs: ReturnType<typeof buildSectionDOM> | null = null

  // ResizeObserver created ONCE — outside the effect (Pitfall 7 guard)
  const observer = new ResizeObserver(() => {
    if (chart && container.offsetWidth > 0) {
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        // Re-check: an empty-state transition during the debounce window can
        // null `chart`; the timer fires outside the effect's try/catch (CR-02).
        if (chart && container.offsetWidth > 0) {
          chart.setSize({ width: container.offsetWidth, height: CHART_HEIGHT })
        }
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
      // Cancel any in-flight resize debounce before dropping the chart (WR-04).
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer)
        resizeTimer = null
      }
      chart = null
      lastBatteryCount = 0
      domRefs = null
      return
    }

    try {
      // Build month buckets per battery (pure, node-safe)
      const allBuckets: MonthBucket[][] = results.map((result) => bucketByMonth(result.trace, ZONE))

      // Ensure DOM section exists
      if (!domRefs) {
        domRefs = buildSectionDOM(container)
      }

      const { chartWrapper, legend, partialLabelContainer, sparseNote } = domRefs

      // Update legend (battery names/swatches)
      buildLegend(legend, batteries)

      // Update partial labels and sparse note based on first battery's buckets
      const primaryBuckets = allBuckets[0] ?? []
      buildPartialLabels(partialLabelContainer, primaryBuckets)
      updateSparseNote(sparseNote, primaryBuckets)

      // Build chart data
      const data = buildBarData(allBuckets)
      const batteryCount = batteries.length

      if (chart && batteryCount === lastBatteryCount) {
        // Same structure: update data without recreating (Pattern 6)
        chart.setData(data)
      } else {
        // Battery count changed or first render: destroy + recreate (Pitfall 6)
        if (chart) {
          chart.destroy()
          chart = null
        }
        // Clear any previous uPlot canvas from the wrapper
        chartWrapper.innerHTML = ''
        const opts = buildBarOpts(
          batteries,
          allBuckets,
          chartWrapper.offsetWidth || 600,
          chartWrapper
        )
        chart = new uPlot(opts, data, chartWrapper)
        lastBatteryCount = batteryCount
      }
    } catch {
      // Error state (results-error CSS class — from comparison-table.ts pattern)
      container.innerHTML = ''
      const p = document.createElement('p')
      p.setAttribute('role', 'alert')
      p.className = 'results-error'
      p.textContent =
        'Grafiek kon niet worden geladen. Probeer een ander tijdvenster of herlaad de pagina.'
      container.appendChild(p)
      chart = null
      lastBatteryCount = 0
      domRefs = null
    }
  })

  // Return combined dispose function
  return () => {
    disposeEffect()
    observer.disconnect()
    if (resizeTimer !== null) clearTimeout(resizeTimer)
    if (chart) {
      chart.destroy()
      chart = null
    }
  }
}
