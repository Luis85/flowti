---
type: Component
domain: Flowti
stage: done
description: "Result page for the CSV import wizard showing progress, success outcome, or error state"
source: "[[Development/flowti/src/ui/csv/CsvResultPage.ts|CsvResultPage.ts]]"
parent: "[[CsvActionView]]"
tags:
  - csv
  - component
---

# CsvResultPage

## Description

CsvResultPage is the final step of the CSV import wizard. It displays three possible states: an animated progress bar during import execution, a success summary with detailed outcome statistics, or an error state with retry options. The page provides contextual "What's next" action buttons based on the outcome, allowing the user to open the target folder, open the `.base` view, re-run the import, edit the config, or return to the CSV detail landing page.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CsvComponentDeps` | interface | Shared dependency bag providing app, state, and navigation callbacks |

## State

**Reads via `deps.getState()`:**
- `importResult` -- the `ImportResult` object when import succeeds (created, updated, skipped, failed counts, errors array, totalRows)
- `importError` -- error message string when import fails
- `importProgress` -- `{ current, total }` for the progress bar during execution
- `targetFolder` -- displayed in outcome summary and used for "Open Target Folder" button
- `conflictStrategy` -- displayed in outcome summary
- `basePath` -- checked for existence to show "Open Base View" button
- `loadedConfigId`, `savedConfigs` -- used to display which saved config was used

**Writes via `deps.setState()`:**
- `importResult`, `importError` -- reset to `null` for retry or navigation
- `currentPage` -- set to `"result"` (retry), `"config"` (edit), or `"landing"` (back to CSV)

## Renders

### Progress State
- "Importing..." heading
- Progress bar with percentage fill based on `current / total`
- "Processing row X of Y..." label

### Success State
- Status header with icon: check-circle (success), alert-triangle (partial errors), or minus-circle (all skipped)
- **"What happened" card**: CSV rows processed, notes created/updated/skipped/failed, target folder, conflict strategy, base view path, config used
- **Error details** (if any): up to 20 error rows with row number, filename, and error message; overflow count
- **"What's next" actions**: Open Target Folder, Open Base View (if exists), Run Again, Edit Config, CSV Detail

### Error State
- Red x-circle icon with "Import Failed" heading
- Error card with left red border showing error message
- **"What's next" actions**: Retry, Edit Config, CSV Detail

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | CsvResultPage does not emit or listen to events; it reads state set by the orchestrator's import handler |

## Related

- Parent: [[CsvActionView]]
- Siblings: [[CsvLanding]], [[CsvConfigPage]], [[CsvPreviewPage]]
