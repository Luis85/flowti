---
type: Component
domain: Flowti
stage: done
description: "Central management view for import/export operations, configs, pipelines, reports, properties, and types"
source: "[[Development/flowti/src/ui/DataExchangeHubView.ts|DataExchangeHubView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# DataExchangeHubView

## Description

DataExchangeHubView is the orchestrator for the Data Exchange Hub, a central management view for all import and export operations. It extends `BaseHubView<DXTab>` and provides a tabbed interface with a dashboard landing page and 9 sub-tabs: Pipelines, Imports, Exports, Types, Properties, Signals, Reports, Canvas, and Analytics. Each sub-tab uses a master-detail split layout.

The view is registered under the type `flowti-data-exchange-hub` and displays as "Data Exchange Hub" with the `arrow-left-right` icon. It owns all scanning logic for configs, CSV files, property docs, type docs, and report docs, passing this data to child components via `HubComponentDeps`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Subscribe to config changes, import/export completions, and file lifecycle events |
| `DataExchangeService` | class | Access saved configs, pipelines, data dictionary, property/type/report folder paths, and CSV display settings |
| `openCsvImport` | callback | Opens a CSV file in the CsvActionView for import |
| `openExport` | callback | Opens the ExportView with a saved export config |
| `openNewExport` | callback | Opens the ExportView for a new export from a source path |
| `HubDashboard` | class | Renders the dashboard landing page with stats and quick actions |
| `ImportsTab` | class | Renders the imports master-detail tab |
| `ExportsTab` | class | Renders the exports master-detail tab |
| `ReportsTab` | class | Renders the reports (CSV docs) master-detail tab |
| `PropertiesTab` | class | Renders the data dictionary properties master-detail tab |
| `PipelinesTab` | class | Renders the multi-import pipelines master-detail tab |
| `TypesTab` | class | Renders the note type docs master-detail tab |
| `CanvasTab` | class | Renders the canvas import configs master-detail tab |
| `SignalsTab` | class | Renders the Azure DevOps signal connections master-detail tab |
| `AnalyticsTab` | class | Renders the CSV analytics query builder master-detail tab |
| `AnalyticsResultsPanel` | class | Renders query results within AnalyticsTab |
| `CanvasService` | class | Canvas config CRUD and import orchestration |
| `SignalService` | class | Signal CRUD, sync orchestration, and connection testing |
| `AnalyticsService` | class | Analytics query execution and saved query persistence |
| `buildSplitLayout` | function | Creates the shared dashboard + master/detail DOM skeleton |

## State

The view manages state for all hub sub-tabs:

- **`currentPage`**: Active tab (`"dashboard" | "pipelines" | "imports" | "exports" | "types" | "properties" | "signals" | "reports" | "canvas" | "analytics"`)
- **`importConfigs`**: Array of `SavedImportConfig` from DataExchangeService
- **`exportConfigs`**: Array of `SavedExportConfig` from DataExchangeService
- **`pipelineConfigs`**: Array of `SavedMultiImportPipeline` from DataExchangeService
- **`dictionaryEntries`**: Array of `DataDictionaryEntry` built from all configs
- **`reportEntries`**: Array of `ReportEntry` scanned from the reports folder
- **`typeEntries`**: Array of `TypeDocEntry` scanned from the types folder
- **`csvFileEntries`**: Array of `CsvFileEntry` scanned from the entire vault
- **`documentedProperties`**: Set of property names that have corresponding doc files
- **`filterText`**: Current search text
- **`showHiddenCsvs`**: Toggle for hidden CSV files
- **Selected/editing IDs**: `selectedImportId`, `selectedExportId`, `selectedDictProp`, `selectedReportPath`, `selectedPipelineId`, `selectedTypeName`, `editingImportId`, `editingExportId`, `editingPipelineId`

State is exposed to child components via `getState()` / `setState()` on `HubComponentDeps`.

## Renders

- **Top bar**: Title (clickable to return to dashboard) -- hidden on dashboard
- **Dashboard view** (`HubDashboard`): Stats grid with import/export/pipeline counts and quick actions
- **Split layout** (non-dashboard tabs):
  - **Search header**: Search input with per-tab placeholder
  - **Master tree**: Searchable list of configs, properties, reports, pipelines, or types
  - **Detail panel**: Full detail for selected item with edit/execute actions
- **Scheduled rendering**: 16ms debounced re-renders via `scheduleRender()`

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `dataExchange.config.changed` | Listens | Refresh all configs and re-render |
| `dataExchange.import.completed` | Listens | Re-render after import completes |
| `dataExchange.export.completed` | Listens | Re-render after export completes |
| `file.created` | Listens | Re-scan property docs when file created in properties folder |
| `file.deleted` | Listens | Re-scan property docs when file deleted from properties folder |

## Related

- Children: [[HubDashboard]], [[PipelinesTab]], [[ImportsTab]], [[ExportsTab]], [[TypesTab]], [[PropertiesTab]], [[SignalsTab]], [[ReportsTab]], [[CanvasTab]], [[AnalyticsTab]], [[AnalyticsResultsPanel]], [[DashboardImports]], [[DashboardExports]], [[DashboardPipelines]], [[DashboardImportExecutor]]
- Opens: [[CsvActionView]], [[ExportView]], [[CanvasActionView]]
- Planned: Analytics tab extraction to dedicated Analytics Hub in [[Cycle 28 - Analytics Hub]]
