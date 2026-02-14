---
type: Component
domain: Flowti
stage: done
description: "Real-time activity log view showing event feed with follow/all modes, filtering, and payload inspection"
source: "[[Development/flowti/src/ui/EventLogView.ts|EventLogView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# EventLogView

## Description

EventLogView is the real-time activity log for the Flowti event system. It extends Obsidian's `ItemView` and renders a chronological feed of events as they flow through the EventBus. It supports two modes: "Followed" (showing only events the user opted into via bell toggles in the Event Catalog) and "All" (showing all visible-category events for debugging). Events from hidden categories are never captured.

The view is registered under the type `flowti-event-log` and displays as "Activity Log" with the `activity` icon. It typically opens in the right sidebar leaf, triggered from the Event Catalog's Activity Log link.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Wildcard subscription to capture all events; subscribe to filter/notify/settings changes |
| `ViewStateProvider` | interface | Access live settings, excluded types, and notified types on open |
| `getEventCategory` | function | Resolve an event type string to its catalog category |
| `getEventEntry` | function | Look up catalog metadata for an event type |
| `isSkippedEvent` | function | Check if an event should be excluded from logging (e.g., `log.*`) |
| `openOrCreateEventDoc` | function | Open or create a documentation note for an event |
| `resolveEntityPath` | function | Resolve the events folder path from settings |

## State

The view manages a rolling event buffer and filter state:

- **`events`**: Array of `LoggedEvent` objects (max 500 entries, newest first)
- **`mode`**: Display mode (`"subscribed"` for followed events, `"all"` for everything)
- **`paused`**: Whether event capture is paused
- **`activeFilter`**: Text filter applied to event type and description
- **`excludedTypes`**: Set of event types excluded via catalog filters
- **`notifiedTypes`**: Set of event types the user follows (bell toggle)
- **`hiddenCategories`**: Set of category names hidden in catalog settings
- **`docsRootPath`** / **`entityPaths`**: Documentation folder configuration

Each `LoggedEvent` contains: `type`, `category`, `description`, `payload`, and `timestamp`.

## Renders

- **Header**: "Activity Log" title with event count badge
- **Toolbar**:
  - Text filter input
  - Mode toggle group: "Followed" / "All" buttons
  - Pause/resume button (toggles between pause and play icons)
  - Clear button (trash icon, empties the event buffer)
- **Event list**: Scrollable feed of event rows, each containing:
  - Status dot (color-coded: success for `.completed`/`.created`, error for `.failed`, info for `.started`/`.queued`, neutral for others)
  - Timestamp (absolute and relative time)
  - Category badge
  - Event type (clickable to copy to clipboard)
  - Description text
  - Actions: bell indicator (in "all" mode for followed events), doc link icon, expand/collapse payload toggle
  - Context line for enriched events (subscription matches, ingestion files, definition emissions)
- **Empty states**: Mode-aware messages ("No followed events yet", "Waiting for events...")
- **Incremental rendering**: New events are prepended with fade-in animation without full re-render

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `*` (wildcard) | Listens | Capture all events for the activity feed (filtered by exclusions and hidden categories) |
| `eventFilter.loaded` | Listens | Initialize excluded types set |
| `eventFilter.changed` | Listens | Update excluded types set |
| `eventNotify.loaded` | Listens | Initialize notified/followed types set |
| `eventNotify.changed` | Listens | Update notified/followed types set |
| `settings.loaded` | Listens | Update docs root path, entity paths, and hidden categories |
| `settings.changed` | Listens | Update docs root path, entity paths, and hidden categories |

## Related

- Opened from: [[EventCatalogView]]
- Uses: [[EventCatalogEntry]] metadata for doc links and descriptions
