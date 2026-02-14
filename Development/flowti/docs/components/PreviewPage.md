---
type: Component
domain: Flowti
stage: done
description: "Preview page for the export wizard showing impact summary and a table of the first 25 rows"
source: "[[Development/flowti/src/ui/export/PreviewPage.ts|PreviewPage.ts]]"
parent: "[[ExportView]]"
tags:
  - export
  - component
---

# PreviewPage

## Description

PreviewPage is the preview step of the export wizard, displayed after the user configures the export settings. It validates that the output path is set and at least one column is selected, shows an impact summary card describing what the export will produce, and renders a preview table of the first 25 rows. File property columns and note frontmatter columns are displayed with resolved display names when available. The "Run Export" button is only enabled when validation passes.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `ExportComponentDeps` | interface | Shared dependency bag providing app, state, export execution, and navigation callbacks |
| `getFilePropertyLabel` | utility | Resolves human-readable labels for file property keys |
| `resolveFileProperty` | utility | Extracts file property values from `VaultFileInfo` objects |
| `STRATEGY_LABELS` | constant | Human-readable labels for conflict strategies |

## State

**Reads via `deps.getState()`:**
- `selectedFileProperties` -- file-level columns to export (resolved to labels via display names)
- `selectedColumns` -- frontmatter columns to export (resolved to labels via display names)
- `displayNames` -- override map for column header display names
- `outputPath` -- target file path (shown in impact summary)
- `isExternal` -- whether exporting to filesystem (shown as "(external)" label)
- `sourcePath`, `sourceType`, `baseViewIndex` -- source info for impact summary
- `format` -- CSV or Tab-delimited label
- `conflictStrategy` -- shown in impact summary with human-readable label
- `previewFiles` -- array of `VaultFileInfo` objects used for the preview table

**Writes via `deps.setState()`:**
- `currentPage` -- set to `"configure"` (Edit Config) or `"result"` (Run Export)

## Renders

- **Action bar**: "Edit Config" link, spacer, "Run Export" button (hidden when validation fails)
- **Validation warnings**: inline alerts for missing output path or zero columns selected
- **Impact summary card** ("What will happen"):
  - Source path and type (base view number or folder)
  - Files to export (count)
  - Output file path (with "(external)" suffix for filesystem exports)
  - Format (CSV or Tab-delimited)
  - Column breakdown (frontmatter count + file properties count)
  - Conflict strategy
  - Display name override count (when any exist)
- **Count bar**: badges showing row count, column count, and "Showing first 25 rows" when truncated
- **Preview table**: scrollable table with file property columns followed by frontmatter columns; values resolved from `VaultFileInfo` objects; null/undefined values rendered as empty strings
- **Row count footer**: "Showing N of M rows" or "N rows total"

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | PreviewPage does not interact with the event bus; it triggers export via `deps.runExport()` |

## Related

- Parent: [[ExportView]]
- Siblings: [[ViewSelectPage]], [[ConfigurePage]], [[ResultPage]]
