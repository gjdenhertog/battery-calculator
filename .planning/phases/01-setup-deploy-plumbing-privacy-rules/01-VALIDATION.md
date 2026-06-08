---
phase: 1
slug: setup-deploy-plumbing-privacy-rules
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-07
audited: 2026-06-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Audited 2026-06-08 — all automatable requirements COVERED; 3 manual-only live-browser items documented.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (node default env; per-file `// @vitest-environment jsdom` override) |
| **Config file** | `vitest.config.ts` ✅ present |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Measured runtime** | ~1.0s (18 tests across 2 files) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite green + `npm run build` clean + CI privacy guard passes
- **Max feedback latency:** ~1 second (local suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0-01 | 01 | 0 | SETUP-05, D-08 | T-01-01 | `script-src 'self'`, no `'unsafe-inline'`/`'unsafe-eval'` | unit (node) | `npx vitest run tests/csp-plugin.test.ts` | ✅ `tests/csp-plugin.test.ts` | ✅ green (11) |
| 01-W0-02 | 01 | 0 | PRIV-02, D-01 | — | privacy promise verbatim, 3 regions | unit (jsdom) | `npx vitest run tests/shell.test.ts` | ✅ `tests/shell.test.ts` | ✅ green (7) |
| 01-01 | 01 | 1 | SETUP-01 | — | build emits `dist/index.html` | build smoke | `npm run build && ls dist/index.html` | ✅ `dist/index.html` | ✅ green |
| 01-02 | 01 | 1 | SETUP-05, D-08 | T-01-01 | `script-src 'self'`, no `'unsafe-inline'` | unit (node) | `npx vitest run tests/csp-plugin.test.ts` | ✅ `tests/csp-plugin.test.ts` | ✅ green |
| 01-03 | 01 | 1 | PRIV-02, D-01 | — | shell DOM contract | unit (jsdom) | `npx vitest run tests/shell.test.ts` | ✅ `tests/shell.test.ts` | ✅ green |
| 01-04 | 01 | 2 | SETUP-03 | T-01-03-03 | failing ci blocks deploy (`needs: ci`) | CI integration | GitHub Actions ci job on push (`deploy.yml`) | ✅ `.github/workflows/deploy.yml` | ✅ automated |
| 01-05 | 01 | 2 | SETUP-04, PRIV-01 | T-01-03-01 | `connect-src 'none'`, zero external URLs in `dist/` | CI grep | privacy-guard step (`deploy.yml:40-64`) | ✅ `.github/workflows/deploy.yml` | ✅ automated |
| 01-06 | 01 | 2 | PRIV-03 | T-01-03-02 | no error-reporting libs in deps | CI grep | `grep -Ei 'sentry\|rollbar\|bugsnag' …` (`deploy.yml:66-72`) | ✅ `.github/workflows/deploy.yml` | ✅ automated |
| 01-07 | 01 | 2 | SETUP-02 | — | live page reachable, clean console | manual | open `https://<user>.github.io/battery-calculator/` in incognito | — manual | ⬜ manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `vitest.config.ts` — test framework config; `environment: 'node'` default, V8 coverage, includes `tests/**/*.test.ts`
- [x] `tests/csp-plugin.test.ts` — CSP string-directive unit test (node env) — covers SETUP-05, D-08
- [x] `tests/shell.test.ts` — DOM-contract tests, 3 regions + app title + verbatim privacy promise (jsdom docblock) — covers PRIV-02, D-01
- [x] Framework install: `vitest @vitest/coverage-v8 jsdom` present in devDependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deployed page reachable, no console errors, no asset 404s | SETUP-02 | Requires live GitHub Pages URL + fresh incognito session | Open `https://<user>.github.io/battery-calculator/` in a fresh incognito window; confirm hello-world renders, console is clean, no 404s in Network tab |
| Zero third-party requests after bundle load (browser-confirmed) | PRIV-01 | DevTools Network-tab observation complements the CI grep guard | Load deployed page, open Network tab, reload; confirm 0 requests to any non-`self` origin after the bundle loads |
| No CSP violations reported by the browser on load | SETUP-05 | Browser is the authoritative CSP enforcer; meta-tag directives like `frame-ancestors` are advisory-only and only confirmable live | Load page, confirm console shows no CSP violation reports |

> These three items require a live deployment + real browser and cannot be automated in a static, no-server CI context. Tracked as human UAT in `01-HUMAN-UAT.md`.

---

## Validation Audit 2026-06-08

| Metric | Count |
|--------|-------|
| Requirements audited | 9 task-rows (7 distinct requirements) |
| COVERED (automated: local suite + CI) | 6 |
| Manual-only (documented) | 1 (SETUP-02) + 2 browser-confirm overlaps (PRIV-01, SETUP-05) |
| Gaps found | 0 |
| Resolved | 0 (none needed) |
| Escalated | 0 |

Local suite: 18 tests, 2 files, all green (~1.0s). Build smoke clean. CI pipeline (`deploy.yml`) provides automated enforcement of SETUP-01/03/04 + PRIV-01(grep)/PRIV-03 on every push.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are documented manual-only
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-06-08
