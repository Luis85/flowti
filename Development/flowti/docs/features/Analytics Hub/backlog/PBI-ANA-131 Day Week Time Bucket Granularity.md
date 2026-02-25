---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies: []
tags:
  - analytics
  - time-bucket
  - query-builder
  - market-research
---

# PBI-ANA-131: Day/Week Time Bucket Granularity

## User Story — Problemspace
**As a** Supplier Manager tracking daily operations, **I want** day and week-level time bucketing in queries, **so that** I can see granular trends beyond monthly and quarterly views.

**Context:** Existing time bucketing supports month/quarter/year. Day and week granularity unblocks daily operations dashboards and pairs naturally with the date range filter (PBI-ANA-130).

## Solution Statement
Add "day" and "week" options to TimeBucketSpec.granularity. Week bucketing uses ISO 8601 week numbers. Day bucketing uses YYYY-MM-DD format.

### Architecture
| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsEngine.ts` | Day/week bucket logic | +20 |
| `src/domain/analytics/dateUtils.ts` | ISO week number calculation | +15 |
| `src/domain/analytics/types.ts` | Extend TimeBucketGranularity | +2 |

## Acceptance Criteria
- [ ] "day" and "week" granularity options in time bucket dropdown
- [ ] Day bucketing formats as YYYY-MM-DD
- [ ] Week bucketing uses ISO 8601 week numbers (W01-W53)
- [ ] Charts render correctly with daily/weekly x-axis
- [ ] `npm test` passes

## Related
- PRD: [[Analytics Hub PRD]] (P1 roadmap)
- Pairs with: [[PBI-ANA-130 Date Range Filter]]
