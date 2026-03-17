---
type: Component
domain: Flowti
stage: done
description: "Analytics Hub dashboard overview page — stats grid with query and dashboard counts"
source: "[[Development/flowti/src/ui/analytics/AnalyticsDashboardPage.ts|AnalyticsDashboardPage.ts]]"
parent: "[[AnalyticsHubView]]"
tags:
  - hub
  - analytics
  - component
---

# AnalyticsDashboardPage

## Description

AnalyticsDashboardPage renders the hub overview page (shown when no tab is selected). Displays a stats grid with saved query count and dashboard count. Provides quick-action buttons to navigate to the Queries or Dashboards tabs.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `dashboardEl` | `HTMLElement` | Dashboard container from BaseHubView |
| `deps` | `AnalyticsHubDeps` | Shared dependency bag for state + navigation |

## Renders

- **Stats grid**: query count, dashboard count
- **Quick actions**: "New Query" → navigates to Queries tab, "New Dashboard" → navigates to Dashboards tab

## Related

- Parent: [[AnalyticsHubView]]
- Siblings: [[QueriesTab]], [[DashboardsTab]]
