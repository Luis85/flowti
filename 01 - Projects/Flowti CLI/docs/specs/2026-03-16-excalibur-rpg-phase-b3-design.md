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

**Derivation** (extends existing `computeParams()` in `agent-brain.ts`):

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

**Files modified**: `agent-brain.ts` (extend `computeParams()`)
**Files added**: None — habits interface lives in `brain-types.ts`

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
3. **Home room pull** — if agent is in hub or wrong room, 40% chance → target home room doorway
4. **Fallback** — random wander within current room bounds (existing behavior)

Social drift and focus drift are mutually exclusive checks — a high-CHA agent usually drifts toward others; a high-INT agent usually seeks solitude. Mid-stat agents feel natural — sometimes social, sometimes alone.

**New pure function**: `resolveIdleTarget(habits, nearbyAgents, roomBounds, rng)` in `movement.ts`

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

Implementation: `idlePoseTimer` counter on the agent actor. `brain-system.ts` update loop ticks the timer when state is `idle` and not moving, cycles through the pose sequence.

**Files modified**: `pixel-sprites.ts` (2 new pose functions), `agent-actor.ts` (pose timer + cycle logic), `brain-system.ts` (tick idle pose timer)

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

**Implementation**: New `on-break` visual sub-state (not a brain state — brain returns to `idle`, break logic is a timer sequence in `brain-system.ts`). ~30 lines in brain-system, ~10 lines in movement.ts for preferred workstation resolution.

**Files modified**: `brain-system.ts` (break timer + sequence), `movement.ts` (preferred workstation resolver)

### A5. Social Proximity — Facing

When two idle agents are within 40px of each other, they face each other and hold position briefly.

**Behavior**:
- Scan for agent pairs within 40px threshold
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

A frustrated agent visibly paces the room faster and takes shorter breaks. A focused agent stays at their workstation longer and rarely drifts toward others. A happy agent ambles and lingers. You read team mood by watching movement patterns.

**Implementation**: ~15 lines in `computeParams()` applying mood multipliers to existing timer values.

**Files modified**: `agent-brain.ts` (mood multipliers in `computeParams()`)

---

## Chunk B: Camera & Follow

### B1. Follow Mode

Click an agent to lock the camera on them.

**Activation**: Click agent actor when no panel is open. (Panel click takes priority — existing behavior.)

**Tracking**: Camera position updates every frame to center on followed agent. Uses ExcaliburJS built-in `LockCameraToActorStrategy`.

```typescript
// Follow
camera.addStrategy(new ex.LockCameraToActorStrategy(targetActor));
// Unfollow
camera.clearAllStrategies();
```

**Deactivation**: Click empty space, press Escape, or click HUD unfollow button.

### B2. Cross-Room Tracking

When followed agent enters a doorway (transitions to a different room), camera auto-transitions to that scene.

- Uses existing `goToScene()` with fade transition
- After scene activate, camera system re-acquires actor reference in new scene
- Smooth — no jarring cuts

### B3. Scroll Zoom

Mouse wheel controls zoom level.

- `wheel` event on canvas → adjust `camera.zoom` by ±0.1 per tick
- Clamp to [0.5, 2.0] range
- Smooth interpolation: lerp toward target zoom over 3 frames
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
2. **No new brain states** — idle pose cycling and breaks are visual sub-states (timers on actor/system), not FSM states. Keeps the brain clean.
3. **Pure functions for all behavior logic** — `resolveIdleTarget()`, preferred workstation resolution, mood multipliers. Fully testable with no ExcaliburJS dependency.
4. **Camera uses ExcaliburJS built-ins** — `LockCameraToActorStrategy` for follow, `camera.zoom` for zoom. No custom camera math.
5. **HTML overlay for HUD** — consistent with existing panel pattern. No canvas-drawn UI.

## Test Strategy

**Pure function tests** (brain + movement):
- `resolveIdleTarget()` — social drift, focus drift, home room pull, fallback scenarios
- Mood multiplier derivation — all 4 moods × parameter effects
- Preferred workstation resolution — preferred available, preferred occupied, no preference
- Habit derivation — attribute brackets → correct styles

**Pixel-art tests** (poses):
- `drawLookAroundPose` — head offset assertion
- `drawStretchPose` — arm position + height assertion

**Camera system tests**:
- Follow/unfollow lifecycle
- Zoom clamping at bounds
- Scene transition re-acquisition

## File Summary

| Action | File | Changes |
|--------|------|---------|
| Modify | `brain-types.ts` | Add `AgentHabits` interface |
| Modify | `agent-brain.ts` | Extend `computeParams()` with habits + mood multipliers |
| Modify | `movement.ts` | Add `resolveIdleTarget()`, preferred workstation resolver |
| Modify | `brain-system.ts` | Idle pose timer, break sequence, social facing, habit-driven wander |
| Modify | `pixel-sprites.ts` | Add `drawLookAroundPose`, `drawStretchPose` |
| Modify | `agent-actor.ts` | Idle pose cycling, click→follow branch, settling pause |
| Modify | `main.ts` | Wire camera system, wheel event |
| Modify | `hub-scene.ts` | Camera system scene activate hook |
| Modify | `room-scene.ts` | Camera system scene activate hook |
| Create | `systems/camera-system.ts` | Follow, zoom, HUD, scene transitions |
| Create | `tests/systems/camera-system.test.ts` | Camera lifecycle tests |
| Create | `tests/brain/habits.test.ts` | Habit derivation + idle target tests |
| Create | `tests/actors/idle-poses.test.ts` | Look-around + stretch pose tests |

**Estimated**: ~400 new LOC (source) + ~250 LOC (tests), 1 new file, 9 modified files
