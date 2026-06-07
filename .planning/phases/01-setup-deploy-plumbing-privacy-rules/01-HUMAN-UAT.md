---
status: partial
phase: 01-setup-deploy-plumbing-privacy-rules
source: [01-VERIFICATION.md]
started: 2026-06-07T22:36:00Z
updated: 2026-06-07T22:36:00Z
---

## Current Test

[awaiting human testing — requires a GitHub remote + Pages configuration]

## Tests

### 1. Verify live GitHub Pages deployment
expected: Page renders at `https://<user>.github.io/battery-calculator/` with the header "Thuisbatterij Calculator", the drop-zone privacy promise ("Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden"), and a bare results placeholder — with no console errors, no CSP violations, zero third-party network requests, and no asset 404s.
result: [pending]
steps:
  1. Create the GitHub repository and add it as `origin`; push `main`.
  2. Repo Settings → Pages → Build and deployment → Source → "GitHub Actions".
  3. Confirm the Actions run is green: `ci` job (typecheck + build + lint + format + test + privacy guard + no-reporting-lib) then `deploy`.
  4. Open the live URL in a fresh incognito window — confirm the 3-region shell renders.
  5. DevTools Console — confirm no errors and no CSP violation reports.
  6. DevTools Network tab, reload — confirm ZERO third-party requests (only `/battery-calculator/` self-origin assets) and no 404s.
covers: [SETUP-02, PRIV-01 (browser-level confirmation)]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
