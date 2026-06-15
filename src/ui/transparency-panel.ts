/**
 * src/ui/transparency-panel.ts — collapsible transparency panel builder (UX-01, UX-02).
 *
 * renderTransparencyPanel() returns a <section class="transparency-panel"> subtree.
 * The returned element is NOT inserted into the document — the caller does that.
 *
 * Pattern: pure DOM builder (no signals), modeled on src/ui/readout.ts.
 * All copy stored as module-level const declarations assigned via .textContent only — never innerHTML.
 *
 * XSS safety: All copy is author-defined static strings. No user CSV data flows here.
 * No inline style assignments (CSP style-src 'self').
 *
 * Requirements: UX-01, UX-02, D-07, D-08, D-09
 */

// ---------------------------------------------------------------------------
// Locked copy strings (UX-01, UX-02) — from UI-SPEC Copywriting Contract
// These MUST NOT be changed without updating the test assertions.
// ---------------------------------------------------------------------------

const SUMMARY_LABEL = 'Hoe is dit berekend?'

// Five simulator assumptions in plain Dutch (verbatim from UI-SPEC)
const ASSUMPTION_1 =
  'Round-trip rendement: elke kWh die je opslaat én terugkrijgt, verliest energie. ' +
  'We passen √rendement toe bij laden én ontladen — bij een rendement van 85% gaat er ' +
  'per richting ~8% verloren.'

const ASSUMPTION_2 =
  'Diepteontlading (DoD): een batterij mag nooit zijn volle capaciteit gebruiken. ' +
  'We begrenzen de opgeslagen energie op nominale capaciteit × DoD-fractie.'

const ASSUMPTION_3 =
  'Laad- en ontlaadvermogen: een batterij kan niet meer opslaan of afgeven dan zijn ' +
  'maximale vermogens toelaten per tijdstap. Een 2,2 kW-batterij kan in 15 minuten ' +
  'nooit meer dan 0,55 kWh opslaan.'

// D-08: saldering caveat must restate the 2026 64%-cap and the post-2027 situation
const ASSUMPTION_4 =
  'Salderingsvereenvoudiging: de kolom "met saldering" berekent een 1:1-jaarverrekening. ' +
  'Dat is een versimpeling — zie de uitleg bij de tabel voor de 2026-64%-cap en de ' +
  'situatie na 2027.'

const ASSUMPTION_5 =
  'Periode: alle getallen gelden precies voor de periode die je hebt geüpload — ' +
  'er is geen extrapolatie naar een jaar of maand.'

// D-09: "Waarom geen euro's?" — explains why kWh-only is honest; makes NO version/v2 promise
const NO_EUROS_HEADING = "Waarom geen euro's?"

const NO_EUROS_BODY =
  'Om een eerlijk eurobedrag te berekenen, heb je je actuele import- en exporttarief ' +
  'nodig — inclusief terugleverkosten en eventuele dynamische prijzen. Die tariefgegevens ' +
  'hebben we niet, en we willen geen bedragen tonen die van jouw situatie afwijken. ' +
  'Daarom rapporteren we kWh: dat getal is voor iedereen gelijk en correct, ongeacht je tarief.'

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function buildAssumptionsList(): HTMLElement {
  const ul = document.createElement('ul')
  ul.className = 'assumptions-list'

  const assumptions = [ASSUMPTION_1, ASSUMPTION_2, ASSUMPTION_3, ASSUMPTION_4, ASSUMPTION_5]

  for (const copy of assumptions) {
    const li = document.createElement('li')
    li.textContent = copy // textContent — static locked copy (XSS safe)
    ul.appendChild(li)
  }

  return ul
}

function buildNoEurosSection(): HTMLElement {
  const section = document.createElement('div')
  section.className = 'no-euros-section'

  const heading = document.createElement('h3')
  heading.className = 'no-euros-section__heading'
  heading.textContent = NO_EUROS_HEADING // textContent — static copy

  const body = document.createElement('p')
  body.className = 'no-euros-section__body'
  body.textContent = NO_EUROS_BODY // textContent — static copy, no v2 promise

  section.appendChild(heading)
  section.appendChild(body)

  return section
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Render the collapsible "Hoe is dit berekend?" transparency panel.
 *
 * Returns a <section class="transparency-panel"> containing a native <details>
 * element. The panel is collapsed by default (no `open` attribute on <details>).
 * Browser handles open/close natively — zero JS needed for the toggle (D-07).
 *
 * Returns the element without inserting it into the document.
 * The caller is responsible for DOM insertion.
 *
 * @returns An HTMLElement (<section class="transparency-panel">) ready for insertion.
 */
export function renderTransparencyPanel(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'transparency-panel'
  section.setAttribute('aria-label', 'Berekeningsdetails')

  // Native <details> — browser handles open/close, no JS needed (D-07)
  // No `open` attribute: collapsed by default (UX-01 initial state)
  const details = document.createElement('details')
  details.className = 'transparency-panel__details'

  const summary = document.createElement('summary')
  summary.className = 'transparency-panel__summary'
  summary.textContent = SUMMARY_LABEL // textContent — static copy

  details.appendChild(summary)

  // Panel body with assumptions list + no-euros subsection
  const body = document.createElement('div')
  body.className = 'transparency-panel__body'

  body.appendChild(buildAssumptionsList())
  body.appendChild(buildNoEurosSection())

  details.appendChild(body)
  section.appendChild(details)

  return section
}
