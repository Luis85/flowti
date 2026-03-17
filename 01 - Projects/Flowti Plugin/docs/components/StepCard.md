---
type: Component
domain: JourneyBuilder
stage: done
description: "Step card — renders active step with editable title, description, swimlane, chip lists (events/commands/interactions/components), and action count"
source: "[[Development/flowti/src/ui/journeyBuilder/StepCard.ts|StepCard.ts]]"
tags:
  - journey-builder
  - component
---

# StepCard

## Description

StepCard renders the active step's full configuration. Shows a numbered badge, editable title input, remove button, description textarea, swimlane dropdown (4 options), four ChipList sections for metadata arrays, and an action count display. All field changes are reported via callbacks.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `setIcon` | obsidian | Icon for remove button (x) |
| `ChipList` | component | Reusable chip list for string arrays |

## State

**Via deps (stateless component):**
- `step: JourneyStep` — Step data (title, description, swimlane, events, commands, interactions, components, actions)
- `stepNumber: number` — 1-based badge number
- `actionCount?: number` — Number of actions for display

## Renders

- **Header**: step number badge, title input, remove button (with `aria-label="Remove step"`)
- **Description**: textarea (2 rows)
- **Swimlane**: select dropdown — customer, frontstage, backstage, support
- **Events ChipList**: event names as chips with add/remove
- **Commands ChipList**: command IDs as chips
- **Interactions ChipList**: interaction descriptions as chips
- **Components ChipList**: component names as chips
- **Action count**: "No actions" or "N action(s)"

## API

| Method | Purpose |
|--------|---------|
| `render()` | Clears container and rebuilds step card |

## Related

- Parent: [[JourneyBuilderSidebar]]
- Child: [[ChipList]]
- Test: `tests/ui/journeyBuilder/StepCard.test.ts` (27 tests)
- Source: `src/ui/journeyBuilder/StepCard.ts` (152 LOC)
