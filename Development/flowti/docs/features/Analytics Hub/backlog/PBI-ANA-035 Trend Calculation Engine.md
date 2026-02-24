---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies:
  - "[[PBI-ANA-025 Computed Columns]]"
tags:
  - analytics
  - trend
  - window-function
  - supplier-management
planned_in: "[[Cycle 33 - Trend Intelligence]]"
user_story: "[[Feature - Supplier Management]]"
---

# PBI-ANA-035: Trend Calculation Engine

## User Story — Problemspace

**Persona:** Supplier Manager

**Context:** The Supplier Manager imports monthly CSV reports and builds dashboards to monitor cost, sales, and inventory KPIs. Since Cycle 32, they can see line charts and sparklines showing raw values. But the dashboard cannot answer the most fundamental trend question: *"Did cost go up or down compared to last month?"*

**Pains:**
- Dashboard shows aggregated values (e.g., cost per month) but no period-over-period change
- The Supplier Manager must mentally compute month-over-month differences by reading adjacent numbers
- No rolling averages to smooth out noise — monthly fluctuations mask underlying trends
- The Supplier Management PRD (§6.1, §6.5) explicitly requires "MoM Cost Change %" and "Rolling averages" as core KPIs

**Needs:**
- Computed column functions that calculate change from the previous row
- Percentage change for relative comparison (5% increase vs $500 increase)
- Rolling averages to reveal underlying trends behind monthly noise

## Solution Statement

### Foundation: Function Call Parser

The current `evaluateExpression()` in `AnalyticsEngine.ts` uses `tokenizeArithmetic()` which only recognizes `{Column Label}` references, numbers, and `+`, `-`, `*`, `/` operators. It has no concept of function calls.

**Build a function call recognizer** that detects `FUNCTION_NAME(args)` patterns within expressions:
- Parser extracts function name and arguments from the expression
- Function tokens are resolved before arithmetic evaluation
- Parser supports nested function calls (prepared for Inc 2 scalar functions): `ROUND(PCT_CHANGE({Cost}), 1)`
- Functions are identified by uppercase names; column references remain in `{braces}` — no ambiguity

### Window Functions (second-pass evaluation)

Window functions differ from per-row calculations — they need access to previous rows in the result set. Implementation uses a **three-tier evaluation pipeline**:

1. **Per-row arithmetic** (`+`, `-`, `*`, `/`) — existing, unchanged
2. **Per-row scalar functions** (`ROUND`, `ABS`, `IF`) — Inc 2 will add these
3. **Full-set window functions** (`CHANGE`, `PCT_CHANGE`, `ROLLING_AVG`) — this increment

**New functions:**

| Function | Syntax | Behavior | Edge Cases |
|----------|--------|----------|------------|
| `CHANGE` | `CHANGE({column})` | `currentValue - previousValue` | First row → null |
| `PCT_CHANGE` | `PCT_CHANGE({column})` | `((current - previous) / previous) * 100` | First row → null; previous = 0 → null |
| `ROLLING_AVG` | `ROLLING_AVG({column}, n)` | Average of last n values (inclusive) | First n-1 rows → partial window average |

**Implementation:**
- New file `trendCalculations.ts` with pure functions: `computeChange()`, `computePctChange()`, `computeRollingAvg()`
- `AnalyticsEngine.applyComputedColumns()` detects window function tokens in computed column expressions → delegates to a second pass after per-row evaluation
- Window functions operate on aggregated result rows in their ORDER BY order
- Null values rendered as `"—"` by DashboardTileRenderer (existing null handling)

### Functional Requirements

- FR-43: CHANGE({column}) computes absolute difference from previous row
- FR-44: PCT_CHANGE({column}) computes percentage change from previous row
- FR-45: ROLLING_AVG({column}, n) computes rolling average over n periods

### Architecture

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsEngine.ts` | Add function call parser + window evaluation pass | +140 |
| `src/domain/analytics/types.ts` | Add `FunctionToken` type, document function signatures | +20 |
| `src/domain/analytics/trendCalculations.ts` | **New** — pure window function implementations | +100 |

### Acceptance Criteria

- [ ] Function call parser recognizes `FUNCTION_NAME(args)` in expressions
- [ ] `CHANGE({column})` computes absolute difference from previous row
- [ ] `PCT_CHANGE({column})` computes percentage change from previous row
- [ ] `ROLLING_AVG({column}, 3)` computes 3-period rolling average
- [ ] Window functions return null for insufficient data points (first row for CHANGE/PCT_CHANGE)
- [ ] Zero-division in PCT_CHANGE returns null (not Infinity)
- [ ] Window functions work alongside standard arithmetic: `{Revenue} - CHANGE({Cost})`
- [ ] Parser handles nested function calls (prepared for Inc 2 scalar functions)
- [ ] Existing computed column tests pass without modification
- [ ] `npm test` passes

## Test Intent

~22 tests covering:
- 4 function call parser (recognition, nesting, error handling, mixed with arithmetic)
- 6 CHANGE (basic, negative change, first row null, non-numeric, multiple columns, with arithmetic)
- 6 PCT_CHANGE (basic, zero-division, first row null, negative change, large numbers, rounding)
- 3 ROLLING_AVG (basic, partial window, single row)
- 3 edge cases (empty result, all null values, mixed window + arithmetic)

## Related

- PRD: [[Analytics Hub PRD]] (FR-43, FR-44, FR-45)
- Cycle: [[Cycle 33 - Trend Intelligence]] (Inc 1)
- Supplier PRD: [[Feature - Supplier Management]] (§6.1 MoM Cost Change %, §6.5 Rolling averages)
- Depends on: [[PBI-ANA-025 Computed Columns]] (extends expression evaluator)
- Enables: [[PBI-ANA-036 Expression Functions]] (scalar functions use same parser)
