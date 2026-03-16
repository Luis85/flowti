# Excalibur RPG Environment Phase B2 — Pixel-Art Agents, Room Life, Full Integration

**Date**: 2026-03-16
**Status**: Approved
**Scope**: Comprehensive improvement to the ExcaliburJS agent world — pixel-art characters, room distribution, end-to-end panel integration, visual polish
**Iteration**: 5 — Agent World (Phase B, continued)
**Depends on**: `2026-03-16-excalibur-rpg-environment-design.md` (Phase B1 — foundation)

## Problem

Phase B1 delivered the structural foundation: scenes, brain state machine, data layer, panel framework, and CLI API endpoints. But the world feels empty and disconnected:

1. **Agents are circles** — the avatar-style rendering doesn't convey RPG character identity. No poses, no animation, no mood expression.
2. **Rooms are empty** — agents only appear in the hub. Office, Village, and Station scenes have workstations but no agents. The domain-to-room routing logic is missing.
3. **Panel actions don't work end-to-end** — Talk/Tasks/Permissions tabs have UI but the game-side doesn't close the loop (brain transitions, visual feedback, bubble responses).
4. **No live reconciliation** — the `onStateDiff` callback is a stub. Poll results don't update agent visuals or spawn/despawn actors.
5. **Visual atmosphere is minimal** — scenes have dark backgrounds but no themed decoration or personality.

## Decision

### 1. Pixel-Art Agent Rendering

Replace the circle-with-initials avatar with a **24x32 pixel character** drawn via Canvas. Each agent gets a cached Canvas graphic per brain state.

**Base character**: 3-color palette derived from status. Head (4x4 pixels), body (6x8), arms (2px lines), legs (2px lines). Hair/hat color derived from a hash of the agent name for visual distinction between agents.

**Color mapping by status**:
- `busy` — green tones (#22c55e body, darker limbs)
- `idle` — blue tones (#3b82f6 body, darker limbs)
- `unassigned` — gray tones (#6b7280 body, darker limbs)
- `waiting` — amber tones (#f59e0b body, darker limbs)

**Poses** (one cached Canvas per state):

| Brain State | Pose | Animation |
|---|---|---|
| `idle` | Standing, arms at sides | 1px bob up/down every 800ms |
| `wandering` | Walking cycle | 2-frame leg alternation, swap every 300ms |
| `walking-to` | Walking cycle (fast) | Same as wandering but 200ms swap |
| `working` | Seated, arms forward | Typing dots appear near hands |
| `talking` | Mouth open, arm gesture | Speech bubble attachment point active |
| `waiting` | Standing with "?" glow | Amber pulse glow around character |

**Direction**: Character canvas flips horizontally when `facingLeft` is true. The flip requires `ctx.translate(width, 0); ctx.scale(-1, 1)` before drawing to avoid clipping off the left edge of the canvas.

**Mood face** (pixel-level detail on the 4x4 head):
- `happy`/`enthusiastic` — U-shaped mouth (2 pixels)
- `neutral` — horizontal dash (2 pixels)
- `frustrated`/`angry` — inverted U mouth
- `focused` — dot eyes, flat line mouth

**Labels**: Persona name (11px) below character. AI/H badge as a small colored dot — purple (#8b5cf6) for AI, green (#10b981) for human.

**Implementation**: Each pose is an `ex.Canvas` with `cache: true`. For static poses (idle, working, waiting), the canvas is built once and never redrawn. For animated poses (wandering, walking-to), use `ex.Animation` with two `ex.Canvas` frames at the appropriate swap interval (300ms for wandering, 200ms for walking-to) — this leverages Excalibur's built-in animation system and avoids manual `flagDirty()` calls. The `AgentActor` class holds pose graphics in a map and swaps via `this.graphics.use()` on brain state change. The idle bob is handled by a small `pos.y` oscillation in `onPreUpdate`, not by redrawing the canvas.

### 2. Room Distribution & Agent Presence

**Domain-to-room mapping** uses the existing `resolveSettingForDomain()` from `config/domain-map.ts`:
- engineering/qa/devops/development/testing → Office
- design/ux/product → Village
- management/delivery/coordination → Station
- no domain / unknown → Hub only (no room assignment)

**Agent routing flow**: When `SyncSystem.onAgentsUpdated` fires with the agent roster:
1. Hub scene receives ALL agents as compact overview indicators (small circles, not full actors) — the hub is a map, not a second instance of each character
2. Each agent's domain is resolved to a room setting
3. The corresponding room scene's `spawnAgent(agent)` is called — the room holds the "real" actor with full pixel-art rendering, brain state, and interaction
4. If the agent already exists in the room, update its data instead
5. Agents without a domain appear only in the hub as full actors

**Workstation assignment**: When an agent's brain transitions to `working`:
1. Brain system calls `nearestUnoccupied()` from `movement.ts`
2. Agent walks to the workstation (walking-to state)
3. On arrival, workstation is marked occupied, agent enters working pose
4. On transition to `idle`, workstation is vacated, agent starts wandering

**Cross-scene brain**: The brain system runs on the engine's `preframe` event (already wired in `main.ts`), which fires every frame regardless of active scene. This ensures ALL registered agents are updated even when their scene is inactive. The brain system stores per-agent state (position, brain state, target) in its own map — actor positions are synced from this map when the scene becomes active. When the player enters a room, each actor's `pos` is set from the brain's stored position on the scene's `onActivate` hook, so agents appear where they should be with no loading delay.

**Agent count handling**: Each room has 12 workstations (4 cols × 3 rows). If more agents than workstations, extras wander freely in the room's open space. The hub always shows all agents in a centered grid.

### 3. Full Integration Loop

All CLI-side API endpoints exist (built in Phase B1). The remaining work is game-side wiring.

#### Talk Loop
1. User types message in Talk tab → `sendMessage(baseUrl, agentName, message)` POST
2. Optimistic update: user turn appended to chat thread immediately
3. CLI routes message to `workerManager.send()` with conversation context
4. Agent responds → CLI emits SSE `speaking` event with response text
5. Game receives SSE → `appendAgentResponse()` updates chat thread
6. Speech bubble appears on the agent character in the current scene
7. Brain transitions to `talking` state → talking pose activates

#### Task Assignment Loop
1. User clicks "Assign" on a suggested task in Tasks tab
2. If AI agent: confirmation dialog ("This will start an AI session. Continue?")
3. On confirm → `assignTask(baseUrl, agentName, task)` POST
4. CLI writes task to agent state file, emits `task-started` SSE event
5. Game receives SSE → brain transitions `idle → walking-to` (workstation target)
6. Agent walks to nearest unoccupied workstation
7. On arrival → `working` state, typing dots, thought bubble with task name
8. Eventually CLI emits `task-completed` → brain transitions to `idle`, completion bubble

#### Permission Loop
1. CLI emits SSE `requesting-permission` with tool name
2. Game receives SSE → question bubble ("?") appears on agent
3. If the player is in the same scene as the agent, panel auto-opens and switches to Permissions tab. If the player is in a different scene, a notification label appears in the hub ticker: "[AgentName] needs permission for [tool]" — the player navigates to the room and clicks the agent manually.
4. Pending permission rendered with Allow/Deny buttons
5. User clicks Allow → `grantPermission(baseUrl, name, tool, "allow")` POST
6. CLI emits `permission-granted` → brain transitions `waiting → working`
7. Question bubble dismissed, working pose resumes

#### Entity Diff Reconciliation
The `onStateDiff` callback in `sync-system.ts` (currently a stub) gets implemented:
- `diff.added` — spawn new agent actors in hub + appropriate room
- `diff.removed` — kill actors, unregister from brain/bubble systems
- `diff.changed` — read updated components, update actor visual status, trigger brain event if status component changed

#### Connection Status Indicator
Small label in the top-right corner of the hub scene:
- `LIVE` (green dot + text) when SSE EventSource is connected
- `POLLING` (amber dot + text) when SSE is disconnected, falling back to 30s poll
- Driven by `onConnectionStatus` callback from the event stream

### 4. Visual Polish & Scene Atmosphere

**Scene backgrounds** (Canvas graphic on a z=-10 floor actor):

| Scene | Floor | Grid/Pattern | Accent |
|---|---|---|---|
| Hub | `#0d1117` | Subtle gray grid lines (40px) | Radial center glow |
| Office | `#0c1524` (dark blue-gray) | Terminal-green grid (`#1a3a2a`) | Monitor glow spots at workstations |
| Village | `#15120d` (warm brown) | Cobblestone pattern (alternating rectangles) | Warm lantern glow spots |
| Station | `#080d14` (dark teal) | Hex grid pattern | Cyan accent lines at consoles |

**Workstation styles per room**: The `WorkstationActor` receives a `style: "desk" | "workbench" | "console"` property:
- `desk` (Office) — rectangular with small monitor rectangle on top
- `workbench` (Village) — wider, wood-toned, slightly irregular edges
- `console` (Station) — angular, cyan-edged, with indicator dots

**Scene transitions**: Use ExcaliburJS's built-in `FadeInOut` transition (available in v0.32):
1. Panel auto-closes if open
2. `engine.goToScene(target, { destinationIn: new ex.FadeInOut({ duration: 300 }) })` handles the fade automatically
3. No manual overlay actor needed — the engine manages the fade lifecycle and input blocking

**Activity ticker cleanup**: The ticker strips timestamps (`2026-03-16T...`), action-type prefixes (`speaking`, `thinking`), JSON/code blocks, and newlines. Shows clean text truncated to 50 chars: `[Bobby] Hey there! Sam here...`

**Back doorway**: Each room scene has a "Hub" doorway at the left edge (already structurally present in `room-scene.ts`) that navigates back to the hub scene.

## File Impact

### Modified Files (game project — `agents/`)
| File | Changes |
|---|---|
| `src/actors/agent-actor.ts` | Full rewrite: pixel-art renderer with pose map, walk cycle, mood face |
| `src/actors/workstation-actor.ts` | Add `style` property, three visual variants |
| `src/actors/doorway-actor.ts` | Minor — ensure Canvas graphic rebuild works |
| `src/scenes/hub-scene.ts` | Add connection indicator, fix ticker cleanup |
| `src/scenes/room-scene.ts` | Wire agent spawning, workstation assignment on brain state change, sync positions from brain on `onActivate` |
| `src/scenes/office-scene.ts` | Pass `style: "desk"` to room factory |
| `src/scenes/village-scene.ts` | Pass `style: "workbench"` to room factory |
| `src/scenes/station-scene.ts` | Pass `style: "console"` to room factory |
| `src/systems/sync-system.ts` | Implement `onStateDiff`, add agent-to-room routing in `onAgentsUpdated` |
| `src/systems/brain-system.ts` | Wire workstation occupy/vacate on state transitions |
| `src/systems/bubble-system.ts` | Minor — verify task/permission bubbles work |
| `src/main.ts` | Add scene transition fade, wire connection indicator, fix panel auto-open |
| `src/ui/agent-panel.ts` | Wire tab switching from external trigger (for permission auto-open) |
| `src/ui/tasks-tab.ts` | Add confirmation dialog, wire brain transition on assign |

### New Files
| File | Purpose |
|---|---|
| `src/actors/pixel-sprites.ts` | Pixel-art drawing functions: `drawIdlePose`, `drawWalkFrame`, `drawWorkingPose`, `drawTalkingPose`, `drawWaitingPose`. Pure Canvas2D, no ExcaliburJS dependency. |
| `src/actors/scene-backgrounds.ts` | Background drawing functions per scene theme: `drawOfficeFloor`, `drawVillageFloor`, `drawStationFloor`. Pure Canvas2D. |
| `tests/actors/pixel-sprites.test.ts` | Verify each pose function produces canvas of correct dimensions |
| `tests/actors/scene-backgrounds.test.ts` | Verify each background function runs without error |

### Modified Files (CLI project — `src/`)
None — all CLI-side API work was completed in Phase B1.

## Testing Strategy

**Unit tests** (pure functions, no ExcaliburJS):
- `pixel-sprites.ts` — verify each pose function produces a canvas of correct dimensions (not visual verification, just structural)
- `scene-backgrounds.ts` — verify each background function runs without error

**Existing tests** (verify no regressions):
- Brain state machine tests (agent-brain.test.ts) — already passing
- Movement resolution tests (movement.test.ts) — already passing
- State store diff tests (state-store.test.ts) — already passing
- API client tests (api-client.test.ts) — already passing
- UI tab tests (agent-panel.test.ts, talk-tab.test.ts, tasks-tab.test.ts, permissions-tab.test.ts) — already passing

**Integration verification** (manual):
- Start CLI + dashboard, verify agents appear in hub with pixel-art style
- Click doorway, verify fade transition and agents in room
- Click agent, verify panel opens with RPG data
- Send message via Talk tab, verify response arrives
- Assign task, verify agent walks to workstation and enters working pose

## Success Criteria

1. Agents render as pixel-art characters with distinct poses per brain state
2. Rooms are populated — entering Office shows engineering agents at desks
3. Talk/Tasks/Permissions tabs produce real effects with visual feedback
4. Poll reconciliation spawns/despawns/updates agents correctly
5. Scene transitions fade smoothly
6. Activity ticker shows clean, readable text
