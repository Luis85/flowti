---
type: Component
domain: Flowti
stage: done
description: "View selection page for the export wizard allowing users to pick which .base view to export"
source: "[[Development/flowti/src/ui/export/ViewSelectPage.ts|ViewSelectPage.ts]]"
parent: "[[ExportView]]"
tags:
  - export
  - component
---

# ViewSelectPage

## Description

ViewSelectPage is the first step of the export wizard, shown only when the source is a `.base` file containing multiple views. It presents each view as a selectable card showing the view name, type, column count, and filter status. The user selects a view and clicks "Configure" to advance, at which point the component scans the selected view's columns, resolved files, file properties, and display names before transitioning to the ConfigurePage.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `ExportComponentDeps` | interface | Shared dependency bag providing app, state, export service, and navigation callbacks |
| `exportService.scanColumns()` | method | Retrieves available frontmatter columns for the selected view |
| `exportService.resolveExportFiles()` | method | Resolves the list of vault files matching the view's filters |
| `exportService.scanViewFileProperties()` | method | Discovers file properties used in the selected view |
| `exportService.scanDisplayNames()` | method | Loads display name overrides from the `.base` file |

## State

**Reads via `deps.getState()`:**
- `baseFile` -- the parsed `.base` file containing the array of views
- `baseViewIndex` -- the currently selected view index (highlighted card)
- `sourcePath` -- path to the `.base` source file (displayed in subtitle)
- `sourceType` -- always `"base"` when this page is shown

**Writes via `deps.setState()`:**
- `baseViewIndex` -- updated when user clicks a view card
- `availableColumns` -- set from `scanColumns()` result
- `selectedColumns` -- initialized to all available columns
- `previewFiles` -- set from `resolveExportFiles()` result
- `selectedFileProperties` -- set from `scanViewFileProperties()` result
- `displayNames` -- set from `scanDisplayNames()` result
- `currentPage` -- set to `"configure"` when advancing

## Renders

- **Empty state**: "No views found" message with Close button (when `baseFile.views` is empty)
- **Action bar**: Close button, spacer, "Configure" next button
- **Header**: "Select a View" heading
- **Subtitle**: source filename and view count badge
- **View cards**: one card per view, each showing:
  - Table icon (full opacity when selected, dimmed otherwise)
  - View name (bold)
  - Metadata line: view type, column count (from `order` array), "filtered" tag if filters exist
  - Check icon (accent color, only on selected card)
  - Entire card is clickable to select the view

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | ViewSelectPage does not interact with the event bus; data loading uses direct service method calls |

## Related

- Parent: [[ExportView]]
- Siblings: [[ConfigurePage]], [[PreviewPage]], [[ResultPage]]
