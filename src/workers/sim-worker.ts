/**
 * src/workers/sim-worker.ts — Comlink worker entry (SIM-07)
 *
 * Thin adapter: re-exposes runComparison across the worker boundary via Comlink.
 * Pure-core/worker-shell split — tests NEVER import this file; they import
 * runComparison directly from '../domain/compare' (dual-use contract, SIM-07).
 */
import * as Comlink from 'comlink'
import { runComparison } from '../domain/compare'

Comlink.expose({ runComparison })
