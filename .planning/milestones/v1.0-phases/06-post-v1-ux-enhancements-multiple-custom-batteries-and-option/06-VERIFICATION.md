---
phase: 06-post-v1-ux-enhancements-multiple-custom-batteries-and-option
verified: 2026-06-15T22:07:00Z
status: passed
score: 17/17 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification — no prior 06-VERIFICATION.md existed."
deviations_accepted:
  - must_have: "Each click of '+ Eigen batterij' appends a fresh editable custom card, in place, with no separate commit step (D-01)"
    note: >
      Implementation deviates from the 'no separate commit step' clause: a post-verify
      performance change deferred the customBatteries signal write + worker recompute to an
      explicit 'Toevoegen aan vergelijking' commit button (relabels to 'Bijwerken' once
      committed). The 'fresh card per click, in place' part of D-01 is intact. The commit
      model was found necessary during live UAT (per-keystroke recompute was slow), committed
      separately, and re-verified live + APPROVED by the user. The binding ROADMAP success
      criterion #1 ('a user can define and add multiple custom batteries ... appearing as their
      own comparison columns ... bounded by max-5 ... consistent distinct swatch color') is
      fully satisfied by the commit model. Accepted as an intentional, user-approved deviation.
---

# Phase 6: Post-v1 UX Enhancements — Multiple Custom Batteries + Optional Saldering — Verification Report

**Phase Goal:** Two consumer-requested enhancements deferred from v1: (1) let users add MORE THAN ONE custom battery to the comparison (within the max-5 cap), and (2) make the saldering treatment an optional mode that is OFF by default so the post-2027 "zonder saldering" reality is the headline.
**Verified:** 2026-06-15T22:07:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### ROADMAP Success Criteria (binding contract)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | A user can add multiple custom batteries (each via "+ Eigen batterij"), all appearing as their own comparison columns, bounded by max-5; each keeps a consistent distinct swatch color across picker and table | ✓ VERIFIED | `battery-picker.ts` `buildCustomCard(id, n)` generalized to N cards (l.124); add button with cap guard `activeBatteries.value.length >= MAX_SELECTED` (l.581); per-card order-based swatch via `colorSlotFor(id, orderedIds)` (l.457); `comparison-table.ts` renders one row per `activeBatteries` entry using the same `colorSlotFor` contract (l.234); charts reuse `colorFor` on the same order (monthly-bars/flow-chart). Tests assert add/unique-id/cap/remove/reflow (tests/battery-picker.test.ts l.302-738). Live UAT APPROVED. |
| 2 | Saldering OFF by default: first render shows only "zonder saldering"; a labelled toggle opts in to "met saldering"; corrected policy copy surfaced only when ON | ✓ VERIFIED | `salderingOn = signal<boolean>(false)` (signals.ts l.53); `comparison-table.ts` `showSaldering` branch renders single column OFF (l.129-137) / zonder\|met pair ON (l.113-128, 176-188); disclaimer + info-btn + negative-note ON-only (l.406-425); options-row toggle with label "Toon óók 'met saldering'" in `main.ts` (l.55-83). Locked corrected copy ("saldering is 100% t/m 2026 ... 2027-01-01 ... 50% t/m 2030") byte-intact (comparison-table.ts l.28-38). Tests l.466-586. Live UAT APPROVED. |
| 3 | Both behaviors covered by tests, no inline styles (CSP style-src 'self'), recompute correct through the existing Comlink worker | ✓ VERIFIED | `npm test` → 423 passing / 30 files (verifier-run). `npm run build` succeeds incl. build-only CSP gate (verifier-run). `grep "\.style\." src/ui/*.ts src/main.ts` → empty. Worker round-trip is CI-mocked (worker-mock blind spot); live human-verify on merged main APPROVED both behaviors through the real worker with zero console errors / zero CSV-bearing network requests. |

### Observable Truths (PLAN frontmatter must_haves)

| # | Truth | Plan | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | customBatteries holds a collection (array), not single nullable config (D-09) | 06-01 | ✓ VERIFIED | `signals.ts:47` `customBatteries = signal<BatteryConfig[]>([])` |
| 2 | salderingOn boolean exists, defaults false (D-09/D-06) | 06-01 | ✓ VERIFIED | `signals.ts:53` `signal<boolean>(false)` |
| 3 | activeBatteries appends only customs with nominalCapacityKwh > 0, in order, after selectedBatteries (D-03/D-05) | 06-01 | ✓ VERIFIED | `signals.ts:100-105` filter `> 0` + spread, no sort; test l.302+ asserts order/exclusion |
| 4 | Invalid/empty draft custom does NOT appear in activeBatteries and does NOT consume a cap slot (D-03) | 06-01 | ✓ VERIFIED | Filter at signals.ts:101; picker empty-draft-no-slot test (battery-picker l.534) |
| 5 | Each "+ Eigen batterij" click appends a fresh editable card, in place — *with no separate commit step* (D-01) | 06-02 | ✓ VERIFIED (deviation) | Card appended per click (battery-picker.ts:579-589). **Commit-step clause deviates**: signal write now on explicit "Toevoegen" button (l.412-419) — intentional perf change, user-approved live. ROADMAP SC#1 still met. See `deviations_accepted`. |
| 6 | Optional name field pre-filled 'Eigen batterij N'; empty falls back to default; flows as XSS-safe textContent (D-02) | 06-02 | ✓ VERIFIED | nameInput pre-fill l.164; fallback `nameInput.value.trim() || defaultName` l.311; rendered via textContent (comparison-table l.249); XSS tests pass |
| 7 | Only valid customs count toward max-5; empty draft does not consume a slot (D-03) | 06-02 | ✓ VERIFIED | cap guard on `activeBatteries.value.length` l.390/581; tests l.534/559 |
| 8 | "+ Eigen batterij" disables when 5 valid batteries active (D-03) | 06-02 | ✓ VERIFIED | `addBtn.disabled = atCap` l.640; test l.559 |
| 9 | Each card has "× Verwijderen" remove that frees the slot immediately regardless of fill; catalog deselect unchanged (D-04) | 06-02 | ✓ VERIFIED | removeBtn handler filters customBatteries + li.remove() l.430-443; tests l.600-632; catalog checkbox path unchanged l.540-556 |
| 10 | Each card swatch uses colorSlotFor by unique id and reflows by order on removal — no inline styles (D-05/D-10) | 06-02 | ✓ VERIFIED | per-card effect `colorSlotFor(id, orderedIds)` CSS-class-only l.449-472; reflow test l.673; `.style.` grep empty |
| 11 | Saldering OFF default: single 'kWh netto-import vermeden' column, NO zonder/met sub-labels (D-07) | 06-03 | ✓ VERIFIED | OFF branch single rowspan=2 header, empty labelRow (comparison-table l.129-137, 189); test l.121/526 |
| 12 | A labelled checkbox in an options row above the table toggles saldering ON; default unchecked (D-06) | 06-03 | ✓ VERIFIED | main.ts options-row l.55-83, default unchecked via effect mirror of false signal |
| 13 | Toggling ON splits headline into zonder\|met pair (Phase 4 layout) (D-07) | 06-03 | ✓ VERIFIED | ON branch colspan-2 group + sub-labels l.113-128, 176-188; test l.136/537 |
| 14 | Corrected SALDERING_DISCLAIMER_COPY + info (i) affordance emitted ONLY when ON; OFF carries no saldering verbiage (D-08) | 06-03 | ✓ VERIFIED | `if (showSaldering)` gate l.406-416; OFF-no-disclaimer/info tests l.495-503; copy byte-intact l.28-38 |
| 15 | Negative-ON note appears only when ON and some avoidedOn <= 0 (D-08) | 06-03 | ✓ VERIFIED | `if (showSaldering && hasNegativeOn)` l.420; tests l.557/573 |
| 16 | Per-row leader highlighting applies to whichever headline column(s) are visible (D-07) | 06-03 | ✓ VERIFIED | leader keyed per-metric; cell only rendered when visible; test l.416 (leader on avoidedOff when OFF) |
| 17 | Options row survives table re-renders (outside the cleared container) and toggle recomputes through the Comlink worker (D-10) | 06-03 | ✓ VERIFIED | options-row appended to resultsRegion as sibling of comparison-table-mount (main.ts l.78 vs l.90); change handler `scheduleRecompute(true)` l.82; live UAT confirmed worker round-trip |

**Score:** 17/17 truths verified (truth #5 verified with a documented, user-approved deviation on one sub-clause; the binding ROADMAP contract is fully met).

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/state/signals.ts` | customBatteries collection + salderingOn + array-aware activeBatteries | ✓ VERIFIED | All three present (l.47, 53, 100); no singular `customBattery` remains |
| `src/state/app-state.ts` | re-export of customBatteries + salderingOn; cancelRecompute (WR-06) | ✓ VERIFIED | re-export block l.24-25; `cancelRecompute` exported l.111 |
| `src/ui/battery-picker.ts` | buildCustomCard(id, n) for N cards, add/remove/swatch/name + commit button | ✓ VERIFIED | Substantive (654 lines), wired into main.ts:42, WR-01/02/03/04 fixes present |
| `src/styles/battery-picker.css` | .battery-card__remove, __add, __commit, __name (no inline styles) | ✓ VERIFIED | All classes present (l.186/232/252/269) |
| `src/ui/comparison-table.ts` | salderingOn-driven single-vs-pair + ON-only disclaimer/note; showSaldering threaded | ✓ VERIFIED | reads salderingOn l.448; showSaldering in renderTable/buildThead/buildBatteryRow |
| `src/main.ts` | saldering options-row sibling above the table; WR-05/WR-06 disposers | ✓ VERIFIED | options-row l.55-83; sync effect l.67; cancelRecompute on HMR dispose l.115 |
| `src/styles/comparison-table.css` | .saldering-options-row styling | ✓ VERIFIED | rule present l.145 |
| `tests/app-state.test.ts` | node-env signal-contract tests | ✓ VERIFIED | 27 pass |
| `tests/battery-picker.test.ts` | jsdom add/remove/cap/name/reflow/commit/WR tests | ✓ VERIFIED | included in 98-test targeted run |
| `tests/comparison-table.test.ts` | OFF/ON/disclaimer/note/toggle tests | ✓ VERIFIED | included in 98-test targeted run |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| signals.ts activeBatteries | customBatteries valid-filter | `customBatteries.value.filter(... > 0)` spread | ✓ WIRED | signals.ts:100-105 |
| app-state.ts | signals.ts | re-export block | ✓ WIRED | customBatteries + salderingOn re-exported l.24-25 |
| battery-picker add/commit | customBatteries + activeBatteries cap | commit writes `customBatteries.value`; guard on `activeBatteries.value.length` | ✓ WIRED | l.390, 398, 581 |
| battery-picker custom swatch | colorSlotFor(id, orderedIds) | per-card effect on activeBatteries order | ✓ WIRED | l.449-472 |
| comparison-table effect | salderingOn.value | effect read → re-render on toggle | ✓ WIRED | l.448 |
| main.ts options checkbox | salderingOn + scheduleRecompute | change handler writes value + scheduleRecompute(true) | ✓ WIRED | l.80-83 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| comparison-table rows | simResults / activeBatteries | Comlink worker `runComparison` via scheduleRecompute; activeBatteries from real signal graph | Yes (CI-mocked worker in tests; real worker live-verified APPROVED) | ✓ FLOWING |
| custom battery columns | customBatteries (committed) → activeBatteries | user form commit → signal → worker recompute → simResults | Yes | ✓ FLOWING |
| saldering pair/disclaimer | salderingOn | options-row checkbox change handler | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green | `npm test` | 30 files / 423 tests passing | ✓ PASS |
| Production build + CSP gate | `npm run build` | typecheck + vite build succeed; no inline-style violation | ✓ PASS |
| Targeted phase tests | `npx vitest run app-state battery-picker comparison-table` | 3 files / 98 tests passing | ✓ PASS |
| Locked disclaimer copy intact | `grep "saldering is 100%" comparison-table.ts` | 2 hits = 1 comment + 1 real copy line (copy byte-intact, not duplicated) | ✓ PASS |
| No inline styles | `grep "\.style\." src/ui/*.ts src/main.ts` | empty | ✓ PASS |
| Singular customBattery removed | `grep "customBattery\b" signals.ts battery-picker.ts` | empty | ✓ PASS |

### Probe Execution

No project probe scripts found (`scripts/*/tests/probe-*.sh` absent); phase declares none. Not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BATT-05 | 06-01, 06-02 | Select multiple batteries (catalog +/or custom) capped at 5 visible | ✓ SATISFIED | Multi-custom collection + cap on activeBatteries; truths 1,3,4,5,7,8 |
| COMP-04 | 06-02 | Consistent per-battery color reused across table and all charts | ✓ SATISFIED | colorSlotFor (picker/table) + colorFor (charts) on same activeBatteries order; live-verified across table + charts |
| COMP-05 | 06-03 | Saldering ON/OFF scenarios in the comparison table (extended: now opt-in, OFF default) | ✓ SATISFIED | OFF single / ON pair; truths 11,13. Note: v1 wording "side-by-side with no re-run" is intentionally extended by this phase to opt-in OFF-by-default per ROADMAP SC#2 |
| COMP-06 | 06-03 | Disclaimer near saldering columns (extended: surfaced only when ON) | ✓ SATISFIED | ON-only disclaimer + info button, corrected copy; truth 14 |

No orphaned requirements: all four IDs declared in plan frontmatter and covered above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX debt markers in any phase-modified source | ℹ️ Info | Clean |
| — | — | No inline `.style.` assignments; all user strings via textContent | ℹ️ Info | CSP + XSS clean |

Code review (06-REVIEW.md) found 0 critical / 6 warnings (WR-01..WR-06) — all fixed in commit 1b0f261 and re-verified present in source (effect disposal l.435, optional-field validation l.320-348, label reset l.383, checkbox two-way bind l.67, cancelRecompute l.115). 5 Info items (IN-01..IN-05) intentionally deferred as non-blocking maintainability nits; none affect goal achievement.

### Human Verification Required

None outstanding. The phase's blocking live human-verify (06-03 Task 3) covering both behavior sets (multiple custom add/edit/remove + saldering toggle) through the real Comlink worker — the documented worker-mock CI blind spot — was executed on merged main and APPROVED by the user, along with the deferred-commit perf change. This recorded approval is the evidence for the live worker round-trip path.

### Gaps Summary

No gaps. All three ROADMAP success criteria and all 17 plan-frontmatter must-haves are satisfied in the codebase. `npm test` (423 passing) and `npm run build` (CSP gate passes) were re-run by the verifier and match the claimed state. The one deviation from a plan sub-clause — the deferred "Toevoegen aan vergelijking" commit button replacing the original "no separate commit step" of D-01 — is an intentional, separately-committed, user-approved performance change that does not reduce scope against the binding ROADMAP contract; it is recorded under `deviations_accepted` rather than as a gap.

---

_Verified: 2026-06-15T22:07:00Z_
_Verifier: Claude (gsd-verifier)_
