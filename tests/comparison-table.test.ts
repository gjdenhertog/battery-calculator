// @vitest-environment jsdom
/**
 * tests/comparison-table.test.ts — initComparisonTable DOM-contract lock
 * (COMP-01..08, D-02, D-08, D-11, D-12, D-13, D-14, SIM-08, T-04-13..T-04-16)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 * Mounts the comparison table against a real jsdom DOM seeded with the Phase 1 shell.
 *
 * Key invariants tested:
 * - "zonder saldering" header precedes "met saldering" in DOM order (COMP-02)
 * - Both saldering columns are ALWAYS present simultaneously — no toggle (COMP-05)
 * - Per-column leader gets .table-cell--leader (COMP-03, D-11)
 * - avoidedOn ≤ 0 renders as-is with .table-cell--negative, never floored (D-02)
 * - Saldering disclaimer hidden by default; "i" button toggles it (COMP-06)
 * - No "/jaar" or "/maand" string in results DOM (COMP-07)
 * - Coarse-cadence banner rendered when coarseCadenceWarning is true (D-13)
 * - XSS: script-laden battery name yields zero <script> elements (T-04-13)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderShell } from '../src/shell'
import { initComparisonTable } from '../src/ui/comparison-table'
import {
  simResults,
  selectedBatteries,
  isComputing,
  computeError,
  salderingOn,
} from '../src/state/signals'
import { BATTERY_CATALOG } from '../src/domain/battery-catalog'
import type { SimResult, BatteryConfig } from '../src/domain/types'

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

function makeBattery(overrides: Partial<BatteryConfig> = {}): BatteryConfig {
  return {
    id: 'sessy-5',
    name: 'Sessy 5 kWh',
    nominalCapacityKwh: 5,
    dodFraction: 1.0,
    roundTripEfficiency: 0.85,
    maxChargeKw: 2.2,
    maxDischargeKw: 1.7,
    datasheetUrl: 'https://example.com',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// DOM setup
// ---------------------------------------------------------------------------

function setupResultsRegion(): HTMLElement {
  document.body.innerHTML = '<div id="app"></div>'
  const host = document.getElementById('app') as HTMLElement
  renderShell(host)
  return document.getElementById('results-region') as HTMLElement
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initComparisonTable DOM contract', () => {
  let container: HTMLElement
  let dispose: (() => void) | null = null

  beforeEach(() => {
    // Reset signals to a clean state before each test
    simResults.value = null
    isComputing.value = false
    computeError.value = null
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    salderingOn.value = false

    container = setupResultsRegion()
    dispose = initComparisonTable(container)
  })

  afterEach(() => {
    if (dispose) {
      dispose()
      dispose = null
    }
    // Clean up signals
    simResults.value = null
    isComputing.value = false
    computeError.value = null
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    salderingOn.value = false
  })

  // ── COMP-02: "zonder saldering" PRECEDES "met saldering" in DOM ────────────

  it('renders "zonder saldering" header before "met saldering" in DOM order when ON (COMP-02)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const headers = Array.from(container.querySelectorAll('th'))
    const zonderIdx = headers.findIndex((th) => th.textContent?.includes('zonder saldering'))
    const metIdx = headers.findIndex((th) => th.textContent?.includes('met saldering'))

    expect(zonderIdx).toBeGreaterThanOrEqual(0)
    expect(metIdx).toBeGreaterThanOrEqual(0)
    expect(zonderIdx).toBeLessThan(metIdx)
  })

  // ── COMP-05: single column when OFF; pair when ON (D-07 default OFF) ──────

  it('shows single column (no zonder/met sub-labels) when salderingOn is false (COMP-05 / D-07)', () => {
    // salderingOn.value = false (default from beforeEach)
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const headers = container.querySelectorAll('th')
    const headerTexts = Array.from(headers).map((th) => th.textContent ?? '')
    // OFF: NO zonder/met sub-labels
    expect(headerTexts.some((t) => t.includes('zonder saldering'))).toBe(false)
    expect(headerTexts.some((t) => t.includes('met saldering'))).toBe(false)
    // Single group header still present
    expect(headerTexts.some((t) => t.includes('kWh netto-import vermeden'))).toBe(true)
  })

  it('shows both saldering columns simultaneously when salderingOn is true (COMP-05 / D-07)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const headers = container.querySelectorAll('th')
    const headerTexts = Array.from(headers).map((th) => th.textContent ?? '')
    expect(headerTexts.some((t) => t.includes('zonder saldering'))).toBe(true)
    expect(headerTexts.some((t) => t.includes('met saldering'))).toBe(true)
  })

  // ── COMP-03 + D-11: per-column leader gets .table-cell--leader ─────────────

  it('the battery with the highest avoidedOff has .table-cell--leader in that column (COMP-03)', () => {
    // Two batteries: battery B has higher shiftedKwh (= avoidedOff)
    const batteryA = makeBattery({ id: 'battery-a', name: 'Battery A', nominalCapacityKwh: 5 })
    const batteryB = makeBattery({ id: 'battery-b', name: 'Battery B', nominalCapacityKwh: 10 })
    const resultA = makeSimResult({ shiftedKwh: 100 })
    const resultB = makeSimResult({ shiftedKwh: 200 })

    selectedBatteries.value = [batteryA, batteryB]
    simResults.value = [resultA, resultB]

    const rows = container.querySelectorAll('.battery-row')
    expect(rows.length).toBe(2)

    // Battery B (index 1) should be the leader for avoidedOff
    const rowB = rows[1]
    const avoidedOffCells = rowB.querySelectorAll('[data-metric="avoidedOff"]')
    expect(avoidedOffCells.length).toBeGreaterThan(0)
    expect(avoidedOffCells[0].classList.contains('table-cell--leader')).toBe(true)
  })

  // ── D-02: avoidedOn ≤ 0 renders as-is with .table-cell--negative ──────────

  it('renders avoidedOn ≤ 0 with .table-cell--negative and shows the actual value (D-02)', () => {
    // Saldering must be ON to show the avoidedOn column at all (D-07/D-08)
    salderingOn.value = true

    // Construct a result where avoidedWithSaldering is negative:
    // baseline net = max(0, totalImport - totalExport) = max(0, 100 - 200) = 0
    // battery net  = max(0, residualImport - residualExport) = max(0, 50 - 10) = 40
    // avoidedOn = 0 - 40 = -40 (negative)
    const battery = makeBattery()
    const result = makeSimResult({
      totalImportKwh: 100,
      totalExportKwh: 200,
      residualImportKwh: 50,
      residualExportKwh: 10,
      shiftedKwh: 50,
    })

    selectedBatteries.value = [battery]
    simResults.value = [result]

    const negativeCells = container.querySelectorAll('.table-cell--negative')
    expect(negativeCells.length).toBeGreaterThan(0)

    // The value must NOT be "0.0 kWh" — it must show the actual negative value
    // Query td specifically (th also has data-metric="avoidedOn" for the column header)
    const avoidedOnCell = container.querySelector('td[data-metric="avoidedOn"]')
    expect(avoidedOnCell).not.toBeNull()
    // The cell text should not be "0.0 kWh" (not floored)
    expect(avoidedOnCell?.textContent).not.toBe('0.0 kWh')
    // The cell text should contain a minus sign (U+2212 or regular -)
    expect(avoidedOnCell?.textContent).toMatch(/[−-]/)
  })

  // ── COMP-06: disclaimer shown (hidden by default) when ON; "i" button toggles ─

  it('saldering disclaimer is present and hidden by default when salderingOn is true (COMP-06)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const disclaimer = container.querySelector('#saldering-disclaimer') as HTMLElement | null
    expect(disclaimer).not.toBeNull()
    expect(disclaimer?.hidden).toBe(true)
  })

  it('clicking the "i" button removes hidden from the disclaimer (COMP-06)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const btn = container.querySelector('.saldering-info-btn') as HTMLButtonElement | null
    expect(btn).not.toBeNull()

    const disclaimer = container.querySelector('#saldering-disclaimer') as HTMLElement | null
    expect(disclaimer?.hidden).toBe(true)

    btn?.click()
    expect(disclaimer?.hidden).toBe(false)
    expect(btn?.getAttribute('aria-expanded')).toBe('true')
  })

  it('clicking the "i" button again re-hides the disclaimer (COMP-06)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const btn = container.querySelector('.saldering-info-btn') as HTMLButtonElement | null
    btn?.click() // open
    btn?.click() // close
    const disclaimer = container.querySelector('#saldering-disclaimer') as HTMLElement | null
    expect(disclaimer?.hidden).toBe(true)
    expect(btn?.getAttribute('aria-expanded')).toBe('false')
  })

  // ── COMP-07: no "/jaar" or "/maand" in results DOM ────────────────────────

  it('container textContent contains neither "/jaar" nor "/maand" (COMP-07)', () => {
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    expect(container.textContent).not.toContain('/jaar')
    expect(container.textContent).not.toContain('/maand')
  })

  // ── D-13: coarse-cadence banner present when coarseCadenceWarning is true ──

  it('renders .cadence-banner above the table when coarseCadenceWarning is true (D-13)', () => {
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult({ coarseCadenceWarning: true })]

    const banner = container.querySelector('.cadence-banner')
    expect(banner).not.toBeNull()

    // Banner must be above (before) the table in the DOM
    const tableWrapper = container.querySelector('.table-scroll-wrapper')
    expect(tableWrapper).not.toBeNull()
    if (banner && tableWrapper) {
      const children = Array.from(container.children)
      const bannerIdx = children.indexOf(banner as HTMLElement)
      const tableIdx = children.indexOf(tableWrapper as HTMLElement)
      expect(bannerIdx).toBeLessThan(tableIdx)
    }
  })

  it('does NOT render .cadence-banner when coarseCadenceWarning is false (D-13)', () => {
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult({ coarseCadenceWarning: false })]

    const banner = container.querySelector('.cadence-banner')
    expect(banner).toBeNull()
  })

  // ── T-04-13: XSS — script-laden battery name yields zero <script> elements ─

  it('renders a <script>-laden battery name as inert text, not a live element (T-04-13)', () => {
    const maliciousName = '<script>alert("xss")</script>'
    const battery = makeBattery({ id: 'xss-battery', name: maliciousName })
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    // Must NOT create any executable <script> elements
    expect(container.querySelectorAll('script').length).toBe(0)

    // The raw string must appear as text content (inert)
    expect(container.textContent).toContain(maliciousName)
  })

  // ── SIM-08: compute-indicator and stale class while computing ─────────────

  it('shows .compute-indicator while isComputing is true (SIM-08)', () => {
    isComputing.value = true

    const indicator = container.querySelector('.compute-indicator')
    expect(indicator).not.toBeNull()
    expect(indicator?.textContent).toContain('Rekenen')
  })

  it('hides .compute-indicator when isComputing is false (SIM-08)', () => {
    isComputing.value = false

    const indicator = container.querySelector('.compute-indicator')
    expect(indicator).toBeNull()
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  it('renders .results-empty when no batteries are selected and no results', () => {
    selectedBatteries.value = []
    simResults.value = null

    const empty = container.querySelector('.results-empty')
    expect(empty).not.toBeNull()
    expect(empty?.textContent).toContain('batterij')
  })

  // ── Error state ────────────────────────────────────────────────────────────

  it('renders .results-error with role="alert" when computeError is set', () => {
    computeError.value = 'Berekening mislukt.'

    const errorEl = container.querySelector('.results-error')
    expect(errorEl).not.toBeNull()
    expect(errorEl?.getAttribute('role')).toBe('alert')
    expect(errorEl?.textContent).toContain('Berekening mislukt')
  })

  // ── Regression: transient results/batteries length mismatch must not crash ──
  //
  // Reproduces the race where activeBatteries grows to length 2 (via selectedBatteries
  // update) but simResults is still length 1 from the previous compute.  The effect
  // must not attempt to read results[1].shiftedKwh (undefined) — it must instead
  // keep the existing table and surface the compute indicator.

  it('does not throw when activeBatteries.length > simResults.length (transient mismatch)', () => {
    const batteryA = makeBattery({ id: 'batt-a', name: 'Battery A' })
    const batteryB = makeBattery({ id: 'batt-b', name: 'Battery B', nominalCapacityKwh: 10 })

    // Start with a valid 1-battery state so there is a prior stale table.
    selectedBatteries.value = [batteryA]
    simResults.value = [makeSimResult({ shiftedKwh: 100 })]

    // Sanity: prior state renders correctly.
    expect(container.querySelectorAll('.battery-row').length).toBe(1)

    // Now simulate the race: grow selectedBatteries to 2 but leave simResults at length 1.
    // In production this triggers a recompute that has NOT landed yet.
    expect(() => {
      selectedBatteries.value = [batteryA, batteryB]
      // simResults still has length 1 — the effect fires here with mismatched lengths.
    }).not.toThrow()

    // The container must NOT have rendered a second battery row backed by undefined data.
    // It must either keep the prior 1-row table or show the compute indicator.
    const rows = container.querySelectorAll('.battery-row')
    // At most 1 row (the stale prior table) — never 2 rows with undefined result.
    expect(rows.length).toBeLessThanOrEqual(1)

    // The compute indicator must be visible (pending state signalled to the user).
    const indicator = container.querySelector('.compute-indicator')
    expect(indicator).not.toBeNull()
  })

  it('renders two battery rows once simResults catches up to 2 (mismatch resolved)', () => {
    const batteryA = makeBattery({ id: 'batt-a', name: 'Battery A' })
    const batteryB = makeBattery({ id: 'batt-b', name: 'Battery B', nominalCapacityKwh: 10 })

    // Start in the mismatched state.
    selectedBatteries.value = [batteryA, batteryB]
    simResults.value = [makeSimResult({ shiftedKwh: 100 })] // length 1 — mismatch

    // Now the recompute lands: simResults grows to match activeBatteries.
    simResults.value = [makeSimResult({ shiftedKwh: 100 }), makeSimResult({ shiftedKwh: 200 })]

    // Both rows must now be rendered without error.
    const rows = container.querySelectorAll('.battery-row')
    expect(rows.length).toBe(2)

    // No compute indicator should remain (computing is false in test env).
    const indicator = container.querySelector('.compute-indicator')
    expect(indicator).toBeNull()
  })

  // ── T-04-14: no inline style assignments (grep gate asserted separately)

  it('contains no element with inline style attribute (T-04-14)', () => {
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const allElements = container.querySelectorAll('[style]')
    expect(allElements.length).toBe(0)
  })

  // ── Leader on avoidedOff in OFF mode applies correctly ─────────────────────

  it('leader highlight lands on avoidedOff column when salderingOn is false (D-07)', () => {
    // salderingOn.value = false (default from beforeEach)
    const batteryA = makeBattery({ id: 'batt-a', name: 'Battery A', nominalCapacityKwh: 5 })
    const batteryB = makeBattery({ id: 'batt-b', name: 'Battery B', nominalCapacityKwh: 10 })
    const resultA = makeSimResult({ shiftedKwh: 100 })
    const resultB = makeSimResult({ shiftedKwh: 200 })

    selectedBatteries.value = [batteryA, batteryB]
    simResults.value = [resultA, resultB]

    // Battery B (index 1) should be leader for avoidedOff
    const rows = container.querySelectorAll('.battery-row')
    expect(rows.length).toBe(2)

    const rowB = rows[1]
    const avoidedOffCell = rowB.querySelector('[data-metric="avoidedOff"]')
    expect(avoidedOffCell).not.toBeNull()
    expect(avoidedOffCell?.classList.contains('table-cell--leader')).toBe(true)

    // No avoidedOn cells when OFF
    const avoidedOnCell = container.querySelector('td[data-metric="avoidedOn"]')
    expect(avoidedOnCell).toBeNull()
  })

  // ── Content lock: SALDERING_DISCLAIMER_COPY is factually correct (UAT Test 7) ──
  //
  // Saldering is 100% t/m 2026 and abolished fully on 2027-01-01.
  // The rejected "64% afbouw vanaf 2026" proposal never took effect — it must NOT appear.

  it('disclaimer text mentions "2027" and does NOT contain stale "64%" copy (UAT Test 7)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const disclaimer = container.querySelector('#saldering-disclaimer')
    expect(disclaimer).not.toBeNull()

    const text = disclaimer?.textContent ?? ''
    // Must reference the actual abolition year
    expect(text).toContain('2027')
    // Must NOT contain the stale "64%" rejected-proposal copy
    expect(text).not.toContain('64%')
  })
})

// ---------------------------------------------------------------------------
// Saldering toggle (D-06..D-08)
// ---------------------------------------------------------------------------

describe('saldering toggle (D-06..D-08)', () => {
  let container: HTMLElement
  let dispose: (() => void) | null = null

  beforeEach(() => {
    simResults.value = null
    isComputing.value = false
    computeError.value = null
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    salderingOn.value = false

    container = setupResultsRegion()
    dispose = initComparisonTable(container)
  })

  afterEach(() => {
    if (dispose) {
      dispose()
      dispose = null
    }
    simResults.value = null
    isComputing.value = false
    computeError.value = null
    selectedBatteries.value = [BATTERY_CATALOG[0]]
    salderingOn.value = false
  })

  // ── D-07: single column when OFF ──────────────────────────────────────────

  it('OFF: no #saldering-disclaimer in the DOM (D-08)', () => {
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    expect(container.querySelector('#saldering-disclaimer')).toBeNull()
  })

  it('OFF: no .saldering-info-btn in the DOM (D-08)', () => {
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    expect(container.querySelector('.saldering-info-btn')).toBeNull()
  })

  it('OFF: no .saldering-negative-note in the DOM (D-08)', () => {
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    // Use a negative avoidedOn result to confirm note is suppressed
    simResults.value = [
      makeSimResult({
        totalImportKwh: 100,
        totalExportKwh: 200,
        residualImportKwh: 50,
        residualExportKwh: 10,
        shiftedKwh: 50,
      }),
    ]

    expect(container.querySelector('.saldering-negative-note')).toBeNull()
  })

  it('OFF: only one td per row for the avoidedOff metric (no avoidedOn td) (D-07)', () => {
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    expect(container.querySelector('td[data-metric="avoidedOff"]')).not.toBeNull()
    expect(container.querySelector('td[data-metric="avoidedOn"]')).toBeNull()
  })

  // ── D-07 + D-08: ON path ─────────────────────────────────────────────────

  it('ON: shows zonder|met pair of headers (D-07)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    const headerTexts = Array.from(container.querySelectorAll('th')).map(
      (th) => th.textContent ?? ''
    )
    expect(headerTexts.some((t) => t.includes('zonder saldering'))).toBe(true)
    expect(headerTexts.some((t) => t.includes('met saldering'))).toBe(true)
  })

  it('ON: #saldering-disclaimer is present in the DOM (D-08)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    expect(container.querySelector('#saldering-disclaimer')).not.toBeNull()
  })

  it('ON: .saldering-negative-note appears when avoidedOn <= 0 (D-08)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    // Construct a result with negative avoidedOn
    simResults.value = [
      makeSimResult({
        totalImportKwh: 100,
        totalExportKwh: 200,
        residualImportKwh: 50,
        residualExportKwh: 10,
        shiftedKwh: 50,
      }),
    ]
    selectedBatteries.value = [battery]

    expect(container.querySelector('.saldering-negative-note')).not.toBeNull()
  })

  it('ON: .saldering-negative-note is absent when all avoidedOn > 0 (D-08)', () => {
    salderingOn.value = true
    const battery = makeBattery()
    // shiftedKwh=120.5 results in positive avoidedOn in default fixture
    simResults.value = [makeSimResult()]
    selectedBatteries.value = [battery]

    // Normal result — no negative note
    expect(container.querySelector('.saldering-negative-note')).toBeNull()
  })

  // ── XSS safety still holds with salderingOn=true ──────────────────────────

  it('script-named battery name is still inert text when salderingOn is true (T-04-13)', () => {
    salderingOn.value = true
    const maliciousName = '<script>alert("xss")</script>'
    const battery = makeBattery({ id: 'xss-battery', name: maliciousName })
    selectedBatteries.value = [battery]
    simResults.value = [makeSimResult()]

    expect(container.querySelectorAll('script').length).toBe(0)
    expect(container.textContent).toContain(maliciousName)
  })
})
