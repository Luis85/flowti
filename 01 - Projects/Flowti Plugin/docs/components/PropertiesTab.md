---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing the data dictionary of frontmatter properties across import and export configs"
source: "[[Development/flowti/src/ui/hub/PropertiesTab.ts|PropertiesTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# PropertiesTab

## Description

PropertiesTab renders the data dictionary master list of frontmatter properties derived from import and export configurations. Each property entry shows which configs use it, the original CSV column names, associated note types, and sample values. The detail panel provides cross-navigation to configs that use the property, links to TypeDoc entries, and actions for creating or opening PropertyDoc documentation files.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, eventBus, state accessors, navigation, scheduleRender |
| renderEmptyDetail | function | Renders placeholder when no property is selected |
| getEmptyDetailStats | function | Computes summary stats for empty detail placeholders |
| Notice | obsidian | Displays toast notifications for doc creation |
| TFile | obsidian | Type-checks vault files for reading frontmatter |
| setIcon | obsidian | Renders Lucide icons |

## State

**Reads via `deps.getState()`:**
- `dictionaryEntries` — the full list of DataDictionaryEntry objects
- `documentedProperties` — Set of property names that have PropertyDoc files
- `filterText` — text filter applied to master list (matches propertyName)
- `selectedDictProp` — currently selected property name

**Writes via `deps.setState()`:**
- `selectedDictProp` — set on master item click
- `selectedTypeName` — set when clicking a type badge, navigates to types tab
- `selectedImportId` — set when clicking an import config reference
- `selectedExportId` — set when clicking an export config reference

## Renders

**Master panel:**
- Header with "Properties" label and count badge
- Filterable list items showing property name, tag icon, documented indicator (file-text icon), and config usage count badge
- Selected item highlight

**Detail panel:**
- Header with property name, config count badge, and clickable type name badges (navigate to types tab)
- Description from PropertyDoc frontmatter (if documented)
- CSV Columns card showing the original CSV column name chips
- Used In Configs section listing import and export configs with operation badges, clickable to navigate to respective tabs
- Sample Values section showing value chips
- Actions: Open Documentation (if PropertyDoc exists) or Create Documentation (creates PropertyDoc and opens it)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | PropertiesTab does not directly emit or listen to events |

## Related

- Parent: [[DataExchangeHubView]]
- Siblings: [[ImportsTab]], [[ExportsTab]], [[ReportsTab]], [[TypesTab]], [[PipelinesTab]], [[HubDashboard]]
- Children: (none)
