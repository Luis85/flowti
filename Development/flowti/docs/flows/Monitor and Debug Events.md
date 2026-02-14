---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey for monitoring live events, subscribing to specific event types, and debugging event payloads in the Event Log
domains:
  - Subscription
  - Settings
services:
  - SubscriptionService
  - SettingsService
events:
  - eventNotify.changed
  - subscription.created
tags:
  - monitoring
---

# Monitor and Debug Events

## Overview

Flowti's EventBus-driven architecture makes every system action observable. This journey covers the full monitoring workflow: subscribing to events of interest in the catalog, opening the Event Log to watch them fire in real-time, filtering and searching the stream, pausing to inspect payloads, and navigating from a logged event back to its catalog documentation.

## Trigger

User wants to observe system behavior in real-time, debug an event flow, or verify that specific events fire correctly after a configuration change.

## Steps

### 1. Open Event Catalog

- **View/Service**: EventCatalogView
- **User Action**: User opens the Event Catalog from the sidebar or command palette
- **System Response**: Catalog loads with Dashboard tab showing stats overview, including subscription and definition counts
- **Events**: (none — UI render)

### 2. Navigate to Events Tab

- **View/Service**: EventCatalogView (EventsTab)
- **User Action**: User clicks the "Events" tab in the catalog tab bar
- **System Response**: Events tab renders the master list of all registered events, grouped by category. Each entry shows config count badges (e.g., "2 subs, 1 def") and a bell icon indicating subscription state
- **Events**: (none — UI render)

### 3. Subscribe to Events of Interest

- **View/Service**: EventsTab
- **User Action**: User clicks the bell icon next to one or more events they want to monitor (e.g., `ingestion.job.completed`, `settings.changed`)
- **System Response**: SubscriptionService receives the create command, persists the subscription, and emits confirmation. The bell icon toggles to filled state. A notification badge appears on the event entry
- **Events**: `subscription.create` → `subscription.created`

### 4. Open Event Log

- **View/Service**: EventLogView
- **User Action**: User opens the Event Log view from the sidebar or command palette
- **System Response**: Event Log opens in "Subscribed" mode by default, showing only events matching active subscriptions. The feed begins streaming live events as they occur
- **Events**: `eventNotify.changed`

### 5. Switch to All Events Mode

- **View/Service**: EventLogView
- **User Action**: User clicks the mode toggle to switch from "Subscribed" to "All" for full debugging visibility
- **System Response**: Feed expands to show every event flowing through the EventBus (except `log.*` events, which are filtered to prevent infinite recursion). Event volume increases significantly
- **Events**: (none — UI state change)

### 6. Filter and Search Events

- **View/Service**: EventLogView
- **User Action**: User types a search pattern into the filter bar (e.g., `ingestion.*` or `settings`)
- **System Response**: The event stream filters in real-time, showing only events whose type matches the search pattern. Matching portion is highlighted in the event type label
- **Events**: (none — UI filter)

### 7. Pause Feed and Inspect Payload

- **View/Service**: EventLogView
- **User Action**: User clicks the pause button to freeze the feed, then expands a specific event entry
- **System Response**: Feed stops auto-scrolling and no new entries appear while paused. The expanded entry reveals the full event payload as formatted JSON, including timestamp, source, and all data fields
- **Events**: (none — UI state change)

### 8. Navigate to Event Documentation

- **View/Service**: EventLogView → EventCatalogView
- **User Action**: User clicks the event type name in the expanded log entry
- **System Response**: Navigation jumps to the Event Catalog, opening the Events tab with the clicked event pre-selected in the detail panel. The detail panel shows the event's catalog metadata, subscriptions, definitions, and cross-references
- **Events**: (none — UI navigation)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Feed mode | Subscribed (filtered) / All (full stream) | Subscribed |
| Search filter pattern | Glob pattern, partial match, or exact type | Empty (show all) |
| Feed state | Running / Paused | Running |
| Event expansion | Collapsed (type + timestamp) / Expanded (full payload) | Collapsed |
| Subscription scope | Individual events / Category-wide | Individual |

## Events Sequence

```
subscription.create → subscription.created → eventNotify.changed → (live stream) → (pause) → (inspect) → (navigate)
```

## Related Use Cases

- [[Monitor Live Activity]]
- [[Focus on Subscribed Events]]
- [[Debug Event Flow]]
- [[Pause and Inspect Events]]
