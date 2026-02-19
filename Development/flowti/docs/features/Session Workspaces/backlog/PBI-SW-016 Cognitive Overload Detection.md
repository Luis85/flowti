---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: low
effort: small
dependencies: []
user_story: "[[I want to be warned when my session becomes overloaded]]"
note: "Threshold-based overload detection. Triggers on: >5 tasks, >8 context bindings, duration exceeded, low energy + high complexity. Non-blocking warning. Configurable thresholds. Small scope — pure computation + conditional render."
tags:
  - backlog
  - session-v2
---

## User Story — Problem Space

As a session user, I want to be warned when my session is becoming overloaded so that I can adjust my scope before losing focus.

### User Pains

- No awareness when session scope grows too large
- Easy to add too many tasks, bind too many contexts, or work past productive limits
- Overload only recognized in hindsight, not during the session
- No connection between energy level and workload

### User Needs

- Non-blocking warning when overload thresholds exceeded
- Clear reasons for the warning (which threshold triggered)
- Configurable thresholds in settings
- Warning dismissible (not blocking workflow)

## Solution Statement

### Functional Requirements

- [ ] `CognitiveLoadThresholds` type: `{ maxTasks, maxBindings, maxDurationMinutes, lowEnergyThreshold }`
- [ ] `detectOverload(session, thresholds): OverloadResult` pure function
- [ ] `OverloadResult` type: `{ overloaded: boolean, reasons: string[] }`
- [ ] Threshold triggers:
  - [ ] `executionTasks.length > maxTasks` (default: 5)
  - [ ] `contextBindings.length > maxBindings` (default: 8)
  - [ ] `elapsedMs > maxDurationMinutes * 60000` (default: 120 min)
  - [ ] `energy <= lowEnergyThreshold && executionTasks.length > 3` (compound)
- [ ] `session.overload.detected` event with `{ sessionId, reasons }`
- [ ] Non-blocking warning rendered in workspace (between ExecutionCard and ContextCard)
- [ ] Warning includes reason list and suggestion text
- [ ] Warning dismissible
- [ ] Thresholds configurable in settings (`cognitiveLoadThresholds`)
- [ ] Detection runs on task/binding/energy change events

### Technical Requirements

- `CognitiveLoadThresholds` and `OverloadResult` in `src/domain/session/types.ts`
- `detectOverload()` pure function in `src/domain/session/helpers.ts`
- Default thresholds via Zod schema defaults in SettingsService
- Event listener in SessionService triggers detection on relevant changes
- UI: `CognitiveLoadAlert` component follows shared component pattern

### Constraints

- Warning must be non-blocking — never prevent the user from working
- Detection must be < 1ms (simple comparisons on existing data)
- Must work without energy tracking (PBI-SW-011) — compound threshold skipped if `energy === null`

## Acceptance Criteria

- [ ] Warning shown when task count exceeds threshold
- [ ] Warning shown when binding count exceeds threshold
- [ ] Warning shown when session duration exceeds threshold
- [ ] Compound warning shown when energy low + tasks high
- [ ] Warning is dismissible
- [ ] Thresholds configurable in settings
- [ ] `session.overload.detected` event emitted
- [ ] `npm run build` passes

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | Yes | Pure computation — graceful degradation without energy |
| **N**egotiable | Yes | Threshold values and compound rules |
| **V**aluable | Yes | Prevents session scope creep |
| **E**stimable | Yes | ~80 LOC, ~10 tests |
| **S**mall | Yes | Single increment |
| **T**estable | Yes | Pure detection function with mock data |

## Estimated Size

- **Source LOC:** ~80
- **Tests:** ~10
- **Increments:** 1

## Related

- PRD: [[Session Workspaces PRD]] (FR-16)
- Enhanced by: [[PBI-SW-011 Energy Tracking]] (energy signal for compound detection)
- Data from: [[PBI-SW-012 Execution Plan]] (task count), [[PBI-SW-002 Context Bindings]] (binding count)
