---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for managing saved export configurations with execute, preview, edit, and delete actions"
source: "[[Development/flowti/src/ui/hub/ExportsTab.ts|ExportsTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# ExportsTab

## Description

ExportsTab renders the master list of saved export configurations in the left panel and a detail/edit view in the right panel. It provides actions for executing exports, previewing via the export modal, viewing source files (base or folder), viewing output files, managing config documentation, editing config fields, and deleting configs. The edit form supports both vault and external filesystem output paths via native save dialogs. It also shows linked pipelines that reference the export config.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, eventBus, state accessors, navigation, scheduleRender |
| SavedExportConfig | type | Shape of persisted export configuration |
| ConfirmModal | class | Confirmation dialog for delete operations |
| FilePickerModal | class | File picker for selecting .base source files |
| FolderPickerModal | class | Folder picker for browsing vault folders |
| showNativeSaveDialog | function | Opens Electron native save dialog for external file export |
| addInfoRow | function | Helper to render label-value rows in detail info grids |
| renderEmptyDetail | function | Renders placeholder when no config is selected |
| getEmptyDetailStats | function | Computes summary stats for empty detail placeholders |
| Notice | obsidian | Displays toast notifications |
| Setting | obsidian | Renders form controls in the edit form |
| TFile | obsidian | Type-checks vault files |
| setIcon | obsidian | Renders Lucide icons |

## State

**Reads via `deps.getState()`:**
- `exportConfigs` — the full list of saved export configs
- `filterText` — text filter applied to master list (matches name, sourcePath)
- `selectedExportId` — currently selected config ID
- `editingExportId` — config ID being edited (switches detail to edit form)

**Writes via `deps.setState()`:**
- `selectedExportId` — set on master item click, cleared on delete
- `editingExportId` — set when Update clicked, cleared on Save/Cancel
- `selectedPipelineId` — set when navigating to a linked pipeline

## Renders

**Master panel:**
- Header with "Export Configs" label and count badge
- Filterable list items showing config name, source path, pipeline count badge (git-merge icon), and format badge (CSV/TAB)
- Selected item highlight

**Detail panel (view mode):**
- Header with config name, operation badge ("Export"), format badge, source type badge, optional external and note type badges
- Actions bar: Execute, Preview, Open Base / Open Folder, View Output, Read Doc / Create Doc, Update, Delete
- Linked Pipelines section showing pipelines that reference this export config (clickable, navigates to pipelines tab)
- Description section (from linked config doc frontmatter)
- Source & Output info card (source path with clickable link, output path with external badge)
- Configuration card (format, conflict strategy, base view index, note type, created date)
- Note Properties section showing column chips
- File Properties section showing file property chips

**Detail panel (edit mode):**
- Settings form: Name, Source path (with browse for base/folder), Output path (with vault browse and filesystem save dialog), Conflict strategy dropdown, Note type
- External badge indicator on output path
- Save / Cancel action links

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `dataExchange.export.execute` | Emits | Triggers export execution with config parameters |
| `dataExchange.export.completed` | Listens | Shows success notice with row count or skipped message |
| `dataExchange.export.failed` | Listens | Shows error notice with failure message |

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ImportsTab]], [[ReportsTab]], [[PropertiesTab]], [[TypesTab]], [[PipelinesTab]], [[HubDashboard]]
- Children: (none)
