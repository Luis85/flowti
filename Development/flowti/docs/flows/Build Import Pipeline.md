---
type: Flow
domain: Flowti
stage: done
description: "End-to-end journey from opening the Data Exchange Hub through creating a multi-step import pipeline to executing it"
domains:
  - Data Exchange
services:
  - DataExchangeService
  - PipelineExecutor
  - ImportService
events:
  - dataExchange.import.execute
  - dataExchange.import.completed
tags:
  - flow
  - pipeline
---

# Build Import Pipeline

## Overview

The Data Exchange Hub provides a pipeline builder that allows users to compose multiple saved import configurations into a sequential execution pipeline. This is useful for complex data ingestion scenarios where multiple CSV sources need to be imported into different folder structures in a coordinated manner. The pipeline executor runs each step in sequence, reporting progress and collecting results across all steps.

## Trigger

User opens the Data Exchange Hub via the sidebar icon or command palette, then navigates to the Pipelines tab.

## Steps

### 1. Open Data Exchange Hub

- **View/Service**: DataExchangeHub (orchestrator)
- **User Action**: User clicks the Data Exchange icon in the sidebar or runs the "Open Data Exchange Hub" command
- **System Response**: DataExchangeHub activates and renders its tab bar. The hub loads saved import configs, export configs, and pipeline definitions from DataExchangeService. The initial view shows the overview dashboard with summary statistics: total saved configs, recent executions, and quick action buttons
- **Events**: (none — UI reads state from DataExchangeService directly)

### 2. Navigate to Pipelines Tab

- **View/Service**: DataExchangeHub (Pipelines tab)
- **User Action**: User clicks the "Pipelines" tab in the hub header
- **System Response**: Pipelines tab renders a list of existing pipeline definitions (if any) in the master panel. Each pipeline entry shows its name, step count, and last execution timestamp. A "+" button in the header allows creating a new pipeline. If no pipelines exist, a placeholder message with a "Create Pipeline" call-to-action is shown
- **Events**: (none — UI only)

### 3. Create New Pipeline

- **View/Service**: DataExchangeHub (PipelineEditForm)
- **User Action**: User clicks the "+" button to create a new pipeline
- **System Response**: The detail panel switches to the PipelineEditForm. The form presents a name input field, an empty step list with an "Add Step" button, and configuration options for pipeline-level settings (such as error handling behavior). The user can begin building the pipeline by naming it and adding import source steps
- **Events**: (none — UI only)

### 4. Add Import Sources

- **View/Service**: DataExchangeHub (PipelineEditForm)
- **User Action**: User clicks "Add Step" and selects from a dropdown of saved import configurations. User repeats this to add multiple import sources to the pipeline
- **System Response**: Each added step appears in the step list with its name, target folder, and source CSV details (pulled from the referenced `SavedImportConfig`). Steps are displayed with drag handles for reordering and remove buttons for deletion. The form validates that at least one step is present before allowing save. A summary section shows the total number of steps, the distinct target folders, and an estimated row count based on the saved config metadata
- **Events**: (none — UI only)

### 5. Configure Pipeline Settings

- **View/Service**: DataExchangeHub (PipelineEditForm)
- **User Action**: User reorders steps by dragging them into the desired execution sequence. User configures pipeline-level settings: whether to stop on first error or continue through all steps, and an optional description for the pipeline
- **System Response**: PipelineEditForm updates the step order in real-time as the user drags steps. The error handling toggle switches between "Stop on error" (pipeline halts at first failed step) and "Continue on error" (pipeline runs all steps, collecting errors). The description field supports a brief text summary of the pipeline's purpose
- **Events**: (none — UI only)

### 6. Save Pipeline

- **View/Service**: DataExchangeService
- **User Action**: User clicks "Save Pipeline" after configuring all steps and settings
- **System Response**: DataExchangeService persists the pipeline definition under the `dataExchange` storage key alongside saved import and export configs. The Pipelines tab master list refreshes to show the newly created pipeline. The detail panel switches to the PipelineDetail view showing a read-only summary of the saved pipeline
- **Events**: (none — direct service call, no events for config CRUD)

### 7. Execute Pipeline

- **View/Service**: PipelineExecutor, ImportService
- **User Action**: User clicks "Execute" on the PipelineDetail view
- **System Response**: PipelineExecutor begins sequential execution of each pipeline step. For each step, it loads the referenced `SavedImportConfig`, resolves the source CSV file, and delegates to ImportService for the actual import. The detail panel switches to a progress view showing per-step status: pending, running (with row progress), completed, or failed. ImportService emits progress events for each row within each step. If "Stop on error" is configured and a step fails, remaining steps are marked as skipped
- **Events**: `dataExchange.import.execute` (per step) → `dataExchange.import.progress` (per row per step) → `dataExchange.import.completed` (per step)

### 8. Review Pipeline Results

- **View/Service**: DataExchangeHub (PipelineDetail — results view)
- **User Action**: User reviews the pipeline execution summary after all steps complete
- **System Response**: PipelineDetail renders a comprehensive results summary: total steps executed, steps succeeded, steps failed, steps skipped, total rows processed across all steps, total notes created/updated/skipped. Each step has an expandable section showing its individual results (matching the CsvResultPage format). A "Re-run" button allows executing the same pipeline again. The last execution timestamp is updated on the pipeline entry in the master list
- **Events**: (none — UI only, results aggregated from step completions)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Source selection | Any saved import configuration | User choice (at least one required) |
| Step order | User-defined drag-and-drop ordering | Order of addition |
| Error handling | Stop on first error / Continue through all steps | Stop on error |
| Re-execution | Run same pipeline again with current configs | N/A (manual trigger) |
| Step removal | Remove individual steps from pipeline | N/A (manual action) |

## Events Sequence

```
[Hub opens] → [Pipelines tab] → [create pipeline] → [add steps] → [save] → [execute] → dataExchange.import.execute (step 1) → dataExchange.import.progress (×N) → dataExchange.import.completed (step 1) → dataExchange.import.execute (step 2) → dataExchange.import.progress (×N) → dataExchange.import.completed (step 2) → ... → [results summary]
```

## Related Use Cases

- [[Import CSV as Notes]] (individual import configs are the building blocks of pipelines)
- [[Export Vault Data]] (export results can be re-imported via pipeline for round-trip workflows)
- [[Browse and Configure Events]] (import events from pipeline execution appear in the catalog)
