---
phase: 1
slug: setup-deploy-plumbing-privacy-rules
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (node default env; per-file `// @vitest-environment jsdom` override) |
| **Config file** | `vitest.config.ts` (none yet — Wave 0 creates it) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds (tiny suite — string + DOM-contract tests only) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite green + `npm run build` clean + CI privacy guard passes
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0-01 | 01 | 0 | SETUP-05, D-08 | — | N/A | unit (node) | `npx vitest run tests/csp-plugin.test.ts` | ❌ W0 | ⬜ pending |
| 01-W0-02 | 01 | 0 | PRIV-02, D-01 | — | N/A | unit (jsdom) | `npx vitest run tests/shell.test.ts` | ❌ W0 | ⬜ pending |
| 01-01 | 01 | 1 | SETUP-01 | — | N/A | build smoke | `npm run build && ls dist/index.html` | ❌ W0 | ⬜ pending |
| 01-02 | 01 | 1 | SETUP-05, D-08 | T-XSS | `script-src 'self'`, no `'unsafe-inline'` | unit (node) | `npx vitest run tests/csp-plugin.test.ts` | ❌ W0 | ⬜ pending |
| 01-03 | 01 | 1 | PRIV-02, D-01 | — | N/A | unit (jsdom) | `npx vitest run tests/shell.test.ts` | ❌ W0 | ⬜ pending |
| 01-04 | 01 | 2 | SETUP-03 | — | N/A | CI integration | GitHub Actions run on push | ❌ W0 | ⬜ pending |
| 01-05 | 01 | 2 | SETUP-04, PRIV-01 | T-exfil | `connect-src 'none'`, zero external URLs in `dist/` | CI grep | privacy-guard step (`grep -rE 'https?://' dist/`) | ❌ W0 | ⬜ pending |
| 01-06 | 01 | 2 | PRIV-03 | T-supply-chain | no error-reporting libs in deps | CI grep | `grep -rE 'sentry\|rollbar\|bugsnag' package.json` | ❌ W0 | ⬜ pending |
| 01-07 | 01 | 2 | SETUP-02 | — | N/A | manual | open `https://<user>.github.io/battery-calculator/` in incognito | — manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test framework config; `environment: 'node'` default, V8 coverage, includes `tests/**/*.test.ts`
- [ ] `tests/csp-plugin.test.ts` — CSP string-directive unit test (node env) — covers SETUP-05, D-08
- [ ] `tests/shell.test.ts` — DOM-contract tests, 3 regions + app title + verbatim privacy promise (jsdom docblock) — covers PRIV-02, D-01
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8 jsdom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deployed page reachable, no console errors, no asset 404s | SETUP-02 | Requires live GitHub Pages URL + fresh incognito session | Open `https://<user>.github.io/battery-calculator/` in a fresh incognito window; confirm hello-world renders, console is clean, no 404s in Network tab |
| Zero third-party requests after bundle load (browser-confirmed) | PRIV-01 | DevTools Network-tab observation complements the CI grep guard | Load deployed page, open Network tab, reload; confirm 0 requests to any non-`self` origin after the bundle loads |
| No CSP violations reported by the browser on load | SETUP-05 | Browser is the authoritative CSP enforcer; meta-tag directives like `frame-ancestors` are advisory-only and only confirmable live | Load page, confirm console shows no CSP violation reports |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
