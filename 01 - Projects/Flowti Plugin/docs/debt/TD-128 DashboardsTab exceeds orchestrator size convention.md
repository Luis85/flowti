---
type: TechDebt
stage: resolved
resolved: 2026-02-27
resolved_in: "[[Cycle 49 - Release Readiness and Dogfooding]]"
domain: analytics
severity: medium
source: "[[Cycle 44 - Analytics Hub Filtering & Decomposition]]"
related:
  - "[[TD-01 UI files exceed size convention]]"
---

# TD-128: DashboardsTab Exceeds Orchestrator Size Convention

## Problem

`src/ui/analytics/DashboardsTab.ts` has grown to **1,149 LOC** during Cycles 42–44. While orchestrator files are expected to be larger (500–800 LOC is acceptable per TD-01), 1,149 LOC exceeds even the orchestrator threshold. The file mixes tile rendering orchestration, callback wiring, dashboard switching, cross-tile filter state, pagination state, and settings panel coordination.

### Growth drivers (Cycle 42–44)

| Feature | LOC impact |
|---------|-----------|
| Cross-tile filtering callbacks | ~60 |
| Pagination state + onPageChange | ~30 |
| Multi-column chart wiring | ~20 |
| Show/hide series callbacks | ~15 |
| Items KPI label callback | ~10 |
| Settings panel context growth | ~30 |

### Comparison with sibling

`AnalyticsDashboardPage.ts` (homepage view) mirrors DashboardsTab at **546 LOC** — it has the same callback pattern but fewer features. This duplication between the two files compounds the maintenance burden.

## Proposed Fix

Extract callback wiring into a shared helper, similar to how `dashboardHandlers.ts` was extracted from AnalyticsService:

1. **Extract `buildTileRenderContext()`** — pure function that builds `TileRenderContext` from tile + state maps + callback factories
2. **Extract `DashboardCallbacks`** — shared callback factory used by both DashboardsTab and AnalyticsDashboardPage
3. **Merge shared state** — both files maintain identical `tilePages`, `tileFilters`, etc. maps — could be a shared `DashboardViewState` helper

Target: DashboardsTab ≤ 800 LOC, AnalyticsDashboardPage ≤ 400 LOC.

## Impact

- Cognitive load navigating 1,149 LOC file
- DashboardsTab and AnalyticsDashboardPage drift apart when callbacks are updated in one but not the other
- New tile features require updating callback wiring in two places

## Affected Files

- `src/ui/analytics/DashboardsTab.ts` (1,149 LOC)
- `src/ui/analytics/AnalyticsDashboardPage.ts` (546 LOC)
