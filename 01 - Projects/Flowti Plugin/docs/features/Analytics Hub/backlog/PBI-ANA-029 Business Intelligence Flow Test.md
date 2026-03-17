---
type: ProductBacklogItem
pbi: PBI-ANA-029
title: Business Intelligence Flow Test
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: delivered
delivered_in: "[[Cycle 31 - Analytics Business Intelligence]]"
priority: high
planned_in: "[[Cycle 31 - Analytics Business Intelligence]]"
related:
  - "[[PBI-ANA-025 Computed Columns]]"
  - "[[PBI-ANA-026 Quick Insights]]"
  - "[[PBI-ANA-027 Data Freshness Tracking]]"
  - "[[PBI-ANA-028 Import Analytics Bridge]]"
  - "[[Supplier Manager]]"
functional_requirements:
  - all
tags:
  - analytics
  - flow-test
  - integration
---

# PBI-ANA-029: Business Intelligence Flow Test

## User Story

As a developer, I want an integration test covering the Supplier Manager business intelligence workflow (Quick Insights → computed columns → freshness → import bridge) to ensure all v4 features work together correctly.

## Functional Requirements

All Cycle 31 FRs (FR-29 through FR-36) — integration coverage.

## Acceptance Criteria

- [ ] Flow 31 test file exists at `tests/flows/31-AnalyticsBusinessIntelligence.test.ts`
- [ ] Test covers: source loading → Quick Insight generation → suggestion application → query execution
- [ ] Test covers: computed column definition → arithmetic evaluation → result verification
- [ ] Test covers: data freshness tracking → relative time formatting → staleness detection
- [ ] Test covers: import-to-analytics mapper → inbox item creation
- [ ] Edge cases: division by zero, no numeric columns, empty expression, <2 columns
- [ ] All event subscriptions verified (no orphan state)
- [ ] `npm test` passes

## Architecture

- Flow test following existing patterns (Flow 29, Flow 30)
- Uses `createMockStorage`, `createMockFileSystem` from test utilities
- Exercises: AnalyticsEngine, AnalyticsService, quickInsights, freshnessUtils, inbox mappers
- No UI testing (flow tests are service-level integration)

## Test Intent

~15 tests across 5-6 describe blocks:
1. Quick Insights generation (3 tests: rules, edge cases)
2. Computed column arithmetic (4 tests: basic ops, division-by-zero, multi-column, invalid ref)
3. Data freshness (3 tests: relative time formatting, thresholds, summary)
4. Import bridge mapper (2 tests: mapper output, inbox integration)
5. End-to-end: source → insight → compute → save → dashboard tile (2 tests)
6. Edge cases (1 test: empty/minimal data)

## Dependencies

- ANA-025, ANA-026, ANA-027, ANA-028 (all must be complete)

## Estimated LOC

~120 (flow test file)
