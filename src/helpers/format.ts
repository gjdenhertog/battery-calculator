/**
 * src/helpers/format.ts — display-layer number/date formatters (VIZ-04 spirit)
 *
 * Pure functions — no browser globals, safe to run in a Node environment.
 * All kWh values: exactly 1 decimal place (toFixed(1)). Percentages: 1 decimal + '%'.
 */

/** Format an energy value to 1 decimal place with kWh suffix (matches readout.ts formatKwh) */
export function formatKwh(n: number): string {
  return `${n.toFixed(1)} kWh`
}

/** Format a percentage to 1 decimal place with % suffix */
export function formatPct(n: number): string {
  return `${n.toFixed(1)} %`
}

/** Format a ratio (marginalBenutting) to 2 decimal places */
export function formatRatio(n: number): string {
  return n.toFixed(2)
}

/** Format a Date as DD-MM-YYYY in nl-NL locale (matches readout.ts formatDate) */
export function formatDate(d: Date): string {
  return d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Format an integer count with Dutch thousands separator (matches readout.ts formatRows) */
export function formatCount(n: number): string {
  return n.toLocaleString('nl-NL')
}
