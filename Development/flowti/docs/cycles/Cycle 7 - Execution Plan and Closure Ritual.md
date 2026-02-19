---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: in-progress
cycle: 7
date_planned: 2026-02-19
date_completed:
pbis:
  - "[[PBI-SW-012 Execution Plan]]"
  - "[[PBI-SW-014 Closure Ritual System]]"
  - "[[PBI-SW-016 Cognitive Overload Detection]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 4
actual_increments:
estimated_tests: 80
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 7: Execution Plan, Closure Ritual & Cognitive Overload Detection

## Situation Assessment

### Pre-Cycle State (2026-02-19)

**Plugin health:**
- 2,540 tests passing (32 skipped), 102 test suites
- Clean working tree, all builds green
- `npm test` pipeline: tsc + eslint + vitest
- Session domain: ~1,300 LOC SessionService, ~660 LOC helpers

**Session Workspaces feature:**
- PRD v8, FRI 26/35, stage: in-progress
- v1 scope: 8/8 FRs delivered, 7/8 v1 PBIs valid (PBI-SW-007 removed)
- v2 scope: 10 FRs defined (FR-09–FR-18), 8 PBIs defined (SW-010–SW-017)
- PBI-SW-010 (Lifecycle v2 & Intent Layer): **Done** (Cycle 6) — state machine, intent, energy handlers, 14 events, backward compat
- ADR-031: Session v2 Architecture — accepted
- 82 total session events (68 v1 + 14 v2)
- v2 domain types defined: `SessionStatusV2`, `SessionIntent`, `SessionMode`, `EnergyLevel`, `ExecutionTask`, `ReflectionEntry`, `ClosureResponse`, `ClosureTemplate`, `ClosureQuestion`, `CognitiveLoadThresholds`
- State machine: 6 states, `isValidTransition()` pure function, `VALID_TRANSITIONS` map
- `"active"` → `"running"` canonical status. `"reviewing"` passthrough (placeholder until FR-14).

**Inbox hygiene (completed pre-cycle):**
- Vault inbox: 41 items — 14 items enriched with missing frontmatter (type, stage, domain, priority)
- Plugin inbox: 65 items — 5 items enriched, 3 DX bugs marked `fixed` with `fixed_in: Cycle 6`, priority normalization applied
- Both inboxes fully normalized to standard frontmatter schema

**Cycle 6 improvement backlog (carried forward):**
- TD-092: SessionService at ~1,300 LOC — approaching extraction threshold
- TD-093: Fire-and-forget `void` pattern masks async ordering issues
- TD-094: `"active"` status still in union type — cleanup deferred

---

## Cycle Goals

1. **PBI-SW-012: Execution Plan** — checklist-based task list within sessions with progress tracking (FR-12)
2. **PBI-SW-014: Closure Ritual System** — configurable review overlay required before session completion (FR-14)
3. **PBI-SW-016: Cognitive Overload Detection** — threshold-based warnings for task/binding/duration overload (FR-16, spike)

**Delivery philosophy:** Domain-first for Inc 1 (types + service), then UI in Inc 2. Closure Ritual as full vertical slice in Inc 3 (domain + UI). Cognitive Overload as domain spike in Inc 4.

**Explicitly deferred to Cycle 8+:**
- TD-05 main.ts extraction
- TD-092 SessionService extraction (evaluate after Cycle 7 LOC impact)
- PBI-SW-009 (Domain Design Session) — depends on Workshop mode (FR-18)
- PBI-SW-013 (Structured Reflection) — depends on SW-012 patterns
- PBI-SW-011 (Energy Tracking UI) — domain delivered in Cycle 6, UI deferred
- PBI-SW-015 (Activity Intelligence) — analytics layer
- PBI-SW-017 (Main/Sidebar Separation) — rendering architecture
- Feature Lifecycle PRD — stays approved, no planning yet

---

## Proposed Increments

### Inc 1: Execution Plan — Domain Layer (PBI-SW-012 Part 1)

**Goal:** Implement execution task CRUD in SessionService with events and persistence.

**Scope:**
- `SessionService.addTask(sessionId, label): ExecutionTask` — creates task with auto-incremented `order`
- `SessionService.toggleTask(sessionId, taskId): void` — toggles `completed`, sets/clears `completedAt`
- `SessionService.removeTask(sessionId, taskId): void` — removes task from `executionTasks`
- `SessionService.reorderTasks(sessionId, taskIds: string[]): void` — reorder by new ID sequence
- Max recommended tasks: 5 (configurable via `CognitiveLoadThresholds.maxTasks`, enforced as warning not hard limit)
- Events wired: `session.task.added`, `session.task.completed`, `session.task.removed`, `session.task.reordered`
- Backward compat: `executionTasks ??= []` in `load()` (already handled by Cycle 6)
- Thread `executionTasks` through `rerunSession()` and `createFromTemplate()`
- Pure helpers: `getTaskProgress(tasks): { completed: number, total: number, percent: number }`
- Tests: task CRUD, ordering, toggle idempotency, max tasks warning, event assertions, template threading

**Est.:** ~120 LOC source, ~100 LOC tests, ~25 tests

**Acceptance criteria:**
- [x] `addTask(sessionId, label)` creates `ExecutionTask` with generated ID, `order`, `completed: false`
- [x] `toggleTask(sessionId, taskId)` toggles `completed` and sets/clears `completedAt` timestamp
- [x] `removeTask(sessionId, taskId)` removes task and re-indexes `order` values
- [x] `reorderTasks(sessionId, taskIds)` validates all IDs exist and updates `order`
- [x] Events emitted: `session.task.added`, `session.task.completed`, `session.task.removed`, `session.task.reordered`
- [x] State guards: task operations only allowed in `prepared`, `running`, `paused` states
- [x] `getTaskProgress(tasks)` pure helper returns `{ completed, total, percent }`
- [x] `executionTasks` threaded through `rerunSession()` and `createFromTemplate()`
- [x] `npm test` passes (2,576 tests, 103 suites)

**Actual:** ~120 LOC source, ~500 LOC tests, 36 tests

**Deviation:** Added 4 command events (`session.task.add/toggle/remove/reorder`) separate from the 4 state events. Original plan had state events serving dual purpose, but this caused infinite listener loops. Fixed by following the established `session.goal.add` → `session.goal.added` command/state pattern. Also threaded tasks through `saveTemplateFromSession()` and added `tasks?: string[]` to `SessionTemplate` type (both unplanned but natural extensions of the threading requirement).

**Architecture seams:** Public methods on `SessionService` (not private handlers). Pure helper in `src/domain/session/helpers.ts`. Events registered in catalog. Types already exist from Cycle 6.

---

### Inc 2: Execution Plan — UI Layer (PBI-SW-012 Part 2)

**Goal:** Add execution plan panel to SessionWorkspaceView with task checklist and progress indicator.

**Scope:**
- `SessionExecutionPanel` component (`src/ui/session/SessionExecutionPanel.ts`):
  - Task list with checkboxes (toggle via `session.task.completed` event)
  - "Add task" input field at bottom
  - "Remove" button per task (×)
  - Progress bar: `completedTasks / totalTasks` with percentage
  - Drag-and-drop reorder (or up/down arrow buttons as simpler alternative)
- Integration into `SessionWorkspaceView`:
  - Panel rendered between goals and decisions sections
  - Subscribe to `session.task.added`, `session.task.completed`, `session.task.removed`, `session.task.reordered` for re-render
  - Hidden when session has no tasks and is in `completed`/`archived` state
- `SessionWorkspaceSubscriptions.ts`: add 4 new listeners for task events
- Tests: panel rendering, task add/toggle/remove, progress calculation, state-based visibility

**Est.:** ~180 LOC source, ~80 LOC tests, ~20 tests

**Acceptance criteria:**
- [ ] `SessionExecutionPanel` renders task checklist with checkboxes, add input, remove buttons
- [ ] Progress bar shows `completedTasks / totalTasks` with visual fill
- [ ] Tasks can be added via input field + enter/button
- [ ] Tasks can be toggled via checkbox
- [ ] Tasks can be removed via × button
- [ ] Task reorder implemented (drag-and-drop or up/down arrows)
- [ ] Panel integrates into `SessionWorkspaceView` between goals and decisions
- [ ] 4 new event subscriptions added to `SessionWorkspaceSubscriptions.ts`
- [ ] Panel hidden for completed/archived sessions with no tasks
- [ ] `npm test` passes

**Architecture seams:** Component follows shared pattern (`constructor(el, deps)`, `render()`). Event subscriptions via `SessionWorkspaceSubscriptions`. DOM within `SessionWorkspaceView` layout.

---

### Inc 3: Closure Ritual — Domain + UI (PBI-SW-014)

**Goal:** Implement closure ritual system — configurable review overlay triggered on session completion.

**Scope:**

**Domain layer:**
- `SessionService.startClosure(sessionId): void` — transitions to `reviewing`, emits `session.closure.started`
- `SessionService.completeClosure(sessionId, response: ClosureResponse): void` — saves response, transitions to `completed`
- `finishReview()` existing method gated: requires `closureResponse` to be non-null before completing
- Default `ClosureTemplate` with 4 standard questions:
  1. "Did you achieve your intended outcome?" (select: yes/partial/no)
  2. "What worked well?" (text)
  3. "What didn't work?" (text)
  4. "What's the next action?" (text)
- 3-tier template inheritance: Global defaults → Session Type override → Instance override
- `resolveClosureTemplate(session, settings): ClosureTemplate` pure helper
- Settings: `defaultClosureTemplate` in SettingsService, `closureTemplate` per session type config
- Events: `session.closure.started`, `session.closure.completed`
- Backward compat: `closureResponse ??= null` in `load()` (already handled)

**UI layer:**
- `SessionClosureOverlay` component (`src/ui/session/SessionClosureOverlay.ts`):
  - Full-view overlay replacing workspace content when `reviewing` state
  - Renders closure questions from resolved template
  - Submit button validates required fields
  - Cancel/Skip option (configurable — default: skip allowed)
- Integration: `SessionWorkspaceView` shows overlay when `session.status === "reviewing"`
- Follow-up actions on completion: "Create follow-up session" button

**Est.:** ~250 LOC source, ~120 LOC tests, ~25 tests

**Acceptance criteria:**
- [ ] `startClosure(sessionId)` transitions to `reviewing` and emits `session.closure.started`
- [ ] `completeClosure(sessionId, response)` saves `ClosureResponse` and transitions to `completed`
- [ ] `finishReview()` requires non-null `closureResponse` before completing (replaces passthrough)
- [ ] Default `ClosureTemplate` with 4 standard questions defined
- [ ] `resolveClosureTemplate(session, settings)` implements 3-tier inheritance
- [ ] Settings: `defaultClosureTemplate` configurable globally and per session type
- [ ] `SessionClosureOverlay` renders as full-view overlay in `reviewing` state
- [ ] Overlay renders dynamic questions from resolved template
- [ ] Submit validates required fields
- [ ] Skip option available (configurable)
- [ ] "Create follow-up session" action available after closure
- [ ] Events: `session.closure.started`, `session.closure.completed`
- [ ] `npm test` passes

**Architecture seams:** Domain handlers in SessionService. Pure helpers in `helpers.ts`. Overlay component follows shared pattern. Template resolution is pure function. Settings extend existing Zod schema.

---

### Inc 4: Cognitive Overload Detection — Spike (PBI-SW-016)

**Goal:** Implement threshold-based overload detection with non-blocking warnings.

**Scope:**
- `detectCognitiveOverload(session, thresholds): OverloadWarning | null` pure function
- Threshold checks:
  - `executionTasks.length > maxTasks` (default: 5)
  - `contextBindings.length > maxBindings` (default: 8)
  - Active session duration > `maxDurationMinutes` (default: 120)
  - `energy <= lowEnergyThreshold` AND tasks > 3 (compound check)
- `OverloadWarning`: `{ reasons: string[], suggestion: string }`
- Trigger: checked on `session.task.added`, `session.context.bound`, timer tick, `session.energy.changed`
- Event: `session.overload.detected` emitted when threshold crossed (debounced — max once per 5 min)
- UI: `CognitiveLoadAlert` component — dismissible warning banner rendered between ExecutionCard and ContextCard
- Settings: `CognitiveLoadThresholds` configurable in SettingsService (types already exist)
- Tests: each threshold individually, compound check, debounce behavior, dismissal

**Est.:** ~100 LOC source, ~60 LOC tests, ~10 tests

**Acceptance criteria:**
- [ ] `detectCognitiveOverload(session, thresholds)` pure function returns `OverloadWarning | null`
- [ ] Checks: task count, binding count, duration, low energy + high tasks
- [ ] `OverloadWarning` includes `reasons[]` and `suggestion` text
- [ ] Detection triggered on task add, context bind, timer tick, energy change
- [ ] `session.overload.detected` event emitted (debounced — max once per 5 minutes)
- [ ] `CognitiveLoadAlert` renders dismissible warning banner in workspace
- [ ] `CognitiveLoadThresholds` configurable in settings
- [ ] `npm test` passes

**Architecture seams:** Pure detection function in `helpers.ts`. Event wiring in SessionService. UI component in `src/ui/session/`. Settings extend existing schema.

---

## Dependency Graph

```
Inc 1: Execution Plan — Domain (independent, foundation for Inc 2 + Inc 4)

Inc 2: Execution Plan — UI (depends on Inc 1 — needs task events + service methods)

Inc 3: Closure Ritual — Domain + UI (depends on Inc 1 conceptually — reviewing gate; can start in parallel with Inc 2)

Inc 4: Cognitive Overload — Spike (depends on Inc 1 — uses task count; depends on Inc 3 conceptually — uses reviewing awareness)
```

**Recommended execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4. Domain foundation first, then UI, then closure ritual (replaces reviewing passthrough), then overload detection (uses data from Inc 1 + Inc 3).

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SessionService exceeds 1,300 LOC threshold (TD-092) | Medium | Inc 1 adds ~80 LOC to service. If threshold breached, extract `SessionTaskHandlers.ts` or `SessionClosureHandlers.ts` as separate modules. |
| Closure ritual gate breaks fire-and-forget pattern | Medium | `startClosure()` is synchronous state mutation. `completeClosure()` is separate call. No multi-await chain in single handler. |
| Drag-and-drop reorder complexity in Obsidian | Low | Fallback: up/down arrow buttons instead of native DnD. Simpler, more accessible, less fragile. |
| Cognitive overload thresholds need tuning | Low | Spike character — defaults chosen conservatively. Configurable via settings. Real usage will inform tuning. |
| 3-tier closure template inheritance complexity | Medium | Pure function `resolveClosureTemplate()` with clear precedence. Test each tier independently. |
| Backward compat: existing sessions without `closureResponse` | Low | Already handled: `closureResponse ??= null` in `load()` from Cycle 6 initialization. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tests added | ~80 new |
| Tests total | ~2,620+ |
| LOC added (source) | ~650 new |
| PBIs progressed | PBI-SW-012 (Done), PBI-SW-014 (Done), PBI-SW-016 (Done — spike) |
| PRD FRI | 26/35 → 28+/35 |
| v2 FRs delivered | FR-12, FR-14, FR-16 (3 of 10 v2 FRs) |
| New events wired | ~6 (4 task + 2 closure — already registered in catalog) |
| New UI components | 3 (SessionExecutionPanel, SessionClosureOverlay, CognitiveLoadAlert) |
| Reviewing gate | Passthrough replaced with real closure ritual |
| Backward compat | Zero regression on existing tests |

---

## Related

- PRD: [[Session Workspaces PRD]] (v8, FRI 26/35)
- PBIs: [[PBI-SW-012 Execution Plan]], [[PBI-SW-014 Closure Ritual System]], [[PBI-SW-016 Cognitive Overload Detection]]
- ADR: [[ADR-031 Session v2 Architecture]] (lifecycle, closure, dual rendering decisions)
- Flows: [[Run Intentional Session]] (execution plan + closure ritual user journey)
- Deferred: [[PBI-SW-013 Structured Reflection]], [[PBI-SW-011 Energy Tracking]], [[PBI-SW-017 Main-Sidebar Separation]]
- Tech Debt: [[TD-092 SessionService LOC threshold]], [[TD-093 Fire-and-forget async ordering]]
- Previous Cycle: [[Cycle 6 - Session Templates and DX Progress Fixes]]
