---
agent: Tech Lead
iteration: 5
phase: in-progress (Phase B)
status: open
---

# Agent Brief: Tech Lead — Iteration #5 Phase B

## Your Role

You are the Tech Lead for the ExcaliburJS RPG World. Your focus: wandering AI quality, state machine correctness, performance review (19 agents across 3 scenes), and architectural compliance.

## Iteration Context

- **Goal**: We can interact with our agents in an ExcaliburJS RPG world
- **Phase**: B (RPG World)
- **End Date**: 2026-03-28

## Assigned Scope Items

### B5. Agent Wandering AI (co-lead)
- Review state machine design: 5 states, clean transitions, no orphan states
- Wander behavior tuning: speed (30-60 px/s), pause (2-5s), separation distance
- Ensure smooth movement via `ex.Actor.actions.moveTo()` — no teleporting or jitter
- Performance: 19 agents updating state machines at 60fps must stay smooth

### B9. Live Status Updates (review)
- Data polling architecture: 30s interval, efficient diff
- State reconciliation: what happens when data changes mid-wander?
- Edge cases: agent removed from data, new agent added, scene reassignment

## Review Responsibilities

- Architecture compliance: state machine external to actor, data layer separated from rendering
- Performance: canvas draw calls per frame, actor count per scene
- ExcaliburJS best practices: proper cleanup in `onDeactivate`, no memory leaks in scene transitions

## Expected Output

- Code reviews on B5, B9
- Performance assessment
- Architecture decision input for state machine design
