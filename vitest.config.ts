import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Default environment is 'node' per CLAUDE.md.
    // Per-file jsdom override via // @vitest-environment jsdom docblock.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
})
