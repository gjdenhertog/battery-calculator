---
phase: 04
slug: comparison-engine-comparison-table-saldering-side-by-side-wo
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-13
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register authored at plan time (all 6 PLANs carried `<threat_model>` blocks). Verified in "verify mitigations exist" mode by gsd-security-auditor — no new-threat scan, no implementation files modified.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| main thread → Comlink sim worker | inputs cross via structured-clone postMessage; no code crosses | parsed `IntervalSample[]` + `BatteryConfig[]` (user-derived numeric) |
| build output → browser CSP | emitted worker chunk URL must satisfy `worker-src` | same-origin JS chunk + PapaParse blob worker |
| running app → network | privacy invariant: zero requests with user data after load | none permitted (`connect-src 'none'`) |
| custom battery form → activeBatteries → runComparison | untrusted numeric + string input enters reactive state and the DOM | capacity/power numbers, custom battery name |
| npm registry → build | new package tarballs enter the dependency tree | `comlink`, `@preact/signals-core` |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | Tampering | Comlink postMessage channel | mitigate | Structured-clone only (`Comlink.expose`/`wrap`); no function/eval transfer; `worker-src 'self' blob:` (no remote origin) — `sim-worker.ts:11`, `app-state.ts:62`, `csp.ts:28` | closed |
| T-04-02 | Information Disclosure | worker network egress | mitigate | `connect-src 'none'` (`csp.ts:22`, injected `dist/index.html:4`); zero `fetch`/`XHR` in `src/` | closed |
| T-04-03 | Elevation of Privilege | over-broad CSP relaxation | accept | `worker-src 'self' blob:` is minimal (`'self'` = Vite worker chunk, `blob:` = PapaParse worker); no `data:`/remote added | closed |
| T-04-SC | Tampering | npm installs (comlink, signals-core) | mitigate | Pinned `^4.4.2` / `^1.14.2` per RESEARCH audit — `package.json:31-32` | closed |
| T-04-04 | Tampering | div-by-zero / NaN in deriveMetrics | mitigate | `selfConsumptionPct`→0 when `totalImportKwh==0`; `marginalBenutting`→0 when `usableCapacityKwh<0.1` — `metrics.ts:79-85` | closed |
| T-04-05 | Information Disclosure | helper network egress | accept | Pure functions, no I/O surface, no browser API — `metrics.ts` | closed |
| T-04-06 | Denial of Service | huge custom-battery numbers reach runComparison | mitigate | `activeBatteries` gate `nominalCapacityKwh>0` (`signals.ts:92`); form `max=200` + `validateAndWrite` bounds (`battery-picker.ts:227,255`) | closed |
| T-04-07 | Tampering | out-of-order worker results overwrite newer state | mitigate | `_generation` counter; only newest `myGen` writes `simResults`/error — `app-state.ts:76,123,134,142` | closed |
| T-04-08 | Information Disclosure | worker fetch/exfiltration of CSV | mitigate | `connect-src 'none'` applies in worker; Comlink postMessage only; zero `fetch`/`XHR` in worker/domain | closed |
| T-04-09 | Tampering | un-disposed effect/subscription leak | mitigate | `app-state`/`signals` create zero effects; UI owns disposal (`teardownBatteryPicker`, `initComparisonTable` dispose fn, `teardownPeriodControl`) | closed |
| T-04-10 | Tampering | XSS via custom battery name (picker) | mitigate | All user strings via `.textContent`; zero `.innerHTML` — `battery-picker.ts:91` | closed |
| T-04-11 | Elevation of Privilege | inline style injection (picker) | mitigate | Swatch via `.battery-swatch--N` class (integer slot); zero `.style.` assignments — `battery-picker.ts:87,478-483` | closed |
| T-04-12 | Denial of Service | huge custom numbers (picker form) | mitigate | `input.max` on all 5 fields; signal written only when `>0` and in-bounds — `battery-picker.ts:227,255` | closed |
| T-04-13 | Tampering | XSS via custom battery name (table cell) | mitigate | Name + all cell values via `.textContent`; `innerHTML=''` are safe resets only — `comparison-table.ts:196,228` | closed |
| T-04-14 | Elevation of Privilege | inline style injection (table/banner) | mitigate | Visual state via `classList`; zero `.style.` assignments — `comparison-table.ts` | closed |
| T-04-15 | Tampering | floored saldering value hiding a real loss | mitigate | Negative `avoidedOn` rendered as-is (U+2212 + `.table-cell--negative`), never floored — `comparison-table.ts:249-255`, `metrics.ts:26-30` | closed |
| T-04-16 | Information Disclosure | extrapolation implying un-uploaded data | mitigate | No `/jaar`·`/maand`·extrapolation strings in results UI; static period copy — `period-control.ts:143` | closed |
| T-04-17 | Information Disclosure | network egress of user CSV (live app) | mitigate | `connect-src 'none'` in built output; zero `fetch`/`XHR`; human-verify confirmed zero network requests (04-06-SUMMARY.md) | closed |
| T-04-18 | Tampering | CSP violation blocking worker in production (A3) | mitigate | `dist/assets/sim-worker-*.js` emitted (same-origin); CSP injected via `cspInjectPlugin` (`apply:'build'`); build re-asserted | closed |
| T-04-19 | Denial of Service | UI lock-up during compute | mitigate | `?worker` off-main-thread + generation guard; human-verify confirmed "Rekenen…" without UI lock | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-03 | `worker-src 'self' blob:` is the minimal relaxation needed: `'self'` for the Vite-emitted sim-worker chunk, `blob:` for PapaParse `worker:true`. No `data:` or remote origins; `connect-src 'none'` unchanged. | Joachim den Hertog | 2026-06-13 |
| AR-04-02 | T-04-05 | Presentation helpers (`metrics.ts`, `color.ts`, `format.ts`) are pure functions with no I/O, DOM, or network surface — nothing to disclose. | Joachim den Hertog | 2026-06-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-13 | 20 | 20 | 0 | gsd-security-auditor (verify-mitigations mode) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-13
