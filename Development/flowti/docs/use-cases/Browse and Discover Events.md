---
type: UseCase
domain: Flowti
stage: done
description: "Open the Events tab to see all registered events grouped by category. Use the search bar and filter chips to narrow down to a specific domain or tag. Select an event to inspect its description, payload shape, and related documentation."
view: "[[Event Catalog View]]"
feature: "[[Event Catalog]]"
testplanRef: "UC-56"
tags:
  - use-case
  - catalog
---

# Browse and Discover Events

## Summary

A user wants to explore the full registry of events available in the Flowti IBDE plugin, filtering by category, domain, or tag to locate a specific event and understand its payload shape and documentation links.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The Event Catalog View is available in the sidebar or can be opened via command palette.
- At least one event is registered in the catalog (built-in infrastructure events are always present).

## Steps

1. **Open the Event Catalog View** — The user clicks the Flowti leaf icon in the sidebar or runs the "Open Event Catalog" command from the command palette. The view opens showing the tab bar with Domains, Services, Events, Flows, Systems, Actors, and Products tabs.
2. **Navigate to the Events tab** — The user clicks the "Events" tab. The master panel renders all registered events grouped by category (Core, Lifecycle, User, Settings, Installer, Discovery, Filter, Notification, Subscription, Ingestion, Event Definition, Data Exchange). Each category heading shows a count of contained events.
3. **Review the filter bar** — Above the event list, the filter bar displays a search input field and filter chips. If `showSystemEvents` is disabled in settings, events tagged `["system"]` are hidden by default. A "System" toggle chip is visible to include or exclude system-tagged events.
4. **Type a search query** — The user types a partial event name (e.g., "subscription") into the search bar. The master list filters in real time to show only events whose type name or description matches the query. Categories with no matching events collapse or hide automatically.
5. **Toggle a filter chip** — The user clicks the "System" toggle chip to reveal system-tagged infrastructure events alongside domain events. The list updates immediately, and the chip visual state changes to indicate it is active.
6. **Select an event** — The user clicks on an event type name (e.g., `subscription.created`) in the master list. The detail panel on the right populates with the event's full metadata: description, payload shape, domain, service, category, and tags.
7. **Inspect configuration badges** — Below the event name in the master list, small badges indicate how many subscriptions and event definitions are configured for this event (e.g., "2 subs, 1 def"). The user notes which events already have active configurations.
8. **Review related documentation** — In the detail panel, the user scrolls to the "Related" section, which lists linked domain docs, service docs, and flow docs that reference this event. Clicking any link opens the corresponding markdown file in Obsidian.

## Outcome

The user has located the event they were looking for, understands its payload structure and purpose, and can see which domains, services, and flows reference it. They can proceed to configure subscriptions or definitions, or navigate to related documentation.

## Variations

- **Empty catalog**: If no custom events are registered and system events are hidden, the Events tab shows a placeholder message prompting the user to enable system events or create event definitions.
- **No search results**: If the search query matches no events, the master panel shows an empty state with a suggestion to broaden the search or clear filters.
- **Direct navigation from another tab**: The user clicks an event name in a Flow or System detail panel, which switches to the Events tab with that event pre-selected.

## Related

- View: [[Event Catalog View]]
- Feature: [[Event Catalog]]
- Test: UC-56 in [[Testplan]]
