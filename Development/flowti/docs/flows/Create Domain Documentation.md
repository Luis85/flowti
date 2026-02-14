---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey for documenting domains, services, flows, systems, actors, and products in the Event Catalog
domains:
  - Settings
services:
  - FileSystemClient
  - SettingsService
events:
  - doc.created
  - doc.deleted
tags:
  - catalog
---

# Create Domain Documentation

## Overview

The Event Catalog supports creating documentation files for all entity types: domains, services, flows, systems, actors, and products. Each entity is stored as a Markdown file with typed frontmatter in the documentation root path. This journey covers creating any entity doc from the catalog.

## Trigger

User wants to document an aspect of their system (a domain, service, flow, system, actor, or product) in the Event Catalog.

## Steps

### 1. Open Event Catalog

- **View/Service**: EventCatalogView
- **User Action**: User opens the Event Catalog from the sidebar or command palette
- **System Response**: Catalog loads with Dashboard tab showing stats overview
- **Events**: (none — UI render)

### 2. Navigate to Entity Tab

- **View/Service**: EventCatalogView (DomainsTab / ServicesTab / FlowsTab / SystemsTab / ActorsTab / ProductsTab)
- **User Action**: User clicks the relevant tab (e.g., Domains)
- **System Response**: Tab scans documentation folder for existing `.md` files with matching `type` frontmatter, merges with catalog-derived entries
- **Events**: (none — file scan via metadataCache)

### 3. Create New Document

- **View/Service**: Entity Tab (e.g., DomainsTab)
- **User Action**: User clicks the "+" button in the master list header
- **System Response**: FileSystemClient creates a new `.md` file in `docsRootPath/{EntityType}/` with default frontmatter template. After 500ms delay (for metadataCache indexing), the tab re-renders showing the new entry
- **Events**: `doc.created`

### 4. Edit Document Content

- **View/Service**: Obsidian editor
- **User Action**: User opens the created file and fills in the frontmatter (name, description, services, events, domains) and body content
- **System Response**: metadataCache updates as user saves. Catalog picks up changes on next render
- **Events**: `metadata.changed`

### 5. View Cross-References

- **View/Service**: Entity Tab detail panel
- **User Action**: User returns to the catalog and selects the new entry
- **System Response**: Detail panel shows the entity's metadata, linked events (resolved against catalog), and cross-reference sections (Related Flows, Systems, Actors, Products)
- **Events**: (none — UI render)

### 6. Mark as Area (Domains Only)

- **View/Service**: DomainsTab detail panel
- **User Action**: User clicks "Mark as Area" button in the actions section
- **System Response**: Creates `02 - Areas/{domainName}/{domainName}.md` with `type: AreaDoc` frontmatter
- **Events**: `doc.created`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Entity type | Domain, Service, Flow, System, Actor, Product | Depends on tab |
| Cross-references | Link to existing events/domains/services | Empty arrays |
| Mark as Area | Convert domain to area folder | Optional (domains only) |

## Events Sequence

```
doc.created → metadata.changed → (render) → doc.created (if Mark as Area)
```

## Related Use Cases

- [[Document a Business Domain]]
- [[Model a Business Flow]]
- [[Map Systems and Actors]]
- [[Track Products]]
