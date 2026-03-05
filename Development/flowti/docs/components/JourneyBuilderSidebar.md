---
type: Component
domain: JourneyBuilder
stage: done
description: "Right-sidebar ItemView orchestrator — 3-state machine (welcome/setup/steps), delegates rendering to NavBar, StepCard, JSONPanel, ActionList, ToolPicker, ActionForm, TemplatePicker, ChipList"
source: "[[Development/flowti/src/ui/journeyBuilder/JourneyBuilderSidebar.ts|JourneyBuilderSidebar.ts]]"
tags:
  - journey-builder
  - view
  - component
---

# JourneyBuilderSidebar

## Description

JourneyBuilderSidebar is the main orchestrator view for the Journey Builder. It extends `ItemView` and renders in the right sidebar. The view implements a 3-state machine (welcome → setup → steps) and owns all journey state. Rendering is fully delegated to composable child components via deps/callbacks — the sidebar never renders interactive elements directly in the steps state.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscription and emission |
| `NavBar` | component | Step navigation (prev/next/add) |
| `StepCard` | component | Active step metadata editor |
| `JSONPanel` | component | Collapsible JSON preview |
| `ActionList` | component | Action cards with reorder/remove |
| `ToolPicker` | component | Tool selection dropdown (34 tools) |
| `ActionForm` | component | Schema-driven action form |
| `TemplatePicker` | component | Template card picker (4 templates + Custom) |
| `ChipList` | component | String-array chip lists (via StepCard) |
| `attachEventSuggest` | function | Autocomplete for event/command fields |
| `ACTION_TEMPLATES` | constant | Template definitions for bulk action creation |
| `TOOL_SCHEMAS` | constant | Schema definitions for 34 tools |
| `toEventName` | function | Title Sentence → dot-notation conversion |

## State

**Internal:**
- `state: SidebarState` — Current view state (welcome/setup/steps)
- `metadata: JourneyMetadata` — Journey name, description, start event
- `steps: JourneyStep[]` — All journey steps with actions
- `endEvent: string` — Journey end event
- `currentStepIndex: number` — Active step (0-based)
- `selectedActionIndex: number` — Selected action in ActionList (-1 = none)
- `showToolPicker: boolean` — Whether ToolPicker is visible
- `showTemplatePicker: boolean` — Whether TemplatePicker is visible
- `jsonPanel: JSONPanel | null` — Reference for live updates
- `canvasOpenedPath: string | null` — Path of companion canvas
- `pendingZoomToStep: boolean` — Flag for event-driven canvas zoom

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `journey-builder.opened` | out | Emitted when sidebar opens |
| `journey-builder.create-new` | out | User clicked Create New |
| `journey-builder.open-existing` | out | User clicked Open Existing |
| `journey-builder.metadata.updated` | out | Metadata field changed |
| `journey-builder.step.added` | out | New step created |
| `journey-builder.step.updated` | out | Step field changed (field + value) |
| `journey-builder.action.added` | out | Action added to step |
| `journey-builder.exported` | out | Export triggered (payload: definition + paths) |
| `journey-builder.canvas.sync-requested` | out | Canvas sync needed |
| `journey-builder.import-requested` | out | Open existing file request |
| `journey-builder.canvas.synced` | in | Canvas write completed → trigger zoom |
| `journey-builder.imported` | in | File read completed → load into state |

## API

| Method | Purpose |
|--------|---------|
| `getViewType()` | Returns `"flowti-journey-builder"` |
| `getDisplayText()` | Returns `"Journey Builder"` |
| `getIcon()` | Returns `"route"` |
| `onOpen()` | Renders welcome state, subscribes to events |
| `onClose()` | Cleans up subscriptions, suggest cleanups, timers |

## Related

- Sitemap: [[Journey Builder Sidebar]]
- Service: [[JourneyBuilderService]]
- Source: `src/ui/journeyBuilder/JourneyBuilderSidebar.ts` (~570 LOC)
