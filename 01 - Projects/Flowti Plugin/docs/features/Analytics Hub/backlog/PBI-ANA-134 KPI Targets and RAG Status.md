---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies: []
tags:
  - analytics
  - kpi
  - dashboard
  - market-research
---

# PBI-ANA-134: KPI Targets & RAG Status

## User Story — Problemspace
**As a** Delivery Manager, **I want** to set target values for KPI tiles with Red/Amber/Green (RAG) status indicators, **so that** I can instantly see which metrics are on track and which need attention.

**Context:** Conditional formatting exists but lacks a "target/goal" concept. RAG status is the universal SMB dashboard language. This extends the existing conditional formatting system.

## Solution Statement
Add `target` and `ragThresholds` fields to DashboardTile. Stat-card tiles show target comparison (actual vs target, % of target). RAG indicator: green (>=90% of target), amber (70-89%), red (<70%). Thresholds configurable per tile via TileSettingsPanel.

### Architecture
| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | target, ragThresholds on DashboardTile | +15 |
| `src/ui/analytics/DashboardTileRenderer.ts` | RAG indicator rendering | +40 |
| `src/ui/analytics/TileSettingsPanel.ts` | Target + threshold config UI | +50 |

## Acceptance Criteria
- [ ] Target value configurable per tile
- [ ] RAG indicator (green/amber/red) on stat-card tiles
- [ ] % of target displayed next to actual value
- [ ] Thresholds configurable (default 90%/70%)
- [ ] Works with existing conditional formatting
- [ ] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (P3 roadmap)
- Market research: Universal SMB dashboard language
