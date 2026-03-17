---
type: Component
domain: Flowti
stage: done
description: "Async preview component that parses pipeline sources and displays projected import results before execution"
source: "[[Development/flowti/src/ui/hub/pipelines/PipelinePreview.ts|PipelinePreview.ts]]"
parent: "[[PipelinesTab]]"
tags:
  - hub
  - pipeline
  - component
---

# PipelinePreview

## Description

PipelinePreview performs an async dry-run analysis of a pipeline's CSV sources and renders a preview card showing what would happen if the pipeline were executed. It parses each source file, collects merge key values, checks which notes already exist in the vault, and displays per-source statistics, export step details, and a scrollable item list with new/update indicators. The preview card includes a "Run Pipeline" button to proceed to actual execution.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element; the preview card is inserted after the actions bar |
| `deps` | `PipelineComponentDeps` | Shared dependency bag providing app, services, state, and callbacks |
| `deps.app` | `App` | Vault access to check if target notes already exist (`getAbstractFileByPath`) |
| `deps.dataExchangeService` | `DataExchangeService` | `getImportService()` for CSV parsing and filename sanitization; `getExportConfig()` for export step details |
| `deps.executePipeline` | callback | Called when the user clicks "Run Pipeline" from the preview footer |
| `Notice` | Obsidian | Shows a notice if the pipeline has no sources |

## State

**Reads:** Receives the pipeline object as a `run(pipe)` argument. Does not call `getState()`.

**Writes:** No state mutations. The preview card is a self-contained DOM element that removes itself on cancel or on proceeding to execution.

## Internal Types

| Type | Fields | Purpose |
|------|--------|---------|
| `PreviewSource` | `sourceId, csvName, rowCount, columns, mergeKeyValues, error?` | Per-source parse results |
| `PreviewEntry` | `key, filename, exists` | Per-item projection (merge key value, resolved filename, existence check) |

## Renders

- **Loading state**: Spinner icon with "Preparing preview..." text while parsing sources
- **Error state**: Red x-circle icon with error message if parsing fails entirely
- **Preview header**: Eye icon + "Pipeline Preview" label
- **Stats badges**: Total item count, new items count (green), update items count (accent color)
- **Sources list**: Per-source rows showing CSV name, row count, column count; error sources show alert-triangle with error message
- **Export Steps section** (conditional): Lists linked export configs with format, output path, and external flag
- **Items list**: Scrollable (max 200px) list of merge key entries with colored dot indicators (green circle = new, accent circle = update) and "New"/"Update" badges
- **Footer**: Cancel button (removes preview) and "Run Pipeline" button (disabled if any source has errors)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | PipelinePreview does not directly emit or listen to events; it reads data via service methods and delegates execution to the orchestrator callback |

## Related

- Parent: [[PipelinesTab]]
- Siblings: [[PipelineDetail]], [[PipelineEditForm]], [[PipelineExecution]], [[SourcesExportsGrid]]
