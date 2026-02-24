---
type: ProductBacklogItem
pbi: PBI-ANA-034
title: Visualization Flow Test
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: delivered
priority: high
planned_in: "[[Cycle 32 - Analytics Visualization Sprint]]"
related:
  - "[[PBI-ANA-031 Chart Tile Foundation]]"
  - "[[PBI-ANA-032 Conditional Formatting]]"
  - "[[PBI-ANA-033 Chart Polish and Sparklines]]"
  - "[[Feature - Supplier Management]]"
functional_requirements:
  - all
tags:
  - analytics
  - flow-test
  - integration
---

# PBI-ANA-034: Visualization Flow Test

## User Story

As a developer, I want an integration test covering the Analytics Hub visualization workflow (chart rendering → conditional formatting → sparklines) to ensure all v5 features work together correctly.

## Functional Requirements

All Cycle 32 FRs (FR-37 through FR-42) — integration coverage.

## Acceptance Criteria

- [ ] Flow 32 test file exists at `tests/flows/32-AnalyticsVisualization.test.ts`
- [ ] Test covers: query execution → save → dashboard → add tile → chart mode selection → SVG verification
- [ ] Test covers: conditional rule creation → rule evaluation → color application verification
- [ ] Test covers: stat-card tile with ≥3 rows → sparkline rendering verification
- [ ] Test covers: tile mode toggle through all 4 modes (table, stat-card, line-chart, bar-chart)
- [ ] Edge cases: empty result, single row, many groups, non-numeric dimension
- [ ] Stale JSDoc in events.ts fixed (AI-1 from Cycle 31)
- [ ] All event subscriptions verified (no orphan state)
- [ ] `npm test` passes

## Architecture

- Flow test following existing patterns (Flow 29, 30, 31)
- Uses `createMockStorage`, `createMockFileSystem` from test utilities
- Exercises: AnalyticsEngine, AnalyticsService, ChartRenderer, conditional rule evaluation
- No UI testing (flow tests are service-level integration)
- ChartRenderer tested via SVG string output assertions

## Test Intent

~20 tests across 5-6 describe blocks:
1. Chart rendering (4 tests: line chart SVG, bar chart SVG, axis detection, empty data)
2. Conditional formatting (4 tests: rule evaluation, presets, first-match, no-match)
3. Sparkline generation (3 tests: threshold, SVG output, toggle)
4. Tile mode management (3 tests: mode toggle, add with chart mode, persist)
5. End-to-end: query → chart tile → conditional rule → verify (3 tests)
6. Edge cases (3 tests: single point, many groups, non-numeric)

## Dependencies

- ANA-030, ANA-031, ANA-032, ANA-033 (all must be complete)

## Estimated LOC

~130 (flow test file)
