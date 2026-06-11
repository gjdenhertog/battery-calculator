---
phase: 04
slug: comparison-engine-comparison-table-saldering-side-by-side-wo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x |
| **Config file** | vite.config.ts / vitest config (existing) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && npm run build` |
| **Estimated runtime** | ~10 seconds (unit) + build |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run && npm run build`
- **Before `/gsd:verify-work`:** Full suite + production `vite build` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner per task_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install comlink @preact/signals-core` — new dependencies (not yet in package.json)
- [ ] Production `vite build` emits Comlink worker chunk under `assets/` (smoke-test, gates all later waves)
- [ ] CSP `worker-src 'self' blob:` verified against the production worker chunk URL

*Pure-function domain modules (compare/saldering/colorFor) are imported directly in Vitest — no worker in tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI stays interactive while worker computes (no dropped frames >200ms) | SIM-07 | Frame timing during real worker run is not unit-testable | Drag a slider / toggle batteries while a large CSV simulates; observe "Rekenen…" indicator + responsive controls |
| Per-battery color preserved into Phase 5 charts | COMP-08 | Visual cross-phase continuity | Manual visual check; `colorFor(batteryId)` covered by unit test |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
