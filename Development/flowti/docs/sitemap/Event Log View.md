---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
description: Real-time activity feed of system events
type: View
viewType: flowti-event-log
extends: ItemView
source: "[[Development/flowti/src/ui/EventLogView.ts|EventLogView.ts]]"
feature: "[[Event System]]"
---

# Event Log View

## Description

The Event Log View provides a real-time activity feed of events flowing through the system. It listens to the EventBus and displays events as they occur, with color-coded status dots (success, error, info, neutral) and enriched context summaries.

The view operates in two modes: **Subscribed** (default) shows only events the user opted into via bell toggles in the Event Catalog, and **All** shows every event from visible categories. A search bar filters the feed by event type or content.

Events from hidden categories (configured in catalog settings) never appear regardless of mode. The buffer is capped at 500 entries with oldest-first eviction.

## Use Cases

### Monitor live system activity
Open the Event Log to watch events as they happen. Status dots indicate success (green), error (red), info (blue), or neutral (gray). Useful for verifying that subscriptions, imports, exports, and ingestion jobs are running correctly.

### Focus on subscribed events
Use the default "Subscribed" mode to see only the events you care about. Subscribe to events via the Event Catalog's bell toggles, then monitor them in a clean, filtered feed.

### Debug event flow
Switch to "All" mode to see every event in the system. Use the search bar to filter by event type pattern. Expand an event entry to inspect its full payload. This is invaluable for understanding event ordering and diagnosing issues.

### Pause and inspect
Use the pause control to freeze the feed while you inspect entries. The buffer continues collecting events in the background. Resume to see accumulated events.

### Navigate to event documentation
Click an event type name to jump directly to its documentation in the Event Catalog. This bridges the gap between observing an event and understanding what it means.

### Review enriched context
Certain event types show context summaries: subscription matches show the watcher label, ingestion completions show the file path, failures show the error message, and definition matches show the emitted domain event name.
