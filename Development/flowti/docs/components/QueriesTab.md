---
type: Component
domain: Flowti
stage: done
description: "Analytics query builder with CSV and .base source selection, joins, dimensions, measures, time bucketing, and results display"
source: "[[Development/flowti/src/ui/analytics/QueriesTab.ts|QueriesTab.ts]]"
parent: "[[AnalyticsHubView]]"
tags:
  - hub
  - analytics
  - component
---

# QueriesTab

## Description

QueriesTab renders the analytics query builder within the Analytics Hub. Master panel shows selected sources, saved queries, and source pickers for both CSV and `.base` files. Detail panel provides the full query configuration form — column type hints, joins, dimensions, measures, time bucketing — with results displayed via AnalyticsResultsPanel.

Migrated from AnalyticsTab (DX Hub) in Cycle 28 with added `.base` file support.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `masterEl` | `HTMLElement` | Master panel DOM element |
| `detailEl` | `HTMLElement` | Detail panel DOM element |
| `deps` | `AnalyticsHubDeps` | Shared dependency bag |
| `deps.analyticsService` | `AnalyticsService` | Execute/save/load/delete queries, load CSV/base data |
| `AnalyticsResultsPanel` | class | Renders query results as stat cards + sortable table |

## State

- `sources: QuerySource[]` — active sources with alias, sourceType (csv/base), parsed data, loading state
- `columnTypeHints: ColumnTypeHint[]` — per-column type overrides
- `joins: JoinSpec[]` — join specs between sources
- `dimensions: DimensionSpec[]` — group-by dimensions
- `measures: MeasureSpec[]` — aggregation measures (SUM, COUNT, AVG, MIN, MAX)
- `timeBucket: TimeBucketSpec | null` — time bucketing config
- `lastResult: AnalyticsResult | null` — most recent query result
- `lastError: string | null` — error message from last execution

## Renders

### Master Panel
- **Selected sources** with alias, source type badge (CSV/Base), locale, remove button
- **Saved queries** list with load/delete actions
- **CSV Sources** picker from vault scan
- **Base Views** picker from vault scan

### Detail Panel
- **Action bar**: Run Query, Save Query buttons
- **Source configuration**: per-source locale selector
- **Column type hints**: override detected types
- **Joins**: configure join specs (left/inner)
- **Dimensions**: group-by columns
- **Measures**: aggregation columns with function
- **Time bucketing**: date column + bucket size
- **Results**: AnalyticsResultsPanel with stat cards, sortable table, CSV export

## Related

- Parent: [[AnalyticsHubView]]
- Child: [[AnalyticsResultsPanel]]
- Supersedes: [[AnalyticsTab]]
