---
type: Component
domain: Flowti
stage: done
description: "Stacked row layout rendering pipeline Inputs (CSV sources + canvas configs) and Outputs (export steps) with CRUD actions and conflict detection"
source: "[[Development/flowti/src/ui/hub/pipelines/SourcesExportsGrid.ts|SourcesExportsGrid.ts]]"
parent: "[[PipelinesTab]]"
tags:
  - hub
  - pipeline
  - component
---

# SourcesExportsGrid

## Description

SourcesExportsGrid renders a stacked row layout displaying a pipeline's inputs and outputs. The **Inputs row** contains CSV source cards and canvas config step cards. The **Outputs row** contains export step cards. Each source, canvas config, and export is shown as an interactive card with inline metadata and CRUD actions. The component also detects and highlights custom property conflicts across CSV sources and renders a merged custom properties summary.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `deps` | `PipelineComponentDeps` | Shared dependency bag providing app, services, state, and callbacks |
| `deps.app` | `App` | Vault access for resolving file paths, reading `.base` files, and opening files in workspace |
| `deps.dataExchangeService` | `DataExchangeService` | `getImportService()` for source modal; `getExportConfig()` for export details; `getSavedImportConfigs()` and `getSavedExportConfigs()` for chooser modals; `getExportService().getBaseEngine()` for base file parsing; `updatePipeline()` for add/remove operations; `getHiddenCsvPaths()` for filtering |
| `deps.canvasService` | `CanvasService` | Retrieve canvas config details for canvas step cards |
| `deps.setState` | callback | Sets `selectedExportId` when navigating to an export config |
| `deps.navigation` | `HubNavigationCallbacks` | `navigateTo("exports")` to switch to the Exports tab when clicking an export name |
| `deps.scheduleRender` | callback | Schedules a full re-render after source/export/canvas add or remove |
| `PipelineSourceModal` | modal | Opens for adding a new source or editing an existing source |
| `ConfigChooserModal` | modal | Picker modal for selecting an export config or canvas config to link to the pipeline |
| `ConfirmModal` | modal | Confirmation dialog for removing a source, canvas step, or export step |
| `addInfoRow` | helper | Renders key-value rows in the conflict and custom properties grids |

## State

**Reads:** Receives the pipeline object as a `render(pipe)` argument. Does not call `getState()`.

**Writes:**
- `selectedExportId` -- set when clicking an export card name to navigate to the Exports tab

## Renders

### Inputs Row
- **Section header**: "Inputs"
- **Empty state**: "No inputs configured yet." placeholder (when no CSV sources and no canvas configs)

**CSV Source Cards** (one per source):
  - Header row: CSV file icon, clickable filename (opens `PipelineSourceModal` for editing), merge key mapping badge (e.g., `item_id -> id`), column count badge (e.g., `5/8 cols`)
  - Info row: Full CSV file path
  - Custom properties row (conditional): Chips showing `key: value` pairs
  - Actions row: Remove link (red, with confirmation modal)
- **"+ Add Source" link**: Opens `PipelineSourceModal` in create mode

**Canvas Config Cards** (one per `canvasConfigIds` entry):
  - Header row: Square icon, config name, hierarchy mode badge, conflict strategy badge
  - Info row: Canvas file path, target folder
  - Actions row: Remove link (red, with confirmation modal)
- **"+ Add Canvas Step" link**: Opens `ConfigChooserModal` with available canvas configs (filtered to exclude already-added)

### Outputs Row
- **Section header**: "Outputs"
- **Empty state**: "No export steps configured." placeholder
- **Export cards** (one per export config):
  - Header row: File-output icon, clickable export name (navigates to Exports tab), format badge (CSV/TAB)
  - Source row (conditional): Base/Folder label with clickable path to open the source file
  - View row (conditional, for base sources): View index, async-resolved view name and type badge
  - Target row: Output file path
  - External badge (conditional): "external" indicator
  - Actions row: Remove link (red, with confirmation modal)
- **Deleted export card**: Shows "(deleted)" label with removal option
- **"+ Add Export Step" link**: Opens `ConfigChooserModal` filtered to available (unlinked) export configs; shows notice if none available

### Conflict Warnings Section
- Conditionally rendered when multiple sources define the same custom property key with different values
- Warning card with orange left border, alert-triangle icon, and conflict count
- Explanation text: "The last source processed will win"
- Grid listing each conflicting key with its values per source

### Custom Properties Summary Section
- Conditionally rendered when any source has custom properties
- Merged key-value grid showing the effective value for each custom property (last-source-wins)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | SourcesExportsGrid does not directly emit or listen to events; it calls `dataExchangeService.updatePipeline()` directly for mutations |

## Related

- Parent: [[PipelinesTab]]
- Siblings: [[PipelineDetail]], [[PipelineEditForm]], [[PipelinePreview]], [[PipelineExecution]]
