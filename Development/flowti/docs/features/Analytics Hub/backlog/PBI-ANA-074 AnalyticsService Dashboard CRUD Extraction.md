---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: critical
dependencies: []
tags:
  - analytics
  - extraction
  - tech-debt
planned_in: "[[Cycle 38 - Query Builder Improvements]]"
delivered_in: "[[Cycle 38 - Query Builder Improvements]]"
---

# PBI-ANA-074: AnalyticsService Dashboard CRUD Extraction

## User Story

As a developer, I want the dashboard CRUD handlers extracted from AnalyticsService so that the service remains focused on orchestration while dashboard mutations live in a dedicated handler module, following the established TD-101 pattern from SessionService.

## Solution Statement

Extract all dashboard and tile CRUD operations from AnalyticsService into `handlers/dashboardHandlers.ts`, reducing AnalyticsService from 916 to 619 LOC. This resolves TD-ANA-002.

**`handlers/dashboardHandlers.ts` (~355 LOC):**
- All dashboard CRUD: create, update, delete, favorite, set default, refresh
- All tile CRUD: add, remove, update, reorder
- Template CRUD: save, import, use
- Pinning management: pin/unpin dashboards

**`AnalyticsHandlerContext` pattern:**
- Mirrors the `SessionHandlerContext` pattern from TD-101
- Context object provides: `getState()`, `setState()`, `emit()`, `persist()`
- Handlers are pure functions that receive context — no direct service reference
- AnalyticsService creates the context and delegates to handlers

## Acceptance Criteria

- [x] `dashboardHandlers.ts` extracted with all dashboard/tile/favorites/defaults/template CRUD
- [x] AnalyticsService reduced to 619 LOC or less
- [x] `AnalyticsHandlerContext` pattern implemented (matches SessionService TD-101 pattern)
- [x] All existing behavior preserved — zero functional changes
- [x] All existing tests pass without modification
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v13)
- Cycle: [[Cycle 38 - Query Builder Improvements]] (Inc 5)
- Tech debt: TD-ANA-002
- Pattern: Follows [[PBI-SW-012 Session Handler Extraction]] (TD-101 AnalyticsHandlerContext pattern)
