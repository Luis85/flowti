---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-134 KPI Targets and RAG Status]]"
tags:
  - analytics
  - chart
  - visualization
  - market-research
---

# PBI-ANA-135: Goal Lines on Charts

## User Story — Problemspace
**As a** dashboard viewer, **I want** to see horizontal reference lines on my charts showing target values, **so that** I can visually compare actuals against goals.

## Solution Statement
Render horizontal dashed SVG line at the target value on line-chart, bar-chart, and area-chart tiles. Label shows target name and value. Uses the target value from PBI-ANA-134.

### Architecture
| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/ChartRenderer.ts` | Goal line SVG rendering | +30 |

## Acceptance Criteria
- [ ] Horizontal dashed line at target value on line/bar/area charts
- [ ] Label with target name and value
- [ ] Respects Y-axis scale
- [ ] Only shown when tile has target configured
- [ ] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (P3 roadmap)
- Depends on: [[PBI-ANA-134 KPI Targets and RAG Status]]
