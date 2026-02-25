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

# PBI-ANA-137: Dashboard Markdown Export

## User Story — Problemspace
**As a** knowledge worker, **I want** to generate a Markdown vault note from my dashboard snapshot, **so that** I can reference dashboard state in my notes and share it within the vault.

**Context:** Template JSON export delivered in C42. Markdown export renders dashboard state as a readable vault note with tables and metadata — the Flowti-native sharing mechanism.

## Solution Statement
Generate a Markdown note with: dashboard title, active filters, per-tile sections (title + result table in markdown format + chart description), and metadata (timestamp, query references). Save to vault via `app.vault.create()`.

### Architecture
| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/markdownExport.ts` | Dashboard-to-markdown renderer | +80 |
| `src/ui/analytics/DashboardsTab.ts` | "Export as Note" button | +15 |

## Acceptance Criteria
- [ ] "Export as Note" button in dashboard actions
- [ ] Generated note includes dashboard title and filters
- [ ] Per-tile sections with markdown tables
- [ ] Chart tiles described textually (dimensions, measures, top values)
- [ ] Metadata section with timestamp and query links
- [ ] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (P4 roadmap)
- Inbox: [[Every created Dashboard must create a Dashboard Specification Markdown File and a corresponding JSON file]]
- Inbox: [[How can we generate a Markdown from our Dashboards and Reports for further Usage]]
