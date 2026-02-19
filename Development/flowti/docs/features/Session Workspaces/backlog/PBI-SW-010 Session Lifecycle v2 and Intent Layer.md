---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
cycle: "Cycle 6"
priority: high
effort: large
dependencies: []
user_story: "[[I want to define a clear outcome before starting a session]]"
note: "Foundation PBI for Session v2. Introduces the 6-state lifecycle (prepared → running → paused → reviewing → completed → archived) and the Intent Layer (primary outcome, why it matters, session mode). All other v2 PBIs depend on this. Domain-first delivery: types + state machine + events + service handlers. No UI in first increment."
tags:
  - backlog
  - session-v2
---

## User Story — Problem Space

As a session user, I want to define a clear outcome and select a session mode before I start working, and I want the session to transition through a structured lifecycle so that my work is intentional, state-driven, and leads to structured closure.

### User Pains

- Sessions start without a defined purpose — no outcome, no "why," no mode selection
- Session lifecycle has no "reviewing" state — sessions complete immediately without reflection
- No separation between "prepared" and "active" — sessions jump from creation to running
- Session status values (`active`, `paused`, `completed`, `archived`) don't support the reviewing→closure flow
- All session types share the same start flow — no mode-specific intent structure

### User Needs

- Define a primary outcome before session execution begins
- Optionally state why the outcome matters for focus clarity
- Select a session mode (Deep Work, Planning, Workshop, Review, Exploration) that influences workspace behavior
- Session lifecycle includes a "reviewing" state before completion
- Timer reaching zero transitions to reviewing (not immediately to completed)
- State machine validates transitions (no skipping states)

## Solution Statement

### Use Cases

**Flow:**
User creates a session → enters primary outcome and selects mode → session enters `prepared` state → user starts session → session enters `running` state → timer reaches zero → session enters `reviewing` state → user completes closure ritual → session enters `completed` state

**Gherkin:**
```gherkin
Given the user creates a new session
When they set the primary outcome to "Design payment event model"
And select mode "Domain Design"
Then the session enters "prepared" state with intent stored

Given a running session with a 25-minute timer
When the timer reaches zero
Then the session transitions to "reviewing" state
And session.review.started event is emitted

Given a session in "reviewing" state
When the user has not completed the closure ritual
Then the session cannot transition to "completed" state
```

### Functional Requirements

**Lifecycle state machine (FR-09):**
- [ ] 6 states: `prepared`, `running`, `paused`, `reviewing`, `completed`, `archived`
- [ ] Valid transitions: prepared→running, running→paused, paused→running, running→reviewing, reviewing→completed, completed→archived
- [ ] State changes emit `session.state.changed` event
- [ ] Timer reaching zero auto-transitions from `running` → `reviewing`
- [ ] `reviewing` → `completed` gated by closure ritual completion (FR-14)
- [ ] Backward compatible: existing `active` maps to `running` in `load()`

**Intent Layer (FR-10):**
- [ ] `SessionIntent` type: `{ primaryOutcome: string, whyItMatters?: string, mode: SessionMode }`
- [ ] `SessionMode` union: `"deep-work" | "planning" | "workshop" | "review" | "exploration"`
- [ ] Intent settable via `session.intent.set` command event
- [ ] Intent updatable via `session.intent.updated` event
- [ ] Intent editable in `prepared` and `paused` states
- [ ] Intent locked during `running` (editable only via explicit unlock action)
- [ ] `handleSetIntent()` and `handleUpdateIntent()` handlers in SessionService
- [ ] Intent persisted with session state
- [ ] Intent included in session summary generation

### Technical Requirements

- `SessionStatusV2` type replaces or extends existing `SessionStatus`
- `SessionIntent` and `SessionMode` types in `src/domain/session/types.ts`
- State machine transition validator: `isValidTransition(from, to): boolean` pure function
- `handleSetIntent()`, `handleUpdateIntent()` in SessionService (~40 LOC each)
- Timer auto-transition: modify existing timer completion handler to transition to `reviewing` instead of `completed`
- Backward compat: `load()` maps `status: "active"` → `"running"`, adds `intent ??= null`
- Thread `intent` through all creation paths (create, rerun, template, daily) per L-09

### Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `session.intent.set` | Command | `{ sessionId, intent: SessionIntent }` |
| `session.intent.updated` | State | `{ sessionId, intent: SessionIntent }` |
| `session.mode.set` | Command | `{ sessionId, mode: SessionMode }` |
| `session.review.started` | State | `{ sessionId }` |

### Constraints

- Must maintain backward compatibility with existing session data
- Must not break existing SessionWorkspaceView rendering
- Timer auto-transition must work with both countdown and open-ended sessions
- Intent fields must be serializable to JSON (TypedStorage persistence)

## Acceptance Criteria

- [ ] Creating a session allows setting primary outcome and session mode
- [ ] Session starts in `prepared` state (not immediately `running`)
- [ ] Starting a prepared session transitions to `running`
- [ ] Timer reaching zero transitions to `reviewing` state
- [ ] `reviewing` state blocks transition to `completed` until closure ritual completes (placeholder: always allow until FR-14)
- [ ] State machine rejects invalid transitions (e.g., `prepared` → `completed`)
- [ ] Intent persisted and restored on plugin reload
- [ ] Intent visible in session detail views
- [ ] `session.intent.set` and `session.review.started` events emitted correctly
- [ ] Backward compat: existing sessions with `status: "active"` load correctly as `"running"`
- [ ] `npm run build` passes with all tests green

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent — can be delivered without other PBIs in flight | Yes | Foundation PBI — no dependencies |
| **N**egotiable — scope can be adjusted without losing core value | Yes | Intent lock behavior and mode selection are negotiable |
| **V**aluable — delivers user-facing or architectural value | Yes | Architectural foundation + user-facing outcome definition |
| **E**stimable — effort and scope are understood | Yes | ~250 LOC, ~30 tests, 2 increments |
| **S**mall — deliverable in 1-3 increments | Yes | Inc 1: types + state machine + events, Inc 2: intent handlers + backward compat |
| **T**estable — acceptance criteria are verifiable | Yes | State transitions and intent CRUD are pure-function testable |

## Estimated Size

- **Source LOC:** ~250 (types ~60, service handlers ~120, helpers ~40, catalog ~30)
- **Test LOC:** ~150
- **Tests:** ~30
- **Increments:** 2 (domain types + state machine, then intent handlers)

## Related

- PRD: [[Session Workspaces PRD]] (FR-09, FR-10)
- Extends: [[PBI-SW-003 Session Types]] (mode selection builds on type config)
- Blocks: [[PBI-SW-011 Energy Tracking]], [[PBI-SW-014 Closure Ritual System]], [[PBI-SW-017 Main Sidebar Mode Separation]]
