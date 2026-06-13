import './styles/global.css'
import './styles/drop-zone.css' // Phase 2: drop-zone state CSS
import './styles/battery-picker.css' // Phase 4: battery spec-card picker
import './styles/comparison-table.css' // Phase 4: comparison table + saldering columns
import './styles/results-region.css' // Phase 4: results region layout + cadence banner
import { renderShell } from './shell'
import { initDropZone } from './ui/drop-zone'
import { initBatteryPicker } from './ui/battery-picker'
import { initPeriodControl } from './ui/period-control'
import { initComparisonTable } from './ui/comparison-table'
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

// Period control and comparison table fill #results-region:
const resultsRegion = document.getElementById('results-region')
if (resultsRegion) {
  initPeriodControl(resultsRegion)
  // Capture the dispose function so it can be called on HMR teardown (WR-01).
  const disposeComparisonTable = initComparisonTable(resultsRegion)
  if (import.meta.hot) {
    import.meta.hot.dispose(() => disposeComparisonTable())
  }
}
