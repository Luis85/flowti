---
type: ProductBacklogItem
feature: "[[Event System PRD]]"
priority: high
stage: done
userStories:
  - "[[As User, I want to select events to get notified about so that I can react to them accordingly]]"
useCases:
  - "[[Focus on Subscribed Events]]"
  - "[[Monitor Live Activity]]"
  - "[[Pause and Inspect Events]]"
  - "[[Debug Event Flow]]"
---

## User Story

As a knowledge worker using Flowti, I want to subscribe to specific event types and monitor them in a live feed so that I can focus on events relevant to my workflow, observe system health in real time, and debug issues by inspecting event payloads and ordering.

## Functional Requirements

- [x] Bell toggle on each Event Catalog entry to subscribe/unsubscribe to event types
- [x] Subscription persistence via `subscriptions` storage key with CRUD through `subscription.create/update/remove` events
- [x] SubscriptionFilter with optional `pathPattern`, `extension`, `namePattern` fields (AND logic)
- [x] Event Log View opens via command palette or ribbon icon
- [x] Event Log default mode "Subscribed" shows only subscribed event types
- [x] "All" mode shows every event in the system including system-level and lifecycle events
- [x] Color-coded status dots: green (success), red (error), blue (info), gray (neutral)
- [x] Search bar filters events by type name pattern in real time
- [x] Pause button freezes the feed; events buffer in background; resume replays buffered events chronologically
- [x] Click to expand individual event entries and inspect full payloads
- [x] Subscription changes take effect immediately in the Event Log feed
- [x] Feed capped at 500 entries to prevent memory growth

## Acceptance Criteria

- [x] User can subscribe to event types via bell toggles in the Event Catalog
- [x] Subscribed mode displays only subscribed events; All mode displays everything
- [x] Pausing the feed preserves all events and resumes without data loss
- [x] Search narrows the event feed by type pattern
- [x] Expanding an entry shows the full event payload for debugging
- [x] `npm run build` passes
