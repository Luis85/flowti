---
type: Component
domain: Flowti
stage: done
description: "ItemView-based orchestrator for canvas import workflow with 4-page navigation (landing → config → preview → result)"
source: "[[Development/flowti/src/ui/CanvasActionView.ts|CanvasActionView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - canvas
  - component
---

# CanvasActionView

## Description

CanvasActionView is the orchestrator for the Canvas Import workflow, a dedicated ItemView that handles the full import lifecycle. Unlike CsvActionView, it uses Obsidian's `ItemView` base class directly (not BaseHubView) because Obsidian owns the `.canvas` file extension and a view extension would conflict.

The view navigates through 4 pages — Landing, Config, Preview, Result — rendering a step bar for navigation context. Each page is delegated to a standalone component class under `src/ui/canvas/`. The view also supports "auto-run" mode where a saved config is executed immediately, skipping the landing and config pages.

The view is registered under the type `flowti-canvas` and displays as "Canvas Import" with the `square` icon.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Subscribe to import progress/completion/failure events for live UI updates |
| `CanvasService` | class | Config CRUD (saveConfig, updateConfig, getConfig, getConfigs) and runImport pipeline |
| `CanvasLanding` | component | Renders the landing page (file info, stats, saved configs, quick-run) |
| `CanvasConfigPage` | component | Renders the configuration form (folder, mappings, type exclusion) |
| `CanvasPreviewPage` | component | Renders the impact preview (type distribution, groups, legend) |
| `CanvasResultPage` | component | Renders the result display (progress bar during import, summary after) |
| `FolderPickerModal` | modal | Fuzzy-searchable folder picker for target folder selection |
| `renderStepBar` | helper | Generic wizard stepper bar shared with CsvActionView and ExportView |
| `revealFolderInExplorer` | helper | Safe folder reveal in file explorer sidebar (no file creation) |
| `parseCanvasJson` | parser | Parse `.canvas` JSON into CanvasData |
| `extractLegend` | parser | Detect Legend group and extract color-to-type mappings |
| `buildCanvasItems` | parser | Convert raw nodes to typed CanvasItem array |
| `resolveParentage` | parser | Resolve spatial containment (group → child parent refs) |

## State

The view manages a consolidated `CanvasViewState` object:

- **Navigation**: `currentPage` ("landing" | "config" | "preview" | "result"), `loadedConfigId`
- **File info**: `canvasPath`, `targetFolder`, `configName`
- **Configuration**: `conflictStrategy`, `hierarchyMode`, `subfolderName`, `createCanvas`, `createBase`
- **Mappings**: `colorMap`, `shapeMap`, `excludedTypes`
- **Preview**: `previewItems` (CanvasItem[]), `legendMap`, `parseError`
- **Import state**: `importing`, `importDone`, `importSuccess`, `importProgress`, `importResult`, `artifactPaths`

State is exposed to child components via `CanvasComponentDeps.getState()` / `setState()`.

## Renders

- **Step bar**: 4 steps (Select, Configure, Preview, Import) with active/completed state
- **Landing page** (`CanvasLanding`): Canvas file info, dashboard stats, saved configs list
- **Config page** (`CanvasConfigPage`): Split layout — general settings (left), mappings + type exclusion (right)
- **Preview page** (`CanvasPreviewPage`): Impact analysis, type distribution, group structure, legend
- **Result page** (`CanvasResultPage`): Progress bar during import, summary with per-type breakdown after
- **Unsaved changes hint**: Visual indicator when config has been modified but not saved

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `canvas.import.progress` | Listens | Update progress bar percentage and current node title |
| `canvas.import.completed` | Listens | Show completion summary and enable result actions |
| `canvas.import.failed` | Listens | Show error state with retry actions |

## Related

- Children: [[CanvasLanding]], [[CanvasConfigPage]], [[CanvasPreviewPage]], [[CanvasResultPage]]
- Siblings: [[CsvActionView]], [[ExportView]]
- Entry points: Data Exchange Hub right-click context menu, `flowti:import-canvas` command, DX Hub Canvas tab
