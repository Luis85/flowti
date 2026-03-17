# Agent World MVP — Design Spec

**Date**: 2026-03-17
**Status**: Approved
**Scope**: Polish the ExcaliburJS agent world into a joyful, interactive MVP with game feel, emotional expressiveness, and live CLI integration
**Iteration**: 5 — Agent World (Phase B, completion)

## Problem

The agent world has the structural foundation — 5 scenes, brain-driven wandering AI, sprite characters, panel UI, bubbles, camera system — but it feels like a tech demo, not a place you want to visit. Three categories of gaps:

1. **No game feel**: Agents slide like chess pieces. No particle trails, no arrival feedback, no visual productivity indicators. The world lacks physical presence.
2. **Invisible emotions**: Agent mood, relationships, and personality are hidden behind click-to-open panels. You can't tell at a glance how an agent is doing or who they interact with.
3. **Disconnected from reality**: Task assignment is visual-only. World state reconciliation is stubbed. The rich data the CLI exports (`goals`, `behaviors`, `project`, `iteration`) doesn't reach the game.

## MVP Definition

The MVP is "a world you want to watch." It answers three questions at a glance:
- **What are they doing?** (particle trails for movement, workstation glow for productivity)
- **How are they feeling?** (mood emotes floating above heads)
- **Who do they interact with?** (proximity conversations between related agents)

Plus the infrastructure to connect it to real data:
- **Data completeness** — all CLI-exported fields surface in the game
- **Live reconciliation** — agents spawn/despawn/change when CLI state changes
- **Task execution** — assigning a task from the dashboard triggers actual agent work via CLI

## Decision Record

| Question | Decision |
|---|---|
| Particle rendering | Lightweight `ex.Actor` particles with opacity fade — NOT a custom WebGL particle system |
| Emote source | Ninja Adventure `assets/Ui/Emote/` PNGs (30 sprites, 16x16, already in asset tree) |
| Conversation content | Canned lines from personality traits + relationship type — NOT LLM-generated |
| Workstation glow | Canvas radial gradient on `WorkstationActor` — NOT shader-based |
| Reconciliation trigger | World-state poll diff (existing `onStateDiff` callback) — NOT new SSE event types |
| Task execution backend | Existing `/api/agent/task` endpoint → agent runner — no new endpoints needed |

## Architecture

### New Systems

Four new systems, all following the existing pattern: pure logic files (testable without ExcaliburJS) + thin system wrappers that integrate with the engine.

```
systems/
├── particle-system.ts    — Manages particle lifecycle (spawn, fade, cleanup)
├── emote-system.ts       — Per-agent emote timers and mood-to-sprite mapping
├── social-system.ts      — Proximity conversation detection and orchestration
└── (existing systems unchanged)
```

### New Data Flow

```
CLI agent-export.ts                    Game types.ts
┌──────────────────┐                   ┌──────────────────┐
│ goals             │ ──── JSON ────→  │ goals             │ (NEW)
│ behaviors         │                  │ behaviors         │ (NEW)
│ project           │                  │ project           │ (NEW)
│ iteration         │                  │ iteration         │ (NEW)
│ phase             │                  │ phase             │ (NEW)
└──────────────────┘                   └──────────────────┘

onStateDiff (currently stub)
┌──────────────────┐
│ added   → spawn agent in correct room
│ removed → despawn agent from scene
│ changed → update status, brain transition, bubble
└──────────────────┘
```

### Particle System Design

Particles are lightweight `ex.Actor` instances with:
- Position (x, y) — spawned at agent's feet for trails, at target for dust
- Velocity (vx, vy) — for dust puff spread
- Lifetime (ms) — starts at spawn, counts down
- Opacity — linearly fades from 1→0 over lifetime
- Color — matches agent's domain color
- Max pool: 200 active particles (oldest killed when exceeded)

**Trail particles**: Spawned every 8px of movement (tracked by distance accumulator). 1-2px radius. 2000ms lifetime. Wandering=0.3 opacity, walking-to=0.6 opacity.

**Dust particles**: Spawned on arrival (dist < ARRIVAL_THRESHOLD). 4-6 particles. Random velocity spread (30-60px/s outward). 800ms lifetime.

### Emote System Design

Per-agent timer driven by `quoteFrequency` from `BrainParams` (WIS-derived, 15-30s range). When timer fires and agent is idle/on-break:

1. Look up agent's `mood` field
2. Map mood → emote sprite index (see mapping below)
3. Spawn emote actor 20px above agent head
4. Float upward 20px over 2000ms while fading opacity 1→0
5. Kill actor on complete

**Mood → Emote mapping** (Ninja Adventure emote indices):
- `happy` / `enthusiastic` → emote3 (heart), emote5 (star)
- `neutral` → emote7 (ellipsis), emote8 (music note)
- `frustrated` / `angry` → emote10 (anger), emote12 (sweat)
- `focused` → emote15 (exclamation), emote20 (lightbulb)
- `empathetic` → emote3 (heart), emote22 (sparkle)
- `inspired` → emote20 (lightbulb), emote5 (star)
- `aesthetic` → emote22 (sparkle), emote8 (music note)
- `playful` → emote5 (star), emote25 (swirl)
- Fallback → emote7 (ellipsis)

Multiple options per mood → random selection each trigger.

### Social System Design

Checks pairwise distances between agents that have `relationships[]` data. When two related agents are both idle and within `socialRadius` (CHA-derived) for > 4000ms:

1. Both agents enter `talking` brain state via `brainSystem.applyEvent(name, "speaking")`
2. Both get speech bubbles with personality-flavored conversation lines
3. After 3-5s (random), both return to idle via `brainSystem.applyEvent(name, "idle")`
4. Per-pair cooldown of 60s prevents repeat conversations

**Conversation line sources** (canned, not LLM):
- Agent personality traits → "[trait]-flavored" observations
- Relationship type → tone modifier (mentor=advisory, peer=casual, reports-to=formal)
- Domain → topic (engineering=code, design=UX, product=roadmap)

### Workstation Glow Design

When a workstation is occupied (agent in `working` state at workstation position):
- Radial gradient glow behind monitor graphic, color matches room theme
- Glow opacity pulses on sine wave (0.3→0.8, period 2000ms)
- Spark particles: 1px dots in theme accent color, float upward 30px, spawn every 2-3s
- On `using-tool` SSE event for the seated agent: burst of 8 sparks (vs normal 1-2)

### World State Reconciliation Design

The `onStateDiff` callback in `main.ts:270` is currently a stub. Implementation:

**Added entities**: For each added agent entity:
1. Create `DashboardAgent` from entity components
2. Determine room via `resolveSettingForDomain(agent.domain)`
3. Call `roomScene.spawnAgent(agent)` + `hubScene.updateAgents()`
4. Register in brain, bubble, talk, emote systems
5. Show entrance speech bubble

**Removed entities**: For each removed agent entity:
1. Find and remove actor from all scenes
2. Unregister from brain, bubble, talk, emote systems

**Changed entities**: For each changed agent entity:
1. Extract status component from entity
2. If status changed: `brainSystem.applyEvent(name, newStatus)`
3. Show announcement bubble ("I'm now working on...")
4. Update store agent data

### Data Export Gap

Game-side `DashboardAgent` in `agents/src/data/types.ts` needs 5 fields that the CLI already exports:

```typescript
export interface DashboardAgent {
    // ... existing fields ...
    readonly goals?: readonly { text: string; priority: string }[];
    readonly behaviors?: readonly string[];
    readonly project?: string;
    readonly iteration?: string;
    readonly phase?: string;
}
```

`panel-info.ts` renders these when present.

## Non-Goals

- No new SSE event types (use existing `agent-action` + `world-state`)
- No LLM-generated conversation content (canned lines from personality data)
- No sound effects or music
- No day/night cycle (Iteration 6 candidate)
- No cross-room agent transitions (Iteration 6 candidate)
- No minimap or free-camera WASD pan
- No new panel tabs or UI redesign

## Test Strategy

Each new system gets a dedicated test file:
- `tests/systems/particle-system.test.ts` — spawn, fade, pool limits, arrival burst
- `tests/systems/emote-system.test.ts` — mood mapping, timer, idle-only constraint
- `tests/systems/social-system.test.ts` — proximity detection, cooldown, conversation lifecycle
- `tests/systems/brain-system.test.ts` — state transitions, targetBounds, reconciliation events

Integration tested via manual smoke test: `flowti serve` → open dashboard → observe particles, emotes, glow, conversations.

## Success Criteria

The MVP is complete when:
1. You can watch agents for 60 seconds and see: particle trails as they walk, dust puffs when they stop, mood emotes floating up, workstation glow when working, two agents spontaneously chatting
2. The info panel shows project, iteration, goals for each agent
3. Assigning a task from the panel triggers visible agent behavior (walk-to, work, complete)
4. Adding/removing an agent via CLI reflects in the world within 30s
