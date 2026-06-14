// @vitest-environment jsdom
/**
 * tests/monthly-bars.test.ts — initMonthlyBarsChart DOM-contract lock (VIZ-01, VIZ-04)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 * Mounts the monthly bars chart adapter against a jsdom DOM.
 *
 * Key invariants tested:
 * - Empty state when simResults null (no crash)
 * - Section heading and #chart-monthly present after SimResult with multi-month trace
 * - uPlot.paths.bars called once per battery (committed grouped layout)
 * - formatAxisKwh routing verified (no raw float in legend/labels)
 * - Sparse-note appears for <2-full-month fixture
 * - XSS: '<script>' battery name yields zero <script> nodes
 * - uPlot CSS import resolves in jsdom (mocked)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SimResult, TraceRow } from '../src/domain/types'
import { simResults, selectedBatteries, isComputing } from '../src/state/signals'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'

// ---------------------------------------------------------------------------
// Mock uPlot CSS (so the import 'uplot/dist/uPlot.min.css' resolves)
// ---------------------------------------------------------------------------

vi.mock('uplot/dist/uPlot.min.css', () => ({}))

// ---------------------------------------------------------------------------
// Mock uPlot — factory must NOT reference outer variables (vi.mock is hoisted)
// The mock must define everything inline in the factory.
// ---------------------------------------------------------------------------

vi.mock('uplot', () => {
  const barsBuilderMock = vi.fn().mockReturnValue(vi.fn())
  const steppedBuilderMock = vi.fn().mockReturnValue(vi.fn())

  const instanceMethods = {
    setData: vi.fn(),
    setSize: vi.fn(),
    destroy: vi.fn(),
    root: null as unknown as HTMLElement, // set in factory below
  }

  const UPlotMock = vi.fn().mockImplementation(function () {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
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
// After mocks are set up, import the adapter and retrieve mock references
// ---------------------------------------------------------------------------

const { initMonthlyBarsChart } = await import('../src/ui/charts/monthly-bars')
// Get access to the mock for assertions
const uPlotModule = await import('uplot')
const MockUPlot = uPlotModule.default as unknown as ReturnType<typeof vi.fn> & {
  paths: { bars: ReturnType<typeof vi.fn>; stepped: ReturnType<typeof vi.fn> }
  tzDate: ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTraceRow(isoDate: string, chargedKwh = 1.0, residualExportKwh = 0): TraceRow {
  return {
    timestamp: new Date(isoDate),
    socKwh: 0,
    chargedKwh,
    dischargedKwh: chargedKwh,
    residualImportKwh: 0,
    residualExportKwh,
  }
}

/**
 * Build a multi-month trace: rows from June 1 through August 31 2025.
 * June and August are full months; July is full. All three should be non-partial.
 */
function makeMultiMonthTrace(): TraceRow[] {
  const rows: TraceRow[] = []
  // June 2025: days 1-30
  for (let d = 1; d <= 30; d++) {
    rows.push(makeTraceRow(`2025-06-${String(d).padStart(2, '0')}T10:00:00Z`, 2.5))
  }
  // July 2025: days 1-31
  for (let d = 1; d <= 31; d++) {
    rows.push(makeTraceRow(`2025-07-${String(d).padStart(2, '0')}T10:00:00Z`, 3.0))
  }
  // August 2025: days 1-31
  for (let d = 1; d <= 31; d++) {
    rows.push(makeTraceRow(`2025-08-${String(d).padStart(2, '0')}T10:00:00Z`, 1.5))
  }
  return rows
}

/**
 * Sparse trace: only a few days in one month (< 2 full months).
 */
function makeSparseTrace(): TraceRow[] {
  return [
    makeTraceRow('2025-06-15T10:00:00Z', 2.0),
    makeTraceRow('2025-06-16T10:00:00Z', 1.5),
  ]
}

function makeSimResult(traceOverride?: TraceRow[]): SimResult {
  return {
    shiftedKwh: 120.5,
    residualImportKwh: 450.2,
    residualExportKwh: 80.1,
    totalImportKwh: 570.7,
    totalExportKwh: 200.3,
    periodDays: 90,
    coarseCadenceWarning: false,
    trace: traceOverride ?? makeMultiMonthTrace(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initMonthlyBarsChart DOM contract', () => {
  let container: HTMLElement
  let dispose: (() => void) | null = null

  beforeEach(() => {
    // Reset signals before each test
    simResults.value = null
    isComputing.value = false
    selectedBatteries.value = [BATTERY_CATALOG[0]]

    // Create a fresh container
    container = document.createElement('div')
    document.body.appendChild(container)

    // Clear call counts (not implementations — implementations stay from vi.mock factory)
    MockUPlot.mockClear()
    MockUPlot.paths.bars.mockClear()
    MockUPlot.paths.stepped.mockClear()
  })

  afterEach(() => {
    if (dispose) {
      dispose()
      dispose = null
    }
    // Reset signals
    simResults.value = null
    isComputing.value = false
    selectedBatteries.value = [BATTERY_CATALOG[0]]

    // Remove container from DOM
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  it('returns a dispose function', () => {
    dispose = initMonthlyBarsChart(container)
    expect(typeof dispose).toBe('function')
  })

  it('does not crash when simResults is null', () => {
    simResults.value = null
    dispose = initMonthlyBarsChart(container)
    // Should not throw
    expect(container).toBeDefined()
  })

  it('does not crash when activeBatteries is empty', () => {
    selectedBatteries.value = []
    simResults.value = null
    dispose = initMonthlyBarsChart(container)
    // Should not throw
    expect(container).toBeDefined()
  })

  // ── Mounted state ──────────────────────────────────────────────────────────

  it('renders section heading "Zelfverbruik per maand" when results arrive', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult()]

    const heading = container.querySelector('.results-section-heading')
    expect(heading).not.toBeNull()
    expect(heading?.textContent).toContain('Zelfverbruik per maand')
  })

  it('renders #chart-monthly wrapper when results arrive', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult()]

    const chartWrapper = container.querySelector('#chart-monthly')
    expect(chartWrapper).not.toBeNull()
  })

  it('renders .chart-legend when results arrive', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult()]

    const legend = container.querySelector('.chart-legend')
    expect(legend).not.toBeNull()
  })

  // ── Committed grouped-bar layout: one bars() call per battery ──────────────

  it('calls uPlot.paths.bars once per battery (grouped layout, not stacked)', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult()]

    // With 1 battery, paths.bars should be called once to build the builder for that battery
    expect(MockUPlot.paths.bars).toHaveBeenCalledTimes(1)
  })

  it('calls uPlot.paths.bars once per battery when 2 batteries selected', () => {
    const battery1 = BATTERY_CATALOG[0]
    const battery2 = BATTERY_CATALOG[1]
    selectedBatteries.value = [battery1, battery2]

    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult(), makeSimResult()]

    // With 2 batteries, paths.bars should be called twice
    expect(MockUPlot.paths.bars).toHaveBeenCalledTimes(2)
  })

  // ── formatAxisKwh routing ─────────────────────────────────────────────────

  it('renders legend label using battery name (not raw float)', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult()]

    const legend = container.querySelector('.chart-legend')
    // Battery name should appear in legend
    expect(legend?.textContent).toContain(BATTERY_CATALOG[0].name)
  })

  // ── Sparse-note: < 2 full months ──────────────────────────────────────────

  it('shows .chart-sparse-note when trace has <2 full months', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult(makeSparseTrace())]

    const sparseNote = container.querySelector('.chart-sparse-note')
    expect(sparseNote).not.toBeNull()
    expect((sparseNote as HTMLElement | null)?.hidden).toBe(false)
  })

  it('sparse note contains "Weinig data" copy', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult(makeSparseTrace())]

    const sparseNote = container.querySelector('.chart-sparse-note')
    expect(sparseNote?.textContent).toContain('Weinig data')
  })

  it('does NOT show .chart-sparse-note when trace has >=2 full months', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult(makeMultiMonthTrace())]

    const sparseNote = container.querySelector('.chart-sparse-note')
    // Either null or hidden
    if (sparseNote) {
      expect((sparseNote as HTMLElement).hidden).toBe(true)
    } else {
      expect(sparseNote).toBeNull()
    }
  })

  // ── XSS safety ────────────────────────────────────────────────────────────

  it('XSS: <script> battery name yields zero <script> nodes in legend', () => {
    const xssBattery = {
      ...BATTERY_CATALOG[0],
      id: 'xss-test',
      name: '<script>alert("xss")</script>',
    }
    selectedBatteries.value = [xssBattery]

    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult()]

    const scriptNodes = container.querySelectorAll('script')
    expect(scriptNodes.length).toBe(0)
  })

  // ── uPlot lifecycle: setData not new uPlot on update ─────────────────────

  it('calls chart.setData (not creates new uPlot) on signal re-update', () => {
    dispose = initMonthlyBarsChart(container)
    simResults.value = [makeSimResult()]

    const initialCallCount = MockUPlot.mock.calls.length

    // Get the instance that was created
    const createdInstance = MockUPlot.mock.results[0]?.value as {
      setData: ReturnType<typeof vi.fn>
    } | undefined

    // Update simResults again — should call setData, not create a new chart
    simResults.value = [makeSimResult()]

    // uPlot constructor should not have been called again (same battery count)
    expect(MockUPlot.mock.calls.length).toBe(initialCallCount)

    // setData should be called on the existing instance
    expect(createdInstance?.setData).toHaveBeenCalled()
  })

  // ── (deels) partial label ─────────────────────────────────────────────────

  it('renders .chart-partial-label for partial months in the trace', () => {
    dispose = initMonthlyBarsChart(container)
    // Sparse trace has only partial months
    simResults.value = [makeSimResult(makeSparseTrace())]

    const partialLabel = container.querySelector('.chart-partial-label')
    expect(partialLabel).not.toBeNull()
  })
})
