---
status: diagnosed
trigger: "The pages work, but there doesn't seemto be any styling, I also see two 404 errors (main.ts and favicon.ico)"
created: 2026-06-08T00:00:00Z
updated: 2026-06-08T00:00:00Z
---

## Current Focus

hypothesis: dist/index.html ships hashed assets under /battery-calculator/ base correctly, so the live 404 on main.ts indicates the deployed HTML is NOT the built dist/index.html — OR a base/path mismatch. Need byte-for-byte dist/index.html evidence.
test: run `npm run build`, cat dist/index.html, inspect script/link hrefs
expecting: if dist/index.html references hashed /battery-calculator/assets/*.js then build is correct and deploy serves wrong content; if it references /src/main.ts then build plugin failed
next_action: run build and inspect dist/index.html

## Symptoms

expected: Live GitHub Pages site renders with full styling, JS/CSS load with no 404s
actual: No styling; two 404s — main.ts and favicon.ico. Local `npm run preview` works (Tests 1-3 pass).
errors: 404 main.ts, 404 favicon.ico on live site only
reproduction: open deployed GitHub Pages URL (Test 4 in 01-UAT.md)
started: discovered during UAT; local preview always worked

## Eliminated

- hypothesis: vite.config.ts base is wrong for the project subpath
  evidence: base is correctly '/battery-calculator/' (vite.config.ts:36); dist/index.html emits hrefs prefixed with /battery-calculator/
  timestamp: 2026-06-08
- hypothesis: cspInjectPlugin / transformIndexHtml breaks the built HTML
  evidence: dist/index.html:4 has correct CSP meta; lines 10-11 have correct hashed script+link tags. Build output is well-formed.
  timestamp: 2026-06-08
- hypothesis: deploy.yml uploads source/root instead of dist/
  evidence: deploy.yml:74-77 uploads dist/; deploy.yml:93-95 upload-pages-artifact path is dist/. Workflow artifact is correct.
  timestamp: 2026-06-08

## Evidence

- timestamp: 2026-06-08
  checked: npm run build output + dist/index.html byte-for-byte
  found: dist/index.html line 10 = <script type="module" crossorigin src="/battery-calculator/assets/index-4vRq_liQ.js">; line 11 = <link rel="stylesheet" crossorigin href="/battery-calculator/assets/index-0kp_YPso.css">. The source /src/main.ts tag is GONE. CSP meta injected at line 4.
  implication: The BUILD is fully correct. Live 404 on main.ts must mean the deployed content is the SOURCE tree (index.html:26 = <script type="module" src="/src/main.ts">), not dist/.

- timestamp: 2026-06-08
  checked: gh api repos/:owner/:repo/pages
  found: "build_type":"legacy","source":{"branch":"main","path":"/"} — Pages is in legacy/branch-deploy mode serving repo ROOT of main, NOT the GitHub Actions artifact.
  implication: ROOT CAUSE. GitHub Pages serves the un-built source index.html from the repo root. That HTML references /src/main.ts (which is a 404 on a static host — no Vite dev server to transpile it) and has NO stylesheet link (CSS is only injected by the build), so the page renders unstyled. The Actions deploy workflow runs successfully but its artifact is ignored because Pages source is set to branch, not "GitHub Actions".

- timestamp: 2026-06-08
  checked: favicon presence (find, no public/ dir)
  found: No favicon.ico anywhere in repo, no public/ dir, no <link rel=icon> in index.html.
  implication: The favicon.ico 404 is the browser's automatic /favicon.ico request. Under the WRONG (legacy/root) deploy it 404s at /battery-calculator/favicon.ico. It is largely benign/cosmetic and would ALSO 404 even after the deploy source is fixed (no favicon is shipped) — UNLESS a favicon is added. It is a SEPARATE, minor issue from the styling/main.ts failure. Not part of the same base-path mechanism.

## Resolution

root_cause: GitHub Pages for gjdenhertog/battery-calculator is configured in legacy branch-deploy mode (source = branch:main, path:/). It serves the repository ROOT directly, which is the unbuilt Vite SOURCE tree. The served index.html contains <script type="module" src="/src/main.ts"> (index.html:26) — on a static host with no Vite dev server, /src/main.ts 404s — and contains NO <link> to the CSS (the stylesheet is only emitted by `vite build` into dist/index.html), so the page renders with no styling. The deploy.yml GitHub Actions workflow builds dist/ and uploads it correctly, but the artifact is ignored because Pages is not set to "GitHub Actions" as its source. Local `npm run preview` works because it serves the correct dist/ output at the base path.
fix: Change the GitHub Pages source from legacy branch (main:/) to "GitHub Actions". This is a repository SETTINGS change (Settings > Pages > Build and deployment > Source: GitHub Actions), achievable via `gh api -X POST repos/gjdenhertog/battery-calculator/pages -f build_type=workflow` (or PUT to update). No code change required for the primary failure. Optionally: add a favicon (e.g. public/favicon.ico or public/favicon.svg + <link rel="icon">) to eliminate the secondary favicon.ico 404.
verification: After switching source to GitHub Actions and re-running the deploy workflow, the live URL should serve dist/index.html — load /battery-calculator/assets/index-*.js and index-*.css with no 404 on main.ts, and render with styling.
files_changed: []
