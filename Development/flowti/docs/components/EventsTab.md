---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for browsing events by category with filter chips, settings panel, and detail view"
source: "[[Development/flowti/src/ui/catalog/EventsTab.ts|EventsTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# EventsTab

## Description

EventsTab is the Events tab component within the Event Catalog view. It orchestrates the event browsing experience with a collapsible category tree in the master panel, filter chips for configured/followed events, a settings panel for category visibility and ordering, and a detail panel for the selected event. It delegates rendering of category groups to EventsCategoryRenderer, the settings sidebar to EventsSettingsPanel, and the detail view to EventDetailPanel.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `app`, `navigation`, `vaultQuery`, `getEntityFolder` |
| `EVENT_CATALOG` | constant | Built-in catalog entries merged with discovered events |
| `EventDetailPanel` | class | Renders the right-side detail panel for a selected event |
| `renderEventsSettingsPanel` | function | Renders the settings sidebar with filter toggles and category controls |
| `renderMasterCategory` | function | Renders a single collapsible category group in the master tree |
| `getVisibleEntries`, `getOrderedCategories`, `discoveredToCatalogEntries` | helpers | Compute visible events, category ordering, and event conversion |
| `isConfigured`, `resolveEntry` | helpers | Check event configuration status and resolve event types |

## State

**Reads from `deps.getState()`:**
- `discoveredEvents` -- user-created events merged with built-in catalog
- `catalogCategories` -- category visibility and ordering settings
- `showSystemEvents` -- toggles system event display
- `filterText` -- text filter across event type, description, domain, service
- `collapsedCategories` -- set of collapsed category names in the tree
- `subscriptions`, `definitions` -- for "configured" filter chip
- `notifiedTypes` -- for "followed" filter chip
- `excludedTypes` -- for visibility status dots on events

**Internal state:**
- `selectedEventType: string | null` -- currently selected event type
- `filterChipConfigured: boolean` -- whether "Only configured" filter is active
- `filterChipFollowed: boolean` -- whether "Only followed" filter is active
- `categoryEntries: CategoryEntry[]` -- scanned category entries with file data

## Renders

**Master tree:**
- User categories first (from discovered events), then system categories (when enabled)
- Each category rendered as collapsible group via `renderMasterCategory()`
- System events section preceded by a "System Events" divider
- Count badge in orchestrator toolbar updated with visible/total counts

**Settings panel:**
- Rendered via `renderEventsSettingsPanel()` -- filter toggles, system event toggle, category visibility/ordering, reset button

**Detail panel:**
- Rendered via `EventDetailPanel` -- event header, info card, actions, watchers, transforms, related entities

**Category scanning:**
- `scanCategories()` reads category doc files from the categories folder
- Merges file-based metadata with catalog-derived categories
- Normalizes non-conforming frontmatter to `CategoryDoc` type

## Events

EventsTab itself does not directly emit events, but its child components do:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `settings.updateCollapsedCategories` | Emits (via CategoryRenderer) | Persists collapsed/expanded state of categories |
| `settings.updateCatalogCategories` | Emits (via SettingsPanel) | Persists category visibility and ordering |
| `settings.updateShowSystemEvents` | Emits (via SettingsPanel) | Toggles system event display |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[CatalogDashboard]], [[DomainsTab]], [[ServicesTab]], [[FlowsTab]], [[SystemsTab]], [[ActorsTab]], [[ProductsTab]]
- Children: [[EventDetailPanel]], [[EventsCategoryRenderer]], [[EventsSettingsPanel]]
