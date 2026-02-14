---
type: Component
domain: Flowti
stage: done
description: "Detail panel showing event info, actions, watchers, transforms, and cross-references for a selected event"
source: "[[Development/flowti/src/ui/catalog/EventDetailPanel.ts|EventDetailPanel.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# EventDetailPanel

## Description

EventDetailPanel renders the right-side detail view for a selected event in the Events tab. It shows the event header with category and stability badges, an info card with direction/domain/services metadata, action buttons (doc, follow, visibility, source, delete), a watchers section listing configured subscriptions with enable/edit/delete controls, a transforms section listing configured event definitions, and cross-reference sections for related Flows, Systems, and Actors.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `app`, `navigation`, `workspace`, `vaultQuery`, `getEntityFolder` |
| `EVENT_CATALOG` | constant | Full built-in event catalog for stats computation |
| `EventConfigModal` | class | Opens the per-event config hub for adding/editing watchers and transforms |
| `ConfirmModal` | class | Confirmation dialog before deleting a custom event |
| `Subscription` | type | Subscription data for rendering watcher rows |
| `EventDefinition` | type | Definition data for rendering transform rows |
| `resolveEntry`, `isDiscoveredEvent` | helpers | Resolve event by type, check if event is user-created |
| `discoveredToCatalogEntries` | helper | Convert discovered events for stats |
| `getConfiguredCount`, `getFollowedCount` | helpers | Compute stats for empty state |
| `findRelatedFlows`, `findRelatedSystems`, `findRelatedActors` | helpers | Cross-reference lookups |
| `getSourcePath`, `openFile`, `openOrCreateEventDoc` | helpers | File navigation utilities |

## State

**Reads from `deps.getState()`:**
- `discoveredEvents` -- to check if event is custom and resolve entries
- `subscriptions` -- filtered by event type for watchers section
- `definitions` -- filtered by source event type for transforms section
- `notifiedTypes` -- determines follow toggle state
- `excludedTypes` -- determines Activity Log visibility toggle state
- `catalogCategories`, `showSystemEvents` -- for empty state stats
- `flowEntries`, `systemEntries`, `actorEntries` -- for cross-reference sections

**Receives from parent:**
- `eventType: string | null` -- the event to display, passed via `render()` method
- `onEventDeleted: () => void` -- callback invoked after deleting a custom event

## Renders

**Header:**
- Event type name
- Badges: category, stability (if present), tags

**Info card:**
- Description text
- Grid rows: Direction, Domain (clickable link), Services (clickable link), Stability, Visibility

**Actions:**
- "Event Doc" -- opens or creates event documentation file
- "Follow / Following" -- toggle button for Notice popup notifications
- "In Activity Log / Hidden from Log" -- toggle button for Activity Log visibility
- "Source" -- opens source file (custom events only)
- "Delete" -- removes custom event from catalog (custom events only, with confirmation)

**Watchers section:**
- Header with count and "Add watcher" button (opens EventConfigModal)
- Per-subscription row: label, filters (path/ext/name), enable toggle, edit button, delete button

**Transforms section:**
- Header with count and "Add transform" button (opens EventConfigModal)
- Per-definition row: arrow + output event name, file pattern + emission policy, enable toggle, edit button, delete button

**Cross-references:**
- Related Flows, Related Systems, Related Actors (clickable navigation links)

**Empty state:**
- "Select an event to view details" with quick stats (events, configured, followed)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `eventNotify.toggle` | Emits | Toggles follow/unfollow for Notice popups |
| `eventFilter.toggle` | Emits | Toggles event visibility in Activity Log |
| `discovery.remove` | Emits | Removes a custom event from the catalog |
| `subscription.update` | Emits | Enables/disables a watcher subscription |
| `subscription.remove` | Emits | Deletes a watcher subscription |
| `eventDefinition.update` | Emits | Enables/disables a transform definition |
| `eventDefinition.remove` | Emits | Deletes a transform definition |

## Related

- Parent: [[EventsTab]]
- Siblings: [[EventsCategoryRenderer]], [[EventsSettingsPanel]]
- Children: none (opens [[EventConfigModal]] as a modal)
