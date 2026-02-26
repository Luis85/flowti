---
type: TechDebt
severity: low
category: architecture
layer: ui
status: mitigated
updated: 2026-02-21
effort: large
description: Multiple files exceed 500 LOC. The original 4 files exceeding 1,000 LOC have been significantly reduced through component extraction. 15 files now exceed the 500 LOC threshold (up from 11, due to session domain growth). session/helpers.ts at 982 LOC is the largest file in the codebase.
---
# TD-01: UI files exceed size convention

## Original Problem (2026-02-13)

Four UI files massively exceeded the 200-300 LOC convention:

| File | Lines (original) | Lines (current) | Reduction |
|------|-----------------|-----------------|-----------|
| `CsvActionView.ts` | 2,288 | 747 | -67% |
| `DataExchangeHubView.ts` | 2,297 | 484 | -79% |
| `ExportView.ts` | 1,350 | 655 | -51% |
| `EventsTab.ts` | 1,040 | 655 | -37% |

Phases 1-8 component extraction reduced these 4 files from an average of 1,744 LOC to 635 LOC.

## Current State (2026-02-26)

17 files exceed 500 LOC (up from 15, due to analytics domain growth in Cycles 42–44):

| File | LOC | Notes |
|------|-----|-------|
| `analytics/DashboardsTab.ts` | 1,149 | **New largest UI file** — see [[TD-128]] |
| `domain/session/helpers.ts` | 982 | Largest domain file — see [[TD-118]] |
| `analytics/queries/QueryBuilderPanel.ts` | 811 | Query builder orchestrator |
| `analytics/QueriesTab.ts` | 810 | Queries tab orchestrator |
| `CsvActionView.ts` | 772 | Orchestrator with 10 sub-components |
| `EventCatalogView.ts` | 735 | Orchestrator with 15 sub-components |
| `ExportView.ts` | 692 | Orchestrator with 6 sub-components |
| `main.ts` | 643 | Plugin lifecycle orchestrator |
| `DataExchangeHubView.ts` | 641 | Orchestrator with hub sub-components |
| `userHub/UserHubSessions.ts` | 640 | Mixed concerns — see [[TD-113]] |
| `EventBridge.ts` | 614 | Core infrastructure — careful |
| `SessionService.ts` | 613 | Domain service (reduced from 1,766 via TD-101) |
| `SessionWorkspaceView.ts` | 612 | Orchestrator with session panels |
| `configDocContent.ts` | 599 | Config doc markdown generators |
| `EventLogView.ts` | 581 | Single-purpose activity log |
| `DataExchangeService.ts` | 574 | Facade delegating to 5 sub-modules |
| `hub/ImportsTab.ts` | 570 | Import list + config management |
| `ExportService.ts` | 561 | Export pipeline |
| `analytics/AnalyticsDashboardPage.ts` | 546 | Dashboard homepage orchestrator |

**Resolved (2026-02-16):** `catalog/helpers.ts` (531 LOC) decomposed into barrel re-export (55 LOC) + 5 focused modules under `helpers/` (frontmatter, entryQueries, crossReferences, rendering, fileOps). No longer exceeds threshold.

## Impact

- Cognitive load when navigating large files
- Merge conflict surface area
- Some files mix rendering + state + API access

## Remaining Decomposition Opportunities

1. **DashboardsTab.ts** (1,149) — **Highest priority**. Extract callback factory + shared state with AnalyticsDashboardPage (see [[TD-128]])
2. **session/helpers.ts** (982) — Split into summaryGenerator, noteParser, templateHelpers, formatters, sessionUtils (see [[TD-118]])
3. **UserHubSessions.ts** (640) — Extract SessionDetailPanel + SessionTimerDisplay (see [[TD-113]])
4. **main.ts** (643) — Grew from 482 LOC; evaluate if more logic can be pushed to `sessionSetup.ts` or `pluginBootstrap.ts`

Note: Orchestrator files (`EventCatalogView`, `CsvActionView`, `ExportView`, `SessionWorkspaceView`) are expected to be larger since they coordinate sub-components. The 500-800 LOC range is acceptable for orchestrators.

## Affected Files

- `src/domain/session/helpers.ts` (982 LOC — highest priority)
- `src/ui/userHub/UserHubSessions.ts` (640 LOC)
- `src/main.ts` (643 LOC)
