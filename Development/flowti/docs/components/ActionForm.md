---
type: Component
domain: JourneyBuilder
stage: done
description: "Schema-driven action form — renders correct fields for any of 34 tools based on toolSchemas.ts definitions, includes assert builder (8-type picker) and event autocomplete"
source: "[[Development/flowti/src/ui/journeyBuilder/ActionForm.ts|ActionForm.ts]]"
tags:
  - journey-builder
  - component
---

# ActionForm

## Description

ActionForm renders a guided editing form for a single action. It reads the tool's schema from `toolSchemas.ts` and generates the appropriate input fields (text, textarea, number, select, checkbox). Special handling for assert actions (8-type button picker with conditional field visibility) and event fields (autocomplete via EventSuggest). A single 228-LOC component handles all 34 tools — adding a new tool requires only a schema entry.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `TOOL_SCHEMAS` | constant | Schema definitions for all 34 tools |
| `attachEventSuggest` | function | Autocomplete for event name fields |
| `setIcon` | obsidian | Icons for assert type buttons |

## State

**Via deps (stateless component):**
- `action: JourneyAction` — The action being edited
- `getEventCatalog?: () => EventSuggestItem[]` — Event catalog for autocomplete
- `getCommands?: () => CommandMeta[]` — Command registry for command picker

## Renders

- **Tool header**: tool name with category badge
- **Schema fields**: one input per schema field (text, textarea, number, select, checkbox)
- **Assert type picker**: 8 buttons (leaf, visible, not-visible, text, event, eval, count, attr) with active state
- **Conditional fields**: `visibleWhen` logic hides/shows fields based on assert type
- **Required markers**: `*` on required fields
- **Event autocomplete**: attached to event-type fields
- **Command autocomplete**: attached to command `id` field

## API

| Method | Purpose |
|--------|---------|
| `render()` | Clears container and rebuilds form from schema |

## Related

- Parent: [[JourneyBuilderSidebar]]
- Schema: `src/domain/journeyBuilder/toolSchemas.ts` (411 LOC, 34 tools)
- Test: `tests/ui/journeyBuilder/ActionBuilder.test.ts` (68 tests, shared)
- Source: `src/ui/journeyBuilder/ActionForm.ts` (228 LOC)
