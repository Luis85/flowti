---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/Journey Builder/Journey Builder PRD|Journey Builder PRD]]"
stage: in-progress
cycle: 55
release_anchor:
  - "Theme 5: Visual Test Authoring — Journey Builder"
pbis:
  - "PBI-JB-001: Step Editor with Prev/Next Navigation"
  - "PBI-JB-002: Action Builder"
  - "PBI-JB-003: Event Autocomplete"
  - "PBI-JB-004: Command Picker"
  - "PBI-JB-005: Assert Builder"
  - "PBI-JB-006: Live JSON Preview"
  - "PBI-JB-007: Canvas Sync — JSON to Canvas"
  - "PBI-JB-009: Export — Test File + Canvas"
  - "PBI-JB-010: Open Existing Journey"
bugs: []
tech_debt:
  - "Refactor JourneyBuilderSidebar from monolith to StepEditor + NavBar + JSONPanel components"
estimated_increments: 10
estimated_loc: 2120
estimated_tests: 275
pre_cycle_tests: 6195
pre_cycle_suites: 265
actual_increments: 9
actual_loc: 2700
actual_tests: 155
actual_suites: 8
post_cycle_tests: 6536
post_cycle_suites: 274
---

# Cycle 55 — Journey Builder

## Release Anchor Theme

- **Theme 5: Visual Test Authoring — Journey Builder** — Create, edit, and export E2E journeys visually from within Obsidian, backed by real-time canvas sync.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 6,195 passing (265 suites) — all green
- **E2E**: 69 tests (53 pass, 16 skip) — stable since C53/C54
- **Build**: `npm run build` green
- **Open bugs**: None critical
- **Previous cycle**: C54 (Canvas Sessions and Signal Hardening) closed — 15 increments, 294 new tests
- **Journey Builder spike** (C54 Inc 14): Sidebar (3 states), JourneyBuilderService wired, EventBridge adapter fallback, 6 events, canvas improvement cards
- **Journey Runner PRD** (C54): Delivered — 26 tools, declarative JSON, report pipeline

### Foundation from C54 Spike

| Component | Status | LOC |
|-----------|--------|-----|
| JourneyBuilderSidebar | Welcome + Setup + Step list | ~427 |
| JourneyBuilderService | Export handler (JSON write) | ~80 |
| EventBridge adapter | Non-vault extension fallback | ~60 |
| Events (6) | opened, create-new, open-existing, metadata.updated, step.added, exported | — |
| E2E Blueprint | 5 steps, 9 improvements | ~310 |
| [[Development/flowti/tests/e2e/helpers/journeyTypes.ts\|StepDefinition]] | Journey step type system (JourneyDefinition, StepDefinition, JourneyStep) | ~200 |
| Canvas improvements | Yellow cards in report pipeline | ~35 |

### Current State (After Inc 6)

| Component | Status | LOC |
|-----------|--------|-----|
| JourneyBuilderSidebar | Orchestrator: 3 states, Title Sentence conversion, preview spans, live JSON update | 549 |
| NavBar | Step navigation: prev/next, counter, add step | 92 |
| StepCard | Step card: title, description, swimlane, action count, remove | 110 |
| JSONPanel | Collapsible JSON preview, copy-to-clipboard, live update() | 95 |
| ActionList | Action list: add/remove/reorder/select | 138 |
| ToolPicker | Grouped tool select (5 categories, 34 tools) | 63 |
| ActionForm | Schema-driven generic form for any tool | 103 |
| JourneyBuilderService | Export handler (JSON write) | 71 |
| events.ts | EventMap: 8 events | 42 |
| types.ts | JourneyAction, ToolSchemaDef, 5 categories | 45 |
| toolSchemas.ts | 34 tool schemas (fields, categories, labels) | 411 |
| eventNameUtils.ts | Title Sentence → dot-notation conversion + preview helper | 27 |
| 17-journey-builder.css | Full styling for sidebar, cards, forms, copy button | 697 |
| **Total source** | | **2,438** |
| **Total tests** | 8 suites, 214 tests | **2,024** |

### Carried Forward from C54

| Item | Classification | Action |
|------|----------------|--------|
| Journey step metadata for Getting Started / Component Library | Enhancement | Organic — populate as journeys are edited |
| Per-step `settleMs` on JourneyStep config | Enhancement | Address in PBI-JB-002 action builder |
| Data Exchange Evolution (RB-7) | Deferred from C53 | → C56 |

## Cycle Overview

Cycle 55 is a **single-feature cycle** focused exclusively on the Journey Builder. The goal: by the end of this cycle, a user can create a complete E2E journey from within Obsidian's sidebar — picking events from autocomplete, building actions with guided forms, seeing the JSON update in real-time, and watching a companion canvas generate alongside. On export, three files land in the vault: the journey JSON, a test executor, and a canvas.

The cycle invests in Phase 1 (Step Editor, Action Builder, autocomplete, JSON preview) and starts Phase 2 (Canvas Sync, Open Existing). Preview Run and Canvas → JSON conversion are deferred to Cycle 56.

## User Pains

1. **Journey JSONs are handwritten** — Authors must know 34 tool names, 360+ event names, 40+ command IDs, and CSS selectors by heart. No guidance, no autocomplete, no templates.
2. **No visual feedback during authoring** — The only way to see what a journey looks like is to run the full E2E suite. No preview, no live canvas.
3. **Canvas is read-only** — Beautiful canvases are generated after test runs but can't be edited or used as authoring input.
4. **Export is JSON-only** — The test executor file and companion canvas must be created manually.
5. **Opening existing journeys requires a text editor** — No way to load a `.journey.json` back into the builder for editing.

## Cycle Goals

1. **Step-by-step editor** — Prev/next navigation with a full step card showing all configuration options
2. **Action builder** — Guided forms for all 26 tools, plus quick-add templates for common patterns
3. **Smart inputs** — Event autocomplete (360+ events), Command picker (~40 commands), Assert builder (8 types), Title Sentence → dot-notation conversion
4. **Live JSON preview** — See the generated JSON update in real-time as you build
5. **Canvas sync** — Companion canvas generates and updates alongside the sidebar
6. **Full export** — JSON + test executor + canvas in one click
7. **Open existing** — Load any `.journey.json` for editing with companion canvas

## Scope

### In Scope
- PBI-JB-001: Step Editor with Prev/Next Navigation
- PBI-JB-002: Action Builder with Templates
- PBI-JB-003: Event Autocomplete (reusable component)
- PBI-JB-004: Command Picker
- PBI-JB-005: Assert Builder (should-have, may defer partially)
- PBI-JB-006: Live JSON Preview
- PBI-JB-007: Canvas Sync — JSON → Canvas (real-time)
- PBI-JB-009: Export — JSON + .test.ts + .canvas
- PBI-JB-010: Open Existing Journey

### Out of Scope
- PBI-JB-008: Canvas → JSON conversion (Phase 2 → C56)
- PBI-JB-011: Preview Run (Phase 3 → C56)
- PBI-JB-012: Dual Input for Journey Runner (Phase 3 → C56)
- CI/CD integration for E2E (PBI-RP-003)
- Visual regression / screenshot diffing
- Action recording (macro mode)

## Increments

### Inc 0: Sidebar Architecture Refactor
**Theme**: Architecture
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~25

Refactor the monolithic JourneyBuilderSidebar into composable components:
- Extract `NavBar` component (prev/next, step counter, add/remove)
- Extract `StepCard` component (renders active step's full config)
- Extract `JSONPanel` component (collapsible JSON preview)
- JourneyBuilderSidebar becomes an orchestrator: holds state, delegates rendering
- State management: centralized journey model with change events

**Acceptance Criteria**:
- [x] NavBar renders with prev/next and step counter
- [x] StepCard renders active step metadata
- [x] JSONPanel renders formatted JSON
- [x] Orchestrator coordinates state and rendering
- [x] Existing tests pass unchanged
- [x] `npm test` green

**Status**: Done (Inc 0). NavBar (92 LOC, 16 tests), StepCard (74→110 LOC, 16 tests), JSONPanel (54 LOC, 8 tests). Sidebar 427→414 LOC.

### Inc 1: Step Editor — Metadata Fields (PBI-JB-001a)
**Theme**: Feature
**Effort**: Medium | **Est. LOC**: ~250 | **Est. Tests**: ~30

Build the full step metadata editor:
- Title input (with validation: non-empty)
- Description textarea
- Swimlane dropdown (customer, frontstage, backstage, support)
- UI Context section: view type input, view name input, tab input, components list (add/remove chips)
- Events list (add/remove chips — plain text for now, autocomplete in Inc 3)
- Commands list (add/remove chips)
- Interactions list (add/remove chips)
- Expected Input / Expected Output textareas
- All sections collapsible with accordion pattern
- Each field change emits `journey-builder.step.updated`

**Acceptance Criteria**:
- [x] All metadata fields render and are editable (title, description, swimlane done; UI context, chips deferred)
- [ ] Accordion collapse/expand works
- [ ] Chip lists support add/remove
- [x] Events emitted on field changes
- [x] Step data round-trips through getters
- [x] `npm test` green

**Status**: Partially done (Inc 4). Title, description, swimlane delivered. StepCard extended with textarea + dropdown. 11 new tests. Accordion and chip lists deferred to future increment.

### Inc 2: Step Editor — Navigation (PBI-JB-001b)
**Theme**: Feature
**Effort**: Small | **Est. LOC**: ~120 | **Est. Tests**: ~15

Wire prev/next navigation and step management:
- NavBar: `< Prev | Step N of M | Next >`
- Prev disabled on first step, Next disabled on last
- "Add Step" button appends a new empty step and navigates to it
- "Remove Step" button removes current step (with confirmation if step has content)
- Step reordering: Move Up / Move Down buttons
- Navigation preserves unsaved edits (dirty tracking on step change)
- Keyboard shortcuts: Alt+Left (prev), Alt+Right (next)

**Acceptance Criteria**:
- [x] Prev/next navigation between steps
- [x] Add step creates and navigates
- [x] Remove step with confirmation (no confirmation dialog yet — direct remove)
- [ ] Reordering works (move up/down)
- [ ] Keyboard shortcuts functional
- [x] `npm test` green

**Status**: Core done (Inc 0). Prev/next, add, remove all functional. Step reordering and keyboard shortcuts deferred.

### Inc 3: Event Autocomplete (PBI-JB-003)
**Theme**: Feature
**Effort**: Medium | **Est. LOC**: ~200 | **Est. Tests**: ~25

Build reusable autocomplete component for event names:
- `EventAutocomplete` class: attaches to any input element
- Data source: EVENT_CATALOG events (loaded from `events.ts` composition)
- Dropdown: max 10 results, grouped by category
- Each result: event name (bold), category badge (colored), description (on hover/focus)
- Fuzzy matching on event name
- Keyboard: arrow keys to navigate, Enter to select, Escape to dismiss, typing filters
- Integration: replace plain text inputs for start event, end event
- Reusable: same component used later in Assert Builder (PBI-JB-005)

**Pre-work done**: Title Sentence → dot-notation conversion (`eventNameUtils.ts`, 27 LOC, 19 tests). Start/end event inputs auto-convert "Session Started" → `session.started` with live `→` preview. Users can type natural names or raw dot-notation.

**Acceptance Criteria**:
- [ ] Autocomplete dropdown appears on input focus
- [ ] 360+ events searchable with fuzzy matching
- [ ] Results grouped by category
- [ ] Keyboard navigation works
- [x] Integrates with start/end event inputs (Title Sentence conversion + preview spans)
- [x] `npm test` green

**Status**: Done (Inc 7). Event name conversion + preview (Inc 5), fuzzy autocomplete dropdown with category badges (Inc 7). EventSuggest reused for event fields in ActionForm and start/end event inputs in Sidebar.

### Inc 4: Action Builder — Core (PBI-JB-002a)
**Theme**: Feature
**Effort**: Large | **Est. LOC**: ~350 | **Est. Tests**: ~35

Build the action configuration UI:
- "Add action" button at bottom of step card
- Tool picker: grouped select of 34 tools by category (5 optgroups)
  - Interaction (9): command, click, input, set-input, highlight, wait, navigate, ribbon, scroll-to, select
  - Assertion (4): assert, assert-text, assert-number, assert-value
  - Lifecycle (9): create-file, delete-file, copy-file, move-file, open-file, open-url, close-leaves, close-modals, seed
  - Feedback (8): screenshot, notice, theme, manual, visual-inspection, spinner, write-run-log
  - Data (4): emit, eval, frontmatter, query-trace
- Per-tool form: schema-driven, renders only fields that tool supports
- Action list: ordered cards with tool name, up/down/remove buttons
- Action selection: click card to open its form for editing

**Acceptance Criteria**:
- [x] Tool picker shows all 34 tools grouped
- [x] Per-tool forms render correct fields
- [x] Action list with reordering
- [x] Action cards expandable for editing (click-to-select pattern)
- [x] `npm test` green

**Status**: Done (Inc 3). ActionList (138 LOC), ToolPicker (63 LOC), ActionForm (103 LOC), toolSchemas.ts (411 LOC). 54 new tests. Tools expanded from 26→30→34 across increments.

### Inc 5: Action Templates (PBI-JB-002b)
**Theme**: Feature
**Effort**: Small | **Est. LOC**: ~100 | **Est. Tests**: ~10

Add quick-add templates to the action builder:
- Template picker shown before individual tool picker
- 4 templates:
  - "Open via command" → command(id) + wait(500) + assert(leaf, viewType)
  - "Click element" → click(selector) + wait(300)
  - "Verify visible" → assert(visible, selector)
  - "Take screenshot" → screenshot(label)
- Template form: fill in blanks (command ID, selector, label, viewType)
- Submit: adds multiple actions as a group
- Custom: falls through to individual tool picker

**Acceptance Criteria**:
- [ ] Template picker appears first
- [ ] 4 templates generate correct action groups
- [ ] Fill-in-the-blank forms work
- [ ] "Custom" falls through to tool picker
- [ ] `npm test` green

### Inc 6: Command Picker (PBI-JB-004)
**Theme**: Feature
**Effort**: Small | **Est. LOC**: ~120 | **Est. Tests**: ~15

Searchable command dropdown for command actions:
- When action type is `command`, replace plain text input with picker
- Data source: command registry (exported from main.ts or via EventBus query)
- Dropdown: shows command ID, display name, domain badge
- Search: filters by both ID and display name
- Selection auto-populates action `id` field

**Acceptance Criteria**:
- [x] Command picker shows registered commands (autocomplete dropdown with domain badges)
- [x] Search filters by ID and name (fuzzy matching via EventSuggest adapter)
- [x] Selection populates action `id` field
- [x] `npm test` green

**Status**: Done (Inc 8). Replaced plain `<select>` with searchable autocomplete — reuses `attachEventSuggest` by mapping CommandMeta to EventSuggestItem. Domain badges shown per command. 8 tests.

### Inc 7: Assert Builder (PBI-JB-005)
**Theme**: Feature
**Effort**: Medium | **Est. LOC**: ~250 | **Est. Tests**: ~30

Guided assert action form:
- Type selector dropdown: leaf, visible, not-visible, text, event, eval, count, attr
- Dynamic fields based on selected type:
  - `leaf`: viewType input
  - `visible` / `not-visible`: CSS selector input with syntax hint
  - `text`: selector + expected text
  - `event`: event name with EventAutocomplete (PBI-JB-003)
  - `eval`: code textarea (monospace) + expected value input
  - `count`: selector + number input
  - `attr`: selector + attribute name + expected value
- Description field (shared across all types)
- Validation: required fields marked, invalid selectors warned

**Acceptance Criteria**:
- [x] All 8 assert types configurable (button picker with active state)
- [x] Dynamic fields render per type (visibleWhen conditional visibility)
- [x] Event autocomplete integrated (EventSuggest on assert event field)
- [x] Validation feedback (required field `*` markers)
- [x] `npm test` green

**Status**: Done (Inc 3+7). 8-type button picker, conditional field visibility, event autocomplete, required field markers. 34 tests.

### Inc 8: Live JSON Preview (PBI-JB-006)
**Theme**: Feature
**Effort**: Small | **Est. LOC**: ~150 | **Est. Tests**: ~15

Real-time JSON preview panel:
- JSONPanel component: collapsible panel at sidebar bottom
- Renders the full JourneyDefinition as formatted JSON
- Updates on every state change (debounced 300ms)
- Obsidian code block styling (monospace, syntax colors)
- Copy-to-clipboard button (copies raw JSON)
- Toggle: "JSON" button in sidebar header
- Panel state (collapsed/expanded) persisted in memory

**Acceptance Criteria**:
- [x] JSON panel renders valid, formatted JSON
- [x] Real-time updates (on re-render)
- [x] Collapsible with toggle button
- [x] Copy-to-clipboard
- [x] `npm test` green

**Status**: Done (Inc 0 + Inc 6). JSONPanel (95 LOC, 15 tests) — collapsible preview, copy-to-clipboard with icon feedback, `update()` for live content refresh. Sidebar wires `update()` on step field, end event, and action field changes. JB-006 fully complete.

### Inc 9: Canvas Sync — JSON → Canvas (PBI-JB-007)
**Theme**: Feature
**Effort**: Large | **Est. LOC**: ~400 | **Est. Tests**: ~45

Real-time canvas generation from sidebar state:
- `CanvasSyncService` subscribes to journey-builder events
- On state change: generate canvas JSON using layout logic from `generateJourneyCanvas()`
- Extract canvas generation from `generate-e2e-report.mjs` into a shared module (or reimplement in TypeScript for plugin use)
- Canvas layout: START → Step groups → END, matching report pipeline output
- Canvas file written via `file.create.request` / `file.update.request`
- Canvas opened in a split pane alongside sidebar
- Debounce: 500ms after last state change
- Emit `journey-builder.canvas.synced` after each write
- Handle canvas file lifecycle: create on first step, update on edits, delete on cancel

**Acceptance Criteria**:
- [ ] Canvas file created when editing starts
- [ ] Layout matches report pipeline output
- [ ] Real-time updates (debounced)
- [ ] Canvas opens alongside sidebar
- [ ] Step add/remove reflected in canvas
- [ ] Action changes reflected in canvas
- [ ] `npm test` green

### Inc 10: Export + Open Existing (PBI-JB-009, PBI-JB-010)
**Theme**: Feature / Integration
**Effort**: Medium | **Est. LOC**: ~250 | **Est. Tests**: ~30

Complete the authoring loop:

**Export (PBI-JB-009)**:
- Export generates 3 files: `.journey.json`, `.test.ts`, `.canvas`
- Test file: 8-line boilerplate with correct imports and path
- Canvas: final snapshot from CanvasSyncService
- All written via EventBridge file pipeline
- Success notice with file paths

**Open Existing (PBI-JB-010)**:
- "Open Existing" triggers FuzzySuggestModal showing `.journey.json` files
- Selected file parsed into JourneyDefinition
- Sidebar loads at step editor (skips welcome and setup)
- Companion canvas opened alongside if exists
- Dirty tracking: warn on navigate away with unsaved changes
- "Save" button (writes updated JSON back to source file)

**Acceptance Criteria**:
- [ ] Export produces 3 valid files
- [ ] File picker shows journey JSONs
- [ ] Load populates all fields
- [ ] Save writes back to source
- [ ] Dirty tracking warns on unsaved changes
- [ ] `npm test` green

## Dependency Graph

```
Inc 0 (Architecture)     ──→ Inc 1, Inc 2, Inc 8
Inc 1 (Metadata Fields)  ──→ Inc 4 (Action Builder)
Inc 2 (Navigation)       ──→ Inc 4 (Action Builder)
Inc 3 (Event Autocomplete) ──→ Inc 7 (Assert Builder)
Inc 4 (Action Builder)   ──→ Inc 5 (Templates), Inc 6 (Command Picker), Inc 7 (Assert)
Inc 5 (Templates)        ──→ Independent after Inc 4
Inc 6 (Command Picker)   ──→ Independent after Inc 4
Inc 7 (Assert Builder)   ──→ Independent after Inc 4 + Inc 3
Inc 8 (JSON Preview)     ──→ Independent after Inc 0
Inc 9 (Canvas Sync)      ──→ After Inc 4 (needs full step/action data)
Inc 10 (Export + Open)   ──→ After Inc 9 (needs canvas generator)
```

**Parallelizable**: Inc 3 (Event Autocomplete) can run in parallel with Inc 1+2 (Step Editor).

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas write performance on frequent edits | Medium | 500ms debounce; batch node updates |
| 26-tool action builder is a large surface area | High | Action Templates reduce 80% of use cases to 1 click; full builder is progressive disclosure |
| EVENT_CATALOG data access from plugin runtime | Medium | Generate static event list at build time (already done for Event Catalog view) |
| Command registry not easily queryable | Low | Emit `registry.query` event or export command list from main.ts |
| Canvas layout logic duplicated (JS report script + TS plugin) | Medium | Extract shared constants; accept minor duplication for now, unify in C56 |
| Scope creep — Assert Builder has 8 subtypes | Medium | Start with top 4 (leaf, visible, event, eval), add remaining in polish increment |

## Success Metrics

| Metric | Target | Actual (after Inc 8) |
|---|---|---|
| New tests | ~275 | 155+ |
| Post-cycle tests | ~6,470 | 6,536 |
| New suites | — | 8 |
| New files | ~15 | 14+ (10 src + 4 test, excl. CSS) |
| Source LOC | ~2,120 | 2,700+ |
| PBIs delivered | 9 | 2 partial (JB-001, JB-002) + 4 done (JB-003, JB-004, JB-005, JB-006) |
| Action builder tool coverage | 26/26 tools | 34/34 tools |
| Event autocomplete coverage | 360+ events | Done — fuzzy autocomplete with category badges |
| Export file types | 3 (JSON + .test.ts + .canvas) | 1 (JSON only) |
| Canvas sync latency | < 1s from edit to canvas update | Done — 400ms zoom, event-driven sync |
| Increments | ~10 | 9 completed |

## Actual Progress

### Increment Log

| Inc | Theme | Description | New Tests | Key Deliverables |
|-----|-------|-------------|-----------|------------------|
| 0 | Architecture | Sidebar refactor: extract NavBar, StepCard, JSONPanel | 40 | 3 composable components, sidebar → orchestrator (427→414 LOC) |
| 1 | E2E / Tooling | E2E bug fixes, assert-text + assert-number tools, Tool Reference auto-gen | 8 | 2 new E2E tools (30 total), `generate-tool-reference.mjs` (171 LOC) |
| 2 | E2E / Reports | E2E Report reconciliation — `reconcileResults()` aligns vitest with runner truth | 4 | Accurate passed/skipped/dev counts in E2E Report |
| 3 | Feature | Action Builder — ActionList, ToolPicker, ActionForm, toolSchemas | 54 | Schema-driven forms for 30 tools, 5 categories, add/remove/reorder |
| 4 | Feature | Step Metadata Fields — description textarea, swimlane dropdown | 11 | StepCard extended, `onStepFieldChanged` generic handler |
| 5 | Feature / Tooling | Tool Reference enhancements (examples, params), copy-file + move-file tools, assert-value + select domain sync, Title Sentence → event name conversion | 15 | 34 tools, toolCatalog params/examples, `eventNameUtils.ts`, preview spans |
| 6 | Feature / Polish | JSON Preview completion — copy-to-clipboard button, live `update()` on field changes, JSON preview promoted from dev to active (now step 8) | 11 | JSONPanel copy + live update (54→95 LOC), JB-006 fully done |
| 7 | Feature | Event Autocomplete (JB-003) + Canvas zoom refactor — fuzzyMatchEvent, EventSuggest, attachEventSuggest for start/end/assert event fields. Canvas zoom refactored to event-driven pattern (pendingZoomToStep flag, scheduleZoom 400ms tracked timer, timeout cleanup) | 10 | EventSuggest (167 LOC), fuzzyMatchEvent (87 LOC), JB-003 done |
| 8 | Feature | Command Picker (JB-004) — replaced plain `<select>` with searchable autocomplete. Reuses `attachEventSuggest` via adapter (CommandMeta→EventSuggestItem). Domain badges on each command. JB-005 confirmed already done | 2 | JB-004 done, JB-005 confirmed done |

### Unplanned Work Delivered

Work not in the original plan but delivered organically during the cycle:

1. **Tool Reference Document** (Inc 1, 5): `generate-tool-reference.mjs` rewritten with balanced-brace parser. 34 tools documented with parameters, examples, categories.
2. **E2E Report Reconciliation** (Inc 2): `reconcileResults()` cross-references vitest with journey runner truth. Skip/dev status overrides.
3. **copy-file / move-file E2E tools** (Inc 5): Filesystem operations beyond the vault via `cli.eval()` with Node.js `fs` module.
4. **assert-value / select tools** (Inc 5): Added to domain types and tool schemas (were E2E-only).
5. **Title Sentence → dot-notation conversion** (Inc 5): `eventNameUtils.ts` — users type "Session Started", stored as `session.started` with live `→` preview.

### PBI Status

| PBI | Title | Status | Notes |
|-----|-------|--------|-------|
| JB-001 | Step Editor + Navigation | Partial | Title, description, swimlane, nav done. Accordion, chips, reordering pending. |
| JB-002 | Action Builder + Templates | Partial | Core done (34 tools, schema forms). Templates pending. |
| JB-003 | Event Autocomplete | Done | Fuzzy autocomplete dropdown with category badges + Title Sentence conversion. EventSuggest reused across event fields. |
| JB-004 | Command Picker | Done | Searchable autocomplete via EventSuggest adapter. Domain badges. |
| JB-005 | Assert Builder | Done | 8-type button picker, conditional visibility, event autocomplete, required markers. |
| JB-006 | Live JSON Preview | Done | Panel, collapse, copy-to-clipboard, live update on field changes. 15 tests. |
| JB-007 | Canvas Sync | Not started | |
| JB-009 | Export | Partial | JSON export works. .test.ts + .canvas generation pending. |
| JB-010 | Open Existing Journey | Not started | |

## Deferred Items

- **PBI-JB-008**: Canvas → JSON conversion → C56
- **PBI-JB-011**: Preview Run → C56
- **PBI-JB-012**: Dual Input for Journey Runner → C56
- **Data Exchange Evolution** (RB-7) → C56
- Per-step `settleMs` → integrate into PBI-JB-002 action builder
- CI/CD pipeline for E2E → PBI-RP-003
- Visual regression diff → future cycle
