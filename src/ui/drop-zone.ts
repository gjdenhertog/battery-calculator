/**
 * src/ui/drop-zone.ts — drag-drop file-picker controller (DATA-01, DATA-13).
 *
 * initDropZone() wires the #drop-zone-region mount point from Phase 1 shell:
 *  - Appends drop instruction + always-visible file-picker (DATA-01).
 *  - Preserves the existing p.privacy-promise child (PRIV-02).
 *  - Implements a CSS-class-based state machine: idle → dragover/parsing → success/error.
 *  - On drop/pick: parseFile() each file → mergeFiles() → renderReadout() below the region.
 *  - Renders DATA-09 error messages (ParseRowError: file/row/column/expected).
 *  - Renders UnsupportedEncodingError messages.
 *
 * XSS safety: ALL user-derived strings use .textContent — never assigned via html methods.
 * No inline style assignments — all state changes via CSS class swaps (style-src 'self' CSP).
 */

import { parseFile } from '../domain/parse'
import { mergeFiles } from '../domain/merge'
import { ParseRowError, UnsupportedEncodingError } from '../domain/types'
import { renderReadout } from './readout'

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type DropZoneState = 'idle' | 'dragover' | 'parsing' | 'success' | 'error'

const STATE_CLASSES = [
  'drop-zone--idle',
  'drop-zone--dragover',
  'drop-zone--parsing',
  'drop-zone--success',
  'drop-zone--error',
] as const

function setState(region: HTMLElement, state: DropZoneState): void {
  region.classList.remove(...STATE_CLASSES)
  region.classList.add(`drop-zone--${state}`)
}

// Single CSV filter shared by the drop and file-picker paths (WR-05) so both
// entry points behave identically — a non-CSV file is ignored either way.
function filterCsvFiles(files: File[]): File[] {
  return files.filter((f) => f.name.endsWith('.csv') || f.type === 'text/csv')
}

// ---------------------------------------------------------------------------
// Status/error paragraph management
// ---------------------------------------------------------------------------

const STATUS_ID = 'drop-zone-status'
const ERROR_ID = 'drop-zone-error'

function clearStatusAndError(region: HTMLElement): void {
  const existing = region.querySelector(`#${STATUS_ID}, #${ERROR_ID}`)
  if (existing) existing.remove()
}

function showStatus(region: HTMLElement, message: string): void {
  clearStatusAndError(region)
  const p = document.createElement('p')
  p.id = STATUS_ID
  p.className = 'parse-status'
  p.setAttribute('aria-live', 'polite')
  p.textContent = message // textContent — static string (no user data here)
  region.appendChild(p)
}

function showError(region: HTMLElement, message: string): void {
  clearStatusAndError(region)
  const p = document.createElement('p')
  p.id = ERROR_ID
  p.className = 'parse-error'
  p.setAttribute('role', 'alert')
  p.textContent = message // textContent — message may embed file name (user-derived)
  region.appendChild(p)
}

// ---------------------------------------------------------------------------
// Readout insertion (outside the region, immediately after it)
// ---------------------------------------------------------------------------

function removeExistingReadout(region: HTMLElement): void {
  const existing = document.getElementById('parse-readout')
  if (existing) existing.remove()
  // Also remove the sibling readout if somehow it got into the region itself
  const inside = region.querySelector('#parse-readout')
  if (inside) inside.remove()
}

function insertReadoutAfterRegion(region: HTMLElement, readout: HTMLElement): void {
  region.insertAdjacentElement('afterend', readout)
}

// ---------------------------------------------------------------------------
// File processing pipeline
// ---------------------------------------------------------------------------

async function processFiles(files: File[], region: HTMLElement): Promise<void> {
  setState(region, 'parsing')
  showStatus(region, 'Bezig met verwerken...')

  try {
    // Parse all files — parseFile throws on error (DATA-09)
    const parseResults = await Promise.all(files.map((f) => parseFile(f)))

    // Merge all parse results into a unified series
    const mergeResult = mergeFiles(parseResults)

    // Remove any prior readout and render the new one below the region
    removeExistingReadout(region)
    const readout = renderReadout(mergeResult)
    insertReadoutAfterRegion(region, readout)

    // Show success status in the region
    const n = files.length
    showStatus(region, `${n} bestand(en) verwerkt.`)
    setState(region, 'success')
  } catch (err) {
    // Remove any stale readout from a previous successful parse
    removeExistingReadout(region)

    let message: string
    if (err instanceof ParseRowError) {
      // DATA-09: structured error — all fields rendered via textContent in showError
      message = err.message // err.message is already the structured Dutch string from the class
    } else if (err instanceof UnsupportedEncodingError) {
      message = err.message // Dutch encoding failure message from the class
    } else if (err instanceof Error) {
      message = err.message
    } else {
      message = 'Er is een onbekende fout opgetreden.'
    }

    showError(region, message)
    setState(region, 'error')
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Wire the drop-zone region with drag-drop + file-picker functionality.
 *
 * Appends the drop instruction and file-picker button AFTER the existing
 * p.privacy-promise (which is preserved — not replaced).
 *
 * Sets aria-label="Bestanden uploaden" on the region and manages drag events.
 *
 * @param region - The #drop-zone-region HTMLElement from the Phase 1 shell.
 */
export function initDropZone(region: HTMLElement): void {
  // ── ARIA ─────────────────────────────────────────────────────────────────
  region.setAttribute('aria-label', 'Bestanden uploaden')
  setState(region, 'idle')

  // ── Drop instruction paragraph ────────────────────────────────────────────
  const dropInstruction = document.createElement('p')
  dropInstruction.className = 'drop-instruction'
  dropInstruction.textContent = 'Sleep een of meer CSV-bestanden hierheen'
  region.appendChild(dropInstruction)

  // ── File picker (hidden input + visible label) ─────────────────────────────
  const inputId = 'file-picker-input'

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.multiple = true
  fileInput.accept = '.csv,text/csv'
  fileInput.id = inputId
  fileInput.className = 'file-picker-input'

  const fileLabel = document.createElement('label')
  fileLabel.htmlFor = inputId
  fileLabel.className = 'file-picker-label'
  fileLabel.textContent = 'Of kies bestanden'

  // Wrap input inside the label so clicking the label triggers the input
  fileLabel.appendChild(fileInput)
  region.appendChild(fileLabel)

  // ── Drag-and-drop event handlers ──────────────────────────────────────────

  region.addEventListener('dragenter', (e) => {
    e.preventDefault()
  })

  region.addEventListener('dragover', (e) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    setState(region, 'dragover')
    region.setAttribute('aria-dropeffect', 'copy')
  })

  region.addEventListener('dragleave', (e) => {
    // Only switch to idle if we're leaving the region itself (not a child)
    if (!region.contains(e.relatedTarget as Node | null)) {
      setState(region, 'idle')
      region.removeAttribute('aria-dropeffect')
    }
  })

  region.addEventListener('drop', (e) => {
    e.preventDefault()
    setState(region, 'idle')
    region.removeAttribute('aria-dropeffect')
    clearStatusAndError(region)

    const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : []
    const csvFiles = filterCsvFiles(files)
    if (csvFiles.length === 0) return

    // Fire and forget — errors are caught inside processFiles
    void processFiles(csvFiles, region)
  })

  // ── File picker change event ───────────────────────────────────────────────

  fileInput.addEventListener('change', () => {
    if (!fileInput.files || fileInput.files.length === 0) return
    const csvFiles = filterCsvFiles(Array.from(fileInput.files))
    // Reset the input so the same file can be re-selected later
    fileInput.value = ''
    if (csvFiles.length === 0) return
    void processFiles(csvFiles, region)
  })
}
