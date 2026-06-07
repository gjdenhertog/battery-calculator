import { defineConfig } from 'vite'
import { CSP } from './src/constants/csp'

/**
 * Build-only CSP injection plugin.
 *
 * apply: 'build' — Vite skips this plugin entirely during `vite serve`.
 * The dev server index.html therefore carries NO CSP meta tag, keeping HMR
 * websocket (ws://) and dev-mode style injection unrestricted (Pitfall 3).
 *
 * transformIndexHtml order: 'post' — runs after all other HTML transforms
 * (incl. Vite's own <script>/<link> head injection) so we can position the
 * CSP meta ahead of them.
 *
 * The meta is injected as the FIRST child of <head> (not before </head>) so the
 * policy governs every resource the parser encounters afterwards — including
 * Vite's deferred module <script> and the stylesheet <link>. A meta-delivered
 * CSP only applies to resources parsed after it, so placing it first is required
 * for the "maximal lockdown" intent to actually hold (WR-02).
 */
function cspInjectPlugin() {
  return {
    name: 'csp-inject',
    apply: 'build' as const,
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string): string {
        const metaTag = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`
        return html.replace(/<head>/i, `<head>\n    ${metaTag}`)
      },
    },
  }
}

export default defineConfig({
  base: '/battery-calculator/',
  build: {
    // Pitfall 2: disable data: URI inlining — all assets remain external files
    // under assets/, keeping img-src 'self' and font-src 'self' valid.
    assetsInlineLimit: 0,
    // Pitfall 1: the default modulepreload polyfill is an inline <script> which
    // violates script-src 'self'. Modern browsers (2024+) support native
    // modulepreload; the polyfill is not needed.
    modulePreload: { polyfill: false },
  },
  plugins: [cspInjectPlugin()],
})
