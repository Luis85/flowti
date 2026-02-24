---
type: ProductBacklogItem
pbi: PBI-ANA-030
title: QueriesTab Sub-Component Extraction
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: delivered
priority: critical
planned_in: "[[Cycle 32 - Analytics Visualization Sprint]]"
related:
  - "[[PBI-ANA-021 Source Preview and Query Usability]]"
  - "[[PBI-ANA-025 Computed Columns]]"
  - "[[PBI-ANA-026 Quick Insights]]"
functional_requirements:
  - none (refactor)
tags:
  - analytics
  - tech-debt
  - refactor
---

# PBI-ANA-030: QueriesTab Sub-Component Extraction

## User Story

As a developer, I want the QueriesTab (1,264 LOC) decomposed into focused sub-components so that the codebase remains maintainable and future visualization features can be added confidently.

## Context

QueriesTab has grown across 4 cycles (C28–C31) from ~450 LOC to 1,264 LOC. It was flagged:
- C30 review: "Monitor QueriesTab LOC; extract if >1,200" (TD-ANA-001)
- C31 review: AI-2 "Consider QueriesTab extraction into sub-components (1,264 LOC)"
- C31 review: OB-1 "QueriesTab growing large"

The component handles source management, source preview, Quick Insight cards, query builder (dimensions, measures, filters, sort, limit), computed columns, results rendering, saved query list, and CRUD actions. This is too many responsibilities for a single component.

## Functional Requirements

None — pure refactor with zero functional changes.

## Acceptance Criteria

- [ ] QueriesTab reduced to ~350 LOC thin orchestrator
- [ ] 5 sub-components created in `src/ui/analytics/queries/` directory
- [ ] SourcePanel: source picker, preview panel, Quick Insight cards
- [ ] QueryBuilderPanel: dimensions, measures, filters, sort, limit
- [ ] ComputedColumnsSection: computed column add/remove/edit
- [ ] ResultsSection: query results rendering, export actions, error display
- [ ] SavedQueryList: saved query master list with star icons, search, CRUD
- [ ] All existing behavior preserved — zero functional changes
- [ ] All existing tests pass without modification
- [ ] `npm test` passes

## Architecture

- Sub-components follow existing pattern: `constructor(el, deps)`, `render()`
- QueriesTab orchestrator: owns state, creates sub-component instances, delegates render calls
- Sub-components access shared state via `deps.getState()` / `deps.setState(partial)` pattern
- File structure: `src/ui/analytics/queries/{SourcePanel,QueryBuilderPanel,ComputedColumnsSection,ResultsSection,SavedQueryList}.ts`

## Test Intent

0 new tests — pure refactor. Existing tests (flow 25, 28, 29, 30, 31 + AnalyticsResultsPanel unit test) provide coverage.

## Dependencies

- None

## Estimated LOC

~0 net (redistribution of 1,264 LOC into 5 sub-components + orchestrator)
