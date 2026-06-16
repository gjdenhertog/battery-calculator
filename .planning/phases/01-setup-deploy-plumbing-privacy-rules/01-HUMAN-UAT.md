---
status: resolved
phase: 01-setup-deploy-plumbing-privacy-rules
source: [01-VERIFICATION.md]
started: 2026-06-07T22:36:00Z
updated: 2026-06-16T00:00:00Z
resolved: 2026-06-16T00:00:00Z
---

## Current Test

[RESOLVED at v1.0 milestone close — live deployment verified; see Test 1 result]

## Tests

### 1. Verify live GitHub Pages deployment
expected: Page renders at `https://<user>.github.io/battery-calculator/` with the header "Thuisbatterij Calculator", the drop-zone privacy promise ("Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden"), and a bare results placeholder — with no console errors, no CSP violations, zero third-party network requests, and no asset 404s.
result: [passed] — Verified 2026-06-16 against the live site https://gjdenhertog.github.io/battery-calculator/. HTTP 200; served HTML references the built hashed assets (/battery-calculator/assets/index-*.js + .css, no /src/main.ts); both assets + favicon.svg return 200 (no 404s); header, privacy promise, and CSP meta present. Pages source is "GitHub Actions" (deploy job succeeds). Zero-third-party-request invariant guaranteed by CSP default-src/connect-src 'none' + green CI privacy guard, and confirmed visually during Phase 6's approved live human-verify.
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
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
