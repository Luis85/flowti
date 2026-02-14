---
type: Component
domain: Flowti
stage: done
description: "Modal for adding or editing a CSV source within a multi-import pipeline"
source: "[[Development/flowti/src/ui/PipelineSourceModal.ts|PipelineSourceModal.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - modal
  - component
---

# PipelineSourceModal

## Description

A single-page modal for configuring a CSV source within a multi-import pipeline. It allows users to select a CSV file, choose a merge key column, map CSV columns to frontmatter keys, and add static custom properties. The modal is opened from the `SourcesExportsGrid` component in the Data Exchange Hub when the user adds or edits a pipeline source.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `App` | Obsidian API | Modal base class and vault access |
| `ImportService` | Service | Parsing CSV files to extract headers |
| `FilePickerModal` | Modal | Browsing the vault for CSV files |
| `ConfigChooserModal` | Modal | Selecting a saved import config to pre-fill the form |
| `generateUUID` | Utility | Generating unique source IDs |

## State

| Property | Type | Purpose |
|----------|------|---------|
| `csvPath` | `string` | Path to the selected CSV file in the vault |
| `csvHeaders` | `string[]` | Column headers parsed from the CSV file |
| `mergeKeyColumn` | `string` | The CSV column that maps to the pipeline's merge key |
| `columnMappings` | `ColumnMapping[]` | Per-column include/exclude and frontmatter key mapping |
| `customProperties` | `Record<string, string>` | Static key-value pairs injected into every note from this source |
| `isLoading` | `boolean` | Whether a CSV parse operation is in progress |
| `otherSourceKeys` | `Set<string>` | Frontmatter keys already claimed by other sources (for overlap detection) |
| `mergeKey` | `string` | Canonical merge key name from the pipeline (e.g., "item_id") |
| `savedImportConfigs` | `SavedImportConfig[]` | Available configs for the "Load from config" feature |
| `hiddenCsvPaths` | `string[]` | CSV paths to exclude from the file picker |

## Renders

### Single Page
- **Title**: "Edit Source" or "Add CSV Source" depending on create/edit mode
- **Load from Config link**: (new sources only, when saved configs exist) opens a `ConfigChooserModal` to pre-fill from a saved import config
- **CSV file picker**: text input with a "Browse CSV files" button that opens `FilePickerModal`
- **Loading spinner**: shown while CSV is being parsed
- **Merge key column dropdown**: maps a CSV column to the pipeline's canonical merge key
- **Column Mappings grid**: scrollable checklist of CSV columns with:
  - Checkbox to include/exclude each column
  - Editable frontmatter key name (with "All"/"None" quick select)
  - Overlap indicator ("exists" badge) when a key conflicts with another source
- **Custom Properties**: repeater rows with key/value inputs, add/remove actions, overlap indicators
- **Save/Cancel buttons**: validates CSV path and merge key column before saving

## Events

This modal does not emit or listen to EventBus events. It uses a callback pattern instead:

| Callback | Direction | Purpose |
|----------|-----------|---------|
| `onSave(source: MultiImportSource)` | Out | Returns the configured source to the parent component |

## Validation

- CSV file path must be non-empty
- Merge key column must be selected
- Empty mappings are filtered out (merge key column is excluded from exported mappings)
- Column key overlap with other sources is indicated visually but not blocked

## Related

- Parent: [[SourcesExportsGrid]] (Data Exchange Hub pipelines)
- Siblings: [[ConfigChooserModal]], [[FilePickerModal]]
