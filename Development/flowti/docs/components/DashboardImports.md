---
type: Component
domain: Flowti
stage: done
description: "Dashboard section rendering configured import configs as a table with favourite, preview, and execute actions"
source: "[[Development/flowti/src/ui/hub/DashboardImports.ts|DashboardImports.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# DashboardImports

## Description

DashboardImports is an extracted function component that renders the "Configured Imports" table section on the Hub Dashboard. It displays import configs grouped by their associated CSV files in a table with columns for name (with favourite star toggle), target folder, CSV file link, and action buttons (edit, preview, execute). Entries are sorted with favourites first. It includes a "New Import from CSV" button and an empty state CTA prompting users to select a CSV file to create their first import.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, state accessors, navigation, scheduleRender |
| DashboardImportExecutor | class | Executes imports inline with progress feedback |
| CsvFileEntry | type | CSV file entry containing linked import configs |
| FilePickerModal | class | File picker for selecting CSV files for new imports |
| TFile | obsidian | Type-checks vault files for opening |
| setIcon | obsidian | Renders Lucide icons (star, pencil, eye, play, etc.) |

## State

**Reads via `deps.getState()`:**
- (no direct state reads; receives filtered `CsvFileEntry[]` as parameter)

**Writes via `deps.setState()`:**
- `selectedImportId` — set when clicking config name or edit action, navigates to imports tab

## Renders

- **Section header** — "Configured Imports" with file-input icon and count
- **Import configs table** — columns: Name (star toggle + clickable name), Target (folder path), File (CSV name link), Actions (edit/pencil, preview/eye, execute/play)
- **Favourite sorting** — favourited configs appear first within each CSV file group
- **Star toggle** — calls `dataExchangeService.toggleImportFavourite()` on click
- **"New Import from CSV" button** — opens FilePickerModal to select a CSV file, then navigates to CSV import view
- **Empty state** — card with icon, heading, description, and "Select CSV File" CTA button

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none directly) | — | Execution delegated to DashboardImportExecutor which emits `dataExchange.import.execute` |

## Related

- Parent: [[HubDashboard]]
- Siblings: [[DashboardExports]], [[DashboardPipelines]]
- Children: [[DashboardImportExecutor]] (used for inline execution)
