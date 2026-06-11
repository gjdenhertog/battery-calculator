/**
 * Content Security Policy directive string — single source of truth.
 *
 * Consumed by:
 * - vite.config.ts (cspInjectPlugin: injects into dist/index.html at build time only)
 * - tests/csp-plugin.test.ts (unit test asserting all required directives are present)
 *
 * D-03: Maximal lockdown. No 'unsafe-inline'. No 'unsafe-eval'.
 * DATA-13 + Phase 4 Comlink worker: two workers are now whitelisted:
 *   - PapaParse worker: true creates its worker via a blob URL (requires blob:).
 *   - Vite ?worker emits the Comlink sim-worker as a same-origin assets/xxx.js chunk
 *     (requires 'self'). worker-src blob: alone would block it (Pitfall 1, RESEARCH).
 *   connect-src remains 'none' — blob workers cannot make network requests (privacy invariant).
 * Note: frame-ancestors 'none' is advisory only via <meta> (browsers ignore it per CSP spec).
 */
export const CSP: string = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  // DATA-13 + Phase 4 Comlink worker:
  // PapaParse worker: true creates its worker via a blob URL (requires blob:).
  // Vite ?worker emits the Comlink sim-worker as a same-origin assets/xxx.js chunk
  // (requires 'self'). Both must be whitelisted. connect-src 'none' stays unchanged —
  // blob workers cannot make network requests (privacy invariant preserved).
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')
