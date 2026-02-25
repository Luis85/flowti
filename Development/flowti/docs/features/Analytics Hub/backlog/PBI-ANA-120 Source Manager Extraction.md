---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies: []
tags:
  - analytics
  - extraction
  - tech-debt
planned_in: "[[Cycle 43 - Analytics Hub Performance & Navigation]]"
delivered_in: "[[Cycle 43 - Analytics Hub Performance & Navigation]]"
---

# PBI-ANA-120: Source Manager Extraction

## User Story
Extract source CRUD lifecycle from QueriesTab into a dedicated SourceManager class, reducing QueriesTab from 1,026 to 930 LOC and improving testability of source management operations.

## Solution Statement
Create `src/domain/analytics/SourceManager.ts` (~226 LOC) with callback-driven SourceManagerDeps interface. Manages source CRUD (addSource, removeSource), async loading (CSV, .base, csv-folder), alias deduplication, type hint detection, header merging, distinct values, saved source building, and locale detection. QueriesTab delegates source operations to SourceManager instance.

## Acceptance Criteria
- [x] SourceManager class in `src/domain/analytics/SourceManager.ts` (~226 LOC)
- [x] SourceManagerDeps callback interface with 7 callbacks
- [x] QueriesTab reduced from 1,026 to 930 LOC
- [x] All source operations (add, remove, load, detect) work through SourceManager
- [x] Alias deduplication appends counter for duplicates
- [x] Source-level locale detection via `detectNumberLocale()`
- [x] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (FR-95, FR-96)
- Cycle: [[Cycle 43 - Analytics Hub Performance & Navigation]] (Inc 1)
