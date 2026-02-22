---
type: Component
domain: Flowti
stage: done
description: "Result page showing live import progress, completion summary with per-type breakdown, errors, and next actions"
source: "[[Development/flowti/src/ui/canvas/CanvasResultPage.ts|CanvasResultPage.ts]]"
parent: "[[CanvasActionView]]"
tags:
  - canvas
  - component
---

# CanvasResultPage

## Description

CanvasResultPage renders the import result display. During import execution it shows a live progress bar with percentage and current node title. After completion it shows a "What happened" summary card, per-type breakdown table, error details (first 20), artifact links, and "What's next" action buttons. On error it shows the error message with retry options.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `deps` | `CanvasComponentDeps` | Shared dependency bag providing state, callbacks, and Obsidian App |
| `deps.getState()` | callback | Read import result, progress, and config data |
| `deps.setState()` | callback | Reset state for retry or new import |
| `deps.setPage()` | callback | Navigate to config page (edit config) or landing (close) |
| `deps.runImport()` | callback | Retry import on error |
| `deps.app` | `App` | Open files in workspace (rebuilt canvas, base view) |
| `revealFolderInExplorer` | helper | Safely reveal target folder in file explorer sidebar |
| `TYPE_ORDER` | constant | Type sort order for breakdown table |
| `TFile` | Obsidian API | Resolve file paths for workspace navigation |
| `setIcon` | Obsidian API | Render status icons (check-circle, alert-triangle, minus-circle) |

## State

**Reads:** `importing`, `importDone`, `importSuccess`, `importProgress`, `importResult`, `artifactPaths`, `canvasPath`, `configName`, `excludedTypes` from `getState()`.

**Writes:**
- Resets import state fields on "Run Again" or "Retry" actions

## Renders

### Progress State (importing = true)
- **"Importing..." heading** with animated indicator
- **Progress bar**: Percentage-based fill with current/total count
- **Current node title**: Displays the node being imported

### Success State (importDone = true, importSuccess = true)
- **Status header**: Icon (check-circle for clean, alert-triangle for partial, minus-circle for empty) with message
- **"What happened" card**: Grid showing Nodes processed, Notes created, Notes skipped, Errors, Excluded types, Duration, Target folder, Config name
- **Per-type breakdown table**: Type name, Imported count, Error count per type
- **Error details card** (conditional, max 20): Node title, error message per failed node
- **Artifacts section** (conditional): Links to rebuilt canvas file and .base index file
- **"What's next" actions**: Open Target Folder, Open Canvas, Open Base View, Run Again, Edit Config, Close

### Error State (importDone = true, importSuccess = false)
- **Status header**: Error icon with error message
- **Error message card**: Full error text
- **"What's next" actions**: Retry, Edit Config, Close

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none directly) | -- | CanvasResultPage reads event-driven state updates from the orchestrator |

## Related

- Parent: [[CanvasActionView]]
- Siblings: [[CanvasLanding]], [[CanvasConfigPage]], [[CanvasPreviewPage]]
