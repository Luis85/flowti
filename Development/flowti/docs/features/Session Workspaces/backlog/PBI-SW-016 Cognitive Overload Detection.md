---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: done
priority: low
effort: small
dependencies: []
user_story: "[[I want to be warned when my session becomes overloaded]]"
note: "Threshold-based overload detection. Triggers on: >5 tasks, >8 context bindings, duration exceeded, low energy + high complexity. Non-blocking warning. Configurable thresholds. Small scope — pure computation + conditional render."
delivered_in: "[[Cycle 8 - Complete Execution Layer]]"
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

- [x] `CognitiveLoadThresholds` type: `{ maxTasks, maxBindings, maxDurationMinutes, lowEnergyThreshold }`
- [x] `detectCognitiveOverload(session, thresholds): OverloadResult` pure function
- [x] `OverloadResult` type: `{ overloaded: boolean, reasons: string[] }`
- [x] Threshold triggers:
  - [x] `executionTasks.length > maxTasks` (default: 5)
  - [x] `contextBindings.length > maxBindings` (default: 8)
  - [x] `elapsedMs > maxDurationMinutes * 60000` (default: 120 min)
  - [x] `energy <= lowEnergyThreshold && executionTasks.length > 3` (compound)
- [x] `session.overload.detected` event with `{ sessionId, reasons }`
- [x] Non-blocking warning rendered in workspace (between ExecutionPanel and NotesPanel)
- [x] Warning includes reason list and suggestion text
- [x] Warning dismissible
- [ ] Thresholds configurable in settings (`cognitiveLoadThresholds`) *(deferred — defaults hardcoded)*
- [x] Detection runs on task/binding/energy change events

### Technical Requirements

- [x] `CognitiveLoadThresholds` and `OverloadResult` in `src/domain/session/types.ts`
- [x] `detectCognitiveOverload()` pure function in `src/domain/session/helpers.ts`
- [ ] Default thresholds via Zod schema defaults in SettingsService *(deferred)*
- [x] Event listener in SessionService triggers detection on relevant changes
- [x] UI: `CognitiveLoadAlert` component follows shared component pattern

### Constraints

- Warning must be non-blocking — never prevent the user from working
- Detection must be < 1ms (simple comparisons on existing data)
- Must work without energy tracking (PBI-SW-011) — compound threshold skipped if `energy === null`

## Acceptance Criteria

- [x] Warning shown when task count exceeds threshold
- [x] Warning shown when binding count exceeds threshold
- [x] Warning shown when session duration exceeds threshold
- [x] Compound warning shown when energy low + tasks high
- [x] Warning is dismissible
- [ ] Thresholds configurable in settings *(deferred — hardcoded defaults)*
- [x] `session.overload.detected` event emitted
- [x] `npm test` passes (2,733 tests, 108 suites)

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | Yes | Pure computation — graceful degradation without energy |
| **N**egotiable | Yes | Threshold values and compound rules |
| **V**aluable | Yes | Prevents session scope creep |
| **E**stimable | Yes | ~120 LOC, ~26 tests |
| **S**mall | Yes | Single increment |
| **T**estable | Yes | Pure detection function with mock data |

## Delivery Summary

- **Delivered in:** Cycle 8 Inc 2
- **Source LOC:** ~120 (detectCognitiveOverload ~40, CognitiveLoadAlert ~80, service wiring ~25)
- **Tests:** 26 new (12 helpers + 12 component + 2 subscriptions), 2,733 total

### Files Changed

| File | Change |
|------|--------|
| `src/domain/session/types.ts` | Added `OverloadResult` interface, `DEFAULT_COGNITIVE_LOAD_THRESHOLDS` constant |
| `src/domain/session/helpers.ts` | Added `detectCognitiveOverload()` pure function (~40 LOC) |
| `src/domain/session/SessionService.ts` | Added `checkCognitiveOverload()` method + wired to 5 handlers + deduped emission |
| `src/ui/session/CognitiveLoadAlert.ts` | **New** — non-blocking warning banner (~80 LOC) |
| `src/ui/SessionWorkspaceView.ts` | Integrated overload alert between execution and notes |
| `src/ui/session/SessionWorkspaceSubscriptions.ts` | Added `session.overload.detected` subscription + interface update |
| `tests/domain/session/helpers.test.ts` | +12 detection tests |
| `tests/ui/session/CognitiveLoadAlert.test.ts` | **New** — 12 component tests |
| `tests/ui/session/SessionWorkspaceSubscriptions.test.ts` | +2 overload subscription tests |

## Related

- PRD: [[Session Workspaces PRD]] (FR-16)
- Enhanced by: [[PBI-SW-011 Energy Tracking]] (energy signal for compound detection)
- Data from: [[PBI-SW-012 Execution Plan]] (task count), [[PBI-SW-002 Context Bindings]] (binding count)
