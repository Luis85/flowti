---
type: Flow
domain: Flowti
stage: done
description: "End-to-end journey from creating an Event markdown file in the vault through discovery, catalog appearance, and subscription configuration"
domains:
  - Discovery
  - Subscription
services:
  - EventBridge
  - SubscriptionService
events:
  - event.file.triggered
  - discovery.loaded
  - subscription.create
  - subscription.created
tags:
  - flow
  - discovery
---

# Discover Custom Events

## Overview

Flowti supports a file-driven approach to event registration: users can create Markdown files with `type: Event` frontmatter anywhere in the vault, and the discovery system automatically detects them and adds them to the Event Catalog. This journey covers the full lifecycle from file creation through discovery, catalog integration, and subscription setup.

## Trigger

User wants to define a custom event type that represents a meaningful business action in their system, and have it appear in the Event Catalog for monitoring and subscription.

## Steps

### 1. Create Event Markdown File

- **View/Service**: Obsidian editor
- **User Action**: User creates a new `.md` file in the vault (e.g., `03 - Resources/Documentation/Reference/Events/order.placed.md`) and adds frontmatter with `type: Event`, a `name` field (e.g., `order.placed`), and optional metadata like `description`, `domain`, `category`
- **System Response**: Obsidian's vault API fires a file creation event. The file is written to disk and the vault index begins updating
- **Events**: `vault.create`

### 2. EventBridge Detects File Creation

- **View/Service**: EventBridge
- **User Action**: (automatic — no user action)
- **System Response**: EventBridge is the sole contact point with the Obsidian API. It detects the new file creation via the vault event listener. The file path is added to the pending-set for deferred detection — this is because `vault.create` fires before `metadataCache` has indexed the frontmatter, so immediate frontmatter reading would fail
- **Events**: (internal — pending-set population)

### 3. Metadata Indexing and Deferred Detection

- **View/Service**: EventBridge (metadataCache listener)
- **User Action**: (automatic — no user action)
- **System Response**: When Obsidian's `metadataCache` finishes indexing the new file (the `metadata.changed` event fires), EventBridge checks its pending-set. It finds the file, reads the now-available frontmatter, and confirms the `type: Event` designation. The event name is derived from the frontmatter `name` field if present, or falls back to the file's basename (without extension)
- **Events**: `metadata.changed`

### 4. Discovery Event Emitted

- **View/Service**: EventBridge → EventBus
- **User Action**: (automatic — no user action)
- **System Response**: EventBridge emits `event.file.triggered` with the derived event name, file path, and any frontmatter metadata (description, domain, category). The discovery system processes this event and updates its internal registry of known file-based events
- **Events**: `event.file.triggered`

### 5. Catalog Updates with New Event

- **View/Service**: EventCatalogView (EventsTab)
- **User Action**: User opens or refreshes the Event Catalog
- **System Response**: The Events tab re-renders, incorporating discovery state. The new custom event appears in the master list under its assigned category. If no category was specified in frontmatter, it appears under a default grouping. The event entry shows it is file-backed (has a documentation file) and displays any configured subscriptions or definitions
- **Events**: `discovery.loaded`

### 6. View Event Details

- **View/Service**: EventsTab (detail panel)
- **User Action**: User clicks the new custom event in the master list
- **System Response**: The detail panel renders the event's metadata: name, description, domain, category, source file path, and any existing subscriptions or event definitions. Cross-reference sections show Related Flows, Systems, and Actors that reference this event type
- **Events**: (none — UI render)

### 7. Configure Subscription

- **View/Service**: EventConfigModal (opened from EventsTab)
- **User Action**: User clicks the settings icon on the event entry or the "Add Subscription" action in the detail panel. In the EventConfigModal, the event type is pre-filled. User configures optional filters (pathPattern, extension, namePattern) and enables the subscription
- **System Response**: SubscriptionService receives the create command, validates the subscription filter configuration, persists it to storage, and emits confirmation. The subscription is immediately active — the wildcard listener will match incoming events of this type against the filter criteria
- **Events**: `subscription.create` → `subscription.created`

### 8. Verify Subscription is Active

- **View/Service**: EventsTab / EventLogView
- **User Action**: User returns to the Events tab or opens the Event Log
- **System Response**: The Events tab shows the updated config badge (e.g., "1 sub") next to the custom event. In the Event Log, when events matching this type fire, they appear in the "Subscribed" feed with the subscription's filter applied
- **Events**: (none — UI render)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Event naming | Explicit `name` frontmatter field / Derived from filename | Filename-derived |
| Event category | Specified in frontmatter / Default grouping | Default |
| Event domain | Specified in frontmatter / Uncategorized | Uncategorized |
| Subscription filters | pathPattern, extension, namePattern (AND logic) | No filters (match all) |
| File location | Anywhere in vault / Documentation root Events folder | Documentation root |

## Events Sequence

```
vault.create → metadata.changed → event.file.triggered → discovery.loaded → subscription.create → subscription.created
```

## Related Use Cases

- [[Browse and Discover Events]]
- [[Configure Event Subscriptions]]
