/**
 * src/ui/tooltips.ts — technical-term tooltip wiring (UX-03, D-11).
 *
 * initTooltips() attaches document-level event listeners for tap-toggle + Escape behavior.
 * Should be called once during app initialization.
 *
 * Pattern: event listener wiring on document, CSS-class toggle only, no signals.
 * Modeled on src/ui/drop-zone.ts listener + classList toggle pattern.
 *
 * Interaction model (D-11):
 * - Desktop hover: CSS :hover::after (no JS needed)
 * - Keyboard focus: CSS :focus-visible::after (no JS needed)
 * - Mobile tap: JS touchstart → toggles .term-tooltip--open class
 * - Escape: removes .term-tooltip--open from all, blurs the focused element
 *
 * CSP safety: Only classList add/remove — no element.style writes, no setAttribute('style').
 * XSS safety: data-tooltip content is always author-defined, never interpolated from user CSV data.
 *
 * Tooltip markup for copy authors — the exact span shape to wrap technical terms:
 *
 *   <span class="term-tooltip" tabindex="0" data-tooltip="[author-defined string]">
 *     [term]
 *   </span>
 *
 * The seven locked term/data-tooltip pairs (UI-SPEC Tooltip Interaction table):
 *
 *   zelfverbruik        → "De energie die je thuis opwekt en direct zelf gebruikt,
 *                          in plaats van aan het net te leveren."
 *
 *   teruglevering       → "Stroom die jouw huis terugstuurt naar het net — bij jou zichtbaar
 *                          als export op de P1-meter. Wij meten dit; we meten geen
 *                          zonneopwekking rechtstreeks." (D-10: canonical surplus term)
 *
 *   marginale benutting → "Hoeveel kWh de batterij per kWh capaciteit heeft verschoven.
 *                          Een hoge waarde betekent dat de batterij goed wordt benut;
 *                          een lage waarde dat er weinig teruglevering was om op te vangen."
 *
 *   round-trip rendement → "Het percentage van de ingeslagen energie dat je terugkrijgt
 *                           bij ontlading. Een rendement van 85% betekent dat 15% verloren
 *                           gaat aan warmte bij het laden én ontladen samen
 *                           (√0,85 ≈ 92% per richting)."
 *
 *   diepteontlading (DoD) → "Het maximale percentage van de batterijcapaciteit dat gebruikt
 *                             mag worden. Een batterij van 5 kWh met 90% DoD slaat nooit
 *                             meer dan 4,5 kWh op."
 *
 *   saldering           → "De Nederlandse regeling waarmee je geëxporteerde stroom mag
 *                          verrekenen met geïmporteerde stroom op je jaarrekening.
 *                          Saldering wordt per 2027 volledig afgeschaft."
 *
 *   verschoven kWh      → "De energie die de batterij heeft verplaatst van een moment van
 *                          teruglevering naar een moment van import — de kern van wat een
 *                          thuisbatterij doet."
 *
 * Requirements: UX-03, D-10, D-11
 */

/**
 * Attach document-level event listeners for tap-toggle and Escape behavior.
 *
 * Safe to call multiple times (listeners are idempotent from a behavior standpoint,
 * though for production use this should be called exactly once).
 *
 * No return value — the listeners live for the lifetime of the document.
 */
export function initTooltips(): void {
  // ── Touch tap-toggle (mobile) ─────────────────────────────────────────────
  // Passive listener — we only toggle a CSS class, never call preventDefault().
  document.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      const tapped = (e.target as Element).closest('.term-tooltip')

      // Close every currently-open tooltip that is NOT the tapped one
      document.querySelectorAll('.term-tooltip--open').forEach((el) => {
        if (el !== tapped) {
          el.classList.remove('term-tooltip--open')
        }
      })

      if (tapped) {
        // Toggle the tapped tooltip: open if closed, close if already open
        tapped.classList.toggle('term-tooltip--open')
      }
    },
    { passive: true },
  )

  // ── Keyboard Escape ───────────────────────────────────────────────────────
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.term-tooltip--open').forEach((el) => {
        el.classList.remove('term-tooltip--open')
        ;(el as HTMLElement).blur()
      })
    }
  })
}
