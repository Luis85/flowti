---
severity: medium
category: performance
layer: domain
status: open
effort: small
description: BaseQueryEngine creates new RegExp objects on each filter evaluation call. For repeated queries against large datasets, pre-compiling regex patterns during parse would reduce GC pressure.
---
# TD-20: BaseQueryEngine regex patterns not pre-compiled

## Problem

`BaseQueryEngine.ts` creates regex patterns inline during filter evaluation (lines ~253-303). For operations like exporting hundreds of notes with complex filter expressions, this creates unnecessary garbage collection pressure.

## Suggested Remediation

1. Compile regex patterns during `parseFilterExpression()` and store them on the filter object
2. Reuse compiled patterns during `evaluateFilter()` calls

## Affected Files

- `src/domain/dataExchange/BaseQueryEngine.ts`
