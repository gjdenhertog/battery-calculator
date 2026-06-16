---
phase: "01"
plan: "03"
subsystem: ci-deploy
tags: [github-actions, github-pages, ci, privacy-guard, csp, readme]
dependency_graph:
  requires:
    - Plan 01-01 (vite.config.ts + dist/ build output)
  provides:
    - .github/workflows/deploy.yml — CI gate + Pages deploy pipeline
    - README.md — privacy promise + manual Network-tab verification + Pages prerequisite
  affects:
    - All future pushes to main (CI runs on every push)
    - Live deployment at https://geraldjoachimdenhertog.github.io/battery-calculator/
tech_stack:
  added:
    - actions/checkout@v6
    - actions/setup-node@v6
    - actions/configure-pages@v6
    - actions/upload-pages-artifact@v5
    - actions/deploy-pages@v5
    - actions/upload-artifact@v4
    - actions/download-artifact@v4
  patterns:
    - Two-job workflow (ci + deploy with needs: ci gate)
    - Privacy guard via grep -rE on built dist/ output
    - PRIV-03 check via grep on package.json for sentry/rollbar/bugsnag
    - Artifact hand-off between ci and deploy jobs (upload-artifact/download-artifact)
key_files:
  created:
    - .github/workflows/deploy.yml
    - README.md
  modified: []
decisions:
  - "Two-job workflow (ci + deploy with needs:ci) ensures broken push never deploys"
  - "Privacy guard scans built dist/ output not source — catches build-time-injected URLs (D-04)"
  - "Artifact hand-off via upload-artifact@v4/download-artifact@v4 between jobs"
  - "README written in Dutch to match NL audience; privacy promise verbatim in Dutch"
  - "frame-ancestors advisory-only limitation documented in README (Pitfall 6)"
  - "Task 3 live-deploy verification DEFERRED — local verification passed, no git remote yet"
requirements-completed: [SETUP-03, SETUP-04, PRIV-01, PRIV-03]
# NOTE: SETUP-02 (live reachability) is deferred pending human UAT after repo + remote are set up
metrics:
  duration: "~5m"
  completed_date: "2026-06-07"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 0
---

# Phase 01 Plan 03: CI + Deploy Workflow + Privacy Guard + README Summary

**Two-job GitHub Actions workflow (ci gate with privacy guard + no-reporting-lib check, deploy gated on ci) and Dutch README documenting the zero-network-requests promise with manual Network-tab verification — code artifacts complete, live deploy verification deferred pending GitHub remote setup.**

---

## Performance

- **Duration:** ~5m
- **Started:** 2026-06-07
- **Completed:** 2026-06-07
- **Tasks:** 2 of 3 complete (Task 3 deferred — no false claim of live verification)
- **Files modified:** 2 created, 0 modified

---

## Accomplishments

- CI + deploy workflow wired: lint, format check, vitest, privacy guard (dist/ scan), PRIV-03 no-reporting-lib check, all gated before Pages deploy
- Live deploy strictly gated on ci job (`needs: ci`) — broken push cannot deploy
- README documents privacy promise verbatim in Dutch, manual Network-tab verification steps, and the one-time GitHub Pages prerequisite
- Local verification passed: build OK, CSP meta present, privacy guard reports zero external URLs, 18 tests green

---

## Task Commits

1. **Task 1: CI + deploy workflow with privacy guard and no-reporting-lib check** — `865dfd3` (feat)
2. **Task 2: README documenting privacy promise + manual Network-tab verification** — `8b404ac` (docs)
3. **Task 3: Live deploy verification** — DEFERRED (see below)

**Plan metadata:** `68491c6` (docs: complete CI/deploy plan — paused at live deploy checkpoint)

---

## Files Created/Modified

- `.github/workflows/deploy.yml` — CI gate (build/lint/format/test/privacy-guard/no-reporting-lib) + Pages deploy with `needs: ci`; locked action chain per CLAUDE.md
- `README.md` — Dutch privacy promise, manual Network-tab verification, local dev commands, Pages setup prerequisite, frame-ancestors advisory note

---

## What Was Built

### Task 1: CI + Deploy Workflow (commit 865dfd3)

`.github/workflows/deploy.yml` — locked action chain per CLAUDE.md:

**ci job (ubuntu-latest):**
- `actions/checkout@v6` + `actions/setup-node@v6` (lts/*, npm cache)
- `npm ci` → `npm run build` → `npm run lint` → `npm run format:check` → `npm test`
- **Privacy guard (D-04):** `grep -rE 'https?://[a-zA-Z0-9]'` over `dist/*.{html,js,css}`, excluding `.map` and `//# sourceMappingURL`. Fails with "PRIVACY GUARD FAILED" if any external URL found in built output.
- **PRIV-03 check:** `grep -Ei 'sentry|rollbar|bugsnag'` on `package.json` + `package-lock.json`. Fails if any error-reporting library found.
- `actions/upload-artifact@v4` — uploads `dist/` for deploy job

**deploy job (needs: ci):**
- `actions/download-artifact@v4` — retrieves `dist/` artifact
- `actions/configure-pages@v6`
- `actions/upload-pages-artifact@v5` (path: `dist/`)
- `actions/deploy-pages@v5` (id: deployment)
- `environment: github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`

Workflow-level permissions: `contents: read`, `pages: write`, `id-token: write` (Pitfall 4 avoided).
Concurrency: `group: pages`, `cancel-in-progress: true`.
No third-party deploy action (peaceiris/JamesIves excluded per CLAUDE.md).

**Privacy guard self-verified locally:** Ran the guard pattern against existing `dist/` — PASS (zero external URLs).

### Task 2: README (commit 8b404ac)

`README.md` — Dutch-language documentation matching NL audience:

- Project description: NL home-battery sizing tool, fully client-side
- **Privacy section:** Zero-network-requests promise + verbatim privacy promise string "Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden"
- **Verify it yourself subsection:** Step-by-step manual Network-tab inspection (DevTools → Network, reload, confirm 0 third-party requests) — documented manual check complementing the CI guard (D-04)
- **Local dev:** npm install, dev, build, test, lint, format:check commands
- **Deployment:** CI gate description + one-time GitHub Pages prerequisite (Settings → Pages → Source = "GitHub Actions")
- **Security notes:** `frame-ancestors 'none'` advisory-only limitation via `<meta>` documented (Pitfall 6)

### Task 3: Live Deploy Verification — DEFERRED (NOT VERIFIED)

**Status: DEFERRED — live deploy has NOT been verified. No false claim of verification.**

The user confirmed that local verification passed:
- Build succeeds (`npm run build` clean)
- CSP meta tag present in built `dist/index.html`
- Privacy guard reports zero external URLs in `dist/`
- No error-reporting libs detected
- 18 tests green (`npm test`)

However, no git remote exists yet. The live GitHub Pages deploy cannot run until a remote repository is created and the first push lands. Task 3 verification is deferred to human UAT.

**Requirements affected by this deferral:**
- SETUP-02 (live reachability at the Pages URL) — NOT YET VERIFIED, pending human UAT
- PRIV-01 (zero third-party requests, browser-confirmed) — local CI guard passes; browser confirmation deferred
- SETUP-05 (no CSP/console errors in live browser) — deferred

---

## Deferred Human UAT: Live Deploy Verification

When a git remote is created and the repo is pushed to GitHub, the following steps MUST be completed by the user before SETUP-02 can be marked verified:

**Prerequisite (one-time):**
- GitHub repo → Settings → Pages → Source = "GitHub Actions"

**Verification steps:**
1. Push to `main` so the deploy workflow runs. Confirm Actions run is green (ci job passed, deploy job succeeded).
2. Open `https://<your-user>.github.io/battery-calculator/` in a FRESH incognito window.
3. Confirm the hello-world shell renders: header "Thuisbatterij Calculator" + tagline, the drop-zone region showing the privacy promise "Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden", and the (bare) results placeholder.
4. Open DevTools Console — confirm NO errors and NO CSP violation reports.
5. Open DevTools Network tab, reload — confirm only `self`-origin requests (the page + `/battery-calculator/assets/*.js` + `*.css`) and ZERO requests to any third-party origin after the bundle loads.
6. Confirm no 404s in the Network tab (base-path assets resolve under `/battery-calculator/`).
7. (Optional) Confirm a deliberately-broken push fails the ci job and does not deploy — or trust the `needs: ci` gate.

---

## Decisions Made

- Two-job workflow (`ci` + `deploy` with `needs: ci`) so a broken push can never deploy
- Privacy guard scans built `dist/` output (not source) — catches build-time-injected third-party URLs (D-04)
- Artifact hand-off via `upload-artifact@v4` / `download-artifact@v4` between the two jobs
- README written in Dutch to match NL audience; verbatim privacy promise in Dutch
- `frame-ancestors 'none'` advisory-only limitation documented in README (Pitfall 6 from RESEARCH)
- Task 3 live-deploy verification deferred: local checks pass, no git remote exists yet, user will verify after repo is created

---

## Deviations from Plan

None in Tasks 1 and 2 — executed exactly as written. Action versions matched CLAUDE.md locks. Privacy guard pattern matched RESEARCH Pattern 6.

Task 3 was a `checkpoint:human-verify` — the user chose to defer live verification (no remote yet). This is not a deviation from the task type; it is the documented deferred-UAT outcome.

---

## Known Stubs

None. The workflow and README contain no placeholder content.

---

## Requirements Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| SETUP-02 | DEFERRED — pending live deploy | Needs GitHub remote + push + Pages config |
| SETUP-03 | COMPLETE | CI gate: build/lint/format/test all required before deploy |
| SETUP-04 | COMPLETE | Privacy guard scans built dist/ for external URLs |
| PRIV-01 | PARTIAL — CI guard complete, browser verification deferred | Browser confirmation requires live page |
| PRIV-03 | COMPLETE | No-reporting-lib check (sentry/rollbar/bugsnag) in CI |

---

## Threat Flags

No new security surface beyond the plan's threat model. All STRIDE threats addressed:

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-01-03-01 (build-injected CDN/analytics) | Mitigated — CI privacy guard in deploy.yml step "Privacy guard" |
| T-01-03-02 (Sentry/Rollbar/Bugsnag) | Mitigated — CI step "No error-reporting library check" |
| T-01-03-03 (broken build deploys) | Mitigated — `needs: ci` on deploy job |
| T-01-03-04 (over-broad token permissions) | Mitigated — `contents: read`, `pages: write`, `id-token: write` only |
| T-01-03-SC (third-party action supply chain) | Mitigated — official actions/* chain only at locked versions |

---

## User Setup Required

**One-time GitHub Pages configuration required before live deploy works:**

1. Create the GitHub repository (if not done)
2. Push `main` branch to remote: `git remote add origin https://github.com/<user>/battery-calculator.git && git push -u origin main`
3. GitHub repo → Settings → Pages → Build and deployment → Source = "GitHub Actions"
4. First push after step 3 will trigger the workflow and deploy the live page

---

## Next Phase Readiness

Phase 01 code artifacts are complete:
- Scaffold (01-01): toolchain, shell, CSP, design tokens, 18 tests
- Contract tests (01-02): CSP directive lock + shell DOM contract lock
- CI/deploy (01-03): workflow live, privacy guard enforced, README complete

**Blocker before Phase 2 can deploy live results:** Live page verification (SETUP-02) is deferred; this does not block Phase 2 domain work (parsers, types, simulator) which is purely local/test-driven.

Phase 2 needs a real HomeWizard P1 CSV sample during planning to confirm exact column names and unit conventions.

---

## Self-Check: PASSED

**Files verified:**

- [x] `.github/workflows/deploy.yml` — exists, valid structure, all locked versions present (commits 865dfd3)
- [x] `README.md` — exists, contains "Network", "GitHub Actions", "npm run dev", verbatim privacy promise (commit 8b404ac)

**Commits verified:**

- [x] 865dfd3 — feat(01-03): add CI + GitHub Pages deploy workflow with privacy guard
- [x] 8b404ac — docs(01-03): add README with privacy promise, Network-tab verification, Pages setup

**Deferred item logged:** Task 3 (live deploy verification) explicitly documented as NOT verified — deferred to human UAT after git remote is established.

---

*Phase: 01-setup-deploy-plumbing-privacy-rules*
*Completed: 2026-06-07*
