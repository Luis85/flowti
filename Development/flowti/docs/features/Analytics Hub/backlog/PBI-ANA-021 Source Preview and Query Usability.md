---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-020 Query Power Features]]"
tags:
  - analytics
  - query
  - usability
planned_in: "[[Cycle 30 - Analytics UX Mastery]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As a Supplier Manager building queries, I want to preview a source's columns and sample data before committing, rename queries for identification, and duplicate queries for iterative analysis — so that I can work confidently and efficiently.

### User Pains

- Source selection is blind — user picks a CSV with no idea what columns it contains or how many rows it has
- Queries auto-named by timestamp ("Query 2026-02-23 22:52") — useless for identification after 5+ queries
- No way to iterate on a query — must rebuild from scratch instead of cloning an existing one
- Long query builder form is visually overwhelming with all sections expanded

### User Needs

- Source preview: columns, inferred types, row count, first 5 sample rows
- Query rename with persistence
- Query duplicate (deep copy with new ID + " (copy)" suffix)
- Collapsible builder sections for visual clarity

## Solutionstatement

### Functional Requirements

- [ ] FR-24: Source preview panel shows column names, inferred types, row count, and first 5 sample rows when a source is loaded
- [ ] FR-25: User can rename a saved query; new name persists
- [ ] FR-26: User can duplicate a saved query; clone has new ID and " (copy)" suffix
- [ ] Query builder sections are collapsible (click header to toggle)
- [ ] `analytics.query.renamed` event emitted on rename
- [ ] `analytics.query.duplicated` event emitted on duplicate

### Architecture

- `src/ui/analytics/SourcePreviewPanel.ts` — **New** — column preview table + sample rows (+80 LOC)
- `src/domain/analytics/AnalyticsService.ts` — Add `renameQuery()`, `duplicateQuery()` methods (+40 LOC)
- `src/domain/analytics/events.ts` — Add 2 events (renamed, duplicated) (+15 LOC)
- `src/infrastructure/events/catalog.ts` — Register 2 events (+5 LOC)
- `src/ui/analytics/QueriesTab.ts` — Source preview integration, rename/duplicate actions, collapsible sections (+80 LOC)

## Acceptance Criteria

- [ ] Loaded source shows column names, inferred types, row count, and first 5 sample rows
- [ ] "Rename" action prompts for new name and persists it
- [ ] "Clone" action creates duplicate query with " (copy)" suffix
- [ ] Both actions emit events with correct payloads
- [ ] Query builder sections are collapsible (click header to toggle)
- [ ] Events registered in Event Catalog under "Analytics" category
- [ ] Existing tests pass — no regressions
- [ ] `npm test` passes

## Test Intent

~15 tests: renameQuery (3: happy path, not found, empty name), duplicateQuery (3: happy path, preserves all fields, name suffix), event emission (2), source preview column inference (3), source preview sample rows (2), collapsible section state (2).

## Related

- PRD: [[Analytics Hub PRD]] (FR-24, FR-25, FR-26)
- Cycle: [[Cycle 30 - Analytics UX Mastery]]
- Persona: [[Supplier Manager]]
- Depends on: [[PBI-ANA-020 Query Power Features]]
