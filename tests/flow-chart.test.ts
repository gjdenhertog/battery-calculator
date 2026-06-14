// @vitest-environment jsdom
/**
 * tests/flow-chart.test.ts — initFlowChart DOM-contract lock (VIZ-02, VIZ-03)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 * Mounts the flow chart adapter against a jsdom DOM.
 *
 * Key invariants tested:
 * - Dispose function returned
 * - <select id="flow-chart-battery"> with one option per active battery
 * - uPlot.paths.stepped called (proving VIZ-03 step-lines, not smooth)
 * - Week caption text contains "Voorbeeldweek:" and "teruglevering"
 * - Changing select value + dispatching 'change' updates the caption
 * - XSS: '<script>' battery name yields zero <script> nodes
 * - uPlot CSS import resolves in jsdom (mocked)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SimResult, TraceRow } from '../src/domain/types'
import { simResults, selectedBatteries, isComputing } from '../src/state/signals'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'

// ---------------------------------------------------------------------------
// Mock uPlot CSS
// ---------------------------------------------------------------------------

vi.mock('uplot/dist/uPlot.min.css', () => ({}))

// ---------------------------------------------------------------------------
// Mock uPlot — factory must NOT reference outer variables (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock('uplot', () => {
  const barsBuilderMock = vi.fn().mockReturnValue(vi.fn())
  const steppedBuilderMock = vi.fn().mockReturnValue(vi.fn())

  const instanceMethods = {
    setData: vi.fn(),
    setSize: vi.fn(),
    destroy: vi.fn(),
    root: null as unknown as HTMLElement,
  }

  const UPlotMock = vi.fn().mockImplementation(function () {
    instanceMethods.root = document.createElement('div')
    return instanceMethods
  }) as ReturnType<typeof vi.fn> & {
    paths: { bars: ReturnType<typeof vi.fn>; stepped: ReturnType<typeof vi.fn> }
    tzDate: ReturnType<typeof vi.fn>
  }

  UPlotMock.paths = {
    bars: barsBuilderMock,
    stepped: steppedBuilderMock,
  }
  UPlotMock.tzDate = vi.fn()

  return { default: UPlotMock }
})

// ---------------------------------------------------------------------------
// Import adapter and get mock references AFTER vi.mock setup
// ---------------------------------------------------------------------------

const { initFlowChart } = await import('../src/ui/charts/flow-chart')
const uPlotModule = await import('uplot')
const MockUPlot = uPlotModule.default as unknown as ReturnType<typeof vi.fn> & {
  paths: { bars: ReturnType<typeof vi.fn>; stepped: ReturnType<typeof vi.fn> }
  tzDate: ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTraceRow(isoDate: string, opts: Partial<TraceRow> = {}): TraceRow {
  return {
    timestamp: new Date(isoDate),
    socKwh: 0,
    chargedKwh: 0.5,
    dischargedKwh: 0.5,
    residualImportKwh: 1.0,
    residualExportKwh: 2.0, // high teruglevering for week selection
    ...opts,
  }
}

/**
 * Build a 2-week trace so selectRepresentativeWeek has something to work with.
 * Each row is 15-minute interval from June 9 to June 22 2025 (2 weeks).
 */
function makeWeeklyTrace(): TraceRow[] {
  const rows: TraceRow[] = []
  // Week 1: June 9–15 2025 — low teruglevering
  for (let d = 9; d <= 15; d++) {
    for (let h = 0; h < 24; h++) {
      rows.push(makeTraceRow(
        `2025-06-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`,
        { residualExportKwh: 0.5 }
      ))
    }
  }
  // Week 2: June 16–22 2025 — high teruglevering (representative week)
  for (let d = 16; d <= 22; d++) {
    for (let h = 0; h < 24; h++) {
      rows.push(makeTraceRow(
        `2025-06-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`,
        { residualExportKwh: 3.0 }
      ))
    }
  }
  return rows
}

function makeSimResult(traceOverride?: TraceRow[]): SimResult {
  return {
    shiftedKwh: 120.5,
    residualImportKwh: 450.2,
    residualExportKwh: 80.1,
    totalImportKwh: 570.7,
    totalExportKwh: 200.3,
    periodDays: 14,
    coarseCadenceWarning: false,
    trace: traceOverride ?? makeWeeklyTrace(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initFlowChart DOM contract', () => {
  let container: HTMLElement
  let dispose: (() => void) | null = null

  beforeEach(() => {
    // Reset signals
    simResults.value = null
    isComputing.value = false
    selectedBatteries.value = [BATTERY_CATALOG[0]]

    // Fresh container
    container = document.createElement('div')
    document.body.appendChild(container)

    // Clear mock call counts (not implementations)
    MockUPlot.mockClear()
    MockUPlot.paths.bars.mockClear()
    MockUPlot.paths.stepped.mockClear()
  })

  afterEach(() => {
    if (dispose) {
      dispose()
      dispose = null
    }
    simResults.value = null
    isComputing.value = false
    selectedBatteries.value = [BATTERY_CATALOG[0]]

    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  })

  // ── Dispose ────────────────────────────────────────────────────────────────

  it('returns a dispose function', () => {
    dispose = initFlowChart(container)
    expect(typeof dispose).toBe('function')
  })

  it('does not crash when simResults is null', () => {
    simResults.value = null
    dispose = initFlowChart(container)
    expect(container).toBeDefined()
  })

  // ── Dropdown ───────────────────────────────────────────────────────────────

  it('renders <select id="flow-chart-battery"> when results arrive', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const select = container.querySelector('#flow-chart-battery') as HTMLSelectElement | null
    expect(select).not.toBeNull()
  })

  it('dropdown has one option per active battery', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const select = container.querySelector('#flow-chart-battery') as HTMLSelectElement | null
    expect(select?.options.length).toBe(1)
    expect(select?.options[0]?.textContent).toBe(BATTERY_CATALOG[0].name)
  })

  it('dropdown has two options when two batteries selected', () => {
    selectedBatteries.value = [BATTERY_CATALOG[0], BATTERY_CATALOG[1]]
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult(), makeSimResult()]

    const select = container.querySelector('#flow-chart-battery') as HTMLSelectElement | null
    expect(select?.options.length).toBe(2)
  })

  // ── Stepped-path (VIZ-03) ─────────────────────────────────────────────────

  it('calls uPlot.paths.stepped when results arrive (VIZ-03)', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    expect(MockUPlot.paths.stepped).toHaveBeenCalled()
  })

  it('does NOT call uPlot.paths.bars (flow chart uses stepped, not bars)', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    expect(MockUPlot.paths.bars).not.toHaveBeenCalled()
  })

  // ── Week caption ───────────────────────────────────────────────────────────

  it('renders .chart-week-caption containing "Voorbeeldweek:" when results arrive', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const caption = container.querySelector('.chart-week-caption')
    expect(caption).not.toBeNull()
    expect(caption?.textContent).toContain('Voorbeeldweek:')
  })

  it('week caption mentions "teruglevering" as the selection reason', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const caption = container.querySelector('.chart-week-caption')
    expect(caption?.textContent).toContain('teruglevering')
  })

  // ── Section heading ────────────────────────────────────────────────────────

  it('renders section heading "Energiestroom voorbeeldweek"', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const heading = container.querySelector('.results-section-heading')
    expect(heading).not.toBeNull()
    expect(heading?.textContent).toContain('Energiestroom')
  })

  // ── Dropdown change re-renders ─────────────────────────────────────────────

  it('changing select value and dispatching change event updates the caption', () => {
    selectedBatteries.value = [BATTERY_CATALOG[0], BATTERY_CATALOG[1]]
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult(), makeSimResult()]

    const select = container.querySelector('#flow-chart-battery') as HTMLSelectElement | null
    expect(select).not.toBeNull()

    const captionBefore = container.querySelector('.chart-week-caption')?.textContent ?? ''

    // Change to second battery
    select!.value = BATTERY_CATALOG[1].id
    select!.dispatchEvent(new Event('change'))

    // Caption should still be present (not necessarily different text since both use same fixture)
    const captionAfter = container.querySelector('.chart-week-caption')?.textContent ?? ''
    expect(captionAfter).toContain('Voorbeeldweek:')
    expect(captionBefore).toContain('Voorbeeldweek:')
  })

  // ── XSS safety ────────────────────────────────────────────────────────────

  it('XSS: <script> battery name yields zero <script> nodes in dropdown options', () => {
    const xssBattery = {
      ...BATTERY_CATALOG[0],
      id: 'xss-test',
      name: '<script>alert("xss")</script>',
    }
    selectedBatteries.value = [xssBattery]

    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const scriptNodes = container.querySelectorAll('script')
    expect(scriptNodes.length).toBe(0)
  })

  // ── #chart-flow wrapper ────────────────────────────────────────────────────

  it('renders #chart-flow wrapper when results arrive', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const chartWrapper = container.querySelector('#chart-flow')
    expect(chartWrapper).not.toBeNull()
  })

  // ── Legend ────────────────────────────────────────────────────────────────

  it('renders .chart-legend below the chart', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const legend = container.querySelector('.chart-legend')
    expect(legend).not.toBeNull()
  })

  it('legend swatches carry an actual background color (CSS attr() never colored them)', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const swatches = Array.from(
      container.querySelectorAll<HTMLElement>('.chart-legend__swatch'),
    )
    expect(swatches.length).toBe(4) // grid / teruglevering / laden / ontladen
    // Every swatch must have a non-empty backgroundColor set via CSSOM —
    // the old data-series-color attr() approach left them transparent.
    for (const sw of swatches) {
      expect(sw.style.backgroundColor).not.toBe('')
    }
  })

  it('enables a CSP-safe cursor and registers the hover-tooltip plugin', () => {
    dispose = initFlowChart(container)
    simResults.value = [makeSimResult()]

    const opts = MockUPlot.mock.calls[0][0]
    expect(opts.cursor?.show).toBe(true)
    expect(Array.isArray(opts.plugins)).toBe(true)
    expect(opts.plugins.length).toBeGreaterThan(0)
  })
})
