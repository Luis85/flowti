---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for managing saved import configurations with execute, preview, edit, and delete actions"
source: "[[Development/flowti/src/ui/hub/ImportsTab.ts|ImportsTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# ImportsTab

## Description

ImportsTab renders the master list of saved import configurations in the left panel and a detail/edit view in the right panel. It follows the standard master-detail pattern used across the hub, providing actions for executing imports (with real-time progress feedback), previewing in the CSV import modal, editing config fields, viewing linked CSV and base files, managing documentation, and deleting configs. The edit form allows modifying name, target folder, name column, conflict strategy, base view creation, and note type.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, eventBus, state accessors, navigation, scheduleRender |
| SavedImportConfig | type | Shape of persisted import configuration |
| ConfirmModal | class | Confirmation dialog for delete operations |
| FilePickerModal | class | File picker for selecting CSV source files |
| FolderPickerModal | class | Folder picker for browsing vault folders |
| addInfoRow | function | Helper to render label-value rows in detail info grids |
| renderEmptyDetail | function | Renders placeholder when no config is selected |
| resolveImportBaseFile | function | Resolves the .base file associated with an import config |
| getEmptyDetailStats | function | Computes summary stats for empty detail placeholders |
| Notice | obsidian | Displays toast notifications |
| Setting | obsidian | Renders form controls in the edit form |
| TFile | obsidian | Type-checks vault files |
| setIcon | obsidian | Renders Lucide icons |

## State

**Reads via `deps.getState()`:**
- `importConfigs` — the full list of saved import configs
- `filterText` — text filter applied to master list (matches name, targetFolder)
- `selectedImportId` — currently selected config ID
- `editingImportId` — config ID being edited (switches detail to edit form)

**Writes via `deps.setState()`:**
- `selectedImportId` — set on master item click, cleared on delete
- `editingImportId` — set when Update clicked, cleared on Save/Cancel

## Renders

**Master panel:**
- Header with "Import Configs" label and count badge
- Filterable list items showing config name, target folder, and conflict strategy badge
- Selected item highlight

**Detail panel (view mode):**
- Header with config name, operation badge ("Import"), conflict strategy, optional base view and note type badges
- Actions bar: Execute, Preview, View CSV, Open Base, Read Doc / Create Doc, Update, Delete
- Description section (from linked CsvDoc frontmatter)
- Source & Target info card (source CSV, target folder, name column, name prefix/suffix)
- Configuration card (conflict strategy, mapped columns count, custom properties count, base view, note type, created date, last import timestamp with relative time)
- Column mappings table (CSV Column, Frontmatter Key, Included)
- Custom properties grid

**Detail panel (edit mode):**
- Settings form: Name, Target folder (with browse), Name column, Conflict strategy dropdown, Create .base view toggle, Base file path, Note type
- Save / Cancel action links

**Execution feedback:**
- Inline progress card with spinner, progress bar, and status text
- Listens for progress/completed/failed events in real-time
- Result summary with check/x icon

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `dataExchange.import.execute` | Emits | Triggers import execution with config parameters |
| `dataExchange.import.progress` | Listens | Updates progress bar and status text during import |
| `dataExchange.import.completed` | Listens | Shows success result and refreshes the view |
| `dataExchange.import.failed` | Listens | Shows error result with failure message |

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ExportsTab]], [[ReportsTab]], [[PropertiesTab]], [[TypesTab]], [[PipelinesTab]], [[HubDashboard]]
- Children: (none)
