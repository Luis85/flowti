---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: planned
priority: critical
dependencies:
  - "[[PBI-ANA-035 Trend Calculation Engine]]"
tags:
  - analytics
  - expression
  - scalar-function
  - supplier-management
planned_in: "[[Cycle 33 - Trend Intelligence]]"
user_story: "[[Feature - Supplier Management]]"
---

# PBI-ANA-036: Expression Functions

## User Story — Problemspace

**Persona:** Supplier Manager

**Context:** The Supplier Manager builds computed columns to derive KPIs like profit margins and cost deltas. After Inc 1 delivers trend functions, they can compute `PCT_CHANGE({Cost})` — but the result is a raw decimal like `2.3456789`. They need `ROUND` for clean display, `ABS` for magnitude-only values, and `IF` for threshold-based classification ("High"/"Low"/"Warning").

**Pains:**
- Computed columns produce raw floating point numbers — no way to round for readable KPIs
- No conditional logic — can't classify values as "High"/"Low"/"Warning" based on thresholds
- No way to express `|delta|` (absolute magnitude regardless of direction)
- Expression functions deferred for 2 cycles (C31 → C32 → C33)

**Needs:**
- `ROUND({Margin}, 2)` → `23.47` (clean KPI numbers)
- `ABS({Delta})` → always positive (magnitude)
- `IF({Margin} < 10, "Low", "OK")` → conditional classification for at-a-glance reading
- Nesting: `ROUND(PCT_CHANGE({Cost}), 1)` → `2.3` (clean trend percentage)

## Solution Statement

### Scalar Functions (first-pass, per-row evaluation)

Uses the function call parser built in PBI-ANA-035. Scalar functions are registered alongside window functions but evaluated in **pass 1** (per-row), not pass 2 (full-set).

| Function | Syntax | Behavior | Return Type |
|----------|--------|----------|-------------|
| `ROUND` | `ROUND({column}, n)` | Round to n decimal places | `number` |
| `ABS` | `ABS({column})` | Absolute value | `number` |
| `IF` | `IF({column} op threshold, then, else)` | Conditional | `string \| number` |

**IF function details:**
- Condition operators: `>`, `<`, `>=`, `<=`, `=`, `!=`
- Then/else values: numeric literal, string literal (double-quoted), or column reference `{Column}`
- Single condition only (no AND/OR); nested `IF(IF(...))` is a workaround for compound logic
- Returns `string | number` — broadens the computed column contract

### Contract Change: `evaluateExpression` returns `string | number`

Currently `evaluateExpression()` always returns `number`. IF() returning `"Low"` or `"OK"` broadens this to `string | number`.

**Impact assessment:**
- `ResultRow` is `Record<string, string | number>` — **no change needed**
- Table rendering handles strings — **no change needed**
- Stat-card rendering uses string interpolation — **no change needed**
- Conditional formatting `evaluateConditionalRules` expects `number` — **skip** string values
- Chart `extractChartData` parses numbers — **exclude** string values from axes

### Function Reference Help

- Add collapsible "Available Functions" info section in ComputedColumnsSection
- Shows all 6 functions with one-line syntax and description
- Collapsed by default; toggle via "?" help icon
- Helps discoverability — users won't know `PCT_CHANGE({Cost})` exists without it

### Functional Requirements

- FR-46: ROUND({column}, n) rounds to n decimal places
- FR-47: ABS({column}) returns absolute value
- FR-48: IF({column} op threshold, then, else) conditional with string | number return

### Architecture

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/AnalyticsEngine.ts` | Register scalar functions in evaluator pipeline | +60 |
| `src/domain/analytics/expressionFunctions.ts` | **New** — ROUND, ABS, IF implementations | +110 |
| `src/domain/analytics/types.ts` | Update evaluateExpression return type to `string \| number` | +5 |
| `src/ui/analytics/queries/ComputedColumnsSection.ts` | Add function reference help section | +35 |

### Acceptance Criteria

- [ ] `ROUND({column}, N)` rounds values to N decimal places
- [ ] `ABS({column})` returns absolute value of negative numbers
- [ ] `IF({column} > N, "High", "Low")` returns conditional string values
- [ ] `IF({column} >= N, {otherColumn}, 0)` supports column references in then/else
- [ ] Nested expressions work: `ROUND(PCT_CHANGE({Cost}), 1)` → `2.3`
- [ ] `evaluateExpression` return type is `string | number`
- [ ] String-valued computed columns display correctly in tables and stat-cards
- [ ] Conditional formatting rules skip string-valued columns gracefully
- [ ] Function reference help shows all 6 available functions with syntax
- [ ] Invalid function names produce clear error message (not silent failure)
- [ ] Existing computed column and trend calculation tests pass
- [ ] `npm test` passes

## Test Intent

~18 tests covering:
- 5 ROUND (basic, 0 decimals, negative, edge precision, with column reference)
- 4 ABS (positive, negative, zero, with arithmetic)
- 6 IF (string return, numeric return, column reference, all operators, nested IF, missing column)
- 3 nesting/contract/edge cases (ROUND(PCT_CHANGE), string in table, conditional skip)

## Related

- PRD: [[Analytics Hub PRD]] (FR-46, FR-47, FR-48)
- Cycle: [[Cycle 33 - Trend Intelligence]] (Inc 2)
- Depends on: [[PBI-ANA-035 Trend Calculation Engine]] (function call parser)
- Supplier PRD: [[Feature - Supplier Management]] (§10 Consistent KPI formatting)
- Deferred from: Cycle 31 → Cycle 32 → Cycle 33 (2-cycle deferral)
