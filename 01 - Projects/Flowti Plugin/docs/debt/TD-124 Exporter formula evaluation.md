---
type: TechDebt
stage: open
domain: data-exchange
severity: medium
source: "[[exporter is not evaluating formulas]]"
---

## Description

The export pipeline does not evaluate Base file formulas when generating CSV output. Formula columns export as raw formula text instead of computed values.

## Impact

Exported CSV data contains formula definitions instead of resolved values, requiring manual post-processing.

## Proposed Fix

Extend ExportService to resolve formulas via BaseQueryEngine before writing to CSV. Formula resolution already works for import column mapping.
