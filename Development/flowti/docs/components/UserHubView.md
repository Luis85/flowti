---
type: Component
domain: Flowti
stage: done
description: "Personal cockpit view orchestrating dashboard, inbox, and activity components"
source: "[[Development/flowti/src/ui/UserHubView.ts|UserHubView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# UserHubView

## Description

UserHubView is the orchestrator for the User Hub, the personal cockpit of the Flowti plugin. It extends `BaseHubView<UserTab>` and provides a dashboard landing page plus 2 tabs: Inbox and Activity. The view owns the `UserHubState`, builds component dependencies, creates child components on open, and dispatches render calls to the active tab's component.

Registered under view type `flowti-user-hub` with the `home` icon. Accessible via ribbon icon, command palette (`flowti:open-user-hub`), or `ui.openUserHub` event.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `BaseHubView<UserTab>` | class | Provides shared hub layout: dashboard mode, tab bar, search, master/detail split |
| `IUserService` | interface | Retrieves the current user for the welcome greeting and top bar display |
| `HubRegistry` | class | Passed to dashboard for cross-hub summary aggregation |
| `IEventBus` | interface | Passed to all child components for event emission and capture |
| `UserHubDashboard` | class | Renders the dashboard landing page |
| `UserHubInbox` | class | Renders the inbox master/detail tab |
| `UserHubActivity` | class | Renders the activity master/detail tab and captures events |

## State

**Owns `UserHubState`:**
- `inboxItems: InboxItem[]` -- actionable items (empty in first increment)
- `activityLog: ActivityLogEntry[]` -- captured events (newest first, 200 cap)
- `selectedInboxItem: InboxItem | null` -- currently selected inbox item
- `selectedActivity: ActivityLogEntry | null` -- currently selected activity entry

State is exposed to child components via `UserHubComponentDeps.getState()` / `setState()`.

## Renders

- **Top bar**: User name with user icon (when user is set)
- **Dashboard mode**: Delegates to `UserHubDashboard.render()` — welcome greeting, hub summary cards, quick actions
- **Inbox tab**: Delegates to `UserHubInbox.renderMaster()` + `renderDetail()`
- **Activity tab**: Delegates to `UserHubActivity.renderMaster()` + `renderDetail()`
- **Tab definitions**: Inbox (inbox icon), Activity (activity icon) — each with search placeholder

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `*` (wildcard) | Listens (via Activity) | Captures all non-internal events for the activity feed |
| `ui.openEventCatalog` | Emits (via Dashboard) | Quick action to open Event Catalog |
| `ui.openDataExchangeHub` | Emits (via Dashboard) | Quick action to open Data Exchange Hub |
| `ui.openEventLog` | Emits (via Dashboard) | Quick action to open Activity Log |
| `ui.openSubscriptionManager` | Emits (via Dashboard) | Quick action to open Watchers |

## Related

- Children: [[UserHubDashboard]], [[UserHubInbox]], [[UserHubActivity]]
- Provider: [[UserHubProvider]] (exposes hub summary for other dashboards)
- Sibling views: [[EventCatalogView]], [[DataExchangeHubView]], [[EventLogView]]
