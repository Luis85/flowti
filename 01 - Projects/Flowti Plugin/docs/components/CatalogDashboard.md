---
type: Component
domain: Flowti
stage: done
description: "Dashboard homepage for the Event Catalog view showing stats, coverage, and quick actions"
source: "[[Development/flowti/src/ui/catalog/CatalogDashboard.ts|CatalogDashboard.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# CatalogDashboard

## Description

CatalogDashboard is the landing page component for the Event Catalog view. It renders a stats grid with clickable cards for each entity type (Domains, Services, Events, Flows, Systems, Actors, Products), a documentation coverage section, quick-action buttons for creating new entities, and navigation links to the Activity Log and Watchers. Each stats card navigates to its corresponding tab when clicked.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `navigation`, `app`, `vaultQuery`, `eventBus`, `createEntity`, `getEntityFolder` |
| `InputModal` | class | Prompts for name when creating new domains, services, flows, systems, actors, or products |
| `CreateEventModal` | class | Prompts for event name and category when creating new events |
| `getVisibleEntries` | helper | Computes visible event count respecting category visibility and system event toggle |
| `discoveredToCatalogEntries` | helper | Converts discovered events into catalog entry format |

## State

**Reads from `deps.getState()`:**
- `domainEntries` -- filtered by visibility and system event toggle for domain count
- `serviceEntries` -- filtered by visibility and system event toggle for service count
- `discoveredEvents` -- used to compute visible event count
- `catalogCategories` -- used for event visibility filtering
- `showSystemEvents` -- controls whether system domains/services/events are counted
- `flowEntries`, `systemEntries`, `actorEntries`, `productEntries` -- counts for stats cards

**Does not write state.**

## Renders

- **Title bar**: "Event Catalog" heading with network icon
- **Stats grid**: 7 clickable cards in a 3-column grid (Domains, Services, Events, Flows, Systems, Actors, Products) with count and icon
- **Documentation Coverage**: 2x2 grid showing Domain Docs, Service Docs, Architecture Docs, and Service Blueprints counts
- **Quick Actions**: 7 buttons (New Domain, New Service, New Event, New Flow, New System, New Actor, New Product) -- each opens an InputModal or CreateEventModal
- **Links**: Activity Log and Watchers navigation links

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `discovery.create` | Emits (via CreateEventModal) | Creates a new custom event in the catalog |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[DomainsTab]], [[ServicesTab]], [[EventsTab]], [[FlowsTab]], [[SystemsTab]], [[ActorsTab]], [[ProductsTab]]
- Children: none
