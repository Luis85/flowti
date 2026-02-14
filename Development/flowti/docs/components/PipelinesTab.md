---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for managing multi-source import pipelines with preview and execution, delegating to sub-components"
source: "[[Development/flowti/src/ui/hub/PipelinesTab.ts|PipelinesTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# PipelinesTab

## Description

PipelinesTab is a thin orchestrator that renders the master list of saved multi-import pipelines and dispatches detail rendering to four sub-components: PipelineDetail (read-only view), PipelineEditForm (edit mode), PipelinePreview (dry-run preview), and PipelineExecution (execution with progress feedback). The master list includes a "+" button for creating new pipelines via an InputModal. Pipelines merge multiple CSV sources into enriched notes by matching on a shared key column.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, eventBus, state accessors, navigation, scheduleRender |
| PipelineComponentDeps | interface | Extended deps passed to pipeline sub-components |
| PipelineDetail | class | Renders read-only pipeline detail view |
| PipelineEditForm | class | Renders pipeline edit form |
| PipelinePreview | class | Runs and displays pipeline dry-run preview |
| PipelineExecution | class | Executes pipeline with progress feedback |
| SavedMultiImportPipeline | type | Shape of persisted pipeline configuration |
| InputModal | class | Input dialog for entering new pipeline names |
| renderEmptyDetail | function | Renders placeholder when no pipeline is selected |
| getEmptyDetailStats | function | Computes summary stats for empty detail placeholders |
| setIcon | obsidian | Renders Lucide icons |

## State

**Reads via `deps.getState()`:**
- `pipelineConfigs` — the full list of SavedMultiImportPipeline objects
- `filterText` — text filter applied to master list (matches name, targetFolder, mergeKey)
- `selectedPipelineId` — currently selected pipeline ID
- `editingPipelineId` — pipeline ID being edited (switches detail to edit form)

**Writes via `deps.setState()`:**
- `selectedPipelineId` — set on master item click or after creating a new pipeline
- `editingPipelineId` — set to initiate editing, cleared on save/cancel

## Renders

**Master panel:**
- Header with "Import Pipelines" label, count badge, and "+" add button
- Filterable list items showing pipeline name, target folder and source count subtitle, and merge key badge
- Selected item highlight

**Detail panel (dispatched):**
- When no editing: delegates to `PipelineDetail.render(pipe)` for read-only view
- When editing: delegates to `PipelineEditForm.render(pipe)` for edit form
- Preview and execution are triggered via `PipelinePreview.run(pipe)` and `PipelineExecution.execute(pipe)` respectively

**New pipeline creation:**
- InputModal prompts for pipeline name
- Saves via `dataExchangeService.savePipeline()` with default settings
- Navigates to pipelines tab and enters edit mode

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none directly) | — | Event handling delegated to PipelineExecution and PipelinePreview sub-components |

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ImportsTab]], [[ExportsTab]], [[ReportsTab]], [[PropertiesTab]], [[TypesTab]], [[HubDashboard]]
- Children: PipelineDetail, PipelineEditForm, PipelinePreview, PipelineExecution (in `src/ui/hub/pipelines/`)
