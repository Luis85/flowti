---
type: Component
domain: Flowti
stage: done
description: "Export wizard for vault data as CSV or tab-delimited files with view-select, configure, preview, and result pages"
source: "[[Development/flowti/src/ui/ExportView.ts|ExportView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# ExportView

## Description

ExportView is the orchestrator for exporting vault data as CSV or tab-delimited files. It extends Obsidian's `ItemView` and provides a multi-page wizard flow. For `.base` file sources it has 4 pages (View Select, Configure, Preview, Result); for folder sources it has 3 pages (Configure, Preview, Result). It is triggered from context menus on folders or `.base` files, from the command palette, or from the Data Exchange Hub.

The view is registered under the type `flowti-export` and displays as "Export CSV: {name}" or "Export Tab: {name}" with the `file-output` icon. It manages export configuration, column selection, preview file resolution, conflict strategy, and supports both vault-internal and external filesystem exports via Electron's native save dialog.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Available for event-driven communication (not actively subscribed in this view) |
| `DataExchangeService` | class | Access export service, saved configs, and config persistence |
| `ExportService` | class | Execute exports, scan columns, resolve files, parse base views |
| `getConfig` | callback | Provides the initial export configuration (source path, source type, format) |
| `ViewSelectPage` | class | Renders base view selection when source is a `.base` file |
| `ConfigurePage` | class | Renders column selection, output path, format, and conflict strategy |
| `PreviewPage` | class | Renders export preview with file list and selected columns |
| `ResultPage` | class | Renders export result summary |
| `FolderPickerModal` | class | Modal for selecting vault output folder |
| `ConfigChooserModal` | class | Modal for choosing among multiple matching configs |
| `ConfirmModal` | class | Confirmation dialog for overwriting existing configs |
| `InputModal` | class | Modal for entering config name when saving |
| `showNativeSaveDialog` | function | Opens Electron's native file save dialog for external exports |
| `renderStepBar` | function | Renders the horizontal step indicator in the top bar |
| `renderConfigDropdown` | function | Renders the config save/load dropdown |

## State

The view manages its state as individual properties exposed via `ExportViewState`:

- **`currentPage`**: Active wizard page (`"view-select" | "configure" | "preview" | "result"`)
- **`sourcePath`**: Path to the source folder or `.base` file
- **`sourceType`**: Whether exporting from a `"folder"` or `"base"` file
- **`format`**: Export format (`"csv" | "tab"`)
- **`outputPath`**: Destination file path (vault-relative or absolute for external)
- **`isExternal`**: Whether export targets the filesystem outside the vault
- **`availableColumns`**: All frontmatter columns found across source files
- **`selectedColumns`**: Columns included in the export
- **`selectedFileProperties`**: File-level properties (e.g., `file.name`) included in export
- **`baseViewIndex`**: Selected view index when source is a `.base` file with multiple views
- **`baseFile`**: Parsed `.base` file with views, filters, formulas
- **`previewFiles`**: Array of `VaultFileInfo` resolved from the source
- **`conflictStrategy`**: How to handle existing output files (`"overwrite" | "skip" | "append"`)
- **`displayNames`**: Column display name overrides from `.base` formulas
- **`noteType`**: Optional note type tag for the export
- **`exportResult`** / **`exportError`** / **`loadError`**: Export outcome, export error, or initial load error
- **`savedConfigs`**: Array of saved export configs
- **`loadedConfigId`**: ID of the currently loaded config
- **`propertySearchText`**: Search text for filtering property columns

## Renders

- **Top bar** (2-row layout):
  - Row 1: File header with icon, source name, export badge, loaded config indicator, source path, file/column count badges
  - Row 2: Step bar (View Select > Configure > Preview > Result), save button (when unsaved changes), config dropdown
- **View Select page** (`ViewSelectPage`): Grid of base views to select from (only for `.base` sources)
- **Configure page** (`ConfigurePage`): Output path with folder picker and native save dialog, format selector, column checkboxes with search, file property toggles, conflict strategy dropdown
- **Preview page** (`PreviewPage`): Preview table showing files and selected columns
- **Result page** (`ResultPage`): Export result summary with file path, row count, and close/rerun actions
- **Error display**: Full-width error alert with close button when initial load fails

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none actively subscribed) | -- | The view uses direct service calls rather than event subscriptions |

## Related

- Children: [[ViewSelectPage]], [[ConfigurePage]], [[PreviewPage]], [[ResultPage]]
- Uses: [[FolderPickerModal]], [[ConfirmModal]], [[ConfigChooserModal]], [[InputModal]]
- Parent hub: [[DataExchangeHubView]]
