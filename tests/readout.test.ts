// @vitest-environment jsdom
/**
 * tests/readout.test.ts — renderReadout DOM-contract lock (DATA-11, D-08, D-09)
 *
 * Runs in the jsdom environment (per-file override via first-line docblock).
 * Calls renderReadout() against a real jsdom DOM and asserts the element structure.
 *
 * If any test in this file fails it means a future edit:
 * - Removed one of the six required DATA-11 Dutch summary labels
 * - Used innerHTML for user-derived data (XSS regression)
 * - Changed the readout section id or aria-label
 * - Stopped rendering per-file D-08 stats
 */
import { describe, it, expect } from 'vitest'
import { renderReadout } from '../src/ui/readout'
import type { MergeResult } from '../src/domain/types'

// ---------------------------------------------------------------------------
// Minimal fixture — only the shape that renderReadout requires
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<MergeResult> = {}): MergeResult {
  const base: MergeResult = {
    samples: [
      {
        timestamp: new Date('2025-01-01T00:15:00Z'),
        gridImportKwh: 0.5,
        gridExportKwh: 0.0,
      },
      {
        timestamp: new Date('2025-06-01T00:15:00Z'),
        gridImportKwh: 1.2,
        gridExportKwh: 0.3,
      },
    ],
    gapCount: 0,
    gapRanges: [],
    fileStats: [
      {
        fileName: 'export.csv',
        encoding: 'UTF-8',
        seriesType: 'cumulative',
        cadenceMinutes: 15,
        rowCount: 1000,
        rowsContributed: 990,
        rowsOverridden: 10,
        isMonotonic: true,
        firstIntervalAnomalyFlag: false,
        softWarnings: [],
      },
    ],
  }
  return { ...base, ...overrides }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderReadout DOM contract', () => {
  it('returns a <section id="parse-readout"> element', () => {
    const el = renderReadout(makeResult())
    expect(el.tagName.toLowerCase()).toBe('section')
    expect(el.id).toBe('parse-readout')
  })

  it('section has aria-label="Parseresultaten"', () => {
    const el = renderReadout(makeResult())
    expect(el.getAttribute('aria-label')).toBe('Parseresultaten')
  })

  it('renders the "Bestanden" summary label (DATA-11)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Bestanden')
  })

  it('renders the "Rijen" summary label (DATA-11)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Rijen')
  })

  it('renders the "Periode" summary label (DATA-11)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Periode')
  })

  it('renders the "Totaal netafname" summary label (DATA-11)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Totaal netafname')
  })

  it('renders the "Totaal teruglevering" summary label (DATA-11)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Totaal teruglevering')
  })

  it('renders the "Ontbrekende intervallen" summary label (DATA-11)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Ontbrekende intervallen')
  })

  it('shows "Geen" for gap count when gapCount is 0', () => {
    const el = renderReadout(makeResult({ gapCount: 0 }))
    expect(el.textContent).toContain('Geen')
  })

  it('shows gap count as integer when gapCount > 0', () => {
    const el = renderReadout(makeResult({ gapCount: 5 }))
    expect(el.textContent).toContain('5')
  })

  it('renders per-file "Bestand" label (D-08)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Bestand')
  })

  it('renders per-file "Resolutie" label (D-08)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Resolutie')
  })

  it('renders per-file "Type meting" label (D-08)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Type meting')
  })

  it('renders per-file "Encoding" label (D-08)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Encoding')
  })

  it('renders the file name from fileStats (D-08)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('export.csv')
  })

  it('renders "Cumulatief" for cumulative series type', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Cumulatief')
  })

  it('renders "Interval" for interval series type', () => {
    const result = makeResult()
    result.fileStats[0].seriesType = 'interval'
    const el = renderReadout(result)
    expect(el.textContent).toContain('Interval')
  })

  it('renders "Ja" for monotonic=true (D-08)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).toContain('Ja')
  })

  it('renders "Nee — mogelijke meterswap" for monotonic=false (D-08)', () => {
    const result = makeResult()
    result.fileStats[0].isMonotonic = false
    result.fileStats[0].monotonicity_failRow = 42
    const el = renderReadout(result)
    expect(el.textContent).toContain('Nee — mogelijke meterswap op rij 42')
  })

  it('renders "Windows-1252 (fallback)" when encoding is Windows-1252 (D-08)', () => {
    const result = makeResult()
    result.fileStats[0].encoding = 'Windows-1252'
    const el = renderReadout(result)
    expect(el.textContent).toContain('Windows-1252 (fallback)')
  })

  it('omits the warnings group when no soft warnings exist (D-09)', () => {
    const el = renderReadout(makeResult())
    expect(el.textContent).not.toContain('Aandachtspunten')
  })

  it('renders the warnings group when soft warnings exist (D-09)', () => {
    const result = makeResult()
    result.fileStats[0].softWarnings = ['Ongebruikelijk hoog importwaarde (8,4 kWh).']
    const el = renderReadout(result)
    expect(el.textContent).toContain('Aandachtspunten')
    expect(el.textContent).toContain('Ongebruikelijk hoog importwaarde')
  })

  it('renders a <script>-named file as inert text, not as a live element (XSS safety — T-02-10)', () => {
    // If file name were passed via innerHTML, this would create a live <script> element.
    // Using .textContent it must render as plain text.
    const result = makeResult()
    result.fileStats[0].fileName = '<script>alert("xss")</script>'
    const el = renderReadout(result)

    // The script tag must NOT be executable — no actual <script> child element
    expect(el.querySelectorAll('script').length).toBe(0)

    // The raw string must appear as text content (inert)
    expect(el.textContent).toContain('<script>alert("xss")</script>')
  })

  it('uses dl/dt/dd structure for summary fields (semantic markup)', () => {
    const el = renderReadout(makeResult())
    const dts = el.querySelectorAll('dt')
    const dds = el.querySelectorAll('dd')
    expect(dts.length).toBeGreaterThan(0)
    expect(dds.length).toBeGreaterThan(0)
  })

  it('kWh values are formatted to 1 decimal place', () => {
    const el = renderReadout(makeResult())
    // gridImportKwh: 0.5 + 1.2 = 1.7 kWh
    expect(el.textContent).toContain('1.7 kWh')
  })
})
