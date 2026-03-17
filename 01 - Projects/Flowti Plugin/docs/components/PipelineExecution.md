---
type: Component
domain: Flowti
stage: done
description: "Real-time pipeline execution component with progress bar, event-driven status updates, and result breakdown"
source: "[[Development/flowti/src/ui/hub/pipelines/PipelineExecution.ts|PipelineExecution.ts]]"
parent: "[[PipelinesTab]]"
tags:
  - hub
  - pipeline
  - component
---

# PipelineExecution

## Description

PipelineExecution manages the live execution of a pipeline by emitting the `dataExchange.pipeline.execute` event and subscribing to progress and completion events. It renders a progress card with an animated progress bar that updates as each source completes, then replaces the progress UI with a results summary showing created/updated/skipped/failed counts, per-source breakdowns, and export step confirmations.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element; the execution card is inserted after the actions bar |
| `deps` | `PipelineComponentDeps` | Shared dependency bag providing app, services, state, and callbacks |
| `deps.eventBus` | `IEventBus` | Emits `dataExchange.pipeline.execute` to trigger the pipeline; listens for `sourceCompleted`, `completed`, and `failed` events |
| `deps.dataExchangeService` | `DataExchangeService` | `getExportConfig()` to display export step names in the result view |
| `deps.scheduleRender` | callback | Schedules a full re-render after successful completion |
| `Notice` | Obsidian | Shows completion or failure toast notifications |

## State

**Reads:** Receives the pipeline object as an `execute(pipe)` argument. Does not call `getState()`.

**Writes:** No state mutations. Calls `scheduleRender()` after successful completion to refresh the hub view.

## Renders

### During Execution
- **Status row**: Spinning loader icon with "Running pipeline: {name}..." text
- **Progress bar**: 4px animated bar that fills proportionally as sources complete (0% to 100%)
- **Detail text**: Per-source status updates showing CSV name with created/updated counts

### After Completion (Success)
- **Result header**: Green check-circle icon with summary message (e.g., "5 created, 3 updated, 0 skipped")
- **Stats grid**: 4-column grid showing Created (green), Updated, Skipped, and Failed (red if > 0) counts
- **Source breakdown** (conditional, shown when > 1 source): Per-source rows with CSV name and individual created/updated/skipped/failed counts
- **Export step confirmation** (conditional): Rows for each linked export config with file-output icon and green checkmark

### After Completion (Failure)
- **Error header**: Red x-circle icon with "Pipeline failed: {error}" message

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `dataExchange.pipeline.execute` | Emits | Triggers the pipeline execution with `{ pipelineId }` payload |
| `dataExchange.pipeline.sourceCompleted` | Listens | Updates progress bar and detail text as each source finishes processing |
| `dataExchange.pipeline.completed` | Listens | Renders success results; unsubscribes all listeners |
| `dataExchange.pipeline.failed` | Listens | Renders failure message; unsubscribes all listeners |

## Lifecycle

1. `execute(pipe)` is called by the orchestrator
2. Removes any existing `.ft-pipeline-progress` card
3. Renders initial progress UI with spinner and empty progress bar
4. Subscribes to three event bus listeners (`sourceCompleted`, `completed`, `failed`)
5. Emits `dataExchange.pipeline.execute` to start the pipeline
6. As each source completes, the progress bar and detail text update
7. On `completed` or `failed`, all listeners are unsubscribed and the progress card is replaced with results

## Related

- Parent: [[PipelinesTab]]
- Siblings: [[PipelineDetail]], [[PipelineEditForm]], [[PipelinePreview]], [[SourcesExportsGrid]]
