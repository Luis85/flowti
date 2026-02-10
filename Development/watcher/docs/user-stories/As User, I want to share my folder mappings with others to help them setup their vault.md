---
parent: "[[Development/watcher/docs/personas/Collaborator|Collaborator]]"
domain: Folder Watcher
id: US-C8
title: Share folder mappings with others
persona: Collaborator (Chris)
jtbd: Share configuration
journey: "[[Development/watcher/docs/journeys/journey-4-share-and-collect-feedback|Journey 4]]"
use-cases:
  - UC-47
  - UC-48
status: implemented
---
# US-C8: Share folder mappings with others

> JTBD: Share configuration | Persona: [The Collaborator](Development/watcher/docs/personas/Collaborator.md) | Journey: [Journey 4](../journeys/journey-4-share-and-collect-feedback.md)

**As a** user,
**I want** to share my folder mappings with others,
**so that** they can set up their vault with the same sync structure without manual configuration.

## Acceptance Criteria

### Export

- [x] User can export all folder mappings to a JSON file via settings UI ("Export" button) or command palette ("Export folder mappings")
- [x] A native save dialog lets the user choose any location on their machine (including outside the vault)
- [x] Exported mappings have `sourceFolder` cleared (paths are machine-specific)
- [x] Exported mappings have `enabled` set to `false`
- [x] All other mapping properties are preserved (targetFolder, description, fileExtensions, syncDirection, excludePatterns, conflictResolution, etc.)
- [x] Export file uses a versioned JSON schema (`version: 1`) with metadata (exportedAt, pluginVersion)
- [x] User sees a success notice with the file path after export

### Import

- [x] User can import mappings from a JSON file via settings UI ("Import" button) or command palette ("Import folder mappings")
- [x] A native file picker dialog lets the user choose a `.json` file from any location on their machine
- [x] Imported mappings get fresh UUIDs (no ID collisions with existing mappings)
- [x] Imported mappings are disabled by default (user must configure `sourceFolder` and enable them)
- [x] Mappings with overlapping `targetFolder` (exact match or parent/child) are skipped with a warning notice
- [x] Missing optional fields are filled with defaults from `DEFAULT_MAPPING_VALUES`
- [x] Invalid JSON or wrong version shows an error notice
- [x] User sees a success notice with the count of imported mappings and a reminder to configure source folders

## Implementation

- **MappingExportService** (`src/services/MappingExportService.ts`): Pure logic for serialization, deserialization with validation, and import preparation
- **FolderPickerService** (`src/services/FolderPickerService.ts`): `pickExportPath()` (save dialog) and `pickImportFile()` (open dialog with JSON filter)
- **FileWatcherPlugin** (`src/main.ts`): `exportMappings()` and `importMappings()` methods + commands
- **FileWatcherSettingTab** (`src/settings/FileWatcherSettingTab.ts`): Export/Import buttons in mappings section

## Tests

- `tests/services/MappingExportService.test.ts` — 29 unit tests (serialize, deserialize, prepare, round-trip)
- `tests/settings/MappingExportImport.test.ts` — 7 integration tests (full export→import scenario)
