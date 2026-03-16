# ExcaliburJS RPG Phase B3 — Agent Habits & Camera Follow

**Date**: 2026-03-16
**Phase**: Iteration 5, Phase B3
**Branch**: `feat/iter-5/excalibur-rpg-phase-b3`
**Depends on**: Phase B2 (pixel-art agents, room scenes, brain FSM, panel system)

## Goal

Make agents feel alive through personality-driven habits and observable routines, then give the player a camera system to follow and watch them. Agents should read as characters with inner lives — not task executors waiting for input.

## Scope

Two chunks:

- **Chunk A — Agent Habits** (8 features): personality-derived movement, idle behaviors, break routines, social proximity, mood-reactive pacing
- **Chunk B — Camera & Follow** (4 features): click-to-follow, cross-room tracking, scroll zoom, HUD indicator

## Non-Goals

- No hidden needs/desires engine (no hunger, rest, stimulation meters)
- No relationship tracking or affinity scores
- No agent-to-agent dialogue or chat
- No proactive task self-assignment
- No sound, particles, or day/night cycle
- No minimap or free-camera WASD pan
- No agent room transitions (agents stay in their domain-assigned room)

---

## Chunk A: Agent Habits

### A1. Habit Data Model

Habits are derived from existing agent attributes at spawn time. No new persistence — held in memory as part of the brain state.

```typescript
interface AgentHabits {
  preferredWorkstationId: string | null;  // Remembers last used, sticky across tasks
  homeRoom: string;                        // Domain-mapped room (office/village/station)
  movementStyle: 'deliberate' | 'brisk' | 'darting';  // DEX bracket
  idleStyle: 'fidgety' | 'calm' | 'restless';         // CON bracket
  socialDrift: number;                     // 0–1 from CHA
  focusDrift: number;                      // 0–1 from INT
  breakThreshold: number;                  // Seconds of sustained work before break (CON)
  settlingPause: number;                   // ms pause before starting work (WIS)
}
```

**Derivation** (new `computeHabits()` function, separate from existing `computeParams()`):

| Field | Source | Formula |
|-------|--------|---------|
| `movementStyle` | DEX | 1–7 → deliberate, 8–13 → brisk, 14–20 → darting |
| `idleStyle` | CON | 1–7 → fidgety, 8–13 → restless, 14–20 → calm |
| `socialDrift` | CHA | `CHA / 20` (0.05–1.0) |
| `focusDrift` | INT | `INT / 20` (0.05–1.0) |
| `breakThreshold` | CON | `10 + CON * 2` (12–50 seconds) |
| `settlingPause` | WIS | `200 + WIS * 50` (250–1200 ms) |
| `homeRoom` | domain | Existing `resolveSettingForDomain()` |
| `preferredWorkstationId` | runtime | Set on first workstation occupy, sticky thereafter |

**Relationship to `BrainParams`**: `computeParams()` continues to produce the existing `BrainParams` (speedMultiplier, socialRadius, focusDuration, idleResistance, quoteFrequency). `computeHabits()` produces `AgentHabits` as a separate object. The `movementStyle` speed multipliers (0.7x, 1.0x, 1.4x) **replace** the continuous `speedMultiplier` when resolving movement speed in brain-system. `breakThreshold` **supplements** `focusDuration` — focus duration governs maximum work time before returning to idle, break threshold governs when a break interrupts active work (break fires first if shorter). `socialDrift` replaces `socialRadius` for idle target selection.

**Storage**: `AgentBrainEntry` in `brain-system.ts` gains a `habits: AgentHabits` field. The `register()` method calls both `computeParams()` and `computeHabits()`.

**Files modified**: `agent-brain.ts` (add `computeHabits()`), `brain-system.ts` (store habits on entry, call `computeHabits()` in `register()`)
**Files added**: None — `AgentHabits` interface lives in `brain-types.ts`

### A2. Personality-Driven Movement

Replace random wander targets with personality-weighted target selection.

**Movement speed** (from `movementStyle`):

| Style | Speed multiplier | Pause between moves |
|-------|-----------------|-------------------|
| `deliberate` | 0.7x | 2–4s |
| `brisk` | 1.0x | 1–2s |
| `darting` | 1.4x | 0.3–1s |

**Idle target selection** (replaces pure random wander in `movement.ts`):

When the idle timer fires, resolve target in priority order (first match wins):

1. **Social drift** — roll against `socialDrift`. Hit → target nearest other agent's position, offset 30px (stand nearby, not on top)
2. **Focus drift** — roll against `focusDrift`. Hit → target furthest corner from any other agent
3. **Fallback** — random wander within current room bounds (existing behavior)

Social drift and focus drift are mutually exclusive checks — a high-CHA agent usually drifts toward others; a high-INT agent usually seeks solitude. Mid-stat agents feel natural — sometimes social, sometimes alone.

Note: agents do not move between rooms in this phase. Home-room pull (targeting doorways) is deferred to a future phase that adds room-transition mechanics.

**New pure function**: `resolveIdleTarget(habits, nearbyAgents, roomBounds, rng): Position | null` in `movement.ts` — returns target position or `null` for "stay put"

**Files modified**: `movement.ts`, `brain-system.ts` (call new resolver instead of random wander)

### A3. Idle Pose Variations

Replace static idle bob with personality-driven pose cycling.

**New pixel-art poses** in `pixel-sprites.ts`:

- `drawLookAroundPose` — head offset 2px left/right, body same as idle
- `drawStretchPose` — arms raised (limbs repositioned), body 2px taller

**Idle sub-state cycle** (driven by `idleStyle`, visual-only — no new brain states):

| Style | Cycle | Timer per pose |
|-------|-------|---------------|
| `fidgety` | idle → look-around → stretch → idle | 3–6s |
| `calm` | idle → (long hold) → look-around → idle | 8–15s |
| `restless` | idle → look-around → idle → look-around → stretch | 5–10s |

Implementation: `idlePoseTimer` and `idlePoseIndex` stored on `AgentBrainEntry` in `brain-system.ts` (consistent with how `stateTimer` works — brain system owns all per-agent state, actor is purely visual). The system ticks the timer when state is `idle` and not moving, cycles through the pose sequence, and calls `actor.setIdlePose(poseIndex)` to update the visual.

**Files modified**: `pixel-sprites.ts` (2 new pose functions), `agent-actor.ts` (add `setIdlePose()` method), `brain-system.ts` (idle pose timer + cycle on `AgentBrainEntry`)

### A4. Break Routines

After sustained work, agents take visible breaks.

**Trigger**: Agent in `working` state for longer than `breakThreshold` seconds.

**Sequence**:
1. Vacate workstation
2. Walk to random non-workstation point in room
3. Enter idle pose cycle for 5–10s (the "break")
4. Walk back to **preferred workstation** (falls back to nearest if preferred is occupied)
5. Resume `working` if task still active, otherwise stay `idle`

**Workstation memory**: On occupy, `preferredWorkstationId` updates to that station's ID. On next task, `resolveWorkstationTarget()` checks preferred first.

**Settling pause**: On arrival at workstation, agent holds idle pose for `settlingPause` ms before switching to working pose.

**Implementation**: Add `on-break` as a new brain state in the `BrainState` union type. This is cleaner than a parallel timer system that manually overrides the FSM. The break state integrates naturally with the existing transition table and `updateFromBrain()` in the agent actor.

Transitions:
- `working` → (breakThreshold timer) → `on-break` (vacate workstation, set random target point)
- `on-break` → (arrival at break point) → hold idle pose cycle for 5–10s
- `on-break` → (hold timer expires) → `walking-to` (target = preferred workstation)
- `walking-to` → (arrival) → `working` (if task active) or `idle` (if task done)

**`on-break` update loop behavior**: The `on-break` case in `BrainSystem.update()` has two sub-phases, tracked by a `breakPhase` field on `AgentBrainEntry`: (1) `moving` — reuses existing movement logic to walk the agent toward the random break-point target; on arrival (distance < 4px), switches to phase 2. (2) `resting` — starts a 5–10s timer; agent plays idle pose cycle; on timer expiry, transitions to `walking-to` with preferred workstation as target.

The `Workstation` interface in `movement.ts` gains an `id: string` field for preferred workstation tracking. `WorkstationActor` gets a `workstationId: string` property (not shadowing ExcaliburJS's numeric `Actor.id`). IDs are generated as `${roomName}-${index}` (e.g., `office-0`, `village-3`) at scene creation time.

**Files modified**: `brain-types.ts` (add `on-break` to `BrainState`), `agent-brain.ts` (break transition), `brain-system.ts` (break timer + sequence), `movement.ts` (preferred workstation resolver, `Workstation.id` field), `agent-actor.ts` (on-break pose mapping)

### A5. Social Proximity — Facing

When two idle agents are within 40px of each other, they face each other and hold position briefly.

**Behavior**:
- Scan for agent pairs within 70px threshold (agents are 48px wide; 40px would require near-overlap)
- Both agents flip to face each other (existing direction-flip logic)
- Both hold position for 3–5s
- Resume normal idle cycle

This is a lightweight check in `brain-system.ts`'s update loop. No new brain states, no chat — just body language that reads as a social moment.

**Files modified**: `brain-system.ts` (~20 lines — proximity scan + facing + hold timer)

### A6. Mood-Reactive Pacing

Agent mood (already in dashboard data) applies multipliers to movement and work timers.

| Mood | Idle duration | Movement speed | Work duration | Social drift |
|------|--------------|----------------|---------------|-------------|
| `happy` | +20% | baseline | baseline | baseline |
| `neutral` | baseline | baseline | baseline | baseline |
| `frustrated` | -30% | +15% | baseline | baseline |
| `focused` | baseline | baseline | +40% | -50% |

Note: `focused` mood has no distinct pixel-art mouth — it renders with the `neutral` mouth. The behavioral changes (longer work, less social drift) are the visible signal.

A frustrated agent visibly paces the room faster and takes shorter breaks. A focused agent stays at their workstation longer and rarely drifts toward others. A happy agent ambles and lingers. You read team mood by watching movement patterns.

**Implementation**: ~15 lines in `computeHabits()` applying mood multipliers to habit timer values. Mood is snapshot at spawn time. If mood changes during runtime (via world-state poll), `BrainSystem` exposes an `updateMood(name, mood)` method that recomputes the affected multipliers on the agent's habits without full re-registration.

**Files modified**: `agent-brain.ts` (mood multipliers in `computeHabits()`), `brain-system.ts` (add `updateMood()` method)

---

## Chunk B: Camera & Follow

### B1. Follow Mode

Click an agent to lock the camera on them.

**Click behavior**: Agent clicks serve two purposes — panel and follow. The logic:
1. First click on an agent → opens the info panel (existing behavior)
2. Clicking the same agent while its panel is already open → closes panel, starts follow mode
3. Clicking a different agent while following → stops following previous, opens panel for new agent

This gives a natural "inspect then watch" flow. Single-click = info. Double-purpose click = follow.

**Tracking**: Camera position updates every frame to center on followed agent. Uses ExcaliburJS built-in `LockCameraToActorStrategy`.

```typescript
// Follow
camera.addStrategy(new ex.LockCameraToActorStrategy(targetActor));
// Unfollow
camera.clearAllStrategies();
```

**Deactivation**: Click empty space, press Escape, or click HUD unfollow button.

### B2. Follow Persistence Across Scenes

Agents do not move between rooms in this phase. Cross-room tracking means: when the **player** navigates to a different scene (clicks a doorway), the camera system checks if the followed agent exists in the new scene. If yes, re-acquire and continue following. If not, follow mode ends automatically.

- `onSceneActivate()` searches new scene's actors for the followed agent by name
- If found: re-apply `LockCameraToActorStrategy` to the new actor reference
- If not found: call `stopFollow()`, hide HUD

**Agent despawn handling**: The camera system checks `actor.isKilled()` each frame during follow. If the followed actor is removed (e.g., entity diff reconciliation removes an agent), `stopFollow()` fires automatically.

### B3. Scroll Zoom

Mouse wheel controls zoom level.

- `wheel` event on canvas → adjust `camera.zoom` by ±0.1 per tick
- Clamp to [0.5, 2.0] range
- Smooth interpolation: time-based lerp (`lerpFactor = 1 - Math.pow(0.05, deltaMs / 1000)`) for frame-rate independence
- 0.5x = see whole room, 2x = pixel-level detail

### B4. HUD Indicator

When following, a small HTML overlay appears top-center:

```
📍 Following: AgentName  [×]
```

- Shows followed agent's name
- `[×]` button or Escape to unfollow
- HTML overlay (same pattern as `panel-manager.ts`)
- Hidden when not following

### Camera System File

**New file**: `src/systems/camera-system.ts` (~80 LOC)

Exports:
- `startFollow(actor: AgentActor)` — lock camera, show HUD
- `stopFollow()` — release camera, hide HUD
- `handleZoom(delta: number)` — adjust zoom with clamping + lerp
- `onSceneActivate(scene: ex.Scene)` — re-acquire followed actor in new scene

**Files modified**:
- `main.ts` — wire camera system, register wheel event listener
- `agent-actor.ts` — click handler branches: panel open → show panel, no panel → toggle follow
- `hub-scene.ts` / `room-scene.ts` — call `onSceneActivate()` after scene activate

---

## Architecture Decisions

1. **No new persistence** — habits are derived from attributes at spawn. No save/load needed.
2. **One new brain state** — `on-break` is added to the FSM for clean break-routine integration. Idle pose cycling remains visual-only (timers on `AgentBrainEntry`).
3. **Separate `computeHabits()` function** — habits are a parallel data structure to `BrainParams`, not merged into it. Habits override specific param fields where they conflict (e.g., movement speed).
4. **Pure functions for all behavior logic** — `resolveIdleTarget()`, preferred workstation resolution, mood multipliers. Fully testable with no ExcaliburJS dependency.
5. **Camera uses ExcaliburJS built-ins** — `LockCameraToActorStrategy` for follow, `camera.zoom` for zoom. No custom camera math.
6. **HTML overlay for HUD** — consistent with existing panel pattern. No canvas-drawn UI.
7. **Brain system owns all per-agent state** — idle pose timers, break timers, and habits all live on `AgentBrainEntry`. Actors are purely visual.

## Test Strategy

**Pure function tests** (brain + movement):
- `resolveIdleTarget()` — social drift, focus drift, fallback scenarios, null return for stay-put
- Mood multiplier derivation — all 4 moods × parameter effects
- Preferred workstation resolution — preferred available, preferred occupied, no preference
- Habit derivation — attribute brackets → correct styles

**Pixel-art tests** (poses):
- `drawLookAroundPose` — head offset assertion
- `drawStretchPose` — arm position + height assertion

**Camera system tests**:
- Follow/unfollow lifecycle
- Zoom clamping at bounds
- Scene transition re-acquisition (agent found → continue, not found → stop)
- Followed agent despawn → auto-stop

## File Summary

| Action | File | Changes |
|--------|------|---------|
| Modify | `brain-types.ts` | Add `AgentHabits` interface, add `on-break` to `BrainState` union |
| Modify | `agent-brain.ts` | Add `computeHabits()`, break transition in transition table |
| Modify | `movement.ts` | Add `resolveIdleTarget()`, preferred workstation resolver, `Workstation.id` field |
| Modify | `brain-system.ts` | `AgentBrainEntry.habits` field, idle pose timer/index, break sequence, social facing, habit-driven wander, `updateMood()` method |
| Modify | `pixel-sprites.ts` | Add `drawLookAroundPose`, `drawStretchPose` |
| Modify | `agent-actor.ts` | Add `setIdlePose()`, click→follow branch, settling pause, on-break pose mapping |
| Modify | `main.ts` | Wire camera system, wheel event |
| Modify | `hub-scene.ts` | Camera system scene activate hook |
| Modify | `room-scene.ts` | Camera system scene activate hook |
| Create | `systems/camera-system.ts` | Follow, zoom, HUD, scene persistence, despawn detection |
| Create | `tests/systems/camera-system.test.ts` | Camera lifecycle + despawn + scene re-acquisition tests |
| Create | `tests/brain/habits.test.ts` | Habit derivation + idle target + mood multiplier tests |
| Create | `tests/actors/idle-poses.test.ts` | Look-around + stretch pose tests |

**Estimated**: ~500 new LOC (source) + ~300 LOC (tests), 1 new file, 9 modified files
