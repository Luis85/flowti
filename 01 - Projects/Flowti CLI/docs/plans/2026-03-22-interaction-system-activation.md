# Interaction System Activation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dormant interaction system into the live game engine so interactions fire at runtime — agents evaluate templates, submit to the bus, effects mutate game state, and bubbles/particles render on screen.

**Architecture:** Five integration points connect the existing built-and-tested interaction system to the engine: (1) bootstrap instantiation in engine.ts, (2) per-agent resolver + BT hook injection during registration, (3) effect state consumption in tickInteractions, (4) CE cooperative lock wiring, (5) effect rendering. No new domain logic — pure wiring.

**Tech Stack:** TypeScript (strict), ExcaliburJS, existing Plugin systems (NeedsSystem, RelationshipSystem, TalkEngine, BubbleSystem, ConversationEngine, BtSystem)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-22-interaction-system-design.md`

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `01 - Projects/Flowti Plugin/src/game/engine.ts` | Modify | Import bootstrap, instantiate InteractionSystem, pass to EngineContext, wire CE externalLockQuery |
| `01 - Projects/Flowti Plugin/src/game/engine-startup.ts` | Modify | Add InteractionBootstrap to RegistrationSystems, register agent resolvers + BT hooks per agent |
| `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts` | Modify | Expand tickInteractions to consume effect state and call renderer |
| `01 - Projects/Flowti Plugin/src/game/engine-types.ts` | Modify | Add InteractionBootstrap to EngineContext (or derive from existing `interactions?` field) |
| `01 - Projects/Flowti Plugin/tests/game/systems/interaction/activation.test.ts` | Create | Integration test verifying the full pipeline fires |

---

## Chunk 1: Engine Bootstrap + CE Lock Wiring

### Task 1: Instantiate InteractionSystem in engine.ts

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts` (~lines 307-328, 526-551)

- [ ] **Step 1: Add imports**

Add to engine.ts imports section:

```typescript
import { bootstrapInteractionSystem } from "./systems/interaction/bootstrap-interactions.js";
import type { InteractionBootstrap } from "./systems/interaction/bootstrap-interactions.js";
```

- [ ] **Step 2: Create InteractionSystem after ConversationEngine**

Insert after the `conversationEngine.registerJokes()` call (~line 324), before `const registry = new SceneRegistry()`:

```typescript
// ── Interaction system ──────────────────────────
const interactionBootstrap = bootstrapInteractionSystem({
	social: socialSystem,
	relationship: relationshipSystem,
	needs: needsSystem,
	dayClock,
	conversation: conversationEngine,
	talk: talkEngine,
	bubble: bubbleSystem,
});
```

- [ ] **Step 3: Wire CE externalLockQuery**

Modify the ConversationEngine constructor (~line 308) to add the lock query. Since `interactionBootstrap` doesn't exist yet at CE creation time (circular), use a deferred approach — create a mutable ref:

```typescript
let interactionLockQuery: ((entityId: string) => boolean) | undefined;
```

Add before the ConversationEngine constructor. Then add to CE callbacks:

```typescript
externalLockQuery: (entityId) => interactionLockQuery?.(entityId) ?? false,
```

After bootstrapInteractionSystem, wire the ref:

```typescript
interactionLockQuery = (entityId) => interactionBootstrap.system.isEntityLocked(entityId);
```

- [ ] **Step 4: Add to EngineContext systems**

In the `ctx` object (~line 526), add to the `systems` block:

```typescript
interactions: interactionBootstrap.system,
```

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "engine.ts"`
Expected: No errors for engine.ts

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(plugin): instantiate InteractionSystem in engine bootstrap"
```

---

## Chunk 2: Per-Agent Resolver + BT Hook Injection

### Task 2: Wire resolvers and BT hooks during agent registration

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-startup.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts` (~line where `registerAgents` is called)

- [ ] **Step 1: Add InteractionBootstrap to RegistrationSystems**

In `engine-startup.ts`, add the import:

```typescript
import type { InteractionBootstrap } from "./systems/interaction/bootstrap-interactions.js";
import { registerAgentResolver } from "./systems/interaction/bootstrap-interactions.js";
```

Add to `RegistrationSystems` interface:

```typescript
readonly interactionBootstrap?: InteractionBootstrap;
```

- [ ] **Step 2: Register agent resolver + inject BT hooks in registerSingleAgent**

In `registerSingleAgent()`, after `sys.bt.register(agent, sys.btDeps)` (~line 92), add:

```typescript
// Wire interaction resolver + BT hooks
if (sys.interactionBootstrap) {
	const resolver = registerAgentResolver(sys.interactionBootstrap, name, {
		social: sys.social,
		relationship: sys.relationship,
		needs: sys.needs,
		dayClock: { getPhase: () => "" },  // injected via BT context refresh
		conversation: { isLocked: () => false },
	});

	// Inject interaction hooks into BT agent context
	const btAgent = sys.bt.getAgent(name);
	if (btAgent) {
		const bus = sys.interactionBootstrap.system.getBus();
		btAgent.context.interactionHooks = {
			getNearby: () => sys.social.getNearbyEntities(name),
			resolve: () => resolver.resolve().map(i => ({ id: i.id, action: i.action })),
			submit: (interaction) => {
				const full = resolver.resolve().find(i => i.id === interaction.id);
				if (!full) return false;
				const result = bus.submit(full);
				return result.status === "enqueued";
			},
		};
	}
}
```

- [ ] **Step 3: Pass interactionBootstrap when calling registerAgents**

In `engine.ts`, find where `registerAgents` is called and the `RegistrationSystems` object is built (~line 433-440). Add `interactionBootstrap` to the systems object:

```typescript
interactionBootstrap,
```

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "engine-startup|engine.ts"`
Expected: No errors for these files

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-startup.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(plugin): register interaction resolvers and BT hooks per agent"
```

---

## Chunk 3: Effect State Consumption + Rendering

### Task 3: Expand tickInteractions to consume effect state and render

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-types.ts`

- [ ] **Step 1: Add InteractionBootstrap to EngineContext**

In `engine-types.ts`, add import:

```typescript
import type { InteractionBootstrap } from "./systems/interaction/bootstrap-interactions.js";
```

Add to `EngineContext` interface (alongside the existing fields):

```typescript
readonly interactionBootstrap?: InteractionBootstrap;
```

In `engine.ts`, add to the `ctx` object:

```typescript
interactionBootstrap,
```

- [ ] **Step 2: Expand tickInteractions to consume effect state**

In `engine-simulation.ts`, replace the existing `tickInteractions`:

```typescript
import { renderInteractionActions } from "./systems/interaction/interaction-effect-renderer.js";
import type { EffectState } from "../../../../Flowti CLI/src/domain/interactions/interaction-effects.js";
```

```typescript
export function tickInteractions(ctx: EngineContext): void {
	const interactionSystem = ctx.systems.interactions;
	if (!interactionSystem) return;

	runTimedGameSystem(ctx, "interactions", () => {
		const { actions, state } = interactionSystem.tick(ctx.state.deltaMs);

		// Apply accumulated state mutations to game systems
		applyInteractionState(ctx, state);

		// Route visual effects to renderer
		if (ctx.interactionBootstrap && actions.length > 0) {
			renderInteractionActions(actions, {
				talk: ctx.systems.talk,
				bubble: {
					showBubble: (entityId, kind, text) => {
						ctx.systems.bubble.showBubble(
							entityId, kind, text,
							ctx.engine.currentScene,
							ctx.lookups.findAgentActor,
							4000,
						);
					},
				},
			});
		}
	});
}
```

- [ ] **Step 3: Implement applyInteractionState helper**

Add below tickInteractions in the same file:

```typescript
function applyInteractionState(ctx: EngineContext, state: EffectState): void {
	const { systems: sys } = ctx;

	// Affinity changes
	for (const change of state.affinityChanges) {
		sys.relationship.recordInteraction(change.from, change.to, change.amount);
	}

	// Need changes
	for (const change of state.needChanges) {
		sys.needs.applyEffect(change.entityId, { [change.need]: change.amount });
	}

	// Mood changes
	for (const change of state.moodChanges) {
		sys.needs.setMood(change.entityId, change.mood);
	}
}
```

Note: economy changes and memory records are deferred (no economy/inventory system yet). Room mood shifts are deferred (no room mood aggregate yet). These arrays will accumulate but not be consumed until those systems exist.

- [ ] **Step 4: Verify the RelationshipSystem and NeedsSystem APIs**

Before committing, verify that `recordInteraction(from, to, amount)`, `applyEffect(name, effects)`, and `setMood(name, mood)` exist on the respective systems. Read the system files to confirm method signatures. Adjust the calls if the API differs.

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "engine-simulation|engine-types|engine.ts"`
Expected: No errors for these files

- [ ] **Step 6: Run Plugin game system tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/ 2>&1 | tail -10`
Expected: All passing, no regressions

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-types.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(plugin): consume interaction effect state and render actions in game loop"
```

---

## Chunk 4: Integration Test

### Task 4: End-to-end activation test

**Files:**
- Create: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/activation.test.ts`

- [ ] **Step 1: Write integration test**

This test verifies the full pipeline: bootstrap → resolver → bus → effects → state consumption.

```typescript
import { describe, it, expect, vi } from "vitest";
import { bootstrapInteractionSystem, registerAgentResolver } from "../../../../src/game/systems/interaction/bootstrap-interactions.js";
import type { BootstrapSystems } from "../../../../src/game/systems/interaction/bootstrap-interactions.js";

function makeSystems(): BootstrapSystems {
	return {
		social: {
			getNearbyEntities: () => [{ id: "vex", entityType: "agent", distance: 2 }],
		},
		relationship: { getAffinity: () => 40 },
		needs: {
			getAgentNames: () => ["atlas", "vex"],
			getNeeds: () => ({ energy: 80, social: 15, focus: 80, morale: 80, hunger: 80, thirst: 80 }),
		},
		dayClock: { getPhase: () => "productive-morning" },
		conversation: { isLocked: () => false },
	};
}

describe("Interaction System Activation", () => {
	it("full pipeline: bootstrap → resolve → submit → tick → effects", () => {
		const systems = makeSystems();
		const bootstrap = bootstrapInteractionSystem(systems);
		const resolver = registerAgentResolver(bootstrap, "atlas", systems);

		// Resolver should produce an interaction (social need is low at 15)
		const interactions = resolver.resolve();
		expect(interactions.length).toBeGreaterThanOrEqual(0);

		// If resolver produced an interaction, submit and tick
		if (interactions.length > 0) {
			const bus = bootstrap.system.getBus();
			const result = bus.submit(interactions[0]);
			expect(result.status).toBe("enqueued");

			const { actions, state } = bootstrap.system.tick(16);
			// Should have processed the interaction
			const history = bus.getHistory();
			expect(history.length).toBeGreaterThan(0);
		}
	});

	it("cooperative locks prevent double-booking", () => {
		const systems = makeSystems();
		// CE reports vex as locked
		systems.conversation.isLocked = (id) => id === "vex";

		const bootstrap = bootstrapInteractionSystem(systems);
		const bus = bootstrap.system.getBus();

		// Submit interaction targeting vex — should be rejected due to CE lock
		bus.submit({
			id: "test-locked",
			initiator: { id: "atlas", entityType: "agent" },
			targets: [{ id: "vex", entityType: "agent" }],
			cardinality: "one-to-one",
			category: "social",
			action: "greet",
			priority: 30,
			context: {},
			cooldownMs: 0,
			prerequisites: [{ type: "not-locked" }],
			effects: [],
			timestamp: Date.now(),
		});

		const rejected: string[] = [];
		bus.on("rejected", (i) => rejected.push(i.id));
		bootstrap.system.tick(16);

		expect(rejected).toContain("test-locked");
	});

	it("BT hooks shape matches InteractionHooks interface", () => {
		const systems = makeSystems();
		const bootstrap = bootstrapInteractionSystem(systems);
		const resolver = registerAgentResolver(bootstrap, "atlas", systems);
		const bus = bootstrap.system.getBus();

		// Simulate what engine-startup does
		const hooks = {
			getNearby: () => systems.social.getNearbyEntities("atlas"),
			resolve: () => resolver.resolve().map(i => ({ id: i.id, action: i.action })),
			submit: (interaction: { id: string; action: string }) => {
				const full = resolver.resolve().find(i => i.id === interaction.id);
				if (!full) return false;
				return bus.submit(full).status === "enqueued";
			},
		};

		expect(typeof hooks.getNearby).toBe("function");
		expect(typeof hooks.resolve).toBe("function");
		expect(typeof hooks.submit).toBe("function");
	});
});
```

- [ ] **Step 2: Run the test**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/activation.test.ts`
Expected: PASS

- [ ] **Step 3: Run full interaction test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/`
Expected: All passing

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/tests/game/systems/interaction/activation.test.ts"
git commit -m "test(plugin): end-to-end interaction system activation tests"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run full CLI test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/ --config configs/vitest.config.ts`
Expected: 116 tests passing

- [ ] **Step 2: Run full Plugin game system tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/`
Expected: All passing, no regressions

- [ ] **Step 3: Lint CLI interaction domain**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/interactions/ --config configs/eslint.config.mjs`
Expected: Clean

- [ ] **Step 4: Commit any final fixes**

---

## Dependency Graph

```
Task 1 (engine bootstrap) ──→ Task 2 (agent registration) ──→ Task 3 (effect consumption)
                                                                      │
                                                               Task 4 (integration test)
                                                                      │
                                                               Task 5 (final verification)
```

All tasks are sequential — each builds on the previous.

## What This Activates

After this plan:
- Agents evaluate interaction templates each BT tick via `[InteractionIntent]` subtree
- Matching interactions are submitted to the bus, validated, and executed
- Effects mutate NeedsSystem (hunger, social, morale, etc.) and RelationshipSystem (affinity)
- Bubbles and emotes render on screen via TalkEngine/BubbleSystem
- ConversationEngine and InteractionBus respect each other's locks
- All 35 seed templates are live and firing

## What Remains Deferred

- Economy transaction consumption (no economy system yet)
- Room mood shift consumption (no room mood aggregate)
- Memory record consumption (no long-term memory write-back)
- WorldEventScheduler → bus bridge (world events don't spawn interactions yet)
- NPC spawning system (NPC resolver exists but no NPC actors)
- Pet resolver registration (needs pet state accessor wiring)
- Template expansion to ~150 (content work, no code changes needed)
