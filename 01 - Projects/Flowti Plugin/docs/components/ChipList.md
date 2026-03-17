---
type: Component
domain: JourneyBuilder
stage: done
description: "Reusable chip list — renders string array as removable chips with an add-via-Enter input, used for step metadata (events, commands, interactions, components)"
source: "[[Development/flowti/src/ui/journeyBuilder/ChipList.ts|ChipList.ts]]"
tags:
  - journey-builder
  - component
---

# ChipList

## Description

ChipList is a reusable component that renders a string array as a row of removable chips with an input field for adding new items. Used on StepCard for events, commands, interactions, and components arrays. Supports add-via-Enter, remove-via-click, duplicate prevention, and keyboard accessibility.

## Dependencies

None (pure DOM component).

## State

**Via deps (stateless component):**
- `label: string` — Section label ("Events", "Commands", etc.)
- `items: string[]` — Current chip values
- `testIdPrefix: string` — Data-test-id prefix for testing
- `placeholder: string` — Input placeholder text

## Renders

- **Label**: section header with subtle styling (`text-faint`)
- **Chip row**: one chip per item with text + remove button (×)
- **Input**: text field, adds chip on Enter, clears on add
- **Empty state**: just the label and input (no chips)

## API

| Method | Purpose |
|--------|---------|
| `render()` | Clears container and rebuilds chip list |

## Related

- Parent: [[StepCard]]
- Test: `tests/ui/journeyBuilder/ChipList.test.ts` (16 tests)
- Source: `src/ui/journeyBuilder/ChipList.ts` (87 LOC)
