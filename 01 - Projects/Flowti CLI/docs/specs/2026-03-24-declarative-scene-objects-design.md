# Declarative Scene Objects — Design Spec

**Date**: 2026-03-24
**Project**: Flowti Plugin (Agent World)
**Status**: Approved

## Problem

Adding a new interactive object to the game world requires touching 5+ files: a new actor class, the EnvironmentalObjects interface, the factory function, position config, scene assignment config, manual scene.add() calls, station arrays in simulation, and test mocks. This is brittle, error-prone, and doesn't scale — especially with user-placed objects and new rooms planned for the next iteration.

## Goal

A single JSON config file (`configs/scene-objects.json`) declares all interactive objects. The engine reads it at startup and creates, registers, and places objects automatically. Adding a new object = one JSON entry + optionally one draw function. No TypeScript interface changes, no test updates.

## Architecture

### Config Schema

`configs/scene-objects.json` is the single source of truth for all interactive scene objects:

```json
{
  "objects": [
    {
      "id": "food-bowl-hub",
      "type": "food",
      "room": "hub",
      "position": { "x": 200, "y": 380 },
      "size": { "width": 32, "height": 32 },
      "needsEffects": { "hunger": 30 },
      "graphic": "food-bowl"
    },
    {
      "id": "new-shrine",
      "type": "morale",
      "room": "village",
      "position": { "x": 350, "y": 60 },
      "size": { "width": 32, "height": 40 },
      "needsEffects": { "morale": 15 },
      "sprite": "assets/Backgrounds/Tilesets/Interior/Elements.png",
      "spriteRect": { "x": 0, "y": 0, "width": 16, "height": 16 }
    }
  ]
}
```

**Field rules:**
- Required: `id` (unique string), `type` (food | drink | energy | rest | social | focus | morale | shop), `room` (valid RoomId), `position` ({x, y}), `size` ({width, height})
- Optional: `needsEffects` (partial AgentNeeds, defaults to `{}`)
- Graphics: exactly one of `graphic` (canvas registry name) or `sprite` + optional `spriteRect` (asset path + tile region)

### GenericInteractable Actor

A single class replaces all 9 specific actor classes:

```typescript
class GenericInteractable extends InteractableActor {
    constructor(config: SceneObjectConfig, graphic: ex.Graphic) {
        super({
            objectId: config.id,
            objectType: config.type,
            width: config.size.width,
            height: config.size.height,
            interactionOffset: { x: 0, y: 0 },
            needsEffects: config.needsEffects ?? {},
        });
        this.graphics.use(graphic);
    }
}
```

No interaction offset — agents walk to the actor's position directly and the locomotion arrival threshold handles proximity.

### Interaction Events

The factory wires pointer events on every object generically:

**Click** — dispatches `object-interact` custom DOM event:
```typescript
new CustomEvent("object-interact", {
    bubbles: true,
    detail: { objectId, objectType },
})
```

**Hover** — dispatches `object-hover` and applies universal glow:
```typescript
// pointerenter
engine.canvas.classList.add("ft-cursor-pointer");
// Apply brightness/opacity boost
new CustomEvent("object-hover", {
    bubbles: true,
    detail: { objectId, objectType, hover: true },
})

// pointerleave
engine.canvas.classList.remove("ft-cursor-pointer");
// Remove brightness/opacity boost
new CustomEvent("object-hover", {
    bubbles: true,
    detail: { objectId, objectType, hover: false },
})
```

The merchant UI subscribes to `object-interact` and filters by `objectId === "merchant-stall"`. This replaces the MerchantStall's custom `merchant-stall-click` event. Future interactive panels (quest board, training dummy stats) filter the same way.

### Graphic Registry

`actors/graphic-registry.ts` — a `Map<string, (width: number, height: number) => ex.Canvas>`:

Extracts the 9 existing canvas draw functions from old actor files:
- `"food-bowl"`, `"water-bowl"`, `"coffee-machine"`, `"snack-table"`, `"water-cooler"`, `"couch"`, `"plant"`, `"notice-board"`, `"merchant-stall"`, `"whiteboard"`

New canvas graphics = add one function. Sprite-based objects skip the registry entirely.

### SceneObjectFactory

`systems/scene-object-factory.ts` — single entry point replacing `createEnvironmentalObjects()`, `registerEnvironmentalObjects()`, and manual `scene.add()` calls.

```typescript
interface SceneObjectFactoryDeps {
    registry: SceneRegistry;
    scenes: Record<string, GameScene>;
    engine: ex.Engine;
    spriteBasePath: string;
}

class SceneObjectFactory {
    async createAll(
        config: SceneObjectConfig[],
        deps: SceneObjectFactoryDeps,
    ): Promise<ReadonlyMap<string, GenericInteractable>>
}
```

**Startup flow:**
```
scene-objects.json
    | read + validate
SceneObjectFactory.createAll()
    | for each entry:
    |-- resolve graphic (registry) or sprite (loadItemSprite)
    |-- create GenericInteractable(config, graphic)
    |-- wire pointer events (click, hover)
    |-- register in SceneRegistry
    |-- add to correct GameScene
    | returns
Map<string, GenericInteractable>  (keyed by objectId)
```

**Validation at startup:**
- `id` is unique
- `room` is a valid `RoomId`
- Either `graphic` exists in the registry or `sprite` path is loadable
- `size.width` and `size.height` are positive
- Logs warning and skips invalid entries (non-fatal)

### Registry Changes

`SceneRegistry` gets one new method for station lookups:

```typescript
getInteractablesOfType(type: string, room?: string): InteractableActor[]
```

The factory stores actor references in the registry alongside metadata. This replaces hardcoded station arrays in `engine-simulation.ts`:

```typescript
// Before:
const foodStations = [ctx.envObjects.snackTable, ctx.envObjects.foodBowlHub, ...];

// After:
const foodStations = ctx.systems.registry.getInteractablesOfType("food");
```

### Engine Integration

`engine-types.ts`:
- `EngineEnvObjects` interface replaced with `ReadonlyMap<string, GenericInteractable>` (or removed entirely if all access goes through the registry)

`engine.ts`:
- Replace the object creation block (~30 lines of manual instantiation + scene.add) with a single `factory.createAll()` call

`engine-simulation.ts`:
- Station lookups in `getNearestStation` use `registry.getInteractablesOfType(type)` filtered by room
- No more hardcoded station arrays

---

## File Plan

### New Files

| File | Purpose |
|------|---------|
| `configs/scene-objects.json` | Object definitions (15 entries) |
| `data/scene-object-schema.ts` | TypeScript types + validation for JSON schema |
| `actors/generic-interactable.ts` | Single actor class (~30 lines) |
| `actors/graphic-registry.ts` | 10 named canvas draw functions extracted from old actors |
| `systems/scene-object-factory.ts` | Read JSON, create actors, register, place in scenes |

### Deleted Files

| File | Reason |
|------|--------|
| `actors/food-bowl.ts` | Draw function extracted to graphic-registry |
| `actors/water-bowl.ts` | Draw function extracted to graphic-registry |
| `actors/coffee-machine.ts` | Draw function extracted to graphic-registry |
| `actors/snack-table.ts` | Draw function extracted to graphic-registry |
| `actors/water-cooler.ts` | Draw function extracted to graphic-registry |
| `actors/couch-actor.ts` | Draw function extracted to graphic-registry |
| `actors/plant-actor.ts` | Draw function extracted to graphic-registry |
| `actors/notice-board.ts` | Draw function extracted to graphic-registry |
| `actors/whiteboard-actor.ts` | Draw function extracted to graphic-registry |
| `actors/merchant-stall.ts` | Draw function extracted; click handler moves to event system |

### Modified Files

| File | Change |
|------|--------|
| `engine.ts` | Replace object creation block with `factory.createAll()` |
| `engine-objects.ts` | Remove `EnvironmentalObjects` + factory; keep pet creation |
| `engine-types.ts` | Replace `EngineEnvObjects` with map or remove |
| `engine-config.ts` | Remove `OBJECT_POSITIONS`, `OBJECT_SCENE_ASSIGNMENTS` |
| `engine-simulation.ts` | Station lookups via `registry.getInteractablesOfType()` |
| `systems/scene-registry.ts` | Add `getInteractablesOfType()`, store actor refs |
| `engine-events.ts` | Merchant click handler subscribes to `object-interact` event |

### Test Files

| File | Coverage |
|------|----------|
| `actors/generic-interactable.test.ts` | Construction, graphic application, event wiring |
| `actors/graphic-registry.test.ts` | All 10 named graphics resolve, unknown name returns undefined |
| `systems/scene-object-factory.test.ts` | JSON parsing, validation, creation, registration, invalid entry handling |
| `systems/scene-registry.test.ts` | Extend with `getInteractablesOfType` tests |

Old actor tests (`food-bowl.test.ts`, `water-bowl.test.ts`, `interactable-actor.test.ts`) are deleted or migrated to test `GenericInteractable`.

---

## Adding a New Object (Post-Refactor)

1. Add one entry to `configs/scene-objects.json`
2. If new canvas graphic needed: add one draw function to `graphic-registry.ts`
3. If sprite-based: just reference the asset path in JSON
4. Done. No other files change.
