---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
stage: done
date_completed: 2026-02-23
delivered_in: "[[Cycle 27 - Analytics Sprint]]"
priority: critical
dependencies:
  - "[[PBI-ANA-001 Analytics Engine Core]]"
tags:
  - data-exchange
  - analytics
  - ui
planned_in: "[[Cycle 27 - Analytics Sprint]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a user, I want a visual interface to configure which CSVs to analyze, set locales, define joins, and pick dimensions and measures — without writing code.

### User Pains

- No visual way to configure multi-CSV analysis
- No locale selection for CSV sources with different number/date formats
- No column type detection — user must know which columns are numeric vs text
- No query builder — requires external tools to formulate analytical questions

### User Needs

- Visual source picker for 1-3 CSV files from vault
- Per-source locale dropdown (en-US, de-DE, en-GB, nl-NL, fr-FR, auto)
- Column type badges (number/date/string) with heuristic pre-fill and manual override
- Join configuration with column dropdowns
- Dimension and measure selection with type-aware filtering
- Time bucket configuration for date columns

## Solutionstatement

### Functional Requirements

- [x] New "Analytics" tab in DX Hub (9th tab, icon: `bar-chart-2`)
- [x] Source picker: select 1-3 CSV files from vault
- [x] Per-source locale dropdown with 6 options (5 presets + auto)
- [x] Auto-detect columns from selected CSVs (parse headers + sample 10 rows)
- [x] Column type badges pre-filled from locale + sample heuristic, editable per column
- [x] Join configuration: left/right column dropdowns (visible when 2+ sources)
- [x] Dimension picker: checkboxes from available columns
- [x] Measure picker: column + aggregation dropdown (only `number`-typed columns for SUM/AVG)
- [x] Time bucket: toggle + date column picker (only `date`-typed columns) + period selector
- [x] Validation: at least 1 source, 1 dimension, 1 measure
- [x] "Run Query" button triggers AnalyticsService.runQuery()

### Architecture

- `src/ui/hub/AnalyticsTab.ts` — tab component following shared pattern
- Registered as 9th tab in `DataExchangeHubView.ts`
- Master panel: saved queries list + "New Query" button
- Detail panel: query builder form

## Acceptance Criteria

- [x] Analytics tab visible in DX Hub
- [x] Can select 1-3 CSV files as sources
- [x] Locale dropdown per source with 6 options
- [x] Column type badges shown and pre-filled after CSV detection
- [x] User can override type per column
- [x] Only `number`-typed columns available for SUM/AVG measures
- [x] Only `date`-typed columns available for time bucket
- [x] Join config shows column dropdowns
- [x] Validation prevents running without required fields
- [x] "Run Query" triggers engine execution
- [x] `npm test` passes

## Test Intent

~30 tests: tab rendering (5), source selection (5), locale picker (4), column type hints (6), join config (4), dimension/measure selection (4), validation (2).

## Related

- PRD: [[Data Exchange Hub PRD]]
- Cycle: [[Cycle 27 - Analytics Sprint]]
- Depends on: [[PBI-ANA-001 Analytics Engine Core]]
