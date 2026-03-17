---
type: UseCase
domain: Flowti
stage: done
description: "Watch events in real time with color-coded status indicators to verify system health"
view: "[[Event Log View]]"
feature: "[[Event System PRD]]"
testplanRef: "UC-64"
tags:
  - use-case
  - log
---

# Monitor Live Activity

## Summary

Open the Event Log to observe events as they fire in real time. Color-coded status dots provide immediate visual feedback on whether operations are succeeding, failing, or simply informational, making it easy to confirm that the system is behaving as expected.

## Preconditions

- The Flowti plugin is installed and enabled in Obsidian.
- At least one event-producing feature is active (e.g., a subscription, an import job, or an ingestion watcher).

## Steps

1. Open the command palette and run **Flowti: Open Event Log** (or click the Event Log icon in the ribbon).
2. The Event Log View opens in a leaf pane, displaying a live feed of events.
3. Trigger an action that produces events (e.g., save a file in a watched folder, run a CSV import, or toggle a subscription).
4. Observe new event entries appearing at the top of the feed within moments.
5. Note the colored status dot next to each entry: **green** for success, **red** for error, **blue** for informational, and **gray** for neutral/unclassified events.
6. Hover over a status dot to see a tooltip describing the event's status category.
7. Confirm that the events you expected to see are present and that no unexpected errors (red dots) appear.

## Outcome

The user has a live, color-coded view of system activity confirming that subscriptions, imports, exports, and ingestion jobs are executing as expected without errors.

## Variations

- **High-frequency events**: When many events fire rapidly (e.g., during a bulk import), the feed scrolls quickly. The user may want to pause the feed (see UC-67) to catch up.
- **No events appearing**: If the feed stays empty, verify that the correct mode is selected (Subscribed vs. All) and that at least one subscription or watcher is active.
- **Error investigation**: If red dots appear, expand the event entry to inspect the error payload and then navigate to the event documentation for remediation guidance.

## Related

- View: [[Event Log View]]
- Feature: [[Event System PRD]]
- Test: UC-64 in [[Testplan and Teststrategy]]
