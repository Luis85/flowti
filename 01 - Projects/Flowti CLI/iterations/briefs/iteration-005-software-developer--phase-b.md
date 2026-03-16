---
agent: Software Developer
iteration: 5
phase: in-progress (Phase B)
status: open
---

# Agent Brief: Software Developer — Iteration #5 Phase B

## Your Role

You are the Software Developer for the ExcaliburJS RPG World build. You implement all phases, from data export through scene rendering, wandering AI, interaction system, and task assignment. You are the primary coder across all 10 scope items.

## Iteration Context

- **Goal**: We can interact with our agents in an ExcaliburJS RPG world — they wander, we click-talk, we assign tasks, they express themselves with speech bubbles
- **Phase**: B (RPG World) — Phase A (Autonomous Agent Execution) is complete
- **End Date**: 2026-03-28

## Assigned Scope Items (all — implementation lead)

### B1. Enhanced Data Export
- Add persona, mood, attributes, personality, skills, suggestedTasks, experience, currentTask to `DashboardAgent` in `agent-export.ts`
- Update `data-loader.ts` types

### B2. Scene Manager & Settings
- Implement `SettingConfig`, `BaseWorldScene`, 3 scene classes, `SceneManager`
- Wire into `main.ts` with keyboard scene switching

### B3. Agent Visual Upgrade
- Replace circles with canvas-drawn character bodies (head, torso, limbs)
- Domain-based coloring, persona name, mood indicator, direction facing, idle breathing

### B4. Workstation Tiles
- `Workstation extends ex.Actor` with type variants (desk, anvil, console)
- Occupy/vacate tracking, visual glow when occupied

### B5. Agent Wandering AI
- State machine (idle, wandering, walking-to, working, talking)
- Wander behavior with random targets, separation forces
- Integrate with `AgentActor.onPreUpdate()`

### B6. Click-to-Interact
- HTML overlay interaction panel (name, mood, attributes, action buttons)
- `pointerdown` on agent, selection highlight, `agent-selected` event

### B7. Speech & Thinking Bubbles
- Canvas-drawn speech bubble with tail and auto-dismiss
- Thinking bubble with "..." animation
- Bubble manager with queue and idle quotes

### B8. Task Assignment
- Task panel (sub-panel of interaction) with suggestedTasks
- Task dispatcher: walking-to→working→done flow
- Simulated 5-15s execution with completion speech bubble

### B9. Live Status Updates
- Data poller (30s interval), diff detection, status change announcements

### B10. Setting Themes
- Office (cool gray), Village (warm earth), Station (dark blue/neon) palettes
- Decorative elements per setting (plants, trees, starfield)

## Execution Order

```
B1 → B2 + B3 (parallel) → B4 + B10 (parallel) → B5 → B6 → B7 → B8 → B9
```

## Technical Constraints

- All drawing is canvas-based — no sprites, no image loading
- ExcaliburJS v0.32.0 — use `ex.Actor`, `ex.Scene`, `ex.Label`, `ex.Font`, pointer events, `actions.moveTo()`
- HTML overlay for interaction panel — position with `engine.worldToScreenCoordinates()`
- Build: `node build.mjs` via esbuild → `.flowti/agents/dashboard.js`
- State machine is separate from actor class — injected, not inherited

## Key Files

| File | Action |
|------|--------|
| `src/domain/agents/agent-export.ts` | MODIFY — expand DashboardAgent |
| `agents/src/data-loader.ts` | MODIFY — update types |
| `agents/src/agent-actor.ts` | MODIFY — visual upgrade, state machine, click handler, bubbles |
| `agents/src/main.ts` | MODIFY — SceneManager setup |
| `agents/src/settings/setting-config.ts` | CREATE |
| `agents/src/settings/base-scene.ts` | CREATE |
| `agents/src/settings/office-scene.ts` | CREATE |
| `agents/src/settings/village-scene.ts` | CREATE |
| `agents/src/settings/station-scene.ts` | CREATE |
| `agents/src/scene-manager.ts` | CREATE |
| `agents/src/tiles/workstation.ts` | CREATE |
| `agents/src/ai/agent-state-machine.ts` | CREATE |
| `agents/src/ai/wander-behavior.ts` | CREATE |
| `agents/src/ui/interaction-panel.ts` | CREATE |
| `agents/src/ui/speech-bubble.ts` | CREATE |
| `agents/src/ui/bubble-manager.ts` | CREATE |
| `agents/src/ui/task-panel.ts` | CREATE |
| `agents/src/task-dispatcher.ts` | CREATE |
| `agents/src/data-poller.ts` | CREATE |

## Expected Output

Working ExcaliburJS RPG world with all 10 features implemented. Agents wander, interact via click, show bubbles, accept tasks, and live in themed settings.
