---
type: Component
domain: Flowti
stage: done
description: "Data Exchange Hub tab for managing saved canvas import configurations with master/detail split and live progress"
source: "[[Development/flowti/src/ui/hub/CanvasTab.ts|CanvasTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - canvas
  - component
---

# CanvasTab

## Description

CanvasTab renders the Canvas tab within the Data Exchange Hub. It provides a master/detail split layout for managing saved canvas import configurations. The master list shows all saved configs with filter support. The detail panel shows config information in view mode or a full edit form in edit mode. During active imports, a live progress indicator with event listeners displays real-time status.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `masterEl` | `HTMLElement` | Master list container |
| `detailEl` | `HTMLElement` | Detail panel container |
| `deps` | `HubComponentDeps` | Shared dependency bag providing app, services, state, and callbacks |
| `deps.app` | `App` | Vault access for opening canvas files in workspace |
| `deps.canvasService` | `CanvasService` | Config CRUD (getConfigs, updateConfig, removeConfig), runImport |
| `deps.eventBus` | `IEventBus` | Subscribe to canvas import progress/completion/failure events |
| `deps.getState()` | callback | Read selected config ID, editing state, filter text |
| `deps.setState()` | callback | Update selected/editing state |
| `deps.scheduleRender()` | callback | Schedule full re-render after state changes |
| `ConfirmModal` | modal | Confirmation dialog for config removal |
| `FolderPickerModal` | modal | Folder picker for target folder in edit form |
| `addInfoRow` | helper | Render key-value rows in config info grids |
| `renderEmptyDetail` | helper | Render empty state in detail panel |
| `getEmptyDetailStats` | helper | Stats for empty detail display |
| `CANVAS_COLOR_LABELS` | constant | Color labels for mapping display |
| `DEFAULT_COLOR_MAP` | constant | Default color map for reset in edit form |
| `DEFAULT_SHAPE_MAP` | constant | Default shape map for reset in edit form |
| `TYPE_ORDER` | constant | Type sort order for exclusion editor |
| `Setting` | Obsidian API | Form controls for edit mode |
| `setIcon` | Obsidian API | Render icons in headers and action links |

## State

**Reads:** `selectedCanvasConfigId`, `editingCanvasConfigId`, `filterText`, `canvasConfigs` from `getState()`.

**Writes:**
- `selectedCanvasConfigId` -- set when clicking a config in master list
- `editingCanvasConfigId` -- set when clicking Update action, cleared on save/cancel

## Renders

### Master List
- **Category header**: "Canvas" with config count badge
- **Filtered config items**: Config name, canvas path, hierarchy mode badge
- **Selected state**: Active highlight on selected item
- **Empty state**: "No canvas configurations saved." message

### Detail Panel — View Mode
- **Config header**: Config name with badges (Canvas Import type, hierarchy mode, conflict strategy, artifact indicators)
- **Action links**: Execute (play), Open Canvas (file-text), Update (pencil), Remove (trash-2)
- **Active import progress card** (conditional): Live progress bar with event listeners for `canvas.import.progress`, `canvas.import.completed`, `canvas.import.failed`
- **Configuration info grid**: Canvas file, Target folder, Import folder, Conflict strategy, Hierarchy mode, Artifacts, Excluded types, Created date, Last used date
- **Color mapping info card**: Table of active color-to-type mappings
- **Shape mapping info card**: Table of active shape-to-type mappings

### Detail Panel — Edit Mode
- **Config name**: Text input
- **Canvas file**: Read-only display
- **Target folder**: Text input with Browse button
- **Import folder name**: Text input
- **Conflict strategy**: Dropdown
- **Hierarchy mode**: Dropdown
- **Post-import artifacts**: Toggle switches
- **Mapping editors**: Color and shape tables with inline editing and Reset buttons
- **Type exclusion editor**: Checkbox grid with All/None toggles
- **Action links**: Save (check), Cancel (x)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `canvas.import.progress` | Listens (live) | Update progress bar percentage and status text |
| `canvas.import.completed` | Listens (live) | Show completion summary with imported/skipped/errors |
| `canvas.import.failed` | Listens (live) | Show failure message with error details |

Live event listeners are subscribed per active operation and cleaned up via `cleanupLiveListeners()`.

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ImportsTab]], [[ExportsTab]], [[PipelinesTab]], [[ReportsTab]], [[PropertiesTab]], [[TypesTab]]
