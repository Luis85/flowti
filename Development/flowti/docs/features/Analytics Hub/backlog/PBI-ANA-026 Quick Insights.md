---
type: ProductBacklogItem
pbi: PBI-ANA-026
title: Quick Insights
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: delivered
delivered_in: "[[Cycle 31 - Analytics Business Intelligence]]"
priority: critical
planned_in: "[[Cycle 31 - Analytics Business Intelligence]]"
related:
  - "[[PBI-ANA-021 Source Preview and Query Usability]]"
  - "[[Supplier Manager]]"
functional_requirements:
  - FR-31
  - FR-32
tags:
  - analytics
  - auto-suggest
  - low-touch
---

# PBI-ANA-026: Quick Insights

## User Story

As a Supplier Manager, I want the Analytics Hub to auto-suggest queries when I load a data source so that I can see useful aggregations with one click instead of manually choosing dimensions and measures.

## Functional Requirements

- **FR-31**: When a source is loaded and column types detected, the system generates up to 3 query suggestions (Quick Insights) based on column types
- **FR-32**: User can click a Quick Insight to populate the query builder with suggested dimensions, measures, and time bucket, then auto-execute

## Acceptance Criteria

- [ ] `QuickInsightSuggestion` type added to domain types
- [ ] Pure function `generateQuickInsights(columnTypeHints, headers)` returns up to 3 suggestions
- [ ] Rule 1: "Total [first-numeric] by [first-text]" — SUM of first numeric, grouped by first text column
- [ ] Rule 2: "Count by [first-text]" — COUNT grouped by first text column
- [ ] Rule 3: "[first-numeric] over time" — SUM + time bucket by month (only if date column detected)
- [ ] Quick Insight cards rendered in source preview area (below column summary)
- [ ] Cards show icon + title + description
- [ ] Clicking a card populates query builder (dimensions, measures, timeBucket) and auto-executes
- [ ] No suggestions shown when source has <2 columns
- [ ] Suggestions update when source changes
- [ ] `npm test` passes

## Architecture

- `QuickInsightSuggestion` type in `src/domain/analytics/types.ts`
- `generateQuickInsights()` pure function in new `src/domain/analytics/quickInsights.ts`
- Leverages existing `AnalyticsEngine.detectColumnTypes()` for column type detection
- UI cards in `QueriesTab.ts` source preview section

## Test Intent

~15 tests:
- Suggestion generation: 3 rules (text+numeric, count, time-series)
- Edge cases: all-text columns, all-numeric, single column, no columns
- Date column detection → time bucket suggestion
- Mixed column types
- Correct dimension/measure population
- Auto-execute on click (integration)

## Dependencies

- ANA-025 (sequential for QueriesTab modification safety, not technical dependency)

## Estimated LOC

~138 (60 pure function + 70 UI + 8 types)
