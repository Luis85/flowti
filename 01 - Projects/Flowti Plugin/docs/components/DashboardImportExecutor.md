---
type: Component
domain: Flowti
stage: done
description: "Inline import executor that runs imports from dashboard table rows with progress bar and auto-dismissing results"
source: "[[Development/flowti/src/ui/hub/DashboardImportExecutor.ts|DashboardImportExecutor.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# DashboardImportExecutor

## Description

DashboardImportExecutor handles executing import configurations directly from the dashboard's configured imports table. When triggered, it inserts a progress row below the triggering table row, showing a spinner, progress bar, and status text that updates in real-time as the import proceeds. On completion or failure, it replaces the progress UI with a success/error result message and auto-dismisses after 5 seconds. It merges the config's `noteType` into `customProperties` before emitting the execute event.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides eventBus and scheduleRender for event communication |
| SavedImportConfig | type | Shape of the import config to execute |
| Notice | obsidian | Displays toast notifications on completion or failure |
| setIcon | obsidian | Renders Lucide icons (loader, check-circle, x-circle) |

## State

**Reads via `deps.getState()`:**
- (none directly)

**Writes via `deps.setState()`:**
- (none directly; triggers `deps.scheduleRender()` on successful completion after auto-dismiss)

## Renders

- **Progress row** — inserted as a `<tr>` after the triggering table row, spanning all 4 columns
  - Spinner icon (loader with `ft-spin` class)
  - Status text showing "Running '{name}'..." then "Importing... X / Y" with optional last filename
  - Progress bar (3px height, accent-colored fill with CSS transition)
- **Result row** — replaces progress content after completion
  - Check-circle (green) for success or x-circle (red) for failure
  - Summary text: "Done: N created, N updated, N skipped" or "Failed: {error}"
- **Auto-dismiss** — result row removed after 5 seconds, triggers dashboard re-render on success

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `dataExchange.import.execute` | Emits | Triggers the import pipeline with config parameters |
| `dataExchange.import.progress` | Listens | Updates progress bar percentage and status text |
| `dataExchange.import.completed` | Listens | Shows success result, cleans up listeners |
| `dataExchange.import.failed` | Listens | Shows error result, cleans up listeners |

## Related

- Parent: [[DashboardImports]], [[HubDashboard]]
- Siblings: [[DashboardExports]], [[DashboardPipelines]]
- Children: (none)
