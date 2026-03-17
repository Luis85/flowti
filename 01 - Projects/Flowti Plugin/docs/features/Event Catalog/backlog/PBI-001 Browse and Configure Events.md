---
type: ProductBacklogItem
feature: "[[Event Catalog PRD]]"
priority: high
stage: done
userStories: []
useCases:
  - "[[Browse and Discover Events]]"
  - "[[Configure Event Subscriptions]]"
  - "[[Configure Event Definitions]]"
---

## User Story

As an event-driven knowledge worker, I want to browse all registered events, filter by category or tag, and configure subscriptions and definitions directly from the catalog so that I can discover, understand, and wire up event-driven behaviour without leaving a single view.

## Functional Requirements

- [x] Events tab renders all registered events grouped by category with counts
- [x] Search bar filters events in real time by type name or description
- [x] "System" toggle chip shows/hides system-tagged infrastructure events
- [x] Clicking an event type name opens the detail panel with description, payload shape, domain, service, category, and tags
- [x] Configuration badges ("N subs, M defs") display on each event entry
- [x] Detail panel shows Related Flows, Systems, and Actors sections (auto-hidden when empty)
- [x] Settings icon (settings-2) opens EventConfigModal with Overview, Subscription Form, and Definition Form pages
- [x] Subscription Form: pre-filled event type, filter fields (pathPattern, extension, namePattern) with AND logic
- [x] Subscription CRUD via `subscription.create/update/remove` events with persistence to `subscriptions` storage key
- [x] Definition Form: pre-filled sourceEventType, filePattern glob, domainEventName, payload mappings repeater, emission policy selector
- [x] Definition CRUD via `eventDefinition.create/update/remove` events with persistence to `eventDefinition` storage key
- [x] Catalog updates badge counts in real time via debounced `scheduleRender()` on subscription/definition change events
- [x] `showSystemEvents` setting persisted via `settings.updateShowSystemEvents` event

## Acceptance Criteria

- [x] Events tab displays all catalog events grouped by category; search narrows the list
- [x] EventConfigModal opens from any event and allows creating, editing, and deleting subscriptions
- [x] EventConfigModal allows creating, editing, and deleting event definitions with payload mappings
- [x] Badge counts on event entries update immediately after subscription or definition changes
- [x] `npm run build` passes
