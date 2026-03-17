---
type: Component
domain: Flowti
stage: done
description: "Inline Settings-based form for editing pipeline configuration fields with folder picker"
source: "[[Development/flowti/src/ui/hub/pipelines/PipelineEditForm.ts|PipelineEditForm.ts]]"
parent: "[[PipelinesTab]]"
tags:
  - hub
  - pipeline
  - component
---

# PipelineEditForm

## Description

PipelineEditForm renders an inline editing form for a pipeline's configuration fields. It uses Obsidian's `Setting` API to build a structured form with text inputs, a toggle, and a folder picker modal. The form captures edits in a local partial object and persists them via `DataExchangeService.updatePipeline()` on save.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render the form into |
| `deps` | `PipelineComponentDeps` | Shared dependency bag providing app, services, state, and callbacks |
| `deps.app` | `App` | Obsidian App instance, passed to `FolderPickerModal` and `Setting` components |
| `deps.dataExchangeService` | `DataExchangeService` | `updatePipeline()` to persist edits |
| `deps.setState` | callback | Clears `editingPipelineId` on save or cancel |
| `deps.renderDetail` | callback | Re-renders the detail panel after cancel |
| `deps.scheduleRender` | callback | Schedules a full re-render after save |
| `Setting` | Obsidian | Renders labeled form fields (text inputs, toggles, extra buttons) |
| `FolderPickerModal` | modal | Browse vault folders for the target folder field |
| `getVaultFolders` | helper | Lists all vault folders for the folder picker |
| `Notice` | Obsidian | Shows "Pipeline updated" toast on save |

## State

**Reads:** Receives the pipeline object as a `render(pipe)` argument. Does not call `getState()`.

**Writes:**
- `editingPipelineId` -- set to `null` on both Save and Cancel to exit edit mode

## Renders

- **Heading**: "Edit Pipeline" (h3)
- **Name field**: Text input pre-filled with `pipe.name`
- **Target folder field**: Text input with an extra button (folder icon) that opens `FolderPickerModal`
- **2-column grid** containing:
  - Merge key: text input with placeholder "e.g. item_id"
  - Note type: text input with placeholder "e.g. Event, Asset"
  - Filename prefix: optional text input
  - Filename suffix: optional text input
  - Create .base view: toggle that shows/hides the base file path field
- **Base file path**: text input (conditionally visible based on the toggle above)
- **Actions bar**: Save (check icon) and Cancel (x icon) links

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | PipelineEditForm does not directly emit or listen to events; it calls `dataExchangeService.updatePipeline()` directly |

## Related

- Parent: [[PipelinesTab]]
- Siblings: [[PipelineDetail]], [[PipelinePreview]], [[PipelineExecution]], [[SourcesExportsGrid]]
