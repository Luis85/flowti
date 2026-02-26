---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-120 Source Manager Extraction]]"
tags:
  - analytics
  - tech-debt
  - extraction
  - queries
planned_in: "[[Cycle 44 - Analytics Hub Filtering & Decomposition]]"
---

# PBI-ANA-140: QueriesTab Decomposition

## User Story

As a developer extending the Analytics Hub, I want QueriesTab decomposed into focused modules so that query execution and result handling can be modified independently without navigating a 930 LOC monolith.

## Solution Statement

Continue the QueriesTab decomposition started with SourceManager extraction in Cycle 43. Extract query execution orchestration into `QueryExecutionManager` and result processing into `QueryResultHandler`, reducing QueriesTab from ~930 LOC to ~550 LOC orchestrator. Both new modules use the callback-based deps pattern established by SourceManager.

## Acceptance Criteria

- [ ] QueryExecutionManager owns all execution orchestration (run, cancel, cache coordination)
- [ ] QueryResultHandler owns result processing, sorting, and computed column resolution
- [ ] QueriesTab reduced from ~930 to ~550 LOC (orchestrator only)
- [ ] Both new modules use callback-based deps pattern (consistent with SourceManager)
- [ ] Existing query functionality unchanged
- [ ] `npm test` passes

## Related

- Depends on: [[PBI-ANA-120 Source Manager Extraction]] (C43 — first step of decomposition)
- Tech Debt: Continues QueriesTab reduction from C43 (1,026 → 930 → ~550)
- Pattern: [[ADR-024 BaseHubView Shell Extraction]] (callback-based deps)
