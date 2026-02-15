---
status: open
severity: medium
category: architecture
layer: ui
created: 2026-02-15
effort: medium
description: "CsvActionView, ExportView, and DataExchangeHubView call DataExchangeService methods directly for CRUD and scanning, bypassing the EventBus command pattern."
source: "[[Technical Review 2026-02-15]]"
---
# TD-42: Direct service calls from Views bypass EventBus

## Problem

Three orchestrator Views call `DataExchangeService` (and its sub-services) directly instead of routing through EventBus commands. This violates the EventBus-first communication principle established in ADR-008 (UI Command Bus).

| View | Direct Calls | Category |
|------|-------------|----------|
| CsvActionView | `saveImportConfig()`, `updateImportConfig()`, `getImportService()`, `getCsvDisplaySettings()`, `saveCsvDisplaySettings()` | CRUD + read |
| ExportView | `saveExportConfig()`, `updateExportConfig()`, `executeExport()`, `scanColumns()`, `resolveExportFiles()`, `scanViewFileProperties()`, `scanDisplayNames()` | CRUD + scanning |
| DataExchangeHubView | `getSavedImportConfigs()`, `getSavedExportConfigs()`, `getSavedPipelines()`, `buildDataDictionary()` | read |

### Contrast with compliant Views

- **EventCatalogView**: Zero direct service calls. All state comes from EventBus listeners (`subscription.loaded`, `eventDefinition.loaded`, `discovery.loaded`). All mutations go through EventBus commands (`subscription.create`, `doc.create`).
- **EventLogView**: Pure EventBus consumer. No service dependency at all.

## Impact

- Views are tightly coupled to `DataExchangeService` interface. Changes to service method signatures require View updates.
- Testing Views requires full service mocks instead of EventBus spies.
- Service calls from Views are not observable in the Activity Log.

## Suggested Fix

### Phase 1: Route write operations through EventBus commands

Add new events to `dataExchange/events.ts`:
- `dataExchange.import.saveConfig` / `dataExchange.import.configSaved`
- `dataExchange.export.saveConfig` / `dataExchange.export.configSaved`
- `dataExchange.csvDisplay.save` / `dataExchange.csvDisplay.saved`

Replace direct CRUD calls in Views with `eventBus.emit(command)` + listen for response events.

### Phase 2 (optional): Route scan operations through EventBus

Replace `scanColumns()`, `resolveExportFiles()` etc. with request/response event pairs. This is more complex due to the synchronous data flow these scans participate in.

### Acceptable exceptions

Read-only queries during initialization (e.g., `getSavedImportConfigs()` on view open) are acceptable. The EventBus pattern adds verbosity without clear benefit for one-time data loading.

## Affected Files

- `src/ui/CsvActionView.ts` (755 LOC)
- `src/ui/ExportView.ts` (656 LOC)
- `src/ui/DataExchangeHubView.ts` (486 LOC)
- `src/domain/dataExchange/events.ts` (new events)
- `src/domain/dataExchange/DataExchangeService.ts` (new event handlers)
