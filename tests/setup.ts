/**
 * tests/setup.ts — global Vitest setup file
 *
 * Provides a minimal Worker mock for the jsdom test environment.
 * Without this, importing src/state/app-state.ts (which constructs a Comlink
 * worker singleton at module scope via the Vite '?worker' import) would throw
 * "ReferenceError: Worker is not defined" in jsdom tests that transitively
 * import app-state (e.g. via drop-zone.ts).
 *
 * The mock is a no-op stub — it satisfies the constructor call and the
 * Comlink.wrap() call without actually spawning a worker thread.
 * scheduleRecompute() calls will queue a debounced async call that resolves
 * immediately (simApi.runComparison is a Proxy over a noop postMessage that
 * never resolves in test context — which is fine because no test exercises
 * the full worker round-trip here; worker contract tests use the domain
 * function directly per the dual-use pattern).
 */

// Only install the mock when the environment does not already provide Worker.
// In a real browser or Deno, Worker is a built-in and this guard is a no-op.
if (typeof globalThis.Worker === 'undefined') {
  // Minimal mock that satisfies: new Worker(url), worker.postMessage(), worker.terminate()
  class WorkerMock {
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_url: string | URL, _options?: WorkerOptions) {
      // No-op: do not actually spin up a worker thread in the test environment.
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    postMessage(_data: unknown, _transfer?: Transferable[]): void {
      // No-op: messages are silently dropped; the response never arrives.
    }

    terminate(): void {
      // No-op: nothing to terminate.
    }

    addEventListener(
      _type: string,
      _listener: EventListenerOrEventListenerObject,
      _options?: boolean | AddEventListenerOptions,
    ): void {
      // No-op.
    }

    removeEventListener(
      _type: string,
      _listener: EventListenerOrEventListenerObject,
      _options?: boolean | EventListenerOptions,
    ): void {
      // No-op.
    }
  }

  // Install on globalThis so Vite's ?worker WorkerWrapper can call new Worker(...)
  // when the sim-worker module is imported in the jsdom test context.
  globalThis.Worker = WorkerMock as unknown as typeof Worker
}
