---
status: complete
quick_id: 260608-jx7
description: "Harden Phase 01 GitHub Pages deploy: add favicon, document required Pages source, bump artifact actions to Node 24"
source_gap: ".planning/phases/01-setup-deploy-plumbing-privacy-rules/01-UAT.md (Test 4)"
debug_ref: ".planning/debug/pages-no-styling-404.md"
completed_date: "2026-06-08"
tasks_completed: 3
tasks_total: 3
---

# Quick Task 260608-jx7: Harden Phase 01 GitHub Pages Deploy — Summary

**One-liner:** Gap-closure for the live-deploy UAT finding — added a same-origin SVG favicon (clearing the benign `/favicon.ico` 404), documented that GitHub Pages Source MUST be "GitHub Actions" (the actual root cause of the no-styling/`main.ts`-404 bug), and bumped the two generic artifact actions to v5 (Node 24) ahead of GitHub's 2026-06-16 Node 20 cutoff.

> Note: the **primary** UAT root cause (Pages Source set to legacy branch-deploy) is a repo *Settings* change, not a code change. This task documents it to prevent recurrence; the user flips the actual setting in the GitHub UI / via `gh api`.

---

## What Was Built

### Task 1 — Favicon (commit f75f00f, corrected in 9e4b395)
- `public/favicon.svg` — minimal, self-contained battery-glyph SVG (battery body + terminal + ~70% charge fill, single brand-green `#2c7a3f`). No external references, no remote fonts/images — stays same-origin so the CI privacy guard and CSP `img-src 'self'` both pass.
- `index.html:6` — `<link rel="icon" type="image/svg+xml" href="%BASE_URL%favicon.svg" />`. Uses Vite's base-aware `%BASE_URL%` token rather than a literal href, so it resolves to `/battery-calculator/favicon.svg` in the built output (a literal `/favicon.svg` would 404 under the project subpath — the same class of base-path trap behind the original deploy bug).
- Verified: `favicon.svg` lands in `dist/`, and built `dist/index.html` references `/battery-calculator/favicon.svg`.

### Task 2 — Docs + CI bump (commit b0dde91)
- `README.md` (Dutch) — replaced the weak "rechtenprobleem" framing of the Pages-Source requirement with the actual failure mechanism: in legacy "Deploy from a branch" mode GitHub serves the un-built repo root (source `index.html` → `/src/main.ts` 404 + no stylesheet), silently ignoring the Actions `dist/` artifact. Setting Source to "GitHub Actions" uses the built artifact as intended.
- `.github/workflows/deploy.yml` — `actions/upload-artifact@v4 → @v5` and `actions/download-artifact@v4 → @v5` (Node 24). The Pages-specific chain (`configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`, `checkout@v6`, `setup-node@v6`) was deliberately left untouched — the v6/v5/v5 asymmetry is correct.
- `CLAUDE.md` — added a Version Compatibility row for `upload-artifact@v5` + `download-artifact@v5`, explicitly distinguishing them from the Pages chain and noting the Node 20→24 deprecation, so docs and workflow stay consistent.

### Task 3 — Verification gate
- `npm run build` clean; favicon present in `dist/` and href base-prefixed correctly.
- `npx vitest run` — 18/18 tests pass.
- Privacy guard run locally over `dist/` — PASS (no external URLs / outbound calls).

---

## Deviations

**1. SVG `xmlns` removed then restored (executor → orchestrator correction).** The executor's initial SVG included `xmlns="http://www.w3.org/2000/svg"`, which tripped the privacy-guard grep (`(https?:)?//[a-z0-9.-]` matches `//www.w3.org`). The executor "fixed" this by deleting the `xmlns` (commit e35122d). That was wrong: a standalone SVG loaded via `<link rel="icon">` is parsed as an independent XML document and **requires** the `xmlns` declaration to render — removing it would have left the favicon non-rendering, defeating the change.

**Correction (commit 9e4b395):** restored `xmlns` on the favicon, and fixed the root cause in the privacy guard — it now **strips** W3C namespace declarations (`xmlns(:x)?="http://www.w3.org/..."`) before the detection pass rather than matching them. W3C namespace URIs are standardized identifiers the browser never fetches (not an exfil vector). The strip is surgical, not line-wide: a real external URL sharing a line with an `xmlns` decl is still caught (verified with a negative-control test).

---

## Privacy / Security Notes

- No new external surface. Favicon is inline, same-origin SVG; CSP unchanged (`img-src 'self'` already permits it).
- Privacy guard was *strengthened in precision*, not weakened: it still flags any genuine external URL, including ones hidden on an `xmlns` line, while no longer false-positiving on the mandated SVG namespace.

---

## Commits

| Hash | Subject |
|------|---------|
| f75f00f | feat(260608-jx7): add same-origin SVG favicon and wire into index.html |
| b0dde91 | chore(260608-jx7): bump artifact actions v4→v5 and document Pages Source requirement |
| e35122d | fix(260608-jx7): remove xmlns from favicon.svg to pass CI privacy guard *(superseded)* |
| 83161ec | chore: merge quick task worktree |
| 9e4b395 | fix(260608-jx7): restore favicon xmlns; scope privacy guard to ignore W3C namespace URIs |

---

## Follow-ups (outside this task)

- **User action:** flip GitHub Pages Source to "GitHub Actions" (Settings → Pages → Build and deployment → Source), or `gh api -X POST repos/<owner>/battery-calculator/pages -f build_type=workflow`, then re-run deploy and re-verify 01-UAT.md Test 4.
