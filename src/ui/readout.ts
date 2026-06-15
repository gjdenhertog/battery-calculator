/**
 * src/ui/readout.ts — sanity readout renderer (DATA-11, D-08, D-09).
 *
 * Renders a structured summary of a MergeResult into a <section> element.
 * The returned element is NOT inserted into the document — the caller does that.
 *
 * XSS safety: ALL user-derived values (file names, raw values) use .textContent.
 * User data is never parsed as HTML. No inline-style assignments (CSP style-src 'self').
 */

import type { MergeResult, FileStat } from '../domain/types'

// ---------------------------------------------------------------------------
// Formatters (nl-NL locale)
// ---------------------------------------------------------------------------

/** Format a row count with Dutch thousands separator (e.g. 52.438) */
function formatRows(n: number): string {
  return n.toLocaleString('nl-NL')
}

/** Format an energy value to 1 decimal place with kWh suffix */
function formatKwh(n: number): string {
  return `${n.toFixed(1)} kWh`
}

/** Format a Date as DD-MM-YYYY (NL date format) */
function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// dl/dt/dd helpers
// ---------------------------------------------------------------------------

/**
 * Append a dt+dd pair to a dl element.
 * IMPORTANT: value is always set via textContent — XSS safe, never via html assignment.
 */
function appendField(dl: HTMLElement, label: string, value: string): void {
  const dt = document.createElement('dt')
  dt.textContent = label

  const dd = document.createElement('dd')
  dd.textContent = value // textContent — XSS safe; file names and values go here

  dl.appendChild(dt)
  dl.appendChild(dd)
}

// ---------------------------------------------------------------------------
// Summary group (DATA-11)
// ---------------------------------------------------------------------------

function buildSummaryGroup(result: MergeResult): HTMLElement {
  const group = document.createElement('div')
  group.className = 'readout-group'

  const dl = document.createElement('dl')

  // Bestanden — count of files
  appendField(dl, 'Bestanden', String(result.fileStats.length))

  // Rijen — total rows across all files (before dedup)
  const totalRows = result.fileStats.reduce((sum, f) => sum + f.rowCount, 0)
  appendField(dl, 'Rijen', formatRows(totalRows))

  // Periode — earliest to latest timestamp in the merged series
  let periodeValue = '—'
  if (result.samples.length > 0) {
    const first = result.samples[0].timestamp
    const last = result.samples[result.samples.length - 1].timestamp
    periodeValue = `${formatDate(first)} – ${formatDate(last)}`
  }
  appendField(dl, 'Periode', periodeValue)

  // Totaal netafname — sum of gridImportKwh
  const totalImport = result.samples.reduce((sum, s) => sum + s.gridImportKwh, 0)
  appendField(dl, 'Totaal netafname', formatKwh(totalImport))

  // Totaal teruglevering — sum of gridExportKwh
  const totalExport = result.samples.reduce((sum, s) => sum + s.gridExportKwh, 0)
  appendField(dl, 'Totaal teruglevering', formatKwh(totalExport))

  // Ontbrekende intervallen — gap count (0 → "Geen")
  appendField(
    dl,
    'Ontbrekende intervallen',
    result.gapCount === 0 ? 'Geen' : formatRows(result.gapCount)
  )

  group.appendChild(dl)
  return group
}

// ---------------------------------------------------------------------------
// Per-file group (D-08)
// ---------------------------------------------------------------------------

// Human-readable Dutch cadence label for any detected interval, so a daily or
// hourly export is not mislabelled "15 minuten" (IN-04).
function formatCadence(min: number): string {
  if (min >= 1440) return 'Dag'
  if (min === 60) return 'Uur'
  return `${min} minuten`
}

function buildFileGroup(stat: FileStat): HTMLElement {
  const group = document.createElement('div')
  group.className = 'readout-group'

  const dl = document.createElement('dl')

  // Bestand — file name (user-derived: textContent only)
  appendField(dl, 'Bestand', stat.fileName)

  // Resolutie — detected cadence (correct label for any cadence, not just 15/60)
  appendField(dl, 'Resolutie', formatCadence(stat.cadenceMinutes))

  // Type meting — series type
  appendField(dl, 'Type meting', stat.seriesType === 'cumulative' ? 'Cumulatief' : 'Interval')

  // Monotoon — monotonicity check
  const monotoonValue = stat.isMonotonic
    ? 'Ja'
    : `Nee — mogelijke meterswap op rij ${stat.monotonicity_failRow ?? '?'}`
  appendField(dl, 'Monotoon', monotoonValue)

  // Eerste interval — first-interval anomaly
  appendField(dl, 'Eerste interval', stat.firstIntervalAnomalyFlag ? 'Aanpassing toegepast' : 'OK')

  // Rijen meegenomen — rows contributed
  appendField(dl, 'Rijen meegenomen', formatRows(stat.rowsContributed))

  // Rijen overschreven — rows overridden by finer-resolution file
  appendField(dl, 'Rijen overschreven', formatRows(stat.rowsOverridden))

  // Encoding — detected encoding
  appendField(
    dl,
    'Encoding',
    stat.encoding === 'Windows-1252' ? 'Windows-1252 (fallback)' : 'UTF-8'
  )

  group.appendChild(dl)
  return group
}

// ---------------------------------------------------------------------------
// Warnings group (D-09 — optional)
// ---------------------------------------------------------------------------

function buildWarningsGroup(warnings: string[]): HTMLElement {
  const group = document.createElement('div')
  group.className = 'readout-group readout-group--warnings'

  const dl = document.createElement('dl')

  const dt = document.createElement('dt')
  dt.textContent = 'Aandachtspunten'
  dl.appendChild(dt)

  for (const warning of warnings) {
    const dd = document.createElement('dd')
    dd.className = 'readout-warning'
    dd.textContent = warning // textContent — user-derived string from CSV values
    dl.appendChild(dd)
  }

  group.appendChild(dl)
  return group
}

// ---------------------------------------------------------------------------
// Divider helper
// ---------------------------------------------------------------------------

function buildDivider(): HTMLElement {
  const divider = document.createElement('div')
  divider.className = 'readout-divider'
  return divider
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Render a MergeResult into a structured <section> element.
 *
 * Returns the element without inserting it into the document.
 * The caller is responsible for DOM insertion.
 *
 * All user-derived strings (file names, raw values) use .textContent — XSS safe.
 * No inline style assignments — all layout via CSS classes (style-src 'self' CSP).
 *
 * @param result - The MergeResult to render.
 * @returns An HTMLElement (<section id="parse-readout">) ready for insertion.
 */
export function renderReadout(result: MergeResult): HTMLElement {
  const section = document.createElement('section')
  section.id = 'parse-readout'
  section.setAttribute('aria-label', 'Parseresultaten')

  // Summary group (DATA-11)
  section.appendChild(buildSummaryGroup(result))

  // Per-file groups (D-08) — one per file, separated by dividers
  for (let i = 0; i < result.fileStats.length; i++) {
    section.appendChild(buildDivider())
    section.appendChild(buildFileGroup(result.fileStats[i]))
  }

  // Collect all soft warnings from all files
  const allWarnings = result.fileStats.flatMap((f) => f.softWarnings ?? [])

  // Warnings group (D-09) — only when soft warnings exist
  if (allWarnings.length > 0) {
    section.appendChild(buildDivider())
    section.appendChild(buildWarningsGroup(allWarnings))
  }

  return section
}
