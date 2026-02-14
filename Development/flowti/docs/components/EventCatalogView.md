---
type: Component
domain: Flowti
stage: done
description: "Master-detail orchestrator for browsing and managing events, domains, services, flows, systems, actors, and products"
source: "[[Development/flowti/src/ui/EventCatalogView.ts|EventCatalogView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# EventCatalogView

## Description

EventCatalogView is the primary orchestrator view for the Flowti event catalog. It extends Obsidian's `ItemView` and renders a tabbed interface with 8 tabs: Dashboard, Domains, Services, Events, Flows, Systems, Actors, and Products. The Dashboard tab shows a summary landing page, while all other tabs use a master-detail split layout with a searchable master list on the left and a detail panel on the right.

The view is registered under the type `flowti-event-catalog` and displays as "Event Catalog" with the `list` icon. It serves as the central hub for exploring all event-driven architecture entities in the vault.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Subscribe to and emit events for discovery, filters, settings, subscriptions, and definitions |
| `ViewStateProvider` | interface | Access live settings, discovered events, excluded/notified types, and collapsed categories |
| `CatalogDashboard` | class | Renders the dashboard landing page with stats and quick actions |
| `DomainsTab` | class | Renders the domains master-detail tab |
| `ServicesTab` | class | Renders the services master-detail tab |
| `EventsTab` | class | Renders the events master-detail tab with category tree and settings panel |
| `FlowsTab` | class | Renders the flows master-detail tab |
| `SystemsTab` | class | Renders the systems master-detail tab |
| `ActorsTab` | class | Renders the actors master-detail tab |
| `ProductsTab` | class | Renders the products master-detail tab |
| `SubscriptionManagerModal` | class | Opens the subscription/watcher management modal |
| `buildSplitLayout` | function | Creates the shared dashboard + master/detail DOM skeleton |

## State

The view manages extensive state covering all entity types:

- **`activeTab`**: Current tab selection (`"dashboard" | "events" | "domains" | "services" | "flows" | "systems" | "actors" | "products"`)
- **`discoveredEvents`**: Array of `DiscoveredEvent` from the discovery domain
- **`excludedTypes`** / **`notifiedTypes`**: Sets of event type strings for filter and notification state
- **`catalogCategories`**: Category visibility configuration from settings
- **`collapsedCategories`**: Set of collapsed category names for the events tree
- **`subscriptions`**: Array of `Subscription` objects
- **`definitions`**: Array of `EventDefinition` objects
- **`domainEntries`** / **`serviceEntries`** / **`categoryEntries`**: Scanned entity arrays
- **`flowEntries`** / **`systemEntries`** / **`actorEntries`** / **`productEntries`**: File-scanned entity arrays
- **`filterText`**: Current search/filter text
- **`docsRootPath`** / **`entityPaths`**: Documentation folder configuration
- **`showSystemEvents`**: Whether system-tagged events are visible

All state is passed to child components via `CatalogComponentDeps` with `getState()` and `navigation` callbacks.

## Renders

- **Top bar**: Title (clickable to return to dashboard), count badge, Activity Log link, Watchers button
- **Tab bar**: 7 clickable tabs (Domains, Services, Events, Flows, Systems, Actors, Products) -- hidden on dashboard
- **Dashboard view** (`CatalogDashboard`): Stats grid, quick actions, and entity summaries
- **Split layout** (non-dashboard tabs):
  - **Search header**: Search input with placeholder per tab, gear icon (Events tab only)
  - **Settings panel**: Category visibility toggles (Events tab only)
  - **Dot legend**: Hidden/configured/followed status indicators with expand/collapse all buttons (Events tab only)
  - **Master tree**: Searchable list of entities
  - **Detail panel**: Full detail for selected entity
- **Scheduled rendering**: 16ms debounced re-renders via `scheduleRender()`

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `discovery.loaded` | Listens | Refresh full discovered events list |
| `discovery.updated` | Listens | Update or add a single discovered event |
| `discovery.removed` | Listens | Remove a discovered event by name |
| `discovery.create` | Emits | Request creation of a new event |
| `eventFilter.loaded` | Listens | Initialize excluded types set |
| `eventFilter.changed` | Listens | Update excluded types set |
| `eventNotify.loaded` | Listens | Initialize notified types set |
| `eventNotify.changed` | Listens | Update notified types set |
| `settings.loaded` | Listens | Initialize docs path, categories, domains, services, system events flag |
| `settings.changed` | Listens | Update settings state |
| `subscription.loaded` | Listens | Initialize subscriptions array |
| `subscription.created` | Listens | Add or replace a subscription |
| `subscription.updated` | Listens | Update a subscription in place |
| `subscription.deleted` | Listens | Remove a subscription by ID |
| `subscription.refresh` | Emits | Request current subscription state on open |
| `eventDefinition.loaded` | Listens | Initialize definitions array |
| `eventDefinition.created` | Listens | Add or replace a definition |
| `eventDefinition.updated` | Listens | Update a definition in place |
| `eventDefinition.deleted` | Listens | Remove a definition by ID |
| `eventDefinition.refresh` | Emits | Request current definition state on open |
| `doc.created` | Listens | Re-render after 500ms delay for metadataCache indexing |
| `doc.deleted` | Listens | Re-render immediately |

## Related

- Children: [[CatalogDashboard]], [[DomainsTab]], [[ServicesTab]], [[EventsTab]], [[FlowsTab]], [[SystemsTab]], [[ActorsTab]], [[ProductsTab]], [[EventDetailPanel]], [[EventsSettingsPanel]], [[EventsCategoryRenderer]]
- Opens: [[EventLogView]], [[SubscriptionManagerModal]]
