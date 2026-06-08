---
status: diagnosed
phase: 01-setup-deploy-plumbing-privacy-rules
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-06-08T10:01:33Z
updated: 2026-06-08T10:06:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: From a clean state, `rm -rf dist node_modules/.vite && npm run build && npm run preview` completes with no errors, emits dist/index.html, and the preview URL loads the rendered page (not blank / not 404).
result: pass

### 2. App Shell Renders Locally
expected: Open the preview/dev URL. The page shows the header "Thuisbatterij Calculator", the drop-zone region with the verbatim privacy promise ("Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden"), and a bare results placeholder region below it. Layout is readable on a normal browser window.
result: pass

### 3. Clean Console + Zero Third-Party Requests (local)
expected: With the local page open, DevTools Console shows no errors and no CSP violation reports. In the Network tab, reload — every request is same-origin (the local preview host); there are zero requests to any external domain (no fonts, analytics, CDNs) and no 404s.
result: pass

### 4. Live GitHub Pages Deployment
expected: After pushing to GitHub and enabling Pages (Settings → Pages → Source → "GitHub Actions"), the Actions run is green (ci job: typecheck + build + lint + format + test + privacy guard + no-reporting-lib, then deploy). The live URL https://<user>.github.io/battery-calculator/ renders the same 3-region shell in a fresh incognito window — no console errors, no CSP violations, zero third-party network requests, no asset 404s.
result: issue
reported: "The pages work, but there doesn't seemto be any styling, I also see two 404 errors (main.ts and favicon.ico)"
severity: major

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The live GitHub Pages site renders with full styling and loads its JS/CSS assets with no 404s"
  status: failed
  reason: "User reported: The pages work, but there doesn't seemto be any styling, I also see two 404 errors (main.ts and favicon.ico)"
  severity: major
  test: 4
  root_cause: "GitHub Pages is configured in legacy branch-deploy mode (Pages API: build_type=legacy, source=main:/), so Pages serves the un-built repo root (source index.html referencing /src/main.ts with no CSS link) and ignores the Actions deploy artifact entirely. /src/main.ts 404s on a static host and no stylesheet loads. The build (dist/index.html), vite base path, and deploy.yml are all correct — the artifact is simply never used. Local `npm run preview` works because it serves dist/ directly, masking the mismatch."
  artifacts:
    - path: "GitHub repo Settings → Pages (not a file)"
      issue: "Source set to legacy branch deploy (main:/) instead of 'GitHub Actions'; serves source tree, not the built dist/ artifact"
    - path: "index.html:26"
      issue: "Source entry <script type=module src=/src/main.ts> — correct for a Vite source file, but it is what gets wrongly served live; no edit needed"
  missing:
    - "Switch Pages source to 'GitHub Actions' (Settings → Pages → Build and deployment → Source), or run: gh api -X POST repos/<owner>/battery-calculator/pages -f build_type=workflow, then re-run the deploy workflow — PRIMARY fix, no code change"
    - "Document the required 'GitHub Actions' Pages source in the phase deploy plan / README so it isn't re-encountered"
    - "(Separate, minor) Add a favicon (public/favicon.svg + <link rel=icon> in index.html) to clear the benign /favicon.ico 404"
  debug_session: .planning/debug/pages-no-styling-404.md
