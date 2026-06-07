/**
 * src/shell.ts — 3-region structural shell
 *
 * Renders the mount-point shell that Phases 2–5 fill in place (D-01).
 * Built via DOM APIs — no inline style attributes (style-src 'self' CSP D-03).
 *
 * Shell DOM contract (locked — see 01-UI-SPEC.md §"Shell Structure Contract"):
 *   .container
 *     header[role="banner"]
 *       h1 "Thuisbatterij Calculator"
 *       p.tagline
 *     main#drop-zone-region
 *       p.privacy-promise  ← verbatim PRIV-02 text
 *     section#results-region[aria-label="Vergelijkingsresultaten"]  ← bare (D-02)
 */

/**
 * Renders the 3-region shell into the given host element.
 *
 * @param host - Element to render into (typically #app or document.body)
 */
export function renderShell(host: HTMLElement): void {
  // ── Container ────────────────────────────────────────────────────────────
  const container = document.createElement('div')
  container.className = 'container'

  // ── Region 1: Header ─────────────────────────────────────────────────────
  const header = document.createElement('header')
  header.setAttribute('role', 'banner')

  const h1 = document.createElement('h1')
  h1.textContent = 'Thuisbatterij Calculator'

  const tagline = document.createElement('p')
  tagline.className = 'tagline'
  tagline.textContent = 'Bereken hoeveel energie een thuisbatterij jouw huis zou besparen.'

  header.appendChild(h1)
  header.appendChild(tagline)

  // ── Region 2: Drop-Zone Region ────────────────────────────────────────────
  const dropZone = document.createElement('main')
  dropZone.id = 'drop-zone-region'

  // PRIV-02: verbatim privacy promise — em dash is U+2014, must match byte-for-byte
  const privacyPromise = document.createElement('p')
  privacyPromise.className = 'privacy-promise'
  privacyPromise.textContent =
    'Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden'

  dropZone.appendChild(privacyPromise)

  // ── Region 3: Results Placeholder ────────────────────────────────────────
  // D-02: bare — no text content, no "coming soon" copy
  const results = document.createElement('section')
  results.id = 'results-region'
  results.setAttribute('aria-label', 'Vergelijkingsresultaten')

  // ── Assemble ─────────────────────────────────────────────────────────────
  container.appendChild(header)
  container.appendChild(dropZone)
  container.appendChild(results)

  host.appendChild(container)
}
