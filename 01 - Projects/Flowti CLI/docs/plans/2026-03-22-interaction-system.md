# Universal Interaction System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a universal interaction bus that lets any entity (agent, pet, NPC, director, room) interact with any other at any cardinality, creating emergent storytelling through cascading interaction chains.

**Architecture:** CLI domain owns all types, bus logic, templates, and persistence (pure functions, injected deps). Plugin wires the bus into the Excalibur tick loop, implements IntentResolvers per entity type, and renders visual effects. The InteractionBus coordinates with (not replaces) the existing Rich Dialogue system — ConversationEngine keeps its own lock model for multi-turn scripts; the bus and CE use a cooperative lock query model.

**Tech Stack:** TypeScript (strict, no `any`), Vitest, mistreevous MDSL (BT subtrees), ExcaliburJS (Plugin actors)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-22-interaction-system-design.md`

### Rich Dialogue System (Completed — Integration Context)

The Rich Dialogue Expansion is fully implemented. The interaction system must integrate with, not replace, these components:

| Component | Location | What It Does | Interaction System Relationship |
|-----------|----------|--------------|-------------------------------|
| **ConversationEngine** | `systems/talk/conversation-engine.ts` | Multi-turn scripted conversations (168 scripts + 15 running jokes). Owns `Set<string>` lock per participant. | **Cooperative locks**: Bus checks `CE.isLocked()` in prerequisites; CE checks `bus.isEntityLocked()` before starting scripts. |
| **TalkEngine** | `systems/talk/talk-engine.ts` | 10-step ambient chatter pipeline, reactive triggers, dedup. | Bus `bubble` effects call `TalkEngine.triggerReactive()` or direct `showBubble()`. |
| **FragmentComposer** | `systems/talk/fragment-composer.ts` | 500+ fragments, 4 composition patterns, mood/domain/tier-filtered. | Interaction templates can reference fragment pools in `bubble` effects via `phrasePool`. |
| **RelationshipSystem** | `systems/relationship-system.ts` | `getAffinity()`, `getTier()`, `recordConversation()`, `onTierChange()`, joke play counts. | Prerequisite checker uses `getAffinity()`/`getTier()` directly. `affinity-change` effects call `recordConversation()`. |
| **Pet Voice System** | `templates/pet-phrases.ts`, `pet-reactive-phrases.ts`, `pet-phrase-chains.ts` | Instinct/eloquent/gremlin three-voice inner monologue, 7 reactive triggers, 10 phrase chains. | Pet IntentResolver triggers pet reactive phrases via `TalkEngine.triggerReactive()`. |
| **Tier Modifiers** | `templates/tier-modifiers.ts` | 150+ prefix/suffix fragments per tier, 15% chance wrapping in TalkEngine. | No direct interaction — operates within TalkEngine's existing pipeline. |

**Lock Model (Cooperative, NOT Replacement):**
```
InteractionBus.isEntityLocked(id, type) ←→ ConversationEngine.isLocked(name)

Before bus accepts interaction:
  1. Check bus's own active locks
  2. Query CE.isLocked() for each participant
  → If either locked, reject (unless Override priority 91+)

Before CE starts conversation:
  1. Check CE's own locked set
  2. Query bus.isEntityLocked() for each participant
  → If either locked, tryScript() returns false
```

**Conversation triggering split:**
- **ConversationEngine owns:** proximity-triggered multi-turn scripted conversations (168 scripts, running jokes, pet-catalyst scripts)
- **InteractionBus owns:** all other interaction types — NPC commerce, room reactions, director commands, cross-entity chains, environmental events, work/care/playful interactions that don't map to CE scripts

---

## File Map

### CLI Domain — `01 - Projects/Flowti CLI/src/domain/interactions/`

| File | Responsibility | New/Modify |
|------|----------------|------------|
| `interaction-types.ts` | All interfaces: `Interaction`, `EntityRef`, `InteractionPrerequisite`, `InteractionEffect`, `InteractionTemplate`, etc. | Create |
| `interaction-bus.ts` | Core bus: queue, validate prerequisites, conflict resolve, lock manager, cascade depth, history ring buffer, tick pipeline | Create |
| `interaction-effects.ts` | Pure effect applicator: maps each `InteractionEffect` discriminant to state mutation functions | Create |
| `intent-resolver-types.ts` | `IntentResolver` interface, `NPCInteractionRule`, `RoomInteractionRule`, `EnvironmentCondition` | Create |
| `interaction-templates.ts` | Template registry: load, filter, tag-boost, recency-penalty, weighted-random selection | Create |
| `interaction-persistence.ts` | JSONL append/read for `interaction-log.jsonl`, cooldown restoration on resume | Create |
| `templates/agent-agent.ts` | ~10 seed agent-to-agent interaction templates | Create |
| `templates/agent-pet.ts` | ~5 seed agent-to-pet templates | Create |
| `templates/pet-social.ts` | ~5 seed pet-initiated templates | Create |
| `templates/npc-interactions.ts` | ~5 seed merchant NPC templates | Create |
| `templates/room-reactions.ts` | ~5 seed room reactive/active templates | Create |
| `templates/director-commands.ts` | ~5 seed director command templates | Create |

### CLI Tests — `01 - Projects/Flowti CLI/tests/domain/interactions/`

| File | Covers |
|------|--------|
| `interaction-types.test.ts` | Type guard functions, entity ref factories |
| `interaction-bus.test.ts` | Full bus pipeline: submit, tick, lock, conflict, cascade, expiry, watchdog |
| `interaction-effects.test.ts` | Each effect discriminant produces correct state mutations |
| `interaction-templates.test.ts` | Registry filter, tag boost, recency penalty, weighted selection |
| `interaction-persistence.test.ts` | JSONL write/read, schema version, cooldown restore |

### Plugin Game — `01 - Projects/Flowti Plugin/src/game/systems/interaction/`

| File | Responsibility | New/Modify |
|------|----------------|------------|
| `interaction-system.ts` | Owns bus instance, calls `bus.tick()` per frame, routes `InteractionAction[]` to EventBus | Create |
| `agent-intent-resolver.ts` | Reads BT context + proximity, selects templates, submits to bus | Create |
| `pet-intent-resolver.ts` | Reads pet BT context, filters to social/care/playful/reactive, submits | Create |
| `npc-intent-resolver.ts` | Evaluates NPC rule tables against world state | Create |
| `room-intent-resolver.ts` | Evaluates room conditions (occupancy, mood, phase) | Create |
| `director-intent-resolver.ts` | Translates user clicks/commands to interactions | Create |
| `interaction-effect-renderer.ts` | Maps `InteractionAction[]` to TalkEngine bubbles, particles, sounds | Create |

### Plugin Modifications

| File | Change |
|------|--------|
| `src/game/brain/behavior-tree/subtrees/interaction.ts` | Create: `INTERACTION_SUBTREE` MDSL |
| `src/game/brain/behavior-tree/bt-factory.ts` | Modify: add `[InteractionIntent]` to master selector |
| `src/game/brain/behavior-tree/bt-types.ts` | Modify: add `activeInteraction` to BTAgentContext |
| `src/game/engine-simulation.ts` | Modify: add `tickInteractions` as phase 10 via `runTimedPhase` |
| `src/game/engine-types.ts` | Modify: add `interactions?: InteractionSystem` to `EngineSystems` interface |
| `src/game/systems/social-system.ts` | Modify: strip conversation triggering, retain proximity detection, add `getNearbyEntities()` |

### Plugin Tests — `01 - Projects/Flowti Plugin/tests/game/systems/interaction/`

| File | Covers |
|------|--------|
| `interaction-system.test.ts` | Bus tick integration, action routing |
| `agent-intent-resolver.test.ts` | Template selection from BT context |
| `pet-intent-resolver.test.ts` | Category filtering (no work/commerce) |
| `npc-intent-resolver.test.ts` | Rule table evaluation |
| `room-intent-resolver.test.ts` | Condition evaluation per layer |

---

## Chunk 1: CLI Domain — Core Types & Bus

Foundation layer. All other chunks depend on this. Pure CLI domain code — no Plugin, no Excalibur.

### Task 1: Interaction Type Definitions

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/interaction-types.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/interactions/interaction-types.test.ts`

- [ ] **Step 1: Write type guard tests**

```typescript
import { describe, it, expect } from "vitest";
import {
	isValidEntityRef,
	isValidInteraction,
	createEntityRef,
	MAX_LOCK_DURATION,
	MAX_CHAIN_DEPTH,
	HISTORY_BUFFER_SIZE,
} from "../../../src/domain/interactions/interaction-types.js";

describe("interaction-types", () => {
	describe("createEntityRef", () => {
		it("creates agent ref", () => {
			const ref = createEntityRef("atlas", "agent");
			expect(ref).toEqual({ id: "atlas", entityType: "agent" });
		});

		it("creates director ref with fixed id", () => {
			const ref = createEntityRef("ignored", "director");
			expect(ref).toEqual({ id: "director", entityType: "director" });
		});

		it("creates room ref", () => {
			const ref = createEntityRef("office", "room");
			expect(ref).toEqual({ id: "office", entityType: "room" });
		});
	});

	describe("isValidEntityRef", () => {
		it("accepts valid agent ref", () => {
			expect(isValidEntityRef({ id: "atlas", entityType: "agent" })).toBe(true);
		});

		it("rejects empty id", () => {
			expect(isValidEntityRef({ id: "", entityType: "agent" })).toBe(false);
		});

		it("rejects unknown entity type", () => {
			expect(isValidEntityRef({ id: "x", entityType: "alien" as never })).toBe(false);
		});
	});

	describe("isValidInteraction", () => {
		it("rejects interaction with no targets", () => {
			const interaction = makeInteraction({ targets: [] });
			expect(isValidInteraction(interaction)).toBe(false);
		});

		it("rejects interaction with priority > 100", () => {
			const interaction = makeInteraction({ priority: 150 });
			expect(isValidInteraction(interaction)).toBe(false);
		});

		it("rejects interaction with negative cooldown", () => {
			const interaction = makeInteraction({ cooldownMs: -1 });
			expect(isValidInteraction(interaction)).toBe(false);
		});

		it("accepts valid interaction", () => {
			const interaction = makeInteraction({});
			expect(isValidInteraction(interaction)).toBe(true);
		});
	});

	describe("constants", () => {
		it("MAX_LOCK_DURATION is 15000", () => {
			expect(MAX_LOCK_DURATION).toBe(15000);
		});

		it("MAX_CHAIN_DEPTH is 3", () => {
			expect(MAX_CHAIN_DEPTH).toBe(3);
		});

		it("HISTORY_BUFFER_SIZE is 200", () => {
			expect(HISTORY_BUFFER_SIZE).toBe(200);
		});
	});
});

function makeInteraction(overrides: Record<string, unknown>) {
	return {
		id: "int-1",
		initiator: { id: "atlas", entityType: "agent" as const },
		targets: [{ id: "vex", entityType: "agent" as const }],
		cardinality: "one-to-one" as const,
		category: "social" as const,
		action: "greet",
		priority: 30,
		context: {},
		cooldownMs: 5000,
		effects: [],
		timestamp: Date.now(),
		...overrides,
	};
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-types.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write interaction-types.ts**

Create `src/domain/interactions/interaction-types.ts` with all type definitions from spec Section 2:
- `InteractionEntityType`, `EntityRef`, `Cardinality`, `InteractionCategory`
- `InteractionContext`, `Interaction`
- `InteractionPrerequisite` (discriminated union — 8 variants)
- `InteractionEffect` (discriminated union — 11 variants), `EffectTarget`
- `InteractionTemplate` (from spec Section 7)
- `SubmitResult`, `InteractionAction`, `InteractionLifecycleEvent`
- `ActiveInteraction` (Interaction + remaining duration)
- `InteractionFilter` (optional category/entityType/timeRange filters)
- Constants: `MAX_LOCK_DURATION = 15000`, `MAX_CHAIN_DEPTH = 3`, `HISTORY_BUFFER_SIZE = 200`
- Helpers: `createEntityRef()`, `isValidEntityRef()`, `isValidInteraction()`
- Re-export `DayPhase` from existing day clock types if available, otherwise define inline

All types are `export`ed. No runtime dependencies. Pure type + const + guard file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-types.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/interaction-types.ts" \
       "01 - Projects/Flowti CLI/tests/domain/interactions/interaction-types.test.ts"
git commit -m "feat(interactions): core type definitions and validation guards"
```

---

### Task 2: InteractionBus — Submit & Lock Manager

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/interaction-bus.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/interactions/interaction-bus.test.ts`

This is the largest single file. Build it incrementally: submit → prerequisite validation → lock → conflict → cascade chain → tick pipeline.

**Critical:** The bus needs a `PrerequisiteChecker` callback injected at creation (for proximity/affinity checks that need external data), and a `TemplateRegistry` reference for resolving `spawn-interaction` chain effects. The bus also calls `applyEffect()` internally during tick step 6 to produce both state mutations AND render actions.

- [ ] **Step 1: Write submit + basic lock tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createInteractionBus } from "../../../src/domain/interactions/interaction-bus.js";
import type { Interaction } from "../../../src/domain/interactions/interaction-types.js";

function makeInteraction(overrides: Partial<Interaction> = {}): Interaction {
	return {
		id: `int-${Math.random().toString(36).slice(2, 8)}`,
		initiator: { id: "atlas", entityType: "agent" },
		targets: [{ id: "vex", entityType: "agent" }],
		cardinality: "one-to-one",
		category: "social",
		action: "greet",
		priority: 30,
		context: {},
		cooldownMs: 5000,
		duration: 3000,
		effects: [],
		timestamp: Date.now(),
		...overrides,
	};
}

describe("InteractionBus", () => {
	let bus: ReturnType<typeof createInteractionBus>;

	beforeEach(() => {
		bus = createInteractionBus();
	});

	describe("submit", () => {
		it("enqueues valid interaction", () => {
			const result = bus.submit(makeInteraction());
			expect(result.status).toBe("enqueued");
		});

		it("rejects interaction with no targets", () => {
			const result = bus.submit(makeInteraction({ targets: [] }));
			expect(result.status).toBe("rejected");
		});

		it("rejects interaction with priority > 100", () => {
			const result = bus.submit(makeInteraction({ priority: 150 }));
			expect(result.status).toBe("rejected");
		});
	});

	describe("tick — locking", () => {
		it("locks participants during active interaction", () => {
			bus.submit(makeInteraction({ id: "int-1", duration: 5000 }));
			bus.tick(16);
			const active = bus.getActive();
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe("int-1");
		});

		it("rejects interaction targeting locked entity", () => {
			bus.submit(makeInteraction({ id: "int-1", duration: 5000 }));
			bus.tick(16);

			bus.submit(makeInteraction({ id: "int-2", priority: 30 }));
			const actions = bus.tick(16);
			// int-2 should be rejected (target vex is locked, priority not override)
			const active = bus.getActive();
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe("int-1");
		});

		it("override priority (91+) preempts locked entity", () => {
			bus.submit(makeInteraction({ id: "int-1", duration: 5000, priority: 30 }));
			bus.tick(16);

			bus.submit(makeInteraction({ id: "int-2", priority: 95 }));
			bus.tick(16);
			const active = bus.getActive();
			expect(active.some((a) => a.id === "int-2")).toBe(true);
		});

		it("expires lock after duration", () => {
			bus.submit(makeInteraction({ id: "int-1", duration: 100 }));
			bus.tick(16);
			expect(bus.getActive()).toHaveLength(1);

			bus.tick(200);
			expect(bus.getActive()).toHaveLength(0);
		});

		it("watchdog releases lock exceeding MAX_LOCK_DURATION", () => {
			bus.submit(makeInteraction({ id: "int-1", duration: 20000 }));
			bus.tick(16);
			expect(bus.getActive()).toHaveLength(1);

			bus.tick(15001);
			expect(bus.getActive()).toHaveLength(0);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-bus.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement createInteractionBus — submit + lock + tick skeleton**

Create `src/domain/interactions/interaction-bus.ts`:

The bus accepts three optional injected dependencies at creation:
- `prerequisiteChecker` — callback that evaluates external prerequisites (proximity, affinity) the bus can't check internally
- `templateRegistry` — for resolving `spawn-interaction` template IDs into full interactions
- `externalLockQuery` — callback to check ConversationEngine's lock state (cooperative lock model)

```typescript
import type {
	Interaction, SubmitResult, InteractionAction,
	InteractionLifecycleEvent, ActiveInteraction, InteractionFilter,
	InteractionPrerequisite, InteractionTemplate,
} from "./interaction-types.js";
import { isValidInteraction, MAX_LOCK_DURATION, MAX_CHAIN_DEPTH, HISTORY_BUFFER_SIZE } from "./interaction-types.js";
import { applyEffect, type EffectState } from "./interaction-effects.js";

// External prerequisite checker — proximity/affinity/needs require game state the bus doesn't own
type PrerequisiteChecker = (prereq: InteractionPrerequisite, interaction: Interaction) => boolean;

// Template registry for resolving spawn-interaction chain effects
interface TemplateRegistryRef {
	getById(id: string): InteractionTemplate | undefined;
}

// External lock query — checks ConversationEngine's lock state (cooperative lock model)
type ExternalLockQuery = (entityId: string) => boolean;

interface BusOptions {
	checkPrerequisite?: PrerequisiteChecker;
	templateRegistry?: TemplateRegistryRef;
	externalLockQuery?: ExternalLockQuery;
}

export function createInteractionBus(options: BusOptions = {}) {
	const queue: Interaction[] = [];
	const active = new Map<string, ActiveEntry>();
	const lockedEntities = new Map<string, string>();
	const history: Interaction[] = [];
	const cooldowns = new Map<string, number>();
	const listeners = new Map<InteractionLifecycleEvent, LifecycleHandler[]>();
	const deferredSpawns: Interaction[] = []; // 1-tick delay buffer for chains

	// --- internal helpers: entityKey, isLocked, lockEntity, unlockEntity, emit ---

	// Cooperative lock: checks BOTH bus locks AND ConversationEngine locks
	function isEffectivelyLocked(id: string, type: string): boolean {
		return isLocked(id, type) || (options.externalLockQuery?.(id) ?? false);
	}

	function checkAllPrerequisites(interaction: Interaction): boolean {
		if (!interaction.prerequisites?.length) return true;
		for (const prereq of interaction.prerequisites) {
			// Built-in checks the bus owns:
			if (prereq.type === "not-locked") {
				const anyLocked = interaction.targets.some((t) => isEffectivelyLocked(t.id, t.entityType));
				if (anyLocked) return false;
				continue;
			}
			if (prereq.type === "cooldown-clear") {
				const key = `${interaction.initiator.entityType}:${interaction.initiator.id}:${interaction.action}`;
				const expiresAt = cooldowns.get(key) ?? 0;
				if (interaction.timestamp < expiresAt) return false;
				continue;
			}
			// External checks delegated to injected checker:
			if (options.checkPrerequisite && !options.checkPrerequisite(prereq, interaction)) {
				return false;
			}
		}
		return true;
	}

	function tick(deltaMs: number): { actions: InteractionAction[]; state: EffectState } {
		const actions: InteractionAction[] = [];
		const effectState = createEffectState(); // fresh accumulator per tick

		// Step 1: Expire locks (unchanged)
		// Step 2: Drain queue + deferred spawns
		const pending = [...deferredSpawns.splice(0), ...queue.splice(0)];

		// Step 3: Validate prerequisites
		pending.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

		for (const interaction of pending) {
			// Cascade depth check
			if ((interaction.chainDepth ?? 0) > MAX_CHAIN_DEPTH) {
				emit("rejected", interaction);
				continue;
			}

			// Prerequisite validation (all 8 types)
			if (!checkAllPrerequisites(interaction)) {
				emit("rejected", interaction);
				continue;
			}

			// Step 4: Conflict resolution (lock check + priority override — same as before)
			// Step 5: Lock participants (same as before)

			emit("accepted", interaction);
			emit("started", interaction);

			// Step 6: Execute effects via applyEffect()
			for (const effect of interaction.effects) {
				if (effect.type === "spawn-interaction") {
					// Resolve template → build chained interaction → defer to next tick
					const template = options.templateRegistry?.getById(effect.templateId);
					if (template) {
						const chained: Interaction = {
							id: `chain-${interaction.id}-${effect.templateId}`,
							initiator: interaction.initiator,
							targets: interaction.targets,
							cardinality: template.cardinality,
							category: template.category,
							action: template.action,
							priority: template.priority,
							context: { ...interaction.context, templateId: effect.templateId },
							cooldownMs: template.cooldownMs,
							duration: template.duration,
							prerequisites: template.prerequisites,
							effects: template.effects,
							timestamp: interaction.timestamp,
							chainDepth: (interaction.chainDepth ?? 0) + 1,
						};
						deferredSpawns.push(chained);
						emit("chained", interaction);
					}
				} else {
					// Apply state mutation via effect applicator
					applyEffect(effect, interaction.initiator, interaction.targets, effectState);

					// Produce render action for Plugin visual layer
					actions.push(effectToAction(effect, interaction));
				}
			}

			// Record + cooldown (same as before)
		}

		return { actions, state: effectState };
	}

	// Maps an effect to an InteractionAction with properly extracted params (no unsafe cast)
	function effectToAction(effect: InteractionEffect, interaction: Interaction): InteractionAction {
		return {
			interactionId: interaction.id,
			entityId: interaction.initiator.id,
			entityType: interaction.initiator.entityType,
			actionType: effect.type,
			params: extractEffectParams(effect),
			timestamp: interaction.timestamp,
		};
	}

	// ... rest of implementation (getActive, getHistory, on, isEntityLocked, getCooldown)

	return { submit, tick, getActive, getHistory, on, isEntityLocked, getCooldown };
}
```

Key changes from the skeleton:
1. `checkAllPrerequisites()` evaluates all 8 prerequisite types — `not-locked` and `cooldown-clear` handled internally, all others delegated to injected `checkPrerequisite` callback
2. `spawn-interaction` resolves template from registry, builds chained `Interaction` with `chainDepth + 1`, pushes to `deferredSpawns` (processed next tick)
3. `applyEffect()` called for every non-spawn effect — collects state mutations into `EffectState`
4. `tick()` returns `{ actions, state }` — actions for Plugin rendering, state for system mutations
5. `effectToAction()` maps effects to render actions with properly extracted params (no `as unknown` cast)
6. `extractEffectParams()` is a helper that pulls relevant fields from each effect discriminant into a `Record<string, unknown>` for the renderer

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-bus.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Add prerequisite validation tests**

Add to the existing test file:

```typescript
describe("tick — prerequisite validation", () => {
	it("rejects interaction when cooldown not clear", () => {
		const rejected: string[] = [];
		bus.on("rejected", (i) => rejected.push(i.id));

		// First interaction sets a cooldown
		bus.submit(makeInteraction({ id: "first", action: "greet", cooldownMs: 10000, duration: 0 }));
		bus.tick(16);

		// Second interaction with same action should be rejected (cooldown active)
		bus.submit(makeInteraction({
			id: "second", action: "greet", cooldownMs: 5000, duration: 0,
			prerequisites: [{ type: "cooldown-clear" }],
		}));
		bus.tick(16);
		expect(rejected).toContain("second");
	});

	it("delegates external prerequisites to checker callback", () => {
		const checkerBus = createInteractionBus({
			checkPrerequisite: (prereq) => {
				if (prereq.type === "proximity") return false; // always fail proximity
				return true;
			},
		});
		const rejected: string[] = [];
		checkerBus.on("rejected", (i) => rejected.push(i.id));

		checkerBus.submit(makeInteraction({
			id: "too-far",
			prerequisites: [{ type: "proximity", maxDistance: 80 }],
			duration: 0,
		}));
		checkerBus.tick(16);
		expect(rejected).toContain("too-far");
	});

	it("passes when all prerequisites met", () => {
		const checkerBus = createInteractionBus({
			checkPrerequisite: () => true,
		});
		const accepted: string[] = [];
		checkerBus.on("accepted", (i) => accepted.push(i.id));

		checkerBus.submit(makeInteraction({
			id: "valid",
			prerequisites: [
				{ type: "proximity", maxDistance: 80 },
				{ type: "affinity-range", min: 0, max: 100 },
			],
			duration: 0,
		}));
		checkerBus.tick(16);
		expect(accepted).toContain("valid");
	});
});

describe("tick — spawn-interaction chains", () => {
	it("spawns chained interaction from template on next tick", () => {
		const chainBus = createInteractionBus({
			templateRegistry: {
				getById: (id) => id === "follow-up" ? {
					id: "follow-up", category: "reactive", action: "react",
					cardinality: "one-to-one", initiatorTypes: ["agent"], targetTypes: ["agent"],
					prerequisites: [], weight: 10, tags: [], priority: 30,
					cooldownMs: 5000, effects: [{ type: "affinity-change", target: "targets", amount: 2 }],
				} : undefined,
			},
		});
		const chained: string[] = [];
		chainBus.on("chained", () => chained.push("chained"));
		const started: string[] = [];
		chainBus.on("started", (i) => started.push(i.id));

		chainBus.submit(makeInteraction({
			id: "parent",
			duration: 0,
			effects: [{ type: "spawn-interaction", templateId: "follow-up" }],
		}));
		chainBus.tick(16); // processes parent, defers chain
		expect(chained).toHaveLength(1);

		chainBus.tick(16); // processes chained interaction
		expect(started.some((id) => id.startsWith("chain-"))).toBe(true);
	});

	it("increments chainDepth on spawned interactions", () => {
		const chainBus = createInteractionBus({
			templateRegistry: {
				getById: () => ({
					id: "chain-tpl", category: "reactive", action: "react",
					cardinality: "one-to-one", initiatorTypes: ["agent"], targetTypes: ["agent"],
					prerequisites: [], weight: 10, tags: [], priority: 30,
					cooldownMs: 5000, effects: [],
				}),
			},
		});

		chainBus.submit(makeInteraction({
			id: "parent", chainDepth: 2, duration: 0,
			effects: [{ type: "spawn-interaction", templateId: "chain-tpl" }],
		}));
		chainBus.tick(16);

		// The spawned interaction should have chainDepth 3
		const history = chainBus.getHistory();
		// Parent is depth 2, chain should be depth 3 (processed on next tick)
		chainBus.tick(16);
		const chainedHistory = chainBus.getHistory();
		const chainedEntry = chainedHistory.find((i) => i.id.startsWith("chain-"));
		expect(chainedEntry?.chainDepth).toBe(3);
	});
});
```

- [ ] **Step 6: Add conflict resolution + cascade depth tests**

Add to the existing test file:

```typescript
describe("tick — conflict resolution", () => {
	it("higher priority wins when both target same entity", () => {
		bus.submit(makeInteraction({ id: "low", priority: 20, duration: 3000 }));
		bus.submit(makeInteraction({ id: "high", priority: 60, duration: 3000 }));
		bus.tick(16);
		const active = bus.getActive();
		expect(active).toHaveLength(1);
		expect(active[0].id).toBe("high");
	});

	it("earlier timestamp wins on equal priority", () => {
		const now = Date.now();
		bus.submit(makeInteraction({ id: "first", priority: 30, timestamp: now, duration: 3000 }));
		bus.submit(makeInteraction({ id: "second", priority: 30, timestamp: now + 1, duration: 3000 }));
		bus.tick(16);
		const active = bus.getActive();
		expect(active).toHaveLength(1);
		expect(active[0].id).toBe("first");
	});
});

describe("tick — cascade depth", () => {
	it("rejects interaction exceeding MAX_CHAIN_DEPTH", () => {
		const rejected: string[] = [];
		bus.on("rejected", (i) => rejected.push(i.id));

		bus.submit(makeInteraction({ id: "deep", chainDepth: 4 }));
		bus.tick(16);
		expect(rejected).toContain("deep");
	});
});

describe("history", () => {
	it("records completed interactions", () => {
		bus.submit(makeInteraction({ id: "int-1", duration: 0 }));
		bus.tick(16);
		expect(bus.getHistory()).toHaveLength(1);
		expect(bus.getHistory()[0].id).toBe("int-1");
	});

	it("filters history by category", () => {
		bus.submit(makeInteraction({ id: "social-1", category: "social", duration: 0 }));
		bus.submit(makeInteraction({
			id: "work-1", category: "work", duration: 0,
			initiator: { id: "bob", entityType: "agent" },
			targets: [{ id: "sue", entityType: "agent" }],
		}));
		bus.tick(16);
		const social = bus.getHistory({ category: "social" });
		expect(social).toHaveLength(1);
		expect(social[0].id).toBe("social-1");
	});
});

describe("lifecycle events", () => {
	it("emits accepted and started on successful tick", () => {
		const events: string[] = [];
		bus.on("accepted", () => events.push("accepted"));
		bus.on("started", () => events.push("started"));

		bus.submit(makeInteraction({}));
		bus.tick(16);
		expect(events).toEqual(["accepted", "started"]);
	});

	it("emits completed when duration expires", () => {
		const completed: string[] = [];
		bus.on("completed", (i) => completed.push(i.id));

		bus.submit(makeInteraction({ id: "int-1", duration: 100 }));
		bus.tick(16);
		expect(completed).toHaveLength(0);

		bus.tick(200);
		expect(completed).toContain("int-1");
	});

	it("emits preempted when override priority displaces", () => {
		const preempted: string[] = [];
		bus.on("preempted", (i) => preempted.push(i.id));

		bus.submit(makeInteraction({ id: "victim", priority: 30, duration: 5000 }));
		bus.tick(16);

		bus.submit(makeInteraction({ id: "override", priority: 95 }));
		bus.tick(16);
		expect(preempted).toContain("victim");
	});
});
```

- [ ] **Step 7: Verify prerequisite + chain tests pass**

The prerequisite validation and spawn-interaction chain logic should already be in the implementation from Step 3. These tests validate that:
- `checkAllPrerequisites()` works for internal checks (cooldown, not-locked) and delegates external checks
- `spawn-interaction` resolves templates, builds chained interactions with incremented chainDepth, defers to next tick
- Cascade depth > MAX_CHAIN_DEPTH causes rejection

- [ ] **Step 8: Run all bus tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-bus.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 9: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/interaction-bus.ts" \
       "01 - Projects/Flowti CLI/tests/domain/interactions/interaction-bus.test.ts"
git commit -m "feat(interactions): InteractionBus with prerequisites, locking, conflict resolution, chain spawning"
```

---

### Task 3: Effect Applicator

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/interaction-effects.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/interactions/interaction-effects.test.ts`

The effect applicator is a pure function that takes an `InteractionEffect` and a mutable state context, and returns the state mutations. It does NOT render — Plugin handles that.

- [ ] **Step 1: Write effect applicator tests**

```typescript
import { describe, it, expect } from "vitest";
import { applyEffect } from "../../../src/domain/interactions/interaction-effects.js";
import type { InteractionEffect, EntityRef } from "../../../src/domain/interactions/interaction-types.js";

function makeState() {
	return {
		affinityChanges: [] as Array<{ from: string; to: string; amount: number }>,
		needChanges: [] as Array<{ entityId: string; need: string; amount: number }>,
		moodChanges: [] as Array<{ entityId: string; mood: string }>,
		economyChanges: [] as Array<{ entityId: string; currency: string; amount: number }>,
		memoryRecords: [] as Array<{ entityId: string; memory: string }>,
		roomMoodShifts: [] as Array<{ mood: string; amount: number }>,
		spawnedTemplateIds: [] as string[],
		renderActions: [] as Array<{ type: string; entityId: string; params: Record<string, unknown> }>,
	};
}

const initiator: EntityRef = { id: "atlas", entityType: "agent" };
const targets: EntityRef[] = [{ id: "vex", entityType: "agent" }];

describe("applyEffect", () => {
	it("applies affinity-change to targets", () => {
		const state = makeState();
		const effect: InteractionEffect = { type: "affinity-change", target: "targets", amount: 5 };
		applyEffect(effect, initiator, targets, state);
		expect(state.affinityChanges).toEqual([
			{ from: "atlas", to: "vex", amount: 5 },
		]);
	});

	it("applies need-change to initiator", () => {
		const state = makeState();
		const effect: InteractionEffect = { type: "need-change", target: "initiator", need: "social", amount: 10 };
		applyEffect(effect, initiator, targets, state);
		expect(state.needChanges).toEqual([
			{ entityId: "atlas", need: "social", amount: 10 },
		]);
	});

	it("applies need-change to all participants", () => {
		const state = makeState();
		const effect: InteractionEffect = { type: "need-change", target: "all", need: "morale", amount: 3 };
		applyEffect(effect, initiator, targets, state);
		expect(state.needChanges).toHaveLength(2);
		expect(state.needChanges[0].entityId).toBe("atlas");
		expect(state.needChanges[1].entityId).toBe("vex");
	});

	it("collects spawn-interaction template id", () => {
		const state = makeState();
		const effect: InteractionEffect = { type: "spawn-interaction", templateId: "follow-up" };
		applyEffect(effect, initiator, targets, state);
		expect(state.spawnedTemplateIds).toEqual(["follow-up"]);
	});

	it("applies economy-transaction to target", () => {
		const state = makeState();
		const effect: InteractionEffect = { type: "economy-transaction", target: "targets", currency: "coin", amount: -50 };
		applyEffect(effect, initiator, targets, state);
		expect(state.economyChanges).toEqual([
			{ entityId: "vex", currency: "coin", amount: -50 },
		]);
	});

	it("applies room-mood-shift", () => {
		const state = makeState();
		const effect: InteractionEffect = { type: "room-mood-shift", mood: "tense", amount: -2 };
		applyEffect(effect, initiator, targets, state);
		expect(state.roomMoodShifts).toEqual([{ mood: "tense", amount: -2 }]);
	});

	it("routes bubble effect to render actions", () => {
		const state = makeState();
		const effect: InteractionEffect = {
			type: "bubble", target: "initiator",
			bubbleKind: "speech", phrasePool: "greeting",
		};
		applyEffect(effect, initiator, targets, state);
		expect(state.renderActions).toHaveLength(1);
		expect(state.renderActions[0].type).toBe("bubble");
		expect(state.renderActions[0].entityId).toBe("atlas");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-effects.test.ts --config configs/vitest.config.ts`
Expected: FAIL

- [ ] **Step 3: Implement applyEffect**

Create `src/domain/interactions/interaction-effects.ts`:

Pure function. Takes effect, initiator, targets, mutable state accumulator. Resolves `EffectTarget` to concrete entity IDs, then pushes mutations to the appropriate state array. Visual effects (bubble, particle, sound) go to `renderActions` — Plugin handles them.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-effects.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/interaction-effects.ts" \
       "01 - Projects/Flowti CLI/tests/domain/interactions/interaction-effects.test.ts"
git commit -m "feat(interactions): pure effect applicator with state mutation collectors"
```

---

### Task 4: Intent Resolver Types

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/intent-resolver-types.ts`

No test file needed — this is pure type definitions (interfaces, no runtime code).

- [ ] **Step 1: Write intent-resolver-types.ts**

```typescript
import type { Interaction, InteractionPrerequisite } from "./interaction-types.js";

export interface IntentResolver {
	readonly entityType: string;
	resolve(): Interaction[];
}

export interface NPCInteractionRule {
	readonly npcRole: string;
	readonly trigger: "proximity" | "schedule" | "event" | "idle-timeout";
	readonly conditions: readonly InteractionPrerequisite[];
	readonly interaction: Partial<Interaction>;
	readonly weight: number;
	readonly cooldownMs: number;
}

export interface RoomInteractionRule {
	readonly roomType: string;
	readonly layer: "passive" | "reactive" | "active";
	readonly conditions: readonly EnvironmentCondition[];
	readonly interaction: Partial<Interaction>;
	readonly cooldownMs: number;
}

export type EnvironmentCondition =
	| { readonly type: "occupancy"; readonly op: ">" | "<" | "=="; readonly value: number }
	| { readonly type: "collective-mood"; readonly mood: string; readonly threshold: number }
	| { readonly type: "phase"; readonly phases: readonly string[] }
	| { readonly type: "event-recent"; readonly eventType: string; readonly withinMs: number }
	| { readonly type: "weather"; readonly weather: string };
```

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/intent-resolver-types.ts"
git commit -m "feat(interactions): IntentResolver, NPCInteractionRule, RoomInteractionRule types"
```

---

## Chunk 2: CLI Domain — Templates & Persistence

Builds on Chunk 1 types. Template registry with selection algorithm + JSONL persistence.

### Task 5: Template Registry & Selection Algorithm

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/interaction-templates.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/interactions/interaction-templates.test.ts`

- [ ] **Step 1: Write template selection tests**

```typescript
import { describe, it, expect } from "vitest";
import {
	createTemplateRegistry,
	selectTemplate,
} from "../../../src/domain/interactions/interaction-templates.js";
import type { InteractionTemplate, Interaction } from "../../../src/domain/interactions/interaction-types.js";

function makeTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
	return {
		id: "tpl-greet",
		category: "social",
		action: "greet",
		cardinality: "one-to-one",
		initiatorTypes: ["agent"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 10,
		tags: ["bonding"],
		priority: 30,
		cooldownMs: 5000,
		effects: [],
		...overrides,
	};
}

describe("createTemplateRegistry", () => {
	it("registers and retrieves templates", () => {
		const registry = createTemplateRegistry([makeTemplate({ id: "t1" }), makeTemplate({ id: "t2" })]);
		expect(registry.getAll()).toHaveLength(2);
	});

	it("retrieves template by id", () => {
		const registry = createTemplateRegistry([makeTemplate({ id: "t1" })]);
		expect(registry.getById("t1")?.id).toBe("t1");
	});

	it("returns undefined for unknown id", () => {
		const registry = createTemplateRegistry([]);
		expect(registry.getById("nope")).toBeUndefined();
	});
});

describe("selectTemplate", () => {
	it("filters by initiator entity type", () => {
		const templates = [
			makeTemplate({ id: "agent-only", initiatorTypes: ["agent"] }),
			makeTemplate({ id: "pet-only", initiatorTypes: ["pet"] }),
		];
		const registry = createTemplateRegistry(templates);
		const result = selectTemplate(registry, {
			initiatorType: "agent",
			targetTypes: ["agent"],
			history: [],
		});
		expect(result?.id).toBe("agent-only");
	});

	it("filters by target entity type", () => {
		const templates = [
			makeTemplate({ id: "to-agent", targetTypes: ["agent"] }),
			makeTemplate({ id: "to-pet", targetTypes: ["pet"] }),
		];
		const registry = createTemplateRegistry(templates);
		const result = selectTemplate(registry, {
			initiatorType: "agent",
			targetTypes: ["pet"],
			history: [],
		});
		expect(result?.id).toBe("to-pet");
	});

	it("applies recency penalty — halves weight of recently used templates", () => {
		const templates = [
			makeTemplate({ id: "recent", weight: 10 }),
			makeTemplate({ id: "fresh", weight: 10 }),
		];
		const registry = createTemplateRegistry(templates);
		// Run 100 selections with "recent" in history — "fresh" should dominate
		const counts = { recent: 0, fresh: 0 };
		for (let i = 0; i < 200; i++) {
			const result = selectTemplate(registry, {
				initiatorType: "agent",
				targetTypes: ["agent"],
				history: [{ templateId: "recent" } as Interaction],
			});
			if (result) counts[result.id as keyof typeof counts]++;
		}
		// fresh should be selected ~2x as often as recent
		expect(counts.fresh).toBeGreaterThan(counts.recent * 1.3);
	});

	it("applies tag boost when context tags match", () => {
		const templates = [
			makeTemplate({ id: "comfort", weight: 10, tags: ["comfort"] }),
			makeTemplate({ id: "humor", weight: 10, tags: ["humor"] }),
		];
		const registry = createTemplateRegistry(templates);
		const counts = { comfort: 0, humor: 0 };
		for (let i = 0; i < 200; i++) {
			const result = selectTemplate(registry, {
				initiatorType: "agent",
				targetTypes: ["agent"],
				history: [],
				contextTags: ["comfort"],
			});
			if (result) counts[result.id as keyof typeof counts]++;
		}
		// comfort should be selected ~2x as often as humor
		expect(counts.comfort).toBeGreaterThan(counts.humor * 1.3);
	});

	it("returns null when no templates match", () => {
		const registry = createTemplateRegistry([
			makeTemplate({ id: "npc-only", initiatorTypes: ["npc"] }),
		]);
		const result = selectTemplate(registry, {
			initiatorType: "agent",
			targetTypes: ["agent"],
			history: [],
		});
		expect(result).toBeNull();
	});

	it("respects phase filter", () => {
		const templates = [
			makeTemplate({ id: "morning", phaseFilter: ["productive-morning"] }),
			makeTemplate({ id: "anytime" }),
		];
		const registry = createTemplateRegistry(templates);
		const result = selectTemplate(registry, {
			initiatorType: "agent",
			targetTypes: ["agent"],
			history: [],
			currentPhase: "afternoon",
		});
		expect(result?.id).toBe("anytime");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-templates.test.ts --config configs/vitest.config.ts`
Expected: FAIL

- [ ] **Step 3: Implement createTemplateRegistry and selectTemplate**

Create `src/domain/interactions/interaction-templates.ts`:

- `createTemplateRegistry(templates)` — stores templates in a Map by id, exposes `getAll()`, `getById()`
- `selectTemplate(registry, context)` — implements the 4-step algorithm from the spec:
  1. Filter by initiatorType, targetTypes, phaseFilter, tierRange
  2. Tag boost (2x weight for matching contextTags)
  3. Recency penalty (0.5x weight for templates in history, last 10 per pair)
  4. Weighted random selection from remaining candidates

Context type:
```typescript
interface SelectionContext {
	initiatorType: string;
	targetTypes: string[];
	history: Interaction[];
	contextTags?: string[];
	currentPhase?: string;
	affinityTier?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-templates.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/interaction-templates.ts" \
       "01 - Projects/Flowti CLI/tests/domain/interactions/interaction-templates.test.ts"
git commit -m "feat(interactions): template registry with weighted selection, tag boost, recency penalty"
```

---

### Task 6: JSONL Persistence

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/interaction-persistence.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/interactions/interaction-persistence.test.ts`

- [ ] **Step 1: Write persistence tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import {
	appendInteraction,
	loadHistory,
	restoreCooldowns,
} from "../../../src/domain/interactions/interaction-persistence.js";
import type { Interaction } from "../../../src/domain/interactions/interaction-types.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			appendFileSync: vi.fn((p: string, data: string) => {
				store[p] = (store[p] ?? "") + data;
			}),
			mkdirSync: vi.fn(),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		},
	};
}

function makeInteraction(overrides: Partial<Interaction> = {}): Interaction {
	return {
		id: "int-1",
		initiator: { id: "atlas", entityType: "agent" },
		targets: [{ id: "vex", entityType: "agent" }],
		cardinality: "one-to-one",
		category: "social",
		action: "greet",
		priority: 30,
		context: {},
		cooldownMs: 5000,
		effects: [],
		timestamp: 1000,
		...overrides,
	};
}

describe("appendInteraction", () => {
	it("appends JSONL line with schema version", () => {
		const deps = makeDeps();
		appendInteraction(deps, "/proj", makeInteraction());
		expect(deps.disk.appendFileSync).toHaveBeenCalledOnce();
		const written = deps.disk.appendFileSync.mock.calls[0][1] as string;
		const parsed = JSON.parse(written.trim());
		expect(parsed.v).toBe(1);
		expect(parsed.id).toBe("int-1");
	});

	it("creates directory if missing", () => {
		const deps = makeDeps();
		appendInteraction(deps, "/proj", makeInteraction());
		expect(deps.disk.mkdirSync).toHaveBeenCalled();
	});
});

describe("loadHistory", () => {
	it("returns empty array when file missing", () => {
		const deps = makeDeps();
		const history = loadHistory(deps, "/proj");
		expect(history).toEqual([]);
	});

	it("parses JSONL lines into interactions", () => {
		const line = JSON.stringify({ v: 1, ...makeInteraction() });
		const deps = makeDeps({ "/proj/.flowti/var/interaction-log.jsonl": line + "\n" });
		const history = loadHistory(deps, "/proj");
		expect(history).toHaveLength(1);
		expect(history[0].id).toBe("int-1");
	});

	it("skips malformed lines", () => {
		const good = JSON.stringify({ v: 1, ...makeInteraction() });
		const deps = makeDeps({ "/proj/.flowti/var/interaction-log.jsonl": good + "\n{bad}\n" });
		const history = loadHistory(deps, "/proj");
		expect(history).toHaveLength(1);
	});

	it("limits to last HISTORY_BUFFER_SIZE entries", () => {
		const lines = Array.from({ length: 250 }, (_, i) =>
			JSON.stringify({ v: 1, ...makeInteraction({ id: `int-${i}` }) }),
		).join("\n") + "\n";
		const deps = makeDeps({ "/proj/.flowti/var/interaction-log.jsonl": lines });
		const history = loadHistory(deps, "/proj");
		expect(history).toHaveLength(200);
		expect(history[0].id).toBe("int-50");
	});
});

describe("restoreCooldowns", () => {
	it("extracts cooldown expiry times from history", () => {
		const history = [
			makeInteraction({ id: "int-1", action: "greet", cooldownMs: 5000, timestamp: 1000 }),
			makeInteraction({ id: "int-2", action: "gossip", cooldownMs: 10000, timestamp: 2000 }),
		];
		const cooldowns = restoreCooldowns(history);
		expect(cooldowns.get("agent:atlas:greet")).toBe(6000);
		expect(cooldowns.get("agent:atlas:gossip")).toBe(12000);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-persistence.test.ts --config configs/vitest.config.ts`
Expected: FAIL

- [ ] **Step 3: Implement interaction-persistence.ts**

- `appendInteraction(deps, projectPath, interaction)` — appends `{ v: 1, ...interaction }\n` to `.flowti/var/interaction-log.jsonl`
- `loadHistory(deps, projectPath)` — reads JSONL, parses, returns last `HISTORY_BUFFER_SIZE` interactions
- `restoreCooldowns(history)` — scans history for `timestamp + cooldownMs` per `entityType:entityId:action`

Deps: `{ disk: { existsSync, readFileSync, appendFileSync, mkdirSync }, paths: { join, dirname } }`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/interactions/interaction-persistence.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/interaction-persistence.ts" \
       "01 - Projects/Flowti CLI/tests/domain/interactions/interaction-persistence.test.ts"
git commit -m "feat(interactions): JSONL persistence with schema versioning and cooldown restore"
```

---

### Task 7: Seed Template Data Files

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/templates/agent-agent.ts`
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/templates/agent-pet.ts`
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/templates/npc-interactions.ts`
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/templates/room-reactions.ts`
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/templates/director-commands.ts`

Pure data arrays. No logic. Each file exports a `readonly InteractionTemplate[]`.

- [ ] **Step 1: Create agent-agent.ts with 5 seed templates**

Templates: `code-review-banter`, `lunch-invite`, `morning-greeting`, `work-complaint`, `knowledge-share`. Each with appropriate tier ranges, phase filters, effects (affinity changes, bubbles), and chain chances.

- [ ] **Step 2: Create agent-pet.ts with 3 seed templates**

Templates: `sneak-treat`, `pet-greeting`, `play-with-pet`. Effects include pet affinity changes, bubbles with instinct/eloquent voice.

- [ ] **Step 3: Create npc-interactions.ts with 3 seed merchant templates**

Templates: `merchant-pitch`, `merchant-idle-grumble`, `merchant-comment-on-pair`. Trigger-based with proximity and idle-timeout conditions.

- [ ] **Step 4: Create room-reactions.ts with 3 seed templates**

Templates: `crunch-time-pressure`, `celebration-vibe`, `quiet-focus`. Layer-tagged (reactive/active/passive). Room mood shifts and need changes.

- [ ] **Step 5: Create director-commands.ts with 3 seed templates**

Templates: `director-praise`, `director-team-huddle`, `director-assign-task`. Priority 95 (Override band). Effects include social/morale boosts and memory records.

- [ ] **Step 6: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/templates/"
git commit -m "feat(interactions): seed interaction templates — agent, pet, NPC, room, director"
```

---

### Task 8: Full CLI test suite pass

- [ ] **Step 1: Run full CLI test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS (all existing tests + new interaction tests)

- [ ] **Step 2: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/interactions/ --config configs/eslint.config.mjs`
Expected: No errors

- [ ] **Step 3: Fix any issues found, re-run, commit if needed**

---

## Chunk 3: Plugin Integration — Bus Tick & System Wiring

Wires the CLI domain bus into the Plugin's Excalibur game loop.

### Task 9: InteractionSystem — Plugin Bus Owner

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/interaction/interaction-system.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/interaction-system.test.ts`

- [ ] **Step 1: Write interaction system tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInteractionSystem } from "../../../../src/game/systems/interaction/interaction-system.js";

describe("InteractionSystem", () => {
	it("creates bus instance on init", () => {
		const system = createInteractionSystem();
		expect(system.getBus()).toBeDefined();
	});

	it("tick calls bus.tick and returns actions", () => {
		const system = createInteractionSystem();
		const bus = system.getBus();

		bus.submit({
			id: "int-1",
			initiator: { id: "atlas", entityType: "agent" },
			targets: [{ id: "vex", entityType: "agent" }],
			cardinality: "one-to-one",
			category: "social",
			action: "greet",
			priority: 30,
			context: {},
			cooldownMs: 5000,
			duration: 0,
			effects: [{ type: "affinity-change", target: "targets", amount: 1 }],
			timestamp: Date.now(),
		});

		const actions = system.tick(16);
		expect(actions.length).toBeGreaterThan(0);
	});

	it("isEntityLocked delegates to bus", () => {
		const system = createInteractionSystem();
		expect(system.isEntityLocked("atlas", "agent")).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/interaction-system.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement InteractionSystem**

Create `src/game/systems/interaction/interaction-system.ts`:

- Wraps `createInteractionBus(options)` from CLI domain, injecting:
  - `checkPrerequisite` callback that queries SocialSystem (proximity), RelationshipSystem (affinity), NeedsSystem (need thresholds), DayClock (phase)
  - `templateRegistry` reference for chain spawning
- Exposes `tick(deltaMs)` → calls `bus.tick(deltaMs)`, returns `InteractionAction[]`
- Processes `EffectState` returned by `bus.tick()`:
  - `affinityChanges` → forwards to `RelationshipSystem.adjustAffinity()`
  - `needChanges` → forwards to `NeedsSystem.adjustNeed()`
  - `economyChanges` → forwards to economy ledger
  - `memoryRecords` → forwards to memory system
  - `roomMoodShifts` → forwards to room mood state
- Exposes `getBus()` for resolvers to submit interactions
- Exposes `isEntityLocked(id, type)` for BT conditions
- Lifecycle event forwarding to Plugin EventBus (optional, deferred)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/interaction-system.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/interaction-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/interaction/interaction-system.test.ts"
git commit -m "feat(plugin): InteractionSystem wrapping CLI bus for game loop"
```

---

### Task 10: Engine Loop — Add tickInteractions

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-types.ts` (add `interactions` to `EngineSystems`)

- [ ] **Step 1: Read current engine-simulation.ts and engine-types.ts**

Read: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`
Read: `01 - Projects/Flowti Plugin/src/game/engine-types.ts`
Find the `tickSimulation()` function, the 12 phase calls, and the `EngineSystems` interface.

- [ ] **Step 2: Add `interactions` to EngineSystems interface**

In `engine-types.ts`, add to the `EngineSystems` interface:
```typescript
readonly interactions?: InteractionSystem;
```

Import `InteractionSystem` type.

- [ ] **Step 3: Add tickInteractions as a new phase between tickBrain and tickSocial**

In `engine-simulation.ts`, add a dedicated `tickInteractions` function and call it via `runTimedPhase` (consistent with the existing top-level phase pattern):

```typescript
function tickInteractions(ctx: EngineContext): void {
	if (!ctx.systems.interactions) return;
	const { actions } = ctx.systems.interactions.tick(ctx.state.deltaMs);
	// Route actions to effect renderer (wired when interaction-effect-renderer.ts is created in Task 19)
	if (actions.length > 0 && ctx.systems.interactionRenderer) {
		ctx.systems.interactionRenderer.render(actions);
	}
}
```

Insert call between `tickBrain` and `tickSocial` in `tickSimulation()`:
```typescript
runTimedPhase(ctx, "interactions", tickInteractions);
```

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No errors (interactions is optional, so existing code unaffected)

- [ ] **Step 4: Run plugin tests to verify no regressions**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(plugin): add tickInteractions phase to engine simulation loop"
```

---

### Task 11: SocialSystem — Add Proximity API for IntentResolvers

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/social-system.ts`

**Important:** Do NOT remove conversation triggering from SocialSystem. The CE + SocialSystem flow (`onConversation → CE.tryScript()`) works well for proximity-based multi-turn conversations (168 scripts). The InteractionBus handles *new* interaction types (NPC, room, director, cross-entity) — it complements, not replaces, the existing conversation flow.

- [ ] **Step 1: Read current social-system.ts**

Read: `01 - Projects/Flowti Plugin/src/game/systems/social-system.ts`
Understand: proximity detection, timer thresholds, `onConversation` callback, cluster detection.

- [ ] **Step 2: Add persistent proximity cache + getNearbyEntities method**

The SocialSystem computes pairwise distances inside `update()` using local variables. Add a field to persist this for IntentResolvers:

```typescript
// New field on the SocialSystem class:
private readonly nearbyCache = new Map<string, Array<{ id: string; entityType: string; distance: number }>>();

// Public method for IntentResolvers to query:
getNearbyEntities(entityId: string): Array<{ id: string; entityType: string; distance: number }> {
	return this.nearbyCache.get(entityId) ?? [];
}

// Public method for cluster data:
getCluster(entityId: string): string[] {
	// Return IDs of all entities in the same proximity cluster
}
```

Inside the existing `update()` loop where pairwise distances are computed, populate `nearbyCache` with entities within `socialRadius`. Clear and rebuild each tick.

- [ ] **Step 3: Run plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: PASS — no existing behavior changed, only new methods added.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/social-system.ts"
git commit -m "feat(plugin): add getNearbyEntities() and getCluster() to SocialSystem for IntentResolvers"
```

---

## Chunk 4: BT Integration — Subtree & Blackboard

Adds the `[InteractionIntent]` subtree to the agent BT and wires the first IntentResolver.

### Task 12: InteractionIntent Subtree MDSL

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/interaction.ts`

- [ ] **Step 1: Create interaction subtree**

```typescript
export const INTERACTION_SUBTREE = `
root [InteractionIntent] {
	sequence {
		condition [NotInInteraction]
		condition [HasNearbyEntity]
		action [EvaluateInteraction]
		action [SubmitInteraction]
	}
}
`.trim();
```

The subtree checks:
1. `NotInInteraction` — agent has no `activeInteraction` on blackboard
2. `HasNearbyEntity` — social system reports nearby entities
3. `EvaluateInteraction` — selects template from registry based on context
4. `SubmitInteraction` — submits to bus, returns SUCCEEDED if enqueued

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/interaction.ts"
git commit -m "feat(plugin): InteractionIntent BT subtree MDSL"
```

---

### Task 13: BT Factory — Wire Subtree + Blackboard

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-factory.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts`

- [ ] **Step 1: Read bt-types.ts and bt-factory.ts**

Read both files to understand the current blackboard shape and master MDSL composition.

- [ ] **Step 2: Add activeInteraction to BTAgentContext**

In `bt-types.ts`, add to the agent context/blackboard:

```typescript
activeInteraction: Interaction | null;
```

Import `Interaction` type from CLI domain.

- [ ] **Step 3: Add InteractionIntent subtree to master MDSL**

In `bt-factory.ts`:
1. Import `INTERACTION_SUBTREE` from `./subtrees/interaction.js`
2. Add `[InteractionIntent]` to the master selector, between `[WorkCycle]` and `[SocialBehavior]`
3. Register the conditions (`NotInInteraction`, `HasNearbyEntity`) and actions (`EvaluateInteraction`, `SubmitInteraction`) in the BTAgentObject

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-factory.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts"
git commit -m "feat(plugin): wire InteractionIntent subtree into agent BT master selector"
```

---

### Task 14: Agent IntentResolver

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/interaction/agent-intent-resolver.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/agent-intent-resolver.test.ts`

- [ ] **Step 1: Write agent resolver tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createAgentIntentResolver } from "../../../../src/game/systems/interaction/agent-intent-resolver.js";

describe("AgentIntentResolver", () => {
	it("produces no interactions when no nearby entities", () => {
		const resolver = createAgentIntentResolver({
			agentId: "atlas",
			getNearby: () => [],
			getNeeds: () => ({ energy: 80, social: 80, focus: 80, morale: 80, hunger: 80, thirst: 80 }),
			getHistory: () => [],
			getPhase: () => "productive-morning",
			getAffinity: () => 0,
			templates: { getAll: () => [], getById: () => undefined },
		});
		const interactions = resolver.resolve();
		expect(interactions).toEqual([]);
	});

	it("produces social interaction when nearby agent and social need low", () => {
		const resolver = createAgentIntentResolver({
			agentId: "atlas",
			getNearby: () => [{ id: "vex", entityType: "agent", distance: 50 }],
			getNeeds: () => ({ energy: 80, social: 15, focus: 80, morale: 80, hunger: 80, thirst: 80 }),
			getHistory: () => [],
			getPhase: () => "productive-morning",
			getAffinity: (_from, _to) => 30,
			templates: {
				getAll: () => [{
					id: "greet", category: "social", action: "greet", cardinality: "one-to-one",
					initiatorTypes: ["agent"], targetTypes: ["agent"],
					prerequisites: [], weight: 10, tags: ["bonding"],
					priority: 30, cooldownMs: 5000, effects: [],
				}],
				getById: () => undefined,
			},
		});
		const interactions = resolver.resolve();
		expect(interactions).toHaveLength(1);
		expect(interactions[0].category).toBe("social");
		expect(interactions[0].initiator.id).toBe("atlas");
	});

	it("does not produce work or commerce interactions for pets", () => {
		// This test belongs in pet resolver — skip here
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/agent-intent-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement createAgentIntentResolver**

The resolver:
1. Queries `getNearby()` for nearby entities
2. Derives context tags from needs (low social → "bonding", low morale → "comfort")
3. Calls `selectTemplate()` with the context
4. If a template is selected, builds a full `Interaction` from the template + runtime context
5. Returns the interaction array (0 or 1 interactions per resolve call)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/agent-intent-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/agent-intent-resolver.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/interaction/agent-intent-resolver.test.ts"
git commit -m "feat(plugin): agent IntentResolver — template selection from BT context"
```

---

### Task 15: Pet IntentResolver

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/interaction/pet-intent-resolver.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/pet-intent-resolver.test.ts`

- [ ] **Step 1: Write pet resolver tests**

```typescript
import { describe, it, expect } from "vitest";
import { createPetIntentResolver } from "../../../../src/game/systems/interaction/pet-intent-resolver.js";

describe("PetIntentResolver", () => {
	it("filters out work and commerce categories", () => {
		const resolver = createPetIntentResolver({
			petId: "rex",
			getNearby: () => [{ id: "atlas", entityType: "agent", distance: 40 }],
			getPetState: () => ({ hunger: 20, thirst: 80, energy: 90, affinity: new Map([["atlas", 60]]) }),
			getHistory: () => [],
			templates: {
				getAll: () => [
					{
						id: "work-tpl", category: "work", action: "collaborate",
						cardinality: "one-to-one", initiatorTypes: ["pet"], targetTypes: ["agent"],
						prerequisites: [], weight: 10, tags: [], priority: 30, cooldownMs: 5000, effects: [],
					},
					{
						id: "care-tpl", category: "care", action: "beg-food",
						cardinality: "one-to-one", initiatorTypes: ["pet"], targetTypes: ["agent"],
						prerequisites: [], weight: 10, tags: [], priority: 30, cooldownMs: 5000, effects: [],
					},
				],
				getById: () => undefined,
			},
		});
		const interactions = resolver.resolve();
		// Should only produce care, not work
		expect(interactions.every((i) => i.category !== "work")).toBe(true);
		expect(interactions.every((i) => i.category !== "commerce")).toBe(true);
	});

	it("produces zoomies interaction when energy high", () => {
		const resolver = createPetIntentResolver({
			petId: "rex",
			getNearby: () => [
				{ id: "atlas", entityType: "agent", distance: 40 },
				{ id: "vex", entityType: "agent", distance: 50 },
			],
			getPetState: () => ({ hunger: 80, thirst: 80, energy: 95, affinity: new Map() }),
			getHistory: () => [],
			templates: {
				getAll: () => [{
					id: "zoomies", category: "playful", action: "zoomies-disruption",
					cardinality: "one-to-many", initiatorTypes: ["pet"], targetTypes: ["agent"],
					prerequisites: [{ type: "need-threshold", need: "energy", op: ">", value: 80 }],
					weight: 10, tags: [], priority: 30, cooldownMs: 10000, effects: [],
				}],
				getById: () => undefined,
			},
		});
		const interactions = resolver.resolve();
		expect(interactions.some((i) => i.action === "zoomies-disruption")).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/pet-intent-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement createPetIntentResolver**

Similar to agent resolver but:
- Filters templates to only `social`, `care`, `playful`, `reactive` categories
- Uses pet state (hunger, energy, affinity) instead of agent needs
- Simpler context derivation (high energy → "playful" tag, low hunger → "care" tag)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/pet-intent-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/pet-intent-resolver.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/interaction/pet-intent-resolver.test.ts"
git commit -m "feat(plugin): pet IntentResolver with category filtering"
```

---

## Chunk 5: NPC, Room & Director Resolvers + Effect Renderer

Final resolvers and the visual bridge.

### Task 16: NPC IntentResolver

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/interaction/npc-intent-resolver.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/npc-intent-resolver.test.ts`

- [ ] **Step 1: Write NPC resolver tests**

Test rule table evaluation:
- Proximity trigger fires when agent nearby for threshold duration
- Idle-timeout trigger fires when no agents nearby for duration
- Conditions are checked (affinity range, cooldown)
- Weight-based selection when multiple rules match

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/npc-intent-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement createNPCIntentResolver**

Takes:
- `npcId`, `npcRole` — which NPC this is
- `rules: NPCInteractionRule[]` — the rule table for this role
- `getNearby()` — proximity query
- `getCooldown()` — from bus

Evaluates rules in weight order. First matching rule produces an interaction.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/npc-intent-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/npc-intent-resolver.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/interaction/npc-intent-resolver.test.ts"
git commit -m "feat(plugin): NPC IntentResolver with rule table evaluation"
```

---

### Task 17: Room IntentResolver

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/interaction/room-intent-resolver.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/room-intent-resolver.test.ts`

- [ ] **Step 1: Write room resolver tests**

Test per layer:
- Passive rules produce no interactions (stat modifiers only, handled elsewhere)
- Reactive rules fire when collective mood threshold met + occupancy condition
- Active rules fire on idle-timeout conditions (e.g., notice board unseen)
- Phase filter works correctly

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/room-intent-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement createRoomIntentResolver**

Takes:
- `roomId`, `roomType`
- `rules: RoomInteractionRule[]`
- `getOccupancy()` — number of entities in room
- `getCollectiveMood()` — aggregate mood of occupants
- `getPhase()` — current day phase

Evaluates `EnvironmentCondition` discriminated union for each rule. Matching reactive/active rules produce interactions targeting all room occupants.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/room-intent-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/room-intent-resolver.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/interaction/room-intent-resolver.test.ts"
git commit -m "feat(plugin): room IntentResolver with layered condition evaluation"
```

---

### Task 18: Director IntentResolver

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/interaction/director-intent-resolver.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/director-intent-resolver.test.ts`

- [ ] **Step 1: Write director resolver tests**

```typescript
import { describe, it, expect } from "vitest";
import { createDirectorIntentResolver } from "../../../../src/game/systems/interaction/director-intent-resolver.js";

describe("DirectorIntentResolver", () => {
	it("creates praise interaction with override priority", () => {
		const resolver = createDirectorIntentResolver({
			templates: {
				getAll: () => [],
				getById: (id) => id === "director-praise" ? {
					id: "director-praise", category: "directive", action: "praise",
					cardinality: "one-to-one", initiatorTypes: ["director"], targetTypes: ["agent"],
					prerequisites: [], weight: 10, tags: [],
					priority: 95, cooldownMs: 0, effects: [
						{ type: "need-change", target: "targets", need: "morale", amount: 15 },
					],
				} : undefined,
			},
		});

		const interaction = resolver.createDirectorInteraction("director-praise", [
			{ id: "atlas", entityType: "agent" },
		]);

		expect(interaction.priority).toBe(95);
		expect(interaction.initiator.entityType).toBe("director");
		expect(interaction.targets[0].id).toBe("atlas");
	});

	it("resolve returns empty — director is event-driven, not tick-driven", () => {
		const resolver = createDirectorIntentResolver({ templates: { getAll: () => [], getById: () => undefined } });
		expect(resolver.resolve()).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/director-intent-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement createDirectorIntentResolver**

Unlike other resolvers, the director resolver is **event-driven** (click handler), not tick-driven. It exposes:
- `resolve()` — returns `[]` (no autonomous behavior)
- `createDirectorInteraction(templateId, targets)` — builds an interaction from a template with director as initiator, priority 95, and submits to bus

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/director-intent-resolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/director-intent-resolver.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/interaction/director-intent-resolver.test.ts"
git commit -m "feat(plugin): director IntentResolver — event-driven interaction submission"
```

---

### Task 19: Interaction Effect Renderer

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/interaction/interaction-effect-renderer.ts`

- [ ] **Step 1: Implement effect renderer**

Maps `InteractionAction[]` to the Rich Dialogue system's visual APIs.

**Key integration points with the completed dialogue system:**
- `bubble` actions → `TalkEngine.triggerReactive()` for reactive phrases, or direct bubble rendering for interaction-specific text
- `particle` actions → particle pool manager (existing)
- State mutations (affinity, needs, economy) are already handled by the CLI domain `applyEffect()` inside the bus tick — the renderer only handles visual effects

```typescript
export function renderInteractionActions(
	actions: InteractionAction[],
	systems: {
		talk: TalkEngine;        // triggerReactive(), showBubble() — existing API
		bubble: BubbleSystem;    // direct bubble rendering
	},
): void {
	for (const action of actions) {
		switch (action.actionType) {
			case "bubble": {
				const { bubbleKind, phrasePool, templateVars } = action.params as {
					bubbleKind: string; phrasePool: string; templateVars?: Record<string, string>;
				};
				// Use TalkEngine's reactive trigger for phrase pool resolution
				// (leverages existing 10-step pipeline, tier modifiers, fragment composer)
				if (phrasePool.startsWith("reactive:")) {
					systems.talk.triggerReactive(action.entityId, phrasePool.replace("reactive:", ""));
				} else {
					// Direct bubble for interaction-specific text
					systems.bubble.showBubble(action.entityId, bubbleKind, phrasePool);
				}
				break;
			}
			case "particle":
				// Future: trigger particle effect on entity via particle pool manager
				break;
			case "sound":
				// Future: audio system integration
				break;
			// affinity-change, need-change, economy-transaction, etc.
			// → already handled by EffectState in InteractionSystem.tick()
		}
	}
}
```

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/interaction-effect-renderer.ts"
git commit -m "feat(plugin): interaction effect renderer bridging bus actions to visual systems"
```

---

### Task 20: Full Plugin Test Suite Pass

- [ ] **Step 1: Run full plugin test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: PASS

- [ ] **Step 2: Fix any issues, re-run**

- [ ] **Step 3: Final commit if needed**

---

### Task 21: Seed Pet & Cross-Type Templates

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/templates/pet-social.ts`
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/templates/cross-type.ts`
- Create: `01 - Projects/Flowti CLI/src/domain/interactions/templates/environment-events.ts`

- [ ] **Step 1: Create pet-social.ts with 3 templates**

Templates: `zoomies-disruption`, `sit-between`, `comfort-sad-agent`. Pet-initiated, social/playful/reactive categories.

- [ ] **Step 2: Create cross-type.ts with 3 chain templates**

Templates: `caught-sneaking-treat` (chain from agent-pet), `what-did-you-buy` (chain from NPC commerce), `chase-sequence` (chain from pet zoomies). These are follow-up templates referenced by `chainTemplates` in other template files.

- [ ] **Step 3: Create environment-events.ts with 3 templates**

Templates: `build-break-reaction`, `deploy-celebration`, `birthday-party`. Reactive/social interactions spawned by world events.

- [ ] **Step 4: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/interactions/templates/"
git commit -m "feat(interactions): pet-social, cross-type chain, and environment event templates"
```

---

### Task 22: Bootstrap Wiring — Assemble All Components

**Files:**
- Create or modify: `01 - Projects/Flowti Plugin/src/game/systems/interaction/bootstrap-interactions.ts`

This is the glue task that assembles all the pieces into a working system.

- [ ] **Step 1: Create bootstrap function**

```typescript
import { createInteractionBus } from "../../../../01 - Projects/Flowti CLI/src/domain/interactions/interaction-bus.js";
import { createTemplateRegistry } from "../../../../01 - Projects/Flowti CLI/src/domain/interactions/interaction-templates.js";
import { AGENT_AGENT_TEMPLATES } from "../../../../01 - Projects/Flowti CLI/src/domain/interactions/templates/agent-agent.js";
import { AGENT_PET_TEMPLATES } from "../../../../01 - Projects/Flowti CLI/src/domain/interactions/templates/agent-pet.js";
// ... import all template files

export function bootstrapInteractionSystem(systems: {
	social: SocialSystem;
	relationship: RelationshipSystem;
	needs: NeedsSystem;
	dayClock: DayClock;
	conversation: ConversationEngine;
}) {
	// 1. Load all templates into a single registry
	const allTemplates = [
		...AGENT_AGENT_TEMPLATES,
		...AGENT_PET_TEMPLATES,
		...PET_SOCIAL_TEMPLATES,
		...NPC_TEMPLATES,
		...ROOM_TEMPLATES,
		...DIRECTOR_TEMPLATES,
		...ENVIRONMENT_TEMPLATES,
		...CROSS_TYPE_TEMPLATES,
	];
	const registry = createTemplateRegistry(allTemplates);

	// 2. Create prerequisite checker that delegates to game systems
	const checkPrerequisite = (prereq, interaction) => {
		switch (prereq.type) {
			case "proximity": {
				const nearby = systems.social.getNearbyEntities(interaction.initiator.id);
				return interaction.targets.every((t) =>
					nearby.some((n) => n.id === t.id && n.distance <= prereq.maxDistance));
			}
			case "affinity-range": {
				return interaction.targets.every((t) => {
					const affinity = systems.relationship.getAffinity(interaction.initiator.id, t.id);
					return affinity >= prereq.min && affinity <= prereq.max;
				});
			}
			case "need-threshold": {
				const needs = systems.needs.getNeeds(interaction.initiator.id);
				const value = needs[prereq.need];
				// evaluate op: <, >, ==, <=, >=
				return evaluateOp(value, prereq.op, prereq.value);
			}
			case "phase": {
				const currentPhase = systems.dayClock.getPhase();
				return prereq.phases.includes(currentPhase);
			}
			case "trust-tier":
			case "has-item":
				return true; // deferred to future implementation
			default:
				return true;
		}
	};

	// 3. Create bus with injected dependencies (including CE cooperative lock query)
	const bus = createInteractionBus({
		checkPrerequisite,
		templateRegistry: registry,
		externalLockQuery: (entityId) => systems.conversation.isLocked(entityId),
	});

	// 4. Create resolvers (each receives registry + relevant system queries)
	const agentResolver = createAgentIntentResolver({ /* ... */ });
	const petResolver = createPetIntentResolver({ /* ... */ });
	const npcResolver = createNPCIntentResolver({ /* ... */ });
	const roomResolver = createRoomIntentResolver({ /* ... */ });
	const directorResolver = createDirectorIntentResolver({ templates: registry });

	// 5. Create InteractionSystem that wraps bus + processes effect state
	const interactionSystem = createInteractionSystem(bus, systems);

	return { interactionSystem, bus, registry, resolvers: { agent: agentResolver, pet: petResolver, npc: npcResolver, room: roomResolver, director: directorResolver } };
}
```

- [ ] **Step 2: Wire bootstrap into engine initialization**

In the engine initialization code (wherever `EngineSystems` is constructed), call `bootstrapInteractionSystem()` and assign the result to `ctx.systems.interactions`.

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/bootstrap-interactions.ts"
git commit -m "feat(plugin): bootstrap wiring — assemble bus, registry, resolvers, prerequisite checker"
```

---

### Deferred Integration Notes

These integrations are **not in scope** for this plan but should be addressed in follow-up work:

1. **ConversationEngine ← bus lock query** — CE currently checks only its own `Set<string>` before starting scripts. A small follow-up should add `bus.isEntityLocked()` check inside `tryScript()` so CE respects bus locks. This is the CE side of the cooperative lock model (the bus side is handled in this plan via `externalLockQuery`).

2. **WorldEventScheduler as interaction producer** — Modify `world-event-scheduler.ts` to submit interactions to the bus instead of directly orchestrating multi-agent reactions. Deferred because the scheduler needs to be refactored alongside the interaction system once the bus is stable.

3. **Template expansion to ~150** — The seed templates (~35 total) demonstrate all interaction patterns. Expanding to the full ~150 templates is content work that can be done incrementally after the system is running. The 168 conversation scripts in CE are a separate content layer — interaction templates cover entity types and cardinalities that CE doesn't handle (NPC, room, director, environment).

4. **Trust tier and has-item prerequisites** — The prerequisite checker stubs these as `return true`. Implement when the economy system's trust tiers and inventory are in place.

5. **CE trigger migration** — Long-term, proximity-triggered agent-agent conversations could migrate from `SocialSystem → CE.tryScript()` to `AgentIntentResolver → InteractionBus → CE as effect executor`. Not urgent — the current direct triggering works well and CE has 168 scripts optimized for it.

---

### Task 23: Final Integration Verification

- [ ] **Step 1: Run full CLI test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: PASS

- [ ] **Step 2: Run full Plugin test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: PASS

- [ ] **Step 3: Type check both projects**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Lint CLI domain**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/interactions/ --config configs/eslint.config.mjs`
Expected: No errors

- [ ] **Step 5: Commit any final fixes**

---

## Dependency Graph

```
Task 1 (types) ──────────┬──→ Task 2 (bus) ──→ Task 5 (templates) ──→ Task 7 (seed data)
                          │         │                                    ↓
                          ├──→ Task 3 (effects)          Task 14 (agent resolver) ──→ Task 21 (more templates)
                          │                              Task 15 (pet resolver)
                          ├──→ Task 4 (resolver types) → Task 16 (NPC resolver)
                          │                              Task 17 (room resolver)
                          │                              Task 18 (director resolver)
                          │
                          └──→ Task 6 (persistence)

Task 9 (interaction system) ──→ Task 10 (engine loop + types) ──→ Task 11 (social simplify)
                                                                    ↓
Task 12 (subtree MDSL) ──→ Task 13 (BT factory) ──→ Task 14 (agent resolver)

Task 19 (effect renderer) depends on Task 9

Task 22 (bootstrap wiring) depends on ALL resolver tasks + Task 9 + Task 5 + Task 7

Task 8 (CLI suite) gates Chunk 2→3
Task 20 (Plugin suite) gates Chunk 4→5
Task 23 (final verification) gates completion
```

## Parallelization Opportunities

Within each chunk, some tasks can run in parallel via subagents:

- **Chunk 1:** Tasks 1→2→3 are sequential (each depends on types). Task 4 can parallel with Task 3.
- **Chunk 2:** Tasks 5 and 6 can parallel (both depend on Task 1 types only). Task 7 depends on Task 5.
- **Chunk 3:** Tasks 9→10→11 are sequential.
- **Chunk 4:** Task 12 can parallel with Task 13 prep. Tasks 14 and 15 can parallel.
- **Chunk 5:** Tasks 16, 17, 18 can all run in parallel. Task 19 parallel with them. Task 21 depends on Task 5.
