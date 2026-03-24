---
type: IterationPlan
name: Agent World
number: 5
status: in-progress
startDate: 2026-03-14
endDate: 2026-03-28
goal: "We can interact with our agents in an ExcaliburJS RPG world — they wander, we click-talk, we assign tasks, they express themselves with speech bubbles"
description: "Agents come alive in a 2D RPG world built on ExcaliburJS. Multiple settings (office, village, space station) host wandering agents with idle/working/talking states. Click an agent to talk or assign tasks based on their skills. Speech and thinking bubbles give agents personality. The rich agent data model (attributes, persona, mood, skills, goals) finally becomes visible."
agents:
  - Product Owner|product-owner.md
  - Software Architect|software-architect.md
  - Software Developer|software-developer.md
  - UI Designer|ui-designer.md
  - UX Designer|ux-designer.md
  - Product Designer|product-designer.md
  - Tech Lead|tech-lead.md
  - Tester|tester.md
---

# #5 — Agent World

Iterations 1-4 built the agent data model, CRUD, orchestration, brief generation, autonomous execution, and a static grid dashboard. Iteration 5 Phase A added LLM-backed agent execution (Claude CLI wrapper, sessions, streaming output). But agents are still flat circles on a grid — the rich RPG data model (attributes, persona, mood, skills, goals, behaviors) is invisible.

This iteration makes agents come alive. They inhabit a 2D RPG world with multiple settings, wander around with purpose, respond to clicks, express themselves through speech and thinking bubbles, and can be assigned tasks from within the world.

**Phase A delivered:** Autonomous agent execution (runner, session store, process infrastructure, launch flow, output display).

**Phase B delivers:** The ExcaliburJS RPG world — scenes, wandering AI, click interaction, bubbles, task assignment, visual upgrade, and setting themes.

## Goal

We can interact with our agents in an ExcaliburJS RPG world — they wander, we click-talk, we assign tasks, they express themselves with speech bubbles

## Resources

| Agent | Domain | Role in this iteration |
|-------|--------|----------------------|
| Software Architect | engineering | Scene architecture, state machine design, data model expansion |
| Software Developer | engineering | Core implementation across all phases |
| UI Designer | design | Agent visuals, setting themes, bubble design |
| UX Designer | design | Interaction panel design, click flow |
| Product Designer | design | Setting concepts, environment layout |
| Tech Lead | engineering | Wandering AI, pathfinding, state machine review |
| Tester | engineering | Integration testing, cross-scene verification |
| Product Owner | product | Acceptance, scope guardian |

## Agents

- Product Owner|product-owner.md
- Software Architect|software-architect.md
- Software Developer|software-developer.md
- UI Designer|ui-designer.md
- UX Designer|ux-designer.md
- Product Designer|product-designer.md
- Tech Lead|tech-lead.md
- Tester|tester.md

## Scope Items

### Phase A: Autonomous Agent Execution — DONE

- [x] Autonomous mode config toggle (`agents.autonomous` in types-config)
- [x] Agent runner domain (pure — `buildRunSpec`, `buildClaudeArgs`, `parseAgentOutput`)
- [x] Agent session store (markdown persistence — create, update, append, list)
- [x] Agent process infrastructure (`launchAgent`, `checkClaudeInstalled`, `writeBriefToFile`)
- [x] Agent launch flow (UI handlers — `agent:run`, `agent:run-brief`, `agents:autonomous-enabled`)
- [x] Agent output display (renderers — brief generated, spawned, output, complete, session list)

### Phase B: ExcaliburJS RPG World — DELIVERED

Phase B was delivered across 4 implementation plans, evolving from canvas-drawn shapes to full Ninja Adventure pixel-art sprites. The original B1-B10 scope items below were superseded by the actual implementation.

#### Phase B Delivery Notes

**Evolution path:**
1. **B1 Foundation** (`docs/plans/2026-03-16-excalibur-rpg-environment.md`) — CLI-side multi-listener, DashboardAgent RPG field expansion, SSE + HTTP API endpoints, world-state polling
2. **B2 Pixel-Art + Rooms** (`docs/plans/2026-03-16-excalibur-rpg-phase-b2.md`) — Canvas2D pixel-art agents, domain-to-room routing, panel integration, sync system, scene backgrounds
3. **B3 Habits + Camera** (`docs/plans/2026-03-16-excalibur-rpg-phase-b3.md`) — Personality-driven habits (computeHabits), on-break state, idle pose cycling, social facing, camera follow system
4. **Ninja Adventure Sprites** (`docs/plans/2026-03-16-ninja-adventure-sprites.md`) — Replaced programmatic pixel-art with 86 Ninja Adventure character spritesheets (16x16 at 4x scale, idle + 4-directional walk animations)

**What was built (39 source files, 19 test suites, 156 tests):**
- [x] 5 scenes: hub, office, village, station + room base class with doorway navigation
- [x] Sprite system: `sprite-loader.ts` + `character-pool.ts` (86 characters, domain-based pools)
- [x] Brain system: `brain-system.ts` with 7 states (idle, wandering, walking-to, working, on-break, talking, waiting)
- [x] Habit-driven AI: `agent-brain.ts` with `computeHabits()` — movement style, idle style, social/focus drift, break threshold, settling pause
- [x] Movement engine: `movement.ts` — resolveIdleTarget (social drift, focus drift, random wander), randomWanderPoint, workstation preference
- [x] Bubble system: `bubble-system.ts` + `bubble-actor.ts` — speech, thought, question bubbles with queue and auto-dismiss
- [x] Talk engine: `talk-engine.ts` — ambient personality-driven idle quotes
- [x] Camera system: `camera-system.ts` — click-to-follow, cross-room tracking, scroll zoom
- [x] Panel UI: Lit-based `agent-panel.ts` with 5 tabs (info, talk, tasks, permissions, history)
- [x] Store: `dashboard-store.ts` — reactive state management for all UI
- [x] Sync system: `sync-system.ts` — SSE event stream, 30s world-state polling, dashboard boot
- [x] API client: `api-client.ts` — POST /api/agent/send, /api/agent/task, /api/agent/permission
- [x] Event stream: `event-stream.ts` — SSE with exponential backoff reconnection
- [x] Workstation actors with occupy/vacate lifecycle
- [x] Scene backgrounds: canvas-drawn themed environments per room
- [x] Roster bar + camera HUD + dashboard overlays
- [x] Domain-to-room mapping: `domain-map.ts` with `resolveSettingForDomain()`

**Key architectural decisions that evolved from original plan:**
- Sprites replaced canvas-drawn characters (B3 visual upgrade)
- Lit web components replaced raw HTML panels (B6 click-to-interact)
- Brain system is centralized (runs all agents from engine preframe), not per-actor state machines (B5)
- Habits derived from GURPS attributes at spawn time, not runtime (B3 reimagined)
- Talk engine handles ambient quotes separately from bubble system (B7 split)

### Storybook CLI Integration

- [x] Version-agnostic scaffold (replace pinned `^8.6.0` / `^10.0.0` with `"latest"`)
- [x] Non-interactive CLI commands (`storybook:install`, `storybook:start`, `storybook:stop`, `storybook:build`, `storybook:generate`)
- [x] `startStorybookDev()` non-interactive service function
- [x] Post-init config patching for Storybook 10 format
- [x] `npm install` before `storybook init` for framework detection
- [x] `--type` flag for explicit framework detection
- [x] Missing `node_modules` detection with helpful error message
- [x] `storybook:install` must not clobber existing TUI component files

**Remaining gaps (see refinement-2026-03-17-agent-world.md):**
- [ ] Data export: game-side DashboardAgent missing `goals`, `behaviors`, `project`, `iteration`, `phase`
- [ ] World state reconciliation: `onStateDiff` handler is a stub
- [ ] Task execution: visual-only, no actual CLI agent runner integration
- [ ] ~~Game feel: no particles, emotes, or workstation glow~~ — DEFERRED to Iteration 6
- [ ] ~~Social interaction: facing only, no proximity conversations~~ — DEFERRED to Iteration 6
- [ ] ~~Interactive waiting: agents make small talk while LLM generates~~ — DEFERRED to Iteration 6

### Phase D: BT→Brain Autonomous Behavior — DONE (verified 2026-03-22)

- [x] Wire `seek-food` BT action → Brain TRANSITIONS
- [x] Wire `seek-drink` BT action → Brain TRANSITIONS
- [x] Wire `seek-rest` BT action → Brain TRANSITIONS
- [x] Wire `seek-merchant` BT action → Brain TRANSITIONS
- [x] Wire `seek-agent` BT action → Brain TRANSITIONS
- [x] Wire `seek-quiet` BT action → Brain TRANSITIONS
- [x] Wire `break` BT action → Brain TRANSITIONS

### Phase E: Brain-Initiated LLM Sessions — NEW (from review #3)

LLM session lifecycle must be decoupled from user selection. The brain/BT must be able to acquire and use an LLM session autonomously when an agent self-assigns a task or receives one while not selected.

- [ ] Brain can request LLM session via worker manager when BT evaluates "execute-task"
- [ ] Multiple agents can hold active LLM sessions concurrently (respect `maxConcurrent`)
- [ ] Decay timer applies to brain-initiated sessions same as user-initiated
- [ ] Decouple session acquisition from `spawnWorker()` — make it available to any spawned worker on demand

### Live Testing & Validation — NEW (from review #3)

- [ ] Live test: LLM persistent sessions (priming, session reuse, decay, re-acquisition)
- [ ] Live test: Task & Economy engine (XP rewards, coin flow, trust progression)
- [ ] Live test: Interaction templates (click-to-interact end-to-end)
- [ ] Live test: Agent World visual overhaul (BT sync, debug, merchant)

### Phase C: CLI-Plugin Unified Architecture — NEW (from increment review)

**Vision:** CLI is the orchestrator, Plugin is the UI on top. CLI bundled with Plugin on build.

#### C0: Plugin Hardening — DONE (verified 2026-03-24)
- [x] Harden Plugin view lifecycle (edge cases, error recovery, graceful degradation)

#### ~~C1: TUI Regression Fix~~ — DROPPED (TUI removed by design, Plugin is sole UI)

#### ~~C2: CLI Bundling~~ — DROPPED (infrastructure, deferred to next iteration)

#### ~~C3: Flowti CLI View (Main Entry Point)~~ — DEFERRED to Iteration 6 (multi-week scope, 4 days remaining)
- [ ] Dedicated Flowti CLI View in Obsidian — main user interface for CLI
- [ ] CLI Hub tab — easy-to-access features, primary entry point
- [ ] Raw terminal tab — emulates terminal for direct CLI interaction
- [ ] Agents Hub tab — agent management, launch, monitoring
- [ ] Projects Hub tab — project management, build, test, reports
- [ ] Plugin can execute ALL CLI functions and display output in this view

#### ~~C4: Skill Execution from Plugin~~ — DEFERRED to Iteration 6
- [ ] Ribbon icon / button to launch skill picker
- [ ] Skill picker lists available skills from agent roster / skill map
- [ ] CLI-Plugin bidirectional streaming (LLM output → Plugin, user input → CLI)
- [ ] Interactive modal for LLM conversation (display output, present questions, accept input)
- [ ] Output persistence (session transcript / artifacts saved)

#### ~~C5: Storybook Integration (Reworked)~~ — DROPPED (not agent world)

---

### Meta (Phase Gate)

- [x] Refine goal and vision
- [x] Identify initial scope items
- [x] Push the Plan to Git
- [x] Kick-off communication
- [x] Verify all prerequisites are met
- [x] Assign resources and capacity
- [x] Break scope into actionable tasks
- [x] Push the Plan to Git
- [ ] Assist with tasks
- [ ] Run all Reports once finished and review results
- [ ] Flag blockers early
- [ ] Track progress daily

## Dependency Graph

```
B1: Enhanced Data Export (foundation)
  ↓
B2: Scene Manager & Settings ──→ B4: Workstation Tiles
  ↓                                    ↓
B3: Agent Visual Upgrade         B5: Agent Wandering AI ──→ B7: Speech Bubbles
  ↓                                    ↓
  └────────────────────────→ B6: Click-to-Interact
                                       ↓
                               B8: Task Assignment ──→ B9: Live Status Updates

B10: Setting Themes (parallel with B4+)
```

**Execution order:**
1. B1 (Enhanced Data Export) — unblocks everything
2. B2 (Scene Manager) + B3 (Visual Upgrade) — can run in parallel
3. B4 (Workstations) + B10 (Themes) — depend on B2, can parallel
4. B5 (Wandering AI) — depends on B2 + B3
5. B6 (Click-to-Interact) — depends on B3 + B5
6. B7 (Bubbles) — depends on B5
7. B8 (Task Assignment) — depends on B6 + B7
8. B9 (Live Updates) — depends on B8

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-24 | in-progress | in-progress | Three Amigos review #2 — C0 done, C3+C4 formally deferred to Iteration 6, priority: live testing → B gaps → E (attempt), data export AC under review |
| 2026-03-22 | in-progress | in-progress | Three Amigos review — Phase D marked done, Phase E stays in scope, deferred stretch goals + C4 to Iteration 6, prioritized live testing → E → B gaps → C0 → C3 |
| 2026-03-20 | in-progress | in-progress | Increment review #2 — Phase A + Storybook accepted, Phase B accepted-with-notes (needs polish), G1-G6 carry over for design, Cursor CLI integration requirement filed |
| 2026-03-17 | in-review | in-progress | Increment review — 0/3 phases accepted, added Phase C (CLI-Plugin integration), 2 critical bugs filed |
| 2026-03-17 | in-progress | in-review | Increment review ceremony initiated |
| 2026-03-16 | in-progress | in-progress | Iteration planning ceremony — Phase A complete, Phase B (RPG World) committed with 10 scope items across 8 agents |
| 2026-03-15 | ready | in-progress | Advanced to in-progress |
| 2026-03-15 | planned | ready | Advanced to ready |
| 2026-03-15 | new | planned | Advanced to planned |

## Notes

### Iteration Planning Ceremony (2026-03-16)

**Phase A retrospective:** Autonomous agent execution delivered cleanly — 6 phases, all tests passing. Agent runner (pure domain), session store (markdown persistence), and process infrastructure (IShell wrapper) follow all architecture rules. The `--prompt-file` approach to Claude CLI integration works well.

**Phase B vision:** The ExcaliburJS RPG world is a major UX leap. The existing dashboard (Iteration 4) shows agents as colored circles in a static grid. Phase B transforms this into an interactive world where agents have presence, personality, and purpose.

**Key architecture decisions:**

1. **Canvas-drawn everything** — No sprite images or asset pipeline. All characters, workstations, and environments are drawn with ExcaliburJS canvas API (circles, rects, lines, text). This keeps the zero-external-dependency philosophy and makes iteration fast.

2. **Domain-to-setting mapping** — Agents are distributed across settings based on their `domain` field: engineering→office, design→village, product/management→station. This creates natural clustering while keeping all agents accessible via scene switching.

3. **State machine for agent behavior** — Clean separation of states (idle, wandering, walking-to, working, talking) with enter/update/exit hooks. The state machine lives alongside the actor, not inside it — testable and composable.

4. **HTML overlay for interaction panels** — Rather than building a full UI framework inside ExcaliburJS, the interaction panel is an HTML div positioned relative to the canvas. This gives us standard CSS styling, text input for chat, and button interactions without fighting the game engine.

5. **Simulated task execution** — Task assignment in the world is visual. When you assign a task, the agent walks to a workstation, shows a thinking bubble for 5-15s, then reports "Done!". Actual CLI execution (spawning Claude CLI) remains in the terminal. This keeps the world as a visualization layer, not an execution layer.

6. **Rich data model finally surfaces** — `AgentDefinition` already has attributes, persona, mood, personality, behaviors, goals, inventory, experience. Phase B1 pipes all of this into `agent-dashboard.json` so the world can render the full agent identity.

**Risks:**
- Canvas-drawn environments may look too simple — mitigate with good color palettes and consistent visual language
- Wandering AI needs tuning to look natural (not jittery or robotic) — use easing, random pauses, separation forces
- 19 agents across 3 scenes may cause some scenes to feel empty — consider allowing scene reassignment or having agents visit other scenes
- HTML overlay interaction panel needs careful canvas-to-screen coordinate mapping — ExcaliburJS provides `engine.worldToScreenCoordinates()`

**Existing foundation leveraged:**
- `AgentDefinition` type with full RPG fields (attributes, persona, mood, personality, goals, behaviors, inventory)
- `agent-export.ts` data pipeline + `agent-dashboard.json` output
- `dashboard-service.ts` build + serve lifecycle
- ExcaliburJS project structure (build.mjs, tsconfig, package.json)
- `AgentActor` class with canvas drawing and pulse animation
- Scene management via `ex.Engine.addScene()` / `goToScene()`
