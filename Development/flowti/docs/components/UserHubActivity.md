---
type: Component
domain: Flowti
stage: done
description: "EventLogView-lite activity feed with wildcard event capture, category badges, and JSON payload inspection"
source: "[[Development/flowti/src/ui/userHub/UserHubActivity.ts|UserHubActivity.ts]]"
parent: "[[UserHubView]]"
tags:
  - hub
  - component
---

# UserHubActivity

## Description

UserHubActivity renders the Activity tab of the User Hub as an EventLogView-lite component. It captures all non-internal events via a wildcard listener on the EventBus, stores them in a 200-entry buffer (newest first, oldest evicted on overflow), and displays them in a master-detail split layout.

The wildcard listener is view-scoped: it registers when the User Hub opens (`startCapture()` returns an unsubscribe function) and unsubscribes when the view closes. Internal events are filtered via `isSkippedEvent()` (skips `log.*`, `error.*`, `plugin.*`, etc.).

Each captured event is enriched with its catalog category (via `getEventCategory()`) and description (via `getEventEntry()`). The master panel shows status dots, event types, category badges, and timestamps. The detail panel shows the event header, description, and a formatted JSON payload.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `UserHubComponentDeps` | interface | Provides `getState()`, `setState()`, `eventBus`, `scheduleRender()` |
| `getEventCategory` | function | Resolves the catalog category for an event type |
| `getEventEntry` | function | Retrieves the full catalog entry for description enrichment |
| `isSkippedEvent` | function | Filters out internal event prefixes (`log.*`, `error.*`, `plugin.*`) |
| `getStatusClass` | function | Maps event types to status dot colors (success, error, info, neutral) |
| `setIcon` | obsidian | Renders icons in the empty state |

## State

**Reads via `deps.getState()`:**
- `activityLog` -- array of `ActivityLogEntry` objects (newest first)
- `selectedActivity` -- currently selected entry for detail view

**Writes via `deps.setState()`:**
- `activityLog` -- appended to when new events are captured (capped at 200)
- `selectedActivity` -- set when an entry row is clicked

## Renders

**Master panel:**
- Each entry row shows: status dot (color-coded), event type, category badge (muted), timestamp (right-aligned)
- Active row highlighted with `ft-catalog-row-active`
- Filter applied on event type and category (case-insensitive substring match)
- Clicking a row sets `selectedActivity` and triggers `scheduleRender()`

**Detail panel (entry selected):**
- Header with event type as heading
- Meta row: category badge + timestamp
- Description paragraph (from catalog entry, omitted when empty)
- Payload section: `<pre>` block with pretty-printed JSON (`JSON.stringify(payload, null, 2)`), scrollable with 300px max height

**Empty states:**
- Master: activity icon (48px), "No activity yet", descriptive subtext
- Detail: activity icon, "Select an event to view details"

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `*` (wildcard) | Listens | Captures all non-internal events into the activity log buffer |

## Related

- Parent: [[UserHubView]]
- Siblings: [[UserHubDashboard]], [[UserHubInbox]]
- Pattern source: [[EventLogView]] (full-featured version with 500-entry buffer, pause, and subscribed/all modes)
