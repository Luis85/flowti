---
type: ProductBacklogItem
pbi: PBI-ANA-028
title: Import-to-Analytics Bridge
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
planned_in: "[[Cycle 31 - Analytics Business Intelligence]]"
related:
  - "[[PBI-ANA-016 Dashboard First Overview]]"
  - "[[Supplier Manager]]"
  - "[[Data Exchange Hub PRD]]"
functional_requirements:
  - FR-35
  - FR-36
tags:
  - analytics
  - data-exchange
  - bridge
  - low-touch
---

# PBI-ANA-028: Import-to-Analytics Bridge

## User Story

As a Supplier Manager, after importing my daily CSV reports in the Data Exchange Hub, I want a quick way to analyze them in the Analytics Hub so that I don't have to navigate manually between hubs and find the imported file.

## Functional Requirements

- **FR-35**: After a CSV import completes in the Data Exchange Hub, an inbox item "Analyze [filename] in Analytics Hub" is created, linking to the Analytics Hub
- **FR-36**: Analytics Hub overview page shows a "Recent Sources" section with the 5 most recently modified CSV files and an "Analyze" action per source

## Acceptance Criteria

- [ ] Pure mapper `mapImportToAnalytics(event)` creates an `InboxItem` with `type: "action"` and `sourceHub: "analytics"`
- [ ] InboxService wires `dataExchange.import.completed` to the analytics mapper (alongside existing `mapImportCompleted`)
- [ ] Analytics Hub overview page shows "Recent Sources" section below favorites
- [ ] Section shows up to 5 recent CSV files sorted by vault modification time
- [ ] Each entry: file name + "Analyze" button
- [ ] "Analyze" button navigates to Queries tab (with source context if feasible)
- [ ] Section hidden when no CSV files exist in vault
- [ ] `npm test` passes

## Architecture

- `mapImportToAnalytics()` pure mapper in `src/domain/inbox/mappers.ts`
- InboxService: additional listener for `dataExchange.import.completed`
- AnalyticsDashboardPage: "Recent Sources" section using existing `csvFiles` from hub state
- No new events needed — leverages existing import event + inbox infrastructure

## Test Intent

~10 tests:
- Mapper produces correct InboxItem shape (type, title, sourceHub)
- InboxService wires mapper correctly
- Recent Sources section: renders 5 entries, sorted by modification time
- Empty state: section hidden when no CSVs
- "Analyze" button navigates to Queries tab

## Dependencies

- None (independent, uses existing InboxService infrastructure)

## Estimated LOC

~72 (15 mapper + 5 service wiring + 50 dashboard page + 2 types)
