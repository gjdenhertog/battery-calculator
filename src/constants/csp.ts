/**
 * Content Security Policy directive string — single source of truth.
 *
 * Consumed by:
 * - vite.config.ts (cspInjectPlugin: injects into dist/index.html at build time only)
 * - tests/csp-plugin.test.ts (unit test asserting all required directives are present)
 *
 * D-03: Maximal lockdown. No 'unsafe-inline'. No 'unsafe-eval'.
 * Note: frame-ancestors 'none' is advisory only via <meta> (browsers ignore it per CSP spec).
 */
export const CSP: string = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')
