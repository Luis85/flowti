---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies: []
tags:
  - analytics
  - validation
  - computed-columns
planned_in: "[[Cycle 38 - Query Builder Improvements]]"
delivered_in: "[[Cycle 38 - Query Builder Improvements]]"
---

# PBI-ANA-073: Expression Validation

## User Story

As a Supplier Manager, I want immediate feedback when I write an invalid computed column expression so that I can fix syntax errors before executing the query, instead of seeing cryptic runtime failures.

## Solution Statement

Implement a pure expression validator that checks computed column expressions for common errors and displays validation results inline on blur.

**`expressionValidator.ts` (~138 LOC):**
- `validateExpression(expr: string, columns: string[]): { valid: boolean, errors: string[] }`
- Validation checks:
  - Empty expression
  - Unbalanced braces (`{` without `}` or vice versa)
  - Unknown column references (column name inside `{}` not found in available columns)
  - Unknown function names (uppercase identifier before `(` not in recognized function list)
  - Wrong argument counts for known functions (e.g., `ROLLING_AVG` requires 2 args)
- Column reference stripping: `{Column Name}` refs are stripped before function matching to avoid false positives where column names contain function-like words
- **UI integration**: validation runs on blur of the expression input; errors display inline below the input as red text

## Acceptance Criteria

- [x] Validates empty expressions
- [x] Detects unbalanced braces
- [x] Detects unknown column references
- [x] Detects unknown function names
- [x] Detects wrong argument counts for known functions
- [x] Errors display inline on blur of expression input
- [x] Column refs stripped before function matching (no false positives)
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v13)
- Cycle: [[Cycle 38 - Query Builder Improvements]] (Inc 4)
- Extends: [[PBI-ANA-025 Computed Columns]] (validates computed column expressions)
- Extends: [[PBI-ANA-035 Trend Calculation Engine]] (validates function calls)
