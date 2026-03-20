# Scene & Entity Management Refactor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify scene management and entity tracking into GameScene + SceneRegistry + RoomSwitcher, eliminating dual scene classes, parallel switching systems, and scattered maps.

**Architecture:** Three new modules (SceneRegistry for global knowledge, GameScene for unified scenes, RoomSwitcher for transfers) replace 5 scene files + ~200 lines of scattered engine.ts maps/switching logic. The SceneEntity interface lets agents and creatures share the same enter/exit/transfer flow. Migration is phased: registry first, then scenes (backward-compatible APIs preserved), then entity interface + switcher.

**Tech Stack:** TypeScript, ExcaliburJS, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-20-scene-entity-refactor-design.md`

**Base path:** `01 - Projects/Flowti Plugin/src/game/`

---

## Chunk 1: SceneRegistry — Phase 1

### Task 1: SceneRegistry — entity tracking, transit, and object catalog

**Files:**
- Create: `src/game/systems/scene-registry.ts`
- Test: `tests/game/systems/scene-registry.test.ts`

- [ ] **Step 1: Write failing tests for entity tracking, transit, and object catalog**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { SceneRegistry } from "../../../src/game/systems/scene-registry.js";

describe("SceneRegistry", () => {
	let registry: SceneRegistry;
	beforeEach(() => { registry = new SceneRegistry(); });

	describe("entity tracking", () => {
		it("tracks entity room assignment", () => {
			registry.setEntityRoom("Bob", "office");
			expect(registry.getEntityRoom("Bob")).toBe("office");
		});
		it("returns undefined for unknown entity", () => {
			expect(registry.getEntityRoom("unknown")).toBeUndefined();
		});
		it("lists entities in a room", () => {
			registry.setEntityRoom("Bob", "office");
			registry.setEntityRoom("Alice", "office");
			registry.setEntityRoom("Cat", "hub");
			expect(registry.getEntitiesInRoom("office")).toEqual(["Bob", "Alice"]);
			expect(registry.getEntitiesInRoom("hub")).toEqual(["Cat"]);
			expect(registry.getEntitiesInRoom("village")).toEqual([]);
		});
		it("removes entity", () => {
			registry.setEntityRoom("Bob", "office");
			registry.removeEntity("Bob");
			expect(registry.getEntityRoom("Bob")).toBeUndefined();
			expect(registry.getEntitiesInRoom("office")).toEqual([]);
		});
		it("updates room when entity moves", () => {
			registry.setEntityRoom("Bob", "office");
			registry.setEntityRoom("Bob", "village");
			expect(registry.getEntityRoom("Bob")).toBe("village");
			expect(registry.getEntitiesInRoom("office")).toEqual([]);
			expect(registry.getEntitiesInRoom("village")).toEqual(["Bob"]);
		});
		it("lists all entity IDs", () => {
			registry.setEntityRoom("Bob", "office");
			registry.setEntityRoom("cat-hub", "hub");
			expect(registry.getAllEntityIds().sort()).toEqual(["Bob", "cat-hub"]);
		});
	});

	describe("transit state", () => {
		it("marks entity as in transit", () => {
			registry.setInTransit("Bob", "village", { x: 40, y: 250 });
			expect(registry.isInTransit("Bob")).toBe(true);
		});
		it("returns transit details", () => {
			registry.setInTransit("Bob", "village", { x: 40, y: 250 });
			expect(registry.getTransit("Bob")).toEqual({ target: "village", door: { x: 40, y: 250 } });
		});
		it("clears transit", () => {
			registry.setInTransit("Bob", "village", { x: 40, y: 250 });
			registry.clearTransit("Bob");
			expect(registry.isInTransit("Bob")).toBe(false);
		});
		it("lists all transit IDs", () => {
			registry.setInTransit("Bob", "village", { x: 40, y: 250 });
			registry.setInTransit("Alice", "hub", { x: 750, y: 250 });
			expect(registry.getAllTransitIds().sort()).toEqual(["Alice", "Bob"]);
		});
	});

	describe("object catalog", () => {
		it("registers and finds objects by type", () => {
			registry.registerObject("coffee-machine", "office", "energy", { x: 680, y: 120 });
			expect(registry.findObject("energy")).toEqual({
				id: "coffee-machine", room: "office", type: "energy", position: { x: 680, y: 120 },
			});
		});
		it("returns undefined for unknown type", () => {
			expect(registry.findObject("nonexistent")).toBeUndefined();
		});
		it("finds all objects of a type", () => {
			registry.registerObject("coffee-machine", "office", "energy", { x: 680, y: 120 });
			registry.registerObject("snack-table", "village", "energy", { x: 400, y: 380 });
			expect(registry.findObjectsOfType("energy")).toHaveLength(2);
		});
		it("lists objects in a room", () => {
			registry.registerObject("coffee-machine", "office", "energy", { x: 680, y: 120 });
			registry.registerObject("whiteboard", "office", "focus", { x: 400, y: 60 });
			registry.registerObject("snack-table", "village", "energy", { x: 400, y: 380 });
			expect(registry.getObjectsInRoom("office")).toHaveLength(2);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/scene-registry.test.ts`
Expected: FAIL — SceneRegistry module not found

- [ ] **Step 3: Implement SceneRegistry**

```typescript
/**
 * scene-registry.ts — Central source of truth for what's in which scene.
 *
 * Tracks entity room assignments, transit state, static object catalog,
 * and scene references. Replaces scattered maps in engine.ts.
 */

export interface ObjectEntry {
	readonly id: string;
	readonly room: string;
	readonly type: string;
	readonly position: { readonly x: number; readonly y: number };
}

export interface DoorConfig {
	readonly target: string;
	readonly label: string;
	readonly position: { readonly x: number; readonly y: number };
}

/** Minimal scene interface for registry — GameScene implements this. */
export interface SceneHandle {
	getDoors(): readonly DoorConfig[];
}

interface TransitEntry {
	readonly target: string;
	readonly door: { readonly x: number; readonly y: number };
}

export class SceneRegistry {
	private readonly entityRooms = new Map<string, string>();
	private readonly transitState = new Map<string, TransitEntry>();
	private readonly objects: ObjectEntry[] = [];
	private readonly scenes = new Map<string, SceneHandle>();

	// ── Entity tracking ──────────────────────────────────

	getEntityRoom(id: string): string | undefined {
		return this.entityRooms.get(id);
	}

	setEntityRoom(id: string, room: string): void {
		this.entityRooms.set(id, room);
	}

	removeEntity(id: string): void {
		this.entityRooms.delete(id);
		this.transitState.delete(id);
	}

	getEntitiesInRoom(room: string): string[] {
		const result: string[] = [];
		for (const [id, r] of this.entityRooms) {
			if (r === room) result.push(id);
		}
		return result;
	}

	getAllEntityIds(): string[] {
		return [...this.entityRooms.keys()];
	}

	// ── Transit state ────────────────────────────────────

	setInTransit(id: string, target: string, door: { x: number; y: number }): void {
		this.transitState.set(id, { target, door });
	}

	clearTransit(id: string): void {
		this.transitState.delete(id);
	}

	isInTransit(id: string): boolean {
		return this.transitState.has(id);
	}

	getTransit(id: string): TransitEntry | undefined {
		return this.transitState.get(id);
	}

	getAllTransitIds(): string[] {
		return [...this.transitState.keys()];
	}

	// ── Object catalog ───────────────────────────────────

	registerObject(id: string, room: string, type: string, position: { x: number; y: number }): void {
		this.objects.push({ id, room, type, position: { x: position.x, y: position.y } });
	}

	findObject(type: string): ObjectEntry | undefined {
		return this.objects.find((o) => o.type === type);
	}

	findObjectsOfType(type: string): ObjectEntry[] {
		return this.objects.filter((o) => o.type === type);
	}

	getObjectsInRoom(room: string): ObjectEntry[] {
		return this.objects.filter((o) => o.room === room);
	}

	// ── Scene access ─────────────────────────────────────

	registerScene(id: string, scene: SceneHandle): void {
		this.scenes.set(id, scene);
	}

	getScene(id: string): SceneHandle | undefined {
		return this.scenes.get(id);
	}

	getAllSceneIds(): string[] {
		return [...this.scenes.keys()];
	}

	getDoorBetween(from: string, to: string): DoorConfig | undefined {
		const scene = this.scenes.get(from);
		if (!scene) return undefined;
		return scene.getDoors().find((d) => d.target === to);
	}
}
```

The `SceneHandle` interface is defined locally — no placeholder file needed. `GameScene` will implement `SceneHandle` in Phase 2.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/scene-registry.test.ts`
Expected: PASS (all 15 tests)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/scene-registry.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/scene-registry.test.ts"
git commit -m "feat(game): add SceneRegistry with entity tracking, transit, and object catalog"
```

---

### Task 2: Add objectId and objectType to InteractableActor

**Files:**
- Modify: `src/game/actors/interactable-actor.ts`
- Modify: All 7 subclasses (coffee-machine.ts, whiteboard-actor.ts, snack-table.ts, water-cooler.ts, couch-actor.ts, plant-actor.ts, notice-board.ts)

- [ ] **Step 1: Add objectId and objectType to InteractableConfig and base class**

In `interactable-actor.ts`, add to config interface:
```typescript
readonly objectId: string;
readonly objectType: string;
```

Add to class fields and constructor:
```typescript
readonly objectId: string;
readonly objectType: string;
// In constructor:
this.objectId = config.objectId;
this.objectType = config.objectType;
```

- [ ] **Step 2: Update each subclass's super() call**

Each subclass sets its own values in its `super()` call (no external callers need updating):
- `CoffeeMachine`: `objectId: "coffee-machine", objectType: "energy"`
- `WhiteboardActor`: `objectId: "whiteboard", objectType: "focus"`
- `SnackTable`: `objectId: "snack-table", objectType: "energy"`
- `WaterCooler`: `objectId: "water-cooler", objectType: "social"`
- `CouchActor`: `objectId: "couch", objectType: "rest"`
- `PlantActor`: `objectId: "plant", objectType: "focus"`
- `NoticeBoard`: `objectId: "notice-board", objectType: "morale"`

Find all subclasses:
```bash
cd "01 - Projects/Flowti Plugin" && grep -rl "extends InteractableActor" src/game/actors/
```

- [ ] **Step 3: Verify build passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/" | head -10`
Expected: no source errors

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/"
git commit -m "feat(game): add objectId and objectType to interactable actors for registry"
```

---

### Task 3: Wire SceneRegistry into engine.ts — replace scattered maps

**Files:**
- Modify: `src/game/engine.ts`

This is the core Phase 1 wiring. Replace all scattered maps with registry calls while preserving all existing behavior.

- [ ] **Step 1: Create registry instance and register objects**

After system creation in `createAgentWorld()`, create the registry and register all objects:
```typescript
import { SceneRegistry } from "./systems/scene-registry.js";
const registry = new SceneRegistry();

// After object creation:
registry.registerObject(coffeeMachine.objectId, "office", coffeeMachine.objectType, coffeeMachine.pos);
registry.registerObject(whiteboard.objectId, "office", whiteboard.objectType, whiteboard.pos);
registry.registerObject(snackTable.objectId, "village", snackTable.objectType, snackTable.pos);
registry.registerObject(waterCooler.objectId, "village", waterCooler.objectType, waterCooler.pos);
registry.registerObject(couch.objectId, "station", couch.objectType, couch.pos);
registry.registerObject(plant.objectId, "hub", plant.objectType, plant.pos);
registry.registerObject(noticeBoard.objectId, "hub", noticeBoard.objectType, noticeBoard.pos);
```

- [ ] **Step 2: Replace agentRoomMap with registry.setEntityRoom/getEntityRoom**

Search-and-replace throughout engine.ts:
- `agentRoomMap.get(` → `registry.getEntityRoom(`
- `agentRoomMap.set(` → `registry.setEntityRoom(`
- Delete the `const agentRoomMap` declaration

- [ ] **Step 3: Replace petRoomMap with registry calls**

Create a map of pet instances to entity IDs:
```typescript
const petEntityIds = new Map<PetActor, string>();
petEntityIds.set(hubCat, "cat-hub");
petEntityIds.set(officeCat, "cat-office");
// ... etc for all pets
```

Replace:
- `petRoomMap.get(pet)` → `registry.getEntityRoom(petEntityIds.get(pet)!)`
- `petRoomMap.set(pet, room)` → `registry.setEntityRoom(petEntityIds.get(pet)!, room)`
- Delete the `const petRoomMap` declaration

- [ ] **Step 4: Replace agentsInTransit with registry transit calls**

- `agentsInTransit.has(name)` → `registry.isInTransit(name)`
- `agentsInTransit.get(name)` → `registry.getTransit(name)`
- `agentsInTransit.set(name, { targetRoom, door })` → `registry.setInTransit(name, targetRoom, door)`
- `agentsInTransit.delete(name)` → `registry.clearTransit(name)`
- `for (const [name, transit] of agentsInTransit)` → `for (const id of registry.getAllTransitIds()) { const transit = registry.getTransit(id)!; ...`
- Delete the `const agentsInTransit` declaration

- [ ] **Step 5: Replace petTransitTargets with registry transit calls**

Same pattern as Step 4 but for pet transit:
- `petTransitTargets.has(pet)` → `registry.isInTransit(petEntityIds.get(pet)!)`
- `petTransitTargets.get(pet)` → `registry.getTransit(petEntityIds.get(pet)!)?.target`
- `petTransitTargets.set(pet, target)` → `registry.setInTransit(petEntityIds.get(pet)!, target, door)`
- `petTransitTargets.delete(pet)` → `registry.clearTransit(petEntityIds.get(pet)!)`
- Delete the `const petTransitTargets` declaration

- [ ] **Step 6: Update isInTransit helper**

```typescript
function isInTransit(name: string): boolean {
    return registry.isInTransit(name);
}
```

- [ ] **Step 7: Update brain system call**

```typescript
brainSystem.update(deltaMs, findAgentActor, (name) => registry.getEntityRoom(name));
```

- [ ] **Step 8: Update social system room offsets, getNearbyAgents, findNearestAgent**

Replace all `agentRoomMap.get(name)` calls with `registry.getEntityRoom(name)`.

- [ ] **Step 9: Register existing scenes in registry (for getDoorBetween later)**

Each existing scene needs to implement `SceneHandle` (just `getDoors()`). Add a thin wrapper:
```typescript
// Temporary SceneHandle adapters for existing scenes (replaced in Phase 2)
registry.registerScene("hub", { getDoors: () => [
    { target: "office", label: "Office", position: { x: 750, y: 130 } },
    { target: "village", label: "Village", position: { x: 750, y: 250 } },
    { target: "station", label: "Station", position: { x: 750, y: 370 } },
] });
registry.registerScene("office", { getDoors: () => [{ target: "hub", label: "Back", position: { x: 40, y: 250 } }] });
registry.registerScene("village", { getDoors: () => [{ target: "hub", label: "Back", position: { x: 40, y: 250 } }] });
registry.registerScene("station", { getDoors: () => [{ target: "hub", label: "Back", position: { x: 40, y: 250 } }] });
```

- [ ] **Step 10: Verify build + plugin loads**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: `ok (no errors)`

- [ ] **Step 11: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/scene-registry.ts"
git commit -m "refactor(game): replace scattered maps with SceneRegistry (Phase 1)"
```

---

## Chunk 2: GameScene — Phase 2

Phase 2 replaces the scene classes but **preserves backward-compatible APIs** (`spawnAgent`, `removeAgent`, `spawnAgentAtDoorway`, `getAgentActor`, `getAgentActors`, `getWorkstations`). The SceneEntity-based `enter()`/`exit()` is added alongside as new methods. Engine.ts keeps using the old APIs in Phase 2; migration to enter/exit happens in Phase 3.

### Task 4: Hub background + scene configs

**Files:**
- Modify: `src/game/actors/scene-backgrounds.ts`
- Create: `src/game/data/scene-configs.ts`

- [ ] **Step 1: Add drawHubFloor to scene-backgrounds.ts**

Extract the hub floor drawing from `hub-scene.ts` (lines 60-99) into a new export:
```typescript
export function drawHubFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Base floor fill
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, w, h);
    // Subtle grid
    ctx.strokeStyle = "#1b2332";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // Center radial glow
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 180);
    grad.addColorStop(0, "rgba(30, 41, 59, 0.3)");
    grad.addColorStop(1, "rgba(30, 41, 59, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Border accents
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, w, 3);
    ctx.fillRect(0, h - 3, w, 3);
}
```

- [ ] **Step 2: Create scene-configs.ts**

```typescript
import { drawOfficeFloor, drawVillageFloor, drawStationFloor, drawHubFloor } from "../actors/scene-backgrounds.js";
import type { DoorConfig } from "../systems/scene-registry.js";

export interface OverlayConfig {
	readonly type: "connection-status" | "iteration-badge";
	readonly position: { readonly x: number; readonly y: number };
}

export interface GameSceneConfig {
	readonly id: string;
	readonly label: string;
	readonly doors: readonly DoorConfig[];
	readonly drawBackground: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
	readonly workstationStyle?: "desk" | "workbench" | "console";
	readonly workstationCount: number;
	readonly workstationColor?: string;
	readonly floorColor: string;
	readonly overlays?: readonly OverlayConfig[];
}

export const SCENE_CONFIGS: Record<string, GameSceneConfig> = {
	hub: {
		id: "hub", label: "Hub",
		doors: [
			{ target: "office", label: "Office", position: { x: 750, y: 130 } },
			{ target: "village", label: "Village", position: { x: 750, y: 250 } },
			{ target: "station", label: "Station", position: { x: 750, y: 370 } },
		],
		workstationCount: 0, floorColor: "#111827",
		drawBackground: drawHubFloor,
		overlays: [{ type: "connection-status", position: { x: 780, y: 20 } }],
	},
	office: {
		id: "office", label: "Office",
		doors: [{ target: "hub", label: "Back", position: { x: 40, y: 250 } }],
		workstationCount: 6, workstationStyle: "desk", workstationColor: "#1e3a5f", floorColor: "#0c1524",
		drawBackground: drawOfficeFloor,
	},
	village: {
		id: "village", label: "Village",
		doors: [{ target: "hub", label: "Back", position: { x: 40, y: 250 } }],
		workstationCount: 6, workstationStyle: "workbench", workstationColor: "#3d2e1a", floorColor: "#15120d",
		drawBackground: drawVillageFloor,
	},
	station: {
		id: "station", label: "Station",
		doors: [{ target: "hub", label: "Back", position: { x: 40, y: 250 } }],
		workstationCount: 6, workstationStyle: "console", workstationColor: "#0e3d4a", floorColor: "#080d14",
		drawBackground: drawStationFloor,
	},
};
```

- [ ] **Step 3: Verify types compile**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/" | head -5`
Expected: no source errors

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/scene-configs.ts" \
       "01 - Projects/Flowti Plugin/src/game/actors/scene-backgrounds.ts"
git commit -m "feat(game): add declarative scene configs and hub background"
```

---

### Task 5: GameScene — unified scene class with backward-compatible APIs

**Files:**
- Create: `src/game/scenes/game-scene.ts`

- [ ] **Step 1: Implement GameScene with both old and new APIs**

GameScene must provide:

**Old APIs (backward-compatible, used by engine.ts in Phase 2):**
- `spawnAgent(agent: DashboardAgent)` — spawn agent at workstation or free position
- `spawnAgentAtDoorway(agent: DashboardAgent)` — spawn near a door
- `removeAgent(name: string)` — kill actor, remove from tracking
- `getAgentActor(name: string): AgentActor | undefined`
- `getAgentActors(): ReadonlyMap<string, AgentActor>`
- `getWorkstations(): readonly WorkstationActor[]`
- `getDoorwayPosition(): { x: number; y: number }` — returns first door's position
- `setBrainSystem(brain: BrainSystem)` — for position sync on activate
- `setSpriteRegistry(registry: Map<string, AgentSprites>)` — for character sprites
- `updateConnectionStatus(status)` — hub overlay (no-op if no connection-status overlay)
- `updateIterationBadge(text)` — hub overlay (no-op if no iteration-badge overlay)

**New APIs (SceneEntity-based, used in Phase 3):**
- `enter(entity: SceneEntity, fromScene: string | null)` — SceneEntity enter
- `exit(entityId: string)` — SceneEntity exit
- `getEntity(id: string): SceneEntity | undefined`
- `getEntities(): ReadonlyMap<string, SceneEntity>`
- `getDoors(): readonly DoorConfig[]` — implements `SceneHandle`

**Constructor:** `new GameScene(config: GameSceneConfig, sceneCallbacks: { onSceneChange, onAgentSelect })`

**onInitialize logic** (port from RoomScene + HubScene):
- Draw background from `config.drawBackground`
- Room title label from `config.label`
- Floor accent from `config.floorColor`
- Workstation grid if `config.workstationCount > 0` (use `WORKSTATION_COLS`, `WORKSTATION_SPACING`, `WORKSTATION_START` from `config/settings.ts`)
- Doorway actors from `config.doors[]` (each creates a `DoorwayActor` with `onClick: onSceneChange`)
- Overlay labels from `config.overlays[]` (connection-status, iteration-badge)

**onActivate logic:** sync agent positions from brain system (existing pattern).

- [ ] **Step 2: Verify types compile**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/" | head -5`
Expected: no source errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/scenes/game-scene.ts"
git commit -m "feat(game): implement unified GameScene with backward-compatible APIs"
```

---

### Task 6: Wire GameScene into engine.ts — replace scene classes

**Files:**
- Modify: `src/game/engine.ts`
- Delete: `src/game/scenes/hub-scene.ts`
- Delete: `src/game/scenes/room-scene.ts`
- Delete: `src/game/scenes/office-scene.ts`
- Delete: `src/game/scenes/village-scene.ts`
- Delete: `src/game/scenes/station-scene.ts`

- [ ] **Step 1: Replace scene imports and creation**

Replace all scene imports with:
```typescript
import { GameScene } from "./scenes/game-scene.js";
import { SCENE_CONFIGS } from "./data/scene-configs.js";
```

Replace scene creation:
```typescript
const hubScene = new GameScene(SCENE_CONFIGS.hub, sceneConfig);
const officeScene = new GameScene(SCENE_CONFIGS.office, sceneConfig);
const villageScene = new GameScene(SCENE_CONFIGS.village, sceneConfig);
const stationScene = new GameScene(SCENE_CONFIGS.station, sceneConfig);
```

Update registry scene registrations to use the GameScene instances directly (they implement `SceneHandle`). Remove the temporary wrappers from Task 3 Step 9.

- [ ] **Step 2: Update all engine.ts references**

- Replace `const roomScenes: Record<string, RoomScene>` with `const roomScenes: Record<string, GameScene>` (or use registry)
- `hubScene` is now a GameScene — all old APIs (`updateConnectionStatus`, `updateAgents`, `getAgentActor`, etc.) are available
- `officeScene.setBrainSystem()` etc. — same API name
- `findAgentActor` — search all GameScenes (same pattern, different type)
- `findCurrentSceneActor` — same pattern
- All `getWorkstations()` calls — same API

- [ ] **Step 3: Delete old scene files**

```bash
git rm "01 - Projects/Flowti Plugin/src/game/scenes/hub-scene.ts" \
       "01 - Projects/Flowti Plugin/src/game/scenes/room-scene.ts" \
       "01 - Projects/Flowti Plugin/src/game/scenes/office-scene.ts" \
       "01 - Projects/Flowti Plugin/src/game/scenes/village-scene.ts" \
       "01 - Projects/Flowti Plugin/src/game/scenes/station-scene.ts"
```

- [ ] **Step 4: Delete or update config/settings.ts**

`SCENE_THEMES` is no longer needed (replaced by `GameSceneConfig`). Workstation constants (`WORKSTATION_COLS`, `WORKSTATION_SPACING`, `WORKSTATION_START`) are still needed by GameScene — keep them or move to `scene-configs.ts`. If keeping `settings.ts`, remove the unused `SCENE_THEMES` export.

- [ ] **Step 5: Verify build passes**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: `ok (no errors)`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/"
git commit -m "refactor(game): replace HubScene+RoomScene with unified GameScene (Phase 2)"
```

---

## Chunk 3: SceneEntity + RoomSwitcher — Phase 3

### Task 7: SceneEntity interface

**Files:**
- Create: `src/game/data/scene-entity.ts`

- [ ] **Step 1: Create the SceneEntity interface**

```typescript
/**
 * scene-entity.ts — Shared contract for agents and creatures.
 *
 * Both AgentSceneEntity and PetActor implement this so the transfer
 * system and GameScene can handle them uniformly via enter/exit.
 */

import type * as ex from "excalibur";

export interface SceneEntity {
	readonly entityId: string;
	readonly entityType: "agent" | "creature";

	/** Create a fresh ExcaliburJS actor at the given position. */
	createActor(x: number, y: number): ex.Actor;

	/** Get the current actor instance (null if not in a scene). */
	getActor(): ex.Actor | null;

	/** Request movement toward a position. */
	moveTo(x: number, y: number): void;

	/** Get current world position. */
	getPosition(): { x: number; y: number };

	/** Called before the actor is removed from a scene. */
	onExitScene(): void;

	/** Called after the actor is placed in a new scene. */
	onEnterScene(x: number, y: number): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/scene-entity.ts"
git commit -m "feat(game): add SceneEntity interface for unified entity management"
```

---

### Task 8: Implement SceneEntity on PetActor

**Files:**
- Modify: `src/game/actors/pet-actor.ts`
- Modify: `src/game/engine.ts` (pet creation sites)

- [ ] **Step 1: Add entityId and implement SceneEntity methods**

Add to PetActor:
- `readonly entityId: string` — passed via constructor
- Update constructor: `constructor(def: PetDefinition, x: number, y: number, entityId: string)`
- `getActor()` — returns `this` (PetActor IS the ex.Actor)
- `createActor(x, y)` — resets position and returns `this`
- `moveTo(x, y)` — NEW method that sets a walk target WITHOUT entering "exiting" state. Add a new `"walking"` sub-behavior: set `targetPos` and state to `"wandering"` (reuses existing wander movement logic). For door walks (via RoomSwitcher), `walkToExit()` is still used internally by the switcher.
- `getPosition()` — returns `{ x: this.pos.x, y: this.pos.y }`
- `onExitScene()` — clears follow target, resets exiting state, clears targetPos
- `onEnterScene(x, y)` — sets pos, calls `resetHome()` with pause timer

Note: `moveTo()` must NOT set the "exiting" state. "Exiting" is only for door walks. For general movement (e.g., post-arrival wander), `moveTo()` sets a wander target using the existing wandering state.

- [ ] **Step 2: Update all pet creation sites in engine.ts**

```typescript
const hubCat = new PetActor(catDef, 300, 250, "cat-hub");
const officeCat = new PetActor(catDef, 350, 300, "cat-office");
// ... etc for all 8 pets
```

Remove the `petEntityIds` map from Task 3 — pets now have `entityId` directly. Update all `petEntityIds.get(pet)!` calls to `pet.entityId`.

- [ ] **Step 3: Verify build passes**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: `ok (no errors)`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/pet-actor.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(game): implement SceneEntity on PetActor with entityId"
```

---

### Task 9: AgentSceneEntity wrapper

**Files:**
- Create: `src/game/actors/agent-scene-entity.ts`

- [ ] **Step 1: Create AgentSceneEntity**

Wrapper that holds stable agent identity + dependencies. Creates fresh AgentActor instances on each scene enter.

```typescript
import type { SceneEntity } from "../data/scene-entity.js";
import type { DashboardAgent } from "../data/types.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";
import type { BrainSystem } from "../systems/brain-system.js";
import { AgentActor } from "./agent-actor.js";
import type * as ex from "excalibur";

export class AgentSceneEntity implements SceneEntity {
	readonly entityId: string;
	readonly entityType = "agent" as const;
	private actor: AgentActor | null = null;

	constructor(
		readonly agent: DashboardAgent,
		private readonly sprites: AgentSprites,
		private readonly brainSystem: BrainSystem,
		private readonly onSelect: (name: string) => void,
	) {
		this.entityId = agent.name;
	}

	createActor(x: number, y: number): ex.Actor {
		this.actor = new AgentActor({
			agent: this.agent, x, y,
			onSelect: this.onSelect,
			sprites: this.sprites,
		});
		return this.actor;
	}

	getActor(): ex.Actor | null { return this.actor; }

	moveTo(x: number, y: number): void {
		this.brainSystem.walkTo(this.entityId, { x, y });
	}

	getPosition(): { x: number; y: number } {
		if (this.actor) return { x: this.actor.pos.x, y: this.actor.pos.y };
		return this.brainSystem.getPosition(this.entityId) ?? { x: 0, y: 0 };
	}

	onExitScene(): void { this.actor = null; }

	onEnterScene(x: number, y: number): void {
		if (this.actor) { this.actor.pos.x = x; this.actor.pos.y = y; }
		const brainPos = this.brainSystem.getPosition(this.entityId);
		if (brainPos) { brainPos.x = x; brainPos.y = y; }
	}
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/" | head -5`
Expected: no source errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/agent-scene-entity.ts"
git commit -m "feat(game): add AgentSceneEntity wrapper implementing SceneEntity"
```

---

### Task 10: RoomSwitcher

**Files:**
- Create: `src/game/systems/room-switcher.ts`
- Test: `tests/game/systems/room-switcher.test.ts`

- [ ] **Step 1: Write failing tests**

Test core scenarios:
- `requestTransfer` marks entity in transit
- `update` detects arrival and calls scene exit/enter
- `update` re-walks interrupted agents
- Multi-hop: office→village routes through hub (uses timer, not setTimeout)
- Explore timer triggers for agents (10s/8%) and creatures (8s/25%)
- Fish/sleeping creatures are skipped
- Task-locked agents are skipped

- [ ] **Step 2: Implement RoomSwitcher**

Key design decisions:
- Uses `SceneRegistry` for all state lookups
- `requestTransfer(req)` for explicit requests (purpose mode)
- `update(deltaMs)` handles arrival checks + explore timers
- Multi-hop uses a `pendingHops` Map with a `hopCooldown` timer (NOT setTimeout) — tracked in update loop
- `executeTransfer` calls `GameScene.exit()` then `GameScene.enter()` then `registry.setEntityRoom()`
- Arrival distance: `70 * 70 = 4900` squared (generous for brain bounds)

Add `getAllTransitIds()` reference: already added in Task 1.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/room-switcher.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/room-switcher.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/room-switcher.test.ts"
git commit -m "feat(game): add RoomSwitcher for unified room transfers (Phase 3)"
```

---

### Task 11: Wire RoomSwitcher + SceneEntity into engine.ts

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Create SceneEntity instances for all agents and creatures**

After `registerAgents()`, create `AgentSceneEntity` wrappers for each agent:
```typescript
const agentEntities = new Map<string, AgentSceneEntity>();
for (const agent of initialAgents) {
    const charName = resolveCharacter(agent.name, agent.domain ?? "");
    const sprites = spriteRegistry.get(charName);
    if (!sprites) continue;
    const entity = new AgentSceneEntity(agent, sprites, brainSystem, handleAgentSelect);
    agentEntities.set(agent.name, entity);
}
```

Store all entities (agents + pets) in a combined lookup:
```typescript
const allEntities = new Map<string, SceneEntity>();
for (const [name, entity] of agentEntities) allEntities.set(name, entity);
for (const pet of pets) allEntities.set(pet.entityId, pet);
```

- [ ] **Step 2: Create RoomSwitcher and wire it**

```typescript
const roomSwitcher = new RoomSwitcher({
    registry,
    getEntity: (id) => allEntities.get(id),
    getEntityState: (id) => brainSystem.getState(id)?.state ?? pets.find(p => p.entityId === id)?.getState() ?? "idle",
    isTaskLocked: (id) => store.taskLockedAgents.has(id),
    onTransferComplete: (entityId, from, to) => {
        const label = to.charAt(0).toUpperCase() + to.slice(1);
        bubbleSystem.showBubble(entityId, "thought", `Visiting ${label}...`, engine.currentScene, findAgentActor, 3000);
        store.pushWorldEvent("room-switch", `${entityId} moved to ${label}`);
    },
});
```

- [ ] **Step 3: Replace agent routing with GameScene.enter()**

Replace the startup agent routing loop with:
```typescript
for (const agent of initialAgents) {
    const entity = agentEntities.get(agent.name);
    if (!entity) continue;
    const saved = savedPositions?.[agent.name];
    const targetRoom = saved?.scene ?? resolveSettingForDomain(agent.domain);
    const scene = registry.getScene(targetRoom) as GameScene;
    if (scene) {
        scene.enter(entity, null);
        if (saved) entity.onEnterScene(saved.x, saved.y);
    }
    registry.setEntityRoom(agent.name, targetRoom);
}
```

- [ ] **Step 4: Replace inline switching with roomSwitcher.update()**

In the preframe loop, replace sections 3d-ii (pet switching) and 3e (agent switching) with:
```typescript
roomSwitcher.update(deltaMs);
```

Delete:
- `transferAgent()` function
- `transferScenes` / `ALL_SCENE_KEYS` objects
- `roomSwitchTimer`, `petSwitchTimer` and their constants
- `doorPositions` / `spawnPositions` objects
- `isInTransit()` helper (use `registry.isInTransit()` directly)

- [ ] **Step 5: Update object attraction for cross-room lookups**

Replace the hardcoded `objectAttractions` array:
1. Check same-room objects via `registry.getObjectsInRoom(currentRoom)`
2. If no match, query `registry.findObject(neededType)` for cross-room
3. If cross-room match: `roomSwitcher.requestTransfer({ entityId, targetRoom, reason: "purpose", targetObject })`

- [ ] **Step 6: Verify build passes**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: `ok (no errors)`

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "refactor(game): wire RoomSwitcher + SceneEntity, remove inline switching (Phase 3)"
```

---

### Task 12: Persistence — creature positions + final cleanup

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Include creature positions in position writer + dispose flush**

In both the `postupdate` writer and `dispose()`, add:
```typescript
for (const pet of pets) {
    positions[pet.entityId] = {
        x: Math.round(pet.pos.x),
        y: Math.round(pet.pos.y),
        scene: registry.getEntityRoom(pet.entityId) ?? "hub",
        state: pet.getState(),
    };
}
```

- [ ] **Step 2: Restore creature positions on startup**

After creating pet instances, check `savedPositions` for each entityId and place them in saved rooms:
```typescript
for (const pet of pets) {
    const saved = savedPositions?.[pet.entityId];
    const targetRoom = saved?.scene ?? /* default room from initial assignment */;
    const scene = registry.getScene(targetRoom) as GameScene;
    if (scene) {
        scene.enter(pet, null);
        if (saved) pet.onEnterScene(saved.x, saved.y);
    }
    registry.setEntityRoom(pet.entityId, targetRoom);
}
```

- [ ] **Step 3: Remove unused imports and dead code**

Clean up engine.ts: remove imports for deleted scene files, unused types, stale constants.

- [ ] **Step 4: Run full build + tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build && npm test`
Expected: `ok (no errors)`, all tests pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/"
git commit -m "feat(game): persist creature positions, final cleanup (Phase 3 complete)"
```
