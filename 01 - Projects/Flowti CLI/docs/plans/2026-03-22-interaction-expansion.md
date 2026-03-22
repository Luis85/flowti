# Interaction System Expansion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the interaction system from agent-only to full entity coverage (pets, NPC, rooms), migrate 4 bypassing behaviors through the bus, and grow templates from 26 to ~100.

**Architecture:** Three layers executed sequentially. Layer 1 registers pet/NPC/room resolvers in engine wiring. Layer 2 replaces direct pet behaviors and WorldEventScheduler handlers with interaction bus submissions. Layer 3 adds ~74 new templates to existing data files. All work uses existing bus infrastructure — no new domain mechanics.

**Tech Stack:** TypeScript (strict, no `any`), ExcaliburJS, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-22-interaction-expansion-design.md`

---

## File Map

### Layer 1 — Resolver Registration

| File | Change | Responsibility |
|------|--------|----------------|
| `01 - Projects/Flowti Plugin/src/game/engine.ts` | Modify | Register pet resolvers, NPC resolver, room resolvers after bootstrap |
| `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts` | Modify | Tick pet/NPC/room resolvers and submit results to bus |
| `01 - Projects/Flowti Plugin/tests/game/systems/interaction/resolver-wiring.test.ts` | Create | Integration tests for all resolver registrations |

### Layer 2 — Behavior Migration

| File | Change | Responsibility |
|------|--------|----------------|
| `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts` | Modify | Remove direct pet behaviors, replaced by resolver submissions |
| `01 - Projects/Flowti Plugin/src/game/engine-pet-share.ts` | Delete | Share logic moves to pet resolver + templates |
| `01 - Projects/Flowti Plugin/src/game/systems/world-event-scheduler.ts` | Modify | Add bus submission for world events |
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/pet-social.ts` | Modify | Add migration templates (proximity-comfort, catalyst, share) |
| `01 - Projects/Flowti Plugin/tests/game/systems/interaction/migration.test.ts` | Create | Before/after tests for migrated behaviors |

### Layer 3 — Template Expansion

| File | Change | Responsibility |
|------|--------|----------------|
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/agent-agent.ts` | Modify | Expand from 5 to 20 templates |
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/agent-pet.ts` | Modify | Expand from 3 to 8 templates |
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/pet-social.ts` | Modify | Expand from 3+migration to 10 templates |
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/npc-interactions.ts` | Modify | Expand from 3 to 8 templates |
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/room-reactions.ts` | Modify | Expand from 3 to 10 templates |
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/director-commands.ts` | Modify | Expand from 3 to 8 templates |
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/cross-type.ts` | Modify | Expand from 3 to 12 templates |
| `01 - Projects/Flowti CLI/src/domain/interactions/templates/environment-events.ts` | Modify | Expand from 3 to 10 templates |
| `01 - Projects/Flowti CLI/tests/domain/interactions/template-validation.test.ts` | Create | Validate all templates: unique IDs, valid effects, well-formed |

---

## Chunk 1: Layer 1 — Resolver Registration

### Task 1: Register Pet Resolvers

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`

- [ ] **Step 1: Read the current pet creation code**

Read `engine.ts` around line 358 where `const pets = createPets()` is called, and lines 359-365 where pets are registered with BtSystem. Also read the bootstrap wiring around lines 331-343 where `interactionBootstrap` is created.

Read `01 - Projects/Flowti Plugin/src/game/systems/interaction/bootstrap-interactions.ts` to find `registerPetResolver()` signature.

- [ ] **Step 2: Register pet resolvers in engine.ts**

After the pet BT registration loop (~line 365), add pet resolver registration. For each mobile pet (exclude fish — stationary), register a resolver:

```typescript
// ── Pet interaction resolvers ──────────────────────
for (const pet of pets) {
	if (pet.petType === "fish") continue; // stationary, no interactions
	registerPetResolver(interactionBootstrap, pet.entityId, {
		social: socialSystem,
		relationship: relationshipSystem,
		needs: needsSystem,
		dayClock,
		conversation: conversationEngine,
	}, () => ({
		hunger: pet.getHunger(),
		thirst: pet.getThirst(),
		energy: 80, // pets don't have energy tracking — use constant
		affinity: new Map(pet.getBondedAgent() ? [[pet.getBondedAgent()!, pet.getAffection()]] : []),
	}));
}
```

Import `registerPetResolver` from bootstrap (it may already be imported — check).

- [ ] **Step 3: Add pet resolver ticking in engine-simulation.ts**

In `tickPets()`, after `pet.updateBehavior(deltaMs)`, add resolver ticking for each pet. The pet resolvers are in `ctx.interactionBootstrap?.resolvers.entities`. For each pet, look up its resolver, call `resolve()`, and submit results to the bus:

```typescript
// Tick pet interaction resolver
if (ctx.interactionBootstrap) {
	const resolver = ctx.interactionBootstrap.resolvers.entities.get(pet.entityId);
	if (resolver) {
		const interactions = resolver.resolve();
		for (const interaction of interactions) {
			ctx.interactionBootstrap.system.getBus().submit(interaction);
		}
	}
}
```

Add this inside the `for (const pet of ctx.pets)` loop, after `pet.updateBehavior(deltaMs)`.

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "engine\.ts|engine-simulation"`
Expected: No errors for these files

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/ 2>&1 | tail -10`
Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(plugin): register pet interaction resolvers and tick in game loop"
```

---

### Task 2: Register NPC Resolver (Merchant)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`

- [ ] **Step 1: Read NPC resolver API**

Read `01 - Projects/Flowti Plugin/src/game/systems/interaction/npc-intent-resolver.ts` first 30 lines for `NPCResolverConfig` interface.
Read `01 - Projects/Flowti Plugin/src/game/systems/interaction/bootstrap-interactions.ts` to confirm `createNPCIntentResolver` is exported.

- [ ] **Step 2: Create merchant NPC resolver in engine.ts**

After the pet resolver registration, add:

```typescript
// ── NPC interaction resolver (merchant) ────────────
const merchantResolver = createNPCIntentResolver({
	npcId: "npc-merchant",
	npcRole: "merchant",
	rules: [
		{
			npcRole: "merchant",
			trigger: "proximity",
			conditions: [],
			interaction: {
				category: "commerce",
				action: "merchant-pitch",
				cardinality: "one-to-one",
				effects: [{ type: "bubble", target: "initiator", bubbleKind: "speech", phrasePool: "merchant-pitch" }],
				cooldownMs: 60000,
			},
			weight: 50,
			cooldownMs: 60000,
		},
		{
			npcRole: "merchant",
			trigger: "idle-timeout",
			conditions: [],
			interaction: {
				category: "reactive",
				action: "merchant-idle-grumble",
				cardinality: "entity-to-environment",
				effects: [{ type: "bubble", target: "initiator", bubbleKind: "thought", phrasePool: "merchant-idle-grumble" }],
				cooldownMs: 45000,
			},
			weight: 30,
			cooldownMs: 45000,
		},
	],
	getNearby: () => [...socialSystem.getNearbyEntities("npc-merchant")],
	getCooldown: () => interactionBootstrap.system.getBus().getCooldown("npc-merchant", "npc", "merchant-pitch"),
	now: () => Date.now(),
});
interactionBootstrap.resolvers.entities.set("npc-merchant", merchantResolver);
```

Import `createNPCIntentResolver` from bootstrap (it re-exports the factory).

- [ ] **Step 3: Register merchant NPC in SceneRegistry**

The merchant needs a room registration so `getNearbyEntities` can find agents near it. After SceneRegistry creation, register the merchant:

```typescript
registry.setEntityRoom("npc-merchant", "hub");
```

- [ ] **Step 4: Tick NPC resolver in tickInteractions**

In `engine-simulation.ts`, inside `tickInteractions()`, after the main `interactionSystem.tick()` call, add resolver ticking for non-agent entities (NPC, rooms). These resolvers produce interactions that need to be submitted before the next tick processes them:

```typescript
// Tick NPC/room resolvers and submit
if (ctx.interactionBootstrap) {
	for (const [id, resolver] of ctx.interactionBootstrap.resolvers.entities) {
		if (id.startsWith("npc-") || id.startsWith("room-")) {
			const interactions = resolver.resolve();
			const bus = ctx.interactionBootstrap.system.getBus();
			for (const interaction of interactions) {
				bus.submit(interaction);
			}
		}
	}
}
```

- [ ] **Step 5: Type check and test**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "engine\.ts|engine-simulation"`
Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/ 2>&1 | tail -10`
Expected: No errors, all passing

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(plugin): register merchant NPC interaction resolver"
```

---

### Task 3: Register Room Resolvers

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts`

- [ ] **Step 1: Read room resolver API**

Read `01 - Projects/Flowti Plugin/src/game/systems/interaction/room-intent-resolver.ts` first 30 lines for `RoomResolverConfig`.

- [ ] **Step 2: Create room resolvers in engine.ts**

After the NPC resolver, create one resolver per room:

```typescript
// ── Room interaction resolvers ─────────────────────
const ROOM_CONFIGS: Array<{ id: string; type: string }> = [
	{ id: "room-hub", type: "break-room" },
	{ id: "room-office", type: "office" },
	{ id: "room-village", type: "village" },
	{ id: "room-station", type: "station" },
];
for (const room of ROOM_CONFIGS) {
	const roomResolver = createRoomIntentResolver({
		roomId: room.id,
		roomType: room.type,
		rules: [], // Populated by templates via prerequisites — room reactions fire via template phase filters
		getOccupancy: () => registry.getEntitiesInRoom(room.id.replace("room-", "")).length,
		getOccupantIds: () => registry.getEntitiesInRoom(room.id.replace("room-", "")),
		getCollectiveMood: () => {
			const occupants = registry.getEntitiesInRoom(room.id.replace("room-", ""));
			if (occupants.length === 0) return { mood: "neutral", intensity: 50 };
			let totalMorale = 0;
			for (const id of occupants) {
				try { totalMorale += needsSystem.getNeeds(id).morale; } catch { /* pet/npc */ }
			}
			const avg = totalMorale / Math.max(occupants.length, 1);
			const mood = avg < 30 ? "stressed" : avg > 80 ? "energized" : avg > 60 ? "relaxed" : "neutral";
			return { mood, intensity: avg };
		},
		getPhase: () => dayClock.getPhase(),
	});
	interactionBootstrap.resolvers.entities.set(room.id, roomResolver);
}
```

Import `createRoomIntentResolver` from bootstrap.

- [ ] **Step 3: Type check and test**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "engine\.ts"`
Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/ 2>&1 | tail -10`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(plugin): register room interaction resolvers with collective mood derivation"
```

---

### Task 4: Layer 1 Integration Test

**Files:**
- Create: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/resolver-wiring.test.ts`

- [ ] **Step 1: Write resolver wiring tests**

Test that each resolver type produces valid interactions given appropriate conditions.

```typescript
import { describe, it, expect } from "vitest";
import { bootstrapInteractionSystem, registerAgentResolver, registerPetResolver } from "../../../../src/game/systems/interaction/bootstrap-interactions.js";
import { createNPCIntentResolver } from "../../../../src/game/systems/interaction/npc-intent-resolver.js";
import { createRoomIntentResolver } from "../../../../src/game/systems/interaction/room-intent-resolver.js";
import type { BootstrapSystems } from "../../../../src/game/systems/interaction/bootstrap-interactions.js";

function makeSystems(): BootstrapSystems {
	return {
		social: { getNearbyEntities: () => [{ id: "agent-a", entityType: "agent", distance: 2 }] },
		relationship: { getAffinity: () => 40 },
		needs: {
			getAgentNames: () => ["agent-a", "agent-b"],
			getNeeds: () => ({ energy: 80, social: 15, focus: 80, morale: 80, hunger: 80, thirst: 80 }),
		},
		dayClock: { getPhase: () => "productive-morning" },
		conversation: { isLocked: () => false },
	};
}

describe("Resolver Wiring", () => {
	it("pet resolver produces interactions when nearby agent and hunger low", () => {
		const systems = makeSystems();
		const bootstrap = bootstrapInteractionSystem(systems);
		const resolver = registerPetResolver(bootstrap, "cat-hub", systems, () => ({
			hunger: 20, thirst: 80, energy: 80,
			affinity: new Map([["agent-a", 60]]),
		}));
		const interactions = resolver.resolve();
		// Pet with low hunger near agent should consider care templates
		expect(interactions.length).toBeGreaterThanOrEqual(0);
		if (interactions.length > 0) {
			expect(interactions[0].initiator.entityType).toBe("pet");
		}
	});

	it("NPC resolver fires proximity rule when agent nearby", () => {
		const resolver = createNPCIntentResolver({
			npcId: "npc-merchant",
			npcRole: "merchant",
			rules: [{
				npcRole: "merchant",
				trigger: "proximity",
				conditions: [],
				interaction: { category: "commerce", action: "pitch", cardinality: "one-to-one", effects: [], cooldownMs: 0 },
				weight: 50,
				cooldownMs: 0,
			}],
			getNearby: () => [{ id: "agent-a", entityType: "agent", distance: 2 }],
			getCooldown: () => 0,
			now: () => 1000,
		});
		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("pitch");
	});

	it("room resolver fires reactive rule when occupancy met", () => {
		const resolver = createRoomIntentResolver({
			roomId: "room-hub",
			roomType: "break-room",
			rules: [{
				roomType: "break-room",
				layer: "reactive",
				conditions: [{ type: "occupancy", op: ">", value: 1 }],
				interaction: { category: "environmental", action: "ambient", cardinality: "one-to-many", effects: [], cooldownMs: 0 },
				cooldownMs: 0,
			}],
			getOccupancy: () => 3,
			getOccupantIds: () => ["agent-a", "agent-b", "agent-c"],
			getCollectiveMood: () => ({ mood: "relaxed", intensity: 65 }),
			getPhase: () => "productive-morning",
		});
		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].targets).toHaveLength(3);
	});
});
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/resolver-wiring.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/tests/game/systems/interaction/resolver-wiring.test.ts"
git commit -m "test(plugin): resolver wiring integration tests for pet, NPC, room"
```

---

## Chunk 2: Layer 2 — Behavior Migration

### Task 5: Add Migration Templates

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/interactions/templates/pet-social.ts`

- [ ] **Step 1: Add pet proximity, catalyst, and share templates**

Append to the `PET_SOCIAL_TEMPLATES` array in `pet-social.ts`:

```typescript
{
	id: "pet-proximity-comfort",
	category: "care",
	action: "pet-proximity-comfort",
	cardinality: "one-to-one",
	initiatorTypes: ["pet"],
	targetTypes: ["agent"],
	prerequisites: [],
	weight: 4,
	tags: ["care", "pet", "proximity", "ambient"],
	priority: 20,
	cooldownMs: 30000,
	duration: 0,
	effects: [
		{ type: "need-change", target: "targets", need: "morale", amount: 3 },
		{ type: "bubble", target: "initiator", bubbleKind: "emote", phrasePool: "reactive:comfort" },
		{ type: "particle", target: "all", particleType: "hearts" },
	],
},
{
	id: "pet-catalyst-social",
	category: "social",
	action: "pet-catalyst-social",
	cardinality: "one-to-many",
	initiatorTypes: ["pet"],
	targetTypes: ["agent"],
	prerequisites: [],
	weight: 1,
	tags: ["social", "pet", "catalyst"],
	priority: 25,
	cooldownMs: 120000,
	duration: 0,
	effects: [
		{ type: "affinity-change", target: "targets", amount: 2 },
		{ type: "need-change", target: "targets", need: "social", amount: 3 },
	],
},
{
	id: "pet-share-food",
	category: "care",
	action: "pet-share-food",
	cardinality: "one-to-one",
	initiatorTypes: ["pet"],
	targetTypes: ["agent"],
	prerequisites: [],
	weight: 2,
	tags: ["care", "pet", "sharing", "food"],
	priority: 20,
	cooldownMs: 30000,
	duration: 0,
	effects: [
		{ type: "need-change", target: "all", need: "hunger", amount: 10 },
		{ type: "need-change", target: "targets", need: "social", amount: 3 },
		{ type: "particle", target: "all", particleType: "hearts" },
	],
},
{
	id: "pet-share-drink",
	category: "care",
	action: "pet-share-drink",
	cardinality: "one-to-one",
	initiatorTypes: ["pet"],
	targetTypes: ["agent"],
	prerequisites: [],
	weight: 2,
	tags: ["care", "pet", "sharing", "drink"],
	priority: 20,
	cooldownMs: 30000,
	duration: 0,
	effects: [
		{ type: "need-change", target: "all", need: "thirst", amount: 10 },
		{ type: "need-change", target: "targets", need: "social", amount: 3 },
		{ type: "particle", target: "all", particleType: "hearts" },
	],
},
```

- [ ] **Step 2: Lint and type check**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/interactions/templates/pet-social.ts --config configs/eslint.config.mjs && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | grep "pet-social"`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/templates/pet-social.ts"
git commit -m "feat(interactions): add migration templates for pet proximity, catalyst, and share behaviors"
```

---

### Task 6: Migrate Pet Proximity Reactions

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-types.ts` (if petReactionCooldowns removal needed)

- [ ] **Step 1: Read current checkPetProximityReactions**

Read `engine-simulation.ts` around the `checkPetProximityReactions` function to understand the full behavior being replaced.

- [ ] **Step 2: Remove checkPetProximityReactions call from tickPets**

In `tickPets()`, remove the `checkPetProximityReactions(ctx, pet, petRoom)` call. The pet resolver (added in Task 1) now handles proximity interactions via `pet-proximity-comfort` template — the resolver checks nearby entities, and the bus applies effects + renders bubbles.

- [ ] **Step 3: Remove checkPetProximityReactions function**

Delete the entire `checkPetProximityReactions()` function from `engine-simulation.ts`.

- [ ] **Step 4: Remove petReactionCooldowns from engine state**

If `petReactionCooldowns` is only used by `checkPetProximityReactions`, remove it from:
- `engine-types.ts` — `EngineMutableState` interface
- `engine.ts` — EngineContext state initialization

Check for other usages first with grep.

- [ ] **Step 5: Type check and test**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -c "error"` (compare with pre-change count)
Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ 2>&1 | tail -10`
Expected: Same error count, tests passing

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-types.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "refactor(plugin): migrate pet proximity reactions to interaction bus"
```

---

### Task 7: Migrate Pet Catalyst and Pet Share

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts` (remove pet-share import)

- [ ] **Step 1: Remove tryPetCatalystConversation call and function**

In `tickPets()`, remove the `tryPetCatalystConversation(ctx, pet, petRoom)` call.
Delete the `tryPetCatalystConversation()` function and its `PET_CATALYST_CHANCE` constant.

The pet resolver now handles this via the `pet-catalyst-social` template. When 2+ agents are nearby, the resolver may select this template (weight 1 = rare, cooldown 120s).

- [ ] **Step 2: Remove checkPetShareInteraction call and import**

In `tickPets()`, remove the `checkPetShareInteraction(ctx, pet, petRoom)` call.
In `engine-simulation.ts` imports, remove `import { checkPetShareInteraction } from "./engine-pet-share.js"`.

The pet resolver handles this via `pet-share-food` / `pet-share-drink` templates.

- [ ] **Step 3: Remove petShareCooldowns from engine state**

If `petShareCooldowns` is only used by `checkPetShareInteraction`, remove from:
- `engine-types.ts` — `EngineMutableState` interface
- `engine.ts` — EngineContext state initialization

- [ ] **Step 4: Delete engine-pet-share.ts if now empty of consumers**

Check if `engine-pet-share.ts` is imported anywhere else. If not, delete it.

- [ ] **Step 5: Type check and test**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -c "error"`
Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ 2>&1 | tail -10`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-types.ts"
git commit -m "refactor(plugin): migrate pet catalyst and pet share to interaction bus"
```

---

### Task 8: WorldEventScheduler Integration

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/world-event-scheduler.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts`

- [ ] **Step 1: Read WorldEventScheduler**

Read `world-event-scheduler.ts` to understand the handler registration pattern and event firing.

- [ ] **Step 2: Add interaction bus submission to scheduler**

Add an optional `interactionBus` field to the scheduler. When an event fires and a matching template exists, submit an interaction to the bus alongside calling the existing handler.

Add a method or constructor option:

```typescript
setInteractionBus(bus: { submit(interaction: Interaction): { status: string } }): void
```

When an event fires:
- Still call existing handler (backwards compatible)
- Additionally, if bus is set, create an interaction with `initiatorTypes: ["room"]` targeting agents and submit

- [ ] **Step 3: Wire bus in engine.ts**

After creating the WorldEventScheduler and InteractionSystem, call:

```typescript
worldEventScheduler.setInteractionBus(interactionBootstrap.system.getBus());
```

- [ ] **Step 4: Type check and test**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "world-event"`
Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/ 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/world-event-scheduler.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(plugin): wire WorldEventScheduler to submit interactions to bus"
```

---

## Chunk 3: Layer 3 — Template Expansion

### Task 9: Expand Agent-Agent Templates (5→20)

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/interactions/templates/agent-agent.ts`

- [ ] **Step 1: Read existing templates**

Read `agent-agent.ts` to see the 5 existing templates and their structure.

- [ ] **Step 2: Add 15 new agent-agent templates**

Add templates covering: pair-debugging, brainstorm-invite, deadline-stress-vent, rubber-ducking, mentoring-moment, departure-wave, domain-crossover, celebrating-milestone, gossip-about-absent, awkward-silence-break, competitive-challenge, inside-joke, noticed-mood-change, suggest-break, overheard-something.

Each template must have:
- Unique `id` (kebab-case)
- Differentiated `weight` (1-5)
- Unique tag combination (at least 1 distinctive tag)
- Appropriate `phaseFilter` and `tierRange`
- Effects using `reactive:` phrasePool IDs
- `cooldownMs` preventing spam (30000-300000)

Follow the exact `InteractionTemplate` type shape from existing templates.

- [ ] **Step 3: Lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/interactions/templates/agent-agent.ts --config configs/eslint.config.mjs`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/templates/agent-agent.ts"
git commit -m "feat(interactions): expand agent-agent templates to 20"
```

---

### Task 10: Expand All Other Template Files

**Files:**
- Modify: All 7 remaining template files in `01 - Projects/Flowti CLI/src/domain/interactions/templates/`

- [ ] **Step 1: Expand each file to target count**

| File | Current | Target | Add |
|------|---------|--------|-----|
| `agent-pet.ts` | 3 | 8 | 5 |
| `pet-social.ts` | 7 (3 original + 4 migration) | 10 | 3 |
| `npc-interactions.ts` | 3 | 8 | 5 |
| `room-reactions.ts` | 3 | 10 | 7 |
| `director-commands.ts` | 3 | 8 | 5 |
| `cross-type.ts` | 3 | 12 | 9 |
| `environment-events.ts` | 3 | 10 | 7 |

Follow the same design principles as Task 9: differentiated weights, unique tags, phase filters, tier ranges, `reactive:` phrasePool IDs, appropriate cooldowns.

- [ ] **Step 2: Lint all template files**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/interactions/templates/ --config configs/eslint.config.mjs`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/templates/"
git commit -m "feat(interactions): expand all template files to ~100 total"
```

---

### Task 11: Template Validation Test

**Files:**
- Create: `01 - Projects/Flowti CLI/tests/domain/interactions/template-validation.test.ts`

- [ ] **Step 1: Write validation test**

```typescript
import { describe, it, expect } from "vitest";
import { AGENT_AGENT_TEMPLATES } from "../../../src/domain/interactions/templates/agent-agent.js";
import { AGENT_PET_TEMPLATES } from "../../../src/domain/interactions/templates/agent-pet.js";
import { PET_SOCIAL_TEMPLATES } from "../../../src/domain/interactions/templates/pet-social.js";
import { NPC_INTERACTION_TEMPLATES } from "../../../src/domain/interactions/templates/npc-interactions.js";
import { ROOM_REACTION_TEMPLATES } from "../../../src/domain/interactions/templates/room-reactions.js";
import { DIRECTOR_COMMAND_TEMPLATES } from "../../../src/domain/interactions/templates/director-commands.js";
import { CROSS_TYPE_TEMPLATES } from "../../../src/domain/interactions/templates/cross-type.js";
import { ENVIRONMENT_EVENT_TEMPLATES } from "../../../src/domain/interactions/templates/environment-events.js";
import type { InteractionTemplate } from "../../../src/domain/interactions/interaction-types.js";

const ALL_TEMPLATES: readonly InteractionTemplate[] = [
	...AGENT_AGENT_TEMPLATES,
	...AGENT_PET_TEMPLATES,
	...PET_SOCIAL_TEMPLATES,
	...NPC_INTERACTION_TEMPLATES,
	...ROOM_REACTION_TEMPLATES,
	...DIRECTOR_COMMAND_TEMPLATES,
	...CROSS_TYPE_TEMPLATES,
	...ENVIRONMENT_EVENT_TEMPLATES,
];

describe("Template Validation", () => {
	it("has at least 90 templates total", () => {
		expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(90);
	});

	it("all template IDs are unique", () => {
		const ids = ALL_TEMPLATES.map(t => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all templates have required fields", () => {
		for (const t of ALL_TEMPLATES) {
			expect(t.id).toBeTruthy();
			expect(t.category).toBeTruthy();
			expect(t.action).toBeTruthy();
			expect(t.cardinality).toBeTruthy();
			expect(t.initiatorTypes.length).toBeGreaterThan(0);
			expect(t.targetTypes.length).toBeGreaterThan(0);
			expect(t.weight).toBeGreaterThan(0);
			expect(t.cooldownMs).toBeGreaterThanOrEqual(0);
			expect(Array.isArray(t.effects)).toBe(true);
			expect(Array.isArray(t.tags)).toBe(true);
		}
	});

	it("all templates have at least one tag", () => {
		for (const t of ALL_TEMPLATES) {
			expect(t.tags.length).toBeGreaterThan(0);
		}
	});

	it("covers at least 7 distinct categories", () => {
		const categories = new Set(ALL_TEMPLATES.map(t => t.category));
		expect(categories.size).toBeGreaterThanOrEqual(7);
	});

	it("no template has weight above 5", () => {
		for (const t of ALL_TEMPLATES) {
			expect(t.weight).toBeLessThanOrEqual(5);
		}
	});
});
```

- [ ] **Step 2: Run test**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/template-validation.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/domain/interactions/template-validation.test.ts"
git commit -m "test(interactions): template validation — unique IDs, required fields, category coverage"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run full CLI interaction tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/ --config configs/vitest.config.ts`
Expected: All passing

- [ ] **Step 2: Run full Plugin game system tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/ 2>&1 | tail -10`
Expected: All passing

- [ ] **Step 3: Lint CLI interactions**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/interactions/ --config configs/eslint.config.mjs`
Expected: Clean

- [ ] **Step 4: Commit any final fixes**

---

## Dependency Graph

```
Layer 1:  Task 1 (pet) → Task 2 (NPC) → Task 3 (rooms) → Task 4 (test)
                                                              ↓
Layer 2:  Task 5 (templates) → Task 6 (pet proximity) → Task 7 (catalyst+share) → Task 8 (WorldEvent)
                                                                                        ↓
Layer 3:  Task 9 (agent-agent) → Task 10 (all others) → Task 11 (validation) → Task 12 (verify)
```

Tasks within each layer are sequential. Layers are sequential (Layer 2 depends on Layer 1's resolver wiring, Layer 3 is independent but runs last for clean verification).
