---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing, creating, and managing service documentation"
source: "[[Development/flowti/src/ui/catalog/ServicesTab.ts|ServicesTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# ServicesTab

## Description

ServicesTab renders the Services tab within the Event Catalog view. It follows the same master-detail pattern as DomainsTab: the left panel lists all services (user services, then system services, then hidden), and the right panel shows details for the selected service including its events, linked domains, and cross-referenced entities. Services are derived from a hybrid of catalog event metadata and file-scanned documentation in the services folder.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `app`, `navigation`, `workspace`, `vaultQuery`, `getEntityFolder` |
| `EVENT_CATALOG` | constant | Built-in catalog entries for deriving service-to-event mappings |
| `InputModal` | class | Prompts for name when creating a new service |
| `ConfirmModal` | class | Confirmation dialog before deleting a service doc |
| `readFrontmatter`, `fmString`, `fmStringArray`, `normalizeDocFrontmatter` | helpers | Read and normalize frontmatter from service doc files |
| `getServiceDocPathResolved`, `getServiceBlueprintPathResolved` | helpers | Resolve file paths for service and blueprint docs |
| `findRelatedFlows`, `findRelatedSystems`, `findRelatedActors` | helpers | Cross-reference lookups for related entities |

## State

**Reads from `deps.getState()`:**
- `discoveredEvents` -- merged with EVENT_CATALOG for complete event listing
- `catalogServices` -- visibility settings per service
- `showSystemEvents` -- controls display of system-tagged services
- `filterText` -- filters service list by name, description, or event types
- `subscriptions`, `definitions` -- used to compute configured event counts
- `flowEntries`, `systemEntries`, `actorEntries` -- for cross-reference sections

**Internal state:**
- `entries: ServiceEntry[]` -- scanned service entries
- `selectedService: string | null` -- currently selected service name
- `showHidden: boolean` -- toggle for hidden services section

## Renders

**Master list:**
- Header with "Services" label and "+" create button
- User services section (visible, non-system)
- System services section (visible when `showSystemEvents` is on)
- Hidden services section (collapsible, with count header)
- Each item shows: eye toggle, server icon, name, event count badge, system/undocumented badge, configured status dot

**Detail panel:**
- Header with service name, event count badge, system/undocumented badge
- Description card (if present)
- Info grid: Total Events, Configured, Domains (clickable links)
- Actions: Open/Create Doc, Blueprint / Create Blueprint, Delete (for documented services)
- Events list: clickable rows navigating to event detail
- Related Flows, Related Systems, Related Actors sections

**Empty state:**
- "Select a service to view details" with quick stats (services, events, configured)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `settings.updateCatalogServices` | Emits | Persists service visibility toggles |
| `doc.create` | Emits | Creates ServiceDoc or ServiceBlueprintDoc files |
| `doc.delete` | Emits | Deletes a service documentation file |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[CatalogDashboard]], [[DomainsTab]], [[EventsTab]], [[FlowsTab]], [[SystemsTab]], [[ActorsTab]], [[ProductsTab]]
- Children: none
