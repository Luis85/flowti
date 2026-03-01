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
- Action runner dispatching 10 tools: command, click, input, highlight, wait, assert, emit, navigate, eval, screenshot
- Journey executor generating vitest describe/it blocks from JSON
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
- [x] FR-JR-008: Each step has optional `capture` timing (`afterSettle` or `afterAction`)

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

### 5.7 Integration

- [x] FR-JR-060: Thin test wrapper is <25 LOC (load JSON + call executeJourney)
- [x] FR-JR-061: Report pipeline generates journey reports from declarative configs unchanged
- [x] FR-JR-062: Journey canvases include full step context cards from JSON config
- [x] FR-JR-063: Event trace files capture all events emitted during journey execution

---

## 6. Data Model Impact

No new persistent entities. Journey configs are JSON files consumed at test time:

```
JourneyDefinition
  journey: string          — Journey name (e.g., "Canvas Session")
  chapter: number          — Chapter number for test ordering
  description?: string     — Human-readable journey description
  testSource?: string      — Relative path to .test.ts file
  reportPath?: string      — Vault-relative path for report output
  canvasPath?: string      — Vault-relative path for canvas output
  tools: ToolName[]        — Whitelist of tools used in this journey
  steps: StepDefinition[]  — Ordered steps

StepDefinition
  id: string               — Unique step identifier (e.g., "01-start-canvas-session")
  title: string            — Human-readable step title
  guideSection: number     — Section number for report generation
  description?: string     — What this step validates
  expectedInput?: string   — Preconditions
  expectedOutput?: string  — Postconditions
  capture?: "afterSettle" | "afterAction"
  uiContext?: { view?, viewName?, tab?, tabName?, components? }
  events?: string[]        — Events relevant to this step (report metadata)
  commands?: string[]      — Commands relevant to this step (report metadata)
  interactions?: string[]  — User interactions (report metadata)
  queries?: string[]       — Data queries (report metadata)
  actions: ActionDefinition[]

ActionDefinition (discriminated union on `tool` field)
  10 variants: command, click, input, highlight, wait, screenshot,
               navigate, assert, emit, eval
```

Runtime-only data:

```
Variables map (Record<string, string>)
  Shared across all steps in a journey
  Built-in: PLUGIN_ID = "flowti-ibde"
  User-defined: populated by eval.store actions
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

No new domain adapters. The feature introduces three new helper modules:

```
journeyTypes.ts (170 LOC) — Pure type definitions
  JourneyDefinition, StepDefinition, ActionDefinition (union),
  AssertAction, EmitAction, EvalAction, EvalExpectation, ToolName

actionRunner.ts (210 LOC) — Tool dispatcher
  executeAction(cli, action, variables, traceBookmark, screenshotPath?)
  resolve(template, variables), resolvePayload(payload, variables)
  Per-tool functions: executeCommand, executeClick, executeInput,
    executeHighlight, executeAssert, executeEmit, executeEval

journeyExecutor.ts (110 LOC) — Vitest test generator
  executeJourney(definition)
  validateTools(definition), toJourneyStep(step)
```

These modules depend on existing helpers (fixtures, highlight, navigation) and the ObsidianCli wrapper. No changes to existing modules were required.

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
- [x] All 10 tools dispatch correctly: command, click, input, highlight, wait, screenshot, navigate, assert, emit, eval
- [x] Variable interpolation works across steps (sessionId stored in step 6, used in steps 7–8)
- [x] Eval expectations validate: equals, truthy, json matching
- [x] Assert sub-types work: visible, not-visible, text, event, leaf, eval
- [x] Report pipeline generates journey reports, canvases, and configs from declarative journey unchanged
- [x] Tool whitelist validation catches undeclared tools before test execution
- [x] Capture timing: `afterAction` captures transient UI (modals), `afterSettle` captures settled state
- [x] `npm test` passes (6,016 unit tests + type check + lint)
- [x] Existing imperative journeys (Chapters 1–4) still work unchanged

---

## 13. Definition of Done

- [x] journeyTypes.ts — Type system for JSON schema (170 LOC)
- [x] actionRunner.ts — Tool dispatcher with 10 tools (210 LOC)
- [x] journeyExecutor.ts — Vitest test generator (110 LOC)
- [x] canvas-session.journey.json — First declarative journey config (236 LOC)
- [x] 50-journey-canvas-session.test.ts — Thin wrapper (22 LOC, down from 474 LOC)
- [x] StepOptions with capture timing in journey.ts
- [x] Lazy CSS injection for highlight styles
- [x] All existing tests pass (6,016 unit + E2E infrastructure)
- [x] Report pipeline verified compatible

---

## File Inventory

| File | Status | LOC | Purpose |
|------|--------|-----|---------|
| `tests/e2e/helpers/journeyTypes.ts` | Created | 170 | TypeScript types for JSON schema |
| `tests/e2e/helpers/actionRunner.ts` | Created | 210 | Tool dispatcher (10 tools) |
| `tests/e2e/helpers/journeyExecutor.ts` | Created | 110 | Vitest test generator |
| `tests/e2e/journeys/canvas-session.journey.json` | Created | 236 | Canvas Session journey config |
| `tests/e2e/50-journey-canvas-session.test.ts` | Rewritten | 22 | Thin wrapper (was 474 LOC) |
| `tests/e2e/helpers/journey.ts` | Modified | 380 | StepOptions + capture timing |
| `tests/e2e/helpers/highlight.ts` | Modified | 105 | Lazy CSS injection |

**Total new code**: ~490 LOC across 3 new files + 1 JSON config
**Total replaced code**: ~450 LOC of imperative test logic
**Net change**: Slight LOC increase, but imperative → declarative migration

---

## Architecture

```
tests/e2e/
├── journeys/
│   └── canvas-session.journey.json    ← Declarative config (author this)
├── helpers/
│   ├── journeyTypes.ts                ← TypeScript types for JSON schema
│   ├── journeyExecutor.ts             ← Reads JSON → generates vitest tests
│   ├── actionRunner.ts                ← Dispatches actions by tool type
│   ├── journey.ts                     ← JourneyRunner (step lifecycle, screenshots, reports)
│   ├── fixtures.ts                    ← TestFixture, plugin lifecycle, event tracing
│   ├── highlight.ts                   ← Visual element annotation in screenshots
│   ├── navigation.ts                  ← Hub/tab navigation helpers
│   ├── errorContext.ts                ← Diagnostic capture on failure
│   ├── qc.ts                          ← Manual QC checkpoints
│   ├── testVault.ts                   ← Test vault lifecycle
│   └── sequencer.ts                   ← Test file ordering
└── 50-journey-canvas-session.test.ts  ← Thin wrapper (~10 LOC)
```

**Data flow**:

```
JSON Config → journeyExecutor → vitest describe/it blocks
                                    ↓
                              actionRunner → ObsidianCli → Obsidian
                                    ↓
                              JourneyRunner → screenshots + results JSON
                                    ↓
                              generate-e2e-report.mjs → vault reports
```

---

## Tool Reference

### command

Executes an Obsidian command via the command palette API.

```json
{ "tool": "command", "id": "flowti:start-canvas-session", "description": "Open template picker" }
```

The `id` is automatically prefixed with the plugin ID (`flowti-ibde:`) if it contains a colon.

### click

Clicks a DOM element identified by CSS selector.

```json
{ "tool": "click", "selector": ".modal-container .ft-canvas-template-card", "description": "Click first template card" }
```

Throws if the element is not found.

### input

Types text into an input field. Focuses the element, clears it, then uses `document.execCommand('insertText')` for framework-compatible input.

```json
{ "tool": "input", "selector": ".modal-container .setting-item input", "value": "E2E canvas session test goal", "description": "Type session goal" }
```

### highlight

Adds a visual CSS annotation to an element for screenshot documentation.

```json
{ "tool": "highlight", "selector": ".modal-container .mod-cta", "style": "button" }
```

Styles:
- `"element"` (default) — green outline (#81c784)
- `"button"` — orange pulse animation (#ffb74d)
- `"input"` — blue glow (#4fc3f7) + focus

### wait

Pauses step execution for a specified duration. Use for settling after DOM mutations or async operations.

```json
{ "tool": "wait", "ms": 500 }
```

### screenshot

Captures a screenshot to the step's output path. Rarely needed — JourneyRunner captures screenshots automatically per step.

```json
{ "tool": "screenshot", "description": "Manual capture point" }
```

### navigate

Navigates to a specific hub, view type, and tab combination. Uses the navigation helper with proper settle delays.

```json
{ "tool": "navigate", "hub": "event-catalog", "viewType": "event-catalog-view", "tab": "events", "description": "Open Events tab" }
```

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
  "reportPath": "03 - Resources/Tested Journeys/My Feature/My Feature.md",
  "canvasPath": "03 - Resources/Tested Journeys/My Feature/My Feature.canvas",
  "tools": ["command", "click", "wait", "assert", "highlight"],
  "steps": []
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
    { "tool": "command", "id": "flowti:open-feature", "description": "Open feature" },
    { "tool": "wait", "ms": 500 },
    { "tool": "assert", "type": "visible", "selector": ".ft-feature-view", "description": "Feature view visible" },
    { "tool": "highlight", "selector": ".ft-feature-view", "style": "element" }
  ]
}
```

**Step fields:**
- `id` — Unique identifier, used in screenshot filenames (e.g., `01-open-feature.png`)
- `title` — Human-readable, appears in vitest output and reports
- `guideSection` — Numeric section, used in test naming (`6.1 — Open the feature view`)
- `description` — Explains what this step validates (report metadata)
- `expectedInput` / `expectedOutput` — Pre/postconditions (report metadata)
- `capture` — Screenshot timing: `"afterSettle"` (default, 1000ms after action) or `"afterAction"` (immediately after action, before settle). Use `"afterAction"` for transient UI like modals
- `uiContext` — Components involved (report metadata)
- `events`, `commands`, `interactions`, `queries` — Report metadata arrays
- `actions` — Ordered array of tool-dispatched operations

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

### Capture Timing

By default, screenshots are taken **after settling** (1000ms pause + notice dismissal). For transient UI like modals or tooltips that close before settle completes, use `"afterAction"`:

```json
{
  "id": "02-select-template",
  "title": "Select a canvas template",
  "capture": "afterAction",
  "actions": [...]
}
```

| Timing | Screenshot order | Use case |
|--------|-----------------|----------|
| `afterSettle` (default) | action → 1000ms settle → dismiss notices → post notice → screenshot | Stable UI (hub tabs, canvas, detail panels) |
| `afterAction` | action → screenshot → 1000ms settle → dismiss notices → post notice | Transient UI (modals, tooltips, loading states) |

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
Check the `capture` timing. Transient UI (modals, overlays) requires `"capture": "afterAction"`. If the UI disappears during the 1000ms settle, it won't be in the `"afterSettle"` screenshot.

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
