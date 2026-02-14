---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing, creating, and managing actor documentation"
source: "[[Development/flowti/src/ui/catalog/ActorsTab.ts|ActorsTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# ActorsTab

## Description

ActorsTab renders the Actors tab within the Event Catalog view. It follows the same master-detail pattern as FlowsTab: the left panel shows a list of actors scanned from documentation files, and the right panel shows details for the selected actor including its events (resolved against the catalog), linked domains and services, and cross-referenced Flows and Systems. Actors are file-driven, each corresponding to a `.md` file with `type: ActorDoc` frontmatter in the Actors documentation folder.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `app`, `navigation`, `workspace`, `getEntityFolder` |
| `scanEntityFolder` | function | Generic entity scanner that reads ActorDoc files from the actors folder |
| `InputModal` | class | Prompts for name when creating a new actor |
| `ConfirmModal` | class | Confirmation dialog before deleting an actor |
| `getActorDocPathResolved` | helper | Resolves the file path for an actor doc |
| `findRelatedFlows`, `findRelatedSystems` | helpers | Cross-reference lookups (not findRelatedActors since this IS the Actors tab) |

## State

**Reads from `deps.getState()`:**
- `filterText` -- filters actor list by name, description, events, domains, or services
- `flowEntries`, `systemEntries` -- for cross-reference sections

**Internal state:**
- `entries: ActorEntry[]` -- scanned actor entries with resolved events
- `selectedActor: string | null` -- currently selected actor name

## Renders

**Master list:**
- Header with "Actors" label and "+" create button
- Each item shows: users icon, actor name, resolved event count badge
- Text filter applied across name, description, events, domains, services

**Detail panel:**
- Header with actor name, event/domain/service count badges
- Description card (if present)
- Info grid: Domains (clickable links), Services (clickable links)
- Actions: Open Doc, Delete (with confirmation)
- Events list: each event row shows type and category (or "unresolved" if not in catalog), clickable to navigate to event detail
- Related Flows, Related Systems sections

**Empty state:**
- "Select an actor to view details" with quick stats (actors, events, domains)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `doc.create` | Emits | Creates a new ActorDoc file |
| `doc.delete` | Emits | Deletes an actor documentation file |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[CatalogDashboard]], [[DomainsTab]], [[ServicesTab]], [[EventsTab]], [[FlowsTab]], [[SystemsTab]], [[ProductsTab]]
- Children: none
