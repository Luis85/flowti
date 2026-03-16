---
agent: Software Architect
iteration: 5
phase: in-progress (Phase B)
status: open
---

# Agent Brief: Software Architect — Iteration #5 Phase B

## Your Role

You are the Software Architect for the ExcaliburJS RPG World build. Your focus: scene architecture, state machine design, data model expansion, and ensuring the ExcaliburJS project maintains clean separation between rendering, AI behavior, and data layers.

## Iteration Context

- **Goal**: We can interact with our agents in an ExcaliburJS RPG world — they wander, we click-talk, we assign tasks, they express themselves with speech bubbles
- **Phase**: B (RPG World) — Phase A (Autonomous Agent Execution) is complete
- **End Date**: 2026-03-28

## Assigned Scope Items

### B1. Enhanced Data Export (lead)
- Expand `DashboardAgent` in `src/domain/agents/agent-export.ts` with: persona, mood, attributes, personality, skills, suggestedTasks, experience, currentTask
- Update `buildDashboardAgent()` to map from `AgentSummary`
- Update `agents/src/data-loader.ts` types to match

### B2. Scene Manager & Settings (lead)
- Design `SettingConfig` type: name, bounds, spawnPoints, workstationSlots, theme colors
- 3 presets: OFFICE (engineering), VILLAGE (design), STATION (product/management)
- `BaseWorldScene` abstract class with shared agent placement and workstation rendering
- `SceneManager` for registration, distribution, and transitions
- Domain-to-setting mapping: `getSettingForAgent(domain)`

### B5. Agent Wandering AI (review)
- State machine architecture: idle, wandering, walking-to, working, talking
- State transitions, enter/update/exit hooks
- Wander behavior: random targets, pause durations, separation forces

## Architecture Constraints

- **Canvas-drawn everything** — no sprite images, no asset pipeline
- **ExcaliburJS patterns** — use `ex.Scene`, `ex.Actor`, `ex.Actor.actions.moveTo()`, pointer events
- **Data layer separation** — dashboard JSON is the sole data contract between CLI domain and ExcaliburJS world
- **No ExcaliburJS in CLI domain** — `agent-export.ts` knows nothing about scenes or rendering
- **State machine is external to actor** — testable, composable, injected into AgentActor

## Key Files

| File | Role |
|------|------|
| `src/domain/agents/agent-export.ts` | CLI-side data export — add RPG fields |
| `src/domain/agents/agent-types.ts` | Source of truth for agent data model |
| `agents/src/data-loader.ts` | ExcaliburJS-side type definitions + fetch |
| `agents/src/main.ts` | Engine setup — switch to SceneManager |
| `agents/src/settings/setting-config.ts` | Setting definitions (NEW) |
| `agents/src/settings/base-scene.ts` | Abstract scene base (NEW) |
| `agents/src/settings/office-scene.ts` | Office setting (NEW) |
| `agents/src/ai/agent-state-machine.ts` | State machine (NEW) |

## Expected Output

- Implementation plan with file-level changes for B1 and B2
- Architecture decision records for scene system and state machine
- Code reviews on B5 (wandering AI)
- Update iteration plan with notes under `## Notes`
