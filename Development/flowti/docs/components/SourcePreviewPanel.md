---
type: Component
domain: Flowti
stage: done
description: "Source column preview showing column names, detected types, row count, and sample data for loaded analytics sources"
source: "[[Development/flowti/src/ui/analytics/SourcePreviewPanel.ts|SourcePreviewPanel.ts]]"
parent: "[[QueriesTab]]"
tags:
  - analytics
  - source
  - preview
  - component
---

# SourcePreviewPanel

## Description

SourcePreviewPanel renders a preview of loaded data sources in the Queries tab detail panel. Shows column names with detected types (string/number/date), total row count, and a sample data table (first 5 rows). Displays source name as title. Quick Insight cards appear below the preview (up to 3 suggestions based on detected column types). Used during source exploration before query configuration.

## Features

| Feature | Description |
|---------|-------------|
| Column list | Names with detected type badges |
| Row count | Total rows in source |
| Sample data | First 5 rows in preview table |
| Source name title | Shows source alias/filename |
| Quick Insights | Auto-suggested queries (up to 3 cards) |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Preview container |
| `source` | `QuerySource` | Loaded source with data |
| `onInsightClick` | callback | Populates query builder from suggestion |

## Related

- Parent: [[QueriesTab]]
- Introduced: [[Cycle 30 - Analytics UX Mastery]] (PBI-ANA-021)
- Quick Insights: [[Cycle 31 - Analytics Business Intelligence]] (PBI-ANA-026)
