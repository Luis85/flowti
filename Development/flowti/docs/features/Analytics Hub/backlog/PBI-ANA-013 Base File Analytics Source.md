---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-010 Analytics Hub Shell]]"
tags:
  - analytics
  - base-files
planned_in: "[[Cycle 28 - Analytics Hub]]"
user_story: "[[When opening a CSV with Flowti, I want to be able to make an easy dashboard]]"
---

## User Story - Problemspace

As a data analyst, I want to use `.base` files as analytics sources so that I can aggregate and join vault note data without exporting to CSV first.

### User Pains

- Analytics only consumes CSV files
- Vault notes with rich frontmatter cannot be analyzed directly
- `.base` views that filter and project notes are invisible to the analytics engine
- Exporting to CSV and re-importing is a manual workaround

### User Needs

- `.base` files appear in analytics source picker alongside CSVs
- Column type detection works on vault note frontmatter values
- Saved queries can reference `.base` sources and re-execute correctly
- Existing CSV-only queries continue working

## Solutionstatement

### Functional Requirements

- [ ] BaseAnalyticsAdapter resolves `.base` files to ParsedSourceData (headers + rows)
- [ ] Adapter uses BaseQueryEngine for filter evaluation and ExportService patterns for column resolution
- [ ] Source picker in Queries tab shows `.base` files with distinct indicator
- [ ] SavedAnalyticsQuerySource extended with `sourcePath`, `sourceType`, `viewIndex`
- [ ] Backward-compat: existing queries with `csvPath` field continue working
- [ ] AnalyticsService.loadBase() method alongside existing loadCsv()

### Architecture

- `src/domain/analytics/BaseAnalyticsAdapter.ts` — .base → ParsedSourceData (~120 LOC)
- `src/domain/analytics/types.ts` — AnalyticsSourceType, updated SavedAnalyticsQuerySource (+10 LOC)
- `src/domain/analytics/AnalyticsService.ts` — loadBase() method, runSavedQuery() update (+40 LOC)
- `src/ui/analytics/QueriesTab.ts` — source picker update (+30 LOC)

## Acceptance Criteria

- [ ] `.base` files appear in source picker alongside CSVs
- [ ] Selecting a `.base` file loads its resolved data as analytics source
- [ ] Column type detection works on `.base`-sourced data
- [ ] Saved queries can reference `.base` sources and re-execute correctly
- [ ] Existing CSV-only queries continue working unchanged
- [ ] `npm test` passes

## Test Intent

~25 tests: BaseAnalyticsAdapter resolution (8), frontmatter-to-rows conversion (4), source picker with mixed types (4), saved query with base source (4), backward compat (5).

## Related

- PRD: [[Analytics Hub PRD]]
- Cycle: [[Cycle 28 - Analytics Hub]]
- Depends on: [[PBI-ANA-010 Analytics Hub Shell]]
- Reuses: BaseQueryEngine, ExportService.scanResolvedColumns(), ExportService.resolveColumnValue()
