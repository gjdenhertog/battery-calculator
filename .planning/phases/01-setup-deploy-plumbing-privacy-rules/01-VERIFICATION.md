---
phase: 01-setup-deploy-plumbing-privacy-rules
verified: 2026-06-07T22:35:00Z
resolved: 2026-06-16T00:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
resolution: |
  Truth 8 (live GitHub Pages deployment) — the only human_needed item — is now
  verified against the live site at v1.0 milestone close. Evidence (curl
  https://gjdenhertog.github.io/battery-calculator/): HTTP 200; served HTML
  references the BUILT hashed assets /battery-calculator/assets/index-*.js + .css
  with zero /src/main.ts references; both assets and favicon.svg return 200 (no
  404s); the header "Thuisbatterij Calculator", the privacy promise, and the CSP
  meta are all present. The zero-third-party-request invariant is structurally
  guaranteed by CSP default-src/connect-src 'none' plus the green CI privacy
  guard (dist/ external-URL scan), and was confirmed visually during Phase 6's
  approved live human-verify.
human_verification:
  - test: "Verify live GitHub Pages deployment"
    expected: "Page renders at https://<user>.github.io/battery-calculator/ with no console errors, no CSP violations, zero third-party network requests, and no 404s"
    status: "RESOLVED — live site verified (HTTP 200, built artifact served, assets+favicon 200, CSP present); see resolution above"
    why_human: "No git remote exists yet; live deploy cannot run. Requires: (1) create GitHub repo, (2) set Pages source to 'GitHub Actions', (3) push main branch, (4) open fresh incognito window and check DevTools Console + Network tabs"
---

# Phase 01: Setup, Deploy Plumbing, Privacy Rules — Verification Report

**Phase Goal:** Working Vite + TS scaffold deployed to GitHub Pages with the privacy and base-path contracts locked in. Hello-world page is reachable, CSP is enforced, CI is green, no third-party scripts ship.
**Verified:** 2026-06-07T22:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run build` exits 0 and produces `dist/index.html` with all asset URLs under `/battery-calculator/` | VERIFIED | Build exits 0; `dist/assets/index-4vRq_liQ.js` and `dist/assets/index-0kp_YPso.css` both under `/battery-calculator/assets/` |
| 2 | `dist/index.html` contains the maximal-lockdown CSP `<meta>` with `default-src 'none'` and `connect-src 'none'`, no `'unsafe-inline'`, positioned as first child of `<head>` | VERIFIED | Line 4 of `dist/index.html` is the CSP meta, before `<script>` (line 10) and `<link>` (line 11); all 9 directives present; no unsafe-inline/eval |
| 3 | `dist/index.html` contains the verbatim privacy promise (U+2014 em dash) inside the drop-zone region | VERIFIED | `grep` finds the promise; Python whitespace-normalization confirms byte-for-byte match of the full sentence |
| 4 | The 3-region shell renders (header, drop-zone region, results placeholder); results region is bare with no "coming soon" copy | VERIFIED | `dist/index.html` shows `<header role="banner">`, `<main id="drop-zone-region">`, `<section id="results-region" aria-label="Vergelijkingsresultaten"></section>` (bare) |
| 5 | `npm run dev` serves `index.html` WITHOUT a CSP meta tag (HMR unaffected); `apply: 'build'` plugin gate confirmed | VERIFIED | Source `index.html` contains no `Content-Security-Policy`; plugin has `apply: 'build' as const`; the CSP only appears in `dist/index.html` |
| 6 | 18 Vitest tests pass (CSP directive contract lock + shell DOM-contract lock) | VERIFIED | `npx vitest run` — 2 test files, 18 tests, 0 failures, duration 865ms |
| 7 | CI workflow gates deploy on green ci job; privacy guard, no-reporting-lib check, typecheck, lint, format all run before deploy; locked action chain | VERIFIED | `deploy.yml` structure confirmed: `needs: ci` on deploy job; all locked versions present (checkout@v6, setup-node@v6, configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5); typecheck step wired; privacy guard (widened WR-01 fix) passes against current `dist/`; PRIV-03 check green; no third-party deploy action |
| 8 | Hello-world page is reachable at the live GitHub Pages URL with no console errors and no asset 404s (SETUP-02) | HUMAN NEEDED | No git remote exists yet; the CI pipeline is implemented and locally verified but has never been triggered against a real GitHub Pages environment |

**Score:** 7/8 truths verified (truth 8 deferred to human)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vite.config.ts` | base path, assetsInlineLimit 0, modulePreload polyfill off, build-only CSP inject plugin | VERIFIED | `apply: 'build' as const`, `assetsInlineLimit: 0`, `modulePreload: { polyfill: false }`, `base: '/battery-calculator/'`; imports CSP from `./src/constants/csp` |
| `src/constants/csp.ts` | exports CSP string with all 9 directives | VERIFIED | 9 directives joined with `'; '`; no unsafe-inline/eval; single source of truth |
| `src/styles/tokens.css` | `:root` design-token baseline including `--color-battery-5` | VERIFIED | `--color-battery-5: #e11d48` confirmed; full spacing/typography/color token set present |
| `src/shell.ts` | exports `renderShell(host: HTMLElement): void` with verbatim privacy promise | VERIFIED | Privacy promise uses `textContent` (no XSS surface), U+2014 em dash, correct IDs and ARIA attributes; results region left bare |
| `index.html` | source HTML with viewport meta, NO CSP meta | VERIFIED | No `Content-Security-Policy` in source; viewport meta present; `<div id="app">` host element |
| `tests/csp-plugin.test.ts` | node-env CSP contract test with all 9 directives + 2 negative assertions | VERIFIED | 11 assertions, no `@vitest-environment` annotation; imports `{ CSP }` from `../src/constants/csp` |
| `tests/shell.test.ts` | jsdom-env shell contract test with verbatim privacy promise | VERIFIED | First line `// @vitest-environment jsdom`; 7 assertions; calls `renderShell()` into live jsdom DOM |
| `.github/workflows/deploy.yml` | CI + Pages deploy; privacy guard; PRIV-03 check; `needs: ci` | VERIFIED | All locked action versions; widened privacy guard (case-insensitive, wss://, json/svg/wasm); PRIV-03 sentry/rollbar/bugsnag check; permissions: contents read, pages write, id-token write |
| `README.md` | privacy promise, Network-tab verification, Pages prerequisite, local dev commands | VERIFIED | Contains "Network", "GitHub Actions", "npm run dev", verbatim privacy promise string |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `vite.config.ts` | `src/constants/csp.ts` | `import { CSP } from './src/constants/csp'` | WIRED | Confirmed by grep |
| `src/main.ts` | `src/styles/global.css` | `import './styles/global.css'` | WIRED | Confirmed by grep |
| `tests/csp-plugin.test.ts` | `src/constants/csp.ts` | `import { CSP } from '../src/constants/csp'` | WIRED | Confirmed by grep |
| `tests/shell.test.ts` | `src/shell.ts` | `import { renderShell } from '../src/shell'` | WIRED | Confirmed by grep |
| `.github/workflows/deploy.yml` | `dist/` | privacy guard grep + `upload-pages-artifact` path | WIRED | Both the privacy guard and artifact upload reference `dist/` |

---

### Data-Flow Trace (Level 4)

Not applicable to this phase. No dynamic data rendering — the shell is a static structure with hard-coded copy. The privacy promise flows from `src/shell.ts` `textContent` assignment to `dist/index.html` directly (static in the source `index.html`).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run build` exits 0 with typecheck + vite build | `npm run build` | `tsc -b` clean + Vite build 68ms; 3 output files | PASS |
| Full test suite (18 tests) passes | `npx vitest run` | 2 files, 18 tests, 0 failures | PASS |
| `npm run lint` is clean | `npm run lint` | No errors, no warnings | PASS |
| `npm run format:check` is clean | `npm run format:check` | All files match Prettier code style | PASS |
| Privacy guard passes against built `dist/` | guard grep from `deploy.yml` | PASS — no external URLs or outbound-network calls in dist/ | PASS |
| PRIV-03 check: no error-reporting library | grep on package.json | PASS — no sentry/rollbar/bugsnag | PASS |
| CSP meta is first child of `<head>` | line number comparison in dist/index.html | CSP on line 4, `<script>` on line 10, `<link>` on line 11 | PASS |

---

### Probe Execution

No probes declared in PLAN frontmatter. No conventional `scripts/*/tests/probe-*.sh` files found.

Step 7c: SKIPPED (no probe files)

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SETUP-01 | 01-01 | Vite + TypeScript project scaffold builds to static output suitable for GitHub Pages | SATISFIED | `npm run build` exits 0; `dist/index.html` present with `/battery-calculator/` base path |
| SETUP-02 | 01-03 | Hello-world page reachable at GitHub Pages URL via Actions deploy | HUMAN NEEDED | CI pipeline implemented and locally verified; no git remote yet — live deploy unconfirmable |
| SETUP-03 | 01-03 | CI runs lint, formatter, Vitest on every push; deploy only after CI green | SATISFIED | `deploy.yml` has ci job (lint/format:check/test/typecheck/privacy-guard) + deploy with `needs: ci` |
| SETUP-04 | 01-03 | No third-party scripts in bundle; verified by CI grep | SATISFIED | Privacy guard scans built `dist/` output; passes against current build; README documents manual Network-tab check |
| SETUP-05 | 01-01, 01-02 | CSP `<meta>` restricts script/style/connect to `self` | SATISFIED | 9-directive CSP in `dist/index.html` (first child of `<head>`); 11 vitest assertions lock the contract |
| PRIV-01 | 01-01, 01-03 | Uploaded CSV processed in browser; no network request includes user data | SATISFIED (mechanically) | `connect-src 'none'` prevents all browser-initiated connections; privacy guard enforced in CI; browser confirmation deferred with SETUP-02 |
| PRIV-02 | 01-01, 01-02 | Privacy promise visible at drop zone | SATISFIED | Verbatim "Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden" in `<main id="drop-zone-region">`; locked by `shell.test.ts` |
| PRIV-03 | 01-03 | Parse errors never sent off-device; no error-reporting library | SATISFIED | No sentry/rollbar/bugsnag in package.json; CI step enforces this on every push |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No TBD/FIXME/XXX markers found in any phase-modified file |

No unreferenced debt markers found. Review findings CR-01, WR-01/02/03/04 were resolved in commit `bf370b9` (confirmed: tsc -b clean, privacy guard widened, CSP meta first in head, typecheck in CI, d.ts ignored by ESLint). WR-05 (main.ts test coverage) and IN-01..04 are non-blocking informational items intentionally deferred per the REVIEW.md note.

---

### Human Verification Required

#### 1. Live GitHub Pages Deployment (SETUP-02)

**Test:** After setting up a GitHub remote:
1. GitHub repo → Settings → Pages → Source = "GitHub Actions"
2. Push `main` to the remote; confirm the Actions run is green (ci job + deploy job both succeed)
3. Open `https://<your-user>.github.io/battery-calculator/` in a fresh incognito window
4. Confirm the shell renders: header "Thuisbatterij Calculator" + tagline, drop-zone region with the privacy promise, bare results placeholder
5. Open DevTools Console — confirm NO errors and NO CSP violation reports (SETUP-05 live confirmation)
6. Open DevTools Network tab, reload — confirm ONLY self-origin requests (the page + `/battery-calculator/assets/*.js` + `*.css`) and ZERO requests to any third-party origin
7. Confirm no 404s in the Network tab (base-path assets resolve under `/battery-calculator/`)

**Expected:** Page loads cleanly, console is silent, Network tab shows zero third-party requests, no 404s.

**Why human:** No git remote exists; the CI/Pages pipeline has never actually run. Live URL reachability and browser-level CSP/console behavior cannot be verified programmatically from the local working tree.

---

### Gaps Summary

No gaps. All automated must-haves are verified. The single outstanding item (SETUP-02 live deployment) is a known pre-condition deferral explicitly documented in `01-03-SUMMARY.md` — no git remote has been created yet. This item cannot be automated and requires human confirmation.

---

_Verified: 2026-06-07T22:35:00Z_
_Verifier: Claude (gsd-verifier)_
