---
type: Component
domain: Flowti
stage: done
description: "Landing page for the CSV action view showing file info, data snapshot, config usage, and associated bases"
source: "[[Development/flowti/src/ui/csv/CsvLanding.ts|CsvLanding.ts]]"
parent: "[[CsvActionView]]"
tags:
  - csv
  - component
---

# CsvLanding

## Description

CsvLanding is the default landing page rendered when a CSV file is opened in the CsvActionView. It composes three child components (CsvDataSnapshot, CsvUsageSection, CsvAssociatedBases) and renders its own file info dashboard, action buttons, and CSV documentation CTA. It serves as the entry point for the CSV import workflow, providing at-a-glance file statistics and quick access to the import wizard.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CsvComponentDeps` | interface | Shared dependency bag providing app, state, event bus, and navigation callbacks |
| `CsvDataSnapshot` | component | Renders the sortable/filterable data preview table |
| `CsvUsageSection` | component | Shows import config usage and inline import execution |
| `CsvAssociatedBases` | component | Displays associated `.base` view files |
| `ConfigChooserModal` | modal | Lets the user pick a saved config when multiple match the current file |
| `splitCsvLine` | utility | Parses a CSV line respecting the detected delimiter |
| `formatRelativeTime` | utility | Converts timestamps to human-readable relative time strings |

## State

**Reads via `deps.getState()`:**
- `detectedDelimiter` -- used for parsing CSV headers and row counts
- `previewSortColumn`, `previewSortDir`, `hiddenColumns`, `filterColumn`, `filterText`, `previewMaxRows` -- persisted as display settings
- `lastImportedAt` -- shown in the file info dashboard as "Last Import" stat

**Writes via `deps.setState()`:**
- `pendingSavedConfig` -- set when user picks a saved config from the chooser modal
- `currentPage` -- never set directly (delegates to child components or `startImportWizard`)

## Renders

- **Header**: file icon, filename (h2), vault path, optional description from CsvDoc frontmatter
- **Action buttons**: "Import as Notes" (opens config chooser if saved configs exist, else starts wizard), "Open Documentation" / "Create Documentation" (toggles based on whether a CsvDoc file exists), "Open with Default App"
- **File info dashboard**: stat cards for Rows, Columns, Delimiter (labeled), Size (KB), and Last Import
- **CSV Doc CTA**: call-to-action banner prompting doc creation when no CsvDoc exists
- **Usage section** (via CsvUsageSection): saved import configs referencing this file
- **Associated Views** (via CsvAssociatedBases): `.base` files related to import targets
- **Data Snapshot** (via CsvDataSnapshot): column chips and sortable preview table

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none directly) | -- | CsvLanding does not emit or listen to events directly; it delegates event interaction to CsvUsageSection and the import wizard |

## Related

- Parent: [[CsvActionView]]
- Children: [[CsvDataSnapshot]], [[CsvUsageSection]], [[CsvAssociatedBases]]
- Siblings: [[CsvConfigPage]], [[CsvPreviewPage]], [[CsvResultPage]]
