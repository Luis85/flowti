---
type: DecisionNote
adr: ADR-031
title: Session v2 Architecture
status: Accepted
date: 2026-02-19
domain: session
category: Architecture
drivers:
  - Intentional Execution
  - Structured Reflection
  - Closure Accountability
  - Dual Rendering
tags:
  - decision
  - session
  - architecture
  - v2
---

# ADR-031: Session v2 Architecture

## Status

**Accepted** — designed during Cycle 6, Inc 3 (2026-02-19).

## Context

Session Workspaces v1 (FRs 01–08, delivered Cycles 1–5) provides timer-based sessions with activity tracking, goals, decisions, context bindings, and workspace state save/restore. The user experience is "start a timer, work, stop." Sessions are passive containers — they track what happens but don't guide intention, execution, or reflection.

Session v2 transforms sessions into **structured execution environments** with:
- **Intent definition** before starting (what am I trying to achieve?)
- **Execution plan** tracking during (what tasks am I working through?)
- **Structured reflection** throughout (observations, blockers, ideas, decisions)
- **Closure ritual** at the end (was the outcome achieved? what's next?)
- **Energy awareness** during (am I burning out?)
- **Dual rendering** (full workspace in main, monitoring surface in sidebar)

This ADR documents the architectural decisions for this transformation.

### Driving Requirements

| FR | Capability | Priority |
|----|-----------|----------|
| FR-09 | Session Lifecycle v2 (6-state machine) | Foundation |
| FR-10 | Intent Layer | Foundation |
| FR-11 | Energy Tracking | Quality of life |
| FR-12 | Execution Plan | Core value |
| FR-13 | Structured Reflection | Core value |
| FR-14 | Closure Ritual System | Core differentiator |
| FR-15 | Activity Intelligence | Analytics |
| FR-16 | Cognitive Overload Detection | Safety net |
| FR-17 | Main/Sidebar Mode Separation | UI architecture |
| FR-18 | Workshop Mode | Specialization |

---

## Decision 1: Six-State Lifecycle Machine

### States

```
prepared → running → paused → reviewing → completed → archived
```

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| `prepared` | Session created, intent editable | Edit intent, add tasks, bind context, set energy, Start |
| `running` | Timer active, execution in progress | Pause, complete tasks, add reflections, change energy |
| `paused` | Timer frozen, workspace state saved | Resume, edit intent, edit tasks |
| `reviewing` | Closure ritual active, overlay blocks UI | Complete closure fields, submit |
| `completed` | Session finished, read-only | Archive, create follow-up, generate output |
| `archived` | Historical record | View only |

### Valid Transitions

```
prepared  → running      // Start (requires intent.primaryOutcome)
running   → paused       // Pause
running   → reviewing    // Timer expiry or manual complete
paused    → running      // Resume
reviewing → completed    // Closure ritual submitted
completed → archived     // Archive
```

All other transitions are **rejected** by `isValidTransition(from, to)`.

### Backward Compatibility

The v1 status `"active"` maps to v2 `"running"`. On `load()`:

```typescript
if (session.status === "active") session.status = "running";
session.intent ??= null;
session.energy ??= null;
session.executionTasks ??= [];
session.reflections ??= [];
session.closureResponse ??= null;
```

The `SessionStatus` type union expands to include both `"active"` (legacy) and `"running"` (canonical). Internal code uses `"running"` exclusively; `"active"` exists only for deserialization compatibility.

### Timer Completion Change

**v1 behavior:** `session.timer.completed` → `handleTimerCompleted` → status = `"completed"`.

**v2 behavior:** `session.timer.completed` → `handleTimerCompleted` → status = `"reviewing"`. The `reviewing → completed` transition is gated by closure ritual completion. Until FR-14 (Closure Ritual) is implemented, the gate is a **passthrough** — `reviewing` transitions to `completed` immediately.

### Open-Ended Sessions

Sessions with `durationMinutes === 0` have no timer. The user must explicitly trigger `running → reviewing` via a "Complete" button. The same closure ritual applies.

---

## Decision 2: Intent Layer Architecture

### Data Model

```typescript
interface SessionIntent {
  primaryOutcome: string;       // Required — what am I trying to achieve?
  whyItMatters?: string;        // Optional — motivation context
  mode: SessionMode;            // Required — execution context
}

type SessionMode = "deep-work" | "planning" | "workshop" | "review" | "exploration";
```

### State Guards

- Intent is **editable** in `prepared` and `paused` states.
- Intent is **locked** in `running` state (prevents mid-execution distraction).
- Intent is **read-only** in `reviewing`, `completed`, `archived`.
- **Start requires** `intent.primaryOutcome` to be non-empty (enforced by `handleStart`).

### Session Mode Effects

| Mode | Execution Card Label | Timer Default | Special Behavior |
|------|---------------------|---------------|------------------|
| `deep-work` | Tasks | 25min | Cognitive overload alerts enabled |
| `planning` | Tasks | 50min | — |
| `workshop` | Agenda | 50min | Timeline auto-expanded in sidebar, decisions highlighted |
| `review` | Tasks | 25min | — |
| `exploration` | Tasks | 0min (open-ended) | — |

---

## Decision 3: Energy Tracking

```typescript
type EnergyLevel = 1 | 2 | 3 | 4 | 5;
```

- 1–5 scale, rendered as filled/empty circles.
- Adjustable in `running` and `paused` states.
- Changes emit `session.energy.changed` with `{ sessionId, before, after }`.
- Persisted on the `Session` entity as `energy: EnergyLevel | null`.
- Default: `null` (not set). Users opt in by clicking the energy indicator.
- Low energy (`≤ lowEnergyThreshold`) combined with high task count triggers cognitive overload warning (FR-16).

---

## Decision 4: Dual Rendering Architecture (Main vs. Sidebar)

### Why Not BaseHubView?

`BaseHubView` provides a tabbed hub shell (master/detail split, tab bar, search). Sessions need a vertical card stack with state-dependent composition and a closure overlay. The patterns are fundamentally different.

**Decision:** Session v2 views extend `ItemView` directly, consistent with the existing `SessionWorkspaceView`.

### Two View Classes

| View | Purpose | Extends | VIEW_TYPE |
|------|---------|---------|-----------|
| `SessionMainView` | Full execution environment | `ItemView` | `flowti-session-workspace` (unchanged) |
| `SessionSidebarView` | Monitoring control surface | `ItemView` | `flowti-session-sidebar` |

### Composition Maps

**SessionMainView:**

```
SessionMainView (extends ItemView)
 ├── SessionHeader            // Title, type badge, status indicator
 ├── IntentCard               // Primary outcome, why it matters, mode
 ├── TimerEnergyCard          // Timer + energy indicator (combined)
 ├── ExecutionCard            // Task checklist with progress
 ├── ContextIntelligenceCard  // Context bindings + activity filter
 ├── ReflectionCard           // Structured reflection entries
 ├── ActivityIntelligenceCard // Computed activity stats
 ├── CognitiveLoadAlert       // Conditional: threshold exceeded
 └── SessionReviewOverlay     // Conditional: reviewing state overlay
```

**SessionSidebarView:**

```
SessionSidebarView (extends ItemView)
 ├── SidebarStatusHeader      // State, timer countdown, energy
 ├── SidebarIntentSnapshot    // Read-only intent display
 ├── SidebarExecutionSnapshot // Task progress (toggle-only)
 ├── SidebarContextSnapshot   // Bound entities (read-only)
 ├── SidebarActivitySnapshot  // Compact activity stats
 └── SidebarEventTimeline     // Recent event stream
```

### State-Based Rendering Rules

| State | Main View | Sidebar View |
|-------|-----------|-------------|
| `prepared` | Editable intent, tasks, context | Static snapshot |
| `running` | All cards active, live timer | Monitoring dashboard |
| `paused` | Editable, resume indicator | Monitoring + resume hint |
| `reviewing` | Overlay replaces content | "Review Required" badge |
| `completed` | Read-only summary | Compact summary |
| `archived` | Read-only, minimal | Minimal meta only |

### Shared Infrastructure

Both views reuse:
- `SessionWorkspaceSubscriptions.ts` — event listener wiring (extended for v2 events)
- `SessionWorkspaceHelpers.ts` — utility functions
- Component classes in `src/ui/session/` — each card/snapshot is a standalone class

The `SubscriptionViewContext` interface is extended with v2 accessors (intent, energy, tasks, reflections, closure state).

### Migration Path

1. **Inc 4 (Cycle 6):** Domain-only — state machine, intent, energy in `SessionService`. No UI changes.
2. **Future cycle:** Refactor `SessionWorkspaceView` → `SessionMainView` with v2 cards.
3. **Future cycle:** Add `SessionSidebarView` as new view type.
4. **Future cycle:** Add `SessionReviewOverlay` for closure ritual.

The current `SessionWorkspaceView` (479 LOC) continues to work unchanged until the UI refactor cycle.

---

## Decision 5: Closure Ritual System

### Three-Tier Template Inheritance

```
Global defaults → Session Type override → Instance override
```

1. **Global defaults**: Built-in closure template with standard questions (outcome achieved, what worked, what didn't, next action).
2. **Session type override**: Each `SessionTypeConfig` can specify a custom `closureTemplate`.
3. **Instance override**: Individual sessions can override the template.

### Data Model

```typescript
interface ClosureTemplate {
  questions: ClosureQuestion[];
  requiredFields: string[];   // IDs of questions that must be answered
}

interface ClosureQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "rating";
  required: boolean;
  options?: string[];         // For "select" type
}

interface ClosureResponse {
  outcomeAchieved: "yes" | "partial" | "no";
  whatWorked: string;
  whatDidnt: string;
  nextAction: string;
  answers: Record<string, string>;  // Question ID → answer
}
```

### UI Behavior

- When session enters `reviewing` state, `SessionReviewOverlay` renders **over** the main content (not a modal — a full-view overlay within the view container).
- The overlay presents the resolved closure template questions.
- The "Complete Session" button is **disabled** until all required fields are filled.
- Completing the ritual transitions `reviewing → completed` and persists the `ClosureResponse`.
- **Sidebar behavior:** Shows "Review Required" badge. The closure overlay is **Main-only** — the user must switch to the main view to complete the ritual.

### Placeholder Implementation (Inc 4)

Until FR-14 is implemented, the `reviewing → completed` gate is a passthrough. The state machine supports the transition but no overlay blocks it.

---

## Decision 6: Daily Tracking Removal

FR-08 (PBI-SW-007) is **deprecated** in PRD v8. The daily-tracking feature conflicts with v2's intentional execution philosophy — passive tracking is antithetical to "define intent before starting."

### What Gets Removed (Future Cycle)

- `daily-tracking` session type from `SessionType` union and `SESSION_TYPE_CONFIGS`
- Auto-start behavior in `SessionService.load()`
- Concurrent session routing (`dailySessionId` field)
- Daily note integration
- Nudge system configuration for daily-tracking type

### Backward Compatibility

On `load()`, existing `daily-tracking` sessions are handled gracefully:
- `status: "active"` → migrated to `"completed"` (auto-closed)
- `status: "prepared"` → migrated to `"archived"`
- The `daily-tracking` type string remains valid for deserialization but is removed from `SESSION_TYPES` (no longer offered in UI)

### Nudge System Independence

The nudge system (`NudgeService`) is **not removed**. It remains available for all other session types. Only the daily-tracking-specific nudge configuration is deprecated.

---

## Decision 7: Event Model Extension

### New v2 Events (14 planned)

| Event | Payload | Category |
|-------|---------|----------|
| `session.intent.set` | `{ sessionId, intent }` | Session |
| `session.intent.updated` | `{ sessionId, intent, previous }` | Session |
| `session.mode.set` | `{ sessionId, mode }` | Session |
| `session.energy.changed` | `{ sessionId, before, after }` | Session |
| `session.task.added` | `{ sessionId, task }` | Session |
| `session.task.completed` | `{ sessionId, taskId }` | Session |
| `session.task.removed` | `{ sessionId, taskId }` | Session |
| `session.task.reordered` | `{ sessionId, taskIds }` | Session |
| `session.reflection.added` | `{ sessionId, entry }` | Session |
| `session.reflection.removed` | `{ sessionId, entryId }` | Session |
| `session.review.started` | `{ sessionId }` | Session |
| `session.closure.started` | `{ sessionId }` | Session |
| `session.closure.completed` | `{ sessionId, response }` | Session |
| `session.overload.detected` | `{ sessionId, reasons }` | Session |

All v2 events follow the existing convention: command events (no suffix) trigger handlers, state events (past tense) are emitted after state change.

### Registration Strategy

v2 events are registered in the event catalog as **planned** (not wired) during Inc 3. They are wired incrementally as each PBI is implemented:
- PBI-SW-010: `session.intent.*`, `session.mode.set`, `session.energy.changed`, `session.review.started`
- PBI-SW-012: `session.task.*`
- PBI-SW-013: `session.reflection.*`
- PBI-SW-014: `session.closure.*`
- PBI-SW-016: `session.overload.detected`

---

## Decision 8: State Machine Implementation

### Pure Function Validator

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  prepared:  ["running"],
  running:   ["paused", "reviewing"],
  paused:    ["running"],
  reviewing: ["completed"],
  completed: ["archived"],
  archived:  [],
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### Why Not xstate?

ADR-018 adopted xstate v5 event conventions but the plugin does not use xstate as a runtime dependency. The session state machine is simple enough (6 states, 7 transitions) to implement as a pure function + switch in `SessionService`. If complexity grows beyond this, xstate can be introduced later.

### Handler Pattern

```typescript
private async handleStateTransition(sessionId: string, targetState: SessionStatusV2): Promise<void> {
  const session = this.findSession(sessionId);
  if (!session) return;
  if (!isValidTransition(session.status, targetState)) return;
  // Apply side effects per transition
  session.status = targetState;
  await this.save();
  // Emit appropriate event
}
```

This pattern keeps transition validation separate from side effects, making both independently testable.

---

## Consequences

### Positive

- **Clear lifecycle**: 6 well-defined states with explicit transitions prevent ambiguous session states.
- **Intent-driven**: Requiring `primaryOutcome` before Start ensures every session has purpose.
- **Structured closure**: The reviewing→completed gate ensures reflection isn't skipped.
- **Dual rendering**: Sidebar as monitoring surface keeps the main workspace uncluttered.
- **Incremental delivery**: Domain-first approach (types → handlers → UI) allows each PBI to deliver independently.
- **Backward compatible**: `load()` migration handles all v1 → v2 field additions gracefully.

### Negative

- **Increased complexity**: `SessionService` grows by ~150–200 LOC per PBI. The 1,300 LOC extraction threshold may be reached during Cycle 7.
- **Two view classes**: Maintaining `SessionMainView` and `SessionSidebarView` doubles the UI surface area.
- **Closure ritual overhead**: Mandatory review before completion may frustrate users in casual sessions. Mitigation: configurable templates, minimal default questions.
- **Daily tracking removal**: Existing daily-tracking users lose functionality. Mitigation: graceful migration, clear communication.

### Risks

| Risk | Mitigation |
|------|------------|
| SessionService exceeds 1,300 LOC | Extract v2 handlers to `SessionLifecycleHandlers.ts` |
| Two views diverge in behavior | Shared subscription context + component library |
| Closure overlay blocks important UI | "Skip" option in non-required templates |
| Workshop mode adds complexity | Implement as mode-conditional rendering, not separate code path |

---

## Related

- [[Session Workspaces PRD]] — v8, FRI 22/35
- [[ADR-024 BaseHubView Shell Extraction]] — hub pattern (not used for sessions)
- [[ADR-025 Activity Log Separate from Artifacts]] — activity tracking architecture
- [[ADR-026 Composable Folder Filtering]] — activity filter architecture
- [[Run Intentional Session]] — v2 happy-path flow
- [[Monitor Session from Sidebar]] — v2 sidebar flow
- [[Cycle 6 - Session Templates and DX Progress Fixes]] — implementation cycle
