---
type: Component
domain: JourneyBuilder
stage: done
description: "Fuzzy autocomplete dropdown — attaches to input fields, supports event names (360+), command picker (via adapter), and assert event fields"
source: "[[Development/flowti/src/ui/journeyBuilder/EventSuggest.ts|EventSuggest.ts]]"
tags:
  - journey-builder
  - component
---

# EventSuggest

## Description

EventSuggest provides a fuzzy autocomplete dropdown that attaches to any text input. On focus/input, it filters items with fuzzy scoring and renders a positioned dropdown below the input. Results show the item name, category badge, and description. Used for event names (360+ events), command picker (via adapter), and assert event fields.

The `attachEventSuggest()` helper function creates an EventSuggest instance, wires it to an input element, and returns a cleanup function. The command picker reuses this by mapping `CommandMeta` → `EventSuggestItem` (id → type, domain → category, label → description).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `fuzzyMatchEvent` | function | Fuzzy scoring algorithm for search |
| `EventSuggestItem` | type | Item shape: type, category, description |

## State

**Internal:**
- `items: EventSuggestItem[]` — Full item catalog
- `filteredItems: EventSuggestItem[]` — Current filtered results (max 10)
- `selectedIndex: number` — Keyboard selection index
- `dropdown: HTMLDivElement | null` — Positioned dropdown element

## Renders

- **Dropdown container**: positioned below input, max 10 results
- **Result items**: item name (bold), category badge (colored span), description
- **Selected highlight**: keyboard-navigable with active state
- **Empty state**: dropdown hidden when no matches

## API

| Function | Purpose |
|----------|---------|
| `attachEventSuggest(input, items, onSelect)` | Creates and attaches autocomplete to an input, returns cleanup function |

## Related

- Parent: [[JourneyBuilderSidebar]], [[ActionForm]]
- Fuzzy matching: `src/ui/journeyBuilder/fuzzyMatchEvent.ts` (87 LOC)
- Types: `src/ui/journeyBuilder/EventSuggestTypes.ts`
- Test: `tests/ui/journeyBuilder/EventSuggest.test.ts` (10 tests)
- Source: `src/ui/journeyBuilder/EventSuggest.ts` (167 LOC)
