---
type: UseCase
domain: Flowti
stage: done
description: Use the Health tab to identify events without subscriptions or definitions, then navigate to each event to configure monitoring or transformation rules.
view: "[[Event Catalog View]]"
feature: "[[Vault Health Dashboard PRD]]"
testplanRef: UC-96
tags:
  - use-case
  - catalog
  - health
---

# Improve Event Coverage

## Summary

A user wants to ensure that important events in their catalog are being monitored or processed. They use the Health tab to find events that have no subscriptions or definitions configured, then navigate to each event to set up the appropriate configuration.

## Preconditions

- The Health tab shows a non-passing Event Coverage check.
- At least one event in the catalog has no subscription or definition.

## Steps

1. **Open the Health tab** — The user navigates to the Health tab in the Event Catalog.
2. **Select "Event Coverage"** — The user clicks the Event Coverage check row in the Coverage category group. The detail panel shows the coverage ratio (e.g., "12 / 45 events have subscriptions or definitions") and lists all uncovered events.
3. **Review uncovered events** — Each item shows the event type name (e.g., `file.modified`) and the reason "No subscription or definition configured."
4. **Navigate to an event** — The user clicks an event name (e.g., `file.modified`). The view navigates to the Events tab with that event selected in the detail panel.
5. **Configure a subscription** — In the event detail panel, the user clicks the config icon or uses the EventConfigModal to create a subscription for the event. This makes the event appear in the Event Log when it fires.
6. **Return and verify** — The user returns to the Health tab. The Event Coverage score has improved, and the configured event no longer appears in the uncovered list.
7. **Assess remaining events** — The user reviews the remaining uncovered events and decides which are worth monitoring. Not all events need coverage — system infrastructure events may be intentionally left unconfigured.

## Outcome

The user has reviewed all uncovered events and configured subscriptions or definitions for the ones they care about. The Event Coverage check score reflects their intentional coverage decisions.

## Variations

- **System events excluded**: When `showSystemEvents` is disabled, system-tagged infrastructure events are excluded from the coverage check. This means the score reflects only user-facing domain events.
- **Definition instead of subscription**: Instead of subscribing, the user may configure an Event Definition that maps the source event to a custom domain event. This also counts as coverage.
- **Subscription health issues**: If a subscription references a non-existent event, the Subscription & Definition Health check will flag it separately.

## Related

- View: [[Event Catalog View]]
- Feature: [[Vault Health Dashboard]]
- Test: UC-96 in [[Testplan and Teststrategy]]
