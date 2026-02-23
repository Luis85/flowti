---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-020 Query Power Features]]"
  - "[[PBI-ANA-021 Source Preview and Query Usability]]"
  - "[[PBI-ANA-022 Enhanced Stat-Card and Tile Management]]"
  - "[[PBI-ANA-023 Dashboard Actions and Hub Polish]]"
tags:
  - analytics
  - flow-test
  - integration
planned_in: "[[Cycle 30 - Analytics UX Mastery]]"
user_story: "[[Supplier Manager]]"
---

## User Story - Problemspace

As a developer, I want an end-to-end integration test covering the full Analytics UX Mastery workflow — so that I can verify all Cycle 30 features work together and catch regressions early.

### User Pains

- No integration test covering filters, sort, limit, rename, duplicate, tile reorder, or multi-row stat cards
- Individual unit tests cannot catch interaction bugs between engine pipeline, service, and UI state

### User Needs

- Flow 30 integration test exercising all Cycle 30 features end-to-end
- Edge case coverage (empty filters, sort on non-numeric, limit=0, duplicate of duplicate)
- Event emission verification for all 3 new events

## Solutionstatement

### Functional Requirements

- [ ] Flow 30 test covering: query with filters, sort + limit, source preview columns, rename + duplicate, tile reorder, multi-row stat-card, dashboard rename, Refresh All, new event emissions
- [ ] Edge cases: empty filter values handled gracefully, sort on string column works, limit=0 returns no rows, duplicate of duplicate appends "(copy)"

### Architecture

- `tests/flows/30-AnalyticsUXMastery.test.ts` — **New** — flow integration test (+120 LOC)

## Acceptance Criteria

- [ ] Flow 30 test passes (~15 tests)
- [ ] Query with filters: add filter, verify filtered results exclude non-matching rows
- [ ] Query sort + limit: verify result ordering and row count capped
- [ ] Source preview: verify column listing matches source headers
- [ ] Query rename: verify new name persists
- [ ] Query duplicate: verify clone exists with " (copy)" suffix
- [ ] Tile reorder: verify tile position changes in dashboard
- [ ] Multi-row stat-card: verify all dimension groups present in result
- [ ] Dashboard rename: verify new name persists
- [ ] New events emitted: `analytics.query.renamed`, `analytics.query.duplicated`, `analytics.dashboard.tile.reordered`
- [ ] Edge cases handled gracefully (no crashes, sensible defaults)
- [ ] All existing tests pass — no regressions
- [ ] `npm test` passes

## Test Intent

~15 tests across 6 describe blocks: filter pipeline (3), sort + limit (3), source preview (1), rename + duplicate (3), tile management (3), event emission (2).

## Related

- PRD: [[Analytics Hub PRD]]
- Cycle: [[Cycle 30 - Analytics UX Mastery]]
- Persona: [[Supplier Manager]]
- Depends on: [[PBI-ANA-020 Query Power Features]], [[PBI-ANA-021 Source Preview and Query Usability]], [[PBI-ANA-022 Enhanced Stat-Card and Tile Management]], [[PBI-ANA-023 Dashboard Actions and Hub Polish]]
