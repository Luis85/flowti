---
type: Component
domain: JourneyBuilder
stage: done
description: "Template picker — displays 4 pre-built action templates as clickable cards plus a Custom fallback to the full tool picker"
source: "[[Development/flowti/src/ui/journeyBuilder/TemplatePicker.ts|TemplatePicker.ts]]"
tags:
  - journey-builder
  - component
---

# TemplatePicker

## Description

TemplatePicker renders a grid of clickable template cards shown when the user clicks "Add action". Each template represents a common multi-action pattern that bulk-creates the right action sequence. A "Custom action" card at the end falls through to the full 34-tool ToolPicker.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `ACTION_TEMPLATES` | constant | Template definitions (4 entries) |
| `setIcon` | obsidian | Icons for template cards and custom card |

## Templates

| Template | Icon | Actions Created |
|----------|------|-----------------|
| Open via command | `terminal` | command + wait(500ms) + assert(leaf) |
| Click element | `mouse-pointer` | click + wait(300ms) |
| Verify visible | `eye` | assert(visible) |
| Take screenshot | `camera` | screenshot |

## Renders

- **Template cards**: one per template with icon, label, description, `aria-label`, and `data-template-id`
- **Custom card**: "Custom action" with plus icon, falls through to ToolPicker
- All cards: `role="button"`, `tabIndex=0`, keyboard accessible (Enter/Space)

## API

| Method | Purpose |
|--------|---------|
| `render()` | Clears container and rebuilds template picker grid |

## Related

- Parent: [[JourneyBuilderSidebar]]
- Types: `src/domain/journeyBuilder/types.ts` (ActionTemplate interface, ACTION_TEMPLATES array)
- Test: `tests/ui/journeyBuilder/TemplatePicker.test.ts` (8 tests)
- Source: `src/ui/journeyBuilder/TemplatePicker.ts` (72 LOC)
