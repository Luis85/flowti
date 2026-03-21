# Scene & Entity Management Refactor — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Flowti Plugin — `src/game/`

## Problem

The game engine has grown organically, resulting in:

1. **Two parallel room-switching systems** — agents use brain system + distance checks, pets use actor flags. Different mechanisms, duplicated logic, inconsistent behavior.
2. **Two scene classes** — `HubScene` and `RoomScene` with duplicated but inconsistent agent management APIs (`updateAgents` vs `spawnAgent`, different door positions, different enter/exit patterns).
3. **Scattered entity tracking** — `agentRoomMap`, `petRoomMap`, `petTransitTargets`, `agentsInTransit` are all separate maps in engine.ts with no shared abstraction.
4. **No global object catalog** — agents can't make purposeful cross-room decisions ("I need coffee → it's in office → go there"). Object locations are implicit in scene membership.
5. **Cross-room bugs** — brain system separation, social proximity, and object attraction have required incremental room-awareness patches because there's no centralized room knowledge.

## Design

### Entity Tiers

Three tiers of world entities:

| Tier | Examples | Moves rooms? | Has behavior? | Knowledge |
|------|----------|-------------|---------------|-----------|
| **Static** | Coffee machine, whiteboard, workstations, plant, fish tank | No | No | Registered in global catalog |
| **Creature** | Cat, dog, bird | Yes (frequent, explore only) | Simple state machine | Current room only |
| **Agent** | Bob, Tech Lead, etc. | Yes (explore + purpose) | Brain system + LLM | Current room + global object catalog |

Fish tank is classified as **Static** (speed=0, never moves, no behavior). It uses the same `InteractableActor` base as other objects.

### SceneEntity Interface

Shared contract for agents and creatures so the transfer system and scenes handle them uniformly. Named `SceneEntity` to avoid collision with the existing `WorldEntity` type in `data/types.ts` (which represents CLI world-state entities).

```typescript
interface SceneEntity {
  readonly entityId: string;       // "Bob" or "cat-hub"
  readonly entityType: "agent" | "creature";

  // The underlying ExcaliburJS actor (created fresh on each scene enter)
  createActor(x: number, y: number): ex.Actor;

  // Movement (called by RoomSwitcher)
  moveTo(x: number, y: number): void;
  getPosition(): { x: number; y: number };

  // Room transfer lifecycle
  onExitScene(): void;
  onEnterScene(x: number, y: number): void;
}
```

**Actor lifecycle — kill-and-recreate pattern:**
The `exit()` method kills the current actor. The `enter()` method calls `createActor()` to build a fresh actor at the spawn position. This matches the current agent pattern (kill old + spawn new) and avoids ExcaliburJS issues with reusing killed actors. Creatures switch from the current reuse pattern (`scene.remove` + `scene.add`) to kill-and-recreate for consistency.

**Agent implementation:**
- `createActor(x, y)` — creates a new `AgentActor` with sprites from the sprite registry
- `moveTo(x, y)` — calls `brainSystem.walkTo(this.entityId, {x, y})`. The agent wrapper holds a reference to the brain system (injected at construction).
- `onExitScene()` — vacates workstation, clears bubbles, clears brain walk target
- `onEnterScene(x, y)` — sets actor position, updates brain position to match

**Creature implementation:**
- `createActor(x, y)` — creates a new `PetActor` with Canvas graphics at the given position
- `moveTo(x, y)` — calls `walkToExit(x, y)` (for door walks) or sets position directly
- `onExitScene()` — clears follow target, stops exiting state
- `onEnterScene(x, y)` — sets position, calls `resetHome()` with pause timer

### GameScene — Unified Scene Class

Replaces both `HubScene` and `RoomScene`. Config-driven:

```typescript
interface GameSceneConfig {
  id: string;                              // "hub" | "office" | "village" | "station"
  label: string;
  doors: DoorConfig[];
  drawBackground: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  workstationStyle?: "desk" | "workbench" | "console";
  workstationCount?: number;               // 0 for hub (uses free layout)
  workstationColor?: string;
  overlays?: OverlayConfig[];              // hub-specific UI elements
}

interface DoorConfig {
  target: string;                          // scene id this door connects to
  label: string;
  position: { x: number; y: number };
}

interface OverlayConfig {
  type: "connection-status" | "iteration-badge";
  position: { x: number; y: number };
}
```

**Hub config:**
```typescript
{
  id: "hub",
  label: "Hub",
  doors: [
    { target: "office",  label: "Office",  position: { x: 750, y: 130 } },
    { target: "village", label: "Village", position: { x: 750, y: 250 } },
    { target: "station", label: "Station", position: { x: 750, y: 370 } },
  ],
  workstationCount: 0,
  drawBackground: drawHubFloor,
  overlays: [
    { type: "connection-status", position: { x: 780, y: 20 } },
  ],
}
```

**Room config (office example):**
```typescript
{
  id: "office",
  label: "Office",
  doors: [
    { target: "hub", label: "Back", position: { x: 40, y: 250 } },
  ],
  workstationCount: 6,
  workstationStyle: "desk",
  workstationColor: "#1e3a5f",
  drawBackground: drawOfficeFloor,
}
```

**Layout strategy:**
- `workstationCount > 0`: workstation grid layout (existing RoomScene pattern)
- `workstationCount === 0`: free layout — entities placed wherever they enter, wander freely (hub behavior)

**Player navigation:** `GameScene.onInitialize()` creates `DoorwayActor` instances from `DoorConfig[]`. Each doorway's `onClick` fires the existing `onSceneChange` callback to trigger `engine.goToScene()` with fade transitions. This is orthogonal to entity transfers — player navigation switches the viewed scene, entity transfers move entities between scenes (which can happen while the player is viewing a different scene).

**Hub-specific overlays:** The `overlays` config array lets the hub declare UI elements (connection status label, iteration badge) that `GameScene.onInitialize()` creates as `ex.Label` actors. Other scenes simply have no overlays.

**Unified enter/exit API:**

```typescript
class GameScene extends ex.Scene {
  private readonly entities = new Map<string, SceneEntity>();

  enter(entity: SceneEntity, fromScene: string | null): void {
    // Find door connecting to fromScene
    const door = fromScene ? this.doors.find(d => d.target === fromScene) : null;
    const spawnX = door ? door.position.x + 30 : 200;
    const spawnY = door ? door.position.y + random(-20, 20) : 250;
    const actor = entity.createActor(spawnX, spawnY);
    entity.onEnterScene(spawnX, spawnY);
    this.add(actor);
    this.entities.set(entity.entityId, entity);
  }

  exit(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.onExitScene();
    // Remove actor from scene (ExcaliburJS cleanup)
    this.remove(entity.actor);
    this.entities.delete(entityId);
  }

  getEntity(id: string): SceneEntity | undefined;
  getEntities(): ReadonlyMap<string, SceneEntity>;
  getWorkstations(): readonly WorkstationActor[];
}
```

### SceneRegistry — Global Knowledge

Central source of truth for what's where. Replaces all scattered maps.

```typescript
class SceneRegistry {
  // Entity tracking (agents + creatures)
  getEntityRoom(id: string): string | undefined;
  setEntityRoom(id: string, room: string): void;
  removeEntity(id: string): void;
  getEntitiesInRoom(room: string): string[];

  // Transit state
  setInTransit(id: string, target: string, door: { x: number; y: number }): void;
  clearTransit(id: string): void;
  isInTransit(id: string): boolean;
  getTransit(id: string): { target: string; door: { x: number; y: number } } | undefined;

  // Object catalog (static, registered once at startup)
  registerObject(id: string, room: string, type: string, position: { x: number; y: number }): void;
  findObject(type: string): { room: string; id: string; position: { x: number; y: number } } | undefined;
  findObjectsOfType(type: string): Array<{ room: string; id: string; position: { x: number; y: number } }>;
  getObjectsInRoom(room: string): ObjectEntry[];

  // Scene access (scenes registered once at startup, never unregistered)
  registerScene(id: string, scene: GameScene): void;
  getScene(id: string): GameScene | undefined;
  getAllSceneIds(): string[];
  getDoorBetween(from: string, to: string): DoorConfig | undefined;
}
```

**Object type identifiers for InteractableActor:**
Each interactable gains an `objectId` and `objectType` field:
- `CoffeeMachine` → `{ objectId: "coffee-machine", objectType: "energy" }`
- `WhiteboardActor` → `{ objectId: "whiteboard", objectType: "focus" }`
- `SnackTable` → `{ objectId: "snack-table", objectType: "energy" }`
- `WaterCooler` → `{ objectId: "water-cooler", objectType: "social" }`
- `CouchActor` → `{ objectId: "couch", objectType: "rest" }`
- `PlantActor` → `{ objectId: "plant", objectType: "focus" }`
- `NoticeBoard` → `{ objectId: "notice-board", objectType: "morale" }`

Registration at startup:
```typescript
registry.registerObject(coffeeMachine.objectId, "office", coffeeMachine.objectType, coffeeMachine.pos);
// ... etc for all objects
```

**Replaces:**

| Before (engine.ts) | After (SceneRegistry) |
|---------------------|----------------------|
| `agentRoomMap` | `registry.getEntityRoom()` |
| `petRoomMap` | `registry.getEntityRoom()` |
| `agentsInTransit` | `registry.isInTransit()` |
| `petTransitTargets` | `registry.isInTransit()` |
| Hardcoded object positions | `registry.findObject()` |
| `roomScenes` / `transferScenes` | `registry.getScene()` |

### RoomSwitcher — Unified Transfer System

One system handling all room transitions for agents and creatures.

**Transfer request:**
```typescript
interface TransferRequest {
  entityId: string;
  targetRoom: string;
  reason: "explore" | "purpose";
  targetObject?: string;        // required when reason is "purpose"
}
```

When `reason` is `"purpose"`, `targetObject` must be provided. The post-arrival behavior uses it to walk the agent to the object's position. When `reason` is `"explore"`, `targetObject` is omitted and the entity walks to a random center position after arrival.

**Lifecycle:**
```
idle → walking-to-door → at-door → transferring → entering → idle
```

**Single update method** called once per preframe:
```typescript
roomSwitcher.update(deltaMs)
```

**Responsibilities:**

1. **Explore triggers** — periodic timer (agents: 10s/8% chance, creatures: 8s/25% chance). Picks random different room.
2. **Purpose triggers** — called externally via `roomSwitcher.requestTransfer(req)`: "agent X needs energy → registry.findObject('energy') → office → request transfer"
3. **Route** — `registry.getDoorBetween(current, target)` to find exit door. If no direct door exists (e.g., office→village), route through hub automatically (office→hub, then hub→village on next cycle).
4. **Walk to door** — calls `entity.moveTo(door.x, door.y)` regardless of entity type
5. **Detect arrival** — unified distance check (70px radius to accommodate brain bounds clamping at minX=96)
6. **Transfer** — `currentScene.exit(entityId)` → `targetScene.enter(entity, fromSceneId)` → `registry.setEntityRoom(id, target)`
7. **Post-arrival** — agents: walk to target object position (purpose) or random position (explore). Creatures: idle at door, `resetHome()`.

**Multi-hop routing:** Rooms only have a door back to hub, so office↔village requires two transfers (office→hub→village). The switcher handles this: when `getDoorBetween(office, village)` returns `undefined`, the switcher routes to hub first, then on arrival queues a second transfer to village.

**Transit protection:**
All other systems check `registry.isInTransit(name)` before interrupting:
- Social conversations
- Cluster huddles
- Engagement
- Ritual phases
- Needs thresholds
- World events (standup, etc.)

### Purpose-Driven Room Switching

The existing `objectAttractions` array in engine.ts migrates to use the registry:

```typescript
// Current: hardcoded object references
const objectAttractions = [
  { object: coffeeMachine, phase: [...], needCheck: (n) => n.energy < 40, chance: 0.002 },
  ...
];

// After: registry-based lookup
// 1. Check same-room objects first (existing behavior)
for (const obj of registry.getObjectsInRoom(currentRoom)) {
  if (matchesNeed(obj.type, needs) && matchesPhase(obj.type, phase)) {
    brainSystem.walkTo(agentName, obj.position);
    break;
  }
}
// 2. If no match in room, check cross-room objects
if (!foundLocalObject) {
  const crossRoom = registry.findObject(neededType);
  if (crossRoom && crossRoom.room !== currentRoom) {
    roomSwitcher.requestTransfer({ entityId: agentName, targetRoom: crossRoom.room, reason: "purpose", targetObject: crossRoom.id });
  }
}
```

### Room-Aware Systems

All systems use `registry.getEntityRoom()` for room isolation:

| System | How it uses registry |
|--------|---------------------|
| Brain separation | Only separate from same-room entities |
| Brain social facing | Only face same-room agents |
| Social conversations | Only converse with same-room agents |
| Nearby agents | `registry.getEntitiesInRoom(myRoom)` |
| Find nearest agent | Filter by `registry.getEntityRoom()` |
| Pet proximity | Only react to same-room agents |
| Object attraction | Check same room first, then cross-room via registry |

### Subsystem Registration

The existing `registerAgents()` function handles one-time registration of agents across 12+ subsystems (brain, bubble, talk, emote, social, needs, sensor, engagement, ritual, memory, quirk, relationship). This registration is **separate from scene membership** and happens once at startup regardless of which room the agent is in. `SceneRegistry` and `GameScene` only handle spatial tracking. The subsystem registration flow remains in engine.ts unchanged.

## File Structure

**New files:**
```
src/game/
  scenes/game-scene.ts           — unified scene class
  systems/scene-registry.ts      — global entity/object/scene knowledge
  systems/room-switcher.ts       — unified transfer system
  data/scene-configs.ts          — hub/office/village/station configs
  data/scene-entity.ts           — SceneEntity interface
```

**Modified files:**
```
engine.ts                        — remove scattered maps and inline switching logic,
                                   wire registry + switcher. Significant shrink.
actors/pet-actor.ts              — implement SceneEntity, add entityId, createActor
actors/agent-actor.ts            — implement SceneEntity (thin wrappers)
actors/interactable-actor.ts     — add objectId + objectType fields for registry
actors/scene-backgrounds.ts      — add drawHubFloor
```

**Deleted files:**
```
scenes/hub-scene.ts              — replaced by GameScene + hub config
scenes/room-scene.ts             — replaced by GameScene + room configs
scenes/office-scene.ts           — replaced by scene-configs.ts entry
scenes/village-scene.ts          — replaced by scene-configs.ts entry
scenes/station-scene.ts          — replaced by scene-configs.ts entry
```

## Persistence

**Same state files, extended:**
- `world-positions.json` — gains creature entries alongside agents. Same format.
- All other state files unchanged (needs, clock, weather, memory, relationships).

**Creature IDs:** Each creature gets a deterministic string ID based on type and initial room: `"cat-hub"`, `"cat-office"`, `"dog-village"`, etc. These IDs are stable across restarts. Creature definitions remain hardcoded (8 pets: 3 cats, 3 dogs, 1 bird, 1 fish tank). On startup, if a creature ID in the saved file doesn't match any known creature, it's ignored.

**Position entry format (shared for agents + creatures):**
```json
{
  "Bob": { "x": 400, "y": 200, "scene": "office", "state": "idle" },
  "cat-hub": { "x": 300, "y": 250, "scene": "hub", "state": "wandering" }
}
```

**Startup restore flow:**
1. Create all GameScenes from configs, register in SceneRegistry
2. Register static objects in SceneRegistry
3. Load persisted state files (positions, needs, clock, weather, memory, relationships)
4. Create creature instances with deterministic IDs
5. Run `registerAgents()` for one-time subsystem registration (brain, needs, social, etc.)
6. For each agent/creature: look up saved room (fallback to default room from domain) → `scene.enter(entity, null)` with position override if saved
7. Restore needs after registration (register sets defaults, restore overrides)
8. Fade out loading overlay

**Default creature placement (no saved state):**
When no positions file exists, creatures spawn at their hardcoded initial positions:
- `cat-hub`: hub (300, 250)
- `cat-office`: office (350, 300)
- `cat-village`: village (400, 280)
- `dog-office`: office (500, 350)
- `dog-village`: village (300, 200)
- `dog-station`: station (450, 300)
- `bird-village`: village (200, 80)
- Fish tank: static object in station (680, 380)

## Migration Plan

Given that engine.ts is ~1900 lines with 20+ subsystem interactions, the refactor is split into phases:

### Phase 1: SceneRegistry replaces scattered maps
- Create `scene-registry.ts` with entity tracking, transit state, and object catalog
- Replace `agentRoomMap`, `petRoomMap`, `agentsInTransit`, `petTransitTargets` with registry calls
- Pass registry to brain system instead of room getter callback
- All existing behavior preserved, just centralized

### Phase 2: GameScene replaces scene classes
- Create `game-scene.ts` with config-driven doors, workstations, background
- Create `scene-configs.ts` with hub/office/village/station configs
- Migrate hub overlays (connection status, iteration badge) to overlay config
- Add `drawHubFloor` to scene-backgrounds.ts
- Delete old scene files

### Phase 3: SceneEntity + RoomSwitcher
- Create `scene-entity.ts` interface
- Implement SceneEntity on AgentActor and PetActor
- Create `room-switcher.ts` with unified transfer system
- Remove inline pet/agent switching logic from engine.ts
- Add cross-room object attraction via registry

Each phase is independently testable and deployable.

## Non-Goals

- No ECS migration — the three-tier model is sufficient
- No dynamic scene creation — four scenes are fixed
- No object mobility — statics stay static
- No cross-room pathfinding — agents walk to door, transfer, then walk to destination
- No scene unregistration — four scenes are registered once and persist for the engine lifetime
