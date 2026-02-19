---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: medium
effort: small
dependencies:
  - "[[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]"
user_story: "[[I want to track my energy level during sessions]]"
note: "Adds 1-5 energy tracking to sessions. Changes logged as events. Used as input for cognitive overload detection (PBI-SW-016). Small scope — single increment delivery."
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

- [ ] `EnergyLevel` type: `1 | 2 | 3 | 4 | 5`
- [ ] `energy: EnergyLevel | null` field on Session interface
- [ ] `session.energy.changed` event with `{ sessionId, previous, current }`
- [ ] `handleEnergyChange()` handler in SessionService
- [ ] Energy adjustable in `running` and `paused` states
- [ ] Energy persisted with session state
- [ ] Energy included in session summary
- [ ] Backward compat: `energy ??= null` in `load()`

### Constraints

- Depends on PBI-SW-010 (lifecycle v2 state for state validation)
- Energy is user-reported only — no auto-detection

## Acceptance Criteria

- [ ] Energy indicator visible in session workspace
- [ ] Clicking energy level changes it and emits event
- [ ] Energy persisted and restored on reload
- [ ] Energy included in session summary
- [ ] `npm run build` passes

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | No | Depends on PBI-SW-010 |
| **N**egotiable | Yes | Scale (1-5 vs 1-10) and default value are negotiable |
| **V**aluable | Yes | Feeds cognitive overload detection and self-awareness |
| **E**stimable | Yes | ~80 LOC, ~15 tests |
| **S**mall | Yes | Single increment |
| **T**estable | Yes | Pure handler + event emission |

## Estimated Size

- **Source LOC:** ~80
- **Tests:** ~15
- **Increments:** 1

## Related

- PRD: [[Session Workspaces PRD]] (FR-11)
- Depends on: [[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]
- Feeds: [[PBI-SW-016 Cognitive Overload Detection]]
