---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies: []
tags:
  - analytics
  - refresh
  - dashboard
  - market-research
---

# PBI-ANA-133: Dashboard File Watcher

## User Story — Problemspace
**As a** Supplier Manager, **I want** my dashboard to automatically refresh when source CSV files change, **so that** I always see current data without manually clicking Refresh All.

**Context:** "Refresh All" button exists (C39). File watcher would auto-detect changes to source files and trigger tile re-execution. Low-medium effort with high daily-use impact.

## Solution Statement
Subscribe to Obsidian's `vault.on("modify")` for files matching dashboard source paths. Debounce file change events (2s). Auto-refresh affected tiles. Show "Updated" toast notification.

### Architecture
| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | File watcher subscription + debounce | +40 |
| `src/domain/analytics/AnalyticsService.ts` | Tile invalidation by source path | +20 |

## Acceptance Criteria
- [ ] Auto-refresh when source CSV files are modified
- [ ] 2-second debounce to avoid rapid re-execution
- [ ] Only affected tiles refresh (not all tiles)
- [ ] "Updated" toast notification
- [ ] Watcher cleaned up on hub close
- [ ] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (P2 roadmap)
