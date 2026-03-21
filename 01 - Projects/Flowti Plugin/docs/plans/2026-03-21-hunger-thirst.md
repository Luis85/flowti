# Hunger & Thirst System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hunger and thirst as energy sub-drivers for agents and pets, with food/drink stations, BT integration, steal/share pet mechanic, and UI bars.

**Architecture:** Extend the existing 4-need model (energy/social/focus/morale) with hunger + thirst fields that modulate energy decay rate. Retrofit existing interactable objects with hunger/thirst effects. Add pet bowls as new interactable actors. Extend agent and pet behavior trees with food/drink seeking. Display needs bars in agent info panel.

**Tech Stack:** TypeScript, ExcaliburJS, Lit (UI components), mistreevous (BT), Ninja Adventure sprite assets

**Spec:** `docs/specs/2026-03-21-hunger-thirst-design.md`

---

## Chunk 1: Data Model Foundation

### Task 1: Extend AgentNeeds interfaces

**Files:**
- Modify: `src/game/systems/needs-system.ts` (AgentNeeds interface, lines 15-20)
- Modify: `src/game/brain/behavior-tree/bt-types.ts` (AgentNeeds mirror, lines 77-86)
- Modify: `src/game/systems/social-system.ts` (local AgentNeeds, lines 31-36)
- Test: `tests/game/systems/needs-system.test.ts`

- [ ] **Step 1: Add hunger/thirst to AgentNeeds in needs-system.ts**

```typescript
// src/game/systems/needs-system.ts — lines 15-20
export interface AgentNeeds {
	readonly energy: number;
	readonly social: number;
	readonly focus: number;
	readonly morale: number;
	readonly hunger: number;
	readonly thirst: number;
}
```

- [ ] **Step 2: Add hunger/thirst to NeedsEntry in needs-system.ts**

```typescript
// src/game/systems/needs-system.ts — lines 35-41
interface NeedsEntry {
	energy: number;
	social: number;
	focus: number;
	morale: number;
	hunger: number;
	thirst: number;
	attributes: AgentAttributes;
}
```

- [ ] **Step 3: Mirror in bt-types.ts**

```typescript
// src/game/brain/behavior-tree/bt-types.ts — lines 77-86
export interface AgentNeeds {
	energy: number;
	social: number;
	focus: number;
	morale: number;
	hunger: number;
	thirst: number;
}

export function createDefaultNeeds(): AgentNeeds {
	return { energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80 };
}
```

- [ ] **Step 4: Mirror in social-system.ts**

```typescript
// src/game/systems/social-system.ts — lines 31-36
interface AgentNeeds {
	readonly energy: number;
	readonly social: number;
	readonly focus: number;
	readonly morale: number;
	readonly hunger: number;
	readonly thirst: number;
}
```

- [ ] **Step 5: Extend InteractableConfig needsEffects type**

```typescript
// src/game/actors/interactable-actor.ts — line 16
readonly needsEffects: Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }>;
```

Also update the return type of `getNeedsEffects()` and the private `effects` field type to match:

```typescript
// src/game/actors/interactable-actor.ts — getNeedsEffects()
getNeedsEffects(): Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }> {
	return this.effects;
}
```

- [ ] **Step 6: Extend PetDefinition needsEffect type**

```typescript
// src/game/data/pet-definitions.ts — line 16 (inside behaviors)
readonly needsEffect: Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }>;
```

- [ ] **Step 7: Run type check to verify all interfaces are consistent**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/" | head -20`
Expected: Type errors in needs-system.ts methods (register, getNeeds, serialize, restore, applyEffect) because NeedsEntry now requires hunger/thirst but they aren't populated yet. Fix in Task 2.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/needs-system.ts" \
  "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts" \
  "01 - Projects/Flowti Plugin/src/game/systems/social-system.ts" \
  "01 - Projects/Flowti Plugin/src/game/actors/interactable-actor.ts" \
  "01 - Projects/Flowti Plugin/src/game/data/pet-definitions.ts"
git commit -m "feat(game): extend AgentNeeds interfaces with hunger/thirst fields"
```

---

### Task 2: Extend NeedsSystem methods

**Files:**
- Modify: `src/game/systems/needs-system.ts` (DECAY, register, applyEffect, getNeeds, serialize, restore)
- Test: `tests/game/systems/needs-system.test.ts`

- [ ] **Step 1: Write failing test for hunger/thirst in register + getNeeds**

```typescript
// tests/game/systems/needs-system.test.ts — add to existing suite
it("registers agent with hunger and thirst defaults", () => {
	const system = new NeedsSystem();
	system.register("alice", {});
	const needs = system.getNeeds("alice");
	expect(needs.hunger).toBe(80);
	expect(needs.thirst).toBe(80);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run -t "registers agent with hunger" 2>&1 | tail -5`
Expected: FAIL

- [ ] **Step 3: Extend DECAY constant with hunger/thirst rates**

```typescript
// src/game/systems/needs-system.ts — lines 45-52
const DECAY = {
	working:      { energy: -0.8, social: -0.3, focus: -1.2, morale: 0.5,  hunger: -0.6, thirst: -0.8 },
	idle:         { energy: 0.5,  social: -0.1, focus: 0.3,  morale: -0.1, hunger: -0.2, thirst: -0.3 },
	wandering:    { energy: 0.3,  social: -0.1, focus: 0.2,  morale: 0,    hunger: -0.3, thirst: -0.4 },
	"walking-to": { energy: -0.2, social: 0,    focus: 0,    morale: 0,    hunger: -0.2, thirst: -0.3 },
	talking:      { energy: -0.3, social: 1.5,  focus: -0.2, morale: 0.3,  hunger: -0.3, thirst: -0.5 },
	"on-break":   { energy: 1.2,  social: 0,    focus: 0.5,  morale: 0.2,  hunger: -0.1, thirst: -0.1 },
} as Record<string, Record<string, number>>;
```

- [ ] **Step 4: Update register() to include hunger/thirst**

```typescript
register(name: string, attributes?: AgentAttributes): void {
	this.agents.set(name, {
		energy: 80, social: 60, focus: 70, morale: 75,
		hunger: 80, thirst: 80,
		attributes: attributes ?? {},
	});
}
```

- [ ] **Step 5: Update applyEffect() to handle hunger/thirst**

Add after the morale line:
```typescript
if (effect.hunger !== undefined) entry.hunger = clamp(entry.hunger + effect.hunger);
if (effect.thirst !== undefined) entry.thirst = clamp(entry.thirst + effect.thirst);
```

- [ ] **Step 6: Update getNeeds() return**

```typescript
getNeeds(name: string): AgentNeeds {
	const entry = this.agents.get(name);
	if (!entry) return { energy: 50, social: 50, focus: 50, morale: 50, hunger: 50, thirst: 50 };
	return { energy: entry.energy, social: entry.social, focus: entry.focus, morale: entry.morale, hunger: entry.hunger, thirst: entry.thirst };
}
```

- [ ] **Step 7: Update serialize() and restore()**

In serialize, add hunger/thirst to the output object.
In restore, add:
```typescript
entry.hunger = clamp(needs.hunger ?? entry.hunger);
entry.thirst = clamp(needs.thirst ?? entry.thirst);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run -t "registers agent with hunger" 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/needs-system.ts" \
  "01 - Projects/Flowti Plugin/tests/game/systems/needs-system.test.ts"
git commit -m "feat(game): extend NeedsSystem with hunger/thirst fields and decay rates"
```

---

### Task 3: Hunger/thirst energy multiplier + update() integration

**Files:**
- Modify: `src/game/systems/needs-system.ts` (update method)
- Modify: `src/game/data/day-phase-config.ts` (NeedMultipliers)
- Modify: `src/game/data/world-config.ts` (hunger/thirst config)
- Test: `tests/game/systems/needs-system.test.ts`

- [ ] **Step 1: Write failing test for energy multiplier when hungry**

```typescript
it("applies energy drain multiplier when hunger is low", () => {
	const system = new NeedsSystem();
	system.register("alice", {});
	// Force hunger below threshold
	system.applyEffect("alice", { hunger: -50 }); // hunger = 30, below 40
	const before = system.getNeeds("alice").energy;
	// Simulate 1 second of working
	system.update(1000, () => "working", () => []);
	const after = system.getNeeds("alice").energy;
	const energyDrop = before - after;
	// Without hunger penalty, working energy decay = 0.8/s
	// With hunger penalty (1.5x), should be ~1.2/s
	expect(energyDrop).toBeGreaterThan(1.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run -t "applies energy drain multiplier" 2>&1 | tail -5`
Expected: FAIL (energy drops at normal rate, no multiplier applied)

- [ ] **Step 3: Extend NeedMultipliers in day-phase-config.ts**

```typescript
// src/game/data/day-phase-config.ts
export interface NeedMultipliers {
	readonly energy: number;
	readonly social: number;
	readonly focus: number;
	readonly morale: number;
	readonly hunger: number;
	readonly thirst: number;
}
```

Update all phase entries to include `hunger` and `thirst` multipliers per the spec table.

- [ ] **Step 4: Add hunger/thirst config to world-config.ts**

```typescript
// Add to NeedsConfig interface
readonly hungerThreshold: number;   // below this, energy decay multiplied
readonly thirstThreshold: number;
readonly hungerEnergyMult: number;  // multiplier when below threshold
readonly thirstEnergyMult: number;
readonly hungerInitial: number;
readonly thirstInitial: number;

// Add to DEFAULT_WORLD_CONFIG needs section
hungerThreshold: 40,
thirstThreshold: 30,
hungerEnergyMult: 1.5,
thirstEnergyMult: 1.5,
hungerInitial: 80,
thirstInitial: 80,
```

- [ ] **Step 5: Update `update()` parameter type and default fallback**

The `phaseMultipliers` parameter type and its default must include hunger/thirst:

```typescript
// src/game/systems/needs-system.ts — update() signature
update(
	deltaMs: number,
	getState: (name: string) => string,
	getNearby: (name: string) => string[],
	phaseMultipliers?: { energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number },
): void {
	const dt = deltaMs / 1000;
	const pm = phaseMultipliers ?? { energy: 1, social: 1, focus: 1, morale: 1, hunger: 1, thirst: 1 };
```

- [ ] **Step 6: Implement energy multiplier in update()**

In the update() loop, add hunger/thirst decay and energy multiplier. Hunger/thirst have no attribute modifiers (only base rate * phase multiplier). Thresholds and multiplier values are hardcoded initially (matching world-config defaults) — config injection is a follow-up refinement.

```typescript
// Hunger/thirst decay (no attribute modifiers — simpler than other needs)
entry.hunger = clamp(entry.hunger + (rates.hunger ?? 0) * (pm.hunger ?? 1) * dt);
entry.thirst = clamp(entry.thirst + (rates.thirst ?? 0) * (pm.thirst ?? 1) * dt);

// Hunger/thirst energy drain multiplier (stacking)
let energyMult = 1;
if (entry.hunger < 40) energyMult *= 1.5;
if (entry.thirst < 30) energyMult *= 1.5;

// Energy line becomes (multiplier applied after attr mod and phase mult):
entry.energy = clamp(entry.energy + applyMod(rates.energy, mods.energy) * pm.energy * energyMult * dt);
```

- [ ] **Step 7: Write additional test for stacking multipliers**

```typescript
it("stacks energy drain when both hunger AND thirst are low", () => {
	const system = new NeedsSystem();
	system.register("alice", {});
	system.applyEffect("alice", { hunger: -50, thirst: -55 }); // both below thresholds
	const before = system.getNeeds("alice").energy;
	system.update(1000, () => "working", () => []);
	const after = system.getNeeds("alice").energy;
	const energyDrop = before - after;
	// 0.8 * 1.5 * 1.5 = 1.8/s (stacked multiplier ~2.25x)
	expect(energyDrop).toBeGreaterThan(1.5);
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run -t "stacks energy drain" 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 9: Run full needs system test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/needs-system.test.ts 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/needs-system.ts" \
  "01 - Projects/Flowti Plugin/src/game/data/day-phase-config.ts" \
  "01 - Projects/Flowti Plugin/src/game/data/world-config.ts" \
  "01 - Projects/Flowti Plugin/tests/game/systems/needs-system.test.ts"
git commit -m "feat(game): add hunger/thirst energy drain multiplier and day-phase config"
```

---

## Chunk 2: Stations & Sprites

### Task 4: Add loadItemSprite utility

**Files:**
- Modify: `src/game/sprites/sprite-loader.ts`

- [ ] **Step 1: Add loadItemSprite function**

```typescript
// src/game/sprites/sprite-loader.ts — add at bottom
/**
 * Load a single-frame item sprite (16x16 NA assets) and scale it.
 * Returns an ex.Sprite ready for use with actor.graphics.use().
 */
export async function loadItemSprite(basePath: string, itemPath: string, scale: number = 2): Promise<ex.Sprite> {
	const source = new ex.ImageSource(`${basePath}/${itemPath}`);
	await source.load();
	const sprite = source.toSprite();
	sprite.scale = ex.vec(scale, scale);
	return sprite;
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/sprites/sprite-loader.ts"
git commit -m "feat(game): add loadItemSprite utility for NA item assets"
```

---

### Task 5: Retrofit existing stations with hunger/thirst effects

**Files:**
- Modify: `src/game/actors/coffee-machine.ts` (add thirst +20)
- Modify: `src/game/actors/snack-table.ts` (add hunger +25)
- Modify: `src/game/actors/water-cooler.ts` (add thirst +15)

- [ ] **Step 1: Update CoffeeMachine needsEffects**

```typescript
// src/game/actors/coffee-machine.ts — constructor super() call
needsEffects: { energy: 15, focus: 5, thirst: 20 },
```

- [ ] **Step 2: Update SnackTable needsEffects**

```typescript
// src/game/actors/snack-table.ts — constructor super() call
needsEffects: { energy: 10, social: 8, morale: 3, hunger: 25 },
```

- [ ] **Step 3: Update WaterCooler needsEffects**

```typescript
// src/game/actors/water-cooler.ts — constructor super() call
needsEffects: { social: 10, thirst: 15 },
```

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/" | head -5`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/coffee-machine.ts" \
  "01 - Projects/Flowti Plugin/src/game/actors/snack-table.ts" \
  "01 - Projects/Flowti Plugin/src/game/actors/water-cooler.ts"
git commit -m "feat(game): retrofit existing stations with hunger/thirst effects"
```

---

### Task 6: Create FoodBowl actor

**Files:**
- Create: `src/game/actors/food-bowl.ts`
- Create: `tests/game/actors/food-bowl.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/game/actors/food-bowl.test.ts
import { describe, it, expect } from "vitest";
import { FoodBowl } from "../../../src/game/actors/food-bowl.js";

describe("FoodBowl", () => {
	it("has correct needsEffects for hunger", () => {
		const bowl = new FoodBowl();
		const effects = bowl.getNeedsEffects();
		expect(effects.hunger).toBe(30);
		expect(effects.energy).toBeUndefined();
	});

	it("has objectType food", () => {
		const bowl = new FoodBowl();
		expect(bowl.objectType).toBe("food");
	});

	it("tracks occupancy", () => {
		const bowl = new FoodBowl();
		expect(bowl.isOccupied()).toBe(false);
		bowl.occupy("cat-hub");
		expect(bowl.isOccupied()).toBe(true);
		bowl.vacate();
		expect(bowl.isOccupied()).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/actors/food-bowl.test.ts 2>&1 | tail -5`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement FoodBowl**

```typescript
// src/game/actors/food-bowl.ts
/**
 * food-bowl.ts — Pet food bowl environmental object.
 * Primary food source for pets. Agents can use in desperation (reduced effect).
 * Uses NA sprite: Items/Food/Meat.png
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class FoodBowl extends InteractableActor {
	constructor() {
		super({
			objectId: "food-bowl",
			objectType: "food",
			width: 32,
			height: 32,
			interactionOffset: { x: 0, y: 20 },
			needsEffects: { hunger: 30 },
		});

		// Canvas placeholder — replaced with NA sprite when loaded
		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Bowl
				ctx.fillStyle = "#d4a574";
				ctx.beginPath();
				ctx.ellipse(16, 20, 14, 8, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#c4956a";
				ctx.beginPath();
				ctx.ellipse(16, 20, 10, 5, 0, 0, Math.PI);
				ctx.fill();
				// Food
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.ellipse(16, 18, 8, 4, 0, 0, Math.PI * 2);
				ctx.fill();
				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "7px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Food", 16, 32);
			},
		});
		this.graphics.use(canvas);
	}

	/** Returns reduced effects for agents (full effects for pets handled by caller). */
	getAgentEffects(): Partial<{ hunger: number; thirst: number }> {
		return { hunger: 10 };
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/actors/food-bowl.test.ts 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/food-bowl.ts" \
  "01 - Projects/Flowti Plugin/tests/game/actors/food-bowl.test.ts"
git commit -m "feat(game): add FoodBowl interactable actor"
```

---

### Task 7: Create WaterBowl actor

**Files:**
- Create: `src/game/actors/water-bowl.ts`
- Create: `tests/game/actors/water-bowl.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/game/actors/water-bowl.test.ts
import { describe, it, expect } from "vitest";
import { WaterBowl } from "../../../src/game/actors/water-bowl.js";

describe("WaterBowl", () => {
	it("has correct needsEffects for thirst", () => {
		const bowl = new WaterBowl();
		const effects = bowl.getNeedsEffects();
		expect(effects.thirst).toBe(25);
		expect(effects.energy).toBeUndefined();
	});

	it("has objectType drink", () => {
		const bowl = new WaterBowl();
		expect(bowl.objectType).toBe("drink");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/actors/water-bowl.test.ts 2>&1 | tail -5`
Expected: FAIL

- [ ] **Step 3: Implement WaterBowl**

Same pattern as FoodBowl but with `needsEffects: { thirst: 25 }`, objectType `"drink"`, and a water bowl Canvas graphic. `getAgentEffects()` returns `{ thirst: 8 }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/actors/water-bowl.test.ts 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/water-bowl.ts" \
  "01 - Projects/Flowti Plugin/tests/game/actors/water-bowl.test.ts"
git commit -m "feat(game): add WaterBowl interactable actor"
```

---

### Task 7b: Replace Canvas graphics with NA sprites on all stations

**Files:**
- Modify: `src/game/actors/coffee-machine.ts`
- Modify: `src/game/actors/snack-table.ts`
- Modify: `src/game/actors/water-cooler.ts`
- Modify: `src/game/actors/food-bowl.ts`
- Modify: `src/game/actors/water-bowl.ts`
- Modify: `src/game/engine.ts` (load sprites during init)

- [ ] **Step 1: Add async sprite loading in engine.ts start()**

After character sprite preloading, load item sprites for all stations:

```typescript
const [coffeeSpr, snackSpr, waterCoolerSpr, foodBowlSpr, waterBowlSpr] = await Promise.all([
	loadItemSprite(spriteBasePath, "Items/Potion/MilkPot.png", 2.5),
	loadItemSprite(spriteBasePath, "Items/Food/Onigiri.png", 2.5),
	loadItemSprite(spriteBasePath, "Items/Potion/WaterPot.png", 2.5),
	loadItemSprite(spriteBasePath, "Items/Food/Meat.png", 2),
	loadItemSprite(spriteBasePath, "Items/Object/Gourd.png", 2),
]);
coffeeMachine.graphics.use(coffeeSpr);
snackTable.graphics.use(snackSpr);
waterCooler.graphics.use(waterCoolerSpr);
foodBowlHub.graphics.use(foodBowlSpr);
foodBowlVillage.graphics.use(foodBowlSpr);
waterBowlOffice.graphics.use(waterBowlSpr);
waterBowlStation.graphics.use(waterBowlSpr);
```

The Canvas graphics in each station class serve as fallbacks if sprite loading fails.

- [ ] **Step 2: Build and verify**

Run: `cd "01 - Projects/Flowti Plugin" && node esbuild.config.mjs --production --no-reports 2>&1 | tail -3`
Expected: Build done

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(game): replace station Canvas graphics with NA sprites"
```

---

## Chunk 3: Behavior Tree Integration

### Task 8: Create needs-hunger BT subtree

**Files:**
- Create: `src/game/brain/behavior-tree/subtrees/needs-hunger.ts`
- Create: `tests/game/brain/behavior-tree/needs-hunger.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/game/brain/behavior-tree/needs-hunger.test.ts
import { describe, it, expect } from "vitest";
import { NEEDS_HUNGER_SUBTREE } from "../../../../src/game/brain/behavior-tree/subtrees/needs-hunger.js";

describe("NeedsHunger subtree", () => {
	it("exports valid MDSL subtree string", () => {
		expect(NEEDS_HUNGER_SUBTREE).toContain("NeedsHunger");
		expect(NEEDS_HUNGER_SUBTREE).toContain("IsHungry");
		expect(NEEDS_HUNGER_SUBTREE).toContain("SeekFoodStation");
		expect(NEEDS_HUNGER_SUBTREE).toContain("Eat");
	});
});
```

- [ ] **Step 2: Implement subtree**

Follow the exact pattern of existing `subtrees/needs-energy.ts`. The MDSL:

```typescript
// src/game/brain/behavior-tree/subtrees/needs-hunger.ts
export const NEEDS_HUNGER_SUBTREE = `root [NeedsHunger] {
	sequence {
		condition [IsHungry]
		action [SeekFoodStation]
		action [Eat]
	}
}`;
```

- [ ] **Step 3: Run test, verify pass, commit**

---

### Task 9: Create needs-thirst BT subtree

**Files:**
- Create: `src/game/brain/behavior-tree/subtrees/needs-thirst.ts`
- Create: `tests/game/brain/behavior-tree/needs-thirst.test.ts`

Same pattern as Task 8 with `NeedsThirst`, `IsThirsty`, `SeekDrinkStation`, `Drink`.

- [ ] **Step 1-3: Test, implement, verify, commit**

---

### Task 10: Add BT conditions and actions for hunger/thirst

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-agent.ts`

- [ ] **Step 1: Add IsHungry condition**

In the conditions object (follow IsEnergyLow pattern):

```typescript
function IsHungry(): boolean {
	return context.needs.hunger < 35;
}
```

- [ ] **Step 2: Add IsThirsty condition**

```typescript
function IsThirsty(): boolean {
	return context.needs.thirst < 30;
}
```

- [ ] **Step 3: Add SeekFoodStation action**

Follow SeekRestSpot pattern — find nearest food-capable station (SnackTable or FoodBowl) via the scene registry's object catalog. Walk to it. Return RUNNING while walking, SUCCEEDED on arrival.

```typescript
function SeekFoodStation(): State {
	const foodObjects = registry.findObjectsOfType("food").concat(registry.findObjectsOfType("energy"));
	// Filter to unoccupied, pick nearest
	// walkTo the interaction point
	// Return State.RUNNING
}
```

- [ ] **Step 4: Add SeekDrinkStation action**

Same pattern for drink-capable stations (CoffeeMachine objectType "energy", WaterCooler objectType "social" — these need objectType updates, or search by objectId).

- [ ] **Step 5: Add Eat and Drink actions**

Simple actions that return SUCCEEDED (the actual effect application is handled by the object attraction system in engine.ts).

- [ ] **Step 6: Register conditions and actions in the agent object**

Add to the conditions/actions maps returned by `createBTAgentObject()`.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(game): add hunger/thirst BT conditions and actions"
```

---

### Task 11: Insert hunger/thirst branches in master selector

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-factory.ts`

- [ ] **Step 1: Import new subtrees**

```typescript
import { NEEDS_HUNGER_SUBTREE } from "./subtrees/needs-hunger.js";
import { NEEDS_THIRST_SUBTREE } from "./subtrees/needs-thirst.js";
```

- [ ] **Step 2: Insert branches in master MDSL**

In `buildMasterMDSL()`, insert after `branch [NeedsEnergy]`:

```
		branch [NeedsHunger]
		branch [NeedsThirst]
```

Before `branch [NeedsSocial]`.

- [ ] **Step 3: Add subtrees to collectSubtrees()**

Add `NEEDS_HUNGER_SUBTREE` and `NEEDS_THIRST_SUBTREE` to the returned map.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(game): insert NeedsHunger/NeedsThirst in BT master selector"
```

---

### Task 12: Extend pet BT with hunger/thirst

**Files:**
- Modify: `src/game/brain/behavior-tree/pet-bt.ts`
- Modify: `src/game/actors/pet-actor.ts` (add hunger/thirst state)

- [ ] **Step 1: Add hunger/thirst to PetBTContext**

```typescript
// src/game/brain/behavior-tree/pet-bt.ts — PetBTContext
export interface PetBTContext {
	name: string;
	state: PetState;
	sleepChance: number;
	wanderRadius: number;
	followTarget: string | null;
	followTimer: number;
	stateTimer: number;
	speed: number;
	hunger: number;   // NEW
	thirst: number;   // NEW
}
```

- [ ] **Step 2: Add hunger/thirst state to PetActor**

```typescript
// src/game/actors/pet-actor.ts — add after existing state fields
private hunger = 70;
private thirst = 70;

getHunger(): number { return this.hunger; }
getThirst(): number { return this.thirst; }
setHunger(v: number): void { this.hunger = Math.max(0, Math.min(100, v)); }
setThirst(v: number): void { this.thirst = Math.max(0, Math.min(100, v)); }
```

Add constant decay in `updateBehavior()`:
```typescript
// At start of updateBehavior, after speed check:
this.hunger = Math.max(0, this.hunger - 0.3 * (deltaMs / 1000));
this.thirst = Math.max(0, this.thirst - 0.4 * (deltaMs / 1000));
```

- [ ] **Step 3: Insert hunger/thirst branches in pet MDSL**

In `PET_MASTER_MDSL`, add before the HasExitTarget sequence:

```
		sequence {
			condition [IsHungry]
			action [SeekFoodBowl]
			action [PetEat]
		}
		sequence {
			condition [IsThirsty]
			action [SeekWaterBowl]
			action [PetDrink]
		}
```

- [ ] **Step 4: Implement pet BT conditions/actions**

In the pet agent object:
- `IsHungry()` — `context.hunger < 40`
- `IsThirsty()` — `context.thirst < 35`
- `SeekFoodBowl()` — find nearest FoodBowl via registry, walk to it
- `SeekWaterBowl()` — find nearest WaterBowl via registry, walk to it
- `PetEat()` / `PetDrink()` — occupy, wait, apply effect, vacate

- [ ] **Step 5: Wire pet hunger/thirst into BT context sync in engine.ts**

In the engine tick where BT contexts are updated (around line 1354), add pet needs sync:

```typescript
for (const pet of pets) {
	const btPet = btSystem.getPet(pet.entityId);
	if (btPet) {
		btPet.context.hunger = pet.getHunger();
		btPet.context.thirst = pet.getThirst();
	}
}
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(game): extend pet BT with hunger/thirst seeking branches"
```

---

## Chunk 4: Engine Wiring, UI & Polish

### Task 13: Wire FoodBowl/WaterBowl in engine.ts

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Import FoodBowl and WaterBowl**

```typescript
import { FoodBowl } from "./actors/food-bowl.js";
import { WaterBowl } from "./actors/water-bowl.js";
```

- [ ] **Step 2: Create instances and add to scenes**

Near the existing environmental objects section (around line 947):

```typescript
const foodBowlHub = new FoodBowl();
const foodBowlVillage = new FoodBowl();
const waterBowlOffice = new WaterBowl();
const waterBowlStation = new WaterBowl();

// Position them (avoid overlapping existing objects)
foodBowlHub.pos = ex.vec(600, 380);
foodBowlVillage.pos = ex.vec(550, 350);
waterBowlOffice.pos = ex.vec(650, 380);
waterBowlStation.pos = ex.vec(350, 380);

hubScene.add(foodBowlHub);
villageScene.add(foodBowlVillage);
officeScene.add(waterBowlOffice);
stationScene.add(waterBowlStation);
```

- [ ] **Step 3: Register objects in SceneRegistry**

```typescript
registry.registerObject("food-bowl-hub", "hub", "food", { x: 600, y: 380 });
registry.registerObject("food-bowl-village", "village", "food", { x: 550, y: 350 });
registry.registerObject("water-bowl-office", "office", "drink", { x: 650, y: 380 });
registry.registerObject("water-bowl-station", "station", "drink", { x: 350, y: 380 });
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(game): wire FoodBowl/WaterBowl into scenes"
```

---

### Task 14: Extend objectAttractions + share interaction

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Add hunger/thirst triggers to objectAttractions**

Add to the existing array (around line 1230):

```typescript
{ object: snackTable, phase: ["lunch", "afternoon-slump"], needCheck: (n: AgentNeeds) => n.hunger < 40, chance: 0.002 },
{ object: coffeeMachine, phase: ["morning-arrival", "afternoon-slump"], needCheck: (n: AgentNeeds) => n.thirst < 40, chance: 0.002 },
{ object: waterCooler, phase: ["afternoon", "afternoon-slump"], needCheck: (n: AgentNeeds) => n.thirst < 30, chance: 0.001 },
{ object: foodBowlHub, phase: ["lunch"], needCheck: (n: AgentNeeds) => n.hunger < 25, chance: 0.001 },
{ object: foodBowlVillage, phase: ["lunch"], needCheck: (n: AgentNeeds) => n.hunger < 25, chance: 0.001 },
{ object: waterBowlOffice, phase: [], needCheck: (n: AgentNeeds) => n.thirst < 20, chance: 0.001 },
{ object: waterBowlStation, phase: [], needCheck: (n: AgentNeeds) => n.thirst < 20, chance: 0.001 },
```

- [ ] **Step 2: Add share interaction in pet-agent proximity loop**

In the existing pet proximity check block (around line 1298), add after the existing reaction logic:

```typescript
// Share mechanic — pet approaches occupied food/drink station
const foodDrinkObjects = [coffeeMachine, snackTable, waterCooler, foodBowlHub, foodBowlVillage, waterBowlOffice, waterBowlStation];
for (const obj of foodDrinkObjects) {
	if (!obj.isOccupied()) continue;
	const occupant = obj.getOccupant();
	if (!occupant) continue;
	// Check if pet is near this occupied station
	const objPoint = obj.getInteractionPoint();
	const petDx = pet.pos.x - objPoint.x;
	const petDy = pet.pos.y - objPoint.y;
	const petDist = Math.sqrt(petDx * petDx + petDy * petDy);
	if (petDist < 40) {
		const shareKey = `share:${occupant}:${pet.entityId}`;
		const lastShare = petReactionCooldowns.get(shareKey) ?? 0;
		if (performance.now() - lastShare > 30000) {
			petReactionCooldowns.set(shareKey, performance.now());
			// Pet gets food/drink effect
			const petEffects = obj.getNeedsEffects();
			if (petEffects.hunger) pet.setHunger(pet.getHunger() + petEffects.hunger * 0.5);
			if (petEffects.thirst) pet.setThirst(pet.getThirst() + petEffects.thirst * 0.5);
			// Agent gets social bonus
			needsSystem.applyEffect(occupant, { social: 3 });
			bubbleSystem.showBubble(occupant, "thought", "Sharing is caring!", engine.currentScene, findAgentActor, 3000);
			particlePool.spawnPreset("hearts", (pet.pos.x + objPoint.x) / 2, (pet.pos.y + objPoint.y) / 2);
		}
	}
}
```

- [ ] **Step 3: Push hunger/thirst to BT context sync**

In the existing BT context sync (around line 1354), the hunger/thirst fields are already synced via the AgentNeeds object:

```typescript
btAgent.context.needs.hunger = live.hunger;
btAgent.context.needs.thirst = live.thirst;
```

- [ ] **Step 4: Build and verify**

Run: `cd "01 - Projects/Flowti Plugin" && node esbuild.config.mjs --production --no-reports 2>&1 | tail -3`
Expected: Build done

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(game): add hunger/thirst object attractions and pet share mechanic"
```

---

### Task 15: Add needs to DashboardStore

**Files:**
- Modify: `src/game/store/dashboard-store.ts`
- Modify: `src/game/engine.ts` (push needs to store)

- [ ] **Step 1: Add agentNeeds map and methods to DashboardStore**

```typescript
// src/game/store/dashboard-store.ts — add field
agentNeeds: Map<string, AgentNeeds> = new Map();

// Add methods
setAgentNeeds(name: string, needs: AgentNeeds): void {
	this.agentNeeds.set(name, needs);
}

getAgentNeeds(name: string): AgentNeeds | undefined {
	return this.agentNeeds.get(name);
}
```

Import `AgentNeeds` from needs-system.ts.

- [ ] **Step 2: Push needs from engine.ts postframe handler**

In the existing `engine.on("postframe")` handler (around line 1383), add:

```typescript
// Push needs to store for UI
for (const agentName of needsSystem.getAgentNames()) {
	store.setAgentNeeds(agentName, needsSystem.getNeeds(agentName));
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(game): push agent needs to DashboardStore for UI consumption"
```

---

### Task 16: Render hunger/thirst bars in panel-info

**Files:**
- Modify: `src/game/ui/panel-info.ts`

- [ ] **Step 1: Add needs bars section to render()**

After the stats grid section, add a "Vitals" section with 6 needs bars. Read from `this.store.getAgentNeeds(this.agentName)`.

```typescript
// Needs bars — 6 bars with labels and colors
const needs = this.store?.getAgentNeeds(this.agentName);
if (needs) {
	const bars = [
		{ label: "Energy", value: needs.energy, color: "#22c55e" },
		{ label: "Hunger", value: needs.hunger, color: "#f97316" },
		{ label: "Thirst", value: needs.thirst, color: "#06b6d4" },
		{ label: "Focus", value: needs.focus, color: "#a855f7" },
		{ label: "Social", value: needs.social, color: "#f59e0b" },
		{ label: "Morale", value: needs.morale, color: "#ec4899" },
	];
	// Render each as a labeled progress bar
}
```

Style with existing panel CSS patterns. Each bar: label left, percentage right, colored fill bar.

Low-state pulse: add CSS class `needs-low` when value < threshold (hunger < 40, thirst < 30, energy < 30).

- [ ] **Step 2: Add CSS for needs bars**

Add to the component's styles (or the appropriate CSS layer file):

```css
.needs-bar { height: 6px; border-radius: 3px; background: #1e293b; overflow: hidden; }
.needs-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
.needs-low .needs-bar-fill { animation: pulse-bar 1s ease-in-out infinite alternate; }
@keyframes pulse-bar { from { opacity: 1; } to { opacity: 0.5; } }
```

- [ ] **Step 3: Build and verify**

Run: `cd "01 - Projects/Flowti Plugin" && node esbuild.config.mjs --production --no-reports 2>&1 | tail -3`
Expected: Build done

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(game): render hunger/thirst bars in agent info panel"
```

---

### Task 17: Save/restore pet hunger/thirst

**Files:**
- Modify: `src/game/engine.ts` (position writer + restore)

- [ ] **Step 1: Extend position writer with pet hunger/thirst**

In the position flush handler (around line 1500), extend pet position entries:

```typescript
for (const pet of pets) {
	positions[pet.entityId] = {
		x: Math.round(pet.pos.x),
		y: Math.round(pet.pos.y),
		scene: registry.getEntityRoom(pet.entityId) ?? "hub",
		state: pet.getState(),
		hunger: Math.round(pet.getHunger()),
		thirst: Math.round(pet.getThirst()),
	};
}
```

- [ ] **Step 2: Restore pet hunger/thirst on startup**

In the pet placement loop (around line 1789), after restoring position:

```typescript
if (saved) {
	pet.pos.x = saved.x;
	pet.pos.y = saved.y;
	if (typeof saved.hunger === "number") pet.setHunger(saved.hunger);
	if (typeof saved.thirst === "number") pet.setThirst(saved.thirst);
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(game): persist pet hunger/thirst in world-positions.json"
```

---

### Task 18: Final integration test + build

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/" | head -10`
Expected: No new source errors

- [ ] **Step 3: Production build**

Run: `cd "01 - Projects/Flowti Plugin" && node esbuild.config.mjs --production --no-reports 2>&1 | tail -3`
Expected: Build done

- [ ] **Step 4: Manual verification checklist**

- [ ] Open Obsidian, navigate to Agent World
- [ ] Verify agents have hunger/thirst bars in info panel
- [ ] Wait for lunch phase — agents should seek SnackTable when hungry
- [ ] Watch pets seek FoodBowl/WaterBowl when hungry/thirsty
- [ ] Verify steal mechanic: pet at station blocks agent
- [ ] Verify share mechanic: agent at station, pet approaches → heart particles
- [ ] Verify energy drains faster when hunger/thirst are low
- [ ] Switch rooms — verify pet bowls are in correct rooms
- [ ] Reload — verify hunger/thirst persist across restarts
