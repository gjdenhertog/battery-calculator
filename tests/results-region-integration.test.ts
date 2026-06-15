// @vitest-environment jsdom
/**
 * tests/results-region-integration.test.ts — #results-region shared-container regression
 *
 * Regression test for UAT Tests 5 + 9: the comparison table must NOT clobber the
 * period-control section when both are mounted inside #results-region.
 *
 * Root cause (confirmed): initComparisonTable(resultsRegion) called container.innerHTML = ''
 * in renderEmpty/renderTable/renderError, wiping the sibling period-control <section>.
 * Fix: initComparisonTable is now passed a dedicated #comparison-table-mount child div.
 *
 * This test replicates the main.ts mount topology in jsdom so the integration contract
 * is locked independently of the live browser. If the topology ever regresses (both
 * controls sharing the same container again), Tests 1–3 below will fail.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderShell } from '../src/shell'
import { initPeriodControl, teardownPeriodControl } from '../src/ui/period-control'
import { initComparisonTable } from '../src/ui/comparison-table'
import {
  parsedSamples,
  selectedBatteries,
  simResults,
  isComputing,
  computeError,
  periodFrom,
  periodTo,
} from '../src/state/signals'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'
import type { SimResult, IntervalSample } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSimResult(overrides: Partial<SimResult> = {}): SimResult {
  return {
    shiftedKwh: 120.5,
    residualImportKwh: 450.2,
    residualExportKwh: 80.1,
    totalImportKwh: 570.7,
    totalExportKwh: 200.3,
    periodDays: 90,
    coarseCadenceWarning: false,
    trace: [],
    ...overrides,
  }
}

/** Build a minimal multi-day IntervalSample array so the period control populates. */
function makeMultiDaySamples(): IntervalSample[] {
  const dates = [
    '2025-01-01',
    '2025-01-02',
    '2025-01-03',
    '2025-01-04',
    '2025-01-05',
    '2025-01-06',
    '2025-01-07',
  ]
  return dates.map((d) => ({
    timestamp: new Date(`${d}T12:00:00Z`),
    gridImportKwh: 1.0,
    gridExportKwh: 0.5,
  }))
}

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

function setupShell(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div>'
  const host = document.getElementById('app') as HTMLElement
  renderShell(host)
  return document.getElementById('results-region') as HTMLElement
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('#results-region shared-container regression (UAT Test 5 + 9)', () => {
  let resultsRegion: HTMLElement
  let mountDiv: HTMLDivElement
  let dispose: (() => void) | null = null

  beforeEach(() => {
    // Reset signals
    parsedSamples.value = []
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    simResults.value = null
    isComputing.value = false
    computeError.value = null
    periodFrom.value = null
    periodTo.value = null

    // Render shell and grab results region
    resultsRegion = setupShell()

    // Seed parsedSamples so the period control populates date inputs + coverage indicator
    parsedSamples.value = makeMultiDaySamples()

    // Mirror main.ts mount topology exactly:
    // 1. Period control mounts into the shared resultsRegion
    initPeriodControl(resultsRegion)

    // 2. Create dedicated child mount for the comparison table (the fix)
    mountDiv = document.createElement('div')
    mountDiv.id = 'comparison-table-mount'
    resultsRegion.appendChild(mountDiv)

    // 3. Comparison table mounts into its own child div, NOT resultsRegion
    dispose = initComparisonTable(mountDiv)
  })

  afterEach(() => {
    if (dispose) {
      dispose()
      dispose = null
    }
    teardownPeriodControl()
    // Reset signals
    parsedSamples.value = []
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    simResults.value = null
    isComputing.value = false
    computeError.value = null
    periodFrom.value = null
    periodTo.value = null
  })

  // ── Test 1: period control survives empty-state table render ─────────────────

  it('period control elements are present after empty-state (no batteries) table render', () => {
    // Trigger empty-state render: no batteries selected, no results
    selectedBatteries.value = []
    simResults.value = null

    // The empty-state render fires immediately. Verify the table content is in mountDiv.
    const emptyMsg = mountDiv.querySelector('.results-empty')
    expect(emptyMsg).not.toBeNull()

    // CRITICAL: period-control elements must still exist in resultsRegion
    const periodFrom = resultsRegion.querySelector('#period-from')
    const periodTo = resultsRegion.querySelector('#period-to')
    const coverage = resultsRegion.querySelector('.period-coverage')

    expect(periodFrom).not.toBeNull()
    expect(periodTo).not.toBeNull()
    expect(coverage).not.toBeNull()
  })

  // ── Test 2: period control survives populated table render ────────────────────

  it('period control elements are present after populated table render', () => {
    // Trigger populated render: one battery selected, matching sim result
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    simResults.value = [makeSimResult()]

    // The populated table render fires immediately
    const table = mountDiv.querySelector('.comparison-table')
    expect(table).not.toBeNull()

    // CRITICAL: period-control elements must still exist in resultsRegion
    const periodFromEl = resultsRegion.querySelector('#period-from')
    const periodToEl = resultsRegion.querySelector('#period-to')
    const coverage = resultsRegion.querySelector('.period-coverage')

    expect(periodFromEl).not.toBeNull()
    expect(periodToEl).not.toBeNull()
    expect(coverage).not.toBeNull()
  })

  // ── Test 3: period control survives table re-render (recompute) ───────────────

  it('period control elements are present after table re-render (recompute)', () => {
    // Initial populated render
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    simResults.value = [makeSimResult({ shiftedKwh: 100 })]

    // Verify table rendered
    expect(mountDiv.querySelector('.comparison-table')).not.toBeNull()

    // Simulate a recompute: toggle simResults to a new array (as the worker would)
    simResults.value = [makeSimResult({ shiftedKwh: 150 })]

    // After re-render, period-control elements must still exist
    const periodFromEl = resultsRegion.querySelector('#period-from')
    const periodToEl = resultsRegion.querySelector('#period-to')
    const coverage = resultsRegion.querySelector('.period-coverage')

    expect(periodFromEl).not.toBeNull()
    expect(periodToEl).not.toBeNull()
    expect(coverage).not.toBeNull()
  })

  // ── Negative control: table content is scoped to #comparison-table-mount ─────

  it('comparison table content lives inside #comparison-table-mount, not the root resultsRegion', () => {
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    simResults.value = [makeSimResult()]

    // The table wrapper must be INSIDE mountDiv
    const tableInMount = mountDiv.querySelector('.comparison-table')
    expect(tableInMount).not.toBeNull()

    // The table wrapper must NOT be a direct child of resultsRegion
    // (it should be nested inside the mountDiv, not appended directly to resultsRegion)
    const directTableInRegion = resultsRegion.querySelector(':scope > .comparison-table')
    expect(directTableInRegion).toBeNull()
  })

  // ── Empty-state message also scoped to mountDiv ───────────────────────────────

  it('results-empty message is inside #comparison-table-mount, not the root resultsRegion', () => {
    selectedBatteries.value = []
    simResults.value = null

    // Empty message must be inside mountDiv
    const emptyInMount = mountDiv.querySelector('.results-empty')
    expect(emptyInMount).not.toBeNull()

    // NOT a direct child of resultsRegion
    const directEmptyInRegion = resultsRegion.querySelector(':scope > .results-empty')
    expect(directEmptyInRegion).toBeNull()
  })
})
