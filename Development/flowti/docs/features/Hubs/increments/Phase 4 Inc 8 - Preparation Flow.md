---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-002 Documentation Sessions]]"
phase: 4
increment: 9
stage: planned
date:
tasm_score: 0
tasm_review: ""
tests_added: 0
tests_total: 0
test_suites: 0
loc_added: 111
---

# Phase 4, Increment 9: Preparation Flow & Auto-Open

> **Note**: Originally planned as Increment 8. Renumbered after [[Phase 4 Inc 8 - Session Workspace Enrichment]] was inserted. The "Open Workspace" button was delivered in Increment 8; remaining scope is goals repeater and auto-open.

## Context

Goals exist in the domain (Increment 6) and the workspace view exists (Increment 7), but the preparation-to-execution flow isn't connected. Users need to define goals during session creation and have the workspace auto-open when starting.

User story: [[I want to prepare a working session, so that I can focus on one task at a time]]

## Scope

Goals repeater in `NewSessionModal` for pre-session preparation. Auto-open `SessionWorkspaceView` on `session.started`. Open focus file in adjacent split leaf. ~111 LOC, ~6 tests.

> "Open Workspace" button was delivered in Increment 8 and is no longer in scope here.

## Changes

### Modified Files

- `src/ui/modals.ts` — Goals repeater in NewSessionModal (add/remove goal text inputs) (+45 LOC)
- `src/ui/UserHubView.ts` — Auto-open workspace on `session.started` (+15 LOC)
- `src/domain/session/events.ts` — Update `session.create` payload with `goals?: string[]` (+1 LOC)
- Test files — Modal goals repeater tests (+40 LOC)

## Key Behaviors

- **NewSessionModal goals repeater**: List of text inputs below focus file. "+" adds a goal row, "x" removes it. Goal texts passed through `onSubmit` callback.
- **Auto-open workspace**: On `session.started` event, open `SessionWorkspaceView` in a new tab leaf. If session has focus file, open it in an adjacent split leaf.

## Tests

- NewSessionModal renders goals repeater
- Can add/remove goal inputs in modal
- Goals passed to onSubmit callback
- Auto-open workspace on session.started
- Focus file auto-opens in adjacent split leaf

## Acceptance Criteria

- [ ] NewSessionModal has goals repeater (add/remove goals before creating)
- [ ] `session.create` event accepts optional `goals` array
- [ ] Workspace auto-opens on session start
- [ ] Focus file auto-opens in adjacent split leaf
- [ ] `npm run build` passes

## Verification

1. `npm run build` passes
2. Open NewSessionModal — add 3 goals, set focus file — Create
3. Session created with goals attached
4. Click Start — workspace auto-opens in new tab
5. Focus file opens in adjacent split
