import './styles/global.css'
import './styles/drop-zone.css' // Phase 2: drop-zone state CSS
import './styles/battery-picker.css' // Phase 4: battery spec-card picker
import './styles/comparison-table.css' // Phase 4: comparison table + saldering columns
import './styles/results-region.css' // Phase 4: results region layout + cadence banner
import './styles/charts.css' // Phase 5: chart section + wrapper + legend
import './styles/tooltips.css' // Phase 5: term-tooltip CSS-class-based show/hide
import './styles/transparency-panel.css' // Phase 5: collapsible assumptions panel
import './styles/mobile-reflow.css' // Phase 5: @media (max-width: 480px) stacked cards + chart height
import { renderShell } from './shell'
import { initDropZone } from './ui/drop-zone'
import { initBatteryPicker } from './ui/battery-picker'
import { initPeriodControl } from './ui/period-control'
import { initComparisonTable } from './ui/comparison-table'
import { effect } from '@preact/signals-core'
import { salderingOn, scheduleRecompute, cancelRecompute } from './state/app-state'
import { initMonthlyBarsChart } from './ui/charts/monthly-bars'
import { initFlowChart } from './ui/charts/flow-chart'
import { renderTransparencyPanel } from './ui/transparency-panel'
import { initTooltips } from './ui/tooltips'
// app-state module self-initializes the Comlink worker singleton on import
// (transitively pulled in by battery-picker, period-control, comparison-table)

// The 3-region shell is pre-rendered in index.html for static delivery.
// renderShell is exported from shell.ts and used by:
//   1. Plan 02 jsdom tests (DOM contract assertions)
//   2. Future phases that may mount the shell dynamically (e.g. SPA routing)
//
// In this static-first delivery model we only call renderShell when the #app
// element has no children (i.e. when running under jsdom in tests, or if the
// index.html shell is somehow absent).
const app = document.getElementById('app')
if (app && app.children.length === 0) {
  renderShell(app)
}

const dropZoneRegion = document.getElementById('drop-zone-region')
if (dropZoneRegion) {
  initDropZone(dropZoneRegion)
  // Battery picker mounts inside the same #drop-zone-region (D-16):
  // the picker sits alongside the drop-zone for a combined "upload + choose battery" region.
  initBatteryPicker(dropZoneRegion)
}

// Period control and comparison table fill #results-region.
// The comparison table gets its own dedicated child mount so its innerHTML='' calls
// only clear the table area — the sibling period-control <section> is unaffected.
const resultsRegion = document.getElementById('results-region')
if (resultsRegion) {
  initPeriodControl(resultsRegion)

  // Saldering options row — sits OUTSIDE comparison-table-mount so it is NOT wiped by
  // renderTable's container.innerHTML = '' on each re-render (D-10 / UAT Test 5 pattern).
  // The checkbox writes salderingOn and calls scheduleRecompute(true) on change (D-06).
  const salderingOptionsRow = document.createElement('div')
  salderingOptionsRow.className = 'saldering-options-row'

  const salderingLabel = document.createElement('label')
  salderingLabel.className = 'saldering-options-row__label'

  const salderingCheckbox = document.createElement('input')
  salderingCheckbox.type = 'checkbox'
  salderingCheckbox.className = 'saldering-options-row__checkbox'

  // Two-way bind: mirror salderingOn → checkbox via an effect so the control stays
  // consistent with the signal even if another writer sets salderingOn (WR-05).
  const disposeSalderingSync = effect(() => {
    salderingCheckbox.checked = salderingOn.value
  })

  const salderingLabelText = document.createElement('span')
  salderingLabelText.className = 'saldering-options-row__text'
  salderingLabelText.textContent = "Toon óók 'met saldering' (geldt t/m 2026)"

  salderingLabel.appendChild(salderingCheckbox)
  salderingLabel.appendChild(salderingLabelText)
  salderingOptionsRow.appendChild(salderingLabel)
  resultsRegion.appendChild(salderingOptionsRow)

  salderingCheckbox.addEventListener('change', () => {
    salderingOn.value = salderingCheckbox.checked
    scheduleRecompute(true) // discrete event → immediate
  })

  // Create a dedicated mount node for the comparison table AFTER the period control
  // has appended its <section>. This prevents renderEmpty/renderTable/renderError
  // from wiping the period-control section via container.innerHTML = '' (UAT Test 5).
  const comparisonTableMount = document.createElement('div')
  comparisonTableMount.id = 'comparison-table-mount'
  resultsRegion.appendChild(comparisonTableMount)
  // Capture the dispose function so it can be called on HMR teardown (WR-01).
  const disposeComparisonTable = initComparisonTable(comparisonTableMount)

  // Phase 5: monthly bars chart — appended AFTER comparison-table-mount (UI-SPEC order)
  const monthlyChartMount = document.createElement('div')
  monthlyChartMount.id = 'monthly-chart-mount'
  resultsRegion.appendChild(monthlyChartMount)
  const disposeMonthlyBars = initMonthlyBarsChart(monthlyChartMount)

  // Phase 5: sample-week energy flow step-line chart — appended after monthly bars
  const flowChartMount = document.createElement('div')
  flowChartMount.id = 'flow-chart-mount'
  resultsRegion.appendChild(flowChartMount)
  const disposeFlowChart = initFlowChart(flowChartMount)

  // Phase 5: transparency panel — static DOM builder, no signals; appended after charts
  const panel = renderTransparencyPanel()
  resultsRegion.appendChild(panel)

  // Phase 5: tooltip wiring — document-level tap-toggle + Escape handling
  initTooltips()

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cancelRecompute() // WR-06: drop any pending recompute before the worker is rebuilt
      disposeSalderingSync()
      disposeComparisonTable()
      disposeMonthlyBars()
      disposeFlowChart()
    })
  }
}
