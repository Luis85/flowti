---
stage: done
domain: JourneyBuilder
plugin: "[[Development/flowti/README|README]]"
tags:
  - view
  - journey-builder
  - sidebar
  - e2e
description: Right-sidebar view for visually creating, editing, and exporting E2E journey definitions — step editor, action builder, smart inputs, live JSON preview, and canvas sync
type: View
viewType: flowti-journey-builder
extends: ItemView
source: "[[Development/flowti/src/ui/journeyBuilder/JourneyBuilderSidebar.ts|JourneyBuilderSidebar.ts]]"
feature: "[[Development/flowti/docs/features/Journey Builder/Journey Builder PRD|Journey Builder PRD]]"
---

# Journey Builder Sidebar

## Description

The Journey Builder Sidebar is the primary authoring surface for E2E journey definitions. It occupies the right sidebar and guides users through creating, editing, and exporting journey configs. The view is a state-machine orchestrator with three states: welcome (landing), setup (metadata form), and steps (step editor with prev/next navigation).

All rendering is delegated to composable child components (NavBar, StepCard, JSONPanel, ActionList, ToolPicker, ActionForm, TemplatePicker, ChipList). The sidebar owns state and coordinates via callbacks — child components never access state directly.

### Layout

```
Welcome State:
┌─────────────────────────────────────┐
│  Journey Builder                    │  header
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ Create first journey            ││  create card
│  │ Start building a new journey    ││
│  └─────────────────────────────────┘│
│  or import from vault               │  import link
│  or browse from file system         │  browse link
└─────────────────────────────────────┘

Setup State:
┌─────────────────────────────────────┐
│  [< Back]  New Journey              │  header
├─────────────────────────────────────┤
│  Journey Name: [____________]       │  name input
│  Chapter:      [____________]       │  chapter input
│  Description:  [____________]       │  description input
│  Start Event:  [____________]       │  event input + autocomplete
│                → event.name.here    │  preview span
│  [Continue →]                       │  continue button
└─────────────────────────────────────┘

Steps State:
┌─────────────────────────────────────┐
│  [⚙] [◄ Prev] Step 2 of 5 [Next ►]│  NavBar
│  [+ Add step]                       │
├─────────────────────────────────────┤
│  ┌─ Step Card ─────────────────────┐│
│  │ [2] [Enter step title...] [✕]  ││  StepCard header
│  │ [Step description...]          ││  textarea
│  │ [Select swimlane ▼]            ││  dropdown
│  │ Events: [chip] [chip] [+]      ││  ChipList
│  │ Commands: [+]                  ││  ChipList
│  │ Interactions: [+]              ││  ChipList
│  │ Components: [+]                ││  ChipList
│  │ 3 actions                      ││  action count
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  [Action 1: command] [▲] [▼] [✕]  │  ActionList
│  [Action 2: click] ← selected     │
│  [Action 3: screenshot]            │
│  [+ Add action]                    │
├─────────────────────────────────────┤
│  [Action Form: click]              │  ActionForm (selected)
│  selector: [____________]          │
│  description: [____________]       │
├─────────────────────────────────────┤
│  End Event: [____________]         │  end event input
│             → end.event.here       │  preview span
│  [▼ JSON Preview]                  │  JSONPanel toggle
│  ┌─────────────────────────────────┐│
│  │ { "journey": "...", ... }      ││  JSONPanel (expanded)
│  │                          [📋]  ││  copy button
│  └─────────────────────────────────┘│
│  [Export] [Open Canvas]            │  action buttons
└─────────────────────────────────────┘
```

## Use Cases

### Create a new journey
Click "Create first journey" to open the setup form. Fill in journey name, description, and start event (with autocomplete from 360+ events). Click Continue to enter the step editor.

### Add and edit steps
Use "Add step" to create steps. Each step has a title, description, swimlane dropdown, and chip lists for events, commands, interactions, and components. Navigate between steps with Prev/Next buttons.

### Build actions with templates
Click "Add action" to see the TemplatePicker with 4 pre-built patterns (Open via command, Click element, Verify visible, Take screenshot). Templates bulk-create the right action sequence. "Custom" falls through to the full 34-tool picker.

### Configure actions with guided forms
Select an action card to open its ActionForm. Each form renders schema-driven fields for the selected tool. Assert actions get an 8-type picker with conditional fields. Command actions get a searchable autocomplete.

### Preview JSON in real-time
Toggle the JSON preview panel to see the generated journey definition update live as you edit. Copy to clipboard with one click.

### Export journey
Click Export to generate 3 files: journey JSON, test executor (.test.ts), and companion canvas. Files are written via the EventBridge file pipeline.

### Open existing journey
From the welcome screen, click "Open Existing" to load a previously exported journey via FuzzySuggestModal file picker.

## Technical Notes

- Registered under view type `flowti-journey-builder` with the `route` icon
- Extends `ItemView` directly (not BaseHubView) — single-purpose sidebar, no tabs
- 3-state machine: `welcome` → `setup` → `steps` (with back navigation)
- Canvas sync: debounced 1500ms via `scheduleCanvasSync()`, companion canvas opens in split pane
- Canvas zoom: event-driven pattern with `pendingZoomToStep` flag and 400ms `scheduleZoom` timer
- EventSuggest attached to start event, end event, and assert event fields via `attachEventSuggest()`
- Command picker: reuses `attachEventSuggest` via adapter (CommandMeta → EventSuggestItem)
- `stepCounter` is module-level — increments globally across sidebar instances
- `JourneyPickerModal` (inner class) extends `FuzzySuggestModal<string>` for .json file picking
- Source: `src/ui/journeyBuilder/JourneyBuilderSidebar.ts` (~570 LOC)

## Related Flows

- [[Journey Builder]] — E2E journey testing the full authoring loop (13 steps)

## Related Decisions

- JourneyBuilderSidebar extends ItemView directly — single-purpose sidebar, no BaseHubView needed
- Schema-driven ActionForm — single component renders all 34 tools via `toolSchemas.ts`
- EventSuggest adapter pattern — reuses autocomplete for both events and commands
