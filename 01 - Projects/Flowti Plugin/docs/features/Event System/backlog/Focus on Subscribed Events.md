---
type: UseCase
domain: Flowti
stage: done
description: "Filter the Event Log to show only subscribed events for a focused monitoring experience"
view: "[[Event Log View]]"
feature: "[[Event System PRD]]"
testplanRef: "UC-65"
tags:
  - use-case
  - log
---

# Focus on Subscribed Events

## Summary

Use the Event Log's default "Subscribed" mode to see only the events the user has explicitly opted into. This keeps the feed clean and relevant by hiding the noise of system-level events the user does not need to monitor.

## Preconditions

- The Flowti plugin is installed and enabled in Obsidian.
- The user has subscribed to at least one event type via the Event Catalog's bell toggles.
- The Event Log View is open or ready to be opened.

## Steps

1. Open the **Event Catalog** view and locate the event types relevant to the user's workflow (e.g., `dataExchange.import.completed`, `ingestion.job.completed`).
2. Click the **bell toggle** next to each desired event type to subscribe. A filled bell icon confirms the subscription is active.
3. Close or switch away from the Event Catalog and open the **Event Log View**.
4. Confirm the mode selector at the top of the feed is set to **"Subscribed"** (this is the default).
5. Trigger actions that produce both subscribed and non-subscribed events (e.g., run an import while files are also being ingested).
6. Observe that only the subscribed event types appear in the feed; unsubscribed events are filtered out.
7. Optionally, return to the Event Catalog and toggle additional subscriptions on or off. The Event Log feed updates to reflect the new subscription set immediately.

## Outcome

The Event Log displays a focused feed containing only the event types the user has subscribed to, providing a clean and relevant monitoring experience without system noise.

## Variations

- **No subscriptions active**: If no events are subscribed, the Subscribed mode feed will be empty. The view should display a hint directing the user to the Event Catalog to create subscriptions.
- **Adding subscriptions mid-session**: Newly subscribed events begin appearing in the feed immediately; previously fired events of that type are not backfilled.
- **Switching to All mode**: The user can temporarily switch to "All" mode to see unsubscribed events without losing their subscription configuration.

## Related

- View: [[Event Log View]]
- Feature: [[Event System PRD]]
- Test: UC-65 in [[Testplan and Teststrategy]]
