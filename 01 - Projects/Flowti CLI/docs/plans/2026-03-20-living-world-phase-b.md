# Living World Phase B — Behavior Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the behavior layer — agent quirks that differentiate individuals, interactive environmental objects agents navigate to, and a micro-event scheduler that punctuates the day cycle with scripted moments.

**Architecture:** Three new systems. `QuirkSystem` assigns and applies behavioral modifiers via `QuirkOverrides` stored on BrainSystem — no new BrainSystem dependency. `InteractableActor` is a base ExcaliburJS actor class extended by 7 concrete objects placed in scenes. `WorldEventScheduler` fires phase-gated events with probability rolls and choreography handlers consuming existing systems (brain, bubble, particle, needs). All three integrate via engine.ts wiring.

**Tech Stack:** TypeScript, ExcaliburJS (ex.*), vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-20-living-world-design.md` (Systems 2, 3, 4)

**Depends on:** Phase A (DayClock, WorldAmbience, MemorySystem, ParticlePresets) — already on master.

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/game/data/quirk-definitions.ts` | 15 quirk definitions with attribute filters, overrides, phrase pools |
| `src/game/systems/quirk-system.ts` | Quirk assignment, override computation, persistence integration |
| `src/game/actors/interactable-actor.ts` | Base class — attraction function, interaction point, click handler, needs effects |
| `src/game/actors/coffee-machine.ts` | Coffee machine — steam particles, energy+focus boost |
| `src/game/actors/whiteboard-actor.ts` | Whiteboard — scribble particles, collaboration trigger |
| `src/game/actors/snack-table.ts` | Snack table — food bubbles, energy+social+morale boost |
| `src/game/actors/water-cooler.ts` | Water cooler — social boost, conversation trigger |
| `src/game/actors/couch-actor.ts` | Couch — cushion particles, energy+morale boost |
| `src/game/actors/plant-actor.ts` | Plant — decorative, comment trigger on click |
| `src/game/actors/notice-board.ts` | Notice board — shows project metrics on click |
| `src/game/data/micro-event-definitions.ts` | 9 event type definitions with phase/probability/guaranteed flags |
| `src/game/systems/world-event-scheduler.ts` | Event scheduler — phase-gated queue, probability, gap enforcement, choreography |
| `tests/game/data/quirk-definitions.test.ts` | Quirk definition validation tests |
| `tests/game/systems/quirk-system.test.ts` | Quirk assignment, override, persistence tests |
| `tests/game/actors/interactable-actor.test.ts` | Base actor attraction, needs effects tests |
| `tests/game/systems/world-event-scheduler.test.ts` | Scheduler queue, probability, gap, choreography tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/game/systems/brain-system.ts` | Add `applyQuirkOverrides(name, overrides)` + private `quirkOverrides` map |
| `src/game/engine.ts` | Wire QuirkSystem, environmental objects, WorldEventScheduler |
| `src/game/scenes/office-scene.ts` | Add coffee machine + whiteboard |
| `src/game/scenes/village-scene.ts` | Add snack table + water cooler |
| `src/game/scenes/station-scene.ts` | Add couch |
| `src/game/scenes/hub-scene.ts` | Add notice board + plant |
| `tests/game/engine.test.ts` | Add mocks for new systems and objects |

---

## Chunk 1: Quirk Definitions + QuirkSystem

### Task 1: Quirk definitions data

**Files:**
- Create: `src/game/data/quirk-definitions.ts`
- Create: `tests/game/data/quirk-definitions.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { QUIRK_DEFINITIONS, getEligibleQuirks } from "../../../src/game/data/quirk-definitions.js";

describe("quirk-definitions", () => {
	it("has 15 quirk definitions", () => {
		expect(QUIRK_DEFINITIONS).toHaveLength(15);
	});

	it("every quirk has a unique id", () => {
		const ids = QUIRK_DEFINITIONS.map((q) => q.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("every quirk has phrases", () => {
		for (const q of QUIRK_DEFINITIONS) {
			expect(q.phrases.length).toBeGreaterThanOrEqual(3);
		}
	});

	it("getEligibleQuirks filters by attributes", () => {
		const eligible = getEligibleQuirks({ dex: 15, con: 5 }, "engineering");
		const ids = eligible.map((q) => q.id);
		expect(ids).toContain("pacer");       // DEX > 13
		expect(ids).toContain("coffee-addict"); // CON < 8
		expect(ids).toContain("fidgeter");     // DEX > 14 + CON < 10
	});

	it("getEligibleQuirks includes random quirks for any agent", () => {
		const eligible = getEligibleQuirks({}, "general");
		const ids = eligible.map((q) => q.id);
		// Random quirks (snacker, music-lover, plant-parent) are always eligible
		expect(ids).toContain("snacker");
		expect(ids).toContain("music-lover");
		expect(ids).toContain("plant-parent");
	});

	it("getEligibleQuirks respects domain filter", () => {
		const designEligible = getEligibleQuirks({ cha: 15 }, "design");
		const opsEligible = getEligibleQuirks({ cha: 15 }, "operations");
		const designIds = designEligible.map((q) => q.id);
		const opsIds = opsEligible.map((q) => q.id);
		expect(designIds).toContain("doodler");       // CHA > 12 + design
		expect(opsIds).not.toContain("doodler");       // not ops domain
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/data/quirk-definitions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement quirk-definitions.ts**

```typescript
/**
 * quirk-definitions.ts — 15 agent quirks with attribute filters, overrides, and phrase pools.
 */

export interface QuirkOverrides {
	readonly socialRadiusMultiplier?: number;
	readonly idleResistanceMultiplier?: number;
	readonly moveSpeedMultiplier?: number;
	readonly coffeeAttractionMultiplier?: number;
	readonly conversationRateMultiplier?: number;
}

export interface QuirkDefinition {
	readonly id: string;
	readonly label: string;
	readonly filter: (attrs: Record<string, number>, domain: string) => boolean;
	readonly overrides: QuirkOverrides;
	readonly phrases: readonly string[];
}

export const QUIRK_DEFINITIONS: readonly QuirkDefinition[] = [
	{
		id: "pacer", label: "Pacer",
		filter: (a) => (a.dex ?? 0) > 13,
		overrides: { moveSpeedMultiplier: 1.2 },
		phrases: ["Can't sit still when I'm thinking", "Pacing helps me process", "Walking loop number... I've lost count", "My step counter loves me", "Ideas flow better when my feet move"],
	},
	{
		id: "doodler", label: "Doodler",
		filter: (a, d) => (a.cha ?? 0) > 12 && (d === "design" || d === "product"),
		overrides: {},
		phrases: ["Let me sketch this out", "Doodles are just ideas in disguise", "My whiteboard time is sacred", "Drawing helps me think", "Another masterpiece on the whiteboard"],
	},
	{
		id: "coffee-addict", label: "Coffee Addict",
		filter: (a) => (a.con ?? 0) < 8,
		overrides: { coffeeAttractionMultiplier: 2.0 },
		phrases: ["Coffee. Now.", "I run on caffeine and deadlines", "Third cup and counting", "Decaf is a lie", "The coffee machine is my best friend", "Just one more cup"],
	},
	{
		id: "early-bird", label: "Early Bird",
		filter: (a) => (a.wis ?? 0) > 14,
		overrides: {},
		phrases: ["First one in, best parking spot", "Morning is my superpower", "Love the quiet before everyone arrives", "Early start, early finish", "The dawn shift hits different"],
	},
	{
		id: "night-owl", label: "Night Owl",
		filter: (a) => (a.int ?? 0) > 14,
		overrides: {},
		phrases: ["Just getting warmed up", "The best code is written after dark", "Everyone's leaving already?", "Quiet office, peak productivity", "Night shift energy"],
	},
	{
		id: "neat-freak", label: "Neat Freak",
		filter: (a, d) => (a.wis ?? 0) > 12 && d === "quality",
		overrides: {},
		phrases: ["This desk needs organizing", "Everything in its place", "A clean workspace is a clean mind", "Who left this mess?", "Tidying up before I can focus"],
	},
	{
		id: "fidgeter", label: "Fidgeter",
		filter: (a) => (a.dex ?? 0) > 14 && (a.con ?? 0) < 10,
		overrides: { idleResistanceMultiplier: 0.6 },
		phrases: ["Can't. Stay. Still.", "Restless energy today", "My leg has a mind of its own", "Fidgeting is thinking in motion", "Sorry, just restless"],
	},
	{
		id: "snacker", label: "Snacker",
		filter: () => true, // Random 20% applied at assignment
		overrides: {},
		phrases: ["Snack break!", "Is it too early for snacks? Never", "Thinking is hungry work", "The snack table is calling me", "Brain food is still food"],
	},
	{
		id: "social-butterfly", label: "Social Butterfly",
		filter: (a) => (a.cha ?? 0) > 15,
		overrides: { socialRadiusMultiplier: 1.5, conversationRateMultiplier: 2.0 },
		phrases: ["Hey, what's everyone up to?", "Let's chat!", "I know everyone here", "Networking is just making friends", "The more the merrier", "Who wants to grab coffee?"],
	},
	{
		id: "hermit", label: "Hermit",
		filter: (a) => (a.cha ?? 0) < 7,
		overrides: { socialRadiusMultiplier: 0.7, conversationRateMultiplier: 0.5 },
		phrases: ["Need some space", "Headphones on means leave me alone", "Quiet corner, please", "Socializing is exhausting", "Alone time is productive time"],
	},
	{
		id: "rubber-ducker", label: "Rubber Ducker",
		filter: (a, d) => (a.int ?? 0) > 12 && d === "engineering",
		overrides: {},
		phrases: ["Okay, let me explain this to myself", "So the problem is... wait, I get it now", "Talking it through... almost there", "Dear rubber duck, consider the following", "If I explain it out loud, I'll find the bug"],
	},
	{
		id: "music-lover", label: "Music Lover",
		filter: () => true, // Random 25% applied at assignment
		overrides: {},
		phrases: ["This playlist is fire", "Music makes the code flow", "Need new song recommendations", "Headphones are my productivity tool", "The right beat for the right task"],
	},
	{
		id: "plant-parent", label: "Plant Parent",
		filter: () => true, // Random 15% applied at assignment
		overrides: {},
		phrases: ["How's my little green friend today?", "Plants make everything better", "Time to check on my desk plant", "Growing code and growing plants", "This one's looking healthy"],
	},
	{
		id: "whiteboard-warrior", label: "Whiteboard Warrior",
		filter: (a, d) => (a.cha ?? 0) > 12 && (d === "management" || d === "orchestration"),
		overrides: {},
		phrases: ["To the whiteboard!", "Let me draw this out for everyone", "Whiteboard sessions are my cardio", "The diagram will make it clear", "This calls for a visual"],
	},
	{
		id: "stretcher", label: "Stretcher",
		filter: (a) => (a.con ?? 0) > 12,
		overrides: {},
		phrases: ["Time to stretch", "My back will thank me later", "Stand up, stretch, sit back down", "Ergonomics are self-care", "Quick stretch break"],
	},
];

// Random assignment probabilities for always-eligible quirks
const RANDOM_QUIRK_CHANCE: Record<string, number> = {
	snacker: 0.20,
	"music-lover": 0.25,
	"plant-parent": 0.15,
};

/** Get quirks an agent qualifies for based on attributes and domain. */
export function getEligibleQuirks(attrs: Record<string, number>, domain: string): QuirkDefinition[] {
	return QUIRK_DEFINITIONS.filter((q) => q.filter(attrs, domain));
}

/** Roll quirks for an agent. Returns 2-3 quirk IDs. */
export function rollQuirks(attrs: Record<string, number>, domain: string): string[] {
	const eligible = getEligibleQuirks(attrs, domain);
	// Separate attribute-gated from random-always-eligible
	const gated = eligible.filter((q) => !RANDOM_QUIRK_CHANCE[q.id]);
	const random = eligible.filter((q) => RANDOM_QUIRK_CHANCE[q.id]);

	const picked: string[] = [];

	// Pick 1-2 from attribute-gated (if available)
	const shuffledGated = [...gated].sort(() => Math.random() - 0.5);
	for (const q of shuffledGated) {
		if (picked.length >= 2) break;
		picked.push(q.id);
	}

	// Roll random quirks
	for (const q of random) {
		if (picked.length >= 3) break;
		if (Math.random() < (RANDOM_QUIRK_CHANCE[q.id] ?? 0)) {
			picked.push(q.id);
		}
	}

	// Ensure at least 2
	if (picked.length < 2) {
		const remaining = eligible.filter((q) => !picked.includes(q.id));
		const shuffled = [...remaining].sort(() => Math.random() - 0.5);
		for (const q of shuffled) {
			if (picked.length >= 2) break;
			picked.push(q.id);
		}
	}

	return picked.slice(0, 3);
}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/data/quirk-definitions.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/quirk-definitions.ts" \
       "01 - Projects/Flowti Plugin/tests/game/data/quirk-definitions.test.ts"
git commit -m "feat(world): quirk definitions — 15 quirks with attribute filters and phrase pools"
```

### Task 2: QuirkSystem tests + implementation

**Files:**
- Create: `tests/game/systems/quirk-system.test.ts`
- Create: `src/game/systems/quirk-system.ts`

- [ ] **Step 1: Write QuirkSystem tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { QuirkSystem } from "../../../src/game/systems/quirk-system.js";

describe("QuirkSystem", () => {
	it("assigns quirks on register for new agent", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", { dex: 15, int: 14 }, "engineering", []);
		const quirks = sys.getQuirks("Atlas");
		expect(quirks.length).toBeGreaterThanOrEqual(2);
		expect(quirks.length).toBeLessThanOrEqual(3);
	});

	it("restores existing quirks instead of re-rolling", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", { dex: 15 }, "engineering", ["pacer", "rubber-ducker"]);
		expect(sys.getQuirks("Atlas")).toEqual(["pacer", "rubber-ducker"]);
	});

	it("computes combined overrides from all quirks", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", {}, "general", ["social-butterfly", "fidgeter"]);
		const overrides = sys.getOverrides("Atlas");
		expect(overrides.socialRadiusMultiplier).toBe(1.5);
		expect(overrides.idleResistanceMultiplier).toBe(0.6);
	});

	it("returns empty overrides for unknown agent", () => {
		const sys = new QuirkSystem();
		const overrides = sys.getOverrides("nobody");
		expect(overrides).toEqual({});
	});

	it("getQuirkPhrases returns phrases for agent's quirks", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", {}, "general", ["coffee-addict"]);
		const phrases = sys.getQuirkPhrases("Atlas");
		expect(phrases.length).toBeGreaterThan(0);
		expect(phrases.some((p) => p.includes("coffee") || p.includes("caffeine") || p.includes("cup"))).toBe(true);
	});

	it("hasQuirk checks specific quirk", () => {
		const sys = new QuirkSystem();
		sys.register("Atlas", {}, "general", ["pacer"]);
		expect(sys.hasQuirk("Atlas", "pacer")).toBe(true);
		expect(sys.hasQuirk("Atlas", "hermit")).toBe(false);
	});
});
```

- [ ] **Step 2: Implement QuirkSystem**

```typescript
/**
 * quirk-system.ts — Assigns and manages per-agent behavioral quirks.
 *
 * On first registration (no saved quirks), rolls 2-3 quirks from the eligible pool.
 * Computes combined QuirkOverrides for BrainSystem to apply as post-multipliers.
 */

import { QUIRK_DEFINITIONS, rollQuirks, type QuirkOverrides } from "../data/quirk-definitions.js";

interface AgentQuirkEntry {
	quirks: string[];
	overrides: QuirkOverrides;
}

export class QuirkSystem {
	private readonly agents = new Map<string, AgentQuirkEntry>();

	/** Register an agent. If savedQuirks is empty, rolls new quirks. */
	register(name: string, attrs: Record<string, number>, domain: string, savedQuirks: string[]): void {
		const quirks = savedQuirks.length > 0 ? savedQuirks : rollQuirks(attrs, domain);
		const overrides = this.computeOverrides(quirks);
		this.agents.set(name, { quirks, overrides });
	}

	getQuirks(name: string): string[] {
		return this.agents.get(name)?.quirks ?? [];
	}

	getOverrides(name: string): QuirkOverrides {
		return this.agents.get(name)?.overrides ?? {};
	}

	hasQuirk(name: string, quirkId: string): boolean {
		return this.agents.get(name)?.quirks.includes(quirkId) ?? false;
	}

	/** Get all quirk phrase pools combined for an agent. */
	getQuirkPhrases(name: string): string[] {
		const entry = this.agents.get(name);
		if (!entry) return [];
		const phrases: string[] = [];
		for (const qId of entry.quirks) {
			const def = QUIRK_DEFINITIONS.find((d) => d.id === qId);
			if (def) phrases.push(...def.phrases);
		}
		return phrases;
	}

	private computeOverrides(quirks: string[]): QuirkOverrides {
		const result: Record<string, number> = {};
		for (const qId of quirks) {
			const def = QUIRK_DEFINITIONS.find((d) => d.id === qId);
			if (!def) continue;
			for (const [key, value] of Object.entries(def.overrides)) {
				if (typeof value === "number") {
					// Multiply overrides from multiple quirks
					result[key] = (result[key] ?? 1) * value;
				}
			}
		}
		return result as QuirkOverrides;
	}
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/quirk-system.test.ts`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/quirk-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/quirk-system.test.ts"
git commit -m "feat(world): QuirkSystem — assignment, overrides, phrase pools"
```

### Task 3: BrainSystem quirk overrides

**Files:**
- Modify: `src/game/systems/brain-system.ts`

- [ ] **Step 1: Add QuirkOverrides support to BrainSystem**

Read the existing `brain-system.ts` first. Find where `BrainParams` is stored per agent. Add:

1. A private `quirkOverrides: Map<string, Record<string, number>>` field
2. A public `applyQuirkOverrides(name: string, overrides: Record<string, number>): void` method that stores overrides
3. In the `register` method (or wherever `computeParams` is called), after computing params, apply stored quirk overrides as post-multipliers:

```typescript
applyQuirkOverrides(name: string, overrides: Record<string, number>): void {
	this.quirkOverrides.set(name, overrides);
	// Recompute effective params
	const entry = this.entries.get(name);
	if (!entry) return;
	if (overrides.socialRadiusMultiplier) entry.params.socialRadius *= overrides.socialRadiusMultiplier;
	if (overrides.idleResistanceMultiplier) entry.params.idleResistance *= overrides.idleResistanceMultiplier;
	if (overrides.moveSpeedMultiplier) entry.params.moveSpeed *= overrides.moveSpeedMultiplier;
}
```

Note: Read the actual BrainSystem code to find the exact field names for params (socialRadius, idleResistance, moveSpeed) — they may differ. Adapt the property names to match the existing interface.

- [ ] **Step 2: Run all game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass (no regressions)

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/brain-system.ts"
git commit -m "feat(brain): add applyQuirkOverrides for behavioral modifiers"
```

---

## Chunk 2: InteractableActor + Environmental Objects

### Task 4: InteractableActor base class + tests

**Files:**
- Create: `src/game/actors/interactable-actor.ts`
- Create: `tests/game/actors/interactable-actor.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock excalibur
vi.mock("excalibur", () => {
	function MockActor() {
		const self = this as Record<string, unknown>;
		self.pos = { x: 0, y: 0 };
		self.on = vi.fn();
		self.graphics = { use: vi.fn(), opacity: 1 };
	}
	return {
		Actor: MockActor,
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		CollisionType: { PreventCollision: 0 },
		Canvas: function MockCanvas() { return; },
	};
});

import { InteractableActor } from "../../../src/game/actors/interactable-actor.js";

describe("InteractableActor", () => {
	it("stores interaction point offset", () => {
		const actor = new InteractableActor({
			width: 48, height: 48,
			interactionOffset: { x: 0, y: 30 },
			needsEffects: { energy: 10 },
		});
		expect(actor.getInteractionPoint()).toEqual({ x: 0, y: 30 });
	});

	it("returns needs effects", () => {
		const actor = new InteractableActor({
			width: 48, height: 48,
			interactionOffset: { x: 0, y: 0 },
			needsEffects: { energy: 15, focus: 5 },
		});
		expect(actor.getNeedsEffects()).toEqual({ energy: 15, focus: 5 });
	});

	it("tracks occupied state", () => {
		const actor = new InteractableActor({
			width: 48, height: 48,
			interactionOffset: { x: 0, y: 0 },
			needsEffects: {},
		});
		expect(actor.isOccupied()).toBe(false);
		actor.occupy("Atlas");
		expect(actor.isOccupied()).toBe(true);
		expect(actor.getOccupant()).toBe("Atlas");
		actor.vacate();
		expect(actor.isOccupied()).toBe(false);
	});
});
```

- [ ] **Step 2: Implement InteractableActor**

```typescript
/**
 * interactable-actor.ts — Base class for environmental objects agents can interact with.
 *
 * Provides: interaction point (where agent stands), needs effects on arrival,
 * occupy/vacate tracking, and director click handling.
 */

import * as ex from "excalibur";

export interface InteractableConfig {
	readonly width: number;
	readonly height: number;
	readonly interactionOffset: { x: number; y: number };
	readonly needsEffects: Partial<{ energy: number; social: number; focus: number; morale: number }>;
}

export class InteractableActor extends ex.Actor {
	private readonly interactionOffset: { x: number; y: number };
	private readonly effects: Partial<{ energy: number; social: number; focus: number; morale: number }>;
	private occupant: string | null = null;

	constructor(config: InteractableConfig) {
		super({
			width: config.width,
			height: config.height,
			anchor: ex.vec(0.5, 0.5),
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.interactionOffset = config.interactionOffset;
		this.effects = config.needsEffects;
	}

	/** World position where agent should stand when interacting. */
	getInteractionPoint(): { x: number; y: number } {
		return {
			x: this.pos.x + this.interactionOffset.x,
			y: this.pos.y + this.interactionOffset.y,
		};
	}

	getNeedsEffects(): Partial<{ energy: number; social: number; focus: number; morale: number }> {
		return this.effects;
	}

	isOccupied(): boolean {
		return this.occupant !== null;
	}

	getOccupant(): string | null {
		return this.occupant;
	}

	occupy(agentName: string): void {
		this.occupant = agentName;
	}

	vacate(): void {
		this.occupant = null;
	}
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/actors/interactable-actor.test.ts`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/interactable-actor.ts" \
       "01 - Projects/Flowti Plugin/tests/game/actors/interactable-actor.test.ts"
git commit -m "feat(world): InteractableActor base class for environmental objects"
```

### Task 5: Concrete environmental objects (7 actors)

**Files:**
- Create: `src/game/actors/coffee-machine.ts`
- Create: `src/game/actors/whiteboard-actor.ts`
- Create: `src/game/actors/snack-table.ts`
- Create: `src/game/actors/water-cooler.ts`
- Create: `src/game/actors/couch-actor.ts`
- Create: `src/game/actors/plant-actor.ts`
- Create: `src/game/actors/notice-board.ts`

- [ ] **Step 1: Create all 7 object actors**

Each extends `InteractableActor` with the appropriate config from the spec. Example for CoffeeMachine:

```typescript
/**
 * coffee-machine.ts — Coffee machine environmental object.
 * Agents visit when energy is low or during morning/slump phases.
 */
import { InteractableActor } from "./interactable-actor.js";

export class CoffeeMachine extends InteractableActor {
	constructor() {
		super({
			width: 32, height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: { energy: 15, focus: 5 },
		});
	}
}
```

Create similarly for:
- **WhiteboardActor**: `{ width: 64, height: 48, interactionOffset: { x: 0, y: 30 }, needsEffects: { social: 5, focus: 3, morale: 2 } }`
- **SnackTable**: `{ width: 48, height: 40, interactionOffset: { x: 0, y: 24 }, needsEffects: { energy: 10, social: 8, morale: 3 } }`
- **WaterCooler**: `{ width: 24, height: 40, interactionOffset: { x: 0, y: 24 }, needsEffects: { social: 10 } }`
- **CouchActor**: `{ width: 64, height: 36, interactionOffset: { x: 0, y: 20 }, needsEffects: { energy: 20, morale: 5 } }`
- **PlantActor**: `{ width: 20, height: 28, interactionOffset: { x: 0, y: 16 }, needsEffects: {} }`
- **NoticeBoard**: `{ width: 48, height: 40, interactionOffset: { x: 0, y: 24 }, needsEffects: {} }`

All files should follow the same minimal pattern — just extend `InteractableActor` with the right config. Keep them simple, no custom rendering yet (that comes when sprites are added later).

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/coffee-machine.ts" \
       "01 - Projects/Flowti Plugin/src/game/actors/whiteboard-actor.ts" \
       "01 - Projects/Flowti Plugin/src/game/actors/snack-table.ts" \
       "01 - Projects/Flowti Plugin/src/game/actors/water-cooler.ts" \
       "01 - Projects/Flowti Plugin/src/game/actors/couch-actor.ts" \
       "01 - Projects/Flowti Plugin/src/game/actors/plant-actor.ts" \
       "01 - Projects/Flowti Plugin/src/game/actors/notice-board.ts"
git commit -m "feat(world): 7 environmental object actors — coffee, whiteboard, snack, cooler, couch, plant, board"
```

---

## Chunk 3: WorldEventScheduler

### Task 6: Micro-event definitions

**Files:**
- Create: `src/game/data/micro-event-definitions.ts`

- [ ] **Step 1: Implement event definitions**

```typescript
/**
 * micro-event-definitions.ts — 9 world event types with phase gates, probabilities, and flags.
 */

import type { DayPhase } from "./day-phase-config.js";

export interface MicroEventDefinition {
	readonly type: string;
	readonly label: string;
	readonly triggerPhases: readonly DayPhase[];
	readonly probability: number;       // 0-1, rolled per eligible phase
	readonly guaranteed: boolean;
	readonly cooldownMs: number;
	readonly durationMs: number;        // how long the event plays out
	readonly suppressedBySensor?: string; // real sensor event type that suppresses this
	readonly priority: number;           // lower = fires first among guaranteed events
}

export const MICRO_EVENTS: readonly MicroEventDefinition[] = [
	{
		type: "standup", label: "Standup",
		triggerPhases: ["morning-arrival"],
		probability: 1, guaranteed: true, cooldownMs: 0, durationMs: 20_000,
		priority: 1,
	},
	{
		type: "deploy-success", label: "Deploy Success",
		triggerPhases: ["morning-arrival", "productive-morning"],
		probability: 1, guaranteed: true, cooldownMs: 0, durationMs: 8_000,
		suppressedBySensor: "build-success",
		priority: 2,
	},
	{
		type: "tea-time", label: "Tea Time",
		triggerPhases: ["afternoon"],
		probability: 1, guaranteed: true, cooldownMs: 0, durationMs: 12_000,
		priority: 1,
	},
	{
		type: "end-of-day", label: "End of Day Bell",
		triggerPhases: ["wind-down"],
		probability: 1, guaranteed: true, cooldownMs: 0, durationMs: 5_000,
		priority: 1,
	},
	{
		type: "new-pr", label: "New PR",
		triggerPhases: ["productive-morning", "afternoon"],
		probability: 0.6, guaranteed: false, cooldownMs: 60_000, durationMs: 8_000,
		priority: 10,
	},
	{
		type: "eureka", label: "Eureka Moment",
		triggerPhases: ["productive-morning", "afternoon"],
		probability: 0.15, guaranteed: false, cooldownMs: 120_000, durationMs: 6_000,
		priority: 10,
	},
	{
		type: "build-break", label: "Build Break",
		triggerPhases: ["afternoon-slump"],
		probability: 0.5, guaranteed: false, cooldownMs: 0, durationMs: 15_000,
		suppressedBySensor: "test-fail",
		priority: 5,
	},
	{
		type: "birthday", label: "Birthday",
		triggerPhases: ["lunch"],
		probability: 0.10, guaranteed: false, cooldownMs: 0, durationMs: 10_000,
		priority: 10,
	},
	{
		type: "power-flicker", label: "Power Flicker",
		triggerPhases: ["afternoon-slump"],
		probability: 0.05, guaranteed: false, cooldownMs: 0, durationMs: 3_000,
		priority: 10,
	},
];
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/micro-event-definitions.ts"
git commit -m "feat(world): micro-event definitions — 9 event types with phase gates and probabilities"
```

### Task 7: WorldEventScheduler tests + implementation

**Files:**
- Create: `tests/game/systems/world-event-scheduler.test.ts`
- Create: `src/game/systems/world-event-scheduler.ts`

- [ ] **Step 1: Write scheduler tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { WorldEventScheduler } from "../../../src/game/systems/world-event-scheduler.js";

describe("WorldEventScheduler", () => {
	it("fires guaranteed event on phase entry", () => {
		const handler = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("standup", handler);
		scheduler.onPhaseChange("morning-arrival");
		scheduler.update(0); // immediate fire for guaranteed
		expect(handler).toHaveBeenCalled();
	});

	it("rolls probability for non-guaranteed events", () => {
		const handler = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("eureka", handler);
		// Eureka has 15% chance — with mocked random it may or may not fire
		scheduler.onPhaseChange("productive-morning");
		scheduler.update(0);
		// We can't assert it was called (random), but it shouldn't throw
	});

	it("respects 30s minimum gap between events", () => {
		const handler1 = vi.fn();
		const handler2 = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("standup", handler1);
		scheduler.registerHandler("deploy-success", handler2);
		scheduler.onPhaseChange("morning-arrival");
		scheduler.update(0); // fires standup
		expect(handler1).toHaveBeenCalled();
		scheduler.update(10_000); // only 10s later — gap not met
		expect(handler2).not.toHaveBeenCalled();
		scheduler.update(25_000); // now 35s total — gap met
		// deploy-success should now be eligible
	});

	it("suppresses event when real sensor has fired", () => {
		const handler = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("build-break", handler);
		scheduler.recordSensorEvent("test-fail"); // suppresses build-break
		scheduler.onPhaseChange("afternoon-slump");
		scheduler.update(0);
		expect(handler).not.toHaveBeenCalled();
	});

	it("reports active event state", () => {
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("standup", vi.fn());
		expect(scheduler.isEventActive()).toBe(false);
		scheduler.onPhaseChange("morning-arrival");
		scheduler.update(0);
		expect(scheduler.isEventActive()).toBe(true);
	});

	it("clears active state after event duration", () => {
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("end-of-day", vi.fn());
		scheduler.onPhaseChange("wind-down");
		scheduler.update(0);
		expect(scheduler.isEventActive()).toBe(true);
		scheduler.update(6_000); // end-of-day duration is 5s
		expect(scheduler.isEventActive()).toBe(false);
	});

	it("resets sensor suppressions on new cycle", () => {
		const handler = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("build-break", handler);
		scheduler.recordSensorEvent("test-fail");
		scheduler.onCycleReset();
		scheduler.onPhaseChange("afternoon-slump");
		scheduler.update(0);
		// Should no longer be suppressed
	});
});
```

- [ ] **Step 2: Implement WorldEventScheduler**

```typescript
/**
 * world-event-scheduler.ts — Phase-gated micro-event scheduler.
 *
 * Evaluates eligible events on phase changes, rolls probability dice,
 * queues guaranteed events in priority order, enforces 30s minimum gap.
 */

import { MICRO_EVENTS, type MicroEventDefinition } from "../data/micro-event-definitions.js";
import type { DayPhase } from "../data/day-phase-config.js";

const MIN_GAP_MS = 30_000;

interface QueuedEvent {
	definition: MicroEventDefinition;
}

export class WorldEventScheduler {
	private readonly handlers = new Map<string, () => void>();
	private readonly suppressedSensors = new Set<string>();
	private readonly firedThisCycle = new Set<string>();
	private queue: QueuedEvent[] = [];
	private activeEvent: MicroEventDefinition | null = null;
	private activeRemainingMs = 0;
	private gapRemainingMs = 0;

	registerHandler(eventType: string, handler: () => void): void {
		this.handlers.set(eventType, handler);
	}

	recordSensorEvent(sensorType: string): void {
		this.suppressedSensors.add(sensorType);
	}

	isEventActive(): boolean {
		return this.activeEvent !== null;
	}

	getActiveEventType(): string | null {
		return this.activeEvent?.type ?? null;
	}

	onPhaseChange(phase: DayPhase): void {
		// Find eligible events for this phase
		const eligible = MICRO_EVENTS.filter((e) => {
			if (!e.triggerPhases.includes(phase)) return false;
			if (e.suppressedBySensor && this.suppressedSensors.has(e.suppressedBySensor)) return false;
			if (this.firedThisCycle.has(e.type) && e.guaranteed) return false;
			return true;
		});

		// Separate guaranteed from probability-based
		const guaranteed = eligible.filter((e) => e.guaranteed).sort((a, b) => a.priority - b.priority);
		const probabilistic = eligible.filter((e) => !e.guaranteed);

		// Queue guaranteed events
		for (const e of guaranteed) {
			this.queue.push({ definition: e });
		}

		// Roll probability for others
		for (const e of probabilistic) {
			if (Math.random() < e.probability) {
				this.queue.push({ definition: e });
			}
		}
	}

	onCycleReset(): void {
		this.suppressedSensors.clear();
		this.firedThisCycle.clear();
		this.queue = [];
		this.activeEvent = null;
		this.activeRemainingMs = 0;
		this.gapRemainingMs = 0;
	}

	update(deltaMs: number): void {
		// Tick active event
		if (this.activeEvent) {
			this.activeRemainingMs -= deltaMs;
			if (this.activeRemainingMs <= 0) {
				this.activeEvent = null;
				this.gapRemainingMs = MIN_GAP_MS;
			}
			return;
		}

		// Tick gap
		if (this.gapRemainingMs > 0) {
			this.gapRemainingMs -= deltaMs;
			if (this.gapRemainingMs > 0) return;
		}

		// Fire next queued event
		if (this.queue.length > 0) {
			const next = this.queue.shift()!;
			this.activeEvent = next.definition;
			this.activeRemainingMs = next.definition.durationMs;
			this.firedThisCycle.add(next.definition.type);
			const handler = this.handlers.get(next.definition.type);
			if (handler) handler();
		}
	}
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/world-event-scheduler.test.ts`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/world-event-scheduler.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/world-event-scheduler.test.ts" \
       "01 - Projects/Flowti Plugin/src/game/data/micro-event-definitions.ts"
git commit -m "feat(world): WorldEventScheduler — phase-gated micro-events with gap enforcement"
```

---

## Chunk 4: Engine Wiring

### Task 8: Wire QuirkSystem, objects, and scheduler into engine

**Files:**
- Modify: `src/game/engine.ts`
- Modify: `tests/game/engine.test.ts`

- [ ] **Step 1: Add imports**

```typescript
import { QuirkSystem } from "./systems/quirk-system.js";
import { WorldEventScheduler } from "./systems/world-event-scheduler.js";
import { CoffeeMachine } from "./actors/coffee-machine.js";
import { WhiteboardActor } from "./actors/whiteboard-actor.js";
import { SnackTable } from "./actors/snack-table.js";
import { WaterCooler } from "./actors/water-cooler.js";
import { CouchActor } from "./actors/couch-actor.js";
import { PlantActor } from "./actors/plant-actor.js";
import { NoticeBoard } from "./actors/notice-board.js";
```

- [ ] **Step 2: Instantiate systems and objects**

After the Phase A system instantiation block, add:

```typescript
const quirkSystem = new QuirkSystem();
const worldEventScheduler = new WorldEventScheduler();

// Environmental objects
const coffeeMachine = new CoffeeMachine();
coffeeMachine.pos = ex.vec(680, 120);
const whiteboard = new WhiteboardActor();
whiteboard.pos = ex.vec(400, 60);
const snackTable = new SnackTable();
snackTable.pos = ex.vec(400, 380);
const waterCooler = new WaterCooler();
waterCooler.pos = ex.vec(600, 380);
const couch = new CouchActor();
couch.pos = ex.vec(400, 380);
const plant = new PlantActor();
plant.pos = ex.vec(100, 60);
const noticeBoard = new NoticeBoard();
noticeBoard.pos = ex.vec(680, 60);
```

- [ ] **Step 3: Add objects to scenes**

After the existing scene setup:

```typescript
officeScene.add(coffeeMachine);
officeScene.add(whiteboard);
villageScene.add(snackTable);
villageScene.add(waterCooler);
stationScene.add(couch);
hubScene.add(plant);
hubScene.add(noticeBoard);
```

- [ ] **Step 4: Wire QuirkSystem into registerAgents**

In `registerAgents`, after `memorySystem.register(agent.name)`:

```typescript
const savedQuirks = memorySystem.getMemory(agent.name).quirks;
quirkSystem.register(agent.name, agent.attributes ?? {}, agent.domain ?? "general", savedQuirks);
// Store rolled quirks back to memory if they were newly assigned
const agentMem = memorySystem.getMemory(agent.name);
if (agentMem.quirks.length === 0) {
	agentMem.quirks = quirkSystem.getQuirks(agent.name);
}
// Apply quirk overrides to brain params
const overrides = quirkSystem.getOverrides(agent.name);
if (Object.keys(overrides).length > 0) {
	brainSystem.applyQuirkOverrides(agent.name, overrides as Record<string, number>);
}
```

- [ ] **Step 5: Wire WorldEventScheduler to DayClock phase changes**

In the existing `dayClock.onPhaseChange` callback:

```typescript
dayClock.onPhaseChange((phase) => {
	store.setDayPhase(phase);
	store.setWeatherState(worldAmbience.getWeather());
	worldEventScheduler.onPhaseChange(phase);
});
```

- [ ] **Step 6: Wire scheduler update in preframe**

After `dayClock.update(deltaMs)` and the cycle-end block, add:

```typescript
worldEventScheduler.update(deltaMs);
```

- [ ] **Step 7: Wire scheduler cycle reset**

In the cycle-end block (where `prevCycleCount` increments), add:

```typescript
worldEventScheduler.onCycleReset();
```

- [ ] **Step 8: Register basic event handlers**

After the scheduler instantiation, register handlers for the guaranteed events:

```typescript
worldEventScheduler.registerHandler("standup", () => {
	// Gather all idle agents in a circle
	for (const name of needsSystem.getAgentNames()) {
		if (brainSystem.getState(name)?.state === "idle" || brainSystem.getState(name)?.state === "wandering") {
			brainSystem.applyEvent(name, "speaking");
		}
	}
	// Round-robin thought bubbles
	const agents = needsSystem.getAgentNames();
	agents.forEach((name, i) => {
		setTimeout(() => {
			bubbleSystem.showBubble(name, "thought", "Status update...", engine.currentScene, findAgentActor, 3000);
		}, i * 2000);
	});
	setTimeout(() => {
		for (const name of agents) brainSystem.applyEvent(name, "idle");
	}, agents.length * 2000 + 2000);
});

worldEventScheduler.registerHandler("deploy-success", () => {
	const agents = needsSystem.getAgentNames();
	const celebrant = agents[Math.floor(Math.random() * agents.length)];
	if (celebrant) {
		bubbleSystem.showBubble(celebrant, "speech", "Deploy is green! Ship it!", engine.currentScene, findAgentActor, 4000);
		const actor = findAgentActor(celebrant);
		if (actor) particlePool.spawnPreset("confetti", actor.pos.x, actor.pos.y - 20);
		needsSystem.applyEffect(celebrant, { morale: 5 });
	}
});

worldEventScheduler.registerHandler("tea-time", () => {
	// 2-3 idle agents drift to coffee machine
	const idle = needsSystem.getAgentNames().filter((n) => brainSystem.getState(n)?.state === "idle");
	const teaGroup = idle.slice(0, Math.min(3, idle.length));
	for (const name of teaGroup) {
		brainSystem.walkTo(name, coffeeMachine.getInteractionPoint());
	}
});

worldEventScheduler.registerHandler("end-of-day", () => {
	for (const name of needsSystem.getAgentNames()) {
		bubbleSystem.showBubble(name, "thought", "Wrapping up for the day...", engine.currentScene, findAgentActor, 3000);
	}
});

worldEventScheduler.registerHandler("eureka", () => {
	const working = needsSystem.getAgentNames().filter((n) => brainSystem.getState(n)?.state === "working");
	if (working.length > 0) {
		const agent = working[Math.floor(Math.random() * working.length)];
		bubbleSystem.showBubble(agent, "speech", "Wait... I've got it!", engine.currentScene, findAgentActor, 4000);
		const actor = findAgentActor(agent);
		if (actor) particlePool.spawnPreset("sparkle", actor.pos.x, actor.pos.y - 20);
		needsSystem.applyEffect(agent, { morale: 8, focus: 5 });
	}
});

worldEventScheduler.registerHandler("build-break", () => {
	for (const name of needsSystem.getAgentNames()) {
		bubbleSystem.showBubble(name, "thought", "Uh oh...", engine.currentScene, findAgentActor, 2000);
		needsSystem.applyEffect(name, { morale: -3 });
	}
	particlePool.spawnPreset("alert", 400, 250);
	// Resolve after 10s
	setTimeout(() => {
		const resolver = needsSystem.getAgentNames()[0];
		if (resolver) {
			bubbleSystem.showBubble(resolver, "speech", "Fixed it. We're back.", engine.currentScene, findAgentActor, 4000);
		}
	}, 10_000);
});

worldEventScheduler.registerHandler("birthday", () => {
	const agents = needsSystem.getAgentNames();
	const birthdayAgent = agents[Math.floor(Math.random() * agents.length)];
	if (birthdayAgent) {
		bubbleSystem.showBubble(birthdayAgent, "speech", "Wait, is that cake?!", engine.currentScene, findAgentActor, 4000);
		particlePool.spawnPreset("confetti", snackTable.pos.x, snackTable.pos.y - 20);
		for (const name of agents) needsSystem.applyEffect(name, { morale: 3 });
	}
});

worldEventScheduler.registerHandler("power-flicker", () => {
	// Brief opacity dip handled by WorldAmbience in future — for now just bubbles
	for (const name of needsSystem.getAgentNames()) {
		bubbleSystem.showBubble(name, "thought", "?", engine.currentScene, findAgentActor, 1500);
	}
	setTimeout(() => {
		const ops = needsSystem.getAgentNames()[0];
		if (ops) bubbleSystem.showBubble(ops, "speech", "Just a blip. All good.", engine.currentScene, findAgentActor, 3000);
	}, 2000);
});

worldEventScheduler.registerHandler("new-pr", () => {
	const agents = needsSystem.getAgentNames();
	const author = agents[Math.floor(Math.random() * agents.length)];
	if (author) {
		brainSystem.walkTo(author, whiteboard.getInteractionPoint());
		setTimeout(() => {
			bubbleSystem.showBubble(author, "thought", "New PR ready for review", engine.currentScene, findAgentActor, 3000);
			particlePool.spawnPreset("scribble", whiteboard.pos.x, whiteboard.pos.y);
		}, 3000);
	}
});
```

- [ ] **Step 9: Wire sensor events to scheduler for suppression**

In the existing `sensorSystem.onReaction` callback, add:

```typescript
worldEventScheduler.recordSensorEvent(reaction.type ?? "");
```

Wait — the reaction object has `agentName`, `bubble`, `needsEffect`, but not the sensor type directly. Instead, wire it from the sensor push site. Find where `sensorSystem.pushFeedback` is called and add suppression there. If `pushFeedback` takes a type like `"test-fail"`, call `worldEventScheduler.recordSensorEvent(type)` at the same call site.

- [ ] **Step 10: Update engine test mocks**

Add mocks for the new systems and actors:

```typescript
vi.mock("../../src/game/systems/quirk-system.js", () => {
	function MockQuirkSystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.getQuirks = vi.fn(() => []);
		self.getOverrides = vi.fn(() => ({}));
		self.getQuirkPhrases = vi.fn(() => []);
		self.hasQuirk = vi.fn(() => false);
	}
	return { QuirkSystem: MockQuirkSystem };
});

vi.mock("../../src/game/systems/world-event-scheduler.js", () => {
	function MockWorldEventScheduler() {
		const self = this as Record<string, unknown>;
		self.registerHandler = vi.fn();
		self.recordSensorEvent = vi.fn();
		self.onPhaseChange = vi.fn();
		self.onCycleReset = vi.fn();
		self.update = vi.fn();
		self.isEventActive = vi.fn(() => false);
	}
	return { WorldEventScheduler: MockWorldEventScheduler };
});

// Mock all environmental objects
for (const name of ["coffee-machine", "whiteboard-actor", "snack-table", "water-cooler", "couch-actor", "plant-actor", "notice-board"]) {
	vi.mock(`../../src/game/actors/${name}.js`, () => {
		function MockActor() {
			const self = this as Record<string, unknown>;
			self.pos = { x: 0, y: 0 };
			self.getInteractionPoint = vi.fn(() => ({ x: 0, y: 0 }));
			self.getNeedsEffects = vi.fn(() => ({}));
			self.isOccupied = vi.fn(() => false);
			self.occupy = vi.fn();
			self.vacate = vi.fn();
		}
		const className = name.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join("");
		return { [className]: MockActor };
	});
}
```

Note: The dynamic mock loop may not work with vi.mock's hoisting. If it fails, write 7 separate vi.mock calls instead.

- [ ] **Step 11: Run all game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass

- [ ] **Step 12: Run tsc**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 13: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/brain-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/engine.test.ts"
git commit -m "feat(engine): wire QuirkSystem, 7 environmental objects, WorldEventScheduler"
```

---

## Chunk 5: Final Verification

### Task 9: Full verification

- [ ] **Step 1: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 2: Lint new files**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/game/systems/quirk-system.ts src/game/systems/world-event-scheduler.ts src/game/actors/interactable-actor.ts src/game/data/quirk-definitions.ts src/game/data/micro-event-definitions.ts 2>&1`
Expected: No errors

- [ ] **Step 3: All game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass (375 + ~25 new)

- [ ] **Step 4: Full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: All pass (8660+)

- [ ] **Step 5: Build**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build passes
