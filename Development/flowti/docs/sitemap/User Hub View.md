---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
  - homepage
description: Personal cockpit aggregating cross-hub summaries, inbox, and activity feed
type: View
viewType: flowti-user-hub
extends: BaseHubView
source: "[[Development/flowti/src/ui/UserHubView.ts|UserHubView.ts]]"
feature: "[[Hubs]]"
---

# User Hub View

## Description

The User Hub is the personal cockpit for the Flowti plugin. It extends `BaseHubView` and provides a unified workspace with 3 sections: **Dashboard** (cross-hub summary cards), **Inbox** (actionable items), and **Activity** (live event feed).

The Dashboard aggregates stats from all registered hub providers via `HubRegistry.getAll()`, rendering clickable stat cards that deep-link to specific tabs in target hubs (e.g., clicking "Events: 42" opens the Event Catalog on the Events tab). Quick-action buttons provide shortcuts to frequently used views.

The Inbox tab is a placeholder in this first increment — future versions will populate it with subscription notifications, import/export results, and other actionable events. The Activity tab captures all non-internal events via a wildcard listener (capped at 200 entries) and displays them with category badges, status dots, and JSON payload inspection.

## Use Cases

### Get a cross-hub overview
Open the User Hub to see summary stat cards from all registered hubs (Event Catalog, Data Exchange Hub) in one place. Each card shows a key metric and clicks through directly to the relevant tab, bypassing the hub's dashboard.

### Monitor live system activity
Switch to the Activity tab to watch events as they flow through the system. Each entry shows the event type, category badge, status dot (success/error/info/neutral), and timestamp. Click an entry to inspect its full JSON payload in the detail panel.

### Navigate to other hubs quickly
Use the Quick Actions section on the dashboard to jump directly to the Event Catalog, Data Exchange Hub, Activity Log, or Watchers modal without going through the command palette.

### Track actionable items (future)
The Inbox tab will surface actionable items from watchers, imports, and exports. Unread items appear bold, and selecting an item shows its detail with type badge (Action Required / Information) and description.

### Identify yourself
The top bar shows the current user's name (from UserService), and the dashboard greets the user by name. When no user is set, a generic "Welcome to Flowti" greeting is shown.

## Technical Notes

- Registered under view type `flowti-user-hub` with the `home` icon
- Accessible via ribbon icon, command palette (`flowti:open-user-hub`), or `ui.openUserHub` event
- Activity wildcard listener is view-scoped: registers on `onHubOpen()`, unsubscribes on close via `addUnsubscribe()`
- Dashboard self-filters: the User Hub's own provider is excluded from the hub summary cards
- Stat cards include optional `tabId` for deep-linking via `HubRegistry.openHub(hubId, tabId)`
