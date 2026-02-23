---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
stage: done
date_completed: 2026-02-23
delivered_in: "[[Cycle 27 - Analytics Sprint]]"
priority: critical
dependencies: []
tags:
  - data-exchange
  - analytics
planned_in: "[[Cycle 27 - Analytics Sprint]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a data analyst, I want to join multiple CSV files and aggregate values with locale-aware parsing so that I can answer business questions like "cost per item per supplier by month" without leaving Obsidian.

### User Pains

- CSV import creates notes per row but provides no aggregation or summarization
- No way to join multiple CSV files (Items + Suppliers + Sales) within the vault
- No locale-aware number parsing — US `1,234.56` would be misinterpreted in EU context
- No locale-aware date parsing — US `02/15/2026` would be misread as day 2 in EU context
- Answering business questions requires exporting to Excel or a BI tool

### User Needs

- In-memory analytics engine that joins, groups, and aggregates CSV data
- Locale-aware number parsing (US, EU, FR presets)
- Locale-aware date parsing with time bucketing (month, quarter, year)
- Column type hints so the engine knows which columns are numbers, dates, or strings
- 10k+ row performance without creating thousands of vault notes

## Solutionstatement

### Functional Requirements

- [x] In-memory hash join on 2-3 CSV sources via specified key columns (inner + left join)
- [x] GROUP BY on 1-3 dimension columns
- [x] Aggregate functions: SUM, COUNT, AVG, MIN, MAX on locale-parsed numeric columns
- [x] Locale-aware number parsing: US (`1,234.56`), EU (`1.234,56`), FR (`1 234,56`)
- [x] Locale-aware date parsing: US (`MM/DD/YYYY`), EU (`DD/MM/YYYY`, `DD.MM.YYYY`), ISO (`YYYY-MM-DD`)
- [x] Time bucketing: month (`2026-02`), quarter (`2026-Q1`), year (`2026`)
- [x] Column type hints: `number`, `date`, `string` with heuristic pre-fill from sample values
- [x] 5 built-in locale presets: en-US, de-DE, en-GB, nl-NL, fr-FR + auto-detect
- [x] Chain 3-way joins (A→B, result→C)
- [x] Graceful handling of missing join keys and non-numeric values

### Architecture

- New domain: `src/domain/analytics/`
- `AnalyticsEngine` — pure, stateless class (query config + parsed CSV → result)
- `localeUtils.ts` — number parsing, locale presets, auto-detect heuristic
- `dateUtils.ts` — date parsing, bucketing
- `types.ts` — AnalyticsQuery, AnalyticsSource, SourceLocale, ColumnTypeHint, JoinSpec, DimensionSpec, MeasureSpec, TimeBucketSpec, AnalyticsResult

## Acceptance Criteria

- [x] Inner join 2 CSVs on a shared key column
- [x] Left join preserves rows without match (fills "Unknown")
- [x] Chain 3-way join (A→B, result→C)
- [x] GROUP BY 1-3 dimensions with SUM, COUNT, AVG, MIN, MAX
- [x] US number parsing: `"1,234.56"` → `1234.56`
- [x] EU number parsing: `"1.234,56"` → `1234.56`
- [x] FR number parsing: `"1 234,56"` → `1234.56`
- [x] US date parsing: `"02/15/2026"` → month 2
- [x] EU date parsing: `"15.02.2026"` → month 2
- [x] ISO date parsing: `"2026-02-15"` → month 2
- [x] Month, quarter, and year bucketing from parsed dates
- [x] Column type hints control parsing behavior
- [x] Non-numeric values in SUM skipped (treated as 0)
- [x] Missing join key → excluded (inner) or filled (left)
- [x] 10,000 rows join + aggregate in < 2 seconds
- [x] `npm test` passes

## Test Intent

~50 tests: join mechanics (12), grouping + aggregation (10), locale number parsing (12), locale date parsing (8), time bucketing (4), edge cases (4).

## Related

- PRD: [[Data Exchange Hub PRD]]
- Cycle: [[Cycle 27 - Analytics Sprint]]
- Backlog Refinement: [[Improvement Backlog - Analytics Sprint]]
- Inbox: [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]
