---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
stage: planned
priority: high
dependencies: []
tags:
  - release-blocker
  - RB-7
  - data-exchange
  - pipeline
planned_in: "[[Release Preparation Cycle]]"
user_story: "[[Pipeline multi-source merge with master data builder]]"
---

## User Story - Problemspace

As a data manager, I want to merge multiple data sources in a pipeline with a defined merge key so that I can build master datasets from fragmented sources without manual reconciliation.

### User Pains

- Pipeline builder executes sources sequentially, creating notes per source with no merge
- No way to combine data from multiple CSVs into a unified master dataset
- Conflict resolution between sources is manual and error-prone
- No intermediate preview between pipeline steps

### User Needs

- Select N CSV/Canvas sources in a pipeline
- Define canonical merge key per source
- Choose merge strategy per field (first-wins, last-wins, concatenate, manual)
- Preview merged dataset before committing
- Export master data to CSV or Base view

## Solutionstatement

### Functional Requirements

- [ ] Source selector: Add N CSV/Canvas sources to pipeline
- [ ] Merge configuration: Define canonical merge key per source
- [ ] Merge strategies: Per-field conflict resolution (first-wins, last-wins, concatenate, manual)
- [ ] Merge preview: Show combined dataset with conflict highlights
- [ ] Master data export: Export to CSV or create `.base` view file
- [ ] Base view steps: Intermediate Base view between merge and export for manual QA
- [ ] Existing pipeline tests pass unchanged

## Acceptance Criteria

- [ ] Pipeline supports 2+ sources with merge key
- [ ] Merge preview shows combined dataset with conflict highlights
- [ ] At least 2 merge strategies available
- [ ] Master data exportable to CSV or external target
- [ ] Existing pipeline tests pass unchanged
- [ ] New tests cover merge logic with conflicting data
- [ ] npm run build passes

## Related

- PRD: [[Data Exchange Hub PRD]]
- Inbox: [[Pipeline multi-source merge with master data builder]]
