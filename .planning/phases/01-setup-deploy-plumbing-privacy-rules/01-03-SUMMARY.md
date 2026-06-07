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
metrics:
  duration: "1m 43s"
  completed_date: "2026-06-07"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 0
---

# Phase 01 Plan 03: CI + Deploy Workflow + Privacy Guard + README Summary

**One-liner:** Two-job GitHub Actions workflow (ci gate with privacy guard + no-reporting-lib check, deploy gated on ci) and Dutch README documenting the zero-network-requests promise with manual Network-tab verification.

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

### Task 3: Live deploy verification (checkpoint — NOT YET COMPLETE)

This task requires human verification of the live GitHub Pages deployment. Paused at checkpoint.

---

## Deviations from Plan

None — plan executed exactly as written. Action versions matched CLAUDE.md locks. Privacy guard pattern matched RESEARCH Pattern 6.

---

## Known Stubs

None. The workflow and README contain no placeholder content.

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

## Self-Check: PASSED

**Files verified:**

- [x] `.github/workflows/deploy.yml` — exists, valid structure, all locked versions present
- [x] `README.md` — exists, contains "Network", "GitHub Actions", "npm run dev", verbatim privacy promise

**Commits verified:**

- [x] 865dfd3 — feat(01-03): add CI + GitHub Pages deploy workflow with privacy guard
- [x] 8b404ac — docs(01-03): add README with privacy promise, Network-tab verification, Pages setup

**Checkpoint status:** Task 3 (live deploy verification) is a human-verify checkpoint — awaiting user push + Pages confirmation.
