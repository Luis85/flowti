---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies: []
planned_in: "[[Cycle 44 - Analytics Hub Filtering & Decomposition]]"
tags:
  - analytics
  - filter
  - dashboard
  - market-research
---

# PBI-ANA-130: Date Range Filter

## User Story — Problemspace
**As a** Supplier Manager reviewing monthly operations, **I want** to filter all dashboard tiles by a date range (Last 30 days, This quarter, Custom range), **so that** I can focus on the time period that matters without manually editing query filters.

**Context:** Every competing dashboard tool (Metabase, Looker Studio, Power BI, Superset, Grafana) provides a global date range filter. This is the most common dashboard interaction and the #1 gap identified in market research. Currently, Flowti requires per-query filter configuration with no global date control.

## Solution Statement
Add a date range filter control to DashboardFilterBar. Presets: Last 7/30/90 days, This/Last week/month/quarter/year, Custom range (date pickers). Date range filter propagates to all tiles via `runSavedQueryWithFilters()` — requires date column detection and pre-aggregation date filtering in AnalyticsEngine.

### Architecture
| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardFilterBar.ts` | Add date range picker UI | +80 |
| `src/domain/analytics/AnalyticsEngine.ts` | Pre-aggregation date range filtering | +40 |
| `src/domain/analytics/dateUtils.ts` | Date range preset calculations | +50 |
| `src/domain/analytics/types.ts` | DateRangeFilter type | +10 |

## Acceptance Criteria
- [ ] Date range picker in DashboardFilterBar with 10+ presets
- [ ] Custom date range with start/end date pickers
- [ ] Date range propagates to all tiles (pre-aggregation filtering)
- [ ] Auto-detects date columns from column type hints
- [ ] Persists selected range per dashboard session
- [ ] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (P1 roadmap)
- Market research: Every competitor has it; most common dashboard interaction
