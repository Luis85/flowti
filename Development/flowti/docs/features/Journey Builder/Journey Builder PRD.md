---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: in-progress
version: "1.1"
maturity: L2
created: 2026-03-02
updated: 2026-03-05
related_events:
  - journey-builder.opened
  - journey-builder.create-new
  - journey-builder.open-existing
  - journey-builder.metadata.updated
  - journey-builder.step.added
  - journey-builder.step.updated
  - journey-builder.step.removed
  - journey-builder.step.reordered
  - journey-builder.action.added
  - journey-builder.action.updated
  - journey-builder.action.removed
  - journey-builder.exported
  - journey-builder.canvas.synced
  - journey-builder.preview.started
  - journey-builder.preview.completed
  - file.create.request
  - file.create.response
  - file.update.request
  - file.update.response
maturity_score_strategy: 4
maturity_score_scope: 3
maturity_score_architecture: 4
maturity_score_event_integration: 4
maturity_score_data_model: 4
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 4
business_value: 5
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 2
design_cost: 4
test_cost: 3
priority: 5
tags:
  - journey-builder
  - canvas
  - e2e
  - testing
  - core
---

# PRD: Journey Builder — Visual E2E Journey Authoring

> Foundation: [[Development/flowti/docs/features/Test Management/Journey Runner PRD|Journey Runner PRD]]
> Cycle 54 spike: [[Development/flowti/docs/cycles/Cycle 54 - Canvas Sessions and Signal Hardening|Cycle 54 Inc 14]]

---

## 1. Problem Statement

The Journey Runner (PRD-JR, delivered C54) enables declarative E2E test authoring via JSON configs. However, creating and maintaining these JSON files is still a developer-only activity:

- **Authoring friction** — Journey JSONs are 200–400 LOC hand-crafted files. Authors must know the full action vocabulary (26 tools), event names (360+), command IDs (~40), and CSS selectors by heart.
- **No visual feedback** — The only way to see what a journey looks like is to run it. There's no preview, no visual editor, no live canvas representation until after a full test execution.
- **Canvas is post-run only** — The report pipeline generates beautiful canvases from test results, but these are read-only artifacts. Authors can't start from a canvas and work backward to a journey definition.
- **No round-trip** — Editing a journey means editing raw JSON, re-running the test, and then inspecting the generated canvas. Changes flow one-way: JSON → Run → Canvas. There is no Canvas → JSON path.
- **Step editing is blind** — The current sidebar (Inc 14 spike) shows a simple step list with title-only cards. There's no way to see or edit a step's full configuration (actions, events, assertions, UI context) from the sidebar.

**Who is affected?** Developers building E2E journeys, product owners reviewing journey coverage, and team members onboarding to the test suite.

**What breaks?** Without this feature, journey authoring remains a text-editing exercise that requires deep system knowledge. The visual power of Obsidian Canvas goes unused during authoring.

**Why it matters:** Flowti's competitive advantage is turning development workflows into inspectable, visual artifacts. The Journey Builder completes this loop — journeys are authored visually, backed by canvas, runnable immediately, and their output feeds back into the same canvas.

---

## 2. Outcome

After implementation:

- **Authors** create journeys visually in the Obsidian sidebar, one step at a time
- **Canvas** updates in real-time as the author builds — every step, action, and assertion appears as a canvas node
- **Preview runs** execute the journey and produce canvas output identical to what the test runner generates — without leaving Obsidian
- **Round-trip**: Canvas ↔ JSON. Authors can start from either a JSON definition or a canvas and convert between them
- **Journey Runner** processes both `.journey.json` files and `.canvas` files as input sources
- **Step editor** provides full step configuration: prev/next navigation, action builder with autocomplete, live JSON preview, and simultaneous canvas updates

---

## 3. Scope

### In Scope
- Canvas-backed journey authoring from the sidebar
- Real-time canvas sync (edits in sidebar → canvas updates, canvas edits → sidebar updates)
- Step-by-step editor with prev/next navigation and full action configuration
- Event Autocomplete for start/end events (typeahead over EVENT_CATALOG)
- Command Picker for command actions (searchable dropdown of registered commands)
- Action Templates — quick-add patterns for common action groups
- Assert Builder — guided form for assert actions with type-specific fields
- Live JSON Preview panel (collapsible, real-time)
- Canvas → Journey Definition conversion (parse canvas nodes/edges into JourneyDefinition)
- Journey Definition → Canvas conversion (generate canvas from JSON, matching test-runner output)
- Preview run mode (execute journey within Obsidian, produce inspectable canvas output)
- Auto-generate companion `.test.ts` executor file on export
- Auto-generate companion `.canvas` file on export

### Out of Scope
- CI/CD integration for preview runs (requires Xvfb, PBI-RP-003)
- Visual regression / screenshot diffing
- Multi-user collaborative editing
- Journey composition from canvas (combining multiple journeys)
- Action recording from live Obsidian interaction (macro recording)
- Canvas import from external tools (Miro, FigJam, etc.)

---

## 4. UX Entry Points

### Primary: Sidebar Editor
1. User opens Journey Builder via command (`flowti:open-journey-builder`) or ribbon icon
2. Welcome screen: **Create New** / **Open Existing**
3. **Create New** → Setup form (name, description, start event with autocomplete)
4. **Continue** → Step editor: prev/next navigation row at top, step card below with all configuration options
5. Each edit updates: (a) the in-memory journey definition, (b) the JSON preview panel, (c) the companion canvas
6. **Export** → writes `.journey.json`, `.test.ts`, and `.canvas` to vault

### Secondary: Canvas-First
1. User opens an existing `.canvas` file that follows journey structure
2. Context menu or command: **Convert to Journey Definition**
3. Builder parses canvas nodes/edges into a JourneyDefinition
4. Sidebar opens with the parsed journey loaded for editing

### Tertiary: Preview Run
1. From the step editor, user clicks **Preview Run**
2. Journey executes step-by-step inside Obsidian (using the same action runner as E2E tests)
3. Canvas updates live during execution (nodes turn green/red as steps pass/fail)
4. Final canvas output matches what `generate-e2e-report.mjs` would produce post-test

---

## 5. Data Model

### Journey Canvas Structure

The canvas representation of a journey follows the same layout as the test-runner canvas output:

```
START (circle, green) → Step Groups → Events Summary → END (circle)
```

Each **Step Group** contains:
- **Group node** with screenshot background (if available)
- **Config text node** with step metadata (describe/it, UI context, events, commands)
- **Action nodes** (vertical stack below group)
- **Improvement cards** (yellow, stacked above group) — 3× height, 2× width

### Canvas ↔ JSON Mapping

| Canvas Element | JSON Path |
|---|---|
| START node text | `journey`, `description` |
| Step group label | `steps[i].guideSection`, `steps[i].title` |
| Config node text | `steps[i].description`, `uiContext`, `events`, `commands` |
| Action nodes (vertical) | `steps[i].actions[]` |
| Improvement cards (yellow) | `steps[i].improvements[]` |
| END node text | `endEvent` |
| Edge: group → group | Step ordering |

### Step Editor State

```typescript
interface StepEditorState {
    currentStepIndex: number;
    totalSteps: number;
    step: JourneyStep;
    isDirty: boolean;
    canvasNodeId: string;  // linked canvas node for sync
}
```

---

## 6. Functional Requirements

### FR-01: Step-by-Step Editor
- [x] Sidebar shows a **step card** with full configuration for the active step
- [x] **Prev/Next navigation row** at top allows moving between steps
- [x] Navigation shows current position: "Step 2 of 5"
- [x] Step card sections: Title, Description, Swimlane, UI Context, Events, Commands, Actions, Improvements
- [ ] Each section is collapsible (deferred — accordion pattern)
- [x] Editing any field emits `journey-builder.step.updated` with field and value

### FR-02: Action Builder
- [x] "Add action" button opens action type picker (34 tools, 5 categories)
- [x] Each action type shows a guided form with type-specific fields (schema-driven)
- [x] Actions reorderable via up/down buttons (drag-and-drop deferred)
- [x] Action Templates: "Open via command", "Click element", "Verify visible", "Take screenshot"
- [x] Template picks fill in blanks (command ID, selector, label) and add multiple actions as a group
- [x] Remove action button on each action card

### FR-03: Assert Builder
- [x] When adding an assert action, show guided form
- [x] Type picker: leaf, visible, not-visible, text, event, eval, count, attr
- [x] Per-type fields:
  - `leaf`: viewType input (autocomplete from registered view types)
  - `visible` / `not-visible`: CSS selector input
  - `text`: CSS selector + expected text
  - `event`: event name (autocomplete from EVENT_CATALOG)
  - `eval`: code textarea + optional expected value
  - `count`: selector + expected count
  - `attr`: selector + attribute name + expected value

### FR-04: Event Autocomplete
- [x] Start event and end event inputs provide typeahead search over EVENT_CATALOG (360+ events)
- [x] Results grouped by category with category badges
- [x] Each result shows event name and description
- [x] Same autocomplete available in assert-event action builder

### FR-05: Command Picker
- [x] When adding a command action, show searchable autocomplete of all registered commands
- [x] Commands loaded from registry (~40 commands) with domain badges
- [x] Each command shows ID and display name
- [x] Selected command auto-populates the `id` field

### FR-06: Live JSON Preview
- [x] Collapsible panel at bottom of sidebar
- [x] Shows generated journey JSON in real-time as author builds
- [x] Updates on every field change
- [x] Monospace code block rendering
- [x] Copy-to-clipboard button with icon feedback

### FR-07: Canvas Sync (JSON → Canvas)
- [x] When the sidebar has an active journey, a companion canvas file is created/updated
- [x] Canvas layout matches the test-runner output format (START → Steps → END)
- [x] Adding a step creates a new step group node on the canvas
- [x] Removing a step removes the canvas node and reflows edges
- [x] Editing step metadata updates the config text node content
- [x] Adding/removing actions updates action nodes below the step group
- [ ] Improvement cards render as yellow nodes above step groups (deferred — no improvements in builder yet)

### FR-08: Canvas Sync (Canvas → JSON)
- [ ] Opening a `.canvas` file that contains journey-structured nodes triggers detection
- [ ] Detection: START node + sequential step groups + END node pattern
- [ ] **Convert to Journey** command parses canvas into JourneyDefinition
- [ ] Step group labels → `steps[i].title` and `guideSection`
- [ ] Config text node → parsed into structured metadata
- [ ] Action nodes → `steps[i].actions[]`
- [ ] Edge ordering → step sequence
- [ ] Improvement cards (yellow, color "3") → `steps[i].improvements[]`

### FR-09: Preview Run
- [ ] "Preview Run" button in the step editor toolbar
- [ ] Executes the current journey definition using the same action runner as E2E tests
- [ ] Steps execute sequentially; canvas nodes update in real-time (green = pass, red = fail)
- [ ] Screenshots captured and embedded as step group backgrounds
- [ ] Event trace collected and shown in Events Summary node
- [ ] Final canvas matches `generateJourneyCanvas()` output
- [ ] Results inspectable: click any step node to see pass/fail details
- [ ] Preview does NOT require the test vault — runs in the current vault

### FR-10: Export
- [x] "Export" button generates three files:
  - `journeys/<name>.journey.json` — full JourneyDefinition
  - `tests/e2e/<chapter>-journey-<slug>.test.ts` — thin executor wrapper (8-line boilerplate)
  - `journeys/<name>.canvas` — companion canvas matching test-runner layout
- [x] Export uses EventBridge file pipeline (adapter fallback for .json, .ts)
- [x] Emits `journey-builder.exported` with paths and definition

### FR-11: Open Existing
- [x] "Open Existing" card on welcome screen
- [x] File picker shows `.journey.json` files in vault (FuzzySuggestModal)
- [x] Selected file loaded into sidebar for editing
- [x] Canvas companion file opened alongside (if exists)
- [x] All fields populated from JSON, ready for step-by-step editing

### FR-12: Dual Input for Journey Runner
- [ ] Journey Runner accepts both `.journey.json` and `.canvas` files as input
- [ ] Canvas input: parsed via FR-08 conversion, then executed normally
- [ ] JSON input: unchanged behavior (existing flow)
- [ ] Results output format identical regardless of input format

---

## 7. Architecture

### Component Map

```
┌─────────────────────────────────────────────────────┐
│                JourneyBuilderSidebar                │  ← UI (Obsidian ItemView)
│  ┌──────────┐ ┌──────────┐ ┌───────────┐          │
│  │ StepCard │ │ NavBar   │ │ JSONPanel │          │
│  │ (editor) │ │ prev/nxt │ │ (preview) │          │
│  └──────────┘ └──────────┘ └───────────┘          │
└────────────────────┬────────────────────────────────┘
                     │ events
┌────────────────────▼────────────────────────────────┐
│              JourneyBuilderService                  │  ← Domain
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ StepManager  │ │ CanvasSync   │ │ PreviewRun  │ │
│  │ (CRUD steps) │ │ (JSON↔Canvas)│ │ (executor)  │ │
│  └──────────────┘ └──────────────┘ └─────────────┘ │
└────────────────────┬────────────────────────────────┘
                     │ events
┌────────────────────▼────────────────────────────────┐
│         EventBridge / FileSystemClient              │  ← Infrastructure
│  (adapter fallback for .json/.ts/.canvas)           │
└─────────────────────────────────────────────────────┘
```

### Event Flow

```
Sidebar edit → journey-builder.step.updated
           → JourneyBuilderService.handleStepUpdate()
           → updates in-memory definition
           → generates canvas JSON (reuse generateJourneyCanvas logic)
           → file.update.request (canvas)
           → EventBridge writes via adapter
           → journey-builder.canvas.synced
```

---

## 8. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Canvas layout | Reuse `generateJourneyCanvas()` layout | Consistency: authored canvas = test-runner canvas |
| Canvas sync direction | Bidirectional (JSON ↔ Canvas) | Enables both sidebar-first and canvas-first workflows |
| Preview execution | Reuse action runner from E2E helpers | DRY: same tool vocabulary, same execution semantics |
| File format detection | Extension-based in EventBridge | Already implemented (C54 Inc 14 adapter fallback) |
| Step editor UX | Prev/next + single step card | Focused editing; avoids overwhelming with all steps at once |
| JSON preview | Debounced panel in sidebar | Immediate feedback without modal switching |

---

## 9. Success Metrics

| Metric | Target |
|---|---|
| Journey authoring time (new journey) | < 10 min for a 5-step journey |
| Round-trip fidelity (JSON → Canvas → JSON) | 100% lossless |
| Canvas output match (preview vs test-runner) | Identical layout |
| Action builder coverage | All 26 tools configurable |
| Event autocomplete coverage | 360+ events searchable |
| Test coverage | > 200 tests |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Canvas write performance on every keystroke | Medium | Debounce canvas sync (500ms); batch node updates |
| Canvas → JSON parsing is lossy for hand-edited canvases | High | Strict structural detection; warn on unrecognized nodes |
| Preview run in current vault may modify state | Medium | Sandbox mode: revert file changes, dismiss notices after run |
| 26-tool action builder is complex | High | Action Templates reduce common cases to 1-click; full builder is opt-in |
| Bidirectional sync conflicts | Medium | Last-write-wins with dirty tracking; sidebar is source of truth when open |

---

## 11. Delivery Plan

### Phase 1: Step Editor + Smart Inputs (Cycle 55) — DELIVERED
FR-01 (Step editor), FR-02 (Action builder + templates), FR-03 (Assert builder), FR-04 (Event autocomplete), FR-05 (Command picker), FR-06 (JSON preview), FR-07 (JSON → Canvas sync), FR-10 (Export), FR-11 (Open existing)

### Phase 2: Canvas Round-Trip (Cycle 56)
FR-08 (Canvas → JSON), FR-12 (Dual input for runner)

### Phase 4: Preview Run (Cycle 56-57)
FR-09 (Preview run with live canvas updates)

---

## 12. Stage History

| Date | Version | Stage | Cycle | Summary |
|------|---------|-------|-------|---------|
| 2026-03-02 | 1.0 | in-progress | C54 | PRD created. C54 spike delivered: sidebar (3 states), service, EventBridge adapter, 6 events |
| 2026-03-05 | 1.1 | in-progress | C55 | Phase 1 delivered: 9/9 PBIs done. Step editor, action builder (34 tools + 4 templates), event autocomplete, command picker, assert builder, JSON preview, canvas sync, export, open existing. 399 new tests. FRI 23/35 |

---

## 13. Backlog

| PBI | Title | Status | Cycle |
|-----|-------|--------|-------|
| JB-001 | Step Editor + Navigation | Done | C55 |
| JB-002 | Action Builder + Templates | Done | C55 |
| JB-003 | Event Autocomplete | Done | C55 |
| JB-004 | Command Picker | Done | C55 |
| JB-005 | Assert Builder | Done | C55 |
| JB-006 | Live JSON Preview | Done | C55 |
| JB-007 | Canvas Sync (JSON → Canvas) | Done | C55 |
| JB-008 | Canvas Sync (Canvas → JSON) | Planned | C56 |
| JB-009 | Export (3-file) | Done | C55 |
| JB-010 | Open Existing Journey | Done | C55 |
| JB-011 | Preview Run | Planned | C56 |
| JB-012 | Dual Input for Journey Runner | Planned | C56 |
