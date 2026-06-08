---
phase: 01
slug: setup-deploy-plumbing-privacy-rules
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-08
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified by gsd-security-auditor (claude-sonnet-4-6) on 2026-06-08 — 13/13 threats closed.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| build → shipped dist/ | Anything a dependency injects at build time crosses into the artifact users load | Code/URLs only (no user data in Phase 1) |
| browser → any origin | The shipped page must make zero outbound requests with user data (contract established now) | None — privacy hard constraint |
| CI gate → Pages deploy | Tests + privacy guard run on every push; a regressed contract or failing build must block deploy | Build artifact |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | injected third-party `<script>` (XSS) | mitigate | CSP `script-src 'self'`, no `unsafe-inline` — `src/constants/csp.ts:11-21`, `dist/index.html:4` | closed |
| T-01-02 | Information Disclosure | analytics/beacon exfil via connect/img/font | mitigate | CSP `connect-src 'none'` + `img-src 'self'` + `font-src 'self'` (`src/constants/csp.ts:14-16`); `assetsInlineLimit: 0` (`vite.config.ts:40`) | closed |
| T-01-03 | Tampering | inline modulepreload polyfill script | mitigate | `modulePreload: { polyfill: false }` (`vite.config.ts:44`); no inline `<script>` in `dist/index.html` | closed |
| T-01-04 | Elevation of Privilege | clickjacking via iframe embed | accept | `frame-ancestors 'none'` advisory-only via `<meta>` (`src/constants/csp.ts:20`); GitHub Pages can't set HTTP headers; no sensitive data — see AR-01 | closed |
| T-01-SC | Tampering | npm package supply chain | accept | All packages official/established; CI privacy guard + PRIV-03 are the regression gate — see AR-02 | closed |
| T-01-02-01 | Tampering | silent CSP weakening in a future edit | mitigate | `tests/csp-plugin.test.ts:50-56` — negative `unsafe-*` checks + 9 positive directive assertions; runs in CI (`deploy.yml:38`) | closed |
| T-01-02-02 | Tampering | silent removal of privacy promise / a shell region | mitigate | `tests/shell.test.ts:48-53` — verbatim copy (U+2014) + all 3 regions via real `renderShell()` (`tests/shell.test.ts:27-39`) | closed |
| T-01-02-SC | Tampering | jsdom test dependency | accept | jsdom dev-only, not shipped; established history — see AR-03 | closed |
| T-01-03-01 | Information Disclosure | build-time-injected analytics/CDN/font URL in dist/ | mitigate | CI privacy guard greps built `dist/` for external URLs and fails build (`deploy.yml:40-64`) | closed |
| T-01-03-02 | Information Disclosure | error-reporting library (Sentry/Rollbar/Bugsnag) added later | mitigate | CI greps `package.json`/`package-lock.json` for `sentry\|rollbar\|bugsnag` (`deploy.yml:66-72`) | closed |
| T-01-03-03 | Tampering | deploy of a broken/failing build | mitigate | `deploy` job `needs: ci` — failing ci blocks deploy (`deploy.yml:80`) | closed |
| T-01-03-04 | Elevation of Privilege | over-broad workflow token permissions | mitigate | `contents: read`, `pages: write`, `id-token: write` only (`deploy.yml:8-11`) | closed |
| T-01-03-SC | Tampering | GitHub Actions third-party deploy action supply chain | mitigate | Official `actions/*` chain only at locked versions (`deploy.yml:21-98`); no peaceiris/JamesIves | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-04 | `frame-ancestors 'none'` is advisory-only via `<meta>`; GitHub Pages cannot set HTTP headers. No sensitive data and no click-jackable action in Phase 1, so risk is negligible. Re-evaluate if Phase 2+ adds upload/consent/payment actions. | gsd-security-auditor + user | 2026-06-08 |
| AR-02 | T-01-SC | All devDependencies are official, multi-year, high-download toolchain packages (vite, typescript, vitest, eslint, prettier, jsdom). `npm ci` enforces the lockfile; CI privacy guard + PRIV-03 fail the build if any dep injects external URLs or error-reporting SDKs into `dist/`. Revisit on any public advisory. | gsd-security-auditor + user | 2026-06-08 |
| AR-03 | T-01-02-SC | jsdom is a dev-only test dependency, not bundled into the browser artifact; a compromise affects test results, not the shipped page. ~14yr history, 30M+/wk downloads. | gsd-security-auditor + user | 2026-06-08 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-08 | 13 | 13 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Notes

- The CI privacy guard (`deploy.yml:40-64`) is **stronger** than the plan specified — it also matches `wss?://`, `fetch(`, `XMLHttpRequest`, `navigator.sendBeacon` and scans `.json/.svg/.wasm/.webmanifest`. Strengthening of T-01-03-01, not a weakening.
- The CSP `<meta>` is injected as the **first** child of `<head>` (`vite.config.ts:29`), the correct placement so the policy governs all subsequently-parsed resources.
- `frame-ancestors 'none'` is kept in the CSP string despite being advisory-only via `<meta>`; it documents intent and will enforce if delivery ever gains HTTP-header capability (CDN/edge worker).
- Live browser verification (SETUP-02, PRIV-01 browser confirmation, SETUP-05 no console CSP violations) remains a deferred **human UAT** item pending GitHub remote setup + first push (`01-HUMAN-UAT.md`, `01-03-SUMMARY.md`). This is a UAT item, not a code-audit gap — code artifacts are complete and correct.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-08
