---
type: Component
domain: Flowti
stage: done
description: "Fuzzy-searchable vault file picker filtered by extension with optional path exclusion"
source: "[[Development/flowti/src/ui/FilePickerModal.ts|FilePickerModal.ts]]"
tags:
  - shared
  - component
  - modal
---

# FilePickerModal

## Description

FilePickerModal is a fuzzy-searchable file picker that lists vault files filtered by extension. Supports optional path exclusion for hiding already-selected files. On selection, calls the `onChoose` callback with the file path.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `FuzzySuggestModal<TFile>` | obsidian | Base class for fuzzy search |

## Constructor Params

| Param | Purpose |
|-------|---------|
| `extensions` | File extensions to include (e.g. `["csv"]`) |
| `onChoose` | Callback with selected file path |
| `excludePaths?` | Optional paths to exclude from results |

## Consumers

- CSV import source selection
- Pipeline source configuration

## Related

- Sibling: [[FolderPickerModal]]
