# Engine Refactor — Hybrid ECS Decomposition

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Flowti Plugin — `src/game/engine.ts` decomposition

## Summary

Decompose the 1,871-line `engine.ts` God object into focused modules using a hybrid ECS architecture. Presentation systems become `ex.System` subclasses managed by ExcaliburJS. Simulation systems remain global (cross-scene) with explicit tick ordering. Config, events, and state persistence each get their own module.

**Target:** engine.ts shrinks from ~1,871 lines to ~450-500 lines.

## Architecture Decision

**Hybrid ECS** — ExcaliburJS's ECS handles per-scene presentation (particles, lighting, bubbles, emotes, camera). Cross-scene simulation (needs, brain, social, BT, sensors) stays as global systems in an explicit tick coordinator. This avoids the multi-scene problem (Excalibur only ticks the active scene's systems, but simulation must run for all agents regardless of which room is visible).

### Two Layers

**Simulation Layer** (`engine-simulation.ts`) — Global, ticks every frame for all agents across all scenes. Called from the engine's preframe hook.

**Presentation Layer** (6 `ex.System` subclasses) — Per-scene, added to each scene's `world`. ExcaliburJS manages ordering via `SystemPriority`. Only the active scene's presentation systems run.

## Part 1: engine-config.ts — Externalized Constants

All hardcoded values extracted into one config module.

### Constants
- `ENGINE_WIDTH` (800), `ENGINE_HEIGHT` (500)
- `DOMAIN_PARTICLE_COLORS` (6 domain → color mappings)
- `LIGHT_LERP_SPEED` (0.0015)
- `POSITION_FLUSH_INTERVAL_MS` (5000)
- `TRAIL_DISTANCE_SQUARED` (64)
- All cooldown durations: pet reaction (30s), attraction arrival (5s), loading bar (1.2s)

### Spatial Data
- Object placements: `{ coffeeMachine: { x: 680, y: 120, room: "office", objectType: "coffee" }, ... }` for all 7 interactables
- Pet placements: `{ hubCat: { type: "cat", x: 300, y: 250, room: "hub" }, ... }` for all 8 pets
- Default pet rooms for restore fallback
- Room offsets for social isolation: `{ hub: 0, office: 10000, village: 20000, station: 30000 }`

### Behavioral Data
- Object attraction rules: `[{ object: "coffeeMachine", need: "energy", threshold: 60, phases: ["afternoon"], ... }]`
- Social emojis, reaction emojis arrays
- Greeting strings for personality

**Shape:** Plain exported objects/arrays, no classes. ~120 lines.

## Part 2: engine-simulation.ts — Global Tick Coordinator

The 310-line preframe loop becomes 9 named tick functions called in explicit order.

### Shared Engine Context

A single `EngineContext` type is shared by `engine-simulation.ts`, `engine-events.ts`, and `engine-state.ts`. It is a **persistent mutable object** created once in engine.ts and passed by reference — not recreated per frame. The `deltaMs` field is updated each frame before `tickSimulation` is called.

```typescript
interface EngineContext {
  deltaMs: number;
  systems: {
    brain: BrainSystem;
    needs: NeedsSystem;
    social: SocialSystem;
    talk: TalkEngine;
    sensor: SensorSystem;
    engagement: EngagementSystem;
    ritual: RitualSystem;
    tool: ToolExecutor;
    bt: BtSystem;
    director: DirectorSystem;
    dayClock: DayClock;
    worldAmbience: WorldAmbience;
    worldEvent: WorldEventScheduler;
    memory: MemorySystem;
    quirk: QuirkSystem;
    relationship: RelationshipSystem;
    bubble: BubbleSystem;
    emote: EmoteSystem;
    particlePool: ParticlePool;
    roomSwitcher: RoomSwitcher;
  };
  registry: SceneRegistry;
  store: DashboardStore;
  config: EngineConfig;
  actors: {
    findAgentActor: (name: string) => AgentActor | undefined;
    findCurrentSceneActor: (name: string) => AgentActor | undefined;
    findNearestAgent: (name: string) => { x: number; y: number } | null;
  };
  state: {
    cycleConversationCounts: Map<string, number>;
    firedReactiveTriggers: Map<string, Set<string>>;
    prevCycleCount: number;
    prevWalkingState: Map<string, boolean>;
    petReactionCooldowns: Map<string, number>;
  };
  pets: PetActor[];
  scenes: { hub: GameScene; office: GameScene; village: GameScene; station: GameScene };
}
```

This single type replaces the need for separate `SimulationContext` and `EngineContext` — all modules import from a shared `engine-types.ts` file (~30 lines).

### Tick Functions (in order)

| # | Function | Responsibility | Lines |
|---|----------|---------------|-------|
| 1 | `tickClock(ctx)` | Day cycle advance, world event scheduler update, cycle boundary resets (memory snapshots, conversation counts, reactive triggers) | ~35 |
| 2 | `tickSensor(ctx)` | Sensor system update (cooldown timers, rule evaluation) | ~10 |
| 3 | `tickNeeds(ctx)` | Needs system update, mood propagation to brain/emote/talk | ~20 |
| 4 | `tickReactiveTriggers(ctx)` | Energy/mood/focus threshold talk triggers with dedup | ~30 |
| 4 | `tickBehaviorThresholds(ctx)` | Force-break, seek-agent, demoralize, object attractions | ~40 |
| 5 | `tickPets(ctx)` | Pet BT tick, room-aware follow movement execution, agent proximity reaction effects (cooldown tracking) | ~40 |
| 6 | `tickRoomTransit(ctx)` | Room switcher update — agent/pet transit between scenes | ~15 |
| 7 | `tickBehaviorTree(ctx)` | Refresh needs snapshots, tick agent BTs, process BT actions (goal-started/completed/speaking → bubbleSystem) | ~30 |
| 8 | `tickBrain(ctx)` | Snapshot prevWalkingState, brain system movement/state machine | ~15 |
| 9 | `tickSocial(ctx)` | Ritual update, social proximity (room-offset positions), talk engine update | ~30 |
| 10 | `tickDirector(ctx)` | Director idle timer, engagement escalation, tool executor update | ~25 |
| 12 | `tickVisuals(ctx)` | Emote system update, particle pool update, particle trails (using prevWalkingState), weather particles, lighting lerp, workstation glow, bubble system lifecycle update, camera system (despawn check, zoom, pan), pet visual sync | ~60 |

Note on ordering: `tickBrain` (step 8) must snapshot `prevWalkingState` BEFORE calling `brainSystem.update()` — this is load-bearing for particle trail detection.

Exported as:
```typescript
export function tickSimulation(ctx: EngineContext): void {
  tickClock(ctx);
  tickSensor(ctx);
  tickNeeds(ctx);
  tickReactiveTriggers(ctx);
  tickBehaviorThresholds(ctx);
  tickPets(ctx);
  tickRoomTransit(ctx);
  tickBehaviorTree(ctx);
  tickBrain(ctx);
  tickSocial(ctx);
  tickDirector(ctx);
  tickVisuals(ctx);
}
```

### Engine preframe becomes:
```typescript
engine.on("preframe", () => {
  ctx.deltaMs = delta;
  tickSimulation(ctx);
});
```

~350 lines total.

### Residual engine.ts hooks

Two additional engine hooks remain in engine.ts (not extracted):

- **`postframe`** (~25 lines) — Pushes positions/targets/states to DashboardStore. This is store-sync logic tightly coupled to engine's actor lookup and scene state. Stays in engine.ts.
- **`postupdate`** — Periodic position flush to disk. Replaced by `engine-state.ts`'s `startPeriodicFlush()`.

Other coordination that stays in engine.ts:
- `handleAgentSelect()` (~30 lines) — touches brain, camera, store, bubble, engagement, director. Coordination concern.
- `allEntities` map management — SceneEntity wrappers used by roomSwitcher and pet visual sync. Part of EngineContext or engine.ts residual.

## Part 3: Presentation Systems — ex.System Subclasses

**Deferred to Phase 2.** The simulation tick extraction (Part 2) absorbs the visual update logic into `tickVisuals(ctx)` for now. The existing `BubbleSystem`, `EmoteSystem`, and `ParticlePool` classes keep their current APIs — they are called from `tickVisuals` instead of inline in the preframe loop.

Converting these to proper `ex.System` subclasses is a natural follow-up once the simulation extraction stabilizes. The hybrid architecture supports this — we can migrate individual visual systems to `ex.System` one at a time without changing the simulation layer.

**Why defer:** The existing BubbleSystem and EmoteSystem have complex multi-argument `update()` signatures and internal state that doesn't cleanly map to `ex.System.update(elapsed)` without wrapping. Wrapping them adds indirection without reducing complexity. Better to extract the God object first, then migrate presentation to ECS as a separate spec.

**What stays in this spec:** The `tickVisuals(ctx)` function in `engine-simulation.ts` handles all visual updates that were previously scattered through the preframe loop.

## Part 4: engine-events.ts — Consolidated Event Wiring

All event subscriptions extracted from engine.ts into a single module.

### Structure
```typescript
export function wireEvents(ctx: EngineContext): () => void {
  const unsubs = [
    wireDayClockEvents(ctx),
    wireWorldEvents(ctx),
    wireEmoteEvents(ctx),
    wireConversationEvents(ctx),
    wireSensorEvents(ctx),
    wireEngagementEvents(ctx),
    wireRitualEvents(ctx),
    wireToolEvents(ctx),
    wireProviderEvents(ctx),
    wireStoreEvents(ctx),
  ];
  return () => unsubs.forEach(fn => fn());
}
```

### Event Groups

| Group | Events | Approx Lines |
|-------|--------|-------------|
| DayClock | `dayClock.onPhaseChange` — phase transition handler | ~10 |
| WorldEvents | 10 `registerWorldEvent` micro-event handlers (standup, deploy, eureka, birthday, etc.) | ~100 |
| Emote | `emoteSystem.onEmote` — mood-text emote display callback | ~60 |
| Conversation | `socialSystem.onConversation`, `onCluster` — bicker detection, emoji reactions, timed dialogue, huddle templates | ~40 |
| Sensor | `sensorSystem.onReaction` — bubbles + needs effects | ~15 |
| Engagement | `engagementSystem.onEngagement` — walk toward camera + bubble | ~15 |
| Ritual | `ritualSystem.onPhase` — gather/line/disperse choreography | ~20 |
| Tools | `toolExecutor.onResult` — feedback → needs + morale | ~10 |
| Provider | `provider.onAction`, `provider.onConnectionStatus`, `provider.onEntityUpdate` — data provider callbacks | ~40 |
| Store | 9 listeners (scene-change, agent-message-sent, agent-response-received, task-assigned, task-completed, permission-decided, agent-using-tool, agent-tool-complete, state-changed) | ~90 |

Each wiring function returns an unsubscribe callback. The top-level `wireEvents` collects them all for `dispose()`.

~400 lines total.

## Part 5: engine-state.ts — Unified State Persistence

All state save/restore in one module.

### API
```typescript
interface RestoreResult {
  loaded: string[];      // files successfully restored
  skipped: string[];     // files missing or corrupt (defaults used)
}

// Phase 1: Before provider.start() — restore global world state
export function restoreWorldState(ctx: EngineContext, vaultPath: string): RestoreResult

// Phase 2: After agent registration + scene routing — restore agent-specific state
export function restoreAgentState(ctx: EngineContext, vaultPath: string): RestoreResult

// Save all state (called by dispose + periodic flush)
export function flushWorldState(ctx: EngineContext, vaultPath: string): void

// Start periodic position flush (every 5s), returns cancel function
export function startPeriodicFlush(ctx: EngineContext, vaultPath: string): () => void
```

### Two-Phase Restore

The actual restore interleaves with async operations. Two phases:

**Phase 1** (`restoreWorldState`) — called before `provider.start()`:
| File | System | Order |
|------|--------|-------|
| `world-clock.json` | DayClock | 1st |
| `world-weather.json` | WorldAmbience | 2nd |
| `world-memory.json` | MemorySystem | 3rd |
| `world-relationships.json` | RelationshipSystem | 4th |

**Phase 2** (`restoreAgentState`) — called after `registerAgents()` + scene routing:
| File | System | Order |
|------|--------|-------|
| `world-positions.json` | Manual position routing | 1st (needs agents in scenes) |
| `world-needs.json` | NeedsSystem | 2nd (needs agents registered with defaults first) |

The engine's `start()` calls them in sequence:
```typescript
restoreWorldState(ctx, vaultPath);       // Phase 1
await provider.start();
registerAgents(agents);
routeAgentsToScenes(agents);
restoreAgentState(ctx, vaultPath);       // Phase 2
```

~120 lines total.

## Part 6: Pet AI Consolidation

Hardcoded pet AI in the preframe loop (~60 lines) moves into the pet BT.

### New Pet BT Conditions
- `ShouldFollowStressedAgent` — cat-specific: nearby agent with morale < 30
- `ShouldFollowRandomAgent` — dog-specific: random idle agent selection
- `LostFollowTarget` — target moved to different room

### What Stays in Engine
- Room-aware follow movement execution (`pet.moveToward()` with position lookup from registry) — ~15 lines in a presentation system or thin loop
- Agent proximity reaction effects (heart particles, needs boost) — presentation concern

### pet-bt.ts Changes
- Add 3 new conditions to `PetBTObject`
- Extend `PET_MASTER_MDSL` with cat/dog behavior branches
- `createPetBT` gains an optional `petType` parameter to enable type-specific behaviors

~40 lines of additions to pet-bt.ts.

## Files Changed

### New Files
- `src/game/engine-types.ts` (~30 lines) — shared `EngineContext` type
- `src/game/engine-config.ts` (~120 lines) — all constants, positions, behavioral data
- `src/game/engine-simulation.ts` (~330 lines) — 11 named tick functions
- `src/game/engine-events.ts` (~400 lines) — all event wiring with cleanup
- `src/game/engine-state.ts` (~120 lines) — two-phase restore + flush + periodic flush

### Modified Files
- `src/game/engine.ts` — gutted from ~1,871 to ~450-500 lines (coordinator only)
- `src/game/brain/behavior-tree/pet-bt.ts` — add 3 conditions for cat/dog follow behaviors

### Tests
- `tests/game/engine-simulation.test.ts` — tick function unit tests with mocked context
- `tests/game/engine-events.test.ts` — wiring + cleanup verification
- `tests/game/engine-state.test.ts` — save/restore round-trip tests (both phases)
- `tests/game/engine-config.test.ts` — config shape validation
- `tests/game/brain/behavior-tree/pet-bt.test.ts` — extend with new conditions

## Non-Goals

- Rewriting existing system internals (BrainSystem, NeedsSystem, etc. keep their APIs)
- Changing game behavior — this is a pure refactor, observable behavior stays identical
- Adding new features (no new systems, no new pet types)
- Migrating simulation systems to ex.System (they stay global by design)
- Converting BubbleSystem/EmoteSystem/ParticlePool to ex.System (deferred to Phase 2 — see Part 3)
