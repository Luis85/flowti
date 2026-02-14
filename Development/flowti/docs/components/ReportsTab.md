---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing CsvDoc report documentation with frontmatter details and linked import configs"
source: "[[Development/flowti/src/ui/hub/ReportsTab.ts|ReportsTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# ReportsTab

## Description

ReportsTab renders the master list of CsvDoc report entries (documentation files for CSV sources) in the left panel and a detail view in the right panel. Each report represents a documented CSV file with frontmatter metadata including column headers, row counts, and descriptions. The detail panel shows all frontmatter properties, column header chips, links to associated import configs, and actions for opening the documentation or the original CSV file.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, eventBus, state accessors, navigation, scheduleRender |
| ReportEntry | type | Shape of a report entry with name, path, and frontmatter |
| ConfirmModal | class | Confirmation dialog for deleting report documentation |
| addInfoRow | function | Helper to render label-value rows in detail info grids |
| renderEmptyDetail | function | Renders placeholder when no report is selected |
| getEmptyDetailStats | function | Computes summary stats for empty detail placeholders |
| Notice | obsidian | Displays toast notifications |
| setIcon | obsidian | Renders Lucide icons |

## State

**Reads via `deps.getState()`:**
- `reportEntries` — the full list of CsvDoc report entries
- `filterText` — text filter applied to master list (matches name)
- `selectedReportPath` — path of the currently selected report

**Writes via `deps.setState()`:**
- `selectedReportPath` — set on master item click, cleared on delete
- `selectedImportId` — set when navigating to a linked import config

## Renders

**Master panel:**
- Header with "Reports" label and count badge
- Filterable list items showing report name, file-spreadsheet icon, and column count badge
- Selected item highlight

**Detail panel:**
- Header with report name and "CSV Report" operation badge
- Frontmatter properties card (all key-value pairs except `position` and `type`)
- Columns section showing header chips from the `headers` frontmatter array
- Actions: Open Documentation (opens the CsvDoc file), Open CSV (opens the referenced CSV file via `csvFile` frontmatter)
- Import Configs section listing configs that reference this CSV, clickable to navigate to the imports tab
- Delete Doc action with confirmation modal

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | ReportsTab does not directly emit or listen to events |

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ImportsTab]], [[ExportsTab]], [[PropertiesTab]], [[TypesTab]], [[PipelinesTab]], [[HubDashboard]]
- Children: (none)
