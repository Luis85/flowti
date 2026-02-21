---
type: ProductBacklogItem
feature: "[[Train of Thoughts PRD]]"
stage: planned
priority: medium
effort: medium
dependencies:
  - "[[PBI-TOT-001 Train Domain and Serial Capture]]"
  - "[[PBI-TOT-002 Train Main View and Timeline Sidebar]]"
user_story: "[[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]"
note: "Session nesting for Train of Thoughts — starting a new train pauses the current one, trains are linked. Closure ritual integration. 1 increment: Inc 5."
tags:
  - backlog
  - train-of-thought
  - session
---

## User Story — Problem Space

As a user, I want to start a new Train of Thoughts while another is running so that sudden inspirations don't require abandoning my current train, and I want the closure ritual to trigger when I end a train so that I reflect on what I captured.

### User Pains

- Starting a new session requires stopping the current one
- No way to link related trains (e.g., a tangent spawned from the main train)
- No structured reflection when a brainstorming session ends
- Context switches between trains are manual and lose the connection

### User Needs

- Start a new train while another is running (automatic pause of current)
- Trains linked via session relations (parent/child)
- Return to paused train and resume where left off
- Closure ritual on train completion (leveraging existing Session v2 closure)

## Solution Statement

### Use Cases

**Gherkin:**
```gherkin
Given a running train session "API Design"
When the user starts a new Train of Thoughts
Then "API Design" is paused automatically
And a new train session starts
And the new session has a "spawned_from" link to "API Design"

Given a paused train "API Design" and a running train "Auth Flow"
When the user stops "Auth Flow"
Then the closure ritual triggers for "Auth Flow"
And "API Design" is NOT auto-resumed (user must explicitly resume)

Given the user opens the Train Main View for "API Design"
When they click "Resume"
Then the current active train (if any) is paused
And "API Design" resumes from where it was left
```

### Functional Requirements

- [ ] Starting a new train pauses the currently running train (if any)
- [ ] Paused train's `TrainState.activeNodeId` preserved for resume
- [ ] New train has `spawned_from: sessionId` link to the paused train
- [ ] User can explicitly resume a paused train (pauses current if running)
- [ ] Closure ritual triggers on `completeSession()` for train sessions
- [ ] Train session type uses existing closure template system (configurable per type)
- [ ] Default closure template for trains: "What was your most valuable thought?", "Did any branches surprise you?", "What needs further exploration?", "What's the next step?"
- [ ] Train sessions appear in User Hub session history with type badge

### Technical Requirements

- [ ] `TrainService.startTrain()`: check for active train, pause if found, link sessions
- [ ] `SessionService` integration: `spawned_from` field on Session interface (or use context bindings)
- [ ] `DEFAULT_TRAIN_CLOSURE_TEMPLATE` in train types
- [ ] `train-of-thought` session type config with closure template
- [ ] Events: `train.session.nested` (when new train pauses existing)

### Constraints

- Only one level of nesting (no recursive train-in-train-in-train)
- Auto-resume of parent train is explicitly excluded (user must manually resume)
- Train sessions must work with existing Session v2 lifecycle (no custom state machine)

### Inc 5: Session Nesting + Closure Integration

**Goal:** Enable session nesting for trains and integrate with the closure ritual system.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | Nesting logic: pause active, link sessions | ~80 |
| 2 | `src/domain/train/types.ts` | DEFAULT_TRAIN_CLOSURE_TEMPLATE, session type config | ~30 |
| 3 | `src/domain/session/types.ts` | `train-of-thought` in SessionTypeConfig map | ~10 |
| 4 | `src/ui/train/TrainMainView.ts` | "Resume" button, spawned-from link display | ~40 |
| 5 | Integration | Wire session nesting events, closure template | ~30 |

**Est. total:** ~190 LOC source, ~80 LOC tests, ~15 new tests
