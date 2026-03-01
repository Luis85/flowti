---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: delivered
related_events:
  - session.create
  - session.created
  - session.pause
  - session.paused
  - session.resume
  - session.resumed
  - session.complete
  - session.completed
  - session.closure.started
  - hub.navigate
  - hub.tab.changed
  - canvas.session.started
maturity: L3
business_value: 5
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 2
design_cost: 3
test_cost: 2
priority: 5
version: "1.0"
delivered_cycle: 54
tags: core
---

# PRD: Journey Runner — Declarative E2E Test Framework

> Architecture reference: [[Development/flowti/docs/cycles/Cycle 54 - Canvas Sessions and Signal Hardening|Cycle 54]]

---

## 1. Problem Statement

E2E journey tests validate Flowti's user-facing flows inside a live Obsidian vault. Before this feature, each journey was a 200–700 LOC imperative TypeScript file that mixed step metadata (titles, descriptions, UI context, events) with action logic (DOM selectors, CLI calls, event assertions). This caused several problems:

- **Authoring friction** — writing a new journey required deep knowledge of the test helpers, ObsidianCli API, and vitest wiring patterns
- **Duplication** — action patterns (click, input, assert visibility, emit event) were re-implemented per test file
- **Readability** — step intent was buried under imperative boilerplate
- **Report coupling** — the report pipeline reads step metadata from JourneyRunner; imperative tests had to manually construct these objects
- **Maintenance** — selector changes or API changes required edits across every journey file

**Who is affected?** Developers authoring and maintaining E2E tests, and anyone reviewing test coverage via journey reports.

**What breaks?** Without this feature, adding a new journey requires 200+ LOC of imperative wiring. Config changes (selectors, waits, assertions) require TypeScript edits and rebuild. Report metadata must be manually kept in sync with test logic.

**Why it matters:** Flowti's E2E suite is a living documentation system — journey reports, canvases, and event traces are generated from test runs and published to both the test vault and dev vault. The quality of this documentation depends on the quality and maintainability of the test infrastructure.

---

## 2. Outcome

After implementation:

- **Authors** define journeys as declarative JSON configs (~230 LOC) instead of imperative TypeScript (~500 LOC)
- **Test files** become thin wrappers (~10 LOC) that load and execute a JSON config
- **Actions** are dispatched from a finite, documented tool vocabulary (10 tools)
- **Cross-step data** flows via variable interpolation (`{{sessionId}}`) instead of closure-captured state
- **Report pipeline** works unchanged — JourneyRunner receives the same step metadata
- **New journeys** can be authored by copying and editing a JSON file without touching TypeScript

---

## 3. Scope

### In Scope

- Declarative JSON journey configuration format (JourneyDefinition)
- TypeScript type system for JSON schema validation (journeyTypes.ts)
- Action runner dispatching 17 tools: command, click, input, highlight, wait, assert, emit, navigate, eval, screenshot, manual, notice, theme, create-file, delete-file, open-file, close-leaves
- Tool catalog with metadata, tags, and use-cases (toolCatalog.ts)
- Journey executor generating vitest describe/it blocks from JSON
- Dedicated `setup` and `teardown` step arrays with lifecycle guarantees
- Variable interpolation system (`{{key}}` syntax) with cross-step persistence
- Step capture timing options (afterSettle, afterAction) for transient UI
- Eval tool with expectation system (equals, truthy, json matching)
- Assert tool with 6 sub-types (visible, not-visible, text, event, leaf, eval)
- Canvas Session journey fully migrated to declarative config

### Out of Scope

- Migration of existing imperative journeys (Chapters 1–4) — these work and can be migrated incrementally
- GUI config editor for journey JSON files
- Runtime journey recording or playback
- Parallel step execution within a single journey
- Conditional branching between steps

---

## 4. UX Entry Points

This is a developer-facing infrastructure feature with no end-user UI. Entry points are:

- **npm scripts**: `npm run test:e2e:canvas-session` (or any journey-specific preset)
- **Journey JSON files**: `tests/e2e/journeys/<name>.journey.json`
- **Thin test wrappers**: `tests/e2e/<NN>-journey-<name>.test.ts`
- **Report output**: Journey reports, canvases, configs, and event traces generated in both test vault and dev vault

---

## 5. Functional Requirements

### 5.1 Journey Definition (JSON Schema)

- [x] FR-JR-001: Journey config defines `journey` (name), `chapter` (number), `description`, `testSource`, `reportPath`, `canvasPath`
- [x] FR-JR-002: Journey config declares an array of allowed `tools` (whitelist)
- [x] FR-JR-003: Journey config defines an ordered array of `steps`
- [x] FR-JR-004: Each step has `id`, `title`, `guideSection`, `description`, `expectedInput`, `expectedOutput`
- [x] FR-JR-005: Each step has optional `uiContext` (components, view, tab metadata)
- [x] FR-JR-006: Each step has optional `events`, `commands`, `interactions`, `queries` arrays (report metadata)
- [x] FR-JR-007: Each step has an `actions` array of tool-dispatched operations
- [x] FR-JR-008: ~~Each step has optional `capture` timing~~ [DEPRECATED — replaced by explicit screenshot actions]
- [x] FR-JR-009: Screenshot tool supports `label` field for explicit naming (`{stepId}--{label}.png`)

### 5.2 Tool Vocabulary

- [x] FR-JR-010: `command` tool executes an Obsidian command by ID
- [x] FR-JR-011: `click` tool clicks a DOM element by CSS selector
- [x] FR-JR-012: `input` tool types text into an input field by CSS selector
- [x] FR-JR-013: `highlight` tool visually annotates an element (element, button, or input style)
- [x] FR-JR-014: `wait` tool pauses execution for a specified duration (ms)
- [x] FR-JR-015: `screenshot` tool captures a screenshot to the step's output path
- [x] FR-JR-016: `navigate` tool navigates to a specific hub/view/tab combination
- [x] FR-JR-017: `assert` tool validates DOM state, event traces, or leaf existence (6 sub-types)
- [x] FR-JR-018: `emit` tool emits an event on the plugin's EventBus with a payload
- [x] FR-JR-019: `eval` tool executes arbitrary JavaScript in the Obsidian window context
- [x] FR-JR-020: `manual` tool documents human-intervention steps (skipped during automated execution)
- [x] FR-JR-074: `notice` tool displays an Obsidian Notice toast with interpolated message and optional duration
- [x] FR-JR-075: `theme` tool switches Obsidian's CSS theme (e.g., "obsidian" for dark, "moonstone" for light)
- [x] FR-JR-076: `create-file` lifecycle tool creates a vault file via Obsidian API, optionally stores path in variable
- [x] FR-JR-077: `delete-file` lifecycle tool deletes a vault file via Obsidian API
- [x] FR-JR-078: `open-file` lifecycle tool opens a vault file in an editor tab
- [x] FR-JR-079: `close-leaves` lifecycle tool closes all workspace leaves of a given view type
- [x] FR-JR-070: Multiple screenshots per step via explicit screenshot actions in actions array
- [x] FR-JR-071: Steps with explicit screenshots skip automatic screenshot capture
- [x] FR-JR-072: Steps without explicit screenshots still get one automatic screenshot (backward compat)
- [x] FR-JR-073: Error screenshots use `{stepId}--error.png` suffix to avoid collision with action screenshots

### 5.3 Variable System

- [x] FR-JR-020: All string fields in actions support `{{variableName}}` interpolation
- [x] FR-JR-021: Built-in variable `{{PLUGIN_ID}}` is always available
- [x] FR-JR-022: `eval` tool can `store` its result into the variable map for later steps
- [x] FR-JR-023: `emit` tool payload values are resolved through variable interpolation
- [x] FR-JR-024: Missing variable references throw a descriptive error

### 5.4 Assertion System

- [x] FR-JR-030: `assert.visible` checks element exists in DOM via CSS selector
- [x] FR-JR-031: `assert.not-visible` checks element does NOT exist in DOM
- [x] FR-JR-032: `assert.text` checks element textContent contains a substring
- [x] FR-JR-033: `assert.event` checks event trace for a specific event (with optional payload matching)
- [x] FR-JR-034: `assert.leaf` checks workspace has a leaf of specified view type
- [x] FR-JR-035: `assert.eval` evaluates JavaScript and checks result equals expected value

### 5.5 Eval Expectations

- [x] FR-JR-040: `eval.expect.equals` checks result string matches exactly
- [x] FR-JR-041: `eval.expect.truthy` checks result is non-empty and not "false"/"undefined"/"null"
- [x] FR-JR-042: `eval.expect.json` parses result as JSON and checks all fields in `match` object

### 5.6 Executor

- [x] FR-JR-050: Executor validates all actions use only declared tools before test registration
- [x] FR-JR-051: Executor generates one vitest `describe` block per journey
- [x] FR-JR-052: Executor generates one vitest `it` block per step
- [x] FR-JR-053: Executor manages fixture lifecycle (beforeAll/afterAll)
- [x] FR-JR-054: Executor passes step metadata to JourneyRunner for report generation
- [x] FR-JR-055: Executor shares variable map across all steps in a journey
- [x] FR-JR-056: Variables persist across steps (e.g., session ID from step 6 used in step 7)

### 5.7 Setup and Teardown

- [x] FR-JR-080: Journey definition supports optional `setup` step array (runs before main steps)
- [x] FR-JR-081: Journey definition supports optional `teardown` step array (runs after main steps)
- [x] FR-JR-082: Setup steps execute in `beforeAll` hook, failures set `setupFailed` flag
- [x] FR-JR-083: If setup fails, main journey steps are skipped (recorded as "skip" status)
- [x] FR-JR-084: Teardown steps execute in `afterAll` hook, always run regardless of setup/main failure
- [x] FR-JR-085: Variables persist across setup → main → teardown phases
- [x] FR-JR-086: Report generator renders setup/teardown steps in dedicated sections
- [x] FR-JR-087: Tool whitelist validation covers setup, steps, and teardown arrays

### 5.8 Tool Catalog

- [x] FR-JR-088: Tool catalog (toolCatalog.ts) provides metadata for every tool: name, description, tags, use-cases
- [x] FR-JR-089: Lifecycle tools (create-file, delete-file, open-file, close-leaves) are tagged `["lifecycle"]`
- [x] FR-JR-090: Activity Log is opened (best-effort) after every E2E run

### 5.9 Integration

- [x] FR-JR-060: Thin test wrapper is <25 LOC (load JSON + call executeJourney)
- [x] FR-JR-061: Report pipeline generates journey reports from declarative configs unchanged
- [x] FR-JR-062: Journey canvases include full step context cards from JSON config
- [x] FR-JR-063: Event trace files capture all events emitted during journey execution

---

## 6. Data Model Impact

No new persistent entities. Journey configs are JSON files consumed at test time:

```
JourneyDefinition
  journey: string              — Journey name (e.g., "Canvas Session")
  chapter: number              — Chapter number for test ordering
  description?: string         — Human-readable journey description
  testSource?: string          — Relative path to .test.ts file
  reportPath?: string          — Vault-relative path for report output
  canvasPath?: string          — Vault-relative path for canvas output
  tools: ToolName[]            — Whitelist of tools used in this journey
  setup?: StepDefinition[]     — Steps run before journey (failures block main steps)
  steps: StepDefinition[]      — Ordered main journey steps
  teardown?: StepDefinition[]  — Steps run after journey (always execute)

StepDefinition
  id: string               — Unique step identifier, used as screenshot filename prefix
  title: string            — Human-readable step title
  guideSection: number     — Section number for report generation
  description?: string     — What this step validates
  expectedInput?: string   — Preconditions
  expectedOutput?: string  — Postconditions
  uiContext?: { view?, viewName?, tab?, tabName?, components? }
  events?: string[]        — Events relevant to this step (report metadata)
  commands?: string[]      — Commands relevant to this step (report metadata)
  interactions?: string[]  — User interactions (report metadata)
  queries?: string[]       — Data queries (report metadata)
  actions: ActionDefinition[]

ActionDefinition (discriminated union on `tool` field)
  17 variants:
    General:    command, click, input, highlight, wait, screenshot, navigate,
                assert, emit, eval, manual, notice, theme
    Lifecycle:  create-file, delete-file, open-file, close-leaves

JourneyStep (runtime)
  phase?: "setup" | "journey" | "teardown"  — Execution phase (set by executor)
  ... (all StepDefinition fields)
```

Runtime-only data:

```
Variables map (Record<string, string>)
  Shared across all phases (setup → steps → teardown)
  Built-in: PLUGIN_ID = "flowti-ibde"
  User-defined: populated by eval.store and create-file.store actions
```

---

## 7. Event Impact

### Produced (by test actions)

Events emitted via the `emit` tool during test execution:

- `session.pause` — payload: `{ sessionId }`
- `session.resume` — payload: `{ sessionId }`
- `session.complete` — payload: `{ sessionId }`
- `hub.navigate` — payload: `{ hub, viewType, tab }`

### Consumed (by assertions)

Events checked via `assert.event` during test execution:

- `canvas.session.started`
- `session.paused`
- `session.resumed`
- `session.closure.started`
- `session.completed`
- `hub.tab.changed`

### Infrastructure events (not journey-specific)

The event trace system (fixtures.ts) captures all EventBus events during E2E execution, excluding `log.*` and `perf.*` to avoid infinite recursion. These traces are persisted as markdown tables in both vaults.

---

## 8. UI Layout Impact

No UI changes to the Obsidian plugin. This feature affects developer tooling only:

- **Journey JSON files** stored in `tests/e2e/journeys/`
- **Report output** follows existing patterns (journey reports, canvases, configs in vault)
- **Screenshots** captured per-step with highlight annotations

---

## 9. Adapter Impact

No new domain adapters. The feature introduces four helper modules:

```
journeyTypes.ts (287 LOC) — Pure type definitions
  JourneyDefinition (with setup/teardown), StepDefinition,
  ActionDefinition (17-variant union), ToolName, EvalExpectation,
  Lifecycle actions: CreateFileAction, DeleteFileAction, OpenFileAction, CloseLeavesAction

actionRunner.ts (430 LOC) — Tool dispatcher
  executeAction(cli, action, variables, traceBookmark, collector?)
  resolve(template, variables), resolvePayload(payload, variables)
  ScreenshotCollector (explicit screenshot accumulation)
  17 per-tool functions including lifecycle tools

journeyExecutor.ts (245 LOC) — Vitest test generator
  executeJourney(definition) — setup/teardown lifecycle orchestration
  validateTools(definition) — checks all phases
  runStepWithActions() — shared step execution for all phases

toolCatalog.ts (80 LOC) — Tool registry with metadata
  ToolMeta { name, description, tags, useCases }
  TOOL_CATALOG — Record<ToolName, ToolMeta> with all 17 tools
```

These modules depend on existing helpers (fixtures, highlight, navigation) and the ObsidianCli wrapper.

---

## 10. Non-Functional Requirements

- **Backward compatibility**: Existing imperative journey tests (Chapters 1–4) continue to work unchanged
- **Serial execution**: Steps within a journey execute sequentially (vitest `fileParallelism: false`)
- **Fail-fast**: First step failure fails the entire journey (vitest `bail: 1`)
- **Timeout**: 30s per step, 60s for setup/teardown hooks
- **Retry**: One automatic retry on step failure
- **Determinism**: Steps execute in JSON-defined order; variable map is initialized fresh per journey
- **No vault-wide scans**: Actions operate on specific selectors/commands, never scan the full vault
- **Report compatibility**: Journey reports, canvases, and configs generated identically whether the test is imperative or declarative
- **Validation**: Executor validates tool whitelist at test registration time (before any step runs)
- **Error context**: On step failure, errorContext.ts captures DOM snapshot, recent events, and plugin state

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| JSON configs grow unwieldy for complex journeys | Keep journeys focused (5–15 steps). Use eval tool as escape hatch for complex logic |
| Selector changes break multiple steps | Selectors are co-located in the JSON config — one file to update per journey |
| Variable interpolation errors are hard to debug | `resolve()` throws with variable name and available keys on missing reference |
| Eval code in JSON lacks IDE support | Keep eval snippets short. Complex logic belongs in the plugin, not the test |
| Capture timing race conditions | `afterAction` takes screenshot immediately; `afterSettle` waits 1000ms. Both are deterministic |
| Tool whitelist becomes stale | Executor validates at registration — undeclared tools cause immediate failure |

---

## 12. Acceptance Criteria

- [x] Canvas Session journey (9 steps) runs entirely from JSON config
- [x] Thin test wrapper is <25 LOC
- [x] All 17 tools dispatch correctly: command, click, input, highlight, wait, screenshot, navigate, assert, emit, eval, manual, notice, theme, create-file, delete-file, open-file, close-leaves
- [x] Variable interpolation works across steps (sessionId stored in step 6, used in steps 7–8)
- [x] Eval expectations validate: equals, truthy, json matching
- [x] Assert sub-types work: visible, not-visible, text, event, leaf, eval
- [x] Report pipeline generates journey reports, canvases, and configs from declarative journey unchanged
- [x] Tool whitelist validation catches undeclared tools before test execution
- [x] Capture timing: `afterAction` captures transient UI (modals), `afterSettle` captures settled state
- [x] `npm test` passes (6,016 unit tests + type check + lint)
- [x] Existing imperative journeys (Chapters 1–4) still work unchanged
- [x] Setup steps run in beforeAll, failures block main steps
- [x] Teardown steps run in afterAll, always execute
- [x] Variables persist across setup → steps → teardown phases
- [x] Lifecycle tools (create-file, delete-file, open-file, close-leaves) tagged in tool catalog
- [x] Reports render Setup/Teardown sections with correct grouping
- [x] Activity Log opens after every E2E run (best-effort)

---

## 13. Definition of Done

- [x] journeyTypes.ts — Type system for JSON schema (287 LOC)
- [x] actionRunner.ts — Tool dispatcher with 17 tools (430 LOC)
- [x] journeyExecutor.ts — Vitest test generator with setup/teardown (245 LOC)
- [x] toolCatalog.ts — Tool registry with metadata, tags, use-cases (80 LOC)
- [x] canvas-session.journey.json — First declarative journey config (236 LOC)
- [x] tool-showcase.journey.json — Tool showcase with setup/teardown and lifecycle tools
- [x] 50-journey-canvas-session.test.ts — Thin wrapper (22 LOC, down from 474 LOC)
- [x] StepOptions with capture timing in journey.ts
- [x] Lazy CSS injection for highlight styles
- [x] Setup/teardown execution flow with lifecycle guarantees
- [x] All existing tests pass (6,016 unit + E2E infrastructure)
- [x] Report pipeline verified compatible (setup/teardown sections, lifecycle stats)

---

## File Inventory

| File | Status | LOC | Purpose |
|------|--------|-----|---------|
| `tests/e2e/helpers/journeyTypes.ts` | Created | 287 | TypeScript types for JSON schema (17 tools, setup/teardown) |
| `tests/e2e/helpers/actionRunner.ts` | Created | 430 | Tool dispatcher (17 tools, lifecycle implementations) |
| `tests/e2e/helpers/journeyExecutor.ts` | Created | 245 | Vitest test generator with setup/teardown orchestration |
| `tests/e2e/helpers/toolCatalog.ts` | Created | 80 | Tool registry with metadata, tags, use-cases |
| `tests/e2e/journeys/canvas-session.journey.json` | Created | 236 | Canvas Session journey config |
| `tests/e2e/journeys/tool-showcase.journey.json` | Created | 340 | Tool showcase with setup/teardown |
| `tests/e2e/50-journey-canvas-session.test.ts` | Rewritten | 22 | Thin wrapper (was 474 LOC) |
| `tests/e2e/helpers/journey.ts` | Modified | 435 | StepOptions + capture timing + phase + setup/teardown |
| `tests/e2e/helpers/highlight.ts` | Modified | 105 | Lazy CSS injection |
| `scripts/generate-e2e-report.mjs` | Modified | 1580 | Setup/teardown rendering, lifecycle stats |
| `scripts/run-e2e.mjs` | Modified | 120 | Activity Log opening |

**Total new code**: ~1,040 LOC across 4 new files + 2 JSON configs
**Total replaced code**: ~450 LOC of imperative test logic
**Net change**: LOC increase reflects richer feature set (setup/teardown, 7 additional tools, tool catalog)

---

## Architecture

```
tests/e2e/
├── journeys/
│   ├── canvas-session.journey.json    ← Declarative config (author this)
│   └── tool-showcase.journey.json     ← Full tool showcase with setup/teardown
├── helpers/
│   ├── journeyTypes.ts                ← TypeScript types for JSON schema (17 tools)
│   ├── journeyExecutor.ts             ← Reads JSON → generates vitest tests (setup/teardown)
│   ├── actionRunner.ts                ← Dispatches actions by tool type (17 tools)
│   ├── toolCatalog.ts                 ← Tool registry with metadata, tags, use-cases
│   ├── journey.ts                     ← JourneyRunner (step lifecycle, screenshots, reports)
│   ├── fixtures.ts                    ← TestFixture, plugin lifecycle, event tracing
│   ├── highlight.ts                   ← Visual element annotation in screenshots
│   ├── navigation.ts                  ← Hub/tab navigation helpers
│   ├── errorContext.ts                ← Diagnostic capture on failure
│   ├── qc.ts                          ← Manual QC checkpoints
│   ├── testVault.ts                   ← Test vault lifecycle
│   └── sequencer.ts                   ← Test file ordering
├── 50-journey-canvas-session.test.ts  ← Thin wrapper (~10 LOC)
└── 60-journey-tool-showcase.test.ts   ← Thin wrapper (~10 LOC)
```

**Data flow**:

```
JSON Config → journeyExecutor → vitest describe/it blocks
                  ↓                    ↓
            beforeAll: setup     it(): main steps     afterAll: teardown
                  ↓                    ↓                    ↓
            actionRunner → ObsidianCli → Obsidian
                  ↓
            JourneyRunner → screenshots + results JSON
                  ↓
            generate-e2e-report.mjs → vault reports (Setup/Steps/Teardown sections)
```

---

## Tool Reference

### command

Executes an Obsidian command via the command palette API.

```json
{ "tool": "command", "id": "flowti:start-canvas-session", "description": "Open template picker" }
```

The `id` is automatically prefixed with the plugin ID (`flowti-ibde:`) if it contains a colon.

**Use cases:** Open a hub view, trigger plugin commands, execute built-in Obsidian commands.

### click

Clicks a DOM element identified by CSS selector.

```json
{ "tool": "click", "selector": ".modal-container .ft-canvas-template-card", "description": "Click first template card" }
```

Throws if the element is not found.

**Use cases:** Dismiss a modal, select a template card, press a button.

### input

Types text into an input field. Focuses the element, clears it, then uses `document.execCommand('insertText')` for framework-compatible input.

```json
{ "tool": "input", "selector": ".modal-container .setting-item input", "value": "E2E canvas session test goal", "description": "Type session goal" }
```

**Use cases:** Fill a form field, enter a search query, type a session goal.

### highlight

Adds a visual CSS annotation to an element for screenshot documentation.

```json
{ "tool": "highlight", "selector": ".modal-container .mod-cta", "style": "button" }
```

Styles:
- `"element"` (default) — green outline (#81c784)
- `"button"` — orange pulse animation (#ffb74d)
- `"input"` — blue glow (#4fc3f7) + focus

**Use cases:** Annotate UI for screenshots, draw attention to active elements, show input focus state.

### wait

Pauses step execution for a specified duration. Use for settling after DOM mutations or async operations.

```json
{ "tool": "wait", "ms": 500 }
```

**Use cases:** Wait for async rendering, allow theme transition to settle, give Obsidian time to index a new file.

### screenshot

Captures a screenshot at the current point in the action sequence. The filename is derived from the step ID and an optional label. Place screenshot actions wherever you want to document state — before an action, after it, or both.

**With label** (recommended for clarity):
```json
{ "tool": "screenshot", "label": "before", "description": "State before action" }
```
Produces: `{stepId}--before.png`

**Without label** (auto-numbered):
```json
{ "tool": "screenshot", "description": "Capture current state" }
```
Produces: `{stepId}--1.png`, `{stepId}--2.png`, etc.

**Before/after pattern** (most common):
```json
[
  { "tool": "screenshot", "label": "before", "description": "Baseline state" },
  { "tool": "command", "id": "flowti:some-command" },
  { "tool": "wait", "ms": 500 },
  { "tool": "screenshot", "label": "after", "description": "Result state" }
]
```

When a step contains explicit screenshot actions, the JourneyRunner skips its automatic screenshot. If a step has no screenshot actions, one automatic screenshot is taken after settling (backward compatible with imperative journeys).

**Use cases:** Document UI state for reports, before/after comparisons, capture error state.

### navigate

Navigates to a specific hub, view type, and tab combination. Uses the navigation helper with proper settle delays.

```json
{ "tool": "navigate", "hub": "event-catalog", "viewType": "event-catalog-view", "tab": "events", "description": "Open Events tab" }
```

**Use cases:** Switch tabs in a hub view, verify tab change events, test cross-hub navigation.

### assert

Validates state. Six sub-types dispatched by `type` field:

**visible** — element exists in DOM:
```json
{ "tool": "assert", "type": "visible", "selector": ".ft-canvas-template-card", "description": "Template card visible" }
```

**not-visible** — element does NOT exist in DOM:
```json
{ "tool": "assert", "type": "not-visible", "selector": ".modal-container", "description": "Modal closed" }
```

**text** — element textContent contains substring:
```json
{ "tool": "assert", "type": "text", "selector": ".title", "contains": "Canvas Session", "description": "Title shows session name" }
```

**event** — event emitted in trace (since step bookmark):
```json
{ "tool": "assert", "type": "event", "event": "canvas.session.started", "description": "Session started" }
```

**leaf** — workspace has leaf of view type:
```json
{ "tool": "assert", "type": "leaf", "viewType": "canvas", "description": "Canvas leaf exists" }
```

**eval** — JavaScript expression returns expected value:
```json
{ "tool": "assert", "type": "eval", "code": "app.workspace.activeLeaf?.view?.getViewType()", "expected": "canvas", "description": "Active view is canvas" }
```

**Use cases:** Check element visibility, verify event was emitted with payload, confirm leaf exists by view type, evaluate JavaScript expression.

### emit

Emits an event on the plugin's EventBus. Payload values support variable interpolation.

```json
{
  "tool": "emit",
  "event": "session.pause",
  "payload": { "sessionId": "{{sessionId}}" },
  "description": "Emit session.pause event"
}
```

**Use cases:** Trigger domain event handlers, simulate user actions via events, test event-driven workflows.

### eval

Executes arbitrary JavaScript in the Obsidian window context. Supports storing results and checking expectations.

**Store result for later steps:**
```json
{
  "tool": "eval",
  "code": "(() => { const p = app.plugins.plugins['{{PLUGIN_ID}}']; const s = p.sessionService.getActiveSession(); return s ? s.id : ''; })()",
  "store": "sessionId",
  "expect": { "type": "truthy" },
  "description": "Get active session ID"
}
```

**Check JSON structure:**
```json
{
  "tool": "eval",
  "code": "(() => { const p = app.plugins.plugins['{{PLUGIN_ID}}']; const s = p.sessionService.getActiveSession(); return JSON.stringify({ type: s.type, status: s.status }); })()",
  "expect": {
    "type": "json",
    "match": { "type": "canvas-session", "status": "running" }
  },
  "description": "Session is running canvas-session"
}
```

**Expectation types:**
- `equals` — result string must match `value` exactly
- `truthy` — result must be non-empty and not `"false"`, `"undefined"`, or `"null"`
- `json` — result is parsed as JSON; all fields in `match` must be present with matching values

**Use cases:** Query plugin state, store values for cross-step variable passing, perform complex operations not covered by other tools.

### manual

Documents a step that requires human intervention. Skipped silently during automated execution. Use this to mark actions that cannot be automated yet but should be part of the journey specification.

```json
{ "tool": "manual", "instruction": "Drag the canvas node to a new position", "description": "Manual drag interaction" }
```

Manual actions serve as living documentation — they appear in the journey config and reports, making it clear which parts of the journey are not yet automated.

**Use cases:** Visual regression review, verify content correctness, cross-reference screenshots with expected layout.

### notice

Displays an Obsidian Notice toast. Supports `{{variable}}` interpolation in the message. Useful for annotating test progress in screenshots.

```json
{ "tool": "notice", "message": "Step 3/7: Opening User Hub", "duration": 3000, "description": "Progress annotation" }
```

**Fields:**
- `message` — Notice text (supports `{{variable}}` interpolation)
- `duration` — Display duration in ms (default: 5000)

**Use cases:** Annotate test progress, show step status in screenshots, display interpolated variable values.

### theme

Switches Obsidian's CSS theme. Use `"obsidian"` for the default dark theme or `"moonstone"` for the default light theme.

```json
{ "tool": "theme", "theme": "moonstone", "description": "Switch to light theme" }
```

**Use cases:** Dark/light mode comparison screenshots, verify theme-aware styling, set consistent baseline theme.

### create-file `[lifecycle]`

Creates a file in the vault via the Obsidian `app.vault.create()` API. Supports `{{variable}}` interpolation in path and content. Optionally stores the created path in a variable for use in later steps (e.g., for teardown deletion).

```json
{
  "tool": "create-file",
  "path": "03 - Resources/Test Data/demo.md",
  "content": "# Demo\n\nPlugin version: {{pluginVersion}}\n",
  "store": "demoFilePath",
  "description": "Create demo file for testing"
}
```

**Fields:**
- `path` — Vault-relative file path (supports `{{variable}}`)
- `content` — File content (supports `{{variable}}`)
- `store` — Optional variable name to store the created path

**Use cases:** Seed test data files in setup, create markdown/CSV content for journey steps, scaffold vault structure before testing.

### delete-file `[lifecycle]`

Deletes a vault file via the Obsidian API. Supports `{{variable}}` interpolation in path. Silently succeeds if the file doesn't exist.

```json
{ "tool": "delete-file", "path": "{{demoFilePath}}", "description": "Remove demo file" }
```

**Use cases:** Clean up test files in teardown, remove seed data after journey completes, reset vault to pre-test state.

### open-file `[lifecycle]`

Opens a vault file in a new editor tab. Supports `{{variable}}` interpolation in path. Skips files that cannot be natively opened (e.g., non-file abstractions).

```json
{ "tool": "open-file", "path": "{{demoFilePath}}", "description": "Open the created file" }
```

**Use cases:** Open a created file for verification, navigate to a specific vault file, set up editor state before testing.

### close-leaves `[lifecycle]`

Closes all workspace leaves (tabs) of a given view type. Useful for cleaning up hub views or panels between journey sections or in teardown.

```json
{ "tool": "close-leaves", "viewType": "flowti-user-hub", "description": "Close all User Hub tabs" }
```

**Use cases:** Clean up hub views in teardown, reset workspace between journey sections, close modals or panels before next step.

---

## User Manual

### Creating a New Journey

#### Step 1: Create the JSON config

Create a new file in `tests/e2e/journeys/` following the naming convention `<name>.journey.json`:

```json
{
  "journey": "My Feature",
  "chapter": 6,
  "description": "Validates the feature end-to-end.",
  "testSource": "tests/e2e/60-journey-my-feature.test.ts",
  "reportPath": "docs/journeys/My Feature/My Feature.md",
  "canvasPath": "docs/journeys/My Feature/My Feature.canvas",
  "tools": ["command", "click", "wait", "assert", "highlight", "screenshot", "create-file", "delete-file"],
  "setup": [],
  "steps": [],
  "teardown": []
}
```

**Fields:**
- `journey` — Display name, used in report titles and vault folder names
- `chapter` — Numeric chapter, determines test ordering (10, 20, 30...)
- `description` — Human-readable summary of what the journey validates
- `testSource` — Relative path to the thin test wrapper
- `reportPath` — Vault-relative path where the journey report will be written
- `canvasPath` — Vault-relative path where the journey canvas will be written
- `tools` — Whitelist of tools this journey uses. The executor rejects any action using an undeclared tool

#### Step 2: Define steps

Each step represents a logical user action or verification point:

```json
{
  "id": "01-open-feature",
  "title": "Open the feature view",
  "guideSection": 1,
  "description": "Opens the feature via the command palette.",
  "expectedInput": "Plugin enabled, feature available",
  "expectedOutput": "Feature view is visible",
  "uiContext": {
    "components": ["FeatureView"]
  },
  "events": ["feature.opened"],
  "commands": ["flowti:open-feature"],
  "interactions": ["command: Open feature"],
  "actions": [
    { "tool": "screenshot", "label": "before", "description": "Baseline before opening feature" },
    { "tool": "command", "id": "flowti:open-feature", "description": "Open feature" },
    { "tool": "wait", "ms": 500 },
    { "tool": "assert", "type": "visible", "selector": ".ft-feature-view", "description": "Feature view visible" },
    { "tool": "highlight", "selector": ".ft-feature-view", "style": "element" },
    { "tool": "screenshot", "label": "after", "description": "Feature view open and highlighted" }
  ]
}
```

**Step fields:**
- `id` — Unique identifier, used as screenshot filename prefix (e.g., `01-open-feature--before.png`)
- `title` — Human-readable, appears in vitest output and reports
- `guideSection` — Numeric section, used in test naming (`6.1 — Open the feature view`)
- `description` — Explains what this step validates (report metadata)
- `expectedInput` / `expectedOutput` — Pre/postconditions (report metadata)
- `uiContext` — Components involved (report metadata)
- `events`, `commands`, `interactions`, `queries` — Report metadata arrays
- `actions` — Ordered array of tool-dispatched operations (include `screenshot` actions where you want captures)

#### Step 3: Create the test wrapper

Create `tests/e2e/<NN>-journey-<name>.test.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";

const configPath = path.join(__dirname, "journeys", "<name>.journey.json");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

executeJourney(definition);
```

The `<NN>` prefix determines execution order (00=prerequisites, 10=installer, 30+=journeys).

#### Step 4: Add npm script (optional)

In `package.json`, add a preset script:

```json
"test:e2e:my-feature": "npx vitest --config tests/e2e/vitest.e2e.config.ts --run --reporter verbose -- --journey=my-feature"
```

### Setup and Teardown

Journey definitions support optional `setup` and `teardown` step arrays that separate infrastructure work from the actual journey being tested.

**Execution flow:**

```
beforeAll:
  1. Fixture init (plugin, event trace)
  2. Run setup steps → if any fail, set setupFailed flag

it() blocks (main steps):
  - If setupFailed → skip (recorded as "skip" status)
  - Otherwise run normally

afterAll:
  1. Run teardown steps (ALWAYS, even if setup/main failed)
  2. Open Activity Log (best-effort)
  3. Write results, cleanup
```

**Example with lifecycle tools:**

```json
{
  "setup": [
    {
      "id": "setup-create-data",
      "title": "Create test data",
      "guideSection": 1,
      "actions": [
        { "tool": "create-file", "path": "Test Data/demo.md", "content": "# Demo", "store": "demoPath" },
        { "tool": "open-file", "path": "{{demoPath}}" }
      ]
    }
  ],
  "steps": [
    { "id": "01-feature-test", "title": "Test the feature", "guideSection": 1, "actions": [...] }
  ],
  "teardown": [
    {
      "id": "teardown-cleanup",
      "title": "Clean up",
      "guideSection": 1,
      "actions": [
        { "tool": "delete-file", "path": "{{demoPath}}" },
        { "tool": "close-leaves", "viewType": "flowti-user-hub" }
      ]
    }
  ]
}
```

**Guarantees:**
- Setup failures block all main steps (recorded as "skip")
- Teardown always runs, even when setup or main steps fail
- Variables persist across all phases (setup → steps → teardown)
- Reports render setup/teardown in dedicated sections

**Tool tags:** Lifecycle tools (`create-file`, `delete-file`, `open-file`, `close-leaves`) are tagged `[lifecycle]` in the tool catalog, indicating they are primarily intended for setup/teardown operations. They can be used in main steps too, but their primary purpose is test data management.

### Using Variables

Variables let you pass data between steps. The most common pattern is capturing an ID via `eval.store` and using it in subsequent `emit` payloads.

**Storing a variable (step N):**

```json
{
  "tool": "eval",
  "code": "(() => { const p = app.plugins.plugins['{{PLUGIN_ID}}']; return p.myService.getActiveItem()?.id ?? ''; })()",
  "store": "itemId",
  "expect": { "type": "truthy" },
  "description": "Get active item ID"
}
```

**Using a variable (step N+1):**

```json
{
  "tool": "emit",
  "event": "item.update",
  "payload": { "itemId": "{{itemId}}", "status": "completed" },
  "description": "Emit item update"
}
```

**Built-in variables:**
- `{{PLUGIN_ID}}` — always `"flowti-ibde"`, available from step 1

**Rules:**
- Variables persist across all steps in a journey
- Referencing an undefined variable throws immediately with the variable name and available keys
- Variable values are always strings (eval results are coerced to string by ObsidianCli)

### Screenshot Placement

Screenshots are explicit `screenshot` tool actions within the actions array. You control timing by WHERE you place the screenshot:

**Capture transient UI** (modals, hover states) — screenshot immediately after the action:
```json
{ "tool": "command", "id": "flowti:start-canvas-session" },
{ "tool": "wait", "ms": 500 },
{ "tool": "highlight", "selector": ".modal-container .ft-card", "style": "element" },
{ "tool": "screenshot", "label": "modal-open", "description": "Modal visible" }
```

**Capture settled state** — screenshot at the end of the actions array after waits and assertions:
```json
{ "tool": "emit", "event": "session.pause", "payload": { "sessionId": "{{sessionId}}" } },
{ "tool": "wait", "ms": 500 },
{ "tool": "assert", "type": "event", "event": "session.paused" },
{ "tool": "screenshot", "label": "paused", "description": "Session paused" }
```

**Before/after pattern** — two screenshots bracketing the key action:
```json
{ "tool": "screenshot", "label": "before", "description": "Baseline" },
{ "tool": "click", "selector": ".some-button" },
{ "tool": "wait", "ms": 500 },
{ "tool": "screenshot", "label": "after", "description": "Result" }
```

**Naming convention:**
- With label: `{stepId}--{label}.png` (e.g., `01-start--before.png`)
- Without label: `{stepId}--{n}.png` (e.g., `01-start--1.png`, auto-numbered)
- On error: `{stepId}--error.png` (always captured automatically)

**Auto-screenshot fallback:** Steps with no explicit screenshot actions still get one automatic screenshot after settling (backward compatible with imperative journeys).

### Running Journeys

**Full E2E suite:**
```bash
npm run test:e2e
```

**Single journey:**
```bash
npm run test:e2e:canvas-session
```

**Multiple journeys:**
```bash
E2E_JOURNEY=getting-started,canvas-session npm run test:e2e
```

**With QC checkpoints (manual approval at each step):**
```bash
E2E_QC=1 npm run test:e2e:canvas-session
```

**Force installer re-run:**
```bash
E2E_RUN_INSTALLER=true npm run test:e2e
```

### Report Pipeline

After E2E tests complete, generate reports:

```bash
npm run report:e2e
```

This produces:
- **Test vault**: `E2E Report.md` (root summary), per-journey reports with screenshots, event traces
- **Dev vault**: `docs/reports/e2e/E2E Report.md` (stable), `docs/journeys/<name>/` (stable reports + screenshots), `docs/reports/e2e/runs/` (timestamped archives)

Reports include step-by-step results, screenshot embeds, error context (DOM snapshot, recent events, plugin state), and performance statistics.

### Troubleshooting

**"Variable '{{myVar}}' not found"**
The variable was not stored before being referenced. Check that the `eval` action with `"store": "myVar"` runs in an earlier step.

**"Step uses undeclared tool 'xyz'"**
Add the tool to the journey's `tools` array. The executor validates the whitelist before any step runs.

**"Click failed on '.my-selector'"**
The element doesn't exist in the DOM at click time. Add a `wait` action before the click, or check that the previous step's action actually produces the expected UI.

**"Expected element '.modal' to be visible"**
The element may have been removed between actions. Increase the preceding `wait` duration, or check for race conditions in the plugin code.

**"Eval failed: ..."**
The JavaScript code threw an error in the Obsidian window context. Test the expression manually via `ObsidianCli.eval()` first. Common issues: plugin not loaded, service not initialized, property access on null.

**"Expected truthy value, got ''"**
The eval returned an empty string. This usually means the queried data doesn't exist yet. Add a `wait` before the eval, or verify the preceding action completed successfully.

**Screenshots show wrong state**
Place the `screenshot` action immediately after the UI you want to capture. For transient UI (modals, overlays), screenshot before any `wait` that might let the UI disappear. For settled state, screenshot at the end of the actions array after assertions.

### Gotchas

- **Hub leaves persist**: Close a hub before reopening it to avoid stale tab state across journeys
- **Fire-and-forget events**: `hub.tab.changed` and similar events need 250–500ms waits before assertions
- **Eval returns strings**: ObsidianCli coerces all eval results to strings. Use `JSON.stringify()` and `expect.type: "json"` for structured data
- **Command prefixing**: The `command` tool auto-prefixes `flowti-ibde:` if the command ID contains a colon. Bare command IDs (e.g., `"editor:focus-left"`) are used as-is
- **Input via execCommand**: The `input` tool uses `document.execCommand('insertText')` which triggers framework-compatible input events. Direct `.value =` assignment does not
- **Event trace filtering**: The trace skips `log.*` and `perf.*` events to prevent recursion. These events cannot be asserted via `assert.event`

### Example: Complete Journey Config

See `tests/e2e/journeys/canvas-session.journey.json` for a production example with 9 steps covering:
- Command execution (template picker)
- DOM interaction (click, input)
- State verification (eval + json matching)
- Event-driven lifecycle (emit → assert event → eval status)
- Variable interpolation (sessionId across 4 steps)
- Capture timing (afterAction for modals)

See `tests/e2e/journeys/tool-showcase.journey.json` for a comprehensive example using:
- All 17 tools including lifecycle tools
- Setup/teardown phases with `create-file`, `delete-file`, `open-file`, `close-leaves`
- Cross-phase variable passing (setup → steps → teardown)
- Theme switching with before/after screenshots
- All 6 assertion types
- All 3 highlight styles
