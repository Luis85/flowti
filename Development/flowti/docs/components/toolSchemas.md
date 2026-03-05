---
type: Component
domain: JourneyBuilder
stage: done
description: "Schema definitions for all 34 E2E tools — drives ActionForm rendering with fields, categories, labels, and conditional visibility"
source: "[[Development/flowti/src/domain/journeyBuilder/toolSchemas.ts|toolSchemas.ts]]"
tags:
  - journey-builder
  - component
---

# toolSchemas

## Description

toolSchemas defines the `TOOL_SCHEMAS` record — a map from tool name to `ToolSchemaDef` containing the tool's display label, category, and field definitions. This is the single source of truth for ActionForm rendering. Adding a new E2E tool requires only a new schema entry — zero ActionForm changes.

Each field definition includes: key, label, type (text/textarea/number/select/checkbox), required flag, placeholder, and optional `visibleWhen` condition (used by assert builder for type-specific fields).

## Categories (5)

| Category | Tools | Count |
|----------|-------|-------|
| Interaction | command, click, input, set-input, highlight, wait, navigate, ribbon, scroll-to, select | 10 |
| Assertion | assert, assert-text, assert-number, assert-value | 4 |
| Lifecycle | create-file, delete-file, copy-file, move-file, open-file, open-url, close-leaves, close-modals, seed | 9 |
| Feedback | screenshot, notice, theme, manual, visual-inspection, spinner, write-run-log | 7 |
| Data | emit, eval, frontmatter, query-trace | 4 |

## Schema Shape

```typescript
interface ToolSchemaDef {
  label: string;
  category: string;
  fields: ToolFieldDef[];
}

interface ToolFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  visibleWhen?: { field: string; value: string };
}
```

## Related

- Consumer: [[ActionForm]], [[ToolPicker]]
- Types: `src/domain/journeyBuilder/types.ts`
- Test: `tests/domain/journeyBuilder/toolSchemas.test.ts` (20 tests)
- Source: `src/domain/journeyBuilder/toolSchemas.ts` (411 LOC)
