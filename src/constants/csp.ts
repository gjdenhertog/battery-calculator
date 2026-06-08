/**
 * Content Security Policy directive string — single source of truth.
 *
 * Consumed by:
 * - vite.config.ts (cspInjectPlugin: injects into dist/index.html at build time only)
 * - tests/csp-plugin.test.ts (unit test asserting all required directives are present)
 *
 * D-03: Maximal lockdown. No 'unsafe-inline'. No 'unsafe-eval'.
 * DATA-13: worker-src blob: added to allow PapaParse worker: true (blob-URL worker).
 *          connect-src remains 'none' — blob workers cannot make network requests.
 * Note: frame-ancestors 'none' is advisory only via <meta> (browsers ignore it per CSP spec).
 */
export const CSP: string = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  // DATA-13: PapaParse worker: true creates its worker via a blob URL.
  // worker-src blob: is the minimal relaxation; connect-src 'none' stays unchanged.
  "worker-src blob:",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')
