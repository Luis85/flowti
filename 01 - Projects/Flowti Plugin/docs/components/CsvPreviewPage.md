---
type: Component
domain: Flowti
stage: done
description: "Preview page for the CSV import wizard showing impact summary and a table of the first 25 rows"
source: "[[Development/flowti/src/ui/csv/CsvPreviewPage.ts|CsvPreviewPage.ts]]"
parent: "[[CsvActionView]]"
tags:
  - csv
  - component
---

# CsvPreviewPage

## Description

CsvPreviewPage is the third step of the CSV import wizard, displayed after the user configures column mappings. It validates that required fields (target folder, name column) are set, shows an impact summary card describing what the import will do, and renders a preview table of the first 25 rows with resolved filenames, mapped frontmatter columns, and custom properties highlighted in accent color. The "Run Import" button is only shown when validation passes.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CsvComponentDeps` | interface | Shared dependency bag providing app, state, import execution, and navigation callbacks |

## State

**Reads via `deps.getState()`:**
- `parsedCsv` -- row data, headers, and row count for the preview table
- `columnMappings` -- filtered to `included === true` for table columns
- `customProperties` -- extra key-value pairs shown as accent-colored columns
- `targetFolder`, `nameColumn`, `namePrefix`, `nameSuffix` -- used in impact summary and filename generation
- `conflictStrategy` -- displayed in impact summary with human-readable labels
- `createBase`, `basePath` -- base view creation info in impact summary
- `importService` -- used for `sanitizeFilename()` on preview filenames

**Writes via `deps.setState()`:**
- `currentPage` -- set to `"config"` (Edit Config) or `"result"` (Run Import)

## Renders

- **Action bar**: "Edit Config" link, spacer, "Run Import" button (hidden when validation fails)
- **Validation warnings**: inline alerts for missing target folder or name column
- **Impact summary card** ("What will happen"):
  - Target folder, notes to create (count), filename pattern, frontmatter keys count, custom properties count, conflict strategy label, base view creation status
- **Count bar**: badges showing row count, total column count, custom prop count, and "Showing first 25 rows" when truncated
- **Preview table**: scrollable table with Filename column + included mappings + custom properties; filenames built from prefix + sanitized name + suffix; custom property cells styled in accent/italic

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | CsvPreviewPage does not emit or listen to events; it triggers import via `deps.runImport()` |

## Related

- Parent: [[CsvActionView]]
- Siblings: [[CsvLanding]], [[CsvConfigPage]], [[CsvResultPage]]
