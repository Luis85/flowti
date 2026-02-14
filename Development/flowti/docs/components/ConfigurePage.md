---
type: Component
domain: Flowti
stage: done
description: "Configuration page for the export wizard with format, output path, conflict strategy, and property selection"
source: "[[Development/flowti/src/ui/export/ConfigurePage.ts|ConfigurePage.ts]]"
parent: "[[ExportView]]"
tags:
  - export
  - component
---

# ConfigurePage

## Description

ConfigurePage is the configuration step of the export wizard, providing a split-panel interface. The left panel contains export settings (format, output path, conflict strategy, note type) while the right panel provides a searchable property grid with checkboxes for selecting which file properties and note frontmatter properties to include as columns in the exported file. It supports both vault-internal and external (filesystem) output modes with corresponding path management.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `ExportComponentDeps` | interface | Shared dependency bag providing app, state, and UI callbacks |
| `Setting` | Obsidian class | Renders standard Obsidian settings controls |
| `STANDARD_FILE_PROPERTIES` | constant | List of available file-level properties (file.name, file.path, etc.) |
| `swapOutputExtension` | utility | Updates file extension when switching between CSV and Tab formats |
| `getOutputFolder`, `getOutputFilename`, `buildOutputPath` | utilities | Parse and construct vault-relative output paths |
| `ExportFormat` | type | `"csv"` or `"tab"` format enum |
| `ExportConflictStrategy` | type | `"overwrite"`, `"skip"`, or `"append"` strategy enum |

## State

**Reads via `deps.getState()`:**
- `sourceType` -- determines whether "Back to Views" or "Close" is shown
- `format` -- current export format (csv/tab)
- `outputPath` -- full output path (vault-relative or absolute for external)
- `isExternal` -- whether saving to filesystem or vault
- `conflictStrategy` -- how to handle existing output files
- `noteType` -- optional type association for TypeDoc creation
- `availableColumns` -- all discovered frontmatter properties
- `selectedColumns` -- currently selected frontmatter properties
- `selectedFileProperties` -- currently selected file-level properties
- `propertySearchText` -- search filter for the property grid

**Writes via `deps.setState()`:**
- `format`, `outputPath` -- from format dropdown and path inputs
- `isExternal` -- toggled via vault/filesystem switch buttons
- `conflictStrategy` -- from dropdown
- `noteType` -- from text input
- `selectedColumns`, `selectedFileProperties` -- from checkbox changes
- `propertySearchText` -- from search input
- `currentPage` -- set to `"view-select"` (back) or `"preview"` (next)

## Renders

### Left Panel (Settings)
- **Action bar**: Back navigation ("Views" for base source, "Close" for folder source), spacer, "Preview" next button
- **Unsaved changes reminder**: conditionally visible warning banner
- **Format dropdown**: CSV (comma-separated) or Tab-delimited (.txt)
- **Output path** (two modes):
  - *External mode*: single text input for absolute path + browse filesystem button + "Switch to vault" button
  - *Vault mode*: separate folder input (with folder browser) and filename input + "Save to filesystem" button
- **Conflict strategy dropdown**: Overwrite / Skip / Append rows
- **Note type**: optional text input for TypeDoc association

### Right Panel (Properties)
- **Header**: "Properties" title with "All"/"None" select buttons
- **Search input**: filters both file and note properties
- **File Properties section**: checkbox grid for standard file properties (file.name, file.path, etc.)
- **Note Properties section**: checkbox grid for discovered frontmatter properties
- **Empty state**: message when no properties match the search

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | ConfigurePage does not interact with the event bus; all changes go through `deps.setState()` |

## Related

- Parent: [[ExportView]]
- Siblings: [[ViewSelectPage]], [[PreviewPage]], [[ResultPage]]
