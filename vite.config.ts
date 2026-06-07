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
 * so the tag is injected into the final <head>.
 */
function cspInjectPlugin() {
  return {
    name: 'csp-inject',
    apply: 'build' as const,
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string): string {
        const metaTag = `  <meta http-equiv="Content-Security-Policy" content="${CSP}">\n`
        return html.replace('</head>', metaTag + '  </head>')
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
