---
type: Component
domain: Flowti
stage: superseded
superseded_by: "[[QueriesTab]]"
description: "CSV analytics query builder with source selection, joins, dimensions, measures, time bucketing, and query results — superseded by QueriesTab in Analytics Hub (Cycle 28)"
source: "[[Development/flowti/src/ui/hub/AnalyticsTab.ts|AnalyticsTab.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - analytics
  - component
---

# AnalyticsTab

## Description

AnalyticsTab renders the analytics query builder within the Data Exchange Hub. It provides a master panel with source selection and saved query management, and a detail panel with the full query configuration form — column type hints, joins, dimensions, measures, and time bucketing. Query results are displayed via `AnalyticsResultsPanel`. Supports CSV source selection with per-source locale configuration and multi-source joins.

Planned for extraction to a dedicated Analytics Hub in [[Cycle 28 - Analytics Hub]].

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `masterEl` | `HTMLElement` | Master panel DOM element |
| `detailEl` | `HTMLElement` | Detail panel DOM element |
| `deps` | `HubComponentDeps` | Shared dependency bag providing state, services, and callbacks |
| `deps.getState()` | callback | Read analytics state (sources, query config, results) |
| `deps.setState()` | callback | Update analytics state |
| `deps.analyticsService` | `AnalyticsService` | Execute queries, save/load/delete saved queries |
| `AnalyticsEngine` | class | In-memory analytics engine (joins, aggregation, time bucketing) |
| `AnalyticsResultsPanel` | class | Renders query results as stat cards + sortable table |

## State

**Reads/Writes:**
- `sources: QuerySource[]` — CSV paths with alias, locale, parsed data, loading state
- `columnTypeHints: ColumnTypeHint[]` — Per-column type overrides
- `joins: JoinSpec[]` — Join specifications between sources
- `dimensions: DimensionSpec[]` — Group-by dimensions
- `measures: MeasureSpec[]` — Aggregation measures (sum, count, avg, min, max)
- `timeBucket: TimeBucketSpec | null` — Time bucketing configuration
- `lastResult: AnalyticsResult | null` — Most recent query result
- `lastError: string | null` — Error message from last execution
- `running: boolean` — Query execution in progress

## Renders

### Master Panel
- **Selected sources** list with alias, locale badge, remove button
- **Saved queries** list with load/delete actions
- **Available CSVs** picker from vault scan

### Detail Panel
- **Action bar**: Run Query, Save Query buttons
- **Source configuration**: Per-source locale selector (en-US, de-DE, en-GB, nl-NL, fr-FR)
- **Column type hints**: Override detected types for specific columns
- **Joins section**: Configure join specs between sources (left/inner)
- **Dimensions section**: Select group-by columns
- **Measures section**: Select aggregation columns with function
- **Time bucketing**: Optional date column + bucket size (day/week/month/quarter/year)
- **Results area**: `AnalyticsResultsPanel` with stat cards, sortable table, CSV export

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `analytics.query.started` | Emitted (via service) | Query execution started |
| `analytics.query.completed` | Emitted (via service) | Query completed successfully |
| `analytics.query.failed` | Emitted (via service) | Query execution failed |
| `analytics.query.saved` | Emitted (via service) | Query saved to persistence |
| `analytics.query.deleted` | Emitted (via service) | Query removed from persistence |

## Related

- Parent: [[DataExchangeHubView]]
- Child: [[AnalyticsResultsPanel]]
- Siblings: [[ImportsTab]], [[ExportsTab]], [[ReportsTab]], [[PropertiesTab]], [[PipelinesTab]], [[TypesTab]], [[SignalsTab]], [[CanvasTab]]
- Planned extraction: [[Analytics Hub PRD]]
