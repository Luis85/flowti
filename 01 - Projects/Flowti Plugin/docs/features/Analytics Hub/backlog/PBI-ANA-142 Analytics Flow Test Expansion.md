---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-130 Date Range Filter]]"
  - "[[PBI-ANA-132 Cross-Tile Filtering]]"
  - "[[PBI-ANA-133 Dashboard File Watcher]]"
tags:
  - analytics
  - testing
  - flow-tests
  - quality
planned_in: "[[Cycle 44 - Analytics Hub Filtering & Decomposition]]"
---

# PBI-ANA-142: Analytics Flow Test Expansion

## User Story

As a developer maintaining the Analytics Hub, I want flow integration tests covering measurement lifecycle, date range filtering, cross-tile interaction, and file watcher behavior so that regressions in these critical user journeys are caught automatically.

## Solution Statement

Add 4 new flow test suites (Flows 20–23) covering the measurement lifecycle gap identified in C43 retro plus the three new features delivered in this cycle. All flows test through AnalyticsService + AnalyticsEngine at domain level, following the pattern established by C43 flow tests (Flows 17–19).

## Acceptance Criteria

- [ ] Flow 20: Measurement lifecycle — create, link to tile, cross-refs, delete cascade (8+ tests)
- [ ] Flow 21: Date range filter — presets, custom range, composition with dimension filters (8+ tests)
- [ ] Flow 22: Cross-tile filter — click propagation, replace, clear, composition (8+ tests)
- [ ] Flow 23: File watcher — selective refresh, debounce, cleanup (6+ tests)
- [ ] All flows use isolated AnalyticsService instances (no test leakage)
- [ ] Total: ~30 tests across 4 suites
- [ ] `npm test` passes

## Related

- Continues: [[PBI-ANA-126 Analytics Flow Integration Tests]] (C43 — Flows 17–19)
- Tests: [[PBI-ANA-130 Date Range Filter]], [[PBI-ANA-132 Cross-Tile Filtering]], [[PBI-ANA-133 Dashboard File Watcher]]
- Gap: Measurement lifecycle flow identified in C43 retrospective
