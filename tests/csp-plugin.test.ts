/**
 * tests/csp-plugin.test.ts — CSP directive contract lock (D-08, SETUP-05)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Pure string assertion against the single-source CSP constant.
 *
 * If any test in this file fails it means a future edit weakened the policy.
 * These tests must remain green on every push (CI gate — Plan 03).
 */
import { describe, it, expect } from 'vitest'
import { CSP } from '../src/constants/csp'

describe('CSP directive contract', () => {
  it("contains default-src 'none'", () => {
    expect(CSP).toContain("default-src 'none'")
  })

  it("contains script-src 'self'", () => {
    expect(CSP).toContain("script-src 'self'")
  })

  it("contains style-src 'self'", () => {
    expect(CSP).toContain("style-src 'self'")
  })

  it("contains img-src 'self'", () => {
    expect(CSP).toContain("img-src 'self'")
  })

  it("contains font-src 'self'", () => {
    expect(CSP).toContain("font-src 'self'")
  })

  it("contains connect-src 'none'", () => {
    expect(CSP).toContain("connect-src 'none'")
  })

  it("contains worker-src blob:", () => {
    expect(CSP).toContain("worker-src blob:")
  })

  it("contains base-uri 'self'", () => {
    expect(CSP).toContain("base-uri 'self'")
  })

  it("contains form-action 'none'", () => {
    expect(CSP).toContain("form-action 'none'")
  })

  it("contains frame-ancestors 'none'", () => {
    expect(CSP).toContain("frame-ancestors 'none'")
  })

  it("does NOT contain 'unsafe-inline'", () => {
    expect(CSP).not.toContain("'unsafe-inline'")
  })

  it("does NOT contain 'unsafe-eval'", () => {
    expect(CSP).not.toContain("'unsafe-eval'")
  })
})
