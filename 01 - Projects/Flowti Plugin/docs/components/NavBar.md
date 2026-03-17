---
type: Component
domain: JourneyBuilder
stage: done
description: "Step navigation row — prev/next buttons, step counter, add step button, optional setup button"
source: "[[Development/flowti/src/ui/journeyBuilder/NavBar.ts|NavBar.ts]]"
tags:
  - journey-builder
  - component
---

# NavBar

## Description

NavBar renders the step navigation row at the top of the step editor. Shows prev/next buttons (disabled at boundaries), a step counter ("Step 2 of 5"), an "Add step" button, and an optional setup gear button. All interactive elements have ARIA roles, labels, and keyboard support (Enter/Space).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `setIcon` | obsidian | Lucide icon rendering (arrow-left, arrow-right, plus, settings) |

## State

**Via deps (stateless component):**
- `stepCount: number` — Total steps in journey
- `currentIndex: number` — Zero-based active step index

## Renders

- **Setup button** (optional): gear icon, navigates back to setup form
- **Prev button**: disabled when `currentIndex === 0`, `aria-disabled` and `ft-jb-nav-disabled` class
- **Step counter**: "Step N of M" or "No steps yet"
- **Next button**: disabled when `currentIndex === stepCount - 1`
- **Add step button**: icon + "Add step" text, always enabled

## API

| Method | Purpose |
|--------|---------|
| `render()` | Clears container and rebuilds navigation bar |

## Related

- Parent: [[JourneyBuilderSidebar]]
- Test: `tests/ui/journeyBuilder/NavBar.test.ts` (16 tests)
- Source: `src/ui/journeyBuilder/NavBar.ts` (92 LOC)
