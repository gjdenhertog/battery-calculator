---
phase: "01"
plan: "01"
subsystem: scaffold
tags: [vite, typescript, csp, design-tokens, shell, privacy]
dependency_graph:
  requires: []
  provides:
    - package.json locked-version toolchain
    - tsconfig project-references structure
    - ESLint 9 flat config + Prettier
    - Vitest 4.1 with node default env
    - src/constants/csp.ts — CSP string single source of truth
    - vite.config.ts — build-only CSP inject plugin, base path, inline limits
    - src/styles/tokens.css — :root design-token baseline
    - src/styles/global.css — mobile-first reset and shell region rules
    - src/shell.ts — renderShell() for 3-region DOM (used by Plan 02 jsdom tests)
    - index.html — static shell with privacy promise (no CSP meta in source)
  affects:
    - Plan 02 (DOM contract tests consume shell.ts renderShell interface)
    - Plan 03 (CI workflow consumes dist/ built by this vite.config.ts)
    - Phases 2-5 (all inherit token system and shell mount points)
tech_stack:
  added:
    - vite@^8.0.14
    - typescript@~5.6 (installed 5.6.3)
    - vitest@^4.1.7
    - "@vitest/coverage-v8@^4.1.0"
    - jsdom@^29.0.0
    - eslint@^9.0.0
    - typescript-eslint@^8.0.0
    - eslint-config-prettier@^10.0.0
    - prettier@^3.0.0
    - "@eslint/js@^9.0.0"
  patterns:
    - ESLint 9 flat config (tseslint.config helper)
    - Vite transformIndexHtml + apply:'build' for dev-vs-prod CSP split
    - CSS :root custom properties (no CSS-in-JS, no runtime injection)
    - DOM-API shell construction (no innerHTML, no inline styles)
key_files:
  created:
    - package.json
    - package-lock.json
    - .gitignore
    - tsconfig.json
    - tsconfig.app.json
    - tsconfig.node.json
    - eslint.config.js
    - prettier.config.js
    - vitest.config.ts
    - vite.config.ts
    - index.html
    - src/constants/csp.ts
    - src/styles/tokens.css
    - src/styles/global.css
    - src/shell.ts
    - src/main.ts
  modified: []
decisions:
  - "CSP injected via build-only Vite plugin (apply:'build') — source index.html stays CSP-free so HMR works"
  - "Shell structure lives in both index.html (static delivery) and shell.ts (jsdom testability)"
  - "TypeScript pinned to ~5.6 (installed 5.6.3) against npm latest 6.0.3 per CLAUDE.md lock"
  - "modulePreload:{polyfill:false} to prevent inline script violating script-src 'self'"
  - "assetsInlineLimit:0 to prevent data: URI violations of img-src/font-src 'self'"
metrics:
  duration: "4m 27s"
  completed_date: "2026-06-07"
  tasks_completed: 3
  tasks_total: 3
  files_created: 16
  files_modified: 0
---

# Phase 01 Plan 01: Scaffold Project + Toolchain + CSP + Shell Summary

**One-liner:** Vanilla TypeScript Vite 8 project scaffolded with locked versions, build-only CSP injection via transformIndexHtml, :root design-token CSS, and 3-region DOM shell with verbatim Dutch privacy promise.

---

## What Was Built

### Task 1: Toolchain Scaffold (commit 1d555da)

Complete devDependency toolchain with all versions locked per CLAUDE.md:
- `package.json` with `"type": "module"`, `"private": true`, all pinned versions
- TypeScript installed at 5.6.3 (pinned to `~5.6` against npm latest 6.0.3)
- Three tsconfig files (project-references): `tsconfig.json` (root), `tsconfig.app.json` (browser, ES2020), `tsconfig.node.json` (config files, ES2022, composite)
- ESLint 9 flat config (`eslint.config.js`) using `tseslint.config()` helper — no legacy `.eslintrc`
- Prettier config with singleQuote:true
- Vitest config with `environment: 'node'` default (jsdom per-file via docblock per D-09)
- `.gitignore` covering node_modules, dist, coverage, *.local, .DS_Store

### Task 2: CSP Constant + Build-Only Vite Plugin (commit ab78dba)

- `/src/constants/csp.ts`: single-source CSP string joining 9 directives with `'; '`
  - All 9 directives: default-src, script-src, style-src, img-src, font-src, connect-src, base-uri, form-action, frame-ancestors
  - `default-src 'none'` and `connect-src 'none'` — maximal lockdown (D-03)
  - No `'unsafe-inline'`, no `'unsafe-eval'`
- `vite.config.ts`: `cspInjectPlugin()` with `apply: 'build' as const`
  - `transformIndexHtml` with `order: 'post'` injects CSP meta before `</head>`
  - Plugin skipped entirely by `vite serve` — HMR websocket unrestricted (Pitfall 3 avoided)
  - `build.assetsInlineLimit: 0` — no data: URI violations (Pitfall 2 avoided)
  - `build.modulePreload: { polyfill: false }` — no inline polyfill script (Pitfall 1 avoided)
  - `base: '/battery-calculator/'` (trailing slash mandatory, Pitfall 5 avoided)
- `index.html`: source HTML with viewport meta, NO CSP meta

### Task 3: Design Tokens + Global CSS + Shell + Build Verification (commit e6d1084)

- `src/styles/tokens.css`: complete `:root` block
  - Spacing scale: --space-xs (4px) through --space-3xl (64px)
  - System-font stack as `--font-sans` (no @font-face, no web fonts — D-06)
  - 3 font sizes, 2 font weights
  - 7 color tokens (bg, surface, border, text, text-muted, accent, destructive)
  - 5 per-battery color slots (--color-battery-1 through --color-battery-5)
- `src/styles/global.css`: box-sizing reset, mobile-first container (720px max, 480px breakpoint), header/drop-zone/results region rules, no inline styles
- `src/shell.ts`: `renderShell(host: HTMLElement)` builds 3-region shell via DOM APIs
  - `<header role="banner">` with h1 + tagline
  - `<main id="drop-zone-region">` with verbatim PRIV-02 privacy promise (U+2014 em dash)
  - `<section id="results-region" aria-label="Vergelijkingsresultaten">` left bare (D-02)
- `index.html`: updated with static shell content for dist/ delivery
- `src/main.ts`: imports global.css + renderShell; guards against double-render when shell already exists in DOM

**Build verification passed:**
- `npm run build` exits 0
- `dist/index.html` contains injected CSP meta with all 9 directives
- Privacy promise present byte-for-byte (U+2014 em dash verified)
- Assets at `/battery-calculator/assets/` paths
- Zero inline `style=` attributes in dist/

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Conflict Resolution] Shell content in both index.html AND shell.ts**

- **Found during:** Task 3
- **Issue:** The plan task wording said "do NOT hard-code the 3 regions in index.html" while the acceptance criteria required `dist/index.html` to contain the verbatim privacy promise. Since Vite does not execute JavaScript during the build pipeline, the privacy promise can only appear in `dist/index.html` if it is in the source `index.html`. The RESEARCH "Source index.html" example also shows the full shell structure in the HTML.
- **Fix:** Shell content is in both `index.html` (for static dist/ delivery and acceptance criteria) and `src/shell.ts` (for jsdom testability in Plan 02). `main.ts` guards against double-render by checking `app.children.length === 0` before calling `renderShell()`. This satisfies all acceptance criteria: privacy promise in dist/index.html, `grep -q "renderShell" src/main.ts`, and shell.ts as the testable DOM contract.
- **Files modified:** `index.html`, `src/main.ts`
- **Commit:** e6d1084

---

## Known Stubs

None. All regions are intentionally bare per D-02. The privacy promise is the only copy in the drop-zone region, as specified.

---

## Threat Flags

No new security surface beyond what is documented in the plan threat model. The plan's threat register covers all surface introduced:
- T-01-01: XSS via injected scripts — mitigated by `script-src 'self'` in dist/index.html CSP
- T-01-02: Exfil via connect/img/font — mitigated by `connect-src 'none'` + `assetsInlineLimit:0`
- T-01-03: Inline modulepreload polyfill — mitigated by `modulePreload:{polyfill:false}`
- T-01-04: Clickjacking — accepted (frame-ancestors advisory only via meta)
- T-01-SC: Supply chain — accepted (all packages established; no suspicious packages)

---

## Self-Check: PASSED

**Files verified:**

- [x] `package.json` — exists, typescript pinned ~5.6
- [x] `tsconfig.json` — exists, has references
- [x] `tsconfig.app.json` — exists
- [x] `tsconfig.node.json` — exists
- [x] `eslint.config.js` — exists, uses tseslint.config
- [x] `vitest.config.ts` — exists, environment:'node'
- [x] `src/constants/csp.ts` — exists, exports CSP
- [x] `vite.config.ts` — exists, apply:'build', assetsInlineLimit:0
- [x] `src/styles/tokens.css` — exists, --color-battery-5 declared
- [x] `src/styles/global.css` — exists
- [x] `src/shell.ts` — exists, exports renderShell
- [x] `src/main.ts` — exists, imports renderShell
- [x] `index.html` — exists, no CSP meta in source
- [x] `dist/index.html` — exists, contains CSP meta + privacy promise + /battery-calculator/assets/

**Commits verified:**

- [x] 1d555da — feat(01-01): scaffold project with locked-version toolchain
- [x] ab78dba — feat(01-01): add CSP constant, build-only inject plugin, and Vite config
- [x] e6d1084 — feat(01-01): design tokens, global stylesheet, 3-region shell, build verified
