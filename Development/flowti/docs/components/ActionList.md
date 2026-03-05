---
type: Component
domain: JourneyBuilder
stage: done
description: "Action list — renders action cards with tool badge, up/down reorder, remove, select, and add button"
source: "[[Development/flowti/src/ui/journeyBuilder/ActionList.ts|ActionList.ts]]"
tags:
  - journey-builder
  - component
---

# ActionList

## Description

ActionList renders the list of actions for the current step. Each action appears as a card with a tool name badge, up/down reorder buttons, and a remove button. Cards are clickable for selection (opens ActionForm). An "Add action" button with dashed border appears at the bottom. All buttons have ARIA labels and keyboard support.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `setIcon` | obsidian | Icons for up (arrow-up), down (arrow-down), remove (x), add (plus) |

## State

**Via deps (stateless component):**
- `actions: JourneyAction[]` — Array of actions to display
- `selectedIndex: number` — Currently selected action (-1 = none)

## Renders

- **Action cards**: one per action with tool badge, selected state highlight
- **Reorder buttons**: up (disabled on first), down (disabled on last) with `aria-disabled`
- **Remove button**: per-card, `aria-label="Remove action"`
- **Add button**: dashed border, `aria-label="Add action"`, icon + text

## API

| Method | Purpose |
|--------|---------|
| `render()` | Clears container and rebuilds action list |

## Related

- Parent: [[JourneyBuilderSidebar]]
- Test: `tests/ui/journeyBuilder/ActionBuilder.test.ts` (68 tests, shared with ActionForm/ToolPicker)
- Source: `src/ui/journeyBuilder/ActionList.ts` (138 LOC)
