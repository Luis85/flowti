---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-ANA-035 Trend Calculation Engine]]"
  - "[[PBI-ANA-036 Expression Functions]]"
  - "[[PBI-ANA-037 Conditional Formatting Rule Builder UI]]"
  - "[[PBI-ANA-038 Analytics Hub Homepage Polish]]"
tags:
  - analytics
  - flow-test
  - integration
  - supplier-management
planned_in: "[[Cycle 33 - Trend Intelligence]]"
---

# PBI-ANA-039: Trend Intelligence Flow Test

## User Story — Problemspace

**Context:** Increments 1-4 deliver trend calculations, expression functions, conditional formatting UI, and homepage polish independently. This PBI integrates all deliverables into an end-to-end flow test verifying the Supplier Manager's trend intelligence workflow, and updates the Analytics Hub PRD to v7.

## Solution Statement

### Flow 33 Integration Test

Test file: `tests/flows/33-TrendIntelligence.test.ts`

**Workflow under test:**
1. Create analytics query with CSV source (mock supplier cost data with monthly rows)
2. Execute query → verify raw aggregated results
3. Add computed column: `PCT_CHANGE({Total Cost})` → verify MoM % values (null for first row)
4. Add computed column: `ROUND(PCT_CHANGE({Total Cost}), 1)` → verify rounded output
5. Add computed column: `IF({Margin} < 10, "Low", "OK")` → verify string classification
6. Add computed column: `ROLLING_AVG({Total Cost}, 3)` → verify rolling average
7. Save query → create dashboard → add tile as table
8. Configure conditional rules on tile: `PCT_CHANGE({Total Cost}) > 5` → color "negative"
9. Verify rule evaluation applies color to matching cells
10. Pin dashboard to homepage → verify compact card renders
11. Verify saved queries above sources in queries list

**Edge cases:**
- Single row result → CHANGE/PCT_CHANGE return null
- Zero-division in PCT_CHANGE → null, not Infinity
- IF with string return → table renders string, conditional formatting skips
- Empty result set → no computed columns evaluated
- Pin 4th dashboard → fails gracefully (max 3)

### PRD Update to v7

- Update version: 6 → 7
- Update updated date
- Mark FR-43 through FR-51 as checked (delivered)
- Verify v6 types section
- Verify v6 acceptance criteria
- Update extended backlog PBI stages to "delivered"
- Update delivery notes

### Architecture

| File | Action | ~LOC |
|------|--------|------|
| `tests/flows/33-TrendIntelligence.test.ts` | **New** — flow integration test | +130 |
| `docs/features/Analytics Hub/Analytics Hub PRD.md` | Update to v7: check FRs, update stages, delivery notes | ~30 lines |

### Acceptance Criteria

- [ ] Flow 33 test passes (~12 tests covering trend + formatting + homepage workflow)
- [ ] CHANGE, PCT_CHANGE, ROLLING_AVG produce correct values in flow context
- [ ] ROUND, ABS, IF produce correct values in flow context
- [ ] Conditional rules apply colors in flow context
- [ ] Pinned dashboard renders on homepage in flow context
- [ ] Edge cases handled: null for first row, zero-division, string IF values, max pin limit
- [ ] Analytics Hub PRD updated to v7 with all new FRs checked
- [ ] All 19 analytics events fire correctly (no orphan subscriptions)
- [ ] `npm test` passes — all tests green

## Test Intent

~12 tests covering:
- 3 trend calculations (CHANGE value chain, PCT_CHANGE with null/zero, ROLLING_AVG partial window)
- 3 expression functions (ROUND precision, ABS sign, IF string + numeric paths)
- 2 conditional formatting (rule evaluation, string column skip)
- 2 homepage (pinned card rendering, max pin enforcement)
- 2 edge cases (empty result, single row)

## Related

- PRD: [[Analytics Hub PRD]] (v7 update)
- Cycle: [[Cycle 33 - Trend Intelligence]] (Inc 5)
- Depends on: [[PBI-ANA-035 Trend Calculation Engine]], [[PBI-ANA-036 Expression Functions]], [[PBI-ANA-037 Conditional Formatting Rule Builder UI]], [[PBI-ANA-038 Analytics Hub Homepage Polish]]
- Pattern: Follows [[31-AnalyticsBusinessIntelligence.test.ts]], [[32-AnalyticsVisualization.test.ts]] flow test conventions
