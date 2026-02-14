---
type: Component
domain: Flowti
stage: done
description: "Read-only detail view showing pipeline header, actions bar, config card, and delegating to SourcesExportsGrid"
source: "[[Development/flowti/src/ui/hub/pipelines/PipelineDetail.ts|PipelineDetail.ts]]"
parent: "[[PipelinesTab]]"
tags:
  - hub
  - pipeline
  - component
---

# PipelineDetail

## Description

PipelineDetail renders the full read-only detail panel for a selected pipeline. It displays a header with badges, an actions bar with Execute/Preview/Edit/Doc/View/Delete links, a description card (pulled from the linked pipeline doc file's frontmatter), and a configuration info card. It delegates the sources and exports grid sections to the `SourcesExportsGrid` sub-component.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `deps` | `PipelineComponentDeps` | Shared dependency bag providing app, services, state, and callbacks |
| `deps.app` | `App` | Obsidian App instance for vault access, workspace navigation, and metadataCache |
| `deps.dataExchangeService` | `DataExchangeService` | Retrieve export configs, pipeline doc paths, ensure/create pipeline docs, delete pipelines |
| `deps.executePipeline` | callback | Triggers pipeline execution (delegated to orchestrator) |
| `deps.runPreview` | callback | Triggers pipeline preview (delegated to orchestrator) |
| `deps.setState` | callback | Updates HubState (e.g., `editingPipelineId`, `selectedPipelineId`) |
| `deps.renderDetail` | callback | Re-renders the detail panel after state changes |
| `deps.scheduleRender` | callback | Schedules a full re-render of the hub view |
| `SourcesExportsGrid` | component | Sub-component instantiated in constructor, renders sources/exports grid |
| `ConfirmModal` | modal | Confirmation dialog for pipeline deletion |
| `addInfoRow` | helper | Renders key-value rows in the config info grid |
| `resolvePipelineBaseFile` | helper | Resolves the `.base` file associated with the pipeline |

## State

**Reads:** No direct `getState()` calls -- receives the pipeline object as a `render(pipe)` argument.

**Writes:**
- `editingPipelineId` -- set to `pipe.id` when the Edit action is clicked
- `selectedPipelineId` -- set to `null` after successful deletion

## Renders

- **Header row**: Pipeline name, "Pipeline" badge, merge key badge, source count badge, optional note type badge, export config badges (with file-output icons)
- **Actions bar**: Execute (play), Preview (eye), Update (pencil), Read Doc / Create Doc (file-text / file-plus), Open View (table, conditional on base file existing), Delete (trash-2, styled in error color)
- **Description card**: Conditionally rendered if a pipeline doc file exists and has a `description` frontmatter field
- **Config info card**: Grid of key-value pairs -- Target Folder, Merge Key, Sources count, Note Type, Name Prefix, Name Suffix, Base View, Created timestamp, Last Run timestamp
- **SourcesExportsGrid**: Delegated rendering of sources, export steps, conflict warnings, and custom properties

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none directly) | -- | PipelineDetail does not directly emit or listen to events; it delegates execution and preview to orchestrator callbacks |

## Related

- Parent: [[PipelinesTab]]
- Siblings: [[PipelineEditForm]], [[PipelinePreview]], [[PipelineExecution]], [[SourcesExportsGrid]]
