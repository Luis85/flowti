---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies: []
tags:
  - analytics
  - export
  - dashboard
  - market-research
---

# PBI-ANA-136: Dashboard PDF/Image Export

## User Story — Problemspace
**As a** Delivery Manager, **I want** to export my dashboard as a PDF or image, **so that** I can share the "Monday morning report" with stakeholders who don't use Obsidian.

**Context:** CSV export exists for query results. Dashboard-level export (PDF/image) enables sharing with non-Obsidian users — the primary "sharing" use case from market research.

## Solution Statement
Capture dashboard tile grid as HTML, render to canvas via html2canvas (or similar), export as PNG or PDF. Include dashboard title, filter state, and timestamp in header.

If there is a possible solution with Obsidian we should take that route. We need to explore if we can export into Markdown and let the user do the pdf export with Obsidian tools.

### Architecture
| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/DashboardsTab.ts` | Export button + capture logic | +60 |
| `src/utils/pdfExport.ts` | HTML-to-canvas-to-PDF pipeline | +80 |

## Acceptance Criteria
- [ ] "Export as PNG" button in dashboard actions
- [ ] "Export as PDF" button in dashboard actions
- [ ] Includes dashboard title and active filters in header
- [ ] Timestamp in footer
- [ ] Charts render correctly in export
- [ ] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (P4 roadmap)
- Market research: "Monday morning report" use case
