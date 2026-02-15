---
type: Component
domain: Flowti
stage: done
description: "Personal cockpit view orchestrating dashboard and inbox components"
source: "[[Development/flowti/src/ui/UserHubView.ts|UserHubView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# UserHubView

## Description

UserHubView is the orchestrator for the User Hub, the personal cockpit of the Flowti plugin. It extends `BaseHubView<"inbox">` and provides a dashboard landing page plus a single Inbox tab. The view owns the `UserHubState`, builds component dependencies, creates child components on open, and dispatches render calls to the inbox component.

Registered under view type `flowti-user-hub` with the `home` icon. Accessible via ribbon icon, command palette (`flowti:open-user-hub`), or `ui.openUserHub` event.

The Activity tab was removed in favour of the standalone `EventLogView` sidebar — users access the live event feed via the "Activity Log" quick action on the dashboard or the command palette.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `BaseHubView<"inbox">` | class | Provides shared hub layout: dashboard mode, tab bar, search, master/detail split |
| `IUserService` | interface | Retrieves the current user for the welcome greeting and top bar display |
| `HubRegistry` | class | Passed to dashboard for cross-hub summary aggregation |
| `InboxService` | class | Provides inbox state, mark-read, dismiss, clear-all |
| `IEventBus` | interface | Passed to child components for event emission; subscribes to inbox events for re-render |
| `UserHubDashboard` | class | Renders the dashboard landing page (includes always-visible inbox section) |
| `UserHubInbox` | class | Renders the inbox master/detail tab |

## State

**Owns `UserHubState`:**
- `inboxItems: InboxItem[]` — actionable items from domain events (newest first)
- `selectedInboxItem: InboxItem | null` — currently selected inbox item for detail view

State is exposed to child components via `UserHubComponentDeps.getState()` / `setState()`.

## Renders

- **Top bar**: User name with user icon (when user is set)
- **Dashboard mode**: Delegates to `UserHubDashboard.render()` — welcome greeting, hub summary cards, always-visible inbox section, quick actions
- **Inbox tab**: Delegates to `UserHubInbox.renderMaster()` + `renderDetail()`
- **Tab definitions**: Single tab — Inbox (inbox icon, "Search inbox..." placeholder)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `inbox.itemAdded` | Listens | Re-renders when new inbox item arrives |
| `inbox.itemsChanged` | Listens | Re-renders and clears selection when items change (mark-read, dismiss, clear-all) |
| `ui.openEventCatalog` | Emits (via Dashboard) | Quick action to open Event Catalog |
| `ui.openDataExchangeHub` | Emits (via Dashboard) | Quick action to open Data Exchange Hub |
| `ui.openEventLog` | Emits (via Dashboard) | Quick action to open Activity Log sidebar |
| `ui.openSubscriptionManager` | Emits (via Dashboard) | Quick action to open Watchers |

## Related

- Children: [[UserHubDashboard]], [[UserHubInbox]]
- Provider: [[UserHubProvider]] (exposes hub summary for other dashboards)
- Sibling views: [[EventCatalogView]], [[DataExchangeHubView]], [[EventLogView]]
