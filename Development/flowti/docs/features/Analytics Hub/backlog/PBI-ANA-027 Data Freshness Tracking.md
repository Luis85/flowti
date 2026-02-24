---
type: ProductBacklogItem
pbi: PBI-ANA-027
title: Data Freshness Tracking
domain: analytics
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
planned_in: "[[Cycle 31 - Analytics Business Intelligence]]"
related:
  - "[[PBI-ANA-018 Dashboard UX Polish]]"
  - "[[Supplier Manager]]"
functional_requirements:
  - FR-33
  - FR-34
tags:
  - analytics
  - dashboard
  - freshness
  - ux
---

# PBI-ANA-027: Data Freshness Tracking

## User Story

As a Supplier Manager, I want each dashboard tile to show when its data was last refreshed so that I can trust whether I'm looking at today's numbers or stale data.

## Functional Requirements

- **FR-33**: Each dashboard tile displays a relative time indicator showing when the tile's query was last executed ("3 min ago", "1 hour ago")
- **FR-34**: Tiles are visually color-coded by freshness: green (<15 min), amber (15 min – 1 hr), red (>1 hr); dashboard header shows freshness summary

## Acceptance Criteria

- [ ] TileResultCache tracks `lastRefreshedAt` timestamp per query ID
- [ ] Timestamp set when query result arrives (in `tryRun` callback)
- [ ] DashboardTileRenderer shows relative time in tile header
- [ ] `formatRelativeTime(timestamp)` utility: "just now" / "N min ago" / "N hr ago" / "N days ago"
- [ ] Color coding: green (<15 min), amber (15 min – 1 hr), red (>1 hr)
- [ ] New tiles show "Not yet refreshed" until first execution
- [ ] Dashboard header shows freshness summary: "All tiles fresh" / "N stale tiles"
- [ ] Freshness updates on tile refresh (per-tile and Refresh All)
- [ ] `npm test` passes

## Architecture

- TileResultCache extended with timestamp Map<string, number> + getTimestamp/setTimestamp
- `formatRelativeTime()` pure function in new `src/domain/analytics/freshnessUtils.ts`
- DashboardTileRenderer: freshness badge in tile header (small text, right-aligned)
- AnalyticsDashboardPage: freshness summary in default dashboard header

## Test Intent

~10 tests:
- `formatRelativeTime()`: seconds → "just now", minutes, hours, days
- Freshness thresholds: green/amber/red color selection
- Dashboard summary: all fresh, mixed, all stale
- New tile (no timestamp) → "Not yet refreshed"
- Refresh updates timestamp

## Dependencies

- None (independent of Inc 1/2)

## Estimated LOC

~95 (25 freshnessUtils + 35 renderer + 20 dashboard page + 15 cache)
