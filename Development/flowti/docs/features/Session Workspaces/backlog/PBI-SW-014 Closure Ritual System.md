---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: high
effort: large
dependencies:
  - "[[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]"
user_story: "[[I want structured reflection when my session ends]]"
note: "Core v2 differentiator. Introduces configurable closure overlay triggered on 'reviewing' state. 3-tier template inheritance (Global → Session Type → Instance). Required completion gates the transition to 'completed'. Depends on PBI-SW-010 for the 'reviewing' lifecycle state."
tags:
  - backlog
  - session-v2
---

## User Story — Problem Space

As a session user, I want to be guided through a structured review when my session ends so that I capture what worked, what didn't, and what comes next — every time.

### User Pains

- Sessions complete without any structured review — just clicking "Complete"
- Reflection is optional and unstructured — most sessions end without it
- No accountability mechanism for reviewing outcomes
- Different session types should ask different review questions, but can't
- No follow-up action capture at session boundary

### User Needs

- Structured closure overlay when session timer expires
- Mandatory fields that must be completed before session can be marked as done
- Configurable questions per session type (workshop vs. deep work have different closure needs)
- Standard fields: Did you achieve the outcome? What worked? What didn't? Next action?
- Follow-up action paths: create follow-up session, create backlog item, or archive

## Solution Statement

### Use Cases

**Flow:**
Timer reaches zero → session enters `reviewing` state → closure overlay appears → user answers required questions → user selects follow-up action → session transitions to `completed`

**Gherkin:**
```gherkin
Given a running session whose timer reaches zero
When the session enters "reviewing" state
Then the closure overlay appears with configured questions

Given a closure overlay with required fields
When the user has not answered "Did you achieve the outcome?"
Then the "Complete" button is disabled

Given a completed closure with outcome "Partial"
When the user selects "Create follow-up session"
Then a new session is created inheriting the original's intent and context
```

### Functional Requirements

**Closure overlay (FR-14):**
- [ ] Overlay rendered when `session.state === "reviewing"`
- [ ] Overlay blocks main workspace content
- [ ] Standard fields: Outcome achieved (Yes/Partial/No), What worked, What didn't, Next action
- [ ] Additional configurable questions per closure template
- [ ] Required fields must be completed to enable "Complete Session" button
- [ ] `session.closure.started` event emitted when overlay shown
- [ ] `session.closure.completed` event emitted when user completes closure

**Closure configuration (FR-14):**
- [ ] `ClosureTemplate` type: `{ questions: ClosureQuestion[], requiredFields: string[] }`
- [ ] `ClosureQuestion` type: `{ id, question, type: "text"|"select"|"rating", required, options? }`
- [ ] 3-tier inheritance: Global → Session Type → Instance
- [ ] Global template configurable in settings
- [ ] Session type templates can add/remove/modify questions
- [ ] Instance-level overrides supported

**Follow-up actions:**
- [ ] "Create Follow-Up Session" — new session inheriting intent and context bindings
- [ ] "Create Backlog Item" — placeholder for future backlog integration
- [ ] "Archive Session" — move directly to archived state
- [ ] Follow-up session carries forward the original's primary outcome (modified)

**Persistence:**
- [ ] `ClosureResponse` type: `{ outcomeAchieved, whatWorked, whatDidnt, nextAction, answers }`
- [ ] `closureResponse` field on Session interface
- [ ] Closure responses included in session summary
- [ ] Backward compat: `closureResponse ??= null` in `load()`

### Technical Requirements

- Depends on PBI-SW-010 `reviewing` state in lifecycle
- `ClosureTemplate`, `ClosureQuestion`, `ClosureResponse` types in `src/domain/session/types.ts`
- `handleClosureStart()`, `handleClosureComplete()` in SessionService
- `closureTemplateGlobal` setting in SettingsService
- Default closure template with 4 standard questions
- Session type configs gain optional `closureTemplate` field
- Resolution: `resolveClosureTemplate(global, typeConfig, instance)` pure function

### Constraints

- Requires PBI-SW-010 for `reviewing` lifecycle state
- Closure overlay is a Modal-like component — must work in both Main and Sidebar contexts
- Follow-up session creation reuses existing `createSession()` path

## Acceptance Criteria

- [ ] Timer expiration shows closure overlay
- [ ] Required fields block completion button when unanswered
- [ ] Completing closure transitions session to `completed`
- [ ] Closure response persisted with session state
- [ ] Global closure template configurable in settings
- [ ] Session type closure templates override global defaults
- [ ] "Create follow-up session" creates a new session with inherited context
- [ ] Closure response included in session summary
- [ ] `npm run build` passes

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | No | Depends on PBI-SW-010 reviewing state |
| **N**egotiable | Yes | Question types, required fields, and follow-up actions are negotiable |
| **V**aluable | Yes | Core v2 differentiator — enforces reflection discipline |
| **E**stimable | Yes | ~250 LOC, ~25 tests |
| **S**mall | Yes | 2-3 increments (domain, overlay UI, configuration) |
| **T**estable | Yes | Template resolution, response validation, state transitions |

## Estimated Size

- **Source LOC:** ~250
- **Tests:** ~25
- **Increments:** 2-3

## Related

- PRD: [[Session Workspaces PRD]] (FR-14)
- Depends on: [[PBI-SW-010 Session Lifecycle v2 and Intent Layer]] (reviewing state)
- Enhanced by: [[PBI-SW-013 Structured Reflection]] (reflections included in closure)
