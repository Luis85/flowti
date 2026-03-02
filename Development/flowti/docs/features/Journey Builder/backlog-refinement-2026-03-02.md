---
type: BacklogRefinement
date: 2026-03-02
stage: done
feature: "[[Journey Builder PRD]]"
description: "Journey Builder backlog breakdown — PBIs for Cycle 55 and beyond, based on PRD-JB v1.0"
---

# Backlog Refinement — Journey Builder

## Session Summary

This refinement session breaks down the Journey Builder PRD (v1.0, core) into actionable PBIs for Cycle 55 delivery. The Journey Builder transforms Flowti's E2E testing from a text-editing exercise into a visual, canvas-backed authoring experience.

## Foundation Assessment

### What Exists (Cycle 54 Spike — Inc 14)
- JourneyBuilderSidebar with 3 states: welcome → setup → step builder
- JourneyBuilderService wired to EventBus (listens for `journey-builder.exported`, writes JSON via FileSystemClient)
- EventBridge adapter fallback for non-vault extensions (.json, .ts)
- 6 journey-builder events defined
- Canvas improvement card rendering in `generate-e2e-report.mjs`
- E2E journey blueprint (5 steps, 9 improvements catalogued)
- obsidian-stub adapter mock

### What's Missing (Gap Analysis)

| Area | Current | Target |
|------|---------|--------|
| Step editing | Title-only cards, inline form | Full step card with all fields, prev/next navigation |
| Action builder | No action editing | 26-tool guided forms, templates, drag-and-drop |
| Event input | Plain text inputs | Typeahead autocomplete over EVENT_CATALOG |
| Command input | Not available | Searchable dropdown from registry |
| Assert builder | Not available | Guided form with type-specific fields |
| JSON preview | Not available | Collapsible real-time panel |
| Canvas sync | Post-run only (report pipeline) | Real-time bidirectional sync |
| Canvas → JSON | Not available | Parser for journey-structured canvases |
| Preview run | Not available | In-vault execution with live canvas updates |
| Export | JSON only | JSON + .test.ts + .canvas |
| Open existing | Event emitted, no handler | File picker + load into editor |

---

## PBI Breakdown

### PBI-JB-001: Step Editor with Prev/Next Navigation
**Priority**: must-have | **Phase**: 1 | **Est. LOC**: ~350 | **Est. Tests**: ~40
**PRD**: FR-01

Replace the current step list with a focused step-by-step editor:
- Navigation row at top: `< Prev | Step 2 of 5 | Next >`
- Single step card below showing full configuration for the active step
- Step card sections: Title, Description, Swimlane selector, UI Context (view, tab, components), Events list, Commands list, Interactions list
- Each section collapsible with accordion behavior
- Edit any field → emits `journey-builder.step.updated`
- Add Step / Remove Step from the navigation row
- Step reordering via up/down buttons in navigation

**Depends on**: Nothing (extends existing sidebar)
**Acceptance Criteria**:
- [ ] Prev/next navigation works across all steps
- [ ] All step metadata fields editable
- [ ] Step card sections collapsible
- [ ] Events emitted on every change
- [ ] Add/remove step from navigation row
- [ ] `npm test` green

---

### PBI-JB-002: Action Builder
**Priority**: must-have | **Phase**: 1 | **Est. LOC**: ~500 | **Est. Tests**: ~55
**PRD**: FR-02

Add action configuration to the step editor:
- "Add action" button at bottom of step card opens tool picker
- Tool picker: searchable list of 26 tools, grouped by category (UI Interaction, State, Lifecycle, Interactive, Logging)
- Each tool shows a guided form with only the fields that tool supports
- Action list with reordering (up/down buttons)
- Remove button per action
- Action Templates (quick patterns):
  - "Open via command" → command + wait(500) + assert(leaf)
  - "Click element" → click(selector) + wait(300)
  - "Verify visible" → assert(visible, selector)
  - "Take screenshot" → screenshot(label)
- Template selection fills in blanks (command ID, selector, etc.) then adds multiple actions as a group

**Depends on**: PBI-JB-001
**Acceptance Criteria**:
- [ ] All 26 tools configurable via guided forms
- [ ] Action list with reordering
- [ ] 4 Action Templates working
- [ ] Actions reflected in step's `actions[]` array
- [ ] `npm test` green

---

### PBI-JB-003: Event Autocomplete
**Priority**: must-have | **Phase**: 1 | **Est. LOC**: ~200 | **Est. Tests**: ~25
**PRD**: FR-04

Typeahead autocomplete for event name inputs:
- Applicable to: start event, end event, assert-event action, emit action
- Data source: EVENT_CATALOG (360+ events)
- Results grouped by category (Core, Lifecycle, User, Settings, Installer, etc.)
- Each result shows: event name, category badge, description on hover
- Fuzzy matching: `hub.tab` matches `hub.tab.changed`, `hub.tab.clicked`
- Keyboard navigation: arrow keys, Enter to select, Escape to dismiss
- Reusable autocomplete component (shared across all event inputs)

**Depends on**: Nothing (reusable UI component)
**Acceptance Criteria**:
- [ ] Autocomplete appears on focus/type in event inputs
- [ ] 360+ events searchable
- [ ] Grouped by category
- [ ] Keyboard navigation works
- [ ] Reusable across sidebar and action builder
- [ ] `npm test` green

---

### PBI-JB-004: Command Picker
**Priority**: must-have | **Phase**: 1 | **Est. LOC**: ~120 | **Est. Tests**: ~15
**PRD**: FR-05

Searchable dropdown for command actions:
- When adding a `command` action, show dropdown of registered commands (~40)
- Data source: command registry (from main.ts command registrations)
- Each entry shows: command ID, display name, domain
- Search filters by both ID and display name
- Selected command auto-populates the `id` field in the action

**Depends on**: PBI-JB-002 (action builder)
**Acceptance Criteria**:
- [ ] Command picker shows all registered commands
- [ ] Search by ID and display name
- [ ] Selection populates action `id` field
- [ ] `npm test` green

---

### PBI-JB-005: Assert Builder
**Priority**: should-have | **Phase**: 1 | **Est. LOC**: ~250 | **Est. Tests**: ~30
**PRD**: FR-03

Guided form for assert actions with type-specific fields:
- Type selector: leaf, visible, not-visible, text, event, eval, count, attr
- Per-type fields:
  - `leaf`: viewType input (autocomplete from registered view types)
  - `visible` / `not-visible`: CSS selector input
  - `text`: CSS selector + expected text
  - `event`: event name (uses PBI-JB-003 autocomplete)
  - `eval`: code textarea + optional expected value input
  - `count`: selector + expected count (number input)
  - `attr`: selector + attribute name + expected value
- Field validation: required fields highlighted, selector syntax hints

**Depends on**: PBI-JB-002 (action builder), PBI-JB-003 (event autocomplete for event type)
**Acceptance Criteria**:
- [ ] All 8 assert types configurable
- [ ] Type-specific fields render correctly
- [ ] Event autocomplete integrated for event type
- [ ] Field validation provides feedback
- [ ] `npm test` green

---

### PBI-JB-006: Live JSON Preview
**Priority**: should-have | **Phase**: 1 | **Est. LOC**: ~150 | **Est. Tests**: ~15
**PRD**: FR-06

Real-time JSON preview panel in the sidebar:
- Collapsible panel at bottom of sidebar
- Shows the full journey definition JSON as the author builds
- Updates on every field change (debounced 300ms)
- Syntax highlighting using Obsidian's code block rendering
- Copy-to-clipboard button
- Toggle button in sidebar header: "Show/Hide JSON"
- Panel remembers collapsed/expanded state

**Depends on**: PBI-JB-001 (step editor provides the data to preview)
**Acceptance Criteria**:
- [ ] JSON panel shows valid, formatted JSON
- [ ] Updates in real-time (debounced)
- [ ] Collapsible with remembered state
- [ ] Copy-to-clipboard works
- [ ] `npm test` green

---

### PBI-JB-007: Canvas Sync — JSON → Canvas
**Priority**: must-have | **Phase**: 2 | **Est. LOC**: ~400 | **Est. Tests**: ~45
**PRD**: FR-07

Real-time canvas generation from sidebar edits:
- When sidebar is active, create/update a companion `.canvas` file
- Canvas layout matches `generateJourneyCanvas()` output from the report pipeline
- Reuse layout constants: GROUP_WIDTH, GROUP_HEIGHT, GROUP_SPACING_X, etc.
- Node mapping:
  - START circle → journey name, description
  - Step group per step → label, config text node, action nodes below
  - Improvement cards → yellow nodes above step groups
  - END circle → end event
- Operations:
  - Add step → insert group node, reflow edges
  - Remove step → remove group node, reconnect edges
  - Edit step metadata → update config text node content
  - Add/remove action → update action nodes below group
- Canvas file written via EventBridge (adapter for .canvas if needed, though Obsidian manages .canvas natively)
- Debounce writes: 500ms after last edit
- Emit `journey-builder.canvas.synced` after each write

**Depends on**: PBI-JB-001, PBI-JB-002
**Acceptance Criteria**:
- [ ] Canvas file created when journey editing starts
- [ ] Canvas layout matches test-runner output
- [ ] Step add/remove reflected in canvas
- [ ] Action changes reflected in canvas
- [ ] Debounced writes (not on every keystroke)
- [ ] Canvas viewable in Obsidian alongside sidebar
- [ ] `npm test` green

---

### PBI-JB-008: Canvas Sync — Canvas → JSON
**Priority**: should-have | **Phase**: 2 | **Est. LOC**: ~350 | **Est. Tests**: ~40
**PRD**: FR-08

Parse journey-structured canvases into JourneyDefinition:
- Detection: canvas contains START node (circle, "Start" text) + sequential groups + END node
- Parser reads canvas JSON:
  - START node text → journey name, date
  - Step groups ordered by x-coordinate → step sequence
  - Group labels → `guideSection.title`
  - Config text nodes → parsed into description, events, commands, UI context
  - Action nodes below groups → `steps[i].actions[]`
  - Yellow cards (color "3") above groups → `steps[i].improvements[]`
  - Edges → step ordering validation
- "Convert to Journey" command: opens parsed definition in sidebar editor
- Validation: warn on unrecognized nodes, missing required fields
- Emit `journey-builder.canvas.parsed` with parsed definition

**Depends on**: PBI-JB-007 (shared canvas structure knowledge)
**Acceptance Criteria**:
- [ ] Detects journey-structured canvases
- [ ] Parses all node types into JourneyDefinition
- [ ] Loads parsed journey into sidebar editor
- [ ] Warns on structural issues
- [ ] Round-trip: JSON → Canvas → JSON produces equivalent definition
- [ ] `npm test` green

---

### PBI-JB-009: Export — Test File + Canvas
**Priority**: must-have | **Phase**: 1 | **Est. LOC**: ~150 | **Est. Tests**: ~15
**PRD**: FR-10

Extend current export to generate all three files:
- `.journey.json` — full JourneyDefinition (existing, enhanced with full actions)
- `.test.ts` — thin executor wrapper:
  ```typescript
  import * as fs from "node:fs";
  import * as path from "node:path";
  import { executeJourney } from "./helpers/journeyExecutor";
  import type { JourneyDefinition } from "./helpers/journeyTypes";
  const configPath = path.join(__dirname, "journeys", "<name>.journey.json");
  const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;
  executeJourney(definition);
  ```
- `.canvas` — companion canvas matching test-runner layout (reuse PBI-JB-007 generator)
- All three written via EventBridge file pipeline
- Emit `journey-builder.exported` with all three paths

**Depends on**: PBI-JB-007 (canvas generation)
**Acceptance Criteria**:
- [ ] Three files generated on export
- [ ] .test.ts is valid TypeScript with correct imports
- [ ] .canvas matches generateJourneyCanvas() layout
- [ ] All files written through event pipeline
- [ ] `npm test` green

---

### PBI-JB-010: Open Existing Journey
**Priority**: must-have | **Phase**: 2 | **Est. LOC**: ~200 | **Est. Tests**: ~20
**PRD**: FR-11

Load existing journey definitions for editing:
- "Open Existing" card on welcome screen triggers file picker
- File picker: FuzzySuggestModal showing `.journey.json` files in vault
- Selected file parsed into JourneyDefinition
- Sidebar loads at step 1 of step editor (not setup form)
- If companion `.canvas` exists, open alongside in a split
- All fields populated and editable
- Dirty tracking: warn on navigation away if unsaved changes

**Depends on**: PBI-JB-001 (step editor to load into)
**Acceptance Criteria**:
- [ ] File picker shows .journey.json files
- [ ] Selected journey loads into step editor
- [ ] All fields populated correctly
- [ ] Companion canvas opened if exists
- [ ] Dirty tracking warns on unsaved changes
- [ ] `npm test` green

---

### PBI-JB-011: Preview Run
**Priority**: should-have | **Phase**: 3 | **Est. LOC**: ~500 | **Est. Tests**: ~50
**PRD**: FR-09

Execute journey within Obsidian with live canvas feedback:
- "Preview Run" button in step editor toolbar
- Execution reuses action runner from E2E helpers (actionRunner.ts)
- Adapts action runner to work outside vitest context (no `expect()`, no test-vault CLI)
- Steps execute sequentially with settle delays
- Live canvas updates: nodes turn green (pass) / red (fail) during execution
- Screenshots captured and embedded as step group backgrounds
- Event trace collected → Events Summary node populated
- Results inspectable: click step node → detail panel in sidebar
- Preview sandboxing: revert file changes, dismiss notices after run
- Emit `journey-builder.preview.started` and `journey-builder.preview.completed`

**Depends on**: PBI-JB-007 (canvas sync), PBI-JB-009 (export for full definition)
**Acceptance Criteria**:
- [ ] Preview run executes all steps
- [ ] Canvas updates live (green/red nodes)
- [ ] Screenshots embedded as backgrounds
- [ ] Event trace shown in summary node
- [ ] Results inspectable per step
- [ ] No permanent side effects in vault
- [ ] `npm test` green

---

### PBI-JB-012: Dual Input for Journey Runner
**Priority**: nice-to-have | **Phase**: 3 | **Est. LOC**: ~200 | **Est. Tests**: ~20
**PRD**: FR-12

Extend Journey Runner to accept canvas files as input:
- New executor variant: `executeJourneyFromCanvas(canvasPath)`
- Reads canvas JSON, parses via PBI-JB-008 converter
- Converts to JourneyDefinition, passes to existing `executeJourney()`
- Results output format identical regardless of input
- npm script: `test:e2e:canvas` for canvas-based journey execution

**Depends on**: PBI-JB-008 (Canvas → JSON parser)
**Acceptance Criteria**:
- [ ] Canvas file accepted as journey input
- [ ] Conversion to JourneyDefinition succeeds
- [ ] Test execution produces same results as JSON input
- [ ] Results format unchanged
- [ ] `npm test` green

---

## Priority Matrix

| PBI | Priority | Phase | Depends On | Est. Tests |
|-----|----------|-------|------------|------------|
| JB-001 | must-have | 1 | — | 40 |
| JB-002 | must-have | 1 | JB-001 | 55 |
| JB-003 | must-have | 1 | — | 25 |
| JB-004 | must-have | 1 | JB-002 | 15 |
| JB-005 | should-have | 1 | JB-002, JB-003 | 30 |
| JB-006 | should-have | 1 | JB-001 | 15 |
| JB-007 | must-have | 2 | JB-001, JB-002 | 45 |
| JB-008 | should-have | 2 | JB-007 | 40 |
| JB-009 | must-have | 1 | JB-007 | 15 |
| JB-010 | must-have | 2 | JB-001 | 20 |
| JB-011 | should-have | 3 | JB-007, JB-009 | 50 |
| JB-012 | nice-to-have | 3 | JB-008 | 20 |
| **Total** | | | | **370** |

## Cycle 55 Target (Phase 1 + start Phase 2)

**Must-have for C55**: JB-001, JB-002, JB-003, JB-004, JB-006, JB-007, JB-009, JB-010
**Should-have for C55**: JB-005 (Assert Builder)
**Deferred to C56**: JB-008 (Canvas → JSON), JB-011 (Preview Run), JB-012 (Dual Input)

**Estimated C55 scope**: ~2,120 LOC, ~275 tests, ~10 increments
