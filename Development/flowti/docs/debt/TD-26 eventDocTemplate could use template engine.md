---
severity: low
category: code-quality
layer: ui
status: resolved
effort: medium
resolved: 2026-02-14
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

## Resolution (2026-02-14)

Phase 8 (DocService centralization) moved all content generation logic into `src/domain/docs/contentGenerator.ts` (708 LOC). `eventDocTemplate.ts` is now a 53-line re-export barrel with path helper functions. The DDD layer violation (UI generating domain content) is resolved. Remaining string concatenation in `contentGenerator.ts` is acceptable -- template functions are independent and pure, making a template engine unnecessary overhead.
