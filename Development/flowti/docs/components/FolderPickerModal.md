---
type: Component
domain: Flowti
stage: done
description: "Fuzzy-searchable folder picker with type-to-create for new folders"
source: "[[Development/flowti/src/ui/FolderPickerModal.ts|FolderPickerModal.ts]]"
tags:
  - shared
  - component
  - modal
---

# FolderPickerModal

## Description

FolderPickerModal is a fuzzy-searchable folder picker that lists all vault folders. When the typed path doesn't match any existing folder, a "+ Create: {path}" option appears, allowing on-the-fly folder creation. Also exports `getVaultFolders()` helper for listing all vault folder paths.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `FuzzySuggestModal<string>` | obsidian | Base class for fuzzy search |
| `TFolder` | obsidian | Folder type for vault listing |

## Exports

| Export | Purpose |
|--------|---------|
| `FolderPickerModal` | Folder picker modal class |
| `getVaultFolders(app)` | Returns sorted array of all vault folder paths |

## Consumers

- Export destination selection
- Documentation root path configuration

## Related

- Sibling: [[FilePickerModal]]
- TD-31: Standalone folder creation accepted exception
