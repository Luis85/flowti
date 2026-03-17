---
type: Component
domain: Flowti
stage: done
description: "Measurement and column type management UI for configuring column type hints and measure output types"
source: "[[Development/flowti/src/ui/analytics/MeasurementsTab.ts|MeasurementsTab.ts]]"
parent: "[[AnalyticsHubView]]"
tags:
  - analytics
  - measurement
  - component
---

# MeasurementsTab

## Description

MeasurementsTab provides a UI for managing column type hints and measurement configurations. Includes quick-add measure dropdown per column (numeric columns: all 6 AGG_FUNCTIONS; string/date: COUNT + COUNT_DISTINCT), measurement type hints (number/currency selector + currency symbol input per measure row), and cross-references between queries and measurements. Displays the relationship between source columns, type hints, and computed measures.

## Features

| Feature | Description |
|---------|-------------|
| Quick-add measure | Dropdown per column with type-appropriate aggregation functions |
| Type hints | number/currency selector per measure |
| Currency symbol | Input for currency formatting (€, $, £, ¥, ₹) |
| Cross-references | Shows queries using each measurement |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Tab container |
| `sources` | `QuerySource[]` | Active sources with column data |
| `typeHints` | `ColumnTypeHint[]` | Current type hint configuration |
| `onHintChange` | callback | Propagates type hint updates |

## Related

- Parent: [[AnalyticsHubView]]
- Introduced: [[Cycle 42 - Analytics Hub UX Coherence]]
- Quick-add: numeric → SUM/COUNT/AVG/MIN/MAX/COUNT_DISTINCT; string/date → COUNT/COUNT_DISTINCT
