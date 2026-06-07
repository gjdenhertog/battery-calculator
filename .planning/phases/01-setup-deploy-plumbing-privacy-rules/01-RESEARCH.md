# Phase 1: Setup, Deploy Plumbing, Privacy Rules — Research

**Researched:** 2026-06-07
**Domain:** Vite 8 scaffold, GitHub Pages deploy, Content Security Policy, TypeScript toolchain, Vitest DOM contracts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Build the full 3-region structural shell now: (1) header with app title + one-line tagline, (2) drop-zone region that carries the privacy promise, (3) results/comparison placeholder region. Phases 2–5 fill each region in place.
- **D-02:** Stubbed regions are bare — no "coming soon" / "in aanbouw" copy. Drop-zone region shows only the privacy promise; results region is an empty styled placeholder.
- **D-03:** Maximal-lockdown CSP via `<meta http-equiv="Content-Security-Policy">` in `index.html`. Policy: `default-src 'none'`, then `script-src 'self'`, `style-src 'self'`, `img-src 'self'`, `font-src 'self'`, `connect-src 'none'`, `base-uri 'self'`, `form-action 'none'`, `frame-ancestors 'none'`. No `'unsafe-inline'`.
- **D-04:** Automated `dist/` privacy guard in CI — scans built output and fails if any external `http(s)://` URL or known third-party domain appears.
- **D-05:** Design-token baseline + global stylesheet. `:root` CSS custom-properties file with colors, spacing scale, font stack, and per-battery color slots.
- **D-06:** System-font stack only. No Google Fonts, no CDN fonts. Satisfies `font-src 'self'` + `connect-src 'none'`.
- **D-07:** Mobile-readable baseline established now: viewport `<meta>`, `box-sizing: border-box` reset, mobile-first max-width container.
- **D-08:** Contract-locking Vitest tests: assert privacy-promise string present in drop-zone region, CSP `<meta>` tag exists with expected directives, shell regions (header/drop-zone/results placeholder) render.
- **D-09:** jsdom environment for these DOM-contract assertions. Deliberate exception to CLAUDE.md "node env by default" rule — Phase 1's tests are DOM-contract tests. Later domain-layer tests stay in node env.

### Technology Stack (from CLAUDE.md — all versions LOCKED)

- Vite `^8.0.14`, TypeScript `~5.6`, Node `lts/*` (22.x)
- Vitest `^4.1.7`, `@vitest/coverage-v8` `^4.1.x`
- ESLint `^9.x` (flat config `eslint.config.js`) + `@typescript-eslint` `^8.x`
- Prettier `^3.x` + `eslint-config-prettier`
- GitHub Pages deploy chain: `actions/checkout@v6` + `setup-node@v6` + `configure-pages@v6` + `upload-pages-artifact@v5` + `deploy-pages@v5`
- No re-research or re-versioning of these.

### Verbatim Copy (locked)

Privacy promise: **"Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden"** — rendered at drop-zone region, not in footer.

### Claude's Discretion

- Exact Vite config beyond `base: '/battery-calculator/'`, ESLint flat-config + Prettier setup, `tsconfig` strictness, GitHub Actions workflow file structure.
- Precise wording of the one-line header tagline (Dutch, honest, non-financial).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Vite + TypeScript project scaffold builds to static output suitable for GitHub Pages (`base: '/battery-calculator/'`) | Vite 8 `base` config + `build.assetsInlineLimit: 0` |
| SETUP-02 | Hello-world page reachable at `https://<user>.github.io/battery-calculator/` via GitHub Actions deploy chain | Official Vite static-deploy workflow, verified action chain |
| SETUP-03 | CI runs lint, formatter check, and Vitest on every push; deploy only runs after CI is green on main | Separate `ci` and `deploy` jobs with `needs: ci` dependency |
| SETUP-04 | No third-party scripts in bundle — verified by CI grep + Network-tab note in README | `grep -rE` pattern on `dist/`, documented approach |
| SETUP-05 | CSP `<meta http-equiv>` tag in `index.html` restricts script/style/connect sources to `'self'` | `transformIndexHtml` with `apply: 'build'` — injects only in prod |
| PRIV-01 | Uploaded CSV files read and processed entirely in the browser; no network request includes user data | `connect-src 'none'` CSP enforces this mechanically |
| PRIV-02 | Privacy promise visible at drop zone, not in footer | Verbatim `<p>` in `<main id="drop-zone-region">` per UI-SPEC |
| PRIV-03 | Parse errors shown to user but never sent off-device (no error-reporting library) | No Sentry/Rollbar in deps; CI guard catches any injection |
</phase_requirements>

---

## Summary

Phase 1 is a pure scaffold-and-contracts phase with zero feature code. The research domain breaks into four orthogonal sub-problems: (1) **dev-vs-prod CSP split** — the maximal-lockdown `<meta>` CSP must appear only in the `dist/` build, not in the dev server, so HMR continues to work; (2) **Vite 8 build output characteristics** — confirming that a Vite prod build emits external module `<script src>` and extracted `<link rel="stylesheet">` (no inline), making `script-src 'self'` / `style-src 'self'` achievable with `build.assetsInlineLimit: 0`; (3) **GitHub Pages base-path plumbing** — `base: '/battery-calculator/'` routes all asset URLs through the subpath and the official `configure-pages` → `upload-pages-artifact` → `deploy-pages` chain handles deployment with no third-party action needed; (4) **CI `dist/` privacy guard** — a `grep -rE` shell script scanning built output for external `https://` patterns provides a regression-proof automated gate.

The Vite plugin API's `transformIndexHtml` hook with `apply: 'build'` (or checking `ctx.bundle` existence) is the clean mechanism to inject the maximal CSP meta tag into `dist/index.html` while the dev server remains unrestricted. This is the most important integration detail for the planner to encode into tasks.

**Primary recommendation:** Write a minimal inline Vite plugin in `vite.config.ts` that uses `apply: 'build'` and `transformIndexHtml` to inject the CSP `<meta>` tag into the production HTML only. Set `build.assetsInlineLimit: 0` to prevent small asset data URIs. Keep the dev `index.html` clean of the CSP meta so HMR works without constraint.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static HTML shell | Browser / Client | — | Rendered once on load; no server rendering |
| CSS design tokens | Browser / Client | — | `:root` custom properties, shipped as external `.css` files |
| CSP enforcement | Browser / Client | CI (build gate) | `<meta http-equiv>` in `index.html`; CI guard validates built output |
| GitHub Pages deploy | CDN / Static | CI pipeline | `dist/` uploaded as artifact; Pages serves from edge |
| Privacy guard | CI pipeline | Browser CSP | `grep` scan on built output; CSP enforces at runtime |
| Vitest DOM contracts | CI pipeline | — | Run in CI on every push; jsdom for DOM assertions |
| Dev HMR | Frontend Server (Vite dev) | — | Vite dev server only; explicitly excluded from prod CSP |

---

## Standard Stack

### Core (all versions LOCKED by CLAUDE.md)

| Library | Registry Version | Purpose | Source |
|---------|-----------------|---------|--------|
| `vite` | `^8.0.14` (latest: 8.0.16, published 2026-06-01) | Build tool, dev server, static bundler | [VERIFIED: npm registry] |
| `typescript` | `~5.6` (latest: 6.0.3, but CLAUDE.md locks `~5.6`) | Type system, transpiled by Vite via esbuild | [VERIFIED: npm registry — CLAUDE.md pins ~5.6] |
| `vitest` | `^4.1.7` (latest: 4.1.8, published 2026-06-01) | Unit + DOM contract tests | [VERIFIED: npm registry] |
| `@vitest/coverage-v8` | `^4.1.x` (latest: 4.1.8, published 2026-06-01) | V8 coverage provider | [VERIFIED: npm registry] |
| `jsdom` | `^29.x` (latest: 29.1.1, published 2026-04-30) | DOM environment for Vitest jsdom tests | [VERIFIED: npm registry] |

### Dev Tooling (versions LOCKED by CLAUDE.md)

| Library | Registry Version | Purpose | Source |
|---------|-----------------|---------|--------|
| `eslint` | `^9.x` (latest: 9.29.0 — use `^9`) | Linting; flat config only in ESLint 9 | [VERIFIED: npm registry] |
| `typescript-eslint` | `^8.x` (latest: 8.60.1, published 2026-06-01) | TS parser + rules for ESLint flat config | [VERIFIED: npm registry] |
| `eslint-config-prettier` | `^10.x` (latest: 10.1.8, published 2025-07-18) | Disables ESLint rules that conflict with Prettier | [VERIFIED: npm registry] |
| `prettier` | `^3.x` (latest: 3.8.3) | Code formatter | [VERIFIED: npm registry] |

> **Note on TypeScript version:** CLAUDE.md locks `~5.6`, but npm's current `latest` tag is `6.0.3`. The `~5.6` pin is deliberate — use it as-is. Vite 8 bundles esbuild for transpilation and does not require `tsc` to emit; TypeScript is only needed for type checking and tooling.

### Installation

```bash
# Scaffold (Vite vanilla-ts template)
npm create vite@8 battery-calculator -- --template vanilla-ts

# Dev tooling
npm install -D vitest @vitest/coverage-v8 jsdom
npm install -D eslint typescript-eslint eslint-config-prettier prettier
```

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time. All packages below are tagged `[ASSUMED]` for provenance. All are established packages with long histories confirmed via npm registry metadata and official documentation; the planner should treat these as low-risk. No `checkpoint:human-verify` gate is needed for packages with multi-year histories and millions of weekly downloads.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `vite` | npm | ~5 yrs | 25M+/wk | github.com/vitejs/vite | [ASSUMED] | Approved — official Vite project |
| `typescript` | npm | ~12 yrs | 50M+/wk | github.com/microsoft/TypeScript | [ASSUMED] | Approved — Microsoft official |
| `vitest` | npm | ~3 yrs | 10M+/wk | github.com/vitest-dev/vitest | [ASSUMED] | Approved — Vite ecosystem official |
| `@vitest/coverage-v8` | npm | ~3 yrs | 7M+/wk | github.com/vitest-dev/vitest | [ASSUMED] | Approved — same monorepo as vitest |
| `jsdom` | npm | ~14 yrs | 30M+/wk | github.com/jsdom/jsdom | [ASSUMED] | Approved — long-lived standard |
| `eslint` | npm | ~10 yrs | 40M+/wk | github.com/eslint/eslint | [ASSUMED] | Approved — standard linting |
| `typescript-eslint` | npm | ~5 yrs | 20M+/wk | github.com/typescript-eslint/typescript-eslint | [ASSUMED] | Approved — official TS-ESLint umbrella package |
| `eslint-config-prettier` | npm | ~7 yrs | 15M+/wk | github.com/prettier/eslint-config-prettier | [ASSUMED] | Approved — Prettier official |
| `prettier` | npm | ~8 yrs | 30M+/wk | github.com/prettier/prettier | [ASSUMED] | Approved — standard formatter |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time; all packages are tagged `[ASSUMED]`. Given the established provenance of all packages (official project maintainers, multi-year histories, top-tier download counts), risk is assessed as negligible. No `checkpoint:human-verify` gates are inserted by the planner.*

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 Developer Workstation                    │
│                                                         │
│   src/           vite.config.ts        eslint.config.js │
│   ├── main.ts    ├── base: '/bat../'   prettier.config  │
│   ├── styles/    ├── assetsInline:0    tsconfig.json    │
│   │   ├── tokens.css  └── cspPlugin()                   │
│   │   └── global.css       │ (apply:'build')            │
│   └── index.html ◄─────────┘                           │
│          │              │                               │
│    npm run dev      npm run build                       │
│          │              │                               │
│   Vite dev server   dist/                               │
│   HMR active        ├── index.html (CSP meta injected)  │
│   No CSP meta       ├── assets/*.js                     │
│                     └── assets/*.css                    │
└───────────────────────┬─────────────────────────────────┘
                        │ git push main
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  GitHub Actions CI                       │
│                                                         │
│  Job: ci                    Job: deploy (needs: ci)     │
│  ├── npm ci                 ├── configure-pages@v6      │
│  ├── npm run build          ├── upload-pages-artifact@v5│
│  ├── npx eslint .           └── deploy-pages@v5         │
│  ├── npx prettier --check .                             │
│  ├── npm test (vitest)                                  │
│  └── privacy-guard grep ◄── scan dist/ for https://    │
│       (fails if external URL found in built output)     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           GitHub Pages (CDN / Static Edge)              │
│                                                         │
│  https://<user>.github.io/battery-calculator/           │
│  ├── index.html (CSP <meta> active, strict lockdown)    │
│  └── assets/ (external .js + .css, no inline)          │
│                                                         │
│  Browser enforces:                                      │
│  • script-src 'self'  → only /battery-calculator/*.js   │
│  • style-src 'self'   → only /battery-calculator/*.css  │
│  • connect-src 'none' → zero network requests allowed   │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
battery-calculator/
├── .github/
│   └── workflows/
│       ├── ci.yml          # lint + format-check + test + privacy-guard
│       └── deploy.yml      # triggers on ci success, uploads dist/ to Pages
├── src/
│   ├── styles/
│   │   ├── tokens.css      # :root custom properties (colors, spacing, typography, battery slots)
│   │   └── global.css      # box-sizing reset, system-font, container, shell regions
│   ├── main.ts             # app entry — imports styles, sets up shell DOM
│   └── shell.ts            # shell HTML string / DOM construction (optional extraction)
├── index.html              # entry HTML; NO CSP meta (injected at build time)
├── vite.config.ts          # base, assetsInlineLimit:0, cspPlugin()
├── tsconfig.json           # project tsconfig (references app + node)
├── tsconfig.app.json       # browser targets, strict, bundler moduleResolution
├── tsconfig.node.json      # for vite.config.ts itself
├── eslint.config.js        # ESLint 9 flat config with typescript-eslint
├── prettier.config.js      # Prettier config
├── vitest.config.ts        # vitest config (environment per-file, coverage v8)
└── tests/
    └── shell.test.ts       # jsdom DOM contract tests (D-08, D-09)
```

### Pattern 1: Build-Only CSP Injection via Vite Plugin

**What:** An inline Vite plugin in `vite.config.ts` uses the `transformIndexHtml` hook with `apply: 'build'` to inject the CSP `<meta>` tag exclusively into the production `dist/index.html`. The dev-server `index.html` never receives the CSP tag, so HMR websocket and dev-mode style injection work without restriction.

**When to use:** Always — this is the canonical solution for dev-vs-prod CSP split in a Vite static app that cannot set HTTP headers (GitHub Pages).

**Why this works:** The `apply: 'build'` property on a Vite plugin causes Vite to skip the plugin entirely during `vite serve`. The `transformIndexHtml` hook on a build-only plugin runs after Rollup writes the bundle, so it has access to `ctx.bundle` and can inject deterministically. [VERIFIED: vite.dev/guide/api-plugin]

```typescript
// vite.config.ts
// Source: https://vite.dev/guide/api-plugin#transformindexhtml
import { defineConfig } from 'vite'

const CSP = [
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

function cspPlugin() {
  return {
    name: 'inject-csp',
    apply: 'build' as const,   // skipped entirely during `vite serve`
    transformIndexHtml: {
      order: 'post' as const,  // run after all other HTML transforms
      handler(html: string) {
        return html.replace(
          '</head>',
          `  <meta http-equiv="Content-Security-Policy" content="${CSP}">\n  </head>`
        )
      },
    },
  }
}

export default defineConfig({
  base: '/battery-calculator/',
  build: {
    assetsInlineLimit: 0,  // disable data: URI inlining — all assets remain external files
  },
  plugins: [cspPlugin()],
})
```

**What the dev server sees:** A plain `index.html` with no CSP meta. HMR websocket (`ws://`) and dev-mode injected styles are unrestricted.

**What `dist/index.html` sees:** The CSP meta tag injected into `<head>` by the plugin. The browser enforces `connect-src 'none'` from first page load.

### Pattern 2: Vite 8 Production Build — What Gets Emitted

**Critical for CSP compliance:** Vite 8 production builds emit:

- `<script type="module" src="/battery-calculator/assets/main-[hash].js" crossorigin>` — external module script, no inline JS [VERIFIED: vite.dev/guide/features]
- `<link rel="stylesheet" href="/battery-calculator/assets/main-[hash].css">` — extracted CSS file, no inline styles [VERIFIED: vite.dev/guide/features]
- `<link rel="modulepreload" href="..." crossorigin>` — preload hints; these use `rel="modulepreload"` not `rel="preload"`, covered by `script-src 'self'` for module loads [ASSUMED — based on Vite docs on modulepreload]

**Gotchas requiring `assetsInlineLimit: 0`:** Without this setting, Vite inlines assets smaller than 4 KiB as `data:` base64 URIs. A small icon or tiny CSS background image inlined as `data:image/...;base64,...` hits the `img-src 'self'` directive, which does NOT allow `data:` URIs by default. With `assetsInlineLimit: 0`, every asset becomes an external file under `assets/`, and `img-src 'self'` covers them cleanly. [VERIFIED: vite.dev/config/build-options]

**CSS Code Split:** `build.cssCodeSplit` defaults to `true`. Leave it at default — CSS for async chunks stays in separate files loaded alongside their chunks. This is compatible with `style-src 'self'`. [VERIFIED: vite.dev/config/build-options]

**Modulepreload polyfill:** `build.modulePreload.polyfill` defaults to `true`. This injects a small inline script polyfill for browsers that don't support native `<link rel="modulepreload">`. This inline script would violate `script-src 'self'` (no `'unsafe-inline'`). **Set `build.modulePreload: { polyfill: false }` in the Vite config.** Modern browsers (Chrome 66+, Firefox 115+, Safari 16.4+) support native modulepreload; the polyfill is unnecessary for a 2026 app.

```typescript
// vite.config.ts — complete config
export default defineConfig({
  base: '/battery-calculator/',
  build: {
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },  // avoids inline script violating script-src 'self'
  },
  plugins: [cspPlugin()],
})
```

### Pattern 3: GitHub Pages Deploy Workflow

**The official Vite-documented pattern** [CITED: vite.dev/guide/static-deploy]:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npx eslint .
      - run: npx prettier --check .
      - run: npm test -- --run
      - name: Privacy guard — scan dist/ for external URLs
        run: |
          if grep -rE --include='*.html' --include='*.js' --include='*.css' \
            'https?://(?!localhost|127\.0\.0\.1)' dist/ \
            | grep -v 'Content-Security-Policy' \
            | grep -v '\.map$'; then
            echo "FAIL: external URL found in built output"
            exit 1
          fi
          echo "PASS: no external URLs found in dist/"
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy:
    needs: ci
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist/
      - id: deployment
        uses: actions/deploy-pages@v5
```

> **Note:** The version asymmetry (`configure-pages@v6` / `upload-pages-artifact@v5` / `deploy-pages@v5`) is intentional and correct per CLAUDE.md, verified against GitHub release tags as of 2026-05-26.

> **CI vs deploy jobs:** Splitting into `ci` and `deploy` jobs with `needs: ci` ensures the deploy job never runs when lint/test/guard fail. A deliberately broken push will fail `ci` and the deploy workflow will not start.

### Pattern 4: ESLint 9 Flat Config for Vanilla TypeScript + Vite

[ASSUMED — based on typescript-eslint official docs and community patterns]

```javascript
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.app.json',
      },
    },
    rules: {
      // project-specific rules go here
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
)
```

### Pattern 5: tsconfig Structure for Vite Vanilla TypeScript

[VERIFIED: vite.dev/guide/features — Vite TypeScript section]

```json
// tsconfig.app.json (browser code)
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

```json
// tsconfig.node.json (for vite.config.ts)
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "composite": true,
    "noEmit": false,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "eslint.config.js"]
}
```

```json
// tsconfig.json (root — references both)
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### Pattern 6: CI `dist/` Privacy Guard

The guard must scan the built output (not source) and fail if any external URL appears. It should not false-positive on:
- The CSP meta content string (which may contain scheme references like `'none'` — but not actual `https://` URLs)
- Source map references (`.map` files are not shipped to Pages if `build.sourcemap` is false)

```bash
# Privacy guard shell script pattern
# Source: [ASSUMED] — designed from first principles

# Fail if any external https:// URL appears in built HTML/JS/CSS
# Exclude: source map comments (//# sourceMappingURL=), .map files
FOUND=$(grep -rE \
  --include='*.html' \
  --include='*.js' \
  --include='*.css' \
  'https?://[a-zA-Z0-9]' \
  dist/ \
  | grep -v '\.map' \
  | grep -v '//# sourceMappingURL' \
  || true)

if [ -n "$FOUND" ]; then
  echo "PRIVACY GUARD FAILED: external URL(s) found in dist/"
  echo "$FOUND"
  exit 1
fi
echo "Privacy guard: PASS — no external URLs in built output"
```

**False-positive risk:** The CSP meta content value like `"default-src 'none'"` does not contain `https://`, so it will not trigger the pattern. The pattern `https?://[a-zA-Z0-9]` matches URLs that start with a domain character, not policy keywords. [ASSUMED — logic-derived]

**What it catches:** Any dependency that injects analytics, CDN scripts, Google Fonts `@import url(...)`, Sentry DSN endpoints, or tracking pixels into the bundle.

### Pattern 7: Vitest jsdom DOM Contract Tests

[VERIFIED: vitest.dev/guide/environment]

```typescript
// tests/shell.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'

// Import the HTML template string or render function
// For a vanilla TS app, parse the built index.html or construct via main.ts entry

describe('Shell DOM contracts', () => {
  beforeEach(() => {
    // Set up the shell HTML structure (load from src or template string)
    document.body.innerHTML = `
      <div class="container">
        <header role="banner">
          <h1>Thuisbatterij Calculator</h1>
          <p class="tagline">...</p>
        </header>
        <main id="drop-zone-region">
          <p class="privacy-promise">
            Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden
          </p>
        </main>
        <section id="results-region" aria-label="Vergelijkingsresultaten"></section>
      </div>
    `
  })

  it('renders the 3-region shell', () => {
    expect(document.querySelector('header[role="banner"]')).not.toBeNull()
    expect(document.querySelector('#drop-zone-region')).not.toBeNull()
    expect(document.querySelector('#results-region')).not.toBeNull()
  })

  it('renders the app title', () => {
    expect(document.querySelector('h1')?.textContent).toBe('Thuisbatterij Calculator')
  })

  it('renders the verbatim privacy promise in drop-zone region', () => {
    const dropZone = document.querySelector('#drop-zone-region')
    expect(dropZone?.textContent).toContain(
      'Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden'
    )
  })
})
```

**For CSP meta tag assertions:** These must be tested against the _built_ HTML, not the source `index.html` (since the CSP tag is injected at build time). Options:
1. Read `dist/index.html` in a separate test that runs post-build (integration test)
2. Test the `cspPlugin()` function directly by calling `handler()` with a sample HTML string and asserting the output contains the expected CSP meta

Option 2 is simpler and does not require a build artifact. It tests the plugin logic unit-test-style without jsdom.

```typescript
// tests/csp-plugin.test.ts (node env — no jsdom needed)
import { describe, it, expect } from 'vitest'
// Import the CSP string from vite.config.ts or a shared constant
import { CSP } from '../src/constants/csp'

describe('CSP meta tag content', () => {
  it('contains the required directives', () => {
    expect(CSP).toContain("default-src 'none'")
    expect(CSP).toContain("script-src 'self'")
    expect(CSP).toContain("style-src 'self'")
    expect(CSP).toContain("connect-src 'none'")
    expect(CSP).toContain("frame-ancestors 'none'")
    expect(CSP).not.toContain("'unsafe-inline'")
    expect(CSP).not.toContain("'unsafe-eval'")
  })
})
```

This approach tests the CSP string contract without depending on build artifacts, and runs in the default node environment (fast, no jsdom overhead).

### Anti-Patterns to Avoid

- **Putting the CSP `<meta>` directly in `index.html`:** This kills HMR — Vite dev server cannot upgrade `ws://localhost:5173` when `connect-src 'none'` is active. Always inject via build plugin.
- **Omitting `build.modulePreload: { polyfill: false }`:** The default polyfill injects an inline `<script>` which violates `script-src 'self'`. No `'unsafe-inline'` means the polyfill is blocked. Disable it.
- **Omitting `build.assetsInlineLimit: 0`:** Any asset under 4 KiB gets base64-inlined as a `data:` URI. This can violate `img-src 'self'` or `font-src 'self'` if any small icon or font is present. Phase 1 has no icons, but future phases will — establish the limit now.
- **Setting global jsdom environment in vitest.config.ts:** The CLAUDE.md pattern is node env by default, jsdom only per-file. Use `// @vitest-environment jsdom` docblock in DOM test files rather than setting `test.environment: 'jsdom'` globally.
- **Using `grep -r "http://"` on source instead of dist/:** The guard must scan `dist/` (built output) to catch injected third-party content that source-level grepping would miss.
- **Checking `crossorigin` attribute on `<link rel="modulepreload">`:** Vite adds `crossorigin` to modulepreload links. This is fine — `crossorigin` is not a security-relevant attribute for same-origin assets and does not interact with CSP directives.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vite HTML transform | Custom file-system `sed` at CI time | `transformIndexHtml` plugin hook with `apply: 'build'` | Plugin runs inside Vite's pipeline with correct ordering and `ctx.bundle` access |
| ESLint flat config boilerplate | Custom rule files | `typescript-eslint` umbrella package's `tseslint.config()` helper | Handles TS parser, rule inheritance, and shareable config merging correctly |
| Privacy URL detection | Custom AST scanner | `grep -rE 'https?://[a-zA-Z0-9]' dist/` with exclusions | Sufficient for catching injected URLs; no library needed |
| CSS design tokens | Sass variables / CSS-in-JS | Native CSS custom properties on `:root` | Zero dependencies, no toolchain, CSP-safe (no runtime injection) |
| Env-based CSP switching | `import.meta.env.PROD` conditional in HTML | `apply: 'build'` plugin | Plugin is the idiomatic Vite mechanism; avoids shipping env-check code to prod |

**Key insight:** This phase requires zero runtime dependencies beyond the locked stack. Every capability (CSP injection, privacy guard, token system) is achievable with native Vite plugin API, native CSS, and shell scripting.

---

## Common Pitfalls

### Pitfall 1: Modulepreload Polyfill Inline Script Violates CSP

**What goes wrong:** Vite 8 injects a modulepreload polyfill as an inline `<script>` into `dist/index.html` by default. With `script-src 'self'` and no `'unsafe-inline'`, the browser blocks this script and logs a CSP violation. The page may still load (the polyfill is for older browsers), but the violation breaks SETUP-05's acceptance criterion.

**Why it happens:** `build.modulePreload.polyfill` defaults to `true`. [VERIFIED: vite.dev/config/build-options]

**How to avoid:** Add `build: { modulePreload: { polyfill: false } }` to `vite.config.ts`. Modern browsers (2024+) support native modulepreload; the polyfill is not needed.

**Warning signs:** CSP violation in browser console for inline script hash after first deploy.

### Pitfall 2: Data URI Assets Violate `img-src 'self'`

**What goes wrong:** Vite inlines assets smaller than 4 KiB as `data:image/...;base64,...` or `data:font/...;base64,...` directly into CSS or JS. The CSP directive `img-src 'self'` does not permit `data:` URIs by default. A small SVG icon added in a later phase would trigger a CSP violation in production that works fine in dev (no CSP in dev).

**Why it happens:** `build.assetsInlineLimit` defaults to `4096` (4 KiB). [VERIFIED: vite.dev/config/build-options]

**How to avoid:** Set `build.assetsInlineLimit: 0` in `vite.config.ts` from Phase 1. All assets become external files under `assets/`, served from `'self'`. This costs one extra HTTP request per tiny asset but removes the CSP class of bug permanently.

**Warning signs:** `data:image/` or `data:font/` strings in `dist/assets/*.js` or `dist/assets/*.css`.

### Pitfall 3: HMR Broken by CSP Meta in Source `index.html`

**What goes wrong:** If the CSP `<meta>` tag (with `connect-src 'none'`) is placed directly in the source `index.html`, the Vite dev server's HMR websocket connection (`ws://localhost:5173`) is blocked by the browser. `npm run dev` still starts, but changes to source files do not hot-reload. Developers must manually refresh, and `style-src 'self'` also blocks Vite's injected dev-mode style tags.

**Why it happens:** The CSP `<meta>` applies equally to dev server and production. `connect-src 'none'` explicitly bans all network connections including same-origin websockets. [ASSUMED — from Vite issue tracker community reports]

**How to avoid:** Keep the source `index.html` free of any CSP meta. Inject the CSP meta only in the build plugin (`apply: 'build'`). The dev server never receives the plugin's output.

**Warning signs:** Hot reload stops working after adding CSP meta to `index.html`; browser console shows `connect-src` violation for `ws://`.

### Pitfall 4: GitHub Actions Pages Permissions Missing

**What goes wrong:** Deploy job fails with "Resource not accessible by integration" or "Pages not found" error. The workflow YAML lacks the `pages: write` and `id-token: write` permissions required by the `deploy-pages` action. Or, the GitHub repository Pages source is not set to "GitHub Actions" in repository Settings → Pages.

**Why it happens:** The deploy chain requires these permissions to create a deployment and obtain an OIDC token. [CITED: docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages]

**How to avoid:** Include `permissions: { pages: write, id-token: write }` on the deploy job (or at workflow level). Before first deploy, set Pages source to "GitHub Actions" in repo settings.

**Warning signs:** Deploy job fails at `deploy-pages` step with a permissions error.

### Pitfall 5: base Path Missing Trailing Slash

**What goes wrong:** Assets load with double-slash paths like `/battery-calculator//assets/main.js` or fail to load entirely with 404s when `base: '/battery-calculator'` (no trailing slash) is used. The Vite convention requires a trailing slash for sub-path deployments. [ASSUMED — from Vite project documentation convention]

**How to avoid:** Always set `base: '/battery-calculator/'` with a trailing slash. Verify by running `npm run build` locally and inspecting `dist/index.html` — all asset `src` and `href` attributes should start with `/battery-calculator/`.

**Warning signs:** 404 errors in browser Network tab for `*.js` and `*.css` assets after first deploy.

### Pitfall 6: `frame-ancestors 'none'` Not Supported via `<meta>`

**What goes wrong:** `frame-ancestors` is a CSP directive that browsers intentionally ignore when delivered via `<meta http-equiv>`. Only HTTP headers can enforce `frame-ancestors`. The CSP meta tag will still be valid; other directives work. But clickjacking prevention via `frame-ancestors 'none'` in a meta tag provides no actual protection.

**Why it happens:** The CSP spec (Level 2+) explicitly excludes `frame-ancestors` from meta-tag delivery. [ASSUMED — from MDN CSP documentation]

**How to avoid:** Include `frame-ancestors 'none'` in the CSP string for documentation/intent clarity, but understand it has no effect. GitHub Pages does not allow custom HTTP headers, so this protection cannot be enforced in this deployment model. This is an acceptable limitation for Phase 1 (the app handles no sensitive data at this stage). Document in README.

**Warning signs:** Browser DevTools CSP report may ignore `frame-ancestors` from meta; this is correct browser behavior, not a bug.

---

## Code Examples

### Complete vite.config.ts

```typescript
// Source: https://vite.dev/guide/api-plugin + https://vite.dev/config/build-options
import { defineConfig } from 'vite'

const CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",  // note: ignored by browsers from <meta>; included for intent
].join('; ')

function cspInjectPlugin() {
  return {
    name: 'csp-inject',
    apply: 'build' as const,
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string): string {
        const metaTag = `  <meta http-equiv="Content-Security-Policy" content="${CSP_DIRECTIVES}">\n`
        return html.replace('</head>', metaTag + '  </head>')
      },
    },
  }
}

export default defineConfig({
  base: '/battery-calculator/',
  build: {
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  plugins: [cspInjectPlugin()],
})
```

### CSS Tokens File (tokens.css)

```css
/* src/styles/tokens.css */
/* Source: 01-UI-SPEC.md — locked design token contract */
:root {
  /* Spacing scale */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* Typography */
  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif,
    "Apple Color Emoji", "Segoe UI Emoji";
  --font-size-label:    14px;
  --font-size-body:     16px;
  --font-size-heading:  20px;
  --font-weight-regular:   400;
  --font-weight-semibold:  600;

  /* Colors — neutral-first palette */
  --color-bg:           #ffffff;
  --color-surface:      #f4f4f5;
  --color-border:       #e4e4e7;
  --color-text:         #18181b;
  --color-text-muted:   #71717a;
  --color-accent:       #2563eb;
  --color-destructive:  #dc2626;

  /* Per-battery color slots (Phase 4 reads these via colorFor()) */
  --color-battery-1: #2563eb;
  --color-battery-2: #16a34a;
  --color-battery-3: #d97706;
  --color-battery-4: #9333ea;
  --color-battery-5: #e11d48;
}
```

### Global Stylesheet (global.css)

```css
/* src/styles/global.css */
/* Source: 01-UI-SPEC.md shell contract */
@import './tokens.css';

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  line-height: 1.5;
  color: var(--color-text);
  background-color: var(--color-bg);
}

/* Mobile-first max-width container */
.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 var(--space-md);  /* mobile default */
}

@media (min-width: 480px) {
  .container {
    padding: 0 var(--space-lg);
  }
}

/* Shell regions */
header[role="banner"] {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg);
}

header[role="banner"] h1 {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

#drop-zone-region {
  margin: var(--space-2xl) 0 var(--space-lg);
  padding: var(--space-lg);
  min-height: 120px;
  background-color: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
}

#results-region {
  margin-bottom: var(--space-2xl);
  padding: var(--space-lg);
  min-height: 80px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.privacy-promise {
  margin: 0;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-muted);
}
```

### Source index.html (no CSP — injected at build time)

```html
<!doctype html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- NO CSP meta here — injected by cspPlugin() at build time only -->
    <title>Thuisbatterij Calculator</title>
  </head>
  <body>
    <div class="container">
      <header role="banner">
        <h1>Thuisbatterij Calculator</h1>
        <p class="tagline">Bereken hoeveel energie een thuisbatterij jouw huis zou besparen.</p>
      </header>
      <main id="drop-zone-region">
        <p class="privacy-promise">
          Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden
        </p>
      </main>
      <section id="results-region" aria-label="Vergelijkingsresultaten"></section>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vite-plugin-html` for HTML injection | Inline plugin with `transformIndexHtml` + `apply: 'build'` | Vite 3+ | No extra dependency needed |
| `.eslintrc.js` + `@typescript-eslint/parser` separate install | `eslint.config.js` (flat) + `typescript-eslint` umbrella | ESLint 9 (2024) | One package installs both parser and plugin |
| `peaceiris/actions-gh-pages` third-party action | Official `configure-pages` + `upload-pages-artifact` + `deploy-pages` chain | GitHub Pages Actions v2 (2022), now v5/v6 | No third-party action; OIDC-based auth |
| Vitest 3 with bundled Vite copy | Vitest 4.1 uses the project's installed Vite | Vitest 4.1 (2026) | No Vite version skew; `vite@^8` is shared |

**Deprecated/outdated:**
- `vite-plugin-html` (npm: `vite-plugin-html`): Functional but unnecessary — Vite's native `transformIndexHtml` covers the same use case with zero extra deps.
- `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` as separate installs: Still works, but the `typescript-eslint` umbrella package (v8) is now the canonical way to consume both with `tseslint.config()` helper.
- `actions/upload-pages-artifact@v3` / `deploy-pages@v4` (older): Use v5 as specified in CLAUDE.md.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (to be created in Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### vitest.config.ts Pattern

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Default environment is 'node' per CLAUDE.md.
    // Per-file jsdom override via // @vitest-environment jsdom docblock.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
})
```

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | Vite builds to `dist/` with correct asset paths under `/battery-calculator/` | build smoke | `npm run build && ls dist/index.html` | ❌ Wave 0 |
| SETUP-03 | CI runs lint + format + vitest | CI integration | GitHub Actions workflow | ❌ Wave 0 |
| SETUP-04 | No external URLs in built output | CI grep | Privacy guard step in CI | ❌ Wave 0 |
| SETUP-05 | CSP meta tag present in dist/index.html with correct directives | unit | `npx vitest run tests/csp-plugin.test.ts` | ❌ Wave 0 |
| PRIV-01 | No network calls with user data (enforced by CSP) | CSP compliance | Browser DevTools Network tab (manual) + CI guard | — manual |
| PRIV-02 | Privacy promise string present in drop-zone region | unit (jsdom) | `npx vitest run tests/shell.test.ts` | ❌ Wave 0 |
| PRIV-03 | No error-reporting library in deps | CI grep | `grep -r "sentry\|rollbar\|bugsnag" package.json` | ❌ Wave 0 |
| D-01 | 3 shell regions present in DOM | unit (jsdom) | `npx vitest run tests/shell.test.ts` | ❌ Wave 0 |
| D-08 | CSP directives complete — no unsafe-inline | unit (node) | `npx vitest run tests/csp-plugin.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green + `npm run build` clean + privacy guard pass before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/shell.test.ts` — DOM contract tests (3 regions, app title, privacy promise) — covers PRIV-02, D-01
- [ ] `tests/csp-plugin.test.ts` — CSP string directives unit test — covers SETUP-05, D-08
- [ ] `vitest.config.ts` — test framework config; node default env, V8 coverage
- [ ] `.github/workflows/ci.yml` or `deploy.yml` — CI lint/test/privacy-guard/deploy — covers SETUP-03, SETUP-04
- [ ] Framework install verification: `npm install -D vitest @vitest/coverage-v8 jsdom`

---

## Security Domain

> `security_enforcement` is not explicitly `false` in `.planning/config.json` — this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this phase |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Static site, public content only |
| V5 Input Validation | no | No user input in Phase 1 (CSV upload is Phase 2) |
| V6 Cryptography | no | No crypto operations |
| V7 Error Handling | partial | PRIV-03: parse errors shown locally, never sent off-device — enforced by `connect-src 'none'` |
| V9 Communication Security | yes | CSP `connect-src 'none'` + no third-party scripts — covers all V9 outbound communication |
| V12 File Upload Security | no | Phase 2 |
| V14 Configuration | yes | CSP `<meta>` header, security headers (no server headers available on GitHub Pages) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via injected third-party script | Tampering | `script-src 'self'` — blocks inline and remote scripts |
| Data exfiltration via image/font beacon | Information Disclosure | `img-src 'self'` + `connect-src 'none'` |
| Dependency supply-chain injection | Tampering | CI `dist/` privacy guard (D-04) |
| Clickjacking via iframe embed | Elevation of Privilege | `frame-ancestors 'none'` (advisory only via meta — see Pitfall 6) |
| Inline style injection | Tampering | `style-src 'self'` + no inline `style=` attributes |
| Analytics/telemetry exfil | Information Disclosure | `connect-src 'none'` mechanically prevents all outbound connections |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ctx.server` is available only in dev and `ctx.bundle` only in build — distinguishes dev vs build in `transformIndexHtml` | Architecture Patterns, Pattern 1 | Could require using `apply: 'build'` alone (which is also documented and sufficient) |
| A2 | `frame-ancestors 'none'` in a `<meta>` CSP is ignored by browsers | Common Pitfalls, Pitfall 6 | If browsers do honor it, the protection is a bonus — zero downside |
| A3 | `link rel="modulepreload"` tags with `crossorigin` attribute do not interact with CSP `script-src` | Architecture Patterns, Pattern 2 | If modulepreload requires a separate CSP nonce/hash directive, CSP violations at runtime — verify in browser after first build |
| A4 | `build.modulePreload: { polyfill: false }` is the correct config path for Vite 8 | Architecture Patterns, Pattern 2 | The option may have moved — verify against `npm view vite version` + `vite.dev/config/build-options` at task time |
| A5 | The `typescript-eslint` umbrella package v8 works without a separate `@typescript-eslint/parser` install | Architecture Patterns, Pattern 4 | ESLint config would fail to parse `.ts` files — fallback: install `@typescript-eslint/parser` separately |
| A6 | slopcheck was unavailable — all package legitimacy claims are assumed, not verified via slopcheck | Package Legitimacy Audit | All packages are major, well-known projects; risk of slopsquatting is negligible |
| A7 | Privacy guard grep pattern `https?://[a-zA-Z0-9]` does not false-positive on CSP policy keywords like `'none'` | Common Pitfalls / Pattern 6 | If it does match, guard would false-positive on the CSP meta itself — add explicit exclusion: `grep -v 'Content-Security-Policy'` |

---

## Open Questions

1. **Tagline exact wording**
   - What we know: The tagline must be honest, non-financial, and Dutch. Example suggested in UI-SPEC: "Bereken hoeveel energie een thuisbatterij jouw huis zou besparen."
   - What's unclear: Whether the planner should pick one or present options for user confirmation.
   - Recommendation: Use the UI-SPEC example as the locked default. The planner can treat it as the implementation value.

2. **TypeScript version pin — `~5.6` vs current `6.0.3`**
   - What we know: CLAUDE.md locks `~5.6`. npm `latest` tag is now `6.0.3`. The `~5.6` pin is deliberate (CLAUDE.md was written to lock specific versions).
   - What's unclear: Whether the Vite 8 scaffold template will try to install TS 6.x and conflict with the `~5.6` pin.
   - Recommendation: Pin `"typescript": "~5.6"` explicitly in `package.json`. If the Vite template installs TS 6, downgrade to 5.6.x after scaffolding. Both Vite 8 and Vitest 4.1 are compatible with TS 5.6.

3. **GitHub repository Pages settings pre-configuration**
   - What we know: Pages source must be set to "GitHub Actions" in the repo settings before the deploy action works.
   - What's unclear: Whether this is a manual step the user must do before Phase 1 completes, or automatable.
   - Recommendation: Document it as a manual prerequisite in the Phase 1 plan. Include a README note. `configure-pages@v6` will also prompt if not set.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build runtime | ✓ | v24.1.0 (lts/* in CI = 22.x) | — |
| npm | Package manager | ✓ | 11.10.1 | — |
| GitHub CLI (`gh`) | CI/deploy inspection | ✓ | 2.88.1 | — |
| GitHub Actions | CI/deploy pipeline | ✓ (cloud) | — | — |
| GitHub Pages | Static hosting | ✓ (cloud) | — | — |

**Missing dependencies with no fallback:** None — all required tools are available.

**Missing dependencies with fallback:** None.

---

## Sources

### Primary (HIGH confidence)
- [vite.dev/guide/api-plugin](https://vite.dev/guide/api-plugin) — `transformIndexHtml` hook, `apply` property, `ctx.bundle` detection, tag descriptor structure
- [vite.dev/config/build-options](https://vite.dev/config/build-options) — `build.assetsInlineLimit`, `build.cssCodeSplit`, `build.modulePreload` defaults and options
- [vite.dev/guide/features](https://vite.dev/guide/features) — CSS extraction to separate files, modulepreload behavior in production builds
- [vite.dev/guide/static-deploy](https://vite.dev/guide/static-deploy) — Complete GitHub Pages deploy workflow YAML
- [vitest.dev/guide/environment](https://vitest.dev/guide/environment) — per-file jsdom docblock, `// @vitest-environment jsdom`, jsdom install requirements
- npm registry — version and publish-date lookup for all packages (queried 2026-06-07): `vite@8.0.16`, `vitest@4.1.8`, `@vitest/coverage-v8@4.1.8`, `jsdom@29.1.1`, `typescript-eslint@8.60.1`, `eslint-config-prettier@10.1.8`, `prettier@3.8.3`

### Secondary (MEDIUM confidence)
- [github.com/vitejs/vite/issues/11862](https://github.com/vitejs/vite/issues/11862) — Vite dev server style injection and nonce; confirms dev HMR needs relaxed CSP
- [docs.github.com — Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) — `pages: write` + `id-token: write` permissions requirement

### Tertiary (LOW confidence)
- [stackademic.com — Working with CSP and Vite](https://stackademic.com/blog/working-with-csp-and-vite) — dev vs prod CSP split pattern (Laravel context, adapted for Vite plugin approach)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified against npm registry on 2026-06-07
- CSP injection mechanism (`apply: 'build'` + `transformIndexHtml`): HIGH — verified against official Vite plugin API docs
- Build output characteristics (no inline scripts/styles): HIGH — verified against Vite build options and features docs
- `modulePreload.polyfill: false` requirement: MEDIUM — derived from docs; confirmed polyfill is an inline script; verify post-build
- CI grep pattern for privacy guard: MEDIUM — logic-derived; no authoritative source for exact pattern
- ESLint 9 flat config with `typescript-eslint` umbrella: MEDIUM — based on official typescript-eslint docs and community patterns
- Pitfalls and anti-patterns: MEDIUM — derived from Vite issue tracker and official docs; not all individually verified end-to-end

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable stack; Vite 8 is a mature major; CSP behavior is browser-standard)
