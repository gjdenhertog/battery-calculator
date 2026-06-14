/**
 * src/ui/charts/chart-tooltip.ts — CSP-safe hover tooltip for uPlot charts.
 *
 * Both Phase 5 charts need an on-hover readout identifying the series/battery
 * under the pointer (live-verification feedback, Phase 5). uPlot's built-in
 * cursor tooltip was avoided earlier over a CSP concern, but that concern was
 * mistaken: `style-src 'self'` only blocks parsed inline styles, `<style>`
 * elements, and `setAttribute('style', …)`. CSSOM property assignment
 * (`el.style.transform = …`, `el.style.backgroundColor = …`) is NOT blocked —
 * it is the same mechanism uPlot's own cursor uses. So this tooltip:
 *   - positions itself with `el.style.transform` (CSSOM — CSP-safe),
 *   - colors swatches with `el.style.backgroundColor` (CSSOM — CSP-safe),
 *   - shows/hides via a CSS class (`.chart-tooltip--visible`),
 *   - uses textContent for every label (battery names are user data — XSS safe).
 *
 * Hit-testing uses only uPlot's public API (`posToIdx`, `posToVal`,
 * `over.getBoundingClientRect()`) — no internal bbox/quadtree dependency.
 */
import type uPlot from 'uplot'

export interface TooltipRow {
  /** Series/battery label (may be user-derived → rendered via textContent) */
  label: string
  /** Pre-formatted value string, e.g. "1.2 kWh" */
  value: string
  /** Resolved CSS color (hex/rgb) for the swatch — applied via CSSOM */
  color: string
  /** When true, the row is visually emphasised (the hovered series/battery) */
  emphasis?: boolean
}

export interface TooltipContent {
  title: string
  rows: TooltipRow[]
}

export interface TooltipController {
  setContent(content: TooltipContent): void
  showAt(leftPx: number, topPx: number, wrapperW: number, wrapperH: number): void
  hide(): void
  destroy(): void
}

/**
 * Create a tooltip element inside `wrapper` (which must be position: relative).
 * Returns a controller; call destroy() on teardown.
 */
export function createChartTooltip(wrapper: HTMLElement): TooltipController {
  const el = document.createElement('div')
  el.className = 'chart-tooltip'
  el.setAttribute('role', 'tooltip')
  el.setAttribute('aria-hidden', 'true')
  wrapper.appendChild(el)

  function setContent(content: TooltipContent): void {
    el.replaceChildren()

    const title = document.createElement('div')
    title.className = 'chart-tooltip__title'
    title.textContent = content.title // textContent — XSS safe
    el.appendChild(title)

    for (const row of content.rows) {
      const rowEl = document.createElement('div')
      rowEl.className = row.emphasis
        ? 'chart-tooltip__row chart-tooltip__row--emphasis'
        : 'chart-tooltip__row'

      const swatch = document.createElement('span')
      swatch.className = 'chart-tooltip__swatch'
      // CSSOM assignment — NOT blocked by style-src 'self' (see file header).
      swatch.style.backgroundColor = row.color

      const label = document.createElement('span')
      label.className = 'chart-tooltip__label'
      label.textContent = row.label // textContent — battery name is user data

      const value = document.createElement('span')
      value.className = 'chart-tooltip__value'
      value.textContent = row.value // textContent — XSS safe

      rowEl.appendChild(swatch)
      rowEl.appendChild(label)
      rowEl.appendChild(value)
      el.appendChild(rowEl)
    }
  }

  function showAt(leftPx: number, topPx: number, wrapperW: number, wrapperH: number): void {
    // Clamp horizontally so the tooltip stays inside the wrapper.
    const tipW = el.offsetWidth || 160
    const half = tipW / 2
    const clampedLeft = Math.max(half, Math.min(leftPx, wrapperW - half))
    // Place above the cursor by default; flip below when near the top edge.
    const flipBelow = topPx < 80
    const offsetY = flipBelow ? 16 : -12
    const translateY = flipBelow ? '0' : '-100%'
    // CSSOM transform — CSP-safe positioning.
    el.style.transform = `translate(${clampedLeft}px, ${topPx + offsetY}px) translateX(-50%) translateY(${translateY})`
    el.classList.add('chart-tooltip--visible')
    el.setAttribute('aria-hidden', 'false')
    void wrapperH // reserved for future vertical clamping
  }

  function hide(): void {
    el.classList.remove('chart-tooltip--visible')
    el.setAttribute('aria-hidden', 'true')
  }

  function destroy(): void {
    el.remove()
  }

  return { setContent, showAt, hide, destroy }
}

/**
 * Build a uPlot plugin that drives a {@link createChartTooltip} controller from
 * pointer movement over the plot area. `buildContent` is chart-specific: given
 * the hovered data index and the cursor's x/y data values, it returns the
 * tooltip content (or null to hide).
 */
export function hoverTooltipPlugin(
  wrapper: HTMLElement,
  buildContent: (u: uPlot, idx: number, xVal: number, yVal: number) => TooltipContent | null,
): uPlot.Plugin {
  let tooltip: TooltipController | null = null
  let over: HTMLElement | null = null
  let onMove: ((e: MouseEvent) => void) | null = null
  let onLeave: (() => void) | null = null

  return {
    hooks: {
      init: (u: uPlot) => {
        tooltip = createChartTooltip(wrapper)
        over = u.over

        onMove = (e: MouseEvent) => {
          if (!tooltip || !over) return
          const overRect = over.getBoundingClientRect()
          const leftInOver = e.clientX - overRect.left
          const topInOver = e.clientY - overRect.top
          if (
            leftInOver < 0 ||
            topInOver < 0 ||
            leftInOver > overRect.width ||
            topInOver > overRect.height
          ) {
            tooltip.hide()
            return
          }
          const idx = u.posToIdx(leftInOver)
          const xVal = u.posToVal(leftInOver, 'x')
          const yVal = u.posToVal(topInOver, 'y')
          const content = buildContent(u, idx, xVal, yVal)
          if (!content || content.rows.length === 0) {
            tooltip.hide()
            return
          }
          tooltip.setContent(content)
          // Position relative to the wrapper (tooltip's offset parent).
          const wrapRect = wrapper.getBoundingClientRect()
          tooltip.showAt(
            e.clientX - wrapRect.left,
            e.clientY - wrapRect.top,
            wrapRect.width,
            wrapRect.height,
          )
        }

        onLeave = () => tooltip?.hide()

        over.addEventListener('mousemove', onMove)
        over.addEventListener('mouseleave', onLeave)
      },
      destroy: () => {
        if (over && onMove) over.removeEventListener('mousemove', onMove)
        if (over && onLeave) over.removeEventListener('mouseleave', onLeave)
        tooltip?.destroy()
        tooltip = null
        over = null
        onMove = null
        onLeave = null
      },
    },
  }
}
