/**
 * tests/color.test.ts — contract tests for src/helpers/color.ts (COMP-04, D-11)
 *
 * Runs in the DEFAULT node environment (no per-file environment override needed).
 * Fixture-locks the selection-order slot assignment and defensive fallback behaviours
 * that Phase 5 charts depend on (colorFor is a cross-phase contract).
 */
import { describe, it, expect } from 'vitest'
import { colorFor, colorSlotFor } from '../src/helpers/color'

describe('colorFor', () => {
  it('returns slot-1 var for the first id in the selection', () => {
    expect(colorFor('a', ['a', 'b', 'c'])).toBe('var(--color-battery-1)')
  })

  it('returns slot-2 var for the second id in the selection', () => {
    expect(colorFor('b', ['a', 'b', 'c'])).toBe('var(--color-battery-2)')
  })

  it('returns slot-3 var for the third id in the selection', () => {
    expect(colorFor('c', ['a', 'b', 'c'])).toBe('var(--color-battery-3)')
  })

  it('returns slot-4 var for the fourth id in the selection', () => {
    expect(colorFor('d', ['a', 'b', 'c', 'd', 'e'])).toBe('var(--color-battery-4)')
  })

  it('returns slot-5 var for the fifth id in the selection', () => {
    expect(colorFor('e', ['a', 'b', 'c', 'd', 'e'])).toBe('var(--color-battery-5)')
  })

  it('returns slot-1 var (fallback) when the id is not in the selection', () => {
    expect(colorFor('z', ['a', 'b', 'c'])).toBe('var(--color-battery-1)')
  })

  it('returns slot-1 var (fallback) for a 6th id (index >= 5, palette exhausted)', () => {
    expect(colorFor('f', ['a', 'b', 'c', 'd', 'e', 'f'])).toBe('var(--color-battery-1)')
  })

  it('returns slot-1 var (fallback) for an empty selection', () => {
    expect(colorFor('a', [])).toBe('var(--color-battery-1)')
  })
})

describe('colorSlotFor', () => {
  it('returns 1 for the first id in the selection', () => {
    expect(colorSlotFor('a', ['a', 'b'])).toBe(1)
  })

  it('returns 2 for the second id in the selection', () => {
    expect(colorSlotFor('b', ['a', 'b'])).toBe(2)
  })

  it('returns 3 for the third id in the selection', () => {
    expect(colorSlotFor('c', ['a', 'b', 'c'])).toBe(3)
  })

  it('returns 1 (fallback) when the id is not found in the selection', () => {
    expect(colorSlotFor('z', ['a', 'b', 'c'])).toBe(1)
  })

  it('returns 1 (fallback) for an empty selection', () => {
    expect(colorSlotFor('x', [])).toBe(1)
  })

  // CR-01: legend swatch (colorSlotFor) MUST agree with the rendered series
  // color (colorFor) for every reachable selection, including a 6th battery.
  it('stays consistent with colorFor() for a 6th battery (no legend/chart color mismatch)', () => {
    const sel = ['a', 'b', 'c', 'd', 'e', 'f']
    for (const id of sel) {
      const slot = colorSlotFor(id, sel) // 1-indexed
      expect(colorFor(id, sel)).toBe(`var(--color-battery-${slot})`)
    }
  })
})
