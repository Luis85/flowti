---
type: ProductBacklogItem
feature: "[[Hubs PRD]]"
priority: high
phase: 3
dependencies:
  - "[[TD-49 Layout abstraction layer]]"
  - "[[TD-50 Workspace shell layout]]"
---

## User Story - Problemspace

As a knowledge worker using Flowti, I want a personal cockpit hub so that I can see my cross-domain activity, pending items, and documentation nudges in one place without navigating between multiple views.

### User Pains

- No aggregated view of activity across Event Catalog and Data Exchange Hub
- No inbox for actionable notifications (new events, failed imports, pending sessions)
- No "today" summary showing what changed or needs attention
- Must open multiple views to understand overall system state

### User Needs

- Single dashboard showing cross-hub KPIs (events, configs, docs, sessions)
- Inbox with filterable, actionable items
- Recent activity feed (last 24h/7d)
- Documentation nudges (undocumented domains, incomplete flows, stale docs)

## Solutionstatement

### Use Case

- Flow: User opens User Hub from ribbon → sees today's dashboard → checks inbox → acts on items
- Gherkin:
  ```gherkin
  Given the User Hub is open
  When events have been emitted in the last 24h
  Then the dashboard shows activity count and recent events summary
  And the inbox shows actionable items sorted by priority
  ```

### Functional Requirements

- [x] User Hub opens via ribbon icon or `flowti:open-hub:user` command
- [x] Dashboard tab uses `dashboard_grid` layout with:
  - Cross-hub summary cards (Event Catalog stats, Data Exchange stats)
  - Quick actions (Open Event Catalog, Open Data Exchange, New Product)
  - Always-visible inbox preview (latest 5 items with "View all" link)
- [x] Inbox tab uses `table` layout with:
  - Actionable items from 6 source events (subscription, import, export, pipeline)
  - Search/filter by title, source event badges
  - Click to navigate to relevant hub/tab via deep-linking
- [x] Preferences tab with:
  - User profile editing (display name)
  - Inbox source toggles (6 checkboxes synced with global settings)
- [~] Activity tab — *removed in increment 3, redundant with standalone EventLogView sidebar*

### Technical Requirements

- `UserHubAdapter extends HubAdapter` — aggregates data from EventBus listeners
- Inbox items derived from events: `dataExchange.import.failed`, `session.reminder`, etc.
- Activity feed derived from EventBus wildcard listener (like EventLogView but filtered)
- Cross-hub summary: reads other adapters' `getDashboardData()` via adapter registry

### Constraints

- Must not duplicate EventLogView — inbox is for actionable items, log is for debugging
- Activity feed must cap at 500 items (same as EventLogView) to prevent memory growth
- Dashboard refresh must be event-driven, not interval-based

## Acceptance Criteria

- [x] User Hub opens from ribbon and command palette — *increment 1: ribbon icon + flowti:open-user-hub command + ui.openUserHub event*
- [x] Dashboard shows cross-hub summary with real data — *increment 1: HubRegistry → provider.getSummary() with tabId deep-linking*
- [x] Inbox shows at least 2 types of actionable items — *increment 2→4: 6 source events (subscription.matched, import completed/failed, export completed, pipeline completed/failed)*
- [x] Activity feed shows recent events with search/filter — *increment 1: wildcard listener, 200-item cap, search, category badges (removed in increment 3 — redundant with EventLogView)*
- [x] All tabs render via Hub framework (shell + layout + adapter) — *increment 1: UserHubView extends BaseHubView*
- [x] User preferences panel with profile editing and inbox source toggles — *increment 4: UserHubPreferences component, multi-tab view (inbox + preferences), INBOX_SOURCE_DEFINITIONS shared constant*
- [x] `npm run build` passes — *1,786 tests across 79 suites, green pipeline*
