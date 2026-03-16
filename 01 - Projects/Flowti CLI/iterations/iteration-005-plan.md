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

### Phase B: ExcaliburJS RPG World

#### B1. Enhanced Data Export (foundation)

Expand `DashboardAgent` to surface the rich agent model to the ExcaliburJS world.

**Modify** `src/domain/agents/agent-export.ts`:
- [ ] Add to `DashboardAgent`: `persona`, `mood`, `attributes` (STR/INT/WIS/CHA/DEX/CON), `personality` (string[]), `skills` (name+level[]), `suggestedTasks` (name+phases[]), `experience`, `currentTask` (string, derived from active brief/session)
- [ ] Update `buildDashboardAgent()` to map these fields from `AgentSummary`
- [ ] Derive `currentTask` from active session or brief for this agent

**Modify** `agents/src/data-loader.ts`:
- [ ] Update `DashboardAgent` interface to match new export fields
- [ ] Add `AgentAttributes`, `AgentSkillEntry`, `AgentTask` interfaces

**Test** `tests/domain/agents/agent-export.test.ts` (update):
- [ ] Verify persona, mood, attributes, skills included in export
- [ ] Verify currentTask derived from active session
- [ ] Verify empty/missing fields have safe defaults

**Acceptance:** `agent-dashboard.json` includes all RPG fields for every agent. Dashboard types match.

---

#### B2. Scene Manager & Settings

Replace single grid scene with a multi-scene world — three distinct settings agents can inhabit.

**Create** `agents/src/settings/setting-config.ts`:
- [ ] Define `SettingConfig` — name, displayName, description, bounds (width/height), spawnPoints (Vector[]), workstationSlots ({pos, label, type}[]), backgroundColor, themeColors
- [ ] Define 3 presets: `OFFICE_SETTING`, `VILLAGE_SETTING`, `STATION_SETTING`
- [ ] Export `ALL_SETTINGS` registry and `getSettingForAgent(domain)` — maps agent domain to default setting (engineering→office, design→village, product/management→station)

**Create** `agents/src/settings/base-scene.ts`:
- [ ] Abstract `BaseWorldScene extends ex.Scene` — shared logic: agent placement from data, workstation rendering, background drawing, scene label HUD
- [ ] `setAgents(agents: DashboardAgent[])` — filter and place agents in this scene
- [ ] `drawSettingBackground(gfx)` — abstract, implemented per setting
- [ ] `getWorkstations()` — returns workstation actors for this setting

**Create** `agents/src/settings/office-scene.ts`:
- [ ] Extends `BaseWorldScene` — cool gray palette, desk rows, monitor rectangles, coffee machine corner, meeting room area, whiteboard on wall
- [ ] Canvas-drawn environment (no image assets — shapes + labels, consistent with MVP approach)

**Create** `agents/src/settings/village-scene.ts`:
- [ ] Extends `BaseWorldScene` — warm earth palette, cobblestone ground, workshop building, forge area, library with book stacks, market square with stalls

**Create** `agents/src/settings/station-scene.ts`:
- [ ] Extends `BaseWorldScene` — dark blue/purple, neon accents, command bridge, lab benches, engineering bay, med bay, viewport with starfield

**Create** `agents/src/scene-manager.ts`:
- [ ] `SceneManager` class — registers all 3 scenes with engine, distributes agents by domain mapping
- [ ] `switchScene(settingName)` — transition with optional fade
- [ ] HUD overlay: setting name + navigation arrows/buttons to cycle settings

**Modify** `agents/src/main.ts`:
- [ ] Replace single `AgentScene` with `SceneManager` setup
- [ ] Load data → distribute agents → start at office scene
- [ ] Add keyboard shortcuts for scene cycling (Left/Right arrows)

**Acceptance:** Three distinct scenes with domain-based agent distribution. Arrow keys switch scenes. Each setting has a unique visual identity drawn with canvas shapes.

---

#### B3. Agent Visual Upgrade

Replace status circles with character representations that show personality.

**Modify** `agents/src/agent-actor.ts`:
- [ ] Replace circle drawing with character body: head (circle), torso (rounded rect), simple limbs — all canvas-drawn, no sprites
- [ ] Color body based on domain (engineering=blue, design=purple, product=green, management=orange)
- [ ] Show persona name above head (or agent name if no persona)
- [ ] Mood indicator: small emoji/icon next to name (maps mood string to icon)
- [ ] Direction facing: flip body horizontally based on movement direction
- [ ] Status badge: small colored dot (busy=green, idle=blue, working=yellow, talking=white)
- [ ] Idle animation: subtle breathing (scale oscillation on torso)

**Acceptance:** Agents look like characters, not circles. Mood and status are visible at a glance. Direction changes with movement.

---

#### B4. Workstation Tiles

Interactive furniture that agents walk to when working.

**Create** `agents/src/tiles/workstation.ts`:
- [ ] `Workstation extends ex.Actor` — canvas-drawn furniture piece with label, type icon, occupied indicator
- [ ] Types: `desk` (office), `anvil` (village), `console` (station) — drawn differently per type
- [ ] `occupy(agent)` / `vacate()` — track which agent is using this workstation
- [ ] Visual: glow or highlight when occupied, dim when empty
- [ ] Position defined by setting config (workstationSlots)

**Acceptance:** Each scene has 4-6 workstations. Agents walk to them when assigned work. Occupied workstations glow.

---

#### B5. Agent Wandering AI

Agents move around their scene with purpose using a state machine.

**Create** `agents/src/ai/agent-state-machine.ts`:
- [ ] Define states: `idle`, `wandering`, `walking-to`, `working`, `talking`
- [ ] State transitions: idle→wandering (random timer), wandering→idle (reached target), idle→walking-to (task assigned), walking-to→working (reached workstation), working→idle (task done), idle→talking (clicked), talking→idle (conversation ended)
- [ ] Each state has `enter()`, `update(delta)`, `exit()` hooks
- [ ] Expose `currentState`, `transitionTo(state)`, `update(delta)`

**Create** `agents/src/ai/wander-behavior.ts`:
- [ ] Random target selection within scene bounds (respecting spawn area)
- [ ] Configurable pause duration at target (2-5s), wander speed (30-60 px/s)
- [ ] Avoid overlapping with other agents (simple separation force)
- [ ] Prefer areas near workstations and gathering points

**Modify** `agents/src/agent-actor.ts`:
- [ ] Integrate state machine — call `stateMachine.update(delta)` in `onPreUpdate`
- [ ] Use `ex.Actor.actions.moveTo()` for smooth movement
- [ ] Update facing direction based on movement vector
- [ ] Trigger animations per state (breathing idle, walking bob, working focus)

**Acceptance:** Agents wander naturally within their scene. They pause, change direction, avoid each other. Busy agents prefer workstations. Movement looks smooth and purposeful.

---

#### B6. Click-to-Interact System

Click an agent to open an interaction panel with talk, task assignment, and stats.

**Create** `agents/src/ui/interaction-panel.ts`:
- [ ] HTML overlay panel (positioned relative to canvas, not ExcaliburJS-internal) showing:
  - Agent name / persona, role, domain
  - Mood, personality traits
  - Attributes as a mini stat bar (STR/INT/WIS/CHA/DEX/CON)
  - Action buttons: Talk, Assign Task, View Stats, Close
- [ ] Panel follows agent position (anchored above head)
- [ ] Click outside panel or Close button dismisses it
- [ ] Only one panel open at a time

**Modify** `agents/src/agent-actor.ts`:
- [ ] Add `pointerdown` event handler — opens interaction panel, transitions agent to `talking` state
- [ ] Selection highlight ring around clicked agent
- [ ] Emit custom event `agent-selected` with agent data

**Acceptance:** Clicking any agent opens a styled panel with their info and action buttons. Panel tracks agent position. Only one panel at a time.

---

#### B7. Speech & Thinking Bubbles

Agents express themselves with floating text overlays.

**Create** `agents/src/ui/speech-bubble.ts`:
- [ ] `SpeechBubble` — canvas-drawn rounded rect with triangular tail pointing to agent, text inside, auto-wraps long text
- [ ] Auto-dismiss after configurable duration (3-5s)
- [ ] `showSpeech(agent, text, duration?)` — attach bubble above agent head
- [ ] `showThinking(agent, text?)` — cloud-style bubble with "..." dots animation (three dots cycling)

**Create** `agents/src/ui/bubble-manager.ts`:
- [ ] Manages active bubbles, handles cleanup on dismiss
- [ ] Random idle quotes: agents occasionally say things from their personality/mood (e.g., "Reviewing the architecture..." for an architect, "Running tests..." for a tester)
- [ ] Queue system — if agent has pending bubble, wait for current to dismiss

**Modify** `agents/src/agent-actor.ts`:
- [ ] Integrate bubble manager — show thinking bubble when `working`, speech bubble when `talking`
- [ ] On state transitions, trigger appropriate bubble

**Acceptance:** Agents show speech bubbles when talked to, thinking bubbles when working. Idle agents occasionally show personality-driven quotes. Bubbles auto-dismiss.

---

#### B8. Task Assignment from World

Select a task from agent's skills and dispatch it within the world.

**Create** `agents/src/ui/task-panel.ts`:
- [ ] Sub-panel of interaction panel — lists agent's `suggestedTasks` as clickable buttons
- [ ] Each task shows name and relevant phases
- [ ] Clicking a task: closes panel, agent walks to nearest available workstation, enters `working` state, shows thinking bubble with task name

**Create** `agents/src/task-dispatcher.ts`:
- [ ] `dispatchTask(agent, task)` — triggers agent state transition: talking→walking-to→working
- [ ] Working state duration: 5-15s (simulated — visual demo, not actual CLI execution)
- [ ] On completion: agent shows speech bubble "Done: {task}!", returns to idle wander
- [ ] Track assigned tasks per agent for the session

**Acceptance:** Can assign any of an agent's suggested tasks from the interaction panel. Agent visibly walks to workstation, works with thinking bubble, completes with speech bubble.

---

#### B9. Live Status Updates

Agent status changes reflected in the world without full page refresh.

**Create** `agents/src/data-poller.ts`:
- [ ] Periodic re-fetch of `agent-dashboard.json` (default: 30s interval, configurable)
- [ ] Diff detection: compare new data with current — identify status changes, new agents, removed agents
- [ ] On status change: trigger state machine transition, show speech bubble announcing change (e.g., "I'm now busy on Iteration #5!")
- [ ] On new agent: spawn into appropriate scene with entrance animation

**Acceptance:** Dashboard auto-refreshes data. Status changes from CLI (e.g., assigning agent to iteration) appear in world within 30s. Speech bubbles announce transitions.

---

#### B10. Setting Themes

Visual theming per setting with distinct atmosphere.

**Enhance** `agents/src/settings/office-scene.ts`:
- [ ] Color palette: cool grays (#1a1a2e, #2d2d44), accent blue
- [ ] Floor grid pattern, fluorescent light strips on ceiling
- [ ] Decorative: potted plants (green circles), whiteboard (white rect with scribble lines), coffee machine
- [ ] Ambient: subtle vignette around edges

**Enhance** `agents/src/settings/village-scene.ts`:
- [ ] Color palette: warm earth (#2d1b0e, #4a3523), accent amber
- [ ] Cobblestone ground pattern (small gray/brown circles), grass edges
- [ ] Decorative: trees (green triangles on brown rects), torch lights (yellow glow circles), wooden signs
- [ ] Ambient: warm gradient sky at top

**Enhance** `agents/src/settings/station-scene.ts`:
- [ ] Color palette: deep blue/purple (#0a0a2e, #1a1a3e), neon cyan accents
- [ ] Metal floor plate pattern, glowing panel lines
- [ ] Decorative: viewport window with starfield (random white dots), control panels (colored rectangles), holographic displays
- [ ] Ambient: scanline overlay effect

**Acceptance:** Each setting has a distinct visual identity. Walking into a scene immediately communicates the theme. No image assets — all canvas-drawn.

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
