---
phase: 06-post-v1-ux-enhancements-multiple-custom-batteries-and-option
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/main.ts
  - src/state/app-state.ts
  - src/state/signals.ts
  - src/styles/battery-picker.css
  - src/styles/comparison-table.css
  - src/ui/battery-picker.ts
  - src/ui/comparison-table.ts
  - tests/app-state.test.ts
  - tests/battery-picker.test.ts
  - tests/comparison-table.test.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 6 adds a `customBatteries` collection signal + `salderingOn` toggle, a multi-custom battery picker with a deferred-commit "Toevoegen" button, and an optional saldering OFF-by-default comparison-table column toggle. The signal graph (`signals.ts`) and the comparison-table conditional layout (`comparison-table.ts`) are clean, well-guarded (length-mismatch race, denominator guards, generation-counter), and XSS-safe — all user-derived strings flow through `textContent` and no inline styles are assigned. Tests are thorough for the happy paths.

The defects below are concentrated in `battery-picker.ts`, where the per-card lifecycle was generalized to N cards. The most consequential is a **reactive effect leak**: removing a custom card detaches its DOM node but never disposes its per-card swatch effect, so leaked effects accumulate for the page lifetime and re-run on every subsequent `customBatteries`/`activeBatteries` change. Several silent-validation gaps in the custom-battery form let invalid optional-field input be discarded without user feedback. None rise to a security or data-loss BLOCKER given the all-client, no-network constraint, but the effect leak and the silent-validation gaps should be fixed before this ships.

No structural findings block was provided.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Per-card swatch effect leaks on card removal

**File:** `src/ui/battery-picker.ts:406-411, 416-441`
**Issue:** Each custom card registers a per-card `effect()` and pushes its disposer into the module-level `_disposeFns` array (line 416). The remove handler (lines 406-411) calls `li.remove()` and mutates `customBatteries`, but it never disposes that card's effect. The disposer remains in `_disposeFns` subscribed to `customBatteries.value` and `activeBatteries.value`. After removing K cards over a session, K orphaned effects re-run on every subsequent signal change (every add/commit/remove of any battery), each touching a detached `<span>`. This is a genuine effect leak — exactly the "RESEARCH Pitfall 3 — always capture dispose" hazard the file comments cite, applied at card granularity instead of only at teardown. The harm is bounded (detached nodes), but it is unbounded growth within one page lifecycle and runs needless work on every reactive update.
**Fix:** Capture each card's disposer locally and call it in the remove handler instead of (or in addition to) parking it in the shared array:
```ts
const disposeSwatch = effect(() => { /* ... swatch slot logic ... */ })
_disposeFns.push(disposeSwatch)

removeBtn.addEventListener('click', () => {
  disposeSwatch()                                   // stop the leaked subscription
  _disposeFns.splice(_disposeFns.indexOf(disposeSwatch), 1)
  customBatteries.value = customBatteries.value.filter((b) => b.id !== id)
  li.remove()
  scheduleRecompute(true)
})
```

### WR-02: Invalid optional field values are silently dropped with no user feedback

**File:** `src/ui/battery-picker.ts:320-334`
**Issue:** `buildPartialOrNull` only surfaces a validation error for the capacity field. For the four optional fields (dod, efficiency, charge, discharge), the loop at lines 320-328 accepts a value only when `!Number.isNaN(raw) && raw > 0`; any negative, zero, or non-numeric optional input is silently discarded and the Sessy-5 default is substituted (lines 331-334). A user who types `-5` for "Max laden" or `0` for "Rendement" gets a battery configured with 2.2 kW / 85% and zero indication their input was ignored, despite the `<input>` carrying a `min`/`max` and an associated `errorSpan` (lines 260-266) that is never populated for these fields. This produces a silently-wrong simulation — the user believes they modeled their battery but did not.
**Fix:** Validate each optional field against its `min`/`max` and surface its `#{def.id}-error` span (the DOM is already built for it) when the field is non-empty and out of range; only fall back to the default when the field is genuinely empty (`inp.value === ''`), not when it is filled-but-invalid.

### WR-03: `max` cap (200 kWh / 100 kW / 100 %) is enforced only on capacity, not on optional fields

**File:** `src/ui/battery-picker.ts:285-286, 320-328`
**Issue:** Capacity is bounded to `(0, 200]` (line 286), but the optional fields' upper bounds declared in `fieldDefs` (`max: '100'` for dod/efficiency, `max: '100'` for charge/discharge) are never checked in `buildPartialOrNull`. A user can commit `dodFraction` of 5000% (`5000 * 0.01 = 50`) or a 10000 kW discharge rate. `dodFraction = 50` then flows into `usableCapacity = nominalCapacityKwh * battery.dodFraction` in `comparison-table.ts:232`, inflating "Marginale benutting" and every downstream metric with physically impossible numbers. The `min="1" max="100"` HTML attributes do nothing because the form is `novalidate` (line 142) and the code owns validation.
**Fix:** Clamp or reject optional fields against their declared `min`/`max` in `buildPartialOrNull` (post-scale for percent fields: dod/efficiency must land in `(0, 1]`). Reject-with-error is preferable to silent clamp so the user sees what happened.

### WR-04: Cap-guard message and `commitBtn` relabel diverge from actual state on invalid re-commit

**File:** `src/ui/battery-picker.ts:352-377`
**Issue:** Two related state-desync bugs in `commitCard`:
1. When a previously-committed card is re-committed with now-invalid capacity (lines 352-362), the stale entry is removed from `customBatteries`, but `commitBtn.textContent` is left as `'Bijwerken'` (set on the prior successful commit, line 375). The button now says "Bijwerken" for an entry that no longer exists — the next valid commit re-adds it, so the label lies about the current state.
2. The cap-block branch (lines 364-370) sets `incompleteAlert` to the "Maximaal 5" message and returns, but never resets the button label or clears the alert on a later successful commit path other than line 374. The two messages share one `incompleteAlert` element with no state machine, so a stale "Maximaal 5 — verwijder er eerst één" can persist visually after the user removes another battery and the cap is no longer hit, until the next commit.
**Fix:** Reset `commitBtn.textContent = 'Toevoegen aan vergelijking'` whenever the entry is dropped from `customBatteries`, and clear `incompleteAlert.hidden = true` at the top of `commitCard` before branching so each commit recomputes the message from scratch.

### WR-05: Saldering checkbox is one-way bound — DOM and signal can desync

**File:** `src/main.ts:60-77`
**Issue:** The saldering checkbox is initialized from `salderingOn.value` once at construction (line 63) and writes the signal on `change` (line 75), but there is no `effect()` keeping the checkbox `.checked` in sync if `salderingOn` is ever written from elsewhere (e.g. a future "reset" action, HMR re-init, or a deep-link/state-restore). The comparison table reacts to `salderingOn` reactively, but the control that owns it does not — so the table could show saldering columns while the checkbox reads unchecked. Today `main.ts` is the only writer, so this is latent, but it is an inconsistency in an otherwise fully-reactive codebase and a likely source of a confusing bug the moment a second writer is added.
**Fix:** Wrap the checkbox sync in an effect so it mirrors the signal:
```ts
import { effect } from '@preact/signals-core'
const disposeSaldering = effect(() => { salderingCheckbox.checked = salderingOn.value })
// dispose alongside the other HMR disposers
```
(and add `disposeSaldering()` to the `import.meta.hot.dispose` block at line 108).

### WR-06: `scheduleRecompute` debounce timer is never cleared on teardown

**File:** `src/state/app-state.ts:69, 94-102` and `src/main.ts:107-113`
**Issue:** `_runCompute` is fired by a module-level `setTimeout` (`_debounceTimer`). The HMR `dispose` block in `main.ts` (lines 108-112) disposes the table/chart effects but never clears a pending `_debounceTimer`. On hot reload a debounced recompute scheduled just before teardown will still fire after the new module instance has constructed a fresh worker singleton, racing two worker instances and writing into signals the old closure still references. There is no exported way to cancel the pending timer. In production (no HMR) this is benign, but it undermines the deferred-commit perf work the phase introduced and can cause flaky dev behavior (and flaky tests if the timer outlives a test).
**Fix:** Export a `cancelRecompute()` that clears `_debounceTimer` and resets it to `null`, and call it from the HMR dispose block.

## Info

### IN-01: Magic number `5` (palette/cap) repeated across modules without a shared constant

**File:** `src/ui/battery-picker.ts:428, 435, 596` and `src/ui/comparison-table.ts` (implicit), `src/helpers/color.ts:42`
**Issue:** The `for (let i = 1; i <= 5; i++)` swatch-class-strip loops hardcode the palette size `5` in three places in `battery-picker.ts`, while `MAX_SELECTED = 5` is a named constant (line 21) and `COLOR_SLOTS.length` (= 5) governs `colorSlotFor`. These three 5s are conceptually "number of color slots" and must stay in lockstep with `COLOR_SLOTS`; today they are unlinked literals.
**Fix:** Export `PALETTE_SIZE` (or reuse `COLOR_SLOTS.length`) from `helpers/color.ts` and loop `i <= PALETTE_SIZE`.

### IN-02: Duplicated swatch-class-strip loop is copy-pasted in three locations

**File:** `src/ui/battery-picker.ts:428-431, 435-438, 596-598`
**Issue:** The "remove all `battery-swatch--N` classes" loop appears verbatim three times (twice in the per-card effect, once in the catalog effect). This is duplicated logic that must be kept in sync with the palette size (see IN-01).
**Fix:** Extract a `clearSwatchSlots(el: HTMLElement)` helper and call it in all three spots.

### IN-03: `colorFor` export appears unused by Phase 6 code

**File:** `src/helpers/color.ts:25-29`
**Issue:** Phase 6 modules only call `colorSlotFor`. `colorFor` (returning a CSS var string) is exported but not referenced by any reviewed file. It may be a Phase 5 chart dependency (the docblock claims so) — flagged only for the structural pass to confirm against the full import graph; do not remove without that check.
**Fix:** Confirm `colorFor` has a live caller (charts) via the structural unused-export scan; if none, remove.

### IN-04: `buildCapNote` text duplicates the cap concept already conveyed by disabled add-button

**File:** `src/ui/battery-picker.ts:454-459, 605, 608-609`
**Issue:** The cap note ("Maximaal 5 batterijen geselecteerd."), the disabled add-button, and the per-commit "Maximaal 5 — verwijder er eerst één." alert all communicate the same cap from three different surfaces with three different strings. Not a bug, but a maintainability smell: a copy change to the cap message must touch three places.
**Fix:** Centralize the cap copy into one exported constant referenced by all three surfaces.

### IN-05: Placeholder values use Dutch decimal comma; parsed input uses `parseFloat` (period)

**File:** `src/ui/battery-picker.ts:196, 226, 235, 282, 323`
**Issue:** Placeholders display Dutch format (`'5,0'`, `'2,2'`, `'1,7'`) but the fields are `type="number"`, whose `.value` is always a period-decimal string, and `parseFloat` (lines 282, 323) parses period-decimals. This is *correct* for `type="number"` inputs (the browser normalizes the value), so there is no parse bug — but the placeholder `5,0` visually suggests comma input that the number input would actually reject on some locales/keyboards. Worth a UX glance, not a defect.
**Fix:** Optionally switch placeholders to `5.0`/`2.2`/`1.7` to match what a `type="number"` field actually accepts, or leave as-is if the displayed comma is an intentional NL affordance.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
