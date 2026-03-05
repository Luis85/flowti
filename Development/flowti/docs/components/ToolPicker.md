---
type: Component
domain: JourneyBuilder
stage: done
description: "Tool selection dropdown — grouped select with 34 tools across 5 categories (Interaction, Assertion, Lifecycle, Feedback, Data)"
source: "[[Development/flowti/src/ui/journeyBuilder/ToolPicker.ts|ToolPicker.ts]]"
tags:
  - journey-builder
  - component
---

# ToolPicker

## Description

ToolPicker renders a `<select>` dropdown with all 34 journey tools grouped by category using `<optgroup>` elements. Shown when the user selects "Custom" from the TemplatePicker. The selection callback passes the chosen tool name to the sidebar, which creates a new action.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `TOOL_SCHEMAS` | constant | Schema definitions with tool names, labels, and categories |

## Categories

| Category | Tools |
|----------|-------|
| Interaction | command, click, input, set-input, highlight, wait, navigate, ribbon, scroll-to, select |
| Assertion | assert, assert-text, assert-number, assert-value |
| Lifecycle | create-file, delete-file, copy-file, move-file, open-file, open-url, close-leaves, close-modals, seed |
| Feedback | screenshot, notice, theme, manual, visual-inspection, spinner, write-run-log |
| Data | emit, eval, frontmatter, query-trace |

## Renders

- **Select dropdown**: with "Choose a tool..." placeholder
- **Optgroups**: one per category with label
- **Options**: one per tool with display name

## API

| Method | Purpose |
|--------|---------|
| `render()` | Clears container and rebuilds tool picker select |

## Related

- Parent: [[JourneyBuilderSidebar]]
- Schema: `src/domain/journeyBuilder/toolSchemas.ts` (411 LOC)
- Test: `tests/ui/journeyBuilder/ActionBuilder.test.ts` (68 tests, shared)
- Source: `src/ui/journeyBuilder/ToolPicker.ts` (63 LOC)
