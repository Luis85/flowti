---
type: Component
domain: Flowti
stage: done
description: "Landing page showing canvas file info, dashboard stats, and saved configurations with quick-run"
source: "[[Development/flowti/src/ui/canvas/CanvasLanding.ts|CanvasLanding.ts]]"
parent: "[[CanvasActionView]]"
tags:
  - canvas
  - component
---

# CanvasLanding

## Description

CanvasLanding renders the initial landing page of the Canvas Action View. It displays canvas file information, dashboard stats (saved config count, last imported date), an "Import as Notes" action button, and a list of saved canvas import configurations with inline metadata and quick-run capabilities.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `deps` | `CanvasComponentDeps` | Shared dependency bag providing state, callbacks, and canvas service |
| `deps.canvasService` | `CanvasService` | Retrieve saved configs for listing |
| `deps.getState()` | callback | Read canvas file path for display |
| `deps.setState()` | callback | Load selected config into view state |
| `deps.setPage()` | callback | Navigate to config page on "Import as Notes" click |
| `deps.runSavedConfig()` | callback | Execute a saved config immediately (quick-run) |
| `setIcon` | Obsidian API | Render Lucide icons in stat blocks |

## State

**Reads:** `canvasPath` from `getState()` for file info display.

**Writes:**
- Loads config fields into state when a saved config is selected (via `loadConfig()`)
- Triggers page navigation to "config" after loading

## Renders

- **Canvas file header**: Square icon with file path
- **Dashboard stats row**: Two stat blocks — saved configs count, last imported date (or "Never")
- **Action button**: "Import as Notes" primary button
- **Saved configurations list** (conditional, if configs exist):
  - Per-config card: Config name, canvas path, target folder badge, conflict strategy badge, hierarchy mode badge
  - "Run" quick-action button per card

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | CanvasLanding does not directly emit or listen to events; it uses callbacks on deps |

## Related

- Parent: [[CanvasActionView]]
- Siblings: [[CanvasConfigPage]], [[CanvasPreviewPage]], [[CanvasResultPage]]
