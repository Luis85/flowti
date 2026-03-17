---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for managing note type definitions with CRUD lifecycle events and producer/consumer tracking"
source: "[[Development/flowti/src/ui/hub/TypesTab.ts|TypesTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# TypesTab

## Description

TypesTab renders the master list of TypeDoc entries (note type definitions) and a rich detail panel showing the type's fields, CRUD lifecycle events, and which configs produce or consume instances of that type. The master list includes a "+" button for creating new types via an InputModal. The detail panel shows lifecycle events (created, read, updated, deleted) with links to open event docs or navigate to the Event Catalog, plus cross-references to import configs, pipelines, and export configs associated with the type.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, eventBus, state accessors, navigation, scheduleRender |
| ConfirmModal | class | Confirmation dialog for deleting type docs |
| InputModal | class | Input dialog for entering new type names |
| renderEmptyDetail | function | Renders placeholder when no type is selected |
| openEventInCatalog | function | Opens the Event Catalog view filtered to a specific event type |
| getEmptyDetailStats | function | Computes summary stats for empty detail placeholders |
| TFile | obsidian | Type-checks vault files for deletion |
| setIcon | obsidian | Renders Lucide icons |

## State

**Reads via `deps.getState()`:**
- `typeEntries` — the full list of TypeDocEntry objects (name, description, properties, filePath, pipelineCount)
- `filterText` — text filter applied to master list (matches name, description)
- `selectedTypeName` — currently selected type name
- `pipelineConfigs` — used to find pipelines that produce this type
- `importConfigs` — used to find import configs that produce this type
- `exportConfigs` — used to find export configs that consume this type

**Writes via `deps.setState()`:**
- `selectedTypeName` — set on master item click, cleared on delete
- `selectedPipelineId` — set when clicking a producer pipeline
- `selectedImportId` — set when clicking a producer import config
- `selectedExportId` — set when clicking a consumer export config
- `selectedDictProp` — set when clicking a field chip, navigates to properties tab

## Renders

**Master panel:**
- Header with "Note Types" label, count badge, and "+" add button
- Filterable list items showing type name, field count and config count subtitle, and TypeDoc icon
- Selected item highlight

**Detail panel:**
- Header with type name and fields count badge
- Actions: Open Doc, Delete (with confirmation)
- Description card (from TypeDoc frontmatter)
- Created by section listing pipelines and import configs that produce this type (clickable)
- Consumed by section listing export configs that read this type (clickable)
- Lifecycle Events section showing four CRUD events (`{type}.created`, `{type}.read`, `{type}.updated`, `{type}.deleted`) with icons, descriptions, and actions to open event docs or show in Event Catalog
- Fields section showing property chips (clickable, navigate to properties tab)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | TypesTab does not directly emit or listen to events; lifecycle events are informational references |

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ImportsTab]], [[ExportsTab]], [[ReportsTab]], [[PropertiesTab]], [[PipelinesTab]], [[HubDashboard]]
- Children: (none)
