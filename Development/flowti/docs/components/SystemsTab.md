---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing, creating, and managing system documentation"
source: "[[Development/flowti/src/ui/catalog/SystemsTab.ts|SystemsTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# SystemsTab

## Description

SystemsTab renders the Systems tab within the Event Catalog view. It follows the master-detail pattern with a list of systems on the left and details on the right. Systems are file-driven, scanned from `.md` files with `type: SystemDoc` frontmatter. Unlike Flows or Actors, systems do not explicitly list events in frontmatter -- instead, events are derived by matching the system's linked domains and services against catalog entries.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `app`, `navigation`, `workspace`, `getEntityFolder` |
| `scanEntityFolder` | function | Generic entity scanner with `readEvents: false` and custom `mapEntry` for domain/service-based event derivation |
| `InputModal` | class | Prompts for name when creating a new system |
| `ConfirmModal` | class | Confirmation dialog before deleting a system |
| `getSystemDocPathResolved` | helper | Resolves the file path for a system doc |
| `findRelatedFlows`, `findRelatedActors` | helpers | Cross-reference lookups (not findRelatedSystems since this IS the Systems tab) |

## State

**Reads from `deps.getState()`:**
- `filterText` -- filters system list by name, description, domains, or services
- `flowEntries`, `actorEntries` -- for cross-reference sections

**Internal state:**
- `entries: SystemEntry[]` -- scanned system entries with derived events
- `selectedSystem: string | null` -- currently selected system name

## Renders

**Master list:**
- Header with "Systems" label and "+" create button
- Each item shows: layout-grid icon, system name, derived event count badge
- Text filter applied across name, description, domains, services

**Detail panel:**
- Header with system name, event/domain/service count badges
- Description card (if present)
- Info grid: Domains (clickable links), Services (clickable links)
- Actions: Open Doc, Delete (with confirmation)
- Events list: derived events with type and category, clickable to navigate to event detail
- Related Flows, Related Actors sections

**Empty state:**
- "Select a system to view details" with quick stats (systems, events, domains)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `doc.create` | Emits | Creates a new SystemDoc file |
| `doc.delete` | Emits | Deletes a system documentation file |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[CatalogDashboard]], [[DomainsTab]], [[ServicesTab]], [[EventsTab]], [[FlowsTab]], [[ActorsTab]], [[ProductsTab]]
- Children: none
