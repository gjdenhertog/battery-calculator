# Phase 1: Setup, Deploy Plumbing, Privacy Rules - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 1-Setup, Deploy Plumbing, Privacy Rules
**Areas discussed:** Hello-world page shape, CSP & privacy-guard strictness, Styling approach, Phase-1 test scope

---

## Hello-world page shape

### How much of the eventual app layout should land in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Full 3-region shell | Header + drop-zone region (privacy promise) + results placeholder; Phases 2–5 fill in place | ✓ |
| Drop-zone region only | Titled page with just the drop-zone placeholder block | |
| You decide | Pragmatic middle | |

**User's choice:** Full 3-region shell

### How should the stubbed region(s) read to a visitor before features exist?

| Option | Description | Selected |
|--------|-------------|----------|
| Honest "in aanbouw" note | Short Dutch placeholder line in the drop-zone region | |
| Bare region, no copy | Empty styled region with only the privacy promise | ✓ |
| You decide | Best 'intentional, not broken' signal | |

**User's choice:** Bare region, no copy
**Notes:** Drop-zone region carries only the required privacy promise; results region is an empty styled placeholder.

---

## CSP & privacy-guard strictness

### How strict should the CSP be from day one?

| Option | Description | Selected |
|--------|-------------|----------|
| Maximal lockdown | default-src 'none' + explicit 'self' allows; connect-src 'none'; base-uri/form-action/frame-ancestors locked; no 'unsafe-inline' | ✓ |
| Baseline 'self' | Only script/style/connect-src 'self' per SETUP-05 | |
| You decide | Strictest that still builds under Vite | |

**User's choice:** Maximal lockdown
**Notes:** Flagged that strict connect-src 'none' must not break Vite dev-server HMR — dev-vs-prod CSP handling to be resolved in planning.

### How should 'no third-party requests' be enforced in CI?

| Option | Description | Selected |
|--------|-------------|----------|
| Automated dist/ guard + README note | CI step fails on any external URL/third-party domain in dist/ + manual Network-tab note | ✓ |
| README note only | Manual inspection note only (SETUP-04 minimum) | |
| You decide | Durable automated guarantee without false positives | |

**User's choice:** Automated dist/ guard + README note

---

## Styling approach

### What CSS convention should the project adopt?

| Option | Description | Selected |
|--------|-------------|----------|
| Design-token baseline + global CSS | :root custom properties (colors, spacing, font, per-battery color slots) + global stylesheet; system fonts | ✓ |
| Single global stylesheet | One plain style.css, no token layer | |
| Co-located component CSS | CSS next to each UI module | |

**User's choice:** Design-token baseline + global CSS
**Notes:** System-font stack chosen implicitly to avoid web-font fetch (privacy + CSP).

### Set up the mobile-readable baseline now, or defer to Phase 5?

| Option | Description | Selected |
|--------|-------------|----------|
| Establish baseline now | viewport meta, box-sizing reset, mobile-first max-width container | ✓ |
| Defer to Phase 5 | Desktop-only shell now; responsive work in Phase 5 | |
| You decide | Minimize total rework | |

**User's choice:** Establish baseline now

---

## Phase-1 test scope

### What should the Vitest suite assert in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Contract-locking tests | Assert privacy copy present, CSP meta + directives, shell regions render | ✓ |
| Trivial smoke test | One passing test for green CI | |
| You decide | Lock contracts without brittle tests | |

**User's choice:** Contract-locking tests

### How should those assertions read the page?

| Option | Description | Selected |
|--------|-------------|----------|
| Node env, read index.html as text | Assert CSP meta + copy via string read, no jsdom | |
| jsdom DOM assertions | Introduce jsdom; assert against parsed/mounted DOM | ✓ |
| You decide | Lighter approach that still proves contracts | |

**User's choice:** jsdom DOM assertions
**Notes:** Deliberate exception to CLAUDE.md's "jsdom only when truly needed" — Phase-1 tests are DOM-contract tests. Domain-layer tests (Phases 2–3) stay node-env.

---

## Claude's Discretion

- Exact Vite config beyond `base`, ESLint flat-config + Prettier, tsconfig strictness, and GitHub Actions workflow structure (versions/action chain already locked in CLAUDE.md).
- Precise wording of the Dutch header tagline (must stay honest, non-financial).

## Deferred Ideas

None — discussion stayed within phase scope.
