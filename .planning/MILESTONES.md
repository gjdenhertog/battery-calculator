# Milestones

## v1.0 MVP (Shipped: 2026-06-16)

**Phases completed:** 6 phases, 27 plans, 46 tasks
**Codebase:** ~12,400 LOC (TypeScript, src + tests), 423 tests
**Timeline:** 2026-05-25 → 2026-06-16
**Live:** https://gjdenhertog.github.io/battery-calculator/

**Delivered:** A fully client-side, NL-only home-battery calculator. A Dutch consumer uploads their own P1/energy CSV, picks catalog and/or custom batteries, and gets an honest side-by-side comparison of how much grid import each battery would have avoided — with no data ever leaving the browser.

**Key accomplishments:**

- **Phase 1 — Setup, deploy, privacy:** Vite + TS scaffold deployed to GitHub Pages via a two-job Actions pipeline (CI gate: typecheck/build/lint/format/test + privacy guard + no-error-reporting-lib check; deploy gated on CI). Maximal-lockdown CSP (`default-src`/`connect-src 'none'`), zero third-party scripts.
- **Phase 2 — CSV parsing & time series:** Browser-side HomeWizard P1 parsing (papaparse), DST-safe Europe/Amsterdam bucketing (`@date-fns/tz` `TZDate`), finer-wins multi-file merge, an open-closed parser registry, and synthesized + real DST fixtures.
- **Phase 3 — Battery simulator & catalog:** Pure per-interval dispatch engine (`simulate()`) with sqrt(rte) round-trip physics, DoD cap, and power clamping — locked by 16 hand-computed Vitest fixtures — plus a curated 7-entry NL catalog (Sessy 5 kWh default).
- **Phase 4 — Comparison engine & UI:** Reactive `@preact/signals-core` state + Comlink parser/sim workers, wired end-to-end into a side-by-side multi-battery comparison table with saldering columns; a length-mismatch worker race caught and fixed in live verification.
- **Phase 5 — Visualizations & honesty:** uPlot monthly self-consumption bars + sample-week energy-flow chart, a transparent-assumptions panel, a "no euros" explainer, mobile reflow, and a Dutch terminology audit.
- **Phase 6 — Post-v1 UX:** Multiple custom batteries (add/edit/remove, cap, order-based colors) and an optional saldering mode that is OFF by default; plus a deferred-commit button so editing a custom battery no longer recomputes on every keystroke.

**Known limitation (documented):** The October DST fall-back parsing is only correct when the JS runtime timezone is Europe/Amsterdam (fine for the NL-only target; test suite pinned to that zone). Hardening it is a follow-up if the app ever expands beyond NL.

---
