---
type: Component
domain: Flowti
stage: done
description: "Configuration page for the CSV import wizard with column mapping and custom properties"
source: "[[Development/flowti/src/ui/csv/CsvConfigPage.ts|CsvConfigPage.ts]]"
parent: "[[CsvActionView]]"
tags:
  - csv
  - component
---

# CsvConfigPage

## Description

CsvConfigPage is the second step of the CSV import wizard, providing a split-panel configuration interface. The left panel contains the import settings form (target folder, name column, filename prefix/suffix, conflict strategy, and `.base` view creation). The right panel provides a searchable column mapping table and custom property editor, allowing users to control which CSV columns become frontmatter keys and to add static key-value pairs to every imported note.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CsvComponentDeps` | interface | Shared dependency bag providing app, state, and UI callbacks |
| `Setting` | Obsidian class | Renders standard Obsidian settings controls (text inputs, dropdowns, toggles) |
| `getBaseFilename` | utility | Derives a default `.base` filename from the CSV file path |

## State

**Reads via `deps.getState()`:**
- `parseError`, `parsedCsv` -- determines whether to show error state or the config form
- `targetFolder`, `nameColumn`, `namePrefix`, `nameSuffix` -- import path settings
- `conflictStrategy` -- skip/update/overwrite behavior for existing notes
- `createBase`, `basePath` -- whether to generate a `.base` view and where
- `columnMappings` -- array of `{ csvColumn, frontmatterKey, included }` mappings
- `columnSearchText` -- filter text for the mapping table
- `customProperties` -- `Record<string, string>` of extra frontmatter key-value pairs

**Writes via `deps.setState()`:**
- `targetFolder`, `nameColumn`, `namePrefix`, `nameSuffix`, `conflictStrategy` -- from form inputs
- `createBase`, `basePath` -- from toggle and text input
- `columnSearchText` -- from search input
- `customProperties` -- add/rename/remove custom properties
- `currentPage` -- navigation to `"landing"` (back) or `"preview"` (next)

## Renders

- **Action bar**: "CSV Detail" back link, spacer, "Preview" next button
- **Unsaved changes reminder**: conditionally visible warning banner
- **Target folder**: text input with folder browser extra button
- **Name column**: dropdown populated from parsed CSV headers, with "filename" badge on selected column
- **Filename prefix/suffix**: text inputs for name decoration
- **Existing notes**: dropdown for conflict strategy (Skip / Update frontmatter / Overwrite entire note)
- **Create .base view**: toggle + path input; shows "already exists" info and open link when a `.base` file is found
- **Column mapping table**: searchable table with Include checkbox, CSV Column name, arrow, editable Frontmatter Key; "All"/"None" select buttons
- **Custom properties**: repeater rows with key/value inputs and remove button; "Add Property" link at bottom; badge count in header

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | CsvConfigPage does not emit or listen to events; all state changes go through `deps.setState()` |

## Related

- Parent: [[CsvActionView]]
- Siblings: [[CsvLanding]], [[CsvPreviewPage]], [[CsvResultPage]]
