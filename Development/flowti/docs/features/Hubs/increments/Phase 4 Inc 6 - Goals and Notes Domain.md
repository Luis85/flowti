---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-002 Documentation Sessions]]"
phase: 4
increment: 6
stage: planned
date:
tasm_score: 0
tasm_review: ""
tests_added: 0
tests_total: 0
test_suites: 0
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
- `src/domain/session/events.ts` — 8 new events (+16 LOC)
- `src/domain/session/SessionService.ts` — 4 handlers + threading + backward compat (+65 LOC)
- `src/domain/session/helpers.ts` — `createGoal` + update `createSession` (+10 LOC)
- `tests/domain/session/SessionService.test.ts` — Goal CRUD + notes + threading tests (+90 LOC)
- `tests/domain/session/helpers.test.ts` — `createGoal` tests (+10 LOC)

## Tests

- Goal add: creates goal with id, text, completed=false
- Goal toggle: flips completed, sets completedAt
- Goal toggle back: clears completedAt
- Goal remove: removes from array
- Notes update: persists notes string
- Create with goals: converts string[] to SessionGoal[]
- Rerun with goals: carries forward text, resets completed
- Template with goals: saves/loads goal texts
- Backward compat: old sessions get `goals: []`

## Acceptance Criteria

- [ ] `SessionGoal` interface with id, text, completed, completedAt
- [ ] `goals: SessionGoal[]` on Session with backward compat
- [ ] 3 goal command events + 3 goal state events working
- [ ] Notes update/updated events working
- [ ] Goals threaded through create, rerun, createFromTemplate, saveTemplateFromSession
- [ ] `npm run build` passes

## Verification

1. `npm run build` passes (all tests green)
2. Create session with goals via event bus
3. Toggle and remove goals via events
4. Update notes via event
5. Rerun session carries forward goals
6. Template saves/loads goal texts
7. Old sessions without goals load cleanly
