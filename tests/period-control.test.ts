// @vitest-environment jsdom
/**
 * tests/period-control.test.ts — initPeriodControl DOM-contract lock (DATA-12, D-19, COMP-08)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 * Mounts the period control against a real jsdom DOM seeded with the Phase 1 shell.
 *
 * Key invariants tested:
 * - Both date inputs default to the full merged range on init (D-19)
 * - Coverage indicator shows "{N} dagen aan data" (plural) (COMP-08)
 * - Coverage indicator shows "1 dag aan data" (singular) for a 1-day span (COMP-08)
 * - "Van" date change writes periodFrom.value (DATA-12)
 * - No "/jaar" or "/maand" in the rendered control (COMP-07)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderShell } from '../src/shell'
import { initPeriodControl, teardownPeriodControl } from '../src/ui/period-control'
import { parsedSamples, periodFrom, periodTo } from '../src/state/signals'
import type { IntervalSample } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDay(utcDateStr: string): Date {
  return new Date(`${utcDateStr}T12:00:00Z`)
}

/** Build a minimal IntervalSample array spanning the given UTC date strings. */
function makeSamples(utcDateStrs: string[]): IntervalSample[] {
  return utcDateStrs.map((d) => ({
    timestamp: makeDay(d),
    gridImportKwh: 1.0,
    gridExportKwh: 0.5,
  }))
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

describe('initPeriodControl DOM contract', () => {
  let container: HTMLElement

  beforeEach(() => {
    // Reset signals
    parsedSamples.value = []
    periodFrom.value = null
    periodTo.value = null

    container = setupResultsRegion()
    initPeriodControl(container)
  })

  afterEach(() => {
    // Dispose effects accumulated by initPeriodControl (WR-02: prevent effect leaks)
    teardownPeriodControl()
    // Clean up signals
    parsedSamples.value = []
    periodFrom.value = null
    periodTo.value = null
  })

  // ── D-19: date inputs default to full merged range ─────────────────────────

  it('both date inputs default to the full merged dataset range (D-19)', () => {
    // Set samples spanning 7 days
    const samples = makeSamples([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
      '2025-01-05',
      '2025-01-06',
      '2025-01-07',
    ])
    parsedSamples.value = samples

    const fromInput = container.querySelector('#period-from') as HTMLInputElement
    const toInput = container.querySelector('#period-to') as HTMLInputElement

    expect(fromInput).not.toBeNull()
    expect(toInput).not.toBeNull()

    // min and max should match the full range
    expect(fromInput.min).toBe('2025-01-01')
    expect(toInput.max).toBe('2025-01-07')

    // default values should also be the full range
    expect(fromInput.value).toBe('2025-01-01')
    expect(toInput.value).toBe('2025-01-07')
  })

  it('from input min matches first sample date (D-19)', () => {
    const samples = makeSamples(['2025-03-15', '2025-03-20', '2025-03-25'])
    parsedSamples.value = samples

    const fromInput = container.querySelector('#period-from') as HTMLInputElement
    expect(fromInput.min).toBe('2025-03-15')
  })

  it('to input max matches last sample date (D-19)', () => {
    const samples = makeSamples(['2025-03-15', '2025-03-20', '2025-03-25'])
    parsedSamples.value = samples

    const toInput = container.querySelector('#period-to') as HTMLInputElement
    expect(toInput.max).toBe('2025-03-25')
  })

  // ── COMP-08: coverage indicator shows "{N} dagen aan data" ─────────────────

  it('shows "{N} dagen aan data" for a multi-day dataset (COMP-08)', () => {
    // 7 samples each 1 day apart = ~7 coverage days
    const samples = makeSamples([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
      '2025-01-05',
      '2025-01-06',
      '2025-01-07',
    ])
    parsedSamples.value = samples

    const coverageEl = container.querySelector('.period-coverage')
    expect(coverageEl).not.toBeNull()
    // Should show "N dagen aan data" (plural)
    expect(coverageEl?.textContent).toMatch(/\d+ dagen aan data/)
  })

  it('shows "1 dag aan data" for a 1-day dataset (COMP-08 singular)', () => {
    // Two samples within the same day — coverageDays = ceil(diff) ≈ 0 or <1
    // To get exactly 1 day, put timestamps exactly 1 day apart
    const samples: IntervalSample[] = [
      { timestamp: new Date('2025-05-10T00:00:00Z'), gridImportKwh: 1, gridExportKwh: 0 },
      { timestamp: new Date('2025-05-11T00:00:00Z'), gridImportKwh: 1, gridExportKwh: 0 },
    ]
    parsedSamples.value = samples

    const coverageEl = container.querySelector('.period-coverage')
    // coverageDays = ceil((May11 - May10) / 86400000) = ceil(1) = 1
    expect(coverageEl?.textContent).toBe('1 dag aan data')
  })

  // ── DATA-12: "Van" change writes periodFrom.value ─────────────────────────

  it('"Van" date change updates periodFrom.value (DATA-12)', () => {
    const samples = makeSamples(['2025-01-01', '2025-01-15', '2025-01-31'])
    parsedSamples.value = samples

    const fromInput = container.querySelector('#period-from') as HTMLInputElement
    expect(fromInput).not.toBeNull()

    // Simulate user selecting a new "Van" date
    fromInput.value = '2025-01-10'
    fromInput.dispatchEvent(new Event('change', { bubbles: true }))

    // periodFrom.value should now be updated
    expect(periodFrom.value).not.toBeNull()
    // The new date should be 2025-01-10 UTC
    expect(periodFrom.value?.toISOString()).toContain('2025-01-10')
  })

  it('"Tot" date change updates periodTo.value (DATA-12)', () => {
    const samples = makeSamples(['2025-01-01', '2025-01-15', '2025-01-31'])
    parsedSamples.value = samples

    const toInput = container.querySelector('#period-to') as HTMLInputElement
    expect(toInput).not.toBeNull()

    // Simulate user selecting a new "Tot" date
    toInput.value = '2025-01-20'
    toInput.dispatchEvent(new Event('change', { bubbles: true }))

    // periodTo.value should now be updated
    expect(periodTo.value).not.toBeNull()
    expect(periodTo.value?.toISOString()).toContain('2025-01-20')
  })

  // ── COMP-07: no "/jaar" or "/maand" in the rendered control ──────────────

  it('container textContent contains neither "/jaar" nor "/maand" (COMP-07)', () => {
    const samples = makeSamples(['2025-01-01', '2025-03-01'])
    parsedSamples.value = samples

    expect(container.textContent).not.toContain('/jaar')
    expect(container.textContent).not.toContain('/maand')
  })

  // ── DOM structure ────────────────────────────────────────────────────────

  it('renders a section with aria-label="Analyseperiode"', () => {
    const section = container.querySelector('section[aria-label="Analyseperiode"]')
    expect(section).not.toBeNull()
  })

  it('renders an input#period-from with type="date"', () => {
    const input = container.querySelector('#period-from') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input?.type).toBe('date')
  })

  it('renders an input#period-to with type="date"', () => {
    const input = container.querySelector('#period-to') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input?.type).toBe('date')
  })

  it('renders .period-coverage with aria-live="polite"', () => {
    const el = container.querySelector('.period-coverage')
    expect(el).not.toBeNull()
    expect(el?.getAttribute('aria-live')).toBe('polite')
  })
})
