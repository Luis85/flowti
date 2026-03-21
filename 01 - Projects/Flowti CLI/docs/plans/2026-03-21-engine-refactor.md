# Engine Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 1,882-line `engine.ts` God object into 5 focused modules while preserving identical behavior.

**Architecture:** Extract by concern — types, config, state persistence, event wiring, simulation tick. Engine becomes a thin coordinator. Each extraction is independently shippable. No behavior changes.

**Tech Stack:** TypeScript, ExcaliburJS, mistreevous, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-21-engine-refactor-design.md`

**Working directory:** `01 - Projects/Flowti Plugin`

**Test command:** `npx vitest run <test-file>`

**Critical rule:** After every task, all existing tests must still pass. This is a pure refactor — zero behavior changes.

---

## Chunk 1: Foundation — Types & Config

### Task 1: Create engine-types.ts — shared EngineContext type

**Files:**
- Create: `src/game/engine-types.ts`

This type is the integration seam shared by all extracted modules. It must be created first.

- [ ] **Step 1: Create engine-types.ts**

Read `src/game/engine.ts` to inventory all systems, state maps, and actor lookup functions used in the preframe loop, event callbacks, and state persistence. Then create the shared type:

```typescript
/**
 * engine-types.ts — Shared context type for engine modules.
 *
 * All extracted modules (simulation, events, state) receive this
 * persistent mutable context. Created once in engine.ts, updated
 * each frame (deltaMs), passed by reference.
 */

import type { BrainSystem } from "./systems/brain-system.js";
import type { BubbleSystem } from "./systems/bubble-system.js";
import type { TalkEngine } from "./systems/talk/talk-engine.js";
import type { ParticlePool } from "./systems/particle-system.js";
import type { EmoteSystem } from "./systems/emote-system.js";
import type { SocialSystem } from "./systems/social-system.js";
import type { NeedsSystem } from "./systems/needs-system.js";
import type { DirectorSystem } from "./systems/director-system.js";
import type { SensorSystem } from "./systems/sensor-system.js";
import type { EngagementSystem } from "./systems/engagement-system.js";
import type { RitualSystem } from "./systems/ritual-system.js";
import type { ToolExecutor } from "./systems/tool-executor-system.js";
import type { BtSystem } from "./systems/bt-system.js";
import type { DayClock } from "./systems/day-clock.js";
import type { WorldAmbience } from "./systems/world-ambience.js";
import type { MemorySystem } from "./systems/memory-system.js";
import type { QuirkSystem } from "./systems/quirk-system.js";
import type { RelationshipSystem } from "./systems/relationship-system.js";
import type { WorldEventScheduler } from "./systems/world-event-scheduler.js";
import type { SceneRegistry } from "./systems/scene-registry.js";
import type { RoomSwitcher } from "./systems/room-switcher.js";
import type { DashboardStore } from "./store/dashboard-store.js";
import type { AgentActor } from "./actors/agent-actor.js";
import type { PetActor } from "./actors/pet-actor.js";
import type { GameScene } from "./scenes/game-scene.js";
import type { IWorldStateManager, IClock } from "./brain/behavior-tree/bt-types.js";
import type { AgentToolDeps } from "./brain/behavior-tree/bt-types.js";
import type { ReactiveTrigger } from "./systems/talk/templates/reactive-phrases.js";
import type { SceneEntity } from "./data/scene-entity.js";

export interface EngineContext {
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
	btWorldState: IWorldStateManager;
	btClock: IClock;
	btDeps: AgentToolDeps;
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
	allEntities: Map<string, SceneEntity>;
	currentLight: { r: number; g: number; b: number; opacity: number };
	engine: { currentScene: { actors: { values(): Iterable<unknown> } } };
	cameraSystem: ReturnType<typeof import("./systems/camera-system.js").createCameraSystem> | null;
	handleAgentSelect: (name: string) => void;
	fireReactiveTrigger: (agent: string, trigger: ReactiveTrigger) => void;
}
```

Adjust the type as needed after reading the actual engine.ts — the above is a starting point based on the exploration. Only include fields that the extracted modules actually need.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules/ | head -20`
Expected: No new errors from engine-types.ts

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-types.ts"
git commit -m "refactor(engine): add shared EngineContext type for module extraction"
```

---

### Task 2: Create engine-config.ts — extract constants and spatial data

**Files:**
- Create: `src/game/engine-config.ts`
- Create: `tests/game/engine-config.test.ts`
- Modify: `src/game/engine.ts` — remove constants, import from config

- [ ] **Step 1: Read engine.ts and identify all hardcoded values**

Scan engine.ts for:
- Constants (lines 92-102): `ENGINE_WIDTH`, `ENGINE_HEIGHT`, `DOMAIN_PARTICLE_COLORS`
- Object positions (lines 308-331): all 7 interactables with coordinates and rooms
- Pet placements (lines 333-358): all 8 pets with coordinates
- Room offsets (search for `ROOM_OFFSETS`)
- Cooldown values (search for magic numbers: 30000, 5000, 1200, 64, 0.0015)
- Emoji arrays (search for `SOCIAL_EMOJIS`, `REACTION_EMOJIS`)
- Object attraction rules (search for "attraction" or coffee/snack/water pull logic)
- Greeting strings in handleAgentSelect

- [ ] **Step 2: Create engine-config.ts with all extracted values**

Move every constant, position, cooldown, and data array from engine.ts into this file. Export them as named constants. Group by category with section comments.

Structure:
```typescript
// ── Engine dimensions ──
export const ENGINE_WIDTH = 800;
export const ENGINE_HEIGHT = 500;

// ── Visual ──
export const DOMAIN_PARTICLE_COLORS: Record<string, string> = { ... };
export const LIGHT_LERP_SPEED = 0.0015;
export const TRAIL_DISTANCE_SQUARED = 64;

// ── Timing ──
export const POSITION_FLUSH_INTERVAL_MS = 5000;
export const PET_REACTION_COOLDOWN_MS = 30000;
export const ATTRACTION_ARRIVAL_MS = 5000;

// ── Room isolation offsets ──
export const ROOM_OFFSETS: Record<string, number> = { hub: 0, office: 10000, village: 20000, station: 30000 };

// ── Object placements ──
export const OBJECT_PLACEMENTS = [ ... ] as const;

// ── Pet placements ──
export const PET_PLACEMENTS = [ ... ] as const;

// ── Social emojis ──
export const SOCIAL_EMOJIS = [ ... ];
export const REACTION_EMOJIS = [ ... ];
```

- [ ] **Step 3: Write config tests**

Create `tests/game/engine-config.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
	ENGINE_WIDTH, ENGINE_HEIGHT, DOMAIN_PARTICLE_COLORS,
	ROOM_OFFSETS, OBJECT_PLACEMENTS, PET_PLACEMENTS,
} from "../../src/game/engine-config";

describe("engine-config", () => {
	it("exports engine dimensions", () => {
		expect(ENGINE_WIDTH).toBe(800);
		expect(ENGINE_HEIGHT).toBe(500);
	});

	it("exports all domain particle colors", () => {
		expect(Object.keys(DOMAIN_PARTICLE_COLORS)).toContain("engineering");
		expect(Object.keys(DOMAIN_PARTICLE_COLORS).length).toBeGreaterThanOrEqual(6);
	});

	it("exports 4 room offsets", () => {
		expect(Object.keys(ROOM_OFFSETS)).toEqual(["hub", "office", "village", "station"]);
	});

	it("exports 7 object placements", () => {
		expect(OBJECT_PLACEMENTS.length).toBe(7);
	});

	it("exports 8 pet placements", () => {
		expect(PET_PLACEMENTS.length).toBe(8);
	});
});
```

- [ ] **Step 4: Run config tests**

Run: `npx vitest run tests/game/engine-config.test.ts`
Expected: All pass

- [ ] **Step 5: Update engine.ts to import from engine-config**

Replace inline constants with imports. Remove the constant definitions from engine.ts. Replace hardcoded positions with config references where practical. Keep the creation logic (new CoffeeMachine(), etc.) in engine.ts — only the DATA moves to config.

- [ ] **Step 6: Run all existing engine tests**

Run: `npx vitest run tests/game/engine.test.ts`
Expected: Same results as before (pre-existing failures only)

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-config.ts" \
        "01 - Projects/Flowti Plugin/tests/game/engine-config.test.ts" \
        "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "refactor(engine): extract constants and spatial data to engine-config"
```

---

## Chunk 2: State Persistence

### Task 3: Create engine-state.ts — extract save/restore

**Files:**
- Create: `src/game/engine-state.ts`
- Create: `tests/game/engine-state.test.ts`
- Modify: `src/game/engine.ts` — replace inline persistence with function calls

- [ ] **Step 1: Read the save/restore code in engine.ts**

Read these sections:
- **Restore** in `start()` (~lines 1708-1727): loads world-clock.json, world-weather.json, world-memory.json, world-relationships.json, world-positions.json
- **Late restore** (~lines 1805-1810): loads world-needs.json after agent registration
- **Flush in dispose()** (~lines 1843-1873): saves all 6 JSON files
- **Periodic position flush** in postupdate (~lines 1494-1523): saves world-positions.json every 5s

- [ ] **Step 2: Create engine-state.ts with two-phase restore + flush**

```typescript
/**
 * engine-state.ts — Unified state persistence for the game engine.
 *
 * Two-phase restore:
 *   Phase 1 (restoreWorldState): before provider.start() — global state
 *   Phase 2 (restoreAgentState): after registerAgents + scene routing — agent state
 *
 * Flush: saves all state files. Called by dispose() and periodic flush.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { EngineContext } from "./engine-types.js";

export interface RestoreResult {
	loaded: string[];
	skipped: string[];
}

function tryLoadJson(filePath: string): unknown | null {
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

function varDir(vaultPath: string): string {
	return join(vaultPath, ".flowti", "var");
}

export function restoreWorldState(ctx: EngineContext, vaultPath: string): RestoreResult {
	// ... implement phase 1: clock, weather, memory, relationships, positions (return saved positions)
}

export function restoreAgentState(ctx: EngineContext, vaultPath: string): RestoreResult {
	// ... implement phase 2: needs restore (after agent registration)
}

export function flushWorldState(ctx: EngineContext, vaultPath: string): void {
	// ... implement: save all 6 JSON files
}

export function startPeriodicFlush(ctx: EngineContext, vaultPath: string, intervalMs: number): () => void {
	// ... implement: setInterval for position flush, return cancel function
}
```

Implement each function by extracting the exact code from engine.ts. The `restoreWorldState` function should return `savedPositions` so engine.ts can use them for scene routing (which is scene-specific logic that stays in engine.ts).

Adjust the return type of `restoreWorldState` to include `savedPositions`:
```typescript
export interface WorldRestoreResult extends RestoreResult {
	savedPositions: Record<string, { x: number; y: number; scene: string; state: string }> | null;
}
```

- [ ] **Step 3: Write tests for engine-state**

Create `tests/game/engine-state.test.ts` with:
- Test `tryLoadJson` with missing file returns null
- Test `flushWorldState` writes expected files (mock fs or use temp dir)
- Test `restoreWorldState` loads and applies clock/weather/memory/relationships
- Test `restoreAgentState` loads and applies needs
- Test `startPeriodicFlush` returns cancel function

Use `vi.mock("node:fs")` to stub filesystem operations.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/game/engine-state.test.ts`
Expected: All pass

- [ ] **Step 5: Update engine.ts**

Replace the inline restore code in `start()` with:
```typescript
const { savedPositions } = restoreWorldState(ctx, deps.vaultBasePath!);
```

Replace the inline needs restore with:
```typescript
restoreAgentState(ctx, deps.vaultBasePath!);
```

Replace the inline flush in `dispose()` with:
```typescript
flushWorldState(ctx, deps.vaultBasePath!);
```

Replace the postupdate periodic flush with:
```typescript
const cancelFlush = startPeriodicFlush(ctx, deps.vaultBasePath!, POSITION_FLUSH_INTERVAL_MS);
```

Add `cancelFlush()` to `dispose()`.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run tests/game/engine.test.ts tests/game/engine-state.test.ts`
Expected: Same results as before

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-state.ts" \
        "01 - Projects/Flowti Plugin/tests/game/engine-state.test.ts" \
        "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "refactor(engine): extract state persistence to engine-state"
```

---

## Chunk 3: Event Wiring

### Task 4: Create engine-events.ts — extract all event subscriptions

**Files:**
- Create: `src/game/engine-events.ts`
- Create: `tests/game/engine-events.test.ts`
- Modify: `src/game/engine.ts` — replace scattered callbacks with wireEvents()

This is the largest extraction (~400 lines). Read engine.ts carefully to find every event subscription.

- [ ] **Step 1: Identify all event wiring blocks in engine.ts**

Search for these patterns:
- `.onPhaseChange(` — dayClock (line ~361)
- `registerWorldEvent(` — 10 micro-event handlers (lines ~377-472)
- `.onEmote(` — emoteSystem (lines ~733-793)
- `.onConversation(` — socialSystem (lines ~804-843)
- `.onCluster(` — socialSystem (lines ~845-871)
- `.onReaction(` — sensorSystem (lines ~904-911)
- `.onEngagement(` — engagementSystem (lines ~914-921)
- `.onPhase(` — ritualSystem (lines ~924-939)
- `.onResult(` — toolExecutor (lines ~942-947)
- `provider.onAction(` — (lines ~646-687)
- `provider.onConnectionStatus(` — (lines ~690-693)
- `provider.onEntityUpdate(` — (lines ~696-730)
- `store.on(` — 9 store listeners (lines ~1520-1602)

- [ ] **Step 2: Create engine-events.ts**

Structure as 10 wiring functions, each returning an unsubscribe callback:

```typescript
/**
 * engine-events.ts — Consolidated event wiring for the game engine.
 *
 * All system event subscriptions extracted from engine.ts.
 * wireEvents() sets up everything and returns a cleanup function.
 */

import type { EngineContext } from "./engine-types.js";

function wireDayClockEvents(ctx: EngineContext): () => void { ... }
function wireWorldEvents(ctx: EngineContext): () => void { ... }
function wireEmoteEvents(ctx: EngineContext): () => void { ... }
function wireConversationEvents(ctx: EngineContext): () => void { ... }
function wireSensorEvents(ctx: EngineContext): () => void { ... }
function wireEngagementEvents(ctx: EngineContext): () => void { ... }
function wireRitualEvents(ctx: EngineContext): () => void { ... }
function wireToolEvents(ctx: EngineContext): () => void { ... }
function wireProviderEvents(ctx: EngineContext): () => void { ... }
function wireStoreEvents(ctx: EngineContext): () => void { ... }

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
	return () => unsubs.forEach((fn) => fn());
}
```

Extract each callback block from engine.ts verbatim. The callback bodies reference `ctx.systems.*`, `ctx.store`, `ctx.actors.*`, etc. Replace direct variable references with context references.

**Important:** Some wiring functions need additional parameters beyond EngineContext (e.g., `provider` is not a system, it's a constructor argument). Adjust the `wireEvents` signature or EngineContext type as needed:
```typescript
export function wireEvents(ctx: EngineContext, provider: DataProvider): () => void
```

- [ ] **Step 3: Write tests for engine-events**

Create `tests/game/engine-events.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

describe("wireEvents", () => {
	it("returns a cleanup function", () => {
		// Create minimal mock ctx with mock systems that have on* methods
		// Call wireEvents, verify it returns a function
		// Call the cleanup function, verify no errors
	});

	it("cleanup unsubscribes all listeners", () => {
		// Verify that calling cleanup removes all subscriptions
	});
});
```

Focus tests on: wireEvents returns a function, cleanup works without errors, each wiring function subscribes to the expected event.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/game/engine-events.test.ts`
Expected: All pass

- [ ] **Step 5: Update engine.ts**

Remove all event wiring blocks identified in Step 1. Replace with:
```typescript
const cleanupEvents = wireEvents(ctx, provider);
```

In `dispose()`, add:
```typescript
cleanupEvents();
```

Also remove the `registerWorldEvent` helper function (it moves to engine-events.ts).

- [ ] **Step 6: Run all tests**

Run: `npx vitest run tests/game/engine.test.ts tests/game/engine-events.test.ts`
Expected: Same results as before

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-events.ts" \
        "01 - Projects/Flowti Plugin/tests/game/engine-events.test.ts" \
        "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "refactor(engine): extract event wiring to engine-events"
```

---

## Chunk 4: Simulation Tick

### Task 5: Create engine-simulation.ts — extract the preframe loop

**Files:**
- Create: `src/game/engine-simulation.ts`
- Create: `tests/game/engine-simulation.test.ts`
- Modify: `src/game/engine.ts` — replace preframe body with tickSimulation(ctx)

This is the core extraction — the 310-line preframe callback becomes 12 named tick functions.

- [ ] **Step 1: Map the preframe loop sections**

Read the `engine.on("preframe", ...)` callback in engine.ts (approximately lines 1141-1449). Document every section with its line range and what system calls it makes.

- [ ] **Step 2: Create engine-simulation.ts with 12 tick functions**

```typescript
/**
 * engine-simulation.ts — Global tick coordinator.
 *
 * 12 named tick functions called in explicit order every frame.
 * Cross-scene: ticks ALL agents regardless of which room is visible.
 */

import type { EngineContext } from "./engine-types.js";

function tickClock(ctx: EngineContext): void { ... }
function tickSensor(ctx: EngineContext): void { ... }
function tickNeeds(ctx: EngineContext): void { ... }
function tickReactiveTriggers(ctx: EngineContext): void { ... }
function tickBehaviorThresholds(ctx: EngineContext): void { ... }
function tickPets(ctx: EngineContext): void { ... }
function tickRoomTransit(ctx: EngineContext): void { ... }
function tickBehaviorTree(ctx: EngineContext): void { ... }
function tickBrain(ctx: EngineContext): void { ... }
function tickSocial(ctx: EngineContext): void { ... }
function tickDirector(ctx: EngineContext): void { ... }
function tickVisuals(ctx: EngineContext): void { ... }

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

For each tick function, extract the corresponding section from the preframe loop. Replace direct variable references with `ctx.systems.*`, `ctx.state.*`, `ctx.actors.*`, etc.

**Critical ordering notes:**
- `tickBrain` must snapshot `ctx.state.prevWalkingState` BEFORE calling `ctx.systems.brain.update()` — this is load-bearing for particle trail detection in `tickVisuals`
- `tickBehaviorTree` must refresh needs snapshots before ticking BTs
- `tickSocial` must use room-offset positions for social isolation

- [ ] **Step 3: Write tests for engine-simulation**

Create `tests/game/engine-simulation.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
// Test each tick function independently with a mocked EngineContext

describe("tickSimulation", () => {
	it("calls all tick functions in order", () => {
		// Create a mock context with all systems having update() as vi.fn()
		// Call tickSimulation(ctx)
		// Verify each system's update was called
	});
});

describe("tickClock", () => {
	it("advances day clock", () => {
		// Mock ctx.systems.dayClock.update as vi.fn()
		// Call tickClock with a minimal context
		// Verify dayClock.update was called with deltaMs
	});
});

describe("tickNeeds", () => {
	it("updates needs system", () => { ... });
});

// ... one describe per tick function
```

Focus on: each tick function calls the right systems, ordering constraints are maintained.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/game/engine-simulation.test.ts`
Expected: All pass

- [ ] **Step 5: Update engine.ts**

Replace the entire preframe callback body with:
```typescript
engine.on("preframe", () => {
	ctx.deltaMs = engine.clock.elapsed();
	tickSimulation(ctx);
});
```

Remove all the helper functions that were only used inside the preframe loop (`getNearbyAgents`, `processThresholds`, `agentParticleColor`, `updateParticleTrails`, `createParticleRenderer`, `createLightingOverlay`) — they move to engine-simulation.ts.

Keep in engine.ts:
- `handleAgentSelect` (coordination concern)
- `findAgentActor`, `findCurrentSceneActor`, `findNearestAgent` (actor lookups referenced by EngineContext)
- `registerAgents` (multi-system registration)
- `isTyping` (keyboard handler helper)
- `postframe` handler (store sync)
- Lifecycle: `start()`, `pause()`, `resume()`, `dispose()`

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: Same results as before (pre-existing failures only, no new failures)

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts" \
        "01 - Projects/Flowti Plugin/tests/game/engine-simulation.test.ts" \
        "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "refactor(engine): extract preframe loop to engine-simulation with 12 tick functions"
```

---

### Task 6: Pet AI consolidation — move inline pet logic to BT

**Files:**
- Modify: `src/game/brain/behavior-tree/pet-bt.ts`
- Modify: `tests/game/brain/behavior-tree/pet-bt.test.ts`

- [ ] **Step 1: Identify pet AI logic in engine-simulation.ts**

In `tickPets(ctx)`, there should be inline logic for:
- Dog random idle follower selection (0.1% chance)
- Cat follows stressed agents (morale < 30, 0.05% chance)
- Follow target lost when different room

This logic should move into pet BT conditions.

- [ ] **Step 2: Add new conditions to pet-bt.ts**

Add to `PetBTContext`:
```typescript
petType: string;           // "cat" | "dog" | "bird"
nearbyAgentMorale?: number; // lowest morale of nearby agents (for cat behavior)
nearbyIdleAgent?: string;  // random idle agent name (for dog behavior)
targetRoom?: string;       // room of follow target
currentRoom?: string;      // pet's current room
```

Add new conditions:
```typescript
function ShouldFollowStressedAgent(): boolean {
	return context.petType === "cat"
		&& context.state === "idle"
		&& context.nearbyAgentMorale !== undefined
		&& context.nearbyAgentMorale < 30
		&& Math.random() < 0.0005; // 0.05% per tick
}

function ShouldFollowRandomAgent(): boolean {
	return context.petType === "dog"
		&& context.state === "idle"
		&& context.nearbyIdleAgent !== undefined
		&& Math.random() < 0.001; // 0.1% per tick
}

function LostFollowTarget(): boolean {
	return context.followTarget !== null
		&& context.currentRoom !== undefined
		&& context.targetRoom !== undefined
		&& context.currentRoom !== context.targetRoom;
}
```

- [ ] **Step 3: Add tests for new conditions**

```typescript
it("ShouldFollowStressedAgent only triggers for cats", () => {
	const bt = createPetBT("dog", 0, 120, 0.4);
	const pet = getPetContext(bt);
	pet.context.nearbyAgentMorale = 10;
	expect(pet.ShouldFollowStressedAgent()).toBe(false);
});

it("LostFollowTarget detects room mismatch", () => {
	const bt = createPetBT("cat", 0, 120, 0.4);
	const pet = getPetContext(bt);
	pet.context.followTarget = "Atlas";
	pet.context.currentRoom = "hub";
	pet.context.targetRoom = "office";
	expect(pet.LostFollowTarget()).toBe(true);
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/game/brain/behavior-tree/pet-bt.test.ts`
Expected: All pass

- [ ] **Step 5: Update tickPets to set context fields instead of inline logic**

In `engine-simulation.ts`, update `tickPets(ctx)` to set the BT context fields (`nearbyAgentMorale`, `nearbyIdleAgent`, `currentRoom`, `targetRoom`) before the BT tick, rather than making inline follow decisions.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/pet-bt.ts" \
        "01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/pet-bt.test.ts" \
        "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "refactor(engine): move pet AI logic into behavior tree conditions"
```

---

## Chunk 5: Verification

### Task 7: Full integration verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: Same results as before refactor — same number of passes, same pre-existing failures.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules/ | head -30
```

Expected: Only pre-existing type errors (test files with `this` implicit any, interactable-actor tests)

- [ ] **Step 3: Verify engine.ts line count**

```bash
wc -l "src/game/engine.ts"
```

Expected: ~450-500 lines (down from ~1,882)

- [ ] **Step 4: Verify no behavior changes**

Build the plugin and visually verify the Agent World loads and behaves identically:
```bash
npm run build
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git status
# If any unstaged changes remain:
git commit -m "refactor(engine): complete engine decomposition — 1,882 to ~500 lines"
```
