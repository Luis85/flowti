---
type: Component
domain: Flowti
stage: done
description: "Main dashboard overview for the Data Exchange Hub with stats, imports, exports, pipelines, and available files"
source: "[[Development/flowti/src/ui/hub/HubDashboard.ts|HubDashboard.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# HubDashboard

## Description

HubDashboard renders the main overview page of the Data Exchange Hub. It displays a title bar, data dictionary stat cards (types, properties, reports), a pipelines summary table, configured imports and exports tables, and a list of unconfigured CSV files available in the vault. It acts as the landing page when the hub view opens, delegating large table sections to extracted sub-components (DashboardPipelines, DashboardImports, DashboardExports).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, eventBus, state accessors, navigation, scheduleRender |
| DashboardImportExecutor | class | Handles inline import execution with progress feedback |
| renderDashboardPipelines | function | Renders the pipelines summary table section |
| renderConfiguredImports | function | Renders the configured imports table section |
| renderConfiguredExports | function | Renders the configured exports table section |
| Notice | obsidian | Displays toast notifications for CSV doc creation |
| TFile | obsidian | Type-checks vault files for opening |
| setIcon | obsidian | Renders Lucide icons in section headers and UI elements |

## State

**Reads via `deps.getState()`:**
- `csvFileEntries` — all discovered CSV files with their linked configs
- `exportConfigs` — used to identify export output paths for partitioning
- `dictionaryEntries` — count for the data dictionary stats card
- `reportEntries` — count for the reports stats card
- `typeEntries` — count for the types stats card
- `showHiddenCsvs` — toggle state for showing/hiding hidden CSV files
- `pipelineConfigs` — (read indirectly via sub-components)

**Writes via `deps.setState()`:**
- `showHiddenCsvs` — toggled when user clicks the hidden files visibility chip

## Renders

- **Title bar** — "Data Exchange Hub" heading with arrow-left-right icon
- **Data Dictionary stats** — three clickable cards (Types, Properties, Reports) with counts, navigating to respective tabs
- **Import Pipelines section** — delegated to `renderDashboardPipelines()`
- **Configured Imports section** — delegated to `renderConfiguredImports()`, showing CSV files that have import configs
- **Configured Exports section** — delegated to `renderConfiguredExports()`
- **Available Files section** — table of unconfigured CSV files with columns: File, Doc, Actions (hide/unhide, import). Includes a toggle chip for hidden files and supports creating CSV documentation inline.

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none directly) | — | Dashboard delegates event handling to sub-components (DashboardImportExecutor, DashboardImports, etc.) |

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ImportsTab]], [[ExportsTab]], [[ReportsTab]], [[PropertiesTab]], [[TypesTab]], [[PipelinesTab]]
- Children: [[DashboardImports]], [[DashboardExports]], [[DashboardPipelines]], [[DashboardImportExecutor]]
