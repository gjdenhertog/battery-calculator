# Phase 1: Setup, Deploy Plumbing, Privacy Rules - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the Vanilla TypeScript + Vite scaffold, the GitHub Pages deploy
pipeline, and the privacy/CSP contracts. Deliver a reachable hello-world page
at `https://<user>.github.io/battery-calculator/` with green CI (lint + format
+ Vitest), a strict CSP, zero third-party requests, and the privacy promise
rendered where the future drop zone will sit. **No feature code** — no CSV
parsing, no simulator, no charts. This phase locks the base-path, privacy, and
deploy contracts that every later phase builds on.

Requirements covered: SETUP-01..05, PRIV-01..03 (8 total).

</domain>

<decisions>
## Implementation Decisions

### Hello-world page shape
- **D-01:** Build the **full 3-region structural shell** now, not a bare
  placeholder: (1) a header with the app title + one-line tagline, (2) a
  drop-zone region that carries the privacy promise, (3) a results/comparison
  placeholder region. Phases 2–5 fill each region in place to minimize layout
  churn later.
- **D-02:** Stubbed regions are **left bare — no "coming soon" / "in aanbouw"
  copy**. The drop-zone region shows only the (required) privacy promise; the
  results region is an empty styled placeholder. The page reads as a clean
  skeleton, not a WIP announcement.

### CSP & privacy-guard strictness
- **D-03:** **Maximal-lockdown CSP** via `<meta http-equiv="Content-Security-Policy">`
  in `index.html` (GitHub Pages can't set HTTP headers). Policy: `default-src 'none'`,
  then explicitly allow only what's needed — `script-src 'self'`, `style-src 'self'`,
  `img-src 'self'`, `font-src 'self'`, `connect-src 'none'` (the app NEVER makes a
  network request with data — this is the honest maximal statement), `base-uri 'self'`,
  `form-action 'none'`, `frame-ancestors 'none'`. **No `'unsafe-inline'`** — forbids
  inline `<script>` and inline `style=` attributes (achievable because the prod Vite
  build extracts CSS to files and emits module `<script src>` tags).
- **D-04:** **Automated `dist/` privacy guard in CI** — a CI step scans the built
  `dist/` output and **fails the build** if any external `http(s)://` URL or known
  third-party domain (analytics, Sentry, Google Fonts, CDNs) appears. Plus the
  documented manual Network-tab inspection note in the README. This makes the
  "zero third-party requests" promise (SETUP-04, criterion 2) regression-proof
  from commit 1 rather than review-dependent.

### Styling approach
- **D-05:** **Design-token baseline + global stylesheet.** A `:root` CSS
  custom-properties file (colors, spacing scale, font stack, **per-battery color
  slots** for later phases) plus a single global stylesheet. Phase 4's
  `colorFor(batteryId)` helper and Phase 5's polish/Dutch pass inherit a
  consistent system instead of retrofitting one.
- **D-06:** **System-font stack** (no web fonts). Avoids any font fetch —
  satisfies both the privacy constraint and the strict `font-src 'self'` /
  `connect-src 'none'` CSP. No Google Fonts, no CDN fonts.
- **D-07:** **Establish the mobile-readable baseline now**, not in Phase 5:
  viewport `<meta>` tag, `box-sizing: border-box` reset, and a mobile-first
  max-width container in the shell. Cheap to do while the shell is being built;
  avoids a layout retrofit when Phase 5's 375px-readability criterion lands.

### Phase-1 test scope
- **D-08:** **Contract-locking Vitest tests** (not just a trivial smoke test):
  assert the privacy-promise string is present in the drop-zone region, the CSP
  `<meta>` tag exists with the expected directives, and the shell regions
  (header / drop-zone / results placeholder) render. Combined with the CI
  `dist/` guard (D-04), every Phase-1 contract is regression-guarded.
- **D-09:** Use **jsdom** for these DOM-contract assertions (realistic
  parsed-DOM rendering checks). This is the deliberate exception to CLAUDE.md's
  "node env by default, jsdom only when truly needed" rule — Phase 1's tests are
  DOM-contract tests, so jsdom is warranted here. Later domain-layer tests
  (parsers, simulator) stay in the node environment per CLAUDE.md.

### Claude's Discretion
- Exact Vite config beyond `base: '/battery-calculator/'`, ESLint flat-config +
  Prettier setup, `tsconfig` strictness, and the GitHub Actions workflow file
  structure are left to research/planning — the versions and action chain are
  already locked (see Canonical References).
- The precise wording of the one-line header tagline (Dutch) is at the
  planner's discretion, as long as it stays honest and non-financial.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements (read first)
- `CLAUDE.md` — **LOCKED technology stack and versions.** Vite `^8.0.14`,
  TypeScript `~5.6`, Node `lts/*` (22.x), Vitest `^4.1.7`, ESLint `^9` (flat
  config) + `@typescript-eslint` `^8`, Prettier `^3` + `eslint-config-prettier`.
  GitHub Pages deploy chain: `actions/checkout@v6` + `setup-node@v6` +
  `configure-pages@v6` + `upload-pages-artifact@v5` + `deploy-pages@v5`. Do not
  re-research or re-version these.
- `.planning/REQUIREMENTS.md` — SETUP-01..05, PRIV-01..03 full text and
  traceability.
- `.planning/ROADMAP.md` §"Phase 1" — goal + 5 success criteria (the
  acceptance bar). Criterion 5 contains the **verbatim Dutch privacy copy**.
- `.planning/PROJECT.md` — constraints (client-side only, GitHub Pages, no
  server, NL-only) and Key Decisions table.

### Verbatim copy (must ship exactly)
- Privacy promise (ROADMAP.md Phase 1, criterion 5 / PRIV-02):
  **"Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0
  verzoeken na het laden"** — rendered **at the drop-zone region**, not in a
  footer.

No external ADRs or third-party specs — requirements are fully captured above
and in the decisions section.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repo. Only `CLAUDE.md` and `.planning/` exist; no `src/`,
  `package.json`, or build config yet. This phase creates the scaffold from
  scratch.

### Established Patterns
- No code patterns yet. The conventions chosen here (design-token CSS, strict
  CSP, jsdom-for-DOM/node-for-domain test split, 3-region shell) **become** the
  patterns Phases 2–5 inherit.

### Integration Points
- The drop-zone region created here is the mount point Phase 2's real CSV drop
  zone replaces in place.
- The results placeholder region is the mount point Phase 4's comparison table
  occupies.
- The `:root` per-battery color slots are the source Phase 4's `colorFor()` and
  Phase 5's charts read from.

</code_context>

<specifics>
## Specific Ideas

- **Planner flag:** the strict `connect-src 'none'` CSP must not break Vite's
  dev-server HMR websocket. The CSP `<meta>` lives in `index.html` and applies
  in dev too. Resolve via dev-vs-prod CSP handling (e.g. a relaxed dev-only CSP
  or conditional injection) so `npm run dev` still hot-reloads while the shipped
  `dist/index.html` carries the maximal-lockdown policy. Research this during
  planning.
- The CI `dist/` privacy guard (D-04) should scan the **built** output, not
  source, so it catches anything a dependency injects at build time.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Adjacent topics (repo/deploy
specifics beyond the locked action chain, README copy depth, lint/format config
posture) were left to research/planning discretion rather than deferred to other
phases.

</deferred>

---

*Phase: 1-Setup, Deploy Plumbing, Privacy Rules*
*Context gathered: 2026-06-07*
