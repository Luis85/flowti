---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey from right-clicking a folder or .base file through the export wizard to generating a CSV or tab-delimited output
domains:
  - Data Exchange
services:
  - ExportService
  - DataExchangeService
  - BaseQueryEngine
  - CsvParser
events:
  - dataExchange.export.execute
  - dataExchange.export.started
  - dataExchange.export.completed
tags:
  - data-exchange
---

# Export Vault Data

## Overview

The export flow transforms a collection of Obsidian notes into a structured CSV or tab-delimited file. Users initiate the export by right-clicking a folder or `.base` file in the file explorer and selecting "Export as CSV/Tab". The wizard walks through view selection (for `.base` files with multiple views), column configuration, output format and destination, preview, and execution. Exports can be saved to the vault or to the external filesystem via Electron's save dialog.

## Trigger

User right-clicks a folder or `.base` file in the file explorer and selects "Export as CSV/Tab", or runs the `flowti:export-data` command.

## Steps

### 1. Initiate Export

- **View/Service**: File menu integration (EventBridge)
- **User Action**: User right-clicks a folder or `.base` file in the Obsidian file explorer and selects "Export as CSV/Tab"
- **System Response**: EventBridge intercepts the file-menu event and opens the ExportModal, passing the source path and source type (folder or base file). For the command palette route, a file picker is shown first
- **Events**: (none — Obsidian API file-menu hook)

### 2. Select View (Base Files Only)

- **View/Service**: ExportModal (ViewSelectPage)
- **User Action**: User selects which view to export from a `.base` file that contains multiple views
- **System Response**: BaseQueryEngine parses the `.base` YAML file and extracts the available views. ViewSelectPage renders a list of views with their names and filter descriptions. If the source is a folder (not a `.base` file) or the `.base` file has only one view, this step is skipped automatically. The selected view's `order` array determines the initial column set
- **Events**: (none — UI only)

### 3. Configure Export

- **View/Service**: ExportModal (ConfigurePage)
- **User Action**: User configures the export: selects columns to include/exclude, chooses output format (CSV or Tab), sets the output file path, selects conflict strategy, and optionally adds display name mappings for column headers
- **System Response**: ConfigurePage shows a column checklist populated from the source (view order for `.base` files, or scanned frontmatter keys for folders). Format toggle switches between CSV and Tab (tab-delimited exports default to `.txt` extension). Output path field with auto-generated default name. Conflict strategy dropdown offers overwrite, skip, or append. A "Save to filesystem" button (hard-drive icon) opens Electron's `remote.dialog.showSaveDialog` for external export
- **Events**: (none — UI only)

### 4. Formula Resolution

- **View/Service**: ExportService (internal)
- **User Action**: (automatic — part of configuration processing)
- **System Response**: If the `.base` file defines a `formulas` section, formula columns (e.g., `formula.X`) in the view order are resolved to their underlying frontmatter property keys via the `formulas` map. Simple property references (e.g., `foo: description`) use the expression as the column key. Unresolvable formula names fall back to being used as-is
- **Events**: (none — internal resolution)

### 5. Preview Export

- **View/Service**: ExportModal (PreviewPage)
- **User Action**: User clicks "Next" to advance to the preview page
- **System Response**: PreviewPage renders a tabular preview of the export data. ExportService resolves the source files (via `listFiles` callback for folders, or BaseQueryEngine filter evaluation for `.base` files), scans the selected columns across all matching files, and generates a preview table showing the first several rows. Column headers reflect any display name mappings applied. A summary bar shows total files matched and columns included
- **Events**: (none — UI only)

### 6. Execute Export

- **View/Service**: ExportService
- **User Action**: User clicks "Export" on the preview page
- **System Response**: DataExchangeService delegates to ExportService. ExportService resolves the full file list, scans all column values, and passes them to CsvParser's `generate()` method with the chosen format (CSV or Tab). The conflict strategy is applied: skip checks if the output file exists and returns early, append reads the existing file and concatenates (stripping the duplicate header), overwrite replaces entirely. For vault exports, `FileSystemClient.createFile()` writes the output. For external exports, the injected `WriteExternalFileCallback` uses Node.js `fs.writeFileSync` and `fs.mkdirSync`
- **Events**: `dataExchange.export.execute` → `dataExchange.export.started` → `dataExchange.export.completed`

### 7. Review Results

- **View/Service**: ExportModal (ResultPage)
- **User Action**: User views the export results
- **System Response**: ResultPage displays the outcome: file path of the generated output, total rows exported, format used, and whether the export was to vault or filesystem. If the conflict strategy caused a skip, the result indicates the file was skipped with the existing file path. Errors are displayed with details. A "Save Config" button allows persisting the export configuration
- **Events**: (none — UI only)

### 8. Save Configuration (Optional)

- **View/Service**: DataExchangeService
- **User Action**: User clicks "Save Config" and enters a name for the configuration
- **System Response**: DataExchangeService persists the export configuration as a `SavedExportConfig` (name, source path, source type, format, output path, columns, file properties, conflict strategy, display name mappings) under the `dataExchange` storage key. The saved config becomes available in the Data Exchange Hub and future export wizards via the "Load Config" dropdown
- **Events**: (none — direct service call, no events for config CRUD)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Output format | CSV / Tab | CSV |
| Export destination | Vault file / External filesystem | Vault |
| Conflict strategy | Overwrite / Skip / Append | Overwrite |
| Column selection | Include/exclude per column | All columns from source |
| Display name mapping | Custom header names for columns | Original property names |
| View selection | Available views in `.base` file | First view |
| Save configuration | Persist settings for reuse | Optional |

## Events Sequence

```
[right-click] → [ExportModal opens] → [view selection (if .base)] → [configure columns/format] → [preview] → dataExchange.export.execute → dataExchange.export.started → dataExchange.export.completed → [results displayed]
```

## Related Use Cases

- [[Import CSV as Notes]] (reverse operation — CSV to vault notes)
- [[Build Import Pipeline]] (export configs can feed into import pipelines for round-trip workflows)
- [[Browse and Configure Events]] (export events appear in the catalog)

## Related Decisions

- [[ADR-001 EventBus Architecture]] — export execution emits events through the EventBus (execute → started → completed)
- [[ADR-004 Single JSON Blob Storage]] — SavedExportConfig persisted under the dataExchange key
- [[ADR-023 Modal Business Logic Extraction]] — ExportService owns export logic; ExportModal is a thin UI shell
- [[ADR-024 BaseHubView Shell Extraction]] — DataExchangeHubView extends BaseHubView; Exports tab in inherited tab bar

## Known Debt

- TD-45: DX Hub resets to dashboard on reopen; Exports tab and selected config not persisted
- TD-97: This flow doc previously referenced `dataExchange.export.progress` which doesn't exist (fixed 2026-02-18)

## Learnings

- [[L-06 Config CRUD goes through EventBus for domain actions]] — export config save is direct CRUD (not a domain action)
- [[L-22 Every major event domain needs a flow doc]] — stale event references (TD-97) only found during doc audit
