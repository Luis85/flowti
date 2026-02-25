---
type: Flow
domain: Flowti
stage: done
description: Right-click a CSV file to open it in the Analytics Hub with the source pre-selected, enabling quick analysis from the file explorer
domains:
  - Analytics
  - Data Exchange
services:
  - AnalyticsService
  - SourceManager
events:
  - analytics.loaded
  - analytics.query.started
  - analytics.query.completed
  - analytics.query.saved
tags:
  - analytics
  - csv
  - cross-domain
---

# Analyze CSV in Analytics Hub

## Overview

This flow enables users to start an analytics workflow directly from a CSV file in the file explorer. Right-clicking a CSV file and selecting "Analyze in Analytics Hub" opens the hub with the file pre-selected as a data source. The flow bridges the Data Exchange domain (where CSVs are managed) with the Analytics domain (where queries are built).

## Trigger

User right-clicks a `.csv` or `.base` file in the Obsidian file explorer, or clicks the "Analyze" button on a CSV detail page or Report detail page in the Data Exchange Hub.

## Steps

### 1. Initiate Analysis

- **View/Service**: File explorer context menu / CsvLanding / DX Hub Reports
- **User Action**: User right-clicks a CSV file and selects "Analyze in Analytics Hub", or clicks the "Analyze" button on a CSV detail page
- **System Response**: The Analytics Hub is opened (or focused if already open). The `onNavigateToEntity` handler receives the CSV file path
- **Events**: `analytics.loaded` (if hub was not previously open)

### 2. Source Pre-Selection

- **View/Service**: QueriesTab + SourceManager
- **User Action**: (automatic — no user action required)
- **System Response**: The Queries tab is activated. The CSV file is automatically added as a source via SourceManager. The file is parsed and loaded. SourcePreviewPanel shows column names, types, row count, and sample data. Quick Insights generate auto-suggestions based on detected column types
- **Events**: (none — UI state only)

### 3. Quick Insight Selection (Optional)

- **View/Service**: SourcePreviewPanel
- **User Action**: User clicks one of the Quick Insight suggestion cards (e.g., "Total Revenue", "Revenue by Region", "Top 5 Products")
- **System Response**: The query builder is populated with the suggested dimensions, measures, and sort configuration. The query auto-executes. Results display in the detail panel
- **Events**: `analytics.query.started` → `analytics.query.completed`

### 4. Build and Save Query

- **View/Service**: QueriesTab (detail panel)
- **User Action**: User adjusts the query configuration (add dimensions, change measures, add filters) and clicks "Save Query"
- **System Response**: Query is saved to persistence. The saved query appears in the master panel's saved query list. From here, the user can add the query to a dashboard via [[Build Analytics Dashboard]] flow
- **Events**: `analytics.query.saved`

## Alternative Entry: CSV Detail Analytics Section

### Via CsvLanding Page

When viewing a CSV file's detail page (CsvLanding), an "Analytics" section shows:
- Existing queries that reference this CSV file (via `getQueriesBySource()`)
- Auto-summary of each query (dimensions, measures, last run time)
- "Create Query" action for CSV files with no existing queries

Clicking an existing query navigates to the Analytics Hub with that query loaded (`lastLoadedQueryId` + `pendingExecute` pattern for auto-load and auto-execute).

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Entry point | File explorer / CSV detail / DX Hub Reports | File explorer |
| Quick Insight | Accept suggestion / Build custom query | User choice |
| Auto-execute | On Quick Insight click / Manual Run | On Quick Insight click |

## Events Sequence

```
[right-click CSV] → analytics.loaded →
[auto-add source] → (source parsed) →
[click Quick Insight] → analytics.query.started → analytics.query.completed →
[save query] → analytics.query.saved
```

## Related Use Cases

- [[Build Analytics Dashboard]] — After saving a query, user can add it to a dashboard
- [[Import CSV as Notes]] — CSV files originate from imports; after import, inbox item suggests analysis
- [[Drill-Down Dashboard]] — Drill-down exploration of dashboard tiles created from this flow

## Related Decisions

- [[ADR-024 BaseHubView Shell Extraction]] — AnalyticsHubView extends BaseHubView

## Components Involved

- [[QueriesTab]] — Query builder with source management
- [[SourcePreviewPanel]] — Column preview and Quick Insights
- [[SourcePanel]] — Source picker and management
- [[SchemaPanel]] — Column browser with click-to-insert
