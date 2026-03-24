# Declarative Scene Objects — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 10 hardcoded actor classes with a single JSON-driven declarative system where adding a new object = one JSON entry + optionally one draw function.

**Architecture:** A `scene-objects.json` config declares all 16 interactive objects. `SceneObjectFactory` reads the JSON at startup, resolves graphics from a canvas registry, creates `GenericInteractable` actors, wires pointer events, registers them in `SceneRegistry`, and adds them to scenes. The factory is synchronous (all current objects use canvas graphics). Async sprite loading can be added later when sprite-based objects are introduced. The old `EngineEnvObjects` interface and 10 actor classes are deleted.

**Tech Stack:** TypeScript, ExcaliburJS, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-24-declarative-scene-objects-design.md`

**Test command:** `cd "01 - Projects/Flowti Plugin" && npx vitest run <test-file>`

**All source paths are relative to:** `01 - Projects/Flowti Plugin/`

---

## Chunk 1: Foundation

### Task 1: Create Scene Object Schema Types + Validation

**Files:**
- Create: `src/game/data/scene-object-schema.ts`
- Test: `tests/game/data/scene-object-schema.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/data/scene-object-schema.test.ts` with tests for:
- Valid object config passes validation
- Missing `id` fails
- Missing `room` fails
- Invalid `room` (not in ROOM_IDS) fails
- Negative `size.width` fails
- Duplicate `id` across array fails
- Object with neither `graphic` nor `sprite` fails
- Object with both `graphic` and `sprite` passes (sprite wins)
- `needsEffects` defaults to `{}` when omitted
- `interactionOffset` defaults to `{x:0, y:0}` when omitted

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

- [ ] **Step 3: Create the schema file**

Create `src/game/data/scene-object-schema.ts`:

```typescript
import { ROOM_IDS, type RoomId } from "./scene-configs.js";

export interface SceneObjectConfig {
	readonly id: string;
	readonly type: string;
	readonly room: RoomId;
	readonly position: { readonly x: number; readonly y: number };
	readonly size: { readonly width: number; readonly height: number };
	readonly interactionOffset?: { readonly x: number; readonly y: number };
	readonly needsEffects?: Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }>;
	readonly graphic?: string;
	readonly sprite?: string;
	readonly spriteRect?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export interface ValidationResult {
	readonly valid: boolean;
	readonly errors: string[];
}

export function validateSceneObjects(objects: unknown[]): ValidationResult {
	const errors: string[] = [];
	const ids = new Set<string>();
	const roomSet = new Set<string>(ROOM_IDS);

	for (let i = 0; i < objects.length; i++) {
		const o = objects[i] as Record<string, unknown>;
		const prefix = `objects[${i}]`;

		if (!o.id || typeof o.id !== "string") { errors.push(`${prefix}: missing or invalid id`); continue; }
		if (ids.has(o.id as string)) { errors.push(`${prefix}: duplicate id "${o.id}"`); continue; }
		ids.add(o.id as string);

		if (!o.room || !roomSet.has(o.room as string)) errors.push(`${prefix} (${o.id}): invalid room "${o.room}"`);
		if (!o.type || typeof o.type !== "string") errors.push(`${prefix} (${o.id}): missing type`);

		const size = o.size as Record<string, number> | undefined;
		if (!size || size.width <= 0 || size.height <= 0) errors.push(`${prefix} (${o.id}): invalid size`);

		const pos = o.position as Record<string, number> | undefined;
		if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") errors.push(`${prefix} (${o.id}): invalid position`);

		if (!o.graphic && !o.sprite) errors.push(`${prefix} (${o.id}): must have graphic or sprite`);
	}

	return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Commit** `feat(plugin): add scene object schema types and validation`

---

### Task 2: Create scene-objects.json Config

**Files:**
- Create: `configs/scene-objects.json`

- [ ] **Step 1: Create JSON with all 15 objects**

Migrate data from `OBJECT_POSITIONS` and `OBJECT_SCENE_ASSIGNMENTS` in `engine-config.ts`, plus constructor configs from each actor class. Each entry needs: id, type, room, position, size, interactionOffset, needsEffects, graphic.

The 16 objects (note: snack-table type changed to "food", water-cooler type changed to "drink" to match how they're actually used in station lookups):

1. `coffee-machine` — type: energy, room: office, pos: (680,120), size: 32×40, offset: (0,24), effects: {energy:15, focus:5, thirst:20}
2. `whiteboard` — type: focus, room: office, pos: (400,60), size: 64×48, offset: (0,30), effects: {social:5, focus:3, morale:2}
3. `snack-table` — type: food, room: village, pos: (400,380), size: 48×40, offset: (0,24), effects: {energy:10, social:8, morale:3, hunger:25}
4. `water-cooler` — type: drink, room: village, pos: (600,380), size: 24×40, offset: (0,24), effects: {social:10, thirst:15}
5. `couch` — type: rest, room: station, pos: (400,380), size: 64×36, offset: (0,20), effects: {energy:20, morale:5}
6. `plant` — type: focus, room: hub, pos: (100,60), size: 20×28, offset: (0,16), effects: {}
7. `notice-board` — type: morale, room: hub, pos: (680,60), size: 48×40, offset: (0,24), effects: {}
8. `merchant-stall` — type: shop, room: hub, pos: (300,60), size: 48×48, offset: (0,24), effects: {}
9. `food-bowl-hub` — type: food, room: hub, pos: (200,380), size: 32×32, offset: (0,20), effects: {hunger:30}
10. `food-bowl-village` — type: food, room: village, pos: (250,350), size: 32×32, offset: (0,20), effects: {hunger:30}
11. `food-bowl-office` — type: food, room: office, pos: (200,380), size: 32×32, offset: (0,20), effects: {hunger:30}
12. `food-bowl-station` — type: food, room: station, pos: (200,350), size: 32×32, offset: (0,20), effects: {hunger:30}
13. `water-bowl-office` — type: drink, room: office, pos: (580,120), size: 32×32, offset: (0,20), effects: {thirst:25}
14. `water-bowl-station` — type: drink, room: station, pos: (550,350), size: 32×32, offset: (0,20), effects: {thirst:25}
15. `water-bowl-hub` — type: drink, room: hub, pos: (600,380), size: 32×32, offset: (0,20), effects: {thirst:25}
16. `water-bowl-village` — type: drink, room: village, pos: (350,350), size: 32×32, offset: (0,20), effects: {thirst:25}

- [ ] **Step 2: Write a test that loads and validates the JSON**

```typescript
import config from "../../../../configs/scene-objects.json";
import { validateSceneObjects } from "../../../src/game/data/scene-object-schema.js";

it("scene-objects.json is valid", () => {
	const result = validateSceneObjects(config.objects);
	expect(result.valid).toBe(true);
	expect(result.errors).toEqual([]);
});

it("has 16 objects", () => {
	expect(config.objects).toHaveLength(16);
});

it("every room has at least one food and one drink station", () => {
	for (const room of ["hub", "office", "village", "station"]) {
		const food = config.objects.filter((o) => o.room === room && o.type === "food");
		const drink = config.objects.filter((o) => o.room === room && o.type === "drink");
		expect(food.length, `${room} missing food`).toBeGreaterThanOrEqual(1);
		expect(drink.length, `${room} missing drink`).toBeGreaterThanOrEqual(1);
	}
});
```

- [ ] **Step 3: Run tests — expect PASS**
- [ ] **Step 4: Commit** `feat(plugin): add scene-objects.json config`

---

### Task 3: Create Graphic Registry

**Files:**
- Create: `src/game/actors/graphic-registry.ts`
- Test: `tests/game/actors/graphic-registry.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:
- All 10 named graphics resolve (return a function)
- Each graphic function accepts `(width, height, hovered)` and returns an `ex.Canvas`
- Unknown graphic name returns `undefined`
- Hover state changes output (test merchant-stall specifically)

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Create graphic-registry.ts**

Extract the canvas draw code from each of the 10 actor classes into named functions:

```typescript
import * as ex from "excalibur";

type DrawFn = (width: number, height: number, hovered: boolean) => ex.Canvas;

const registry = new Map<string, DrawFn>();

function registerGraphic(name: string, fn: DrawFn): void {
	registry.set(name, fn);
}

export function getGraphic(name: string): DrawFn | undefined {
	return registry.get(name);
}

export function getGraphicNames(): readonly string[] {
	return [...registry.keys()];
}

// ── Food Bowl ────────────────────────────────────────────────
registerGraphic("food-bowl", (width, height, _hovered) => {
	return new ex.Canvas({ width, height, draw: (ctx) => {
		// Extract from food-bowl.ts lines 23-78
		// Bowl shadow, wooden layers, food pieces, wood grain, label
	}});
});

// ── Water Bowl ───────────────────────────────────────────────
registerGraphic("water-bowl", (width, height, _hovered) => { /* from water-bowl.ts */ });

// ── Coffee Machine ───────────────────────────────────────────
registerGraphic("coffee-machine", (width, height, _hovered) => { /* from coffee-machine.ts */ });

// ... repeat for all 10: snack-table, water-cooler, couch, plant,
//     notice-board, merchant-stall (uses hovered param), whiteboard
```

Each draw function is a direct copy of the canvas draw callback from the corresponding actor class constructor. The `merchant-stall` function uses the `hovered` parameter to change border color (`"#f5c542"` when hovered, `"#DAA520"` when not).

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Commit** `feat(plugin): add graphic registry with 10 canvas draw functions`

---

## Chunk 2: New Actor + Factory

### Task 4: Create GenericInteractable

**Files:**
- Create: `src/game/actors/generic-interactable.ts`
- Test: `tests/game/actors/generic-interactable.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:
- Constructor sets objectId, objectType, size from config
- Constructor applies interactionOffset from config
- Constructor defaults interactionOffset to {0,0} when not provided
- Constructor defaults needsEffects to {} when not provided
- `applyGraphic()` sets the graphic
- `setHovered(true)` rebuilds graphic with hovered=true (when graphicName is set)
- `setHovered(false)` rebuilds graphic with hovered=false

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Create generic-interactable.ts**

```typescript
import * as ex from "excalibur";
import { InteractableActor, type InteractableConfig } from "./interactable-actor.js";
import { getGraphic } from "./graphic-registry.js";
import type { SceneObjectConfig } from "../data/scene-object-schema.js";

export class GenericInteractable extends InteractableActor {
	private readonly graphicName: string | undefined;
	private hovered = false;

	constructor(config: SceneObjectConfig) {
		super({
			objectId: config.id,
			objectType: config.type,
			width: config.size.width,
			height: config.size.height,
			interactionOffset: config.interactionOffset ?? { x: 0, y: 0 },
			needsEffects: config.needsEffects ?? {},
		});
		this.graphicName = config.graphic;
		this.rebuildGraphic();
	}

	/** Apply a pre-loaded sprite (for sprite-based objects). */
	applySprite(sprite: ex.Graphic): void {
		this.graphics.use(sprite);
	}

	setHovered(hovered: boolean): void {
		if (this.hovered === hovered) return;
		this.hovered = hovered;
		this.rebuildGraphic();
	}

	private rebuildGraphic(): void {
		if (!this.graphicName) return;
		const drawFn = getGraphic(this.graphicName);
		if (!drawFn) return;
		const canvas = drawFn(this.width, this.height, this.hovered);
		this.graphics.use(canvas);
	}
}
```

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Commit** `feat(plugin): add GenericInteractable actor`

---

### Task 5: Extend SceneRegistry with Actor References

**Files:**
- Modify: `src/game/systems/scene-registry.ts`
- Test: `tests/game/systems/scene-registry.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:
- `registerInteractable(id, actor)` stores actor reference
- `getInteractablesOfType("food")` returns actors of that type
- `getInteractablesOfType("food", "hub")` filters by room
- Returns empty array when no matches
- Works alongside existing `registerObject` metadata

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Add actor storage to SceneRegistry**

Extend `ObjectEntry` interface with optional actor field:
```typescript
export interface ObjectEntry {
	readonly id: string;
	readonly room: string;
	readonly type: string;
	readonly position: { readonly x: number; readonly y: number };
	actor?: InteractableActor;  // set by factory after registration
}
```

Add new methods:
```typescript
registerInteractable(id: string, actor: InteractableActor): void {
	const entry = this.objects.find((o) => o.id === id);
	if (entry) entry.actor = actor;
}

getInteractablesOfType(type: string, room?: string): InteractableActor[] {
	return this.objects
		.filter((o) => o.type === type && (!room || o.room === room) && o.actor)
		.map((o) => o.actor!);
}
```

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Run full registry tests** to verify no regressions
- [ ] **Step 6: Commit** `feat(plugin): add actor references to SceneRegistry`

---

### Task 6: Create SceneObjectFactory

**Files:**
- Create: `src/game/systems/scene-object-factory.ts`
- Test: `tests/game/systems/scene-object-factory.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:
- `createAll()` creates GenericInteractable for each config entry
- Objects are registered in SceneRegistry (both metadata and actor ref)
- Objects with `graphic` name get canvas from registry
- Objects with `sprite` path get sprite loaded
- Invalid config entries are skipped with warning (not thrown)
- Pointer events are wired (click dispatches `object-interact`, hover dispatches `object-hover`)
- `setHovered()` is called on pointerenter/pointerleave
- Object positions are set from config
- Returned map is keyed by objectId

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Create scene-object-factory.ts**

```typescript
import * as ex from "excalibur";
import { GenericInteractable } from "../actors/generic-interactable.js";
import { getGraphic } from "../actors/graphic-registry.js";
import { validateSceneObjects, type SceneObjectConfig } from "../data/scene-object-schema.js";
import type { SceneRegistry } from "./scene-registry.js";
import type { GameScene } from "../scenes/game-scene.js";

export interface SceneObjectFactoryDeps {
	readonly registry: SceneRegistry;
	readonly scenes: Record<string, GameScene>;
	readonly engine: ex.Engine;
	readonly spriteBasePath: string;
}

export function createAllSceneObjects(
	configs: SceneObjectConfig[],
	deps: SceneObjectFactoryDeps,
): ReadonlyMap<string, GenericInteractable> {
	const result = validateSceneObjects(configs);
	for (const err of result.errors) console.warn(`[scene-objects] ${err}`);

	const map = new Map<string, GenericInteractable>();

	for (const config of configs) {
		if (!config.id || !config.room) continue;

		const actor = new GenericInteractable(config);
		actor.pos = ex.vec(config.position.x, config.position.y);

		// Note: sprite-based objects are not yet supported (all current objects use canvas).
		// When sprite support is added, this function will become async.

		// Wire pointer events
		actor.on("pointerdown", () => {
			deps.engine.canvas.dispatchEvent(new CustomEvent("object-interact", {
				bubbles: true,
				detail: { objectId: config.id, objectType: config.type },
			}));
		});
		actor.on("pointerenter", () => {
			deps.engine.canvas.classList.add("ft-cursor-pointer");
			actor.setHovered(true);
			deps.engine.canvas.dispatchEvent(new CustomEvent("object-hover", {
				bubbles: true,
				detail: { objectId: config.id, objectType: config.type, hover: true },
			}));
		});
		actor.on("pointerleave", () => {
			deps.engine.canvas.classList.remove("ft-cursor-pointer");
			actor.setHovered(false);
			deps.engine.canvas.dispatchEvent(new CustomEvent("object-hover", {
				bubbles: true,
				detail: { objectId: config.id, objectType: config.type, hover: false },
			}));
		});

		// Register in scene registry
		deps.registry.registerObject(config.id, config.room, config.type, config.position);
		deps.registry.registerInteractable(config.id, actor);

		// Add to scene
		const scene = deps.scenes[config.room];
		if (scene) scene.add(actor);

		map.set(config.id, actor);
	}

	return map;
}
```

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Commit** `feat(plugin): add SceneObjectFactory`

---

## Chunk 3: Engine Migration

### Task 7: Replace Object Creation in engine.ts

**Files:**
- Modify: `src/game/engine.ts`
- Modify: `src/game/engine-types.ts`

- [ ] **Step 1: Add objectMap to EngineContext**

In `engine-types.ts`, replace `EngineEnvObjects` interface with:
```typescript
// Remove the entire EngineEnvObjects interface (lines 116-129)
// In EngineContext, replace:
//   readonly envObjects: EngineEnvObjects;
// With:
readonly objectMap: ReadonlyMap<string, GenericInteractable>;
```

Import `GenericInteractable` type.

- [ ] **Step 2: Replace object creation in engine.ts**

Replace the block at lines 330-339 (`createEnvironmentalObjects`, destructuring) and lines 457-460 (manual `scene.add` calls) with:

```typescript
import { createAllSceneObjects } from "./systems/scene-object-factory.js";
import sceneObjectsConfig from "../configs/scene-objects.json";

// Synchronous — replaces the old createEnvironmentalObjects() call in createAgentWorld():
const objectMap = createAllSceneObjects(sceneObjectsConfig.objects, {
	registry,
	scenes: { hub: hubScene, office: officeScene, village: villageScene, station: stationScene },
	engine,
	spriteBasePath,
});
```

Remove the `envObjects` destructuring and all manual `scene.add()` calls for interactable objects.

- [ ] **Step 3: Update EngineContext assignment**

Replace the `envObjects: { coffeeMachine, ... }` block with:
```typescript
objectMap,
```

- [ ] **Step 4: Remove old imports**

Remove imports of: `createEnvironmentalObjects`, `registerEnvironmentalObjects`, `EnvironmentalObjects`, `CoffeeMachine`, `WhiteboardActor`, `SnackTable`, `WaterCooler`, `CouchActor`, `PlantActor`, `NoticeBoard`, `MerchantStall`, `FoodBowl`, `WaterBowl`, `OBJECT_POSITIONS`, `OBJECT_SCENE_ASSIGNMENTS`.

- [ ] **Step 5: Run type check** — `npx tsc --noEmit` will show all remaining `envObjects` references that need migration (Tasks 8-9)
- [ ] **Step 6: Commit** `refactor(plugin): replace object creation with SceneObjectFactory`

---

### Task 8: Migrate engine-simulation.ts Station Lookups

**Files:**
- Modify: `src/game/engine-simulation.ts`

- [ ] **Step 1: Replace getNearestStation lambda**

Change from hardcoded arrays to registry queries:

```typescript
getNearestStation: (name, need) => {
	const candidates = ctx.systems.registry.getInteractablesOfType(need === "food" ? "food" : need === "drink" ? "drink" : "rest");
	return findNearestUnoccupiedStation(ctx, name, candidates);
},
```

Also replace `getNearestMerchantStall`:
```typescript
// Before: getNearestMerchantStall: (name) => findNearestUnoccupiedStation(ctx, name, [ctx.envObjects.merchantStall]),
// After:
getNearestMerchantStall: (name) => {
	const stalls = ctx.systems.registry.getInteractablesOfType("shop");
	return findNearestUnoccupiedStation(ctx, name, stalls);
},
```

Note: `snackTable` (type: "energy") also satisfies hunger via needsEffects. The `type` field in JSON determines how the BT sensor categorizes it. Since snackTable's type is `"energy"` (not `"food"`), it won't appear in food queries. However, the BT `SeekFoodStation` action looks for `nearestFoodStation`, which uses the `"food"` type filter. The snack table currently appears in the foodStations array — we need to either:
- Change snackTable's type to `"food"` in the JSON (it has hunger:25), or
- Keep it as `"energy"` and accept that it won't be found by hungry agents

**Decision:** Add a `categories` array to the schema to allow an object to match multiple types. BUT that adds schema complexity. Simpler: just set snackTable's type to `"food"` in the JSON since its primary use is hunger satisfaction. Its energy/social/morale effects still apply via needsEffects regardless of type.

Update `scene-objects.json`: change snack-table type from `"energy"` to `"food"`.

- [ ] **Step 2: Update findNearestUnoccupiedStation signature**

The function currently takes `InteractableActor[]`. After migration, the registry returns `InteractableActor[]` directly — no signature change needed.

- [ ] **Step 3: Run tests** — verify station lookups work
- [ ] **Step 4: Commit** `refactor(plugin): migrate station lookups to registry queries`

---

### Task 9: Migrate engine-events.ts Named Object References

**Files:**
- Modify: `src/game/engine-events.ts`

- [ ] **Step 1: Replace 4 named object references**

Replace `ctx.envObjects.X` with `ctx.objectMap.get("X-id")`:

```typescript
// Tea-time (line 131):
// Before: ctx.envObjects.coffeeMachine.getInteractionPoint()
// After:
const coffeeMachine = ctx.objectMap.get("coffee-machine");
if (coffeeMachine) walkTo(bb, coffeeMachine.getInteractionPoint());

// Birthday (line 170):
// Before: ctx.envObjects.snackTable.pos
// After:
const snackTable = ctx.objectMap.get("snack-table");
if (snackTable) sys.particlePool.spawnPreset("confetti", snackTable.pos.x, snackTable.pos.y - 20);

// New-PR (lines 190, 193):
// Before: ctx.envObjects.whiteboard
// After:
const whiteboard = ctx.objectMap.get("whiteboard");
if (whiteboard) {
	walkTo(bb, whiteboard.getInteractionPoint());
	setTimeout(() => {
		// ...
		if (whiteboard) sys.particlePool.spawnPreset("scribble", whiteboard.pos.x, whiteboard.pos.y);
	}, 3000);
}
```

- [ ] **Step 2: Migrate merchant-stall-click handler**

Replace the `wireMerchantStallClick` function with `wireMerchantInteraction`:

```typescript
// Before: listens for custom "merchant-stall-click" event
// After: listens for generic "object-interact" event, filters by objectId
function wireMerchantInteraction(ctx: EngineContext): () => void {
	const handler = (e: Event) => {
		const detail = (e as CustomEvent).detail;
		if (detail?.objectId === "merchant-stall") {
			ctx.store.setActivePanel("merchant");
		}
	};
	ctx.engine.canvas.addEventListener("object-interact", handler);
	return () => ctx.engine.canvas.removeEventListener("object-interact", handler);
}
```

Also update the `wireEvents()` composite function to call `wireMerchantInteraction(ctx)` instead of `wireMerchantStallClick(ctx)`.

- [ ] **Step 3: Run event-related tests**
- [ ] **Step 4: Commit** `refactor(plugin): migrate event handlers to objectMap lookups`

---

### Task 10: Cleanup — Remove Old Infrastructure

**Files:**
- Modify: `src/game/engine-config.ts` — remove `OBJECT_POSITIONS`, `OBJECT_SCENE_ASSIGNMENTS`
- Rename: `src/game/engine-objects.ts` → `src/game/engine-pets.ts`
- Delete: 10 actor class files
- Delete: corresponding test files
- Update: all imports referencing deleted/renamed files

- [ ] **Step 1: Remove OBJECT_POSITIONS and OBJECT_SCENE_ASSIGNMENTS from engine-config.ts**

- [ ] **Step 2: Rename engine-objects.ts to engine-pets.ts**

Keep only `createPets()`, `getPetBTPairs()`, and pet-related code. Remove `EnvironmentalObjects`, `createEnvironmentalObjects()`, `registerEnvironmentalObjects()`.

Update all imports of `engine-objects.js` to `engine-pets.js`.

- [ ] **Step 3: Delete 10 old actor class files**

Delete:
- `src/game/actors/food-bowl.ts`
- `src/game/actors/water-bowl.ts`
- `src/game/actors/coffee-machine.ts`
- `src/game/actors/snack-table.ts`
- `src/game/actors/water-cooler.ts`
- `src/game/actors/couch-actor.ts`
- `src/game/actors/plant-actor.ts`
- `src/game/actors/notice-board.ts`
- `src/game/actors/whiteboard-actor.ts`
- `src/game/actors/merchant-stall.ts`

- [ ] **Step 4: Delete old actor test files**

Delete:
- `tests/game/actors/food-bowl.test.ts`
- `tests/game/actors/water-bowl.test.ts`
- `tests/game/actors/merchant-stall.test.ts`

Keep `tests/game/actors/interactable-actor.test.ts` (base class unchanged).

- [ ] **Step 5: Update engine.test.ts and engine-config.test.ts mocks**

Remove `OBJECT_POSITIONS`, `OBJECT_SCENE_ASSIGNMENTS` from engine-config mock. Remove `EngineEnvObjects` references. Update object count assertions.

- [ ] **Step 6: Run full game test suite** — `npx vitest run tests/game/`
- [ ] **Step 7: Commit** `refactor(plugin): remove old actor classes and infrastructure`

---

## Chunk 4: Verification

### Task 11: Update Engine Test Mocks

**Files:**
- Modify: `tests/game/engine.test.ts`
- Modify: `tests/game/engine-config.test.ts`

- [ ] **Step 1: Remove envObjects from engine test mock**

Replace the `EngineEnvObjects` mock with the new `objectMap` pattern. The mock should provide a `Map<string, InteractableActor>` with the critical objects that event handlers reference (coffee-machine, snack-table, whiteboard, merchant-stall).

- [ ] **Step 2: Update engine-config test**

Remove the object count test for `OBJECT_POSITIONS` (deleted). Update any tests that reference `OBJECT_SCENE_ASSIGNMENTS`.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run tests/game/`
Expected: ALL PASS

- [ ] **Step 4: Commit** `test(plugin): update engine test mocks for declarative objects`

---

### Task 12: Full Build + Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run tests/game/`
Expected: ALL PASS

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors related to envObjects, deleted actors, or missing imports

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Verify JSON is bundled**

Since `scene-objects.json` is imported as a JSON module (`import config from "../configs/scene-objects.json"`), esbuild bundles it inline. Verify the import compiles and the config is accessible at runtime.

- [ ] **Step 5: Final commit if any build fixes needed**
