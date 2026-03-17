---
type: ProductBacklogItem
pbi: PBI-ANA-032
title: Conditional Formatting
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: delivered
priority: high
planned_in: "[[Cycle 32 - Analytics Visualization Sprint]]"
related:
  - "[[PBI-ANA-027 Data Freshness Tracking]]"
  - "[[PBI-ANA-022 Enhanced Stat-Card and Tile Management]]"
  - "[[Feature - Supplier Management]]"
functional_requirements:
  - FR-39
  - FR-40
tags:
  - analytics
  - visualization
  - formatting
---

# PBI-ANA-032: Conditional Formatting

## User Story

As a Supplier Manager, I want cost increases highlighted in red and margin improvements in green so that I can immediately spot anomalies and positive trends without scanning numbers manually.

## Functional Requirements

- **FR-39**: User can configure conditional formatting rules per tile; each rule specifies a column, comparison operator, threshold value, and color
- **FR-40**: Conditional formatting applies color coding to stat-card values (text color) and table cells (background tint) based on matching rules

## Acceptance Criteria

- [ ] `ConditionalRule` type with column, operator, threshold, color
- [ ] `conditionalRules?: ConditionalRule[]` on DashboardTile type
- [ ] Conditional rules configurable per tile via UI (add/remove)
- [ ] Rule UI: column dropdown, operator dropdown, threshold input, color preset picker
- [ ] Rules evaluate against cell values; first match applies color
- [ ] Stat-card values show colored text based on matching rules
- [ ] Table cells show subtle background tint based on matching rules
- [ ] Built-in color presets: positive (green), negative (red), warning (amber)
- [ ] Custom CSS color strings accepted alongside presets
- [ ] Rules persist in tile configuration via existing updateTile path
- [ ] No-match cells render with default styling (no change)
- [ ] `npm test` passes

## Architecture

- `ConditionalRule` type in `src/domain/analytics/types.ts`
- Rule evaluation: pure function `evaluateConditionalRules(value: number, rules: ConditionalRule[]): string | null` returns CSS color or null
- Built-in color map: `{ positive: "var(--text-success)", negative: "var(--text-error)", warning: "var(--text-warning)" }`
- DashboardTileRenderer applies rules during cell rendering
- DashboardsTab: formatting section in tile configuration area
- No new events — uses existing `analytics.dashboard.tile.updated` event

## Test Intent

~15 tests:
- Rule evaluation: greater than, less than, equals, thresholds
- Multiple rules: first match wins
- No match returns null (default styling)
- Color preset resolution (name → CSS variable)
- Custom CSS color passthrough
- Persistence round-trip (save → load → rules intact)

## Dependencies

- None (independent, but follows Inc 2 for tile renderer coherence)

## Estimated LOC

~150 (10 types + 60 tile renderer + 80 UI)
