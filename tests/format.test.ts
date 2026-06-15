/**
 * tests/format.test.ts — contract tests for src/helpers/format.ts (VIZ-04 spirit)
 *
 * Runs in the DEFAULT node environment (no per-file environment override needed).
 * Fixture-locks the 1-decimal kWh, 1-decimal percentage, 2-decimal ratio, and
 * nl-NL date formatting behaviours.
 */
import { describe, it, expect } from 'vitest'
import {
  formatKwh,
  formatPct,
  formatRatio,
  formatDate,
  formatCount,
  formatAxisKwh,
} from '../src/helpers/format'

describe('formatKwh', () => {
  it('formats a positive value to exactly 1 decimal place with kWh suffix', () => {
    expect(formatKwh(12.34)).toBe('12.3 kWh')
  })

  it('formats zero to exactly 1 decimal place', () => {
    expect(formatKwh(0)).toBe('0.0 kWh')
  })

  it('formats a value with truncation at 1 decimal', () => {
    expect(formatKwh(12.34)).toBe('12.3 kWh')
  })

  it('formats a whole number to 1 decimal place', () => {
    expect(formatKwh(5)).toBe('5.0 kWh')
  })

  it('formats a negative value (saldering ON can produce negatives)', () => {
    expect(formatKwh(-0.4)).toBe('-0.4 kWh')
  })
})

describe('formatPct', () => {
  it('formats to 1 decimal place with % suffix', () => {
    expect(formatPct(42.1)).toBe('42.1 %')
  })

  it('formats zero', () => {
    expect(formatPct(0)).toBe('0.0 %')
  })

  it('formats 100', () => {
    expect(formatPct(100)).toBe('100.0 %')
  })
})

describe('formatRatio', () => {
  it('formats to exactly 2 decimal places', () => {
    expect(formatRatio(0.625)).toBe('0.63')
  })

  it('formats zero', () => {
    expect(formatRatio(0)).toBe('0.00')
  })

  it('formats 1', () => {
    expect(formatRatio(1)).toBe('1.00')
  })
})

describe('formatDate', () => {
  it('formats a UTC date as DD-MM-YYYY in nl-NL locale', () => {
    // 2026-06-11 UTC
    const d = new Date(Date.UTC(2026, 5, 11))
    const result = formatDate(d)
    // nl-NL locale formats as DD-MM-YYYY (e.g. "11-06-2026")
    expect(result).toMatch(/\d{2}-\d{2}-\d{4}/)
    expect(result).toContain('2026')
  })
})

describe('formatCount', () => {
  it('formats a number with Dutch thousands separator', () => {
    // nl-NL uses a period as thousands separator: 52.438
    const result = formatCount(52438)
    expect(result).toBe('52.438')
  })

  it('formats small numbers without separator', () => {
    expect(formatCount(100)).toBe('100')
  })
})

describe('formatAxisKwh', () => {
  it('formats 3.14159 to "3.1" (1 decimal, no kWh suffix)', () => {
    expect(formatAxisKwh(3.14159)).toBe('3.1')
  })

  it('formats 0 to "0.0"', () => {
    expect(formatAxisKwh(0)).toBe('0.0')
  })

  it('formats a whole number to 1 decimal place', () => {
    expect(formatAxisKwh(5)).toBe('5.0')
  })

  it('formats a negative value to 1 decimal place', () => {
    expect(formatAxisKwh(-2.7)).toBe('-2.7')
  })

  it('does NOT include a kWh suffix', () => {
    const result = formatAxisKwh(12.3)
    expect(result).not.toContain('kWh')
  })
})
