/**
 * src/helpers/color.ts — per-battery color slot mapping (COMP-04, D-11)
 *
 * Pure functions — no browser globals, safe to run in a Node environment.
 * colorFor() is stable into Phase 5 charts: called with the same selection order.
 * Swatch rendering uses CSS classes (.battery-swatch--N) — no inline style= (CSP).
 */

// Source: 04-UI-SPEC.md §"Per-Battery Color Slots"
const COLOR_SLOTS = [
  'var(--color-battery-1)',  // #2563eb — slot 1
  'var(--color-battery-2)',  // #16a34a — slot 2
  'var(--color-battery-3)',  // #d97706 — slot 3
  'var(--color-battery-4)',  // #9333ea — slot 4
  'var(--color-battery-5)',  // #e11d48 — slot 5
] as const

/**
 * Returns the CSS custom-property string for the given battery id based on its
 * position in the ordered selection array.
 *
 * Falls back to slot 1 if the id is not found or if the selection has 6+ batteries
 * (palette only has 5 slots).
 */
export function colorFor(batteryId: string, orderedSelection: string[]): string {
  const idx = orderedSelection.indexOf(batteryId)
  if (idx === -1 || idx >= COLOR_SLOTS.length) return COLOR_SLOTS[0]
  return COLOR_SLOTS[idx]
}

/**
 * Returns the 1-indexed slot number for the given battery id, for use in
 * `.battery-swatch--N` CSS class names.
 *
 * Returns 1 as a defensive fallback when the id is not found in the selection.
 */
export function colorSlotFor(batteryId: string, orderedSelection: string[]): number {
  const idx = orderedSelection.indexOf(batteryId)
  return idx === -1 ? 1 : idx + 1  // 1-indexed for .battery-swatch--N
}
