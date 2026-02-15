---
type: ProductBacklogItemTemplate
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

- [ ] User Hub opens via ribbon icon or `flowti:open-hub:user` command
- [ ] Dashboard tab uses `dashboard_grid` layout with:
  - Today's summary card (events emitted, docs created, sessions completed)
  - Cross-hub summary cards (Event Catalog stats, Data Exchange stats)
  - Quick actions (Open Event Catalog, Open Data Exchange, Start Session)
  - Documentation health (undocumented count, stale doc count)
- [ ] Inbox tab uses `table` layout with:
  - Actionable items from all hubs (new events, failed imports, session reminders)
  - Filter by hub, type, priority
  - Click to navigate to relevant hub/tab
- [ ] Activity tab uses `table` layout with:
  - Recent events (last 24h by default, configurable)
  - Grouped by hub or chronological
  - Search and filter

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

- [ ] User Hub opens from ribbon and command palette
- [ ] Dashboard shows cross-hub summary with real data
- [ ] Inbox shows at least 2 types of actionable items
- [ ] Activity feed shows recent events with search/filter
- [ ] All tabs render via Hub framework (shell + layout + adapter)
- [ ] `npm run build` passes
