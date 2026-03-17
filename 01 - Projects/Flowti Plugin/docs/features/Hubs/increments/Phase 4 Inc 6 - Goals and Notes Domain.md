---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-002 Documentation Sessions]]"
phase: 4
increment: 6
stage: done
date: 2026-02-16
tasm_score: 0
tasm_review: "Pending Three Amigos review"
tests_added: 29
tests_total: 2017
test_suites: 82
loc_added: 203
---

# Phase 4, Increment 6: Goals & Notes Domain

## Context

Sessions lack preparation structure. Users can't define goals before starting or take persistent notes during a session. The `notes: string` field already exists on Session but has no mutation events. Goals don't exist at all.

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

## Scope

Add `SessionGoal` interface and `goals: SessionGoal[]` to Session. Add 8 new events for goal CRUD and notes mutation. Add 4 new SessionService handlers. Thread goals through templates, rerun, and createFromTemplate. Backward compat in `load()`. ~203 LOC, ~25 tests.

## Data Model

```typescript
interface SessionGoal {
  id: string;
  text: string;
  completed: boolean;
  completedAt: string | null;
}
```

Add to `Session`: `goals: SessionGoal[]`
Add to `SessionTemplate`: `goals?: string[]` (just goal text)

## Events

| Event | Payload | Direction |
|-------|---------|-----------|
| `session.goal.add` | `{ sessionId, text }` | Command |
| `session.goal.toggle` | `{ sessionId, goalId }` | Command |
| `session.goal.remove` | `{ sessionId, goalId }` | Command |
| `session.goal.added` | `{ sessionId, goal: SessionGoal }` | State |
| `session.goal.toggled` | `{ sessionId, goalId, completed }` | State |
| `session.goal.removed` | `{ sessionId, goalId }` | State |
| `session.notes.update` | `{ sessionId, notes }` | Command |
| `session.notes.updated` | `{ sessionId, notes }` | State |

## Changes

### Modified Files

- `src/domain/session/types.ts` — `SessionGoal` + `goals` on Session + `goals` on Template (+12 LOC)
- `src/domain/session/events.ts` — 8 new events + `goals?` on `session.create` payload (+16 LOC)
- `src/domain/session/SessionService.ts` — 4 handlers + threading + backward compat (+65 LOC)
- `src/domain/session/helpers.ts` — `createGoal` + update `createSession` (+10 LOC)
- `src/infrastructure/events/catalog.ts` — 8 catalog entries for new events (+8 entries)
- `tests/domain/session/SessionService.test.ts` — Goal CRUD + notes + threading + compat tests (+25 tests)
- `tests/domain/session/helpers.test.ts` — `createGoal` + goals field tests (+4 tests)
- 4 test files — `goals: []` added to `makeSession` helpers (SessionService, helpers, Dashboard, Sessions)

## Tests (29 added)

**helpers.test.ts** (+4 tests):
- `createGoal`: creates goal with default values, distinct goals for different IDs
- `createSession`: session starts with empty goals array

**SessionService.test.ts** (+25 tests):
- Goal CRUD (11): add, unique IDs, toggle on, toggle off, remove, ignore non-existent session/goal (3), persistence (3)
- Notes update (4): update, overwrite, ignore non-existent session, persistence
- Create with goals (3): string array → SessionGoal[], empty when not provided, empty array provided
- Rerun with goals (3): carry text forward, reset completed state, generate new IDs
- Template with goals (4): include goal texts in template, omit when empty, create session from template with goals, create without goals
- Backward compat (1): legacy sessions get `goals: []`

## Acceptance Criteria

- [x] `SessionGoal` interface with id, text, completed, completedAt
- [x] `goals: SessionGoal[]` on Session with backward compat
- [x] 3 goal command events + 3 goal state events working
- [x] Notes update/updated events working
- [x] Goals threaded through create, rerun, createFromTemplate, saveTemplateFromSession
- [x] `npm run build` passes — 2,017 tests across 82 suites

## Verification

1. `npm run build` passes (all tests green)
2. Create session with goals via event bus
3. Toggle and remove goals via events
4. Update notes via event
5. Rerun session carries forward goals
6. Template saves/loads goal texts
7. Old sessions without goals load cleanly
