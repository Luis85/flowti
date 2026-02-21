---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey from creating event watchers (subscriptions) through filter configuration, match detection, and inbox notification
domains:
  - Subscription
  - Inbox
services:
  - SubscriptionService
  - InboxService
events:
  - subscription.create
  - subscription.created
  - subscription.update
  - subscription.updated
  - subscription.remove
  - subscription.deleted
  - subscription.matched
  - subscription.loaded
  - subscription.refresh
tags:
  - subscription
  - watcher
  - inbox
---

# Manage Event Watchers

## Overview

Event watchers (subscriptions) monitor specific event types and filter matching files for processing. When a watched event fires and its filters match, the watcher triggers an inbox notification. Users manage watchers through three entry points: the "Manage Watchers" command palette command, the Event Catalog dashboard, and per-event configuration in the Event Catalog detail panel. Watchers persist across sessions via TypedStorage and respect the global event system toggle.

## Trigger

User opens the "Manage Watchers" modal via command palette, Event Catalog dashboard link, or clicks "Add watcher" in an event's detail panel.

## Steps

### 1. Open Watcher Management

- **View/Service**: main.ts / UiCommandService / EventCatalogView
- **User Action**: One of three entry points:
  1. Command palette: "Manage Watchers" (`flowti:manage-subscriptions`, icon: `bell`)
  2. Event Catalog dashboard: "Watchers" quick link
  3. Event detail panel: "Add watcher" button or pencil icon on existing watcher
- **System Response**: Entry points 1–2 emit `ui.openSubscriptionManager` which opens the `SubscriptionManagerModal`. Entry point 3 opens `EventConfigModal` for the specific event type. Both modals emit `subscription.refresh` on open to load current state.
- **Events**: `ui.openSubscriptionManager` (paths 1–2), `subscription.refresh`

### 2. View Existing Watchers

- **View/Service**: SubscriptionManagerModal (list page) or EventConfigModal (overview page)
- **User Action**: (none — automatic on modal open)
- **System Response**: SubscriptionService receives `subscription.refresh`, re-emits `subscription.loaded` with all current subscriptions. The modal renders a list of watchers, each showing: label (or event type if no label), filter summary, enabled/disabled toggle, edit (pencil) button, and delete (trash) button. If no watchers exist: "No watchers yet." In the Event Catalog's Events tab, configured events show a colored dot indicator.
- **Events**: `subscription.loaded`

### 3. Create a New Watcher

- **View/Service**: SubscriptionManagerModal or EventConfigModal → SubscriptionService
- **User Action**: Clicks "Add watcher", fills in the form:
  - **Event type** (required, editable in SubscriptionManagerModal, locked in EventConfigModal)
  - **Label** (optional human-readable name)
  - **Path pattern** (glob against full vault path, e.g. `Reports/**`)
  - **Extension** (file extension without dot, e.g. `csv`)
  - **Name pattern** (glob against filename only, e.g. `report-*.csv`)
  All filters use AND logic — every specified filter must match. Clicks "Create".
- **System Response**: Modal emits `subscription.create` with `{ eventType, label?, filters }`. SubscriptionService creates a new subscription with auto-generated ID (`sub_<uuid>`), `enabled: true`, ISO timestamp. State persisted to TypedStorage. Service emits `subscription.created`. Modal receives the event, updates its list, and navigates back to the list page.
- **Events**: `subscription.create` → `subscription.created`

### 4. Enable / Disable a Watcher

- **View/Service**: SubscriptionManagerModal, EventConfigModal, or EventDetailPanel
- **User Action**: Toggles the enabled/disabled switch on a watcher row
- **System Response**: Emits `subscription.update` with `{ subscriptionId, enabled: <new value> }`. SubscriptionService updates the subscription, persists state, emits `subscription.updated`. UI re-renders to reflect the new state. Disabled watchers are skipped during match evaluation.
- **Events**: `subscription.update` → `subscription.updated`

### 5. Edit a Watcher

- **View/Service**: SubscriptionManagerModal or EventConfigModal
- **User Action**: Clicks pencil icon on a watcher row, modifies fields (label, filters), clicks "Save"
- **System Response**: Modal emits `subscription.update` with `{ subscriptionId, label?, filters }`. Service updates, persists, emits `subscription.updated`. Modal navigates back to list.
- **Events**: `subscription.update` → `subscription.updated`

### 6. Delete a Watcher

- **View/Service**: SubscriptionManagerModal, EventConfigModal, or EventDetailPanel
- **User Action**: Clicks trash icon. In EventConfigModal: a confirmation dialog ("Delete watcher '<label>'?") appears first. In other locations: immediate deletion.
- **System Response**: Emits `subscription.remove` with `{ subscriptionId }`. Service deletes the subscription, persists state, emits `subscription.deleted`. The watcher disappears from all UIs.
- **Events**: `subscription.remove` → `subscription.deleted`

### 7. Watcher Match (Runtime)

- **View/Service**: SubscriptionService (wildcard listener)
- **User Action**: (none — automatic when any event fires)
- **System Response**: SubscriptionService registers a wildcard (`*`) listener on the EventBus. When any event fires:
  1. Guards: skip if event system is disabled, skip `subscription.*` and internal events
  2. For each enabled subscription: check if `eventType` matches
  3. Run `matchesFilters()` against the event payload:
     - `pathPattern`: glob match against `payload.path`
     - `extension`: exact match against file extension
     - `namePattern`: glob match against filename only
     - If payload has no `path` but a filter requires it, match fails
  4. On match: emit `subscription.matched` with `{ eventType, subscriptionId, subscriptionLabel?, timestamp }`
- **Events**: `subscription.matched`

### 8. Inbox Notification

- **View/Service**: InboxService
- **User Action**: (none — automatic)
- **System Response**: InboxService receives `subscription.matched` and calls `mapSubscriptionMatched()`. The mapper produces an InboxItem with type `"info"`, title "Watcher matched: <label|eventType>", source hub "subscription". The item is added to inbox state, persisted, and `inbox.itemAdded` is emitted. The User Hub Inbox shows the notification with a "Watcher" source badge.
- **Events**: `inbox.itemAdded`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Filter logic | AND (all specified must match) | AND |
| Empty filters | Match every event of the watched type | Match all |
| Master toggle | `eventSystemEnabled` setting | `true` |
| Delete confirmation | EventConfigModal prompts; others delete immediately | Varies by entry point |

## Events Sequence

```
[User creates watcher]
    → subscription.create → subscription.created → [UI updates]

[Runtime: any event fires]
    → SubscriptionService wildcard listener
    → matchesFilters() evaluation
    → subscription.matched
    → InboxService mapper
    → inbox.itemAdded → [User Hub Inbox re-renders]
```

## Filter Options

| Field | Matching | Placeholder | Empty = |
|-------|----------|-------------|---------|
| Path pattern | Glob vs full vault path | `Reports/**` | Match any path |
| Extension | Exact string, no dot | `csv` | Match any extension |
| Name pattern | Glob vs filename only | `report-*.csv` | Match any filename |

## Health Checks

The Event Catalog Health tab includes two watcher-related checks:
- **Event Coverage**: reports unconfigured events (no watcher or transform)
- **Subscription Health**: flags orphaned watchers referencing unknown event types

## Related Decisions

- Watchers are purely reactive — they fire only when matching events fire, no polling or scanning
- Match happens synchronously in the wildcard listener; `subscription.matched` is emitted fire-and-forget
- Watchers trigger inbox notifications only — no direct downstream automation (imports, exports, etc.)

## Related Use Cases

- [[Browse and Configure Events]] (per-event watcher configuration via EventConfigModal)
- [[Manage Inbox Notifications]] (watcher matches surface as inbox items)
- [[Capture Ideas and Feedback]] (capture events can be watched)
