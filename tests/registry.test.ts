/**
 * tests/registry.test.ts — parser registry contract lock (DATA-03)
 *
 * Runs in the DEFAULT node environment (no per-file environment override).
 * Validates that the ParserRegistry correctly registers parsers and returns
 * the first matching parser on claim(), or null when none match.
 *
 * If any test in this file fails it means a future edit broke the parser
 * registry seam — adding a second parser must require zero central-switch edits.
 *
 * NOTE: ParserRegistry is a module-level singleton. Tests register additional
 * parsers but cannot un-register them. Tests are designed to be order-independent
 * by using header-keyed claim logic (each parser only claims its own unique header).
 */
import { describe, it, expect } from 'vitest'
import { ParserRegistry, type CsvParser } from '../src/domain/parsers/registry'
import type { ParseFileResult } from '../src/domain/types'

/** Unique prefix to avoid cross-test collision in the singleton registry */
const UNIQUE = '__registry_test__'

/**
 * Create a parser that claims only when headers contain a specific sentinel header.
 * Using a unique sentinel per test prevents cross-test pollution in the singleton.
 */
function makeSentinelParser(name: string, sentinel: string): CsvParser {
  return {
    name,
    claim(headers: string[]): boolean {
      return headers.includes(sentinel)
    },
    transform(_rows: Record<string, string>[], _file: File): ParseFileResult {
      throw new Error(`${name}.transform should not be called in this test`)
    },
  }
}

describe('ParserRegistry', () => {
  it('returns the first parser whose claim() returns true', () => {
    const sentinelA = `${UNIQUE}first-match-a`
    const sentinelB = `${UNIQUE}first-match-b`
    const parserFirst = makeSentinelParser('first-match-parser-a', sentinelA)
    const parserSecond = makeSentinelParser('first-match-parser-b', sentinelA)

    // Both claim sentinelA; only parserFirst should be registered before parserSecond
    // We register both and confirm the first one registered is returned
    const indexBefore = (ParserRegistry as unknown as { _registrySize?: () => number })._registrySize?.() ?? -1

    ParserRegistry.register(parserFirst)
    ParserRegistry.register(parserSecond)

    const result = ParserRegistry.claim([sentinelA, sentinelB])
    // first registered parser that matches should be returned
    expect(result).toBe(parserFirst)
  })

  it('does not return a parser whose claim() returns false', () => {
    // A parser that only claims a sentinel not present in the query headers
    const sentinel = `${UNIQUE}false-claim-sentinel`
    const nonMatchingParser = makeSentinelParser('false-claim-parser', sentinel)

    ParserRegistry.register(nonMatchingParser)

    // Query with headers that do not include the sentinel — the parser should not match
    const otherSentinel = `${UNIQUE}other-headers-xyz`
    const result = ParserRegistry.claim([otherSentinel])

    // Either null or some other parser that was registered earlier for different headers
    // The key assertion: nonMatchingParser itself must not be returned
    if (result !== null) {
      expect(result.name).not.toBe('false-claim-parser')
    }
  })

  it('returns null when no registered parser matches the headers', () => {
    // Use a sentinel that no registered parser has claimed
    const unclaimedHeader = `${UNIQUE}unclaimed-header-guaranteed-unique-xyz-987654`
    const result = ParserRegistry.claim([unclaimedHeader])
    expect(result).toBeNull()
  })

  it('can register a second parser without editing a central switch', () => {
    // DATA-03: adding a new parser is just register() — no switch
    const sentinelA = `${UNIQUE}data03-parser-a-sentinel`
    const sentinelB = `${UNIQUE}data03-parser-b-sentinel`

    const parserA = makeSentinelParser('data03-parser-a', sentinelA)
    const parserB = makeSentinelParser('data03-parser-b', sentinelB)

    ParserRegistry.register(parserA)
    ParserRegistry.register(parserB)

    // parserA only claims sentinelA; parserB only claims sentinelB
    const resultA = ParserRegistry.claim([sentinelA])
    const resultB = ParserRegistry.claim([sentinelB])
    const resultNeither = ParserRegistry.claim([`${UNIQUE}no-match-data03`])

    expect(resultA).toBe(parserA)
    expect(resultB).toBe(parserB)
    expect(resultNeither).toBeNull()
  })
})
