---
type: UseCase
domain: Flowti
stage: done
description: "Click an event type name in the log to jump to its documentation in the Event Catalog"
view: "[[Event Log View]]"
feature: "[[Event System]]"
testplanRef: "UC-68"
tags:
  - use-case
  - log
---

# Navigate to Event Documentation

## Summary

Click on an event type name in the Event Log to navigate directly to its documentation entry in the Event Catalog. This bridges the gap between observing a live event and understanding its purpose, payload schema, and related configuration.

## Preconditions

- The Flowti plugin is installed and enabled in Obsidian.
- The Event Log View is open and displaying at least one event entry.
- The Event Catalog contains documentation for the event types in the log (built-in events are always documented).

## Steps

1. Open the **Event Log View** and locate an event entry whose type you want to learn more about.
2. Identify the **event type name** displayed in the entry (e.g., `dataExchange.import.completed` or `subscription.created`).
3. Click directly on the **event type name** text. It is styled as a clickable link.
4. The view navigates to the **Event Catalog** and automatically scrolls to or selects the corresponding event type's detail panel.
5. Review the event's documentation: description, payload schema, domain, category, and any configured subscriptions or definitions.
6. Optionally, use the Event Catalog's configuration hub to create a subscription or event definition for this event type.
7. Return to the Event Log View using Obsidian's navigation (back button or leaf switching) to continue monitoring.

## Outcome

The user has navigated from a live event observation to its full documentation, gaining understanding of the event's purpose and the ability to configure subscriptions or definitions for it.

## Variations

- **Undocumented event**: If the event type is a custom or dynamically emitted event not in the catalog, the navigation may open the catalog without a matching entry. The user can then create documentation for it.
- **Multiple log entries of the same type**: Clicking any instance of the same event type navigates to the same catalog entry. The user only needs to click once to find the documentation.
- **System events hidden**: If the event is tagged as a system event and "Show System Events" is disabled in settings, the catalog navigation will still locate the entry but it may be hidden by the filter. The user can toggle the "System" chip to reveal it.

## Related

- View: [[Event Log View]]
- Feature: [[Event System]]
- Test: UC-68 in [[Testplan and Teststrategy]]
