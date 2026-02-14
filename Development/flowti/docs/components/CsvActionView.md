---
type: Component
domain: Flowti
stage: done
description: "CSV file viewer and import wizard with landing, config, preview, and result pages"
source: "[[Development/flowti/src/ui/CsvActionView.ts|CsvActionView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# CsvActionView

## Description

CsvActionView is the orchestrator for CSV file viewing and the import wizard. It extends Obsidian's `TextFileView` (not `ItemView`), meaning it opens directly when a `.csv` file is selected in the vault navigator. It provides a 4-page wizard flow: Landing (data preview), Config (column mapping and target folder), Preview (import preview with sorting/filtering), and Result (import outcome).

The view is registered under the type `flowti-csv` and displays the CSV file's basename as its title with the `file-spreadsheet` icon. It manages the full import lifecycle including CSV parsing, config save/load, auto-detection of existing configs, `.base` file creation, and display settings persistence.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Subscribe to import progress events |
| `DataExchangeService` | class | Access import service, saved configs, CSV display settings |
| `CsvLanding` | class | Renders the landing page with data snapshot and usage info |
| `CsvConfigPage` | class | Renders the column mapping and target folder configuration |
| `CsvPreviewPage` | class | Renders the import preview with sortable/filterable table |
| `CsvResultPage` | class | Renders the import result summary |
| `FolderPickerModal` | class | Modal for selecting target and base folders |
| `ConfirmModal` | class | Confirmation dialog for overwriting existing configs |
| `ConfigChooserModal` | class | Modal for choosing among multiple matching configs |
| `InputModal` | class | Modal for entering config name when saving |
| `renderStepBar` | function | Renders the horizontal step indicator in the top bar |
| `renderConfigDropdown` | function | Renders the config save/load dropdown |

## State

The view manages a single consolidated `CsvViewState` object:

- **`currentPage`**: Active wizard page (`"landing" | "config" | "preview" | "result"`)
- **`importService`**: The `ImportService` instance (created when wizard starts)
- **`parsedCsv`**: Parsed CSV data with headers, rows, and detected delimiter
- **`parseError`**: Error message if CSV parsing fails
- **`targetFolder`**: Vault folder where imported notes will be created
- **`nameColumn`**: CSV column used as the note filename
- **`namePrefix`** / **`nameSuffix`**: Optional prefix/suffix for generated filenames
- **`columnMappings`**: Array of column-to-frontmatter-key mappings with include/exclude flags
- **`conflictStrategy`**: How to handle existing notes (`"skip" | "update" | "overwrite"`)
- **`importResult`** / **`importError`**: Import outcome or error
- **`importProgress`**: Current/total progress counters
- **`createBase`** / **`basePath`**: Whether to create a `.base` file and its path
- **`savedConfigs`**: Array of saved import configs for this CSV
- **`loadedConfigId`**: ID of the currently loaded config
- **`customProperties`**: Additional static frontmatter properties
- **`detectedDelimiter`**: Auto-detected CSV delimiter
- **`previewSortColumn`** / **`previewSortDir`**: Table sort state
- **`hiddenColumns`**: Columns hidden from preview
- **`filterColumn`** / **`filterText`**: Column-level filtering
- **`previewMaxRows`**: Maximum rows shown in preview
- **`lastImportedAt`**: Timestamp of last import execution

## Renders

- **Landing page** (`CsvLanding`): CSV file header with icon, data snapshot table, usage section, associated base views
- **Top bar** (wizard pages only): File header row (name, import badge, config indicator, path, row/col counts), step bar (Config > Preview > Result), save button, config dropdown
- **Config page** (`CsvConfigPage`): Target folder picker, name column selector, prefix/suffix inputs, column mapping table with search, custom properties, base file toggle
- **Preview page** (`CsvPreviewPage`): Sortable/filterable preview table of notes to be created
- **Result page** (`CsvResultPage`): Import result summary with created/updated/skipped counts, progress indicator during execution

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `dataExchange.import.progress` | Listens | Update progress indicator during import execution |

## Related

- Children: [[CsvLanding]], [[CsvConfigPage]], [[CsvPreviewPage]], [[CsvResultPage]], [[CsvDataSnapshot]], [[CsvUsageSection]], [[CsvAssociatedBases]]
- Uses: [[FolderPickerModal]], [[ConfirmModal]], [[ConfigChooserModal]], [[InputModal]]
- Parent hub: [[DataExchangeHubView]]
