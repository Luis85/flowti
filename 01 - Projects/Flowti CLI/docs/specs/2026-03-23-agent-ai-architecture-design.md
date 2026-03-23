# Agent AI Architecture — Blackboard + ECS Locomotion

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Flowti Plugin — full agent decision/movement pipeline rework
**Supersedes:** `2026-03-22-bt-brain-boundary-redesign.md` and all prior BT/brain patches

## Problem

The current agent pipeline has two competing decision systems (BT and brain) communicating through a fragile bridge of `applyEvent` calls, action collection, whitelist filtering, and redundancy guards. Five rounds of patching produced a working but brittle system:

- The BT writes intent through `collect()` → `worldState.emitAction()` → `brainSystem.applyEvent()`
- Seek actions bypass the bridge via direct `deps.brain?.applyEvent()` calls (double-call risk)
- The brain has autonomous state transitions that compete with BT decisions
- Legacy systems (`processThresholds`, `tryObjectAttraction`, cascade reactions) need per-system BT guards
- `engine-simulation.ts` is 900+ lines with 12 tick functions that reach into each other

The result works but is hard to reason about, hard to extend, and has produced repeated regressions.

## Design: Blackboard + ECS Locomotion

Industry-standard game AI architecture: **BT decides, blackboard mediates, locomotion executes.**

```
Sensors → Blackboard ← BT (2.5-4s tick)
                ↓ push
        ECS Components (on Actor)
                ↓ per-frame
        LocomotionSystem (Excalibur System)
                ↓ pull
            Blackboard
                ↓ read
        Presentation (talk, bubbles, emotes, particles)
```

No system calls methods on another system. All communication flows through the blackboard.

## Blackboard

Per-agent data store. The single source of truth for agent state.

```typescript
interface AgentBlackboard {
    // ── Written by BT, read by locomotion ────────────
    movementCommand: "none" | "walk-to" | "wander";
    movementTarget: { x: number; y: number } | null;

    // ── Written by BT, read by presentation ──────────
    intent: "idle" | "working" | "talking" | "waiting" | "on-break" | "seeking";
    intentDetail?: string;     // "seek-food", "goal-review", etc.

    // ── Written by locomotion, read by BT ────────────
    arrived: boolean;
    position: { x: number; y: number };
    isMoving: boolean;

    // ── Written by sensors, read by BT ───────────────
    needs: AgentNeeds;
    nearbyAgents: string[];
    nearbyEntities: string[];
    currentRoom: string;
    nearestFoodStation: { x: number; y: number } | null;
    nearestDrinkStation: { x: number; y: number } | null;
    nearestRestStation: { x: number; y: number } | null;

    // ── Written by echo/social, read by BT ───────────
    wanderHint: { x: number; y: number } | null;
    cascadeHint: string | null;   // "seek-proximity" | "force-break" | null
    cascadeTarget: { x: number; y: number } | null;
    roomAvoidance: string | null; // room ID to avoid (echo aversion)
    breakThresholdBias: number;   // echo mood-residue weight, lowers break threshold

    // ── Written by BT, read by presentation ──────────
    speechRequest: { text: string; kind: BubbleKind } | null;
}
```

### BlackboardManager

Owns all per-agent blackboards. Provides:
- `get(name): AgentBlackboard` — returns the blackboard for an agent
- `push()` — syncs blackboard → ECS components (once per frame, before Excalibur update)
- `pull()` — syncs ECS components → blackboard (once per frame, after Excalibur update)
- `register(name, actor)` / `unregister(name)` — lifecycle

File: `src/game/systems/blackboard.ts`

## ECS Components

Attached to `AgentActor`. Excalibur owns their lifecycle.

### MovementComponent

```typescript
class MovementComponent extends ex.Component {
    command: "none" | "walk-to" | "wander" = "none";
    target: { x: number; y: number } | null = null;
    arrived = false;
    speed: number;
    movementStyle: "deliberate" | "brisk" | "darting";
}
```

### IntentComponent

```typescript
class IntentComponent extends ex.Component {
    intent: string = "idle";
    detail?: string;
    idlePose: string = "idle";
    idlePoseTimer = 0;
}
```

Note: Modern Excalibur queries components by constructor (`world.query([MovementComponent])`), not by a `type` string. No `type` property is needed.

File: `src/game/components/agent-components.ts`

## LocomotionSystem

Excalibur `System` subclass. Runs per-frame. Processes all entities with `MovementComponent`.

Responsibilities:
- Walk toward `target` at `speed` (personality-driven)
- Detect arrival (distance < threshold) → set `arrived = true`, clear command
- Handle `"wander"` command: pick a random nearby point, walk to it
- Apply separation nudge between overlapping agents
- Social facing — turn toward nearby agents when idle
- Idle pose cycling — advance pose timer, cycle through fidgety/calm/restless
- Update actor walk direction and animation state

Does NOT:
- Make any decisions about what to do next
- Set timers for when to start wandering
- Transition between behavioral states
- Read from needs, echo, or any AI system

File: `src/game/systems/locomotion-system.ts`

### Wander Command Handling

When the BT writes `movementCommand: "wander"`, the locomotion system:
1. Picks a random point within bounds (using personality-driven `resolveIdleTarget`)
2. Walks to it
3. Sets `arrived = true` on reaching it
4. Resets command to `"none"`

The BT decides WHEN to wander (idle timer condition). The locomotion system decides WHERE and HOW.

## BT Rewire

### Actions Write to Blackboard

BT actions no longer call `collect()` or `deps.brain?.applyEvent()`. They write directly to the agent's blackboard:

```typescript
// Old
function SeekFoodStation(ext: BTAgentExtensionDeps): State {
    ext.collect("seek-food");
    ext.deps.brain?.applyEvent(ext.context.name, "seek-food");
    return fromNodeState("succeeded");
}

// New
function SeekFoodStation(ext: BTAgentExtensionDeps): State {
    const bb = ext.deps.blackboard;
    bb.intent = "seeking";
    bb.intentDetail = "seek-food";
    bb.movementCommand = "walk-to";
    bb.movementTarget = bb.nearestFoodStation;
    return fromNodeState("succeeded");
}
```

### New BT Subtrees (migrated from brain)

| Subtree | Replaces | Logic |
|---------|----------|-------|
| `idle-wander.ts` | `brain.updateIdle()` | Condition: idle for > idleResistance. Action: set `movementCommand: "wander"` |
| `break-routine.ts` | `brain.updateOnBreak()` | Sequence: energy low → go to rest spot → rest → return |
| `talking-timeout.ts` | `brain.tickAgentState` talking case | Condition: talking for > 10s → set intent to idle |

### AgentToolDeps Changes

```typescript
// Removed
brain?: IBrainBridge;

// Added
blackboard: AgentBlackboard;
```

### btTick Changes

`btTick` no longer calls `worldState.emitAction()` for each collected action. Instead, the BT writes to the blackboard directly during tree evaluation. The `collectedActions` array and `worldState.emitAction` bridge are deleted.

The `tickBehaviorTree` post-processing loop (assignWork, releaseWork, bubble display, seek thoughts) is absorbed:
- `assignWork` / `releaseWork` → BT writes `intent: "working"` / `intent: "idle"` to blackboard
- Bubble display → BT writes `speechRequest` to blackboard, presentation reads it
- Seek thoughts → BT writes `intentDetail`, presentation reads it and shows appropriate thought

## Sensor Phase

Replaces the scattered data gathering across multiple tick functions. Runs once per frame, writes to blackboard.

```typescript
function tickSensors(ctx: EngineContext): void {
    for (const [name, bb] of ctx.blackboards) {
        // Needs snapshot
        bb.needs = ctx.systems.needs.getNeeds(name);

        // Nearby agents (same room, within social radius)
        bb.nearbyAgents = getNearbyAgents(ctx, name);

        // Nearby entities (for interaction system)
        bb.nearbyEntities = getNearbyEntities(ctx, name);

        // Room
        bb.currentRoom = ctx.systems.registry.getEntityRoom(name) ?? "";

        // Station positions (nearest unoccupied)
        bb.nearestFoodStation = resolveNearestStation(ctx, name, "food");
        bb.nearestDrinkStation = resolveNearestStation(ctx, name, "drink");
        bb.nearestRestStation = resolveNearestStation(ctx, name, "rest");

        // Echo hints
        bb.wanderHint = resolveWanderHint(ctx, name);
        bb.cascadeHint = resolveCascadeHint(ctx, name);
    }
}
```

Station resolution (currently in `onStationResolve` callback and `tryObjectAttraction`) moves here. The BT reads `bb.nearestFoodStation` instead of calling a callback.

File: `src/game/systems/sensor-phase.ts`

## Presentation Phase

Replaces scattered bubble/talk/emote logic across tickBehaviorTree and tickVisuals. Reads from IntentComponent and blackboard.

```typescript
function tickPresentation(ctx: EngineContext): void {
    // Talk engine — fires ambient chatter for idle agents
    ctx.systems.talk.update(deltaMs);

    // Speech requests from BT
    for (const [name, bb] of ctx.blackboards) {
        if (bb.speechRequest) {
            ctx.systems.bubble.showBubble(name, bb.speechRequest.kind, bb.speechRequest.text, ...);
            bb.speechRequest = null;
        }
    }

    // Seek thoughts (probabilistic)
    for (const [name, bb] of ctx.blackboards) {
        if (bb.intent === "seeking" && bb.intentDetail && Math.random() < 0.5) {
            const phrase = SEEK_PHRASES[bb.intentDetail] ?? "";
            if (phrase) ctx.systems.bubble.showBubble(name, "thought", phrase, ...);
        }
    }

    // Emotes, particles, camera, weather
    tickVisualEffects(ctx);
}
```

## Engine Simulation Restructure

The current 12 entangled tick functions are reorganized into a clear pipeline. The brain/BT pipeline is replaced by the blackboard + locomotion pattern. All other systems (room transit, interactions, social, director, visuals) remain as explicit phases in the correct order.

### Locomotion: Manual Call, Not Excalibur System

`tickSimulation` runs entirely inside the `preframe` event handler — BEFORE Excalibur's own system update loop. To keep push/pull timing simple, LocomotionSystem is called manually within the simulation loop rather than registered as an Excalibur `System`. Components still live on actors (ECS data model), but the processing is explicit.

```typescript
export function tickSimulation(ctx: EngineContext): void {
    // ── World time ───────────────────────────────────
    tickClock(ctx);                // Day cycle, world events, cycle boundary

    // ── Sensors (write to blackboard) ────────────────
    tickNeeds(ctx);                // Decay/restore needs, mood propagation
    tickSensorCooldowns(ctx);      // Existing SensorSystem cooldowns + queued feedback
    tickSensors(ctx);              // NEW: write needs, nearby, stations, echo hints to blackboard

    // ── Decisions (BT reads/writes blackboard) ───────
    tickPets(ctx);                 // Pet BT + behavior (writes to PetBlackboard)
    tickBehaviorTree(ctx);         // Agent BT reads blackboard, writes intent + commands

    // ── Execution (blackboard → components → movement) ─
    ctx.blackboards.push();        // Sync blackboard → MovementComponent + IntentComponent
    tickLocomotion(ctx);           // Walk toward target, arrival, separation, social facing
    ctx.blackboards.pull();        // Sync arrived/position → blackboard

    // ── World systems (read intent/position) ─────────
    tickRoomTransit(ctx);          // Room switcher — transfers between scenes
    tickInteractions(ctx);         // Interaction bus — affinity, need effects, memory
    tickSocial(ctx);               // Cascade queue, ritual, social proximity, gossip, conversation

    // ── Presentation (read intent, show effects) ─────
    tickDirector(ctx);             // Director presence, engagement, tool executor
    tickPresentation(ctx);         // Talk engine, bubbles, reactive triggers, emotes, particles, camera
}
```

This is 13 explicit phases grouped into 5 stages. Each stage has clear data dependencies:
- **Sensors** write to blackboard (no reads from downstream systems)
- **Decisions** read blackboard, write intent/commands
- **Execution** reads commands, writes physical state
- **World systems** read intent/position, apply effects
- **Presentation** reads intent, produces visuals

### What Gets Deleted

| Current File/Function | Disposition |
|----------------------|-------------|
| `brain-system.ts` | **Deleted** — movement → locomotion-system.ts, decisions → BT, state → blackboard |
| `agent-brain.ts` | **Deleted** — TRANSITIONS table, computeParams, computeHabits absorbed into blackboard init + locomotion config |
| `brain-types.ts` | **Deleted** — BrainState, BrainEvent, BrainResult replaced by blackboard + component types |
| `engine-systems-init.ts` createBtBridges | **Deleted** — no bridge needed, BT writes to blackboard directly |
| `processThresholds()` | **Deleted** — BT needs subtrees handle all thresholds |
| `tryObjectAttraction()` | **Deleted** — sensor phase writes station positions, BT decides, locomotion walks |
| `OBJECT_ATTRACTION_RULES` | **Deleted** — replaced by sensor station queries + BT needs conditions |
| `collect()` / `collectedActions` | **Deleted** — BT writes to blackboard directly |
| `worldState.emitAction()` bridge | **Deleted** — no bridge |
| `tickBehaviorThresholds()` | **Deleted** — absorbed into tickSensors + BT |

### What Gets Created

| New File | Purpose |
|----------|---------|
| `src/game/systems/blackboard.ts` | AgentBlackboard, PetBlackboard, BlackboardManager |
| `src/game/components/agent-components.ts` | MovementComponent, IntentComponent (ECS data, manual processing) |
| `src/game/systems/locomotion-system.ts` | Per-frame movement, arrival, separation, social facing, idle pose cycling |
| `src/game/systems/sensor-phase.ts` | Per-frame sensor data gathering (needs, nearby, stations, echo hints) |
| `src/game/brain/behavior-tree/subtrees/idle-wander.ts` | BT idle timer + wander command |
| `src/game/brain/behavior-tree/subtrees/break-routine.ts` | BT break management |

### What Stays Unchanged (with update call location)

| System | Phase | Change |
|--------|-------|--------|
| `NeedsSystem` | tickNeeds | Reads `intent` from blackboard instead of brain state |
| `SensorSystem` (cooldowns) | tickSensorCooldowns | No change — existing cooldown/feedback system |
| `TalkEngine` | tickPresentation | Reads `IntentComponent.intent === "idle"` instead of brain state |
| `EchoStore` / `EchoProducer` | tickSensors (read), tickSocial (write) | Echo hints written to blackboard via sensor phase |
| `BubbleSystem` | tickPresentation | Reads speech requests from blackboard |
| `RelationshipSystem` | tickInteractions / tickSocial | No brain dependency |
| `ConversationEngine` | tickSocial | No brain dependency |
| `RoomSwitcher` | tickRoomTransit | No change |
| `DirectorSystem` | tickDirector | No change |
| `EngagementSystem` | tickDirector | No change |
| `ToolExecutor` | tickDirector | No change |
| `RitualSystem` | tickSocial | No change |
| `SocialSystem` | tickSocial | Reads position from blackboard instead of brain |
| `MemorySystem` | tickClock (cycle boundary) | No brain dependency |
| `QuirkSystem` | tickSensors (quirk overrides feed personality params) | Quirk overrides applied to blackboard init, not brain params |
| `CameraSystem` | tickPresentation | No change |
| `EmoteSystem` | tickPresentation | Reads intent from blackboard |
| `ParticlePool` | tickPresentation | No change |
| `BtSystem` core | tickBehaviorTree | Action interface changes (collect → blackboard), tree evaluation unchanged |

### Workstation Lifecycle

Currently `assignWork`/`releaseWork` runs through brain system callbacks (`onWorkstationChange`). After migration:

1. BT writes `intent: "working"` + `movementCommand: "walk-to"` + `movementTarget: workstation` to blackboard
2. Locomotion walks agent to workstation, sets `arrived = true`
3. BT detects arrival, writes `intent: "working"` (agent is at desk)
4. BlackboardManager's push detects `intent === "working"` transition → fires `onWorkstationOccupy(name, position)` callback
5. On intent leaving "working" → fires `onWorkstationVacate(name, position)` callback

The occupy/vacate callbacks move from BrainSystem to BlackboardManager. Same scene-level effects (workstation glow, actor seated pose), different trigger point.

### CLI Brain Bridge

The current `wireCliBrainBridge` in engine-simulation.ts dispatches CLI-originated events to `brainSystem.applyEvent()`. After migration, it writes to the blackboard:

```typescript
// Old: wireCliBrainBridge → brainSystem.applyEvent(name, type)
// New: wireCliBrainBridge → blackboard.get(name).intent = mapCliEventToIntent(type)
```

CLI events (`task-started`, `task-completed`, `thinking`, `speaking`, etc.) map directly to blackboard intent values.

### Store / Postframe Adapter

The postframe handler currently reads `brain.getAllEntries()` and `brain.getState()` to push positions/states to the DashboardStore. After migration, it reads from the BlackboardManager:

```typescript
// Old: brain.getAllEntries() → { state, position, ... }
// New: blackboards.getAll() → { intent, position, isMoving, ... }
```

BlackboardManager exposes `getAll(): ReadonlyMap<string, AgentBlackboard>` for the store adapter.

### Performance Instrumentation

The current per-phase and per-agent perf sampling (`runTimedPhase`, `runTimedGameSystem`, `runAgentSlice`, `perfSampler`) carries over to the new phases. Each of the 13 phases gets its own timing label. Per-agent slicing applies within tickBehaviorTree, tickLocomotion, and tickSensors.

## Needs System Adaptation

Currently `NeedsSystem.update()` reads brain state to determine decay rates. After the migration, it reads `intent` from the blackboard:

```typescript
// Current
const state = getState(name);  // brain state: "idle", "working", etc.
const rates = DECAY[state];

// New
const intent = blackboard.get(name).intent;  // "idle", "working", etc.
const rates = DECAY[intent];
```

The DECAY table keys already match the intent values. Minimal change.

## Object Interaction (Food/Drink/Rest)

Currently handled by `tryObjectAttraction` (legacy, probabilistic, per-frame). Replaced by:

1. **Sensor phase** writes `nearestFoodStation`, `nearestDrinkStation`, `nearestRestStation` to blackboard every frame (nearest unoccupied station in same room)
2. **BT** `NeedsHunger` subtree reads `bb.nearestFoodStation`, writes `movementCommand: "walk-to"` + `movementTarget`
3. **Locomotion** walks agent to station
4. **BT** detects `arrived === true`, writes `intent: "idle"` (agent is at station)
5. **Needs effects** applied through interactable occupy/vacate cycle (existing `InteractableActor` pattern, now triggered by BT arrival detection)

The probabilistic attraction chance is replaced by deterministic BT threshold conditions — agents go to food when hungry, not by random chance.

## Cascade Reactions

Currently cascade reactions (from echo system) call `walkTo()` / `applyEvent()` directly on the brain. After migration:

1. Cascade resolver writes hints to blackboard via sensor phase: `bb.cascadeHint`, `bb.cascadeTarget`
2. BT reads cascade hints as conditions in a new `CascadeResponse` subtree
3. BT decides whether to act on the hint (can ignore if higher-priority need)
4. If acting: writes movement command to blackboard

This makes cascades advisory inputs to the BT, not forced overrides.

## Pet System

Pet BTs already use a separate tick rate and their own context. The migration:
- Pets get their own `PetBlackboard` (simpler — no needs, no goals)
- `PetActor` gets `MovementComponent`
- `LocomotionSystem` processes pets the same as agents
- Pet BT writes to `PetBlackboard`, push/pull syncs with components

## Testing Strategy

- **Blackboard**: Unit tests for push/pull sync, data isolation per agent
- **LocomotionSystem**: Unit tests for walk-to, wander, arrival detection, separation
- **BT actions**: Update all existing BT tests to write/read blackboard instead of collect/applyEvent
- **Integration**: End-to-end tests that verify sensor → BT → blackboard → locomotion → arrival flow
- **Presentation**: Verify talk engine, bubbles, emotes read from intent correctly

## Verification

After implementation:
- Agents idle naturally, wander smoothly, return to idle (locomotion handles rhythm)
- Seek actions walk to actual stations (sensor provides positions, BT commands, locomotion executes)
- Food/drink/rest interactions work through BT arrival detection
- Talk engine fires ambient chatter during idle intent
- No competing decision systems — BT is the sole decision-maker
- No bridges, guards, or hacks — blackboard is the single data bus
- Cascades are advisory inputs, not forced overrides
- Engine simulation is 6 clean phases, not 12 entangled functions
- All tests pass
