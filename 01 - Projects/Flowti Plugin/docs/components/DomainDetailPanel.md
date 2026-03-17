---
type: Component
domain: Flowti
stage: done
description: "Detail panel for the Domains tab showing domain stats, events, actions, and related entities"
source: "[[Development/flowti/src/ui/catalog/DomainDetailPanel.ts|DomainDetailPanel.ts]]"
parent: "[[DomainsTab]]"
tags:
  - catalog
  - component
---

# DomainDetailPanel

## Description

DomainDetailPanel renders the detail view for a selected domain in the Event Catalog's Domains tab. Shows domain statistics (events, services), description, associated events list, and action buttons for creating architecture docs, area folders, and doc files. Includes cross-reference sections for related flows, systems, and actors.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Catalog-level deps with `app`, `getState()`, `setState()` |
| `DomainDetailCallbacks` | interface | `getSelectedDomain()`, `getEntries()`, `createDoc()`, `deleteDoc()`, `createArea()`, `createArchitectureDoc()` |
| `DomainEntry` | type | Domain data with name, events, services, description |
| `setIcon` | obsidian | Renders icons for action buttons and stats |

## State

**Reads via callbacks:**
- `getSelectedDomain()` — currently selected domain name
- `getEntries()` — all domain entries for lookup

## Renders

- Domain detail header with name and stats (events count, services count)
- Description section
- Events list with clickable entries
- Action buttons: Create Doc, Create Area, Create Architecture Doc, Delete
- Related sections: Flows, Systems, Actors

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Uses callbacks for CRUD actions |

## Related

- Parent: [[DomainsTab]]
- Grandparent: [[EventCatalogView]]
- Cross-references: [[FlowsTab]], [[SystemsTab]], [[ActorsTab]]
