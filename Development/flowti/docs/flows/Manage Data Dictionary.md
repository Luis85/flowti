---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey from importing CSV data through property aggregation in the Data Exchange Hub, documenting properties, and tracking usage across configurations
domains:
  - Data Exchange
services:
  - DataExchangeService
  - DataDictionaryBuilder
  - ConfigDocService
events:
  - dataExchange.import.completed
  - dataExchange.config.changed
tags:
  - data-exchange
---

# Manage Data Dictionary

## Overview

As users import CSV data and create export configurations, the vault accumulates frontmatter properties across many notes. The Data Exchange Hub's Properties tab aggregates all these properties into a browsable data dictionary, showing usage counts, source configs, and documentation status. This journey covers the full workflow from initial data import through property discovery, documentation, and ongoing usage tracking.

## Trigger

User has imported CSV data into the vault and wants to understand, document, and manage the frontmatter properties that exist across their notes.

## Steps

### 1. Import CSV Data

- **View/Service**: CsvActionView (ImportModal)
- **User Action**: User right-clicks a `.csv` file in the vault and selects "Import as Notes", or uses the `flowti:import-csv` command. In the ImportModal wizard, they configure target folder, name column, column mappings, and conflict strategy (skip/update/overwrite)
- **System Response**: ImportService processes each CSV row: sanitizes filenames, builds note content with YAML frontmatter from the column mappings, and creates vault files. Progress events fire for each row. On completion, a summary shows created/updated/skipped counts
- **Events**: `dataExchange.import.completed`

### 2. Open Data Exchange Hub

- **View/Service**: DataExchangeHubView
- **User Action**: User opens the Data Exchange Hub from the sidebar or command palette
- **System Response**: Hub loads with its tab layout. The overview shows aggregate statistics including total configs, recent imports/exports, and property counts
- **Events**: (none — UI render)

### 3. Navigate to Properties Tab

- **View/Service**: DataExchangeHubView (PropertiesTab)
- **User Action**: User clicks the "Properties" tab in the Hub
- **System Response**: DataDictionaryBuilder scans all frontmatter properties across the vault by iterating through metadataCache entries. It aggregates properties into a master list showing: property name, usage count (how many notes contain it), value types observed, and which import/export configurations reference it. Properties are sorted by usage frequency
- **Events**: (none — file scan via metadataCache)

### 4. Explore Property Details

- **View/Service**: PropertiesTab (detail panel)
- **User Action**: User clicks on a specific property in the master list (e.g., `status`, `category`, `due-date`)
- **System Response**: The detail panel renders comprehensive information about the selected property: usage count, list of configurations that reference it (import column mappings and export column selections), sample values observed across notes, and documentation status (documented vs undocumented)
- **Events**: (none — UI render)

### 5. Create Property Documentation

- **View/Service**: PropertiesTab (detail panel actions)
- **User Action**: User clicks "Create Doc" button on an undocumented property
- **System Response**: ConfigDocService creates a new Markdown documentation file for the property with frontmatter including: property name, description placeholder, expected value types, related domains, and usage metadata. The file is created in the documentation root path. After the 500ms metadataCache delay, the property's status updates to "documented" in the master list
- **Events**: `dataExchange.config.changed`

### 6. Edit Property Documentation

- **View/Service**: Obsidian editor
- **User Action**: User opens the created property doc and fills in the description, expected values, validation rules, and related domain information
- **System Response**: metadataCache updates as the user saves. The Properties tab picks up the enriched metadata on next render, showing the documentation content in the detail panel
- **Events**: `metadata.changed`

### 7. Save Import Configuration

- **View/Service**: ImportModal / DataExchangeHubView
- **User Action**: User saves the import configuration that created these properties (name, targetFolder, nameColumn, columnMappings, conflictStrategy) using the "Save Config" button in the ImportModal, or manages saved configs in the Hub
- **System Response**: DataExchangeService persists the `SavedImportConfig` to storage under the `dataExchange` key. The config appears in the Hub's Configs tab and can be loaded for future imports. Property references in the config are now tracked in the data dictionary
- **Events**: `dataExchange.config.changed`

### 8. Track Usage Across Configurations

- **View/Service**: PropertiesTab (detail panel)
- **User Action**: User returns to the Properties tab to review property usage after creating additional import or export configurations
- **System Response**: DataDictionaryBuilder re-scans and shows updated usage data. Each property's detail panel now lists all saved configurations (both import and export) that reference it, providing a complete dependency map. Users can identify orphaned properties (documented but unused), heavily-used properties needing standardization, and undocumented properties requiring attention
- **Events**: (none — file scan and config lookup)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Properties to document | All / High-usage only / By domain | User discretion |
| Expected value types | string, number, date, boolean, list | Inferred from samples |
| Related domain assignment | Link to existing domains / Create new | None |
| Documentation depth | Minimal (name + description) / Full (values + rules + domains) | Minimal |
| Config persistence | Save for reuse / One-time import | Not saved |
| Property naming | Keep original CSV headers / Rename in mapping | Original headers |

## Events Sequence

```
dataExchange.import.completed → (scan properties) → dataExchange.config.changed → metadata.changed → dataExchange.config.changed → (scan usage)
```

## Related Use Cases

- [[Build Data Dictionary]]
- [[Import CSV as Notes]]
- [[Manage Import Configurations]]

## Related Decisions

- [[ADR-004 Single JSON Blob Storage]] — SavedImportConfig/ExportConfig persisted under dataExchange key
- [[ADR-005 File-Driven Entity Model]] — property docs are Markdown files with type: PropertyDoc frontmatter
- [[ADR-024 BaseHubView Shell Extraction]] — DataExchangeHubView extends BaseHubView; Properties tab in inherited tab bar
- [[ADR-030 Frontmatter Type Conformance Standard]] — property docs must have type: PropertyDoc

## Known Debt

- TD-45: DX Hub resets to dashboard on reopen; Properties tab selection not persisted
- TD-90: Data Dictionary markdown document manually maintained; can drift from code schemas
- TD-93: Property metadata in vault frontmatter and TypedStorage can diverge
- TD-32: normalizeDocFrontmatter() writes during render cycle (side-effect)

## Learnings

- [[L-06 Config CRUD goes through EventBus for domain actions]] — DataDictionaryBuilder scans metadataCache directly (correct — read-only computation)
- [[L-21 Documentation debt compounds silently]] — property docs remain empty stubs unless user actively fills them
