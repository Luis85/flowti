---
type: Component
domain: Flowti
stage: done
description: "Preview page showing import impact analysis, type distribution, group/product structure, and legend"
source: "[[Development/flowti/src/ui/canvas/CanvasPreviewPage.ts|CanvasPreviewPage.ts]]"
parent: "[[CanvasActionView]]"
tags:
  - canvas
  - component
---

# CanvasPreviewPage

## Description

CanvasPreviewPage renders the "What will happen" impact analysis before executing a canvas import. It shows a configuration summary card, type distribution table with inclusion/exclusion status, folder structure visualization (for Product or Group hierarchy modes), and detected legend information.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `deps` | `CanvasComponentDeps` | Shared dependency bag providing state and callbacks |
| `deps.getState()` | callback | Read preview items, config, and legend data |
| `deps.setPage()` | callback | Navigate to config or result page |
| `deps.runImport()` | callback | Execute the import |
| `CANVAS_COLOR_LABELS` | constant | Color labels for legend display |
| `TYPE_FOLDER_MAP` | constant | Type-to-subfolder mapping for product structure visualization |
| `TYPE_ORDER` | constant | Type sort order for distribution table |
| `setIcon` | Obsidian API | Render icons in headers and status indicators |

## State

**Reads:** `canvasPath`, `targetFolder`, `subfolderName`, `hierarchyMode`, `conflictStrategy`, `createCanvas`, `createBase`, `previewItems`, `legendMap`, `parseError`, `excludedTypes` from `getState()`.

**Writes:** None — preview is read-only.

## Renders

- **Parse error alert** (conditional): Orange warning banner if canvas parsing had issues
- **Configuration card**: Grid showing Canvas file, Target folder, Import folder name, Hierarchy mode, Conflict strategy, Artifacts (canvas/base toggles)
- **"What will happen" summary card**: Total notes to create with excluded count
- **Type distribution table**: Type name, count, included/excluded status with color-coded badges
- **Product folder structure** (conditional, hierarchy="product"): Tree visualization of type-based subfolder hierarchy
- **Group folder structure** (conditional, hierarchy="group"): Tree visualization of canvas group containment hierarchy
- **Detected legend table** (conditional): Color → Resolved Type mapping from Legend group

### Action Bar
- **Back**: Return to config page
- **Import**: Execute import (navigates to result page)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | CanvasPreviewPage uses deps callbacks for all actions |

## Related

- Parent: [[CanvasActionView]]
- Siblings: [[CanvasLanding]], [[CanvasConfigPage]], [[CanvasResultPage]]
