---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey from source events triggering inbox notifications through reading, dismissing, and clearing inbox items
domains:
  - Inbox
services:
  - InboxService
events:
  - inbox.loaded
  - inbox.itemAdded
  - inbox.itemsChanged
  - inbox.refresh
tags:
  - inbox
---

# Manage Inbox Notifications

## Overview

The Inbox captures important system events and presents them as actionable or informational notifications. Source events from other domains (subscription matches, import completions, import failures, export completions) are automatically mapped into inbox items via pure mapper functions. Users view their inbox in the User Hub, where they can read, dismiss, or clear notifications. The inbox persists across sessions with a 500-item cap and oldest-first eviction.

## Trigger

Inbox items are created automatically when source events fire (subscription.matched, dataExchange.import.completed, dataExchange.import.failed, dataExchange.export.completed). Users interact with the inbox via the User Hub's Inbox panel.

## Steps

### 1. Source Event Fires

- **View/Service**: Various domain services (SubscriptionService, DataExchangeService)
- **User Action**: User completes an action that triggers a source event (e.g., an import finishes, a subscription matches, an export completes)
- **System Response**: The originating domain service emits its event as normal. InboxService listens for 4 specific source events via EventBus subscriptions registered during `onLayoutReady()`
- **Events**: `subscription.matched`, `dataExchange.import.completed`, `dataExchange.import.failed`, or `dataExchange.export.completed`

### 2. Map Source Event to Inbox Item

- **View/Service**: InboxService (internal, automatic)
- **User Action**: (none — automatic)
- **System Response**: InboxService receives the source event and passes it to the corresponding pure mapper function (`mapSubscriptionMatched`, `mapImportCompleted`, `mapImportFailed`, or `mapExportCompleted`). The mapper produces an `InboxItem` with: unique ID, type (`"action"` or `"info"`), human-readable title and description, source event name, source hub identifier, timestamp, and `read: false`. The mapper functions are pure — they take event payload in and return an InboxItem out, with no side effects
- **Events**: (none — internal mapping)

### 3. Add Item to Inbox

- **View/Service**: InboxService
- **User Action**: (none — automatic)
- **System Response**: InboxService prepends the new item to the inbox items array. If the array exceeds `MAX_INBOX_ITEMS` (500), the oldest items are evicted. The updated state is persisted to TypedStorage under the `"inbox"` key. InboxService emits `inbox.itemAdded` with the new item
- **Events**: `inbox.itemAdded`

### 4. UI Re-renders

- **View/Service**: UserHubView (Inbox panel)
- **User Action**: (none — automatic)
- **System Response**: UserHubView subscribes to `inbox.itemAdded` and `inbox.itemsChanged`. When either fires, the view calls `scheduleRender()` to update the inbox panel. The unread count badge in the User Hub top bar updates. Each inbox item renders with its title, description, timestamp, type icon (action vs. info), and read/unread state
- **Events**: (none — UI re-render only)

### 5. Read Inbox Item

- **View/Service**: UserHubView → InboxService
- **User Action**: User clicks on an unread inbox item
- **System Response**: InboxService marks the item as `read: true`, persists the updated state, and emits `inbox.itemsChanged` with the updated items array and new unread count. The UI re-renders to show the item in its read state (visual distinction via styling)
- **Events**: `inbox.itemsChanged`

### 6. Dismiss Inbox Item

- **View/Service**: UserHubView → InboxService
- **User Action**: User clicks the dismiss button on an inbox item
- **System Response**: InboxService removes the item from the items array, persists the updated state, and emits `inbox.itemsChanged`. The item disappears from the inbox panel
- **Events**: `inbox.itemsChanged`

### 7. Clear All Inbox Items

- **View/Service**: UserHubView → InboxService
- **User Action**: User clicks "Clear All" in the inbox panel
- **System Response**: InboxService empties the items array, persists the empty state, and emits `inbox.itemsChanged` with an empty array and unread count of 0. The inbox panel shows an empty state message
- **Events**: `inbox.itemsChanged`

### 8. Load Inbox on Startup

- **View/Service**: InboxService (during plugin load)
- **User Action**: (none — automatic on vault open)
- **System Response**: During `onLayoutReady()`, InboxService calls `.load()` to read persisted inbox state from TypedStorage. If state exists, it emits `inbox.loaded` with the items and unread count. The User Hub subscribes to `inbox.loaded` to populate the initial inbox view
- **Events**: `inbox.loaded`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Item type | `"action"` (requires user response) / `"info"` (informational) | Depends on source event |
| Max items | 500 (configurable via `MAX_INBOX_ITEMS`) | 500 |
| Eviction strategy | Oldest-first when cap exceeded | Oldest-first |
| Source events | subscription.matched, import.completed, import.failed, export.completed | All 4 active |

## Events Sequence

```
[Source event fires] → InboxService mapper → inbox.itemAdded → [UI re-render]
    → [User clicks item] → inbox.itemsChanged (read)
    → [User dismisses] → inbox.itemsChanged (removed)
    → [User clears all] → inbox.itemsChanged (empty)

[Plugin loads] → inbox.loaded → [UI populates]
[Refresh request] → inbox.refresh → inbox.loaded → [UI re-render]
```

## Related Decisions

- Pure mapper pattern: mappers are stateless functions, not service methods (ADR-023 principle)

## Known Debt

- TD-95: This flow doc was itself a missing artifact (now resolved)

## Learnings

- [[L-22 Every major event domain needs a flow doc]] — motivation for creating this doc
- [[L-10 Pure helpers scale safely]] — mapper functions follow the pure helper pattern

## Related Use Cases

- [[Subscribe to Events]] (subscription.matched triggers inbox items)
- [[Import CSV as Notes]] (import completion/failure triggers inbox items)
- [[Export Vault Data]] (export completion triggers inbox items)
- [[Create and Manage Sessions]] (session-related inbox items planned for future)
