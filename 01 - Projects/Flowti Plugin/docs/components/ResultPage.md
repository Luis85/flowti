---
type: Component
domain: Flowti
stage: done
description: "Result page for the export wizard showing progress, success outcome, skipped state, or error with next actions"
source: "[[Development/flowti/src/ui/export/ResultPage.ts|ResultPage.ts]]"
parent: "[[ExportView]]"
tags:
  - export
  - component
---

# ResultPage

## Description

ResultPage is the final step of the export wizard. It displays three possible states: an animated progress bar during export execution, a success/skipped summary with detailed outcome statistics, or an error state with retry options. It fires an Obsidian `Notice` on completion (or skip) and provides contextual "What's next" action buttons based on the outcome, allowing the user to open the output file, open the source, re-run the export, edit the config, or close the view.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `ExportComponentDeps` | interface | Shared dependency bag providing app, state, and navigation callbacks |
| `Notice` | Obsidian class | Shows toast notifications on export completion or skip |
| `STRATEGY_LABELS` | constant | Human-readable labels for conflict strategies |

## State

**Reads via `deps.getState()`:**
- `exportResult` -- the `ExportResult` object when export succeeds (totalRows, totalColumns, outputPath, skipped flag)
- `exportError` -- error message string when export fails
- `format` -- displayed in "What happened" summary
- `conflictStrategy` -- displayed in "What happened" summary
- `outputPath` -- used for "Open Output" button
- `isExternal` -- controls whether "Open Output" button is available (vault only)
- `sourcePath`, `sourceType` -- used for "Open Source" button
- `loadedConfigId`, `savedConfigs` -- displays which saved config was used

**Writes via `deps.setState()`:**
- `exportResult`, `exportError` -- reset to `null` for retry or navigation
- `currentPage` -- set to `"result"` (retry), `"configure"` (edit config)

## Renders

### Progress State
- "Exporting..." heading
- Indeterminate progress bar with pulsing animation
- "Writing export file..." label

### Success State
- Status header with icon: check-circle (success, accent color) or minus-circle (skipped, muted color)
- **"What happened" card**:
  - Rows exported (or "0 (skipped)" with reason)
  - Columns count
  - Output file path
  - Format (CSV or Tab-delimited)
  - Conflict strategy
  - Config used (if loaded from saved config)
- Obsidian Notice toast with row count or skip message

### Skipped State
- Same as success but with "Export skipped -- file already exists" heading
- Reason row explaining skip due to conflict strategy

### Error State
- Red x-circle icon with "Export Failed" heading
- Error card with left red border showing error message

### "What's next" Actions Card
- **On error**: Retry button (re-runs export), Edit Config button, Close button
- **On success/skip**: Open Output (vault only), Open Source (icon varies by source type), Run Again, Edit Config, Close

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | ResultPage does not interact with the event bus; it reads state set by the orchestrator's export handler |

## Related

- Parent: [[ExportView]]
- Siblings: [[ViewSelectPage]], [[ConfigurePage]], [[PreviewPage]]
