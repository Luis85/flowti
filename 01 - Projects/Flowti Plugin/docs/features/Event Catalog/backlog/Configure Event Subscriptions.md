---
type: UseCase
domain: Flowti
stage: done
description: "Click the settings icon on any event to open the Event Config Modal. From there, create subscriptions (file-pattern watchers) or event definitions (ingestion-to-domain mappings) without leaving the catalog."
view: "[[Event Catalog View]]"
feature: "[[Event Catalog]]"
testplanRef: "UC-58"
tags:
  - use-case
  - catalog
---

# Configure Event Subscriptions

## Summary

A user wants to create an event subscription that watches for file changes matching a specific pattern and triggers processing when the subscribed event fires. The Event Config Modal provides a centralized hub for subscription management directly from the catalog.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The Event Catalog View is open and the user can see events in the Events tab.
- The SubscriptionService is initialized and has loaded persisted subscriptions from the `subscriptions` storage key.

## Steps

1. **Locate the target event** — The user navigates to the Events tab and finds the event they want to subscribe to (e.g., `ingestion.job.completed`). The event's master list entry may already show a badge like "0 subs" indicating no active subscriptions.
2. **Open the Event Config Modal** — The user clicks the settings icon (settings-2) next to the event type name. The `EventConfigModal` opens as an Obsidian modal with three pages: Overview, Subscription Form, and Definition Form. The Overview page is shown first, displaying the event's metadata, existing subscriptions list, and existing definitions list.
3. **Review existing subscriptions** — On the Overview page, the user sees a list of any current subscriptions for this event type. Each entry shows the subscription's filter criteria (path pattern, extension, name pattern) and its enabled/disabled state. If none exist, the list is empty.
4. **Navigate to the Subscription Form** — The user clicks the "Add Subscription" button or navigates to the Subscription Form page. The form renders with the event type pre-filled and input fields for `SubscriptionFilter` properties: `pathPattern` (glob pattern for file paths), `extension` (file extension filter), and `namePattern` (filename pattern filter).
5. **Fill in subscription filters** — The user enters a `pathPattern` of `**/Projects/**` to match files in any Projects subfolder, sets `extension` to `md` to limit to markdown files, and optionally sets a `namePattern`. All filter fields use AND logic — a file must match all specified criteria to trigger the subscription.
6. **Save the subscription** — The user clicks the Save button. The modal emits a `subscription.create` event via the EventBus with the configured filter and event type. The SubscriptionService processes the command, persists the new subscription to the `subscriptions` storage key, and emits `subscription.created` in response.
7. **Verify in the catalog** — The modal's Overview page updates (via debounced `scheduleRender()` triggered by the `subscription.created` event listener) to show the new subscription in the list. Back in the Events tab, the event's badge now reads "1 sub" reflecting the active configuration.
8. **Test the subscription** — The user creates or modifies a markdown file matching the subscription's filter pattern. The SubscriptionService's wildcard listener detects the matching event, confirms the file matches the filter criteria (path, extension, name), and allows the event to propagate for downstream processing by the ingestion pipeline.

## Outcome

An event subscription is persisted and active. Files matching the configured filter pattern will trigger processing when the subscribed event fires. The catalog visually reflects the subscription count, and the Event Config Modal provides a single place to manage all subscriptions for any event.

## Variations

- **Disable a subscription**: The user opens the Event Config Modal, finds an existing subscription in the Overview list, and toggles it off. The `subscription.update` event is emitted with the enabled flag set to false. The subscription remains persisted but inactive.
- **Remove a subscription**: The user clicks the delete action on a subscription entry. A `subscription.remove` event is emitted, and the SubscriptionService deletes it from storage and emits `subscription.deleted`.
- **Multiple filters**: The user creates several subscriptions for the same event with different filter criteria, each targeting a different folder structure or file type.
- **Error handling**: If the save fails (e.g., invalid pattern), the modal's `.catch()` handler logs the error and the form remains open for correction.

## Related

- View: [[Event Catalog View]]
- Feature: [[Event Catalog]]
- Test: UC-58 in [[Testplan and Teststrategy]]
