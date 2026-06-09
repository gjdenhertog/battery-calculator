import './styles/global.css'
import './styles/drop-zone.css' // Phase 2: drop-zone state CSS
import { renderShell } from './shell'
import { initDropZone } from './ui/drop-zone'

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
}
