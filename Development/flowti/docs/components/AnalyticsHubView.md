---
type: Component
domain: Flowti
stage: done
description: "Dedicated Analytics Hub view — BaseHubView subclass with Dashboards and Queries tabs"
source: "[[Development/flowti/src/ui/AnalyticsHubView.ts|AnalyticsHubView.ts]]"
parent: "[[BaseHubView]]"
tags:
  - hub
  - analytics
  - component
---

# AnalyticsHubView

## Description

AnalyticsHubView is the orchestrator for the Analytics Hub — a dedicated view for analytics queries and dashboards. It extends BaseHubView with 2 tabs (Dashboards, Queries), owns hub state (queries, dashboards, CSV files, base files), and delegates rendering to QueriesTab, DashboardsTab, and AnalyticsDashboardPage.

Created in Cycle 28 to replace the AnalyticsTab in DataExchangeHubView.

## Identity

| Property | Value |
|----------|-------|
| View type | `flowti-analytics-hub` |
| Hub ID | `analytics` |
| Hub type | `domain` |
| Display name | Analytics Hub |
| Icon | `bar-chart-2` |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `leaf` | `WorkspaceLeaf` | Obsidian workspace leaf |
| `eventBus` | `IEventBus` | Event bus for analytics events |
| `analyticsService` | `AnalyticsService` | Query + dashboard CRUD |
| `BaseHubView` | abstract class | Shell lifecycle (top bar, tab bar, split, debounce) |
| `QueriesTab` | class | Query builder tab component |
| `DashboardsTab` | class | Dashboard tile grid tab component |
| `AnalyticsDashboardPage` | class | Hub overview page |

## State

- `queries: SavedAnalyticsQuery[]` — from analyticsService.listQueries()
- `dashboards: Dashboard[]` — from analyticsService.listDashboards()
- `csvFiles: AnalyticsCsvEntry[]` — vault scan for `.csv` files
- `baseFiles: AnalyticsBaseEntry[]` — vault scan for `.base` files
- `selectedQueryId: string | null`
- `selectedDashboardId: string | null`

## Tabs

| Tab | Component | Search placeholder |
|-----|-----------|-------------------|
| Dashboards | DashboardsTab | Search dashboards... |
| Queries | QueriesTab | Search CSV sources... |

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `analytics.query.saved` | Listened | Refresh data + re-render |
| `analytics.query.deleted` | Listened | Refresh data + re-render |
| `analytics.dashboard.created` | Listened | Refresh data + re-render |
| `analytics.dashboard.deleted` | Listened | Refresh data + re-render |
| `analytics.dashboard.updated` | Listened | Refresh data + re-render |
| `analytics.dashboard.tile.added` | Listened | Refresh data + clear tile cache + re-render |
| `analytics.dashboard.tile.removed` | Listened | Refresh data + clear tile cache + re-render |

## Related

- Parent: [[BaseHubView]]
- Children: [[QueriesTab]], [[DashboardsTab]], [[AnalyticsDashboardPage]]
- Provider: [[AnalyticsHubProvider]]
- Supersedes: [[AnalyticsTab]] (was in [[DataExchangeHubView]])
- Flow: [[Build Analytics Dashboard]]
- PRD: [[Analytics Hub PRD]]
