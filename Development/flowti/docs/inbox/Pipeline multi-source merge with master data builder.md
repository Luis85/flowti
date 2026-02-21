---
type: idea
stage: planned
origin: inbox
domain: data-exchange
description: "Enhance pipeline builder to select N sources, define a merge key, preview merged dataset, then export master data to target."
tags:
  - release-blocker
  - RB-7
priority: "2 - high"
rank:
planned_in: "[[Cycle 13 - Release Preparation]]"
related:
  - "[[Data Exchange Hub - Pipelines]]"
  - "[[I want to combine multiple reports into one import]]"
  - "[[I want to build a well documented data-pipeline]]"
  - "[[Data Exchange Hub PRD]]"
  - "[[backlog-refinement-2026-02-20]]"
  - "[[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]]"
note: "Release blocker RB-7. The pipeline builder already supports multi-source import and export steps. What's missing: (1) explicit merge-key configuration per source, (2) conflict resolution when sources disagree on a field, (3) preview of merged dataset before export, (4) master data file generation. The use case: take supplier data from CSV A, enrich with pricing from CSV B, merge on 'product_id', review in Base view, export master file."
---

## Problem

The current pipeline builder executes sources sequentially and creates notes per source. There is no explicit merge step that combines data from multiple sources into a unified master dataset. Users must manually reconcile data across imported notes.

## Proposed Solution

1. **Source selector**: Add N CSV/Canvas sources to a pipeline
2. **Merge configuration**: Define canonical merge key (e.g., `product_id`) per source
3. **Merge strategy**: Per-field conflict resolution (first-wins, last-wins, concatenate, manual)
4. **Preview**: Show merged dataset in a table before committing
5. **Master data export**: Export merged dataset to CSV or create a single `.base` view file
6. **Base view steps**: Between merge and export, optionally pass through a Base view for manual data quality checks

## Acceptance Criteria

- [ ] Pipeline supports 2+ sources with merge key
- [ ] Merge preview shows combined dataset with conflict highlights
- [ ] At least 2 merge strategies available (first-wins, last-wins)
- [ ] Master data can be exported to CSV or external target
- [ ] Existing pipeline tests pass unchanged
- [ ] New tests cover merge logic with conflicting data
- [ ] `npm run build` passes
