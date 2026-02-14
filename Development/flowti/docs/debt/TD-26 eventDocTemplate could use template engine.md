---
severity: low
category: code-quality
layer: ui
status: open
effort: medium
description: eventDocTemplate.ts at 862 lines contains many repetitive template generation functions that concatenate strings. A lightweight template engine or tagged template literal approach would improve readability and maintainability.
---
# TD-26: eventDocTemplate.ts could use template engine

## Problem

`eventDocTemplate.ts` (862 lines) generates Markdown content through string concatenation across many similar functions. The patterns are repetitive and hard to read.

## Suggested Remediation

1. Use tagged template literals for cleaner multi-line templates
2. Extract shared template sections (frontmatter block, section headers) into reusable functions
3. Consider a simple template engine approach where the template is a string with `{{placeholders}}`

This is low priority because the current approach works and is side-effect-free.

## Affected Files

- `src/ui/eventDocTemplate.ts`
