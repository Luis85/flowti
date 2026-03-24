# Declarative Scene Objects — Design Spec

**Date**: 2026-03-24
**Project**: Flowti Plugin (Agent World)
**Status**: Approved

## Problem

Adding a new interactive object to the game world requires touching 5+ files: a new actor class, the EnvironmentalObjects interface, the factory function, position config, scene assignment config, manual scene.add() calls, station arrays in simulation, and test mocks. This is brittle, error-prone, and doesn't scale — especially with user-placed objects and new rooms planned for the next iteration.

## Goal

A single JSON config file (`configs/scene-objects.json`) declares all interactive objects. The engine reads it at startup and creates, registers, and places objects automatically. Adding a new object = one JSON entry + optionally one draw function.

## Scope

- **In scope**: All 15 interactive `InteractableActor` instances created from 10 actor classes
- **Out of scope**: WorkstationActors (already declarative via scene config), PetActors (separate lifecycle), AgentActors (created from agent definitions), DoorwayActors (navigation infrastructure)

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
      "interactionOffset": { "x": 0, "y": 20 },
      "needsEffects": { "hunger": 30 },
      "graphic": "food-bowl"
    },
    {
      "id": "coffee-machine",
      "type": "energy",
      "room": "office",
      "position": { "x": 680, "y": 120 },
      "size": { "width": 32, "height": 40 },
      "interactionOffset": { "x": 0, "y": 24 },
      "needsEffects": { "energy": 15, "focus": 5, "thirst": 20 },
      "graphic": "coffee-machine"
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
- Optional: `interactionOffset` ({x, y}, defaults to `{x: 0, y: 0}`) — where agents stand relative to the object center. Existing objects use y offsets of 16-30px so agents stand below/in front of the object rather than overlapping it.
- Optional: `needsEffects` (partial AgentNeeds, defaults to `{}`)
- Graphics: exactly one of `graphic` (canvas registry name) or `sprite` + optional `spriteRect` (asset path + tile region)

### GenericInteractable Actor

A single class replaces all 10 specific actor classes:

```typescript
class GenericInteractable extends InteractableActor {
    constructor(config: SceneObjectConfig, graphic: ex.Graphic) {
        super({
            objectId: config.id,
            objectType: config.type,
            width: config.size.width,
            height: config.size.height,
            interactionOffset: config.interactionOffset ?? { x: 0, y: 0 },
            needsEffects: config.needsEffects ?? {},
        });
        this.graphics.use(graphic);
    }
}
```

### Interaction Events

The factory wires pointer events on every object generically:

**Click** — dispatches `object-interact` custom DOM event:
```typescript
new CustomEvent("object-interact", {
    bubbles: true,
    detail: { objectId, objectType },
})
```

**Hover** — dispatches `object-hover`, applies glow, and rebuilds graphic if parameterized:
```typescript
// pointerenter
engine.canvas.classList.add("ft-cursor-pointer");
actor.setHovered(true);   // triggers graphic rebuild with hover state
new CustomEvent("object-hover", {
    bubbles: true,
    detail: { objectId, objectType, hover: true },
})

// pointerleave
engine.canvas.classList.remove("ft-cursor-pointer");
actor.setHovered(false);
new CustomEvent("object-hover", {
    bubbles: true,
    detail: { objectId, objectType, hover: false },
})
```

`GenericInteractable.setHovered(hovered: boolean)` stores the hover state and rebuilds the graphic. Canvas draw functions receive the hover state as a parameter so they can adjust colors (e.g., merchant stall's gold border on hover). Sprite-based objects get a generic opacity/tint boost.

The merchant UI subscribes to `object-interact` and filters by `objectId === "merchant-stall"`. This replaces the MerchantStall's custom `merchant-stall-click` event. Future interactive panels (quest board, training dummy stats) filter the same way.

### Graphic Registry

`actors/graphic-registry.ts` — a `Map<string, (width: number, height: number, hovered: boolean) => ex.Canvas>`:

Extracts the 10 existing canvas draw functions from old actor files:
- `"food-bowl"`, `"water-bowl"`, `"coffee-machine"`, `"snack-table"`, `"water-cooler"`, `"couch"`, `"plant"`, `"notice-board"`, `"merchant-stall"`, `"whiteboard"`

Draw functions receive a `hovered` boolean parameter to support per-graphic hover effects (e.g., merchant stall changes border color, others can adjust brightness).

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
    |-- register in SceneRegistry (metadata + actor ref)
    |-- add to correct GameScene
    | returns
Map<string, GenericInteractable>  (keyed by objectId)
```

**Validation** (hand-written, no schema library — zero runtime deps):
- `id` is unique across all entries
- `room` is a valid `RoomId` from `ROOM_IDS`
- Either `graphic` exists in the registry or `sprite` path is non-empty
- `size.width` and `size.height` are positive numbers
- Invalid entries: logged to console as warnings with the object `id` and reason, then skipped (non-fatal)

### Registry Changes

`SceneRegistry` stores actor references alongside existing metadata. The `ObjectEntry` type gains an optional `actor` field:

```typescript
interface ObjectEntry {
    readonly id: string;
    readonly room: string;
    readonly type: string;
    readonly position: { readonly x: number; readonly y: number };
    readonly actor?: InteractableActor;  // set by factory, used for lookups
}
```

New method for station lookups:

```typescript
getInteractablesOfType(type: string, room?: string): InteractableActor[]
```

Returns `entry.actor` for all entries matching the type (and optionally room). This replaces the existing `findObjectsOfType()` (metadata-only) for use cases that need the live actor. Both methods coexist — metadata queries remain available for cases that don't need actor references.

### Engine Integration

**`engine-types.ts`**:
- Remove `EngineEnvObjects` interface entirely. All object access goes through the registry or the `Map<string, GenericInteractable>` returned by the factory (stored as `ctx.objectMap`).

**`engine.ts`**:
- Replace the object creation block (~40 lines of manual instantiation + `scene.add`) with `factory.createAll()`
- Store the returned map as `ctx.objectMap` for any direct-by-id lookups

**`engine-simulation.ts`**:
- `getNearestStation` uses `registry.getInteractablesOfType(type)` filtered to the agent's room
- No more hardcoded station arrays

**`engine-events.ts`** — 5 named object references to migrate:
- Line 131: `ctx.envObjects.coffeeMachine.getInteractionPoint()` (tea-time) → `ctx.objectMap.get("coffee-machine")?.getInteractionPoint()`
- Line 170: `ctx.envObjects.snackTable.pos` (birthday confetti) → `ctx.objectMap.get("snack-table")?.pos`
- Line 190: `ctx.envObjects.whiteboard.getInteractionPoint()` (new-PR walk) → `ctx.objectMap.get("whiteboard")?.getInteractionPoint()`
- Line 193: `ctx.envObjects.whiteboard.pos` (new-PR particles) → `ctx.objectMap.get("whiteboard")?.pos`
- Merchant click handler → subscribe to `object-interact` event, filter by `detail.objectId === "merchant-stall"`

All map lookups use optional chaining — if an object is removed from the JSON config, the event handler gracefully no-ops instead of crashing.

---

## File Plan

### New Files

| File | Purpose |
|------|---------|
| `configs/scene-objects.json` | All 15 object definitions |
| `data/scene-object-schema.ts` | TypeScript types + hand-written validation |
| `actors/generic-interactable.ts` | Single actor class with hover support (~40 lines) |
| `actors/graphic-registry.ts` | 10 named canvas draw functions with hover parameter |
| `systems/scene-object-factory.ts` | Read JSON, validate, create actors, register, place in scenes |

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
| `actors/merchant-stall.ts` | Draw function extracted; click/hover behavior now generic |

### Renamed Files

| From | To | Reason |
|------|----|--------|
| `engine-objects.ts` | `engine-pets.ts` | Only pet creation remains after removing object factory |

### Modified Files

| File | Change |
|------|--------|
| `engine.ts` | Replace object creation with `factory.createAll()`, store `objectMap` |
| `engine-types.ts` | Remove `EngineEnvObjects`, add `objectMap: ReadonlyMap<string, GenericInteractable>` to context |
| `engine-config.ts` | Remove `OBJECT_POSITIONS`, `OBJECT_SCENE_ASSIGNMENTS` |
| `engine-simulation.ts` | Station lookups via `registry.getInteractablesOfType()` |
| `systems/scene-registry.ts` | Add `actor` to ObjectEntry, add `getInteractablesOfType()` |
| `engine-events.ts` | Migrate 4 named object refs to `objectMap.get()`, merchant handler to `object-interact` event |

### Test Files

| File | Coverage |
|------|----------|
| `actors/generic-interactable.test.ts` | Construction, graphic application, hover toggle, event wiring |
| `actors/graphic-registry.test.ts` | All 10 named graphics resolve with hovered=true/false, unknown name returns undefined |
| `systems/scene-object-factory.test.ts` | JSON parsing, validation, creation, registration, invalid entry skip + warning |
| `systems/scene-registry.test.ts` | Extend with `getInteractablesOfType` tests (with/without room filter) |

Old actor tests (`food-bowl.test.ts`, `water-bowl.test.ts`, etc.) are deleted. `interactable-actor.test.ts` is retained (base class unchanged).

---

## Adding a New Object (Post-Refactor)

1. Add one entry to `configs/scene-objects.json`
2. If new canvas graphic needed: add one draw function to `graphic-registry.ts`
3. If sprite-based: just reference the asset path in JSON
4. Done. No other files change.
