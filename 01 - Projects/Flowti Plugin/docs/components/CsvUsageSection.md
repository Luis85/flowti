---
type: Component
domain: Flowti
stage: done
description: "Displays saved import config usage for a CSV file with inline import execution and progress tracking"
source: "[[Development/flowti/src/ui/csv/CsvUsageSection.ts|CsvUsageSection.ts]]"
parent: "[[CsvActionView]]"
tags:
  - csv
  - component
---

# CsvUsageSection

## Description

CsvUsageSection renders the "Usage" section on the CsvLanding page. It queries the DataExchangeService for saved import configurations that reference the current CSV file, displaying each config as a row with its name, target folder, conflict strategy, and action buttons. When no configs exist, it shows a prompt to create one. It also supports inline import execution directly from the landing page, showing a progress bar and result summary without navigating to the full wizard.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CsvComponentDeps` | interface | Shared dependency bag providing app, state, event bus, and navigation callbacks |
| `SavedImportConfig` | type | Shape of a persisted import configuration |
| `ImportResult` | type | Shape of an import execution result |
| `options.persistDisplaySettings` | callback | Persists display settings after import completes (records `lastImportedAt`) |
| `options.refreshAssociatedBases` | callback | Refreshes the CsvAssociatedBases section after import (newly created `.base` files appear) |

## State

**Reads via `deps.getState()`:**
- (none directly -- queries `dataExchangeService.getImportConfigsForFile()` with the current file path)

**Writes via `deps.setState()`:**
- `pendingSavedConfig` -- set when the user clicks "Preview" on a config row
- `lastImportedAt` -- updated to `Date.now()` after a successful inline import

## Renders

- **Usage heading**: "Usage" section title
- **Config rows** (when configs exist): each row shows:
  - Config name (clickable link opening the hub's import config view)
  - Target folder badge
  - Conflict strategy badge
  - "Preview" button (opens the import wizard with the saved config pre-loaded)
  - "Run" button (executes the import inline)
- **Empty state** (no configs): message text + "Create Import Config" link that starts the wizard
- **Inline progress card**: animated loader icon, config name, "Processing row X of Y..." text, progress bar
- **Inline result card**: check-circle icon, "Import Complete" header, dismissible; stat badges for created/updated/skipped/failed counts
- **Inline error card**: red error alert with message and dismiss button

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `dataExchange.import.execute` | Emits | Triggers the import pipeline with the saved config's settings |
| `dataExchange.import.progress` | Listens | Updates the inline progress bar with current/total row counts |
| `dataExchange.import.completed` | Listens | Shows the result card, records `lastImportedAt`, refreshes associated bases |
| `dataExchange.import.failed` | Listens | Shows the error card with the failure message |

## Related

- Parent: [[CsvActionView]] (embedded by [[CsvLanding]])
- Siblings: [[CsvDataSnapshot]], [[CsvAssociatedBases]]
