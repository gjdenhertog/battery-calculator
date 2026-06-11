import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Default environment is 'node' per CLAUDE.md.
    // Per-file jsdom override via // @vitest-environment jsdom docblock.
    environment: 'node',
    // Global setup: installs a minimal Worker mock so that src/state/app-state.ts
    // (which constructs the Comlink sim worker singleton at module scope) can be
    // imported transitively by jsdom tests (e.g. drop-zone.test.ts → drop-zone.ts
    // → app-state.ts) without throwing "Worker is not defined".
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
})
