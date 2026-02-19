---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: done
priority: medium
effort: small
dependencies:
  - "[[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]"
user_story: "[[I want to track my energy level during sessions]]"
note: "Adds 1-5 energy tracking to sessions. Changes logged as events. Used as input for cognitive overload detection (PBI-SW-016). Small scope — single increment delivery."
delivered_in: "[[Cycle 8 - Complete Execution Layer]]"
tags:
  - backlog
  - session-v2
---

## User Story — Problem Space

As a session user, I want to track my energy level during sessions so that I can build awareness of my productive patterns and receive appropriate overload warnings.

### User Pains

- No way to record energy or focus level during sessions
- Session analytics don't account for cognitive state
- Overload detection has no energy signal to work with
- No historical data for identifying peak productivity times

### User Needs

- Clickable 1–5 energy indicator visible during sessions
- Energy adjustable at any time during active session
- Energy changes logged as events for timeline visibility
- Energy level persisted with session state

## Solution Statement

### Use Cases

**Gherkin:**
```gherkin
Given a running session with energy level 4
When the user clicks energy down to 3
Then session.energy.changed event is emitted with { previous: 4, current: 3 }
And the energy indicator updates to show level 3
And the change appears in the event timeline
```

### Functional Requirements

- [x] `EnergyLevel` type: `1 | 2 | 3 | 4 | 5`
- [x] `energy: EnergyLevel | null` field on Session interface
- [x] `session.energy.changed` event with `{ sessionId, before, after }`
- [x] `session.energy.set` command event with `{ sessionId, level }`
- [x] `handleEnergyChange()` handler in SessionService
- [x] Energy adjustable in `running` and `paused` states
- [x] Energy persisted with session state
- [x] Energy included in session summary (note sync)
- [x] Backward compat: `energy ??= null` in `load()`

### Constraints

- Depends on PBI-SW-010 (lifecycle v2 state for state validation)
- Energy is user-reported only — no auto-detection

## Acceptance Criteria

- [x] Energy indicator visible in session workspace
- [x] Clicking energy level changes it and emits event
- [x] Energy persisted and restored on reload
- [x] Energy included in session summary
- [x] `npm run build` passes

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | No | Depends on PBI-SW-010 |
| **N**egotiable | Yes | Scale (1-5 vs 1-10) and default value are negotiable |
| **V**aluable | Yes | Feeds cognitive overload detection and self-awareness |
| **E**stimable | Yes | ~90 LOC, ~20 tests |
| **S**mall | Yes | Single increment |
| **T**estable | Yes | Pure handler + event emission |

## Delivery Summary

- **Delivered in:** Cycle 8 Inc 1
- **Source LOC:** ~90 (SessionEnergyIndicator)
- **Tests:** 20 new (14 component + 4 helpers + 2 subscriptions), 2,707 total

### Files Changed

| File | Change |
|------|--------|
| `src/domain/session/events.ts` | Added `session.energy.set` command event |
| `src/infrastructure/events/catalog.ts` | Registered energy command |
| `src/domain/session/SessionService.ts` | Wired energy command + note sync on energy change |
| `src/domain/session/helpers.ts` | Energy level in `generateSessionSummaryBody()` |
| `src/ui/session/SessionEnergyIndicator.ts` | **New** — clickable 1–5 energy indicator (~90 LOC) |
| `src/ui/SessionWorkspaceView.ts` | Integrated energy panel |
| `src/ui/session/SessionWorkspaceSubscriptions.ts` | Energy subscription + interface update |
| `tests/ui/session/SessionEnergyIndicator.test.ts` | **New** — 14 component tests |
| `tests/ui/session/SessionWorkspaceSubscriptions.test.ts` | +2 energy subscription tests |
| `tests/domain/session/helpers.test.ts` | +4 energy summary tests |

## Related

- PRD: [[Session Workspaces PRD]] (FR-11)
- Depends on: [[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]
- Feeds: [[PBI-SW-016 Cognitive Overload Detection]]
