# Rich Dialogue & Interaction Expansion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Agent World dialogue from ~625 to ~1,910 phrase units with multi-turn conversations, pet talk, tier-driven tone, drama/gossip, running jokes, and composable fragments.

**Architecture:** Two new engines (ConversationEngine + FragmentComposer) sit alongside the existing TalkEngine. ConversationEngine handles multi-turn scripted exchanges between agents/pets; FragmentComposer assembles ambient one-liners from interchangeable parts. Both feed through the existing bubble system. RelationshipSystem gains petAffinity and jokePlayCounts for persistence.

**Tech Stack:** TypeScript (strict), Vitest, existing talk/BT/relationship infrastructure in `01 - Projects/Flowti Plugin/`

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-21-rich-dialogue-expansion-design.md`

**Base path:** `01 - Projects/Flowti Plugin/src/game`
**Test base:** `01 - Projects/Flowti Plugin/tests/game`
**Test command:** `cd "01 - Projects/Flowti Plugin" && npx vitest run`
**Single test:** `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/FILENAME.test.ts`

---

## Chunk 1: Foundation — Types, RelationshipSystem Extensions, Fragment Composer

These are the shared building blocks that everything else depends on. No content yet — just the engine plumbing.

---

### Task 1: Conversation & Running Joke Types

**Files:**
- Create: `src/game/systems/talk/conversation-types.ts`
- Test: `tests/game/systems/talk/conversation-types.test.ts`

- [ ] **Step 1: Write the type definition file**

Create `src/game/systems/talk/conversation-types.ts`:

```typescript
/**
 * conversation-types.ts — Type definitions for the multi-turn conversation system.
 *
 * ConversationScript defines authored exchanges between agents/pets.
 * RunningJoke is a standalone type for jokes that escalate with repetition.
 */

import type { BubbleKind } from "./talk-types.js";
import type { AgentMood } from "./templates/mood-variants.js";
import type { RelationshipTier } from "../relationship-system.js";

// ── Conversation triggers ───────────────────────────────────────────

export type ConversationTrigger =
	| "proximity"
	| "work-finished"
	| "break"
	| "mood-event"
	| "gossip"
	| "pet-catalyst"
	| "tier-change";

// ── Turn conditions ─────────────────────────────────────────────────

export type TurnCondition =
	| { readonly type: "mood"; readonly agent: "A" | "B"; readonly mood: AgentMood }
	| { readonly type: "tier"; readonly min: RelationshipTier }
	| { readonly type: "petPresent" }
	| { readonly type: "thirdAgentNearby" };

// ── Conversation turns ──────────────────────────────────────────────

export interface ConversationTurn {
	readonly speaker: "A" | "B" | "pet";
	readonly text: string;
	readonly delayMs: number;
	readonly kind: BubbleKind;
	readonly condition?: TurnCondition;
}

// ── Conversation scripts ────────────────────────────────────────────

export interface ConversationScript {
	readonly id: string;
	readonly tierRange: readonly [RelationshipTier, RelationshipTier];
	readonly domainFilter?: readonly [string, string] | null;
	readonly trigger: ConversationTrigger;
	readonly weight: number;
	readonly cooldownMs: number;
	readonly tags: readonly string[];
	readonly turns: readonly ConversationTurn[];
}

// ── Running jokes ───────────────────────────────────────────────────

export interface RunningJoke {
	readonly id: string;
	readonly tierRange: readonly [RelationshipTier, RelationshipTier];
	readonly domainFilter?: readonly [string, string] | null;
	readonly trigger: ConversationTrigger;
	readonly weight: number;
	readonly cooldownMs: number;
	readonly tags: readonly string[];
	readonly variants: readonly (readonly ConversationTurn[])[];
	readonly maxEscalation: number;
	readonly callbackChance: number;
	readonly callbackLines: readonly string[];
}
```

- [ ] **Step 2: Write type-check tests**

Create `tests/game/systems/talk/conversation-types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type {
	ConversationScript, RunningJoke, ConversationTurn,
	ConversationTrigger, TurnCondition,
} from "../../../../src/game/systems/talk/conversation-types.js";

describe("conversation-types", () => {
	it("ConversationScript satisfies the type contract", () => {
		const script: ConversationScript = {
			id: "test-script",
			tierRange: ["acquaintance", "colleague"],
			domainFilter: ["engineering", "design"],
			trigger: "proximity",
			weight: 1,
			cooldownMs: 30000,
			tags: ["test"],
			turns: [
				{ speaker: "A", text: "Hello {agentB}", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "Hi {agentA}", delayMs: 1500, kind: "speech" },
			],
		};
		expect(script.id).toBe("test-script");
		expect(script.turns).toHaveLength(2);
	});

	it("RunningJoke has variants instead of turns", () => {
		const joke: RunningJoke = {
			id: "joke:test",
			tierRange: ["acquaintance", "best-friend"],
			trigger: "proximity",
			weight: 1,
			cooldownMs: 60000,
			tags: ["running-joke"],
			variants: [
				[{ speaker: "A", text: "Tabs.", delayMs: 2000, kind: "speech" }],
				[{ speaker: "A", text: "Not this again...", delayMs: 2000, kind: "speech" }],
			],
			maxEscalation: 2,
			callbackChance: 0.1,
			callbackLines: ["Don't start them on tabs."],
		};
		expect(joke.variants).toHaveLength(2);
		expect(joke.maxEscalation).toBe(2);
	});

	it("TurnCondition variants are all valid", () => {
		const conditions: TurnCondition[] = [
			{ type: "mood", agent: "A", mood: "excited" },
			{ type: "tier", min: "friend" },
			{ type: "petPresent" },
			{ type: "thirdAgentNearby" },
		];
		expect(conditions).toHaveLength(4);
	});

	it("ConversationTrigger covers all expected values", () => {
		const triggers: ConversationTrigger[] = [
			"proximity", "work-finished", "break", "mood-event",
			"gossip", "pet-catalyst", "tier-change",
		];
		expect(triggers).toHaveLength(7);
	});
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/conversation-types.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/conversation-types.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/conversation-types.test.ts"
git commit -m "feat(talk): add conversation script and running joke type definitions"
```

---

### Task 2: Extend TemplateVars with Pet Fields and PetVoice Type

**Files:**
- Modify: `src/game/systems/talk/talk-types.ts`
- Modify: `src/game/systems/talk/talk-engine.ts` (defaultVars only)
- Test: `tests/game/systems/talk/talk-engine.test.ts` (add test)

- [ ] **Step 1: Add pet fields to TemplateVars and PetVoice type**

In `src/game/systems/talk/talk-types.ts`, add after the existing `readonly mood: string;` line:

```typescript
	// Pet-specific fields (empty string for non-pet entries)
	readonly pet_name: string;
	readonly pet_type: string;
	readonly owner_name: string;
	readonly nearby_agent_mood: string;
	readonly hunger_level: string;
	readonly affection_level: string;
```

After the `TemplateVars` interface, add:

```typescript
/** Pet voice mode — determines inner monologue tone. */
export type PetVoice = "instinct" | "eloquent" | "gremlin";
```

- [ ] **Step 2: Update defaultVars in talk-engine.ts**

In `src/game/systems/talk/talk-engine.ts`, update the `defaultVars()` function to include pet fields:

```typescript
function defaultVars(domain: string): TemplateVars {
	return {
		task: "",
		mood_adj: "focused",
		role: "team member",
		domain,
		idle_action: "thinking quietly",
		nearby_agent: "",
		nearby_domain: "",
		persona_quirk: "",
		phase: "afternoon",
		weather: "clear",
		streak: "0",
		friend_name: "",
		mood: "neutral",
		pet_name: "",
		pet_type: "",
		owner_name: "",
		nearby_agent_mood: "",
		hunger_level: "",
		affection_level: "",
	};
}
```

- [ ] **Step 3: Write test for pet registration in TalkEngine**

Add to `tests/game/systems/talk/talk-engine.test.ts`:

```typescript
	it("registers a pet entity with pet-specific vars", () => {
		engine.register("cat-whiskers", "pet", [], 5);
		engine.updateVars("cat-whiskers", {
			pet_name: "Whiskers",
			pet_type: "cat",
			hunger_level: "70",
		});
		// No error means pet registration works
	});
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/talk-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/talk-types.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/talk/talk-engine.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/talk-engine.test.ts"
git commit -m "feat(talk): extend TemplateVars with pet fields, add PetVoice type"
```

---

### Task 3: Extend RelationshipSystem — petAffinity + jokePlayCounts

**Files:**
- Modify: `src/game/systems/relationship-system.ts`
- Modify: `tests/game/systems/relationship-system.test.ts`

- [ ] **Step 1: Write failing tests for petAffinity**

Add to `tests/game/systems/relationship-system.test.ts`:

```typescript
	describe("petAffinity", () => {
		it("starts at 50 for unknown agents", () => {
			const sys = new RelationshipSystem();
			expect(sys.getPetAffinity("Atlas")).toBe(50);
		});

		it("changePetAffinity adjusts and clamps 0-100", () => {
			const sys = new RelationshipSystem();
			sys.changePetAffinity("Atlas", 30);
			expect(sys.getPetAffinity("Atlas")).toBe(80);
			sys.changePetAffinity("Atlas", 30);
			expect(sys.getPetAffinity("Atlas")).toBe(100);
			sys.changePetAffinity("Atlas", -150);
			expect(sys.getPetAffinity("Atlas")).toBe(0);
		});

		it("serializes and restores petAffinity", () => {
			const sys = new RelationshipSystem();
			sys.changePetAffinity("Atlas", 10);
			const data = sys.serialize();
			const sys2 = new RelationshipSystem();
			sys2.restore(data);
			expect(sys2.getPetAffinity("Atlas")).toBe(60);
		});
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/relationship-system.test.ts`
Expected: FAIL — `getPetAffinity` is not a function

- [ ] **Step 3: Write failing tests for jokePlayCounts**

Add to `tests/game/systems/relationship-system.test.ts`:

```typescript
	describe("jokePlayCounts", () => {
		it("getJokePlayCount returns 0 for unplayed jokes", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			expect(sys.getJokePlayCount("Atlas", "Rex", "joke:tabs")).toBe(0);
		});

		it("incrementJokePlayCount tracks per-pair per-joke", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.incrementJokePlayCount("Atlas", "Rex", "joke:tabs");
			sys.incrementJokePlayCount("Atlas", "Rex", "joke:tabs");
			expect(sys.getJokePlayCount("Atlas", "Rex", "joke:tabs")).toBe(2);
			expect(sys.getJokePlayCount("Atlas", "Rex", "joke:other")).toBe(0);
		});

		it("jokePlayCounts survive serialize/restore", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.incrementJokePlayCount("Atlas", "Rex", "joke:tabs");
			const data = sys.serialize();
			const sys2 = new RelationshipSystem();
			sys2.restore(data);
			expect(sys2.getJokePlayCount("Atlas", "Rex", "joke:tabs")).toBe(1);
		});
	});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/relationship-system.test.ts`
Expected: FAIL — `getJokePlayCount` is not a function

- [ ] **Step 5: Implement petAffinity on RelationshipSystem**

In `src/game/systems/relationship-system.ts`:

Add field after `private interactedThisCycle`:
```typescript
	private readonly petAffinity = new Map<string, number>();
```

Add methods after `addSharedMemory`:
```typescript
	// ── Pet affinity ────────────────────────────────────────────

	getPetAffinity(agentName: string): number {
		return this.petAffinity.get(agentName) ?? 50;
	}

	changePetAffinity(agentName: string, delta: number): void {
		const current = this.getPetAffinity(agentName);
		this.petAffinity.set(agentName, Math.max(0, Math.min(100, current + delta)));
	}
```

Update `PersistenceData` interface:
```typescript
interface PersistenceData {
	relationships: RelationshipEntry[];
	opinions: Record<string, AgentOpinion[]>;
	petAffinity: Record<string, number>;
}
```

Update `serialize()` to include petAffinity:
```typescript
	serialize(): PersistenceData {
		const relationships: RelationshipEntry[] = [];
		for (const entry of this.relationships.values()) {
			relationships.push({ ...entry, sharedMemories: [...entry.sharedMemories] });
		}
		const opinions: Record<string, AgentOpinion[]> = {};
		for (const [name, ops] of this.agentOpinions) {
			opinions[name] = [...ops];
		}
		const petAffinity: Record<string, number> = {};
		for (const [name, val] of this.petAffinity) {
			petAffinity[name] = val;
		}
		return { relationships, opinions, petAffinity };
	}
```

Update `restore()` to include petAffinity and default `jokePlayCounts` for old data:
```typescript
	restore(data: PersistenceData): void {
		for (const entry of data.relationships) {
			// Default jokePlayCounts for entries serialized before this field existed
			this.relationships.set(this.pairKey(entry.agentA, entry.agentB), {
				...entry,
				jokePlayCounts: entry.jokePlayCounts ?? {},
			});
		}
		for (const [name, ops] of Object.entries(data.opinions)) {
			this.agentOpinions.set(name, ops);
		}
		if (data.petAffinity) {
			for (const [name, val] of Object.entries(data.petAffinity)) {
				this.petAffinity.set(name, val);
			}
		}
	}
```

- [ ] **Step 6: Implement jokePlayCounts**

Add `jokePlayCounts` to `RelationshipEntry`:
```typescript
export interface RelationshipEntry {
	agentA: string;
	agentB: string;
	affinity: number;
	interactionCount: number;
	lastInteraction: number;
	sharedMemories: string[];
	opinion: string | null;
	jokePlayCounts: Record<string, number>;
}
```

Update `getOrCreate()` to initialize it:
```typescript
	entry = {
		agentA: a < b ? a : b,
		agentB: a < b ? b : a,
		affinity: 0,
		interactionCount: 0,
		lastInteraction: 0,
		sharedMemories: [],
		opinion: null,
		jokePlayCounts: {},
	};
```

Add methods:
```typescript
	// ── Joke play counts ────────────────────────────────────────

	getJokePlayCount(a: string, b: string, jokeId: string): number {
		const entry = this.getOrCreate(a, b);
		return entry.jokePlayCounts[jokeId] ?? 0;
	}

	incrementJokePlayCount(a: string, b: string, jokeId: string): void {
		const entry = this.getOrCreate(a, b);
		entry.jokePlayCounts[jokeId] = (entry.jokePlayCounts[jokeId] ?? 0) + 1;
	}
```

Update `serialize()` to include `jokePlayCounts` in the spread:
```typescript
	relationships.push({ ...entry, sharedMemories: [...entry.sharedMemories], jokePlayCounts: { ...entry.jokePlayCounts } });
```

- [ ] **Step 7: Run all relationship tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/relationship-system.test.ts`
Expected: PASS — all existing + 6 new tests green

- [ ] **Step 8: Run full test suite to check for regressions**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS — no regressions from the `PersistenceData` shape change (existing `restore()` calls will have `petAffinity: undefined` which the `if (data.petAffinity)` guard handles)

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/relationship-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/relationship-system.test.ts"
git commit -m "feat(relationship): add petAffinity map and jokePlayCounts persistence"
```

---

### Task 4: Extend ReactiveTrigger with Pet Triggers

**Files:**
- Modify: `src/game/systems/talk/templates/reactive-phrases.ts`
- Test: `tests/game/systems/talk/conversation-types.test.ts` (add import check)

- [ ] **Step 1: Add 7 pet reactive triggers to the union type**

In `src/game/systems/talk/templates/reactive-phrases.ts`, extend the `ReactiveTrigger` type:

```typescript
export type ReactiveTrigger =
	| "morale-boost"
	| "morale-drop"
	| "energy-critical"
	| "energy-restored"
	| "work-finished"
	| "break-started"
	| "social-fulfilled"
	| "lonely"
	| "focus-lost"
	| "focus-deep"
	| "streak-milestone"
	| "new-friend"
	| "got-rival"
	// Pet-specific triggers (emotional/situational, NOT PetState extensions)
	| "pet-hungry"
	| "pet-sleepy"
	| "pet-bored"
	| "pet-startled"
	| "pet-affectionate"
	| "pet-jealous"
	| "pet-zoomies";
```

Add empty arrays for each new trigger in `REACTIVE_TEMPLATES` (content comes in Chunk 3):

```typescript
	// Pet reactive triggers — populated in pet-reactive-phrases.ts
	"pet-hungry": [],
	"pet-sleepy": [],
	"pet-bored": [],
	"pet-startled": [],
	"pet-affectionate": [],
	"pet-jealous": [],
	"pet-zoomies": [],
```

- [ ] **Step 2: Add a targeted test verifying the new triggers exist**

Add to `tests/game/systems/talk/conversation-types.test.ts`:

```typescript
import type { ReactiveTrigger } from "../../../../src/game/systems/talk/templates/reactive-phrases.js";

	it("pet reactive triggers are valid ReactiveTrigger values", () => {
		const petTriggers: ReactiveTrigger[] = [
			"pet-hungry", "pet-sleepy", "pet-bored", "pet-startled",
			"pet-affectionate", "pet-jealous", "pet-zoomies",
		];
		expect(petTriggers).toHaveLength(7);
	});
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS — extending the union and adding empty arrays is backward-compatible

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/reactive-phrases.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/conversation-types.test.ts"
git commit -m "feat(talk): add 7 pet reactive trigger types to ReactiveTrigger union"
```

---

### Task 5: Fragment Composer Engine

**Files:**
- Create: `src/game/systems/talk/fragment-composer.ts`
- Test: `tests/game/systems/talk/fragment-composer.test.ts`

- [ ] **Step 1: Write failing tests for FragmentComposer**

Create `tests/game/systems/talk/fragment-composer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
	FragmentComposer,
	type FragmentPool,
} from "../../../../src/game/systems/talk/fragment-composer.js";

const OPENERS: FragmentPool = {
	id: "test-openers",
	slot: "opener",
	filters: {},
	fragments: ["Hmm,", "So,", "Well,"],
};

const CORES: FragmentPool = {
	id: "test-cores",
	slot: "core",
	filters: {},
	fragments: ["this is interesting", "that looks wrong", "I have thoughts"],
};

const CLOSERS: FragmentPool = {
	id: "test-closers",
	slot: "closer",
	filters: {},
	fragments: ["...probably", "...I think", "...maybe"],
};

const QUALIFIERS: FragmentPool = {
	id: "test-qualifiers",
	slot: "qualifier",
	filters: {},
	fragments: ["...but what do I know", "...in theory"],
};

const INTERJECTIONS: FragmentPool = {
	id: "test-interjections",
	slot: "interjection",
	filters: {},
	fragments: ["Wait—", "Oh—", "Huh."],
};

describe("FragmentComposer", () => {
	it("constructs with pools", () => {
		const composer = new FragmentComposer([OPENERS, CORES, CLOSERS, QUALIFIERS, INTERJECTIONS]);
		expect(composer).toBeDefined();
	});

	it("compose returns a non-empty string", () => {
		const composer = new FragmentComposer([OPENERS, CORES, CLOSERS, QUALIFIERS, INTERJECTIONS]);
		const result = composer.compose({});
		expect(result).toBeTruthy();
		expect(typeof result).toBe("string");
	});

	it("compose with mood filter selects from matching pools", () => {
		const moodPool: FragmentPool = {
			id: "excited-openers",
			slot: "opener",
			filters: { mood: ["excited"] },
			fragments: ["YES!", "Oh wow!"],
		};
		const composer = new FragmentComposer([moodPool, CORES]);
		const result = composer.compose({ mood: "excited" });
		expect(result).toBeTruthy();
	});

	it("compose with domain filter selects from matching pools", () => {
		const domainPool: FragmentPool = {
			id: "eng-cores",
			slot: "core",
			filters: { domain: ["engineering"] },
			fragments: ["the build is broken"],
		};
		const composer = new FragmentComposer([OPENERS, domainPool]);
		const result = composer.compose({ domain: "engineering" });
		expect(result).toContain("the build is broken");
	});

	it("avoids recently used phrases", () => {
		const tinyPool: FragmentPool = {
			id: "tiny-cores",
			slot: "core",
			filters: {},
			fragments: ["only option"],
		};
		const composer = new FragmentComposer([tinyPool]);
		const result1 = composer.compose({}, ["only option"]);
		// With only one option and it's avoided, falls back to it anyway
		expect(result1).toBe("only option");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/fragment-composer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement FragmentComposer**

Create `src/game/systems/talk/fragment-composer.ts`:

```typescript
/**
 * fragment-composer.ts — Assembles ambient phrases from interchangeable fragment pools.
 *
 * Composition patterns (probability-weighted):
 *   1. Opener + Core          (40%)
 *   2. Core + Qualifier       (30%)
 *   3. Interjection + Core + Closer (25%)
 *   4. Opener + Core + Closer (5%)
 *
 * Fragments are filtered by mood, domain, tier, petVoice, and timeOfDay.
 * Unfiltered pools are always eligible; filtered pools match when any filter value matches.
 */

import type { AgentMood, PetVoice } from "./talk-types.js";
import type { RelationshipTier } from "../relationship-system.js";

// ── Types ────────────────────────────────────────────────────────────

// PetVoice is imported from talk-types.ts — single source of truth
export type { PetVoice } from "./talk-types.js";
export type FragmentSlot = "opener" | "core" | "closer" | "interjection" | "qualifier";

export interface FragmentPool {
	readonly id: string;
	readonly slot: FragmentSlot;
	readonly filters: {
		readonly mood?: readonly AgentMood[];
		readonly domain?: readonly string[];
		readonly tier?: readonly RelationshipTier[];
		readonly petVoice?: readonly PetVoice[];
		readonly timeOfDay?: readonly string[];
	};
	readonly fragments: readonly string[];
}

export interface ComposeContext {
	readonly mood?: string;
	readonly domain?: string;
	readonly tier?: RelationshipTier;
	readonly petVoice?: PetVoice;
	readonly timeOfDay?: string;
}

// ── Pattern weights ──────────────────────────────────────────────────

interface Pattern {
	readonly slots: readonly FragmentSlot[];
	readonly weight: number;
	readonly join: string;
}

const PATTERNS: readonly Pattern[] = [
	{ slots: ["opener", "core"], weight: 40, join: " " },
	{ slots: ["core", "qualifier"], weight: 30, join: " " },
	{ slots: ["interjection", "core", "closer"], weight: 25, join: " " },
	{ slots: ["opener", "core", "closer"], weight: 5, join: " " },
];

// ── Composer ─────────────────────────────────────────────────────────

export class FragmentComposer {
	private readonly pools: readonly FragmentPool[];

	constructor(pools: readonly FragmentPool[]) {
		this.pools = pools;
	}

	compose(context: ComposeContext, avoid: readonly string[] = []): string {
		const pattern = this.pickPattern();
		const parts: string[] = [];
		for (const slot of pattern.slots) {
			const fragment = this.pickFragment(slot, context, avoid);
			if (fragment) parts.push(fragment);
		}
		return parts.join(pattern.join) || "...";
	}

	private pickPattern(): Pattern {
		const totalWeight = PATTERNS.reduce((sum, p) => sum + p.weight, 0);
		let roll = Math.random() * totalWeight;
		for (const p of PATTERNS) {
			roll -= p.weight;
			if (roll <= 0) return p;
		}
		return PATTERNS[PATTERNS.length - 1];
	}

	private pickFragment(slot: FragmentSlot, context: ComposeContext, avoid: readonly string[]): string | null {
		const eligible = this.pools.filter((p) => p.slot === slot && this.matchesFilters(p, context));
		const allFragments = eligible.flatMap((p) => [...p.fragments]);
		if (allFragments.length === 0) return null;

		const avoidSet = new Set(avoid);
		const filtered = allFragments.filter((f) => !avoidSet.has(f));
		const pool = filtered.length > 0 ? filtered : allFragments;
		return pool[Math.floor(Math.random() * pool.length)];
	}

	private matchesFilters(pool: FragmentPool, context: ComposeContext): boolean {
		const { filters } = pool;
		if (filters.mood && context.mood && !filters.mood.includes(context.mood as AgentMood)) return false;
		if (filters.domain && context.domain && !filters.domain.includes(context.domain)) return false;
		if (filters.tier && context.tier && !filters.tier.includes(context.tier)) return false;
		if (filters.petVoice && context.petVoice && !filters.petVoice.includes(context.petVoice)) return false;
		if (filters.timeOfDay && context.timeOfDay && !filters.timeOfDay.includes(context.timeOfDay)) return false;
		return true;
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/fragment-composer.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/fragment-composer.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/fragment-composer.test.ts"
git commit -m "feat(talk): add FragmentComposer engine for composable ambient phrases"
```

---

### Task 6: Tier Modifier Pools

**Files:**
- Create: `src/game/systems/talk/templates/tier-modifiers.ts`
- Test: `tests/game/systems/talk/tier-modifiers.test.ts`

- [ ] **Step 1: Write the tier modifiers test**

Create `tests/game/systems/talk/tier-modifiers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TIER_PREFIXES, TIER_SUFFIXES } from "../../../../src/game/systems/talk/templates/tier-modifiers.js";
import type { RelationshipTier } from "../../../../src/game/systems/relationship-system.js";

const TIERS: RelationshipTier[] = ["rival", "acquaintance", "colleague", "friend", "best-friend"];

describe("tier-modifiers", () => {
	it("every tier has at least 10 prefixes", () => {
		for (const tier of TIERS) {
			expect(TIER_PREFIXES[tier].length, `${tier} prefixes`).toBeGreaterThanOrEqual(10);
		}
	});

	it("every tier has at least 10 suffixes", () => {
		for (const tier of TIERS) {
			expect(TIER_SUFFIXES[tier].length, `${tier} suffixes`).toBeGreaterThanOrEqual(10);
		}
	});

	it("no empty strings in any pool", () => {
		for (const tier of TIERS) {
			for (const p of TIER_PREFIXES[tier]) expect(p.trim()).not.toBe("");
			for (const s of TIER_SUFFIXES[tier]) expect(s.trim()).not.toBe("");
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/tier-modifiers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement tier modifiers**

Create `src/game/systems/talk/templates/tier-modifiers.ts`:

```typescript
/**
 * tier-modifiers.ts — Relationship-tier prefix and suffix pools.
 *
 * These wrap existing phrases to add tone appropriate to the current
 * relationship tier between two agents. Applied with TIER_MODIFIER_CHANCE (15%).
 */

import type { RelationshipTier } from "../../relationship-system.js";

export const TIER_PREFIXES: Record<RelationshipTier, readonly string[]> = {
	rival: [
		"Oh great, {nearby_agent}'s here.",
		"Don't look now but...",
		"Speaking of bad ideas...",
		"Here we go again...",
		"Oh, it's you.",
		"Wonderful. Just wonderful.",
		"Of ALL the people...",
		"Oh sure, of course it's {nearby_agent}.",
		"What a surprise. Not.",
		"Ah yes, my favorite person.",
		"Deep breath...",
		"I was having a good day until...",
	],
	acquaintance: [
		"Hey, uh...",
		"So...",
		"Not sure if you're busy but...",
		"I don't mean to interrupt but...",
		"If you have a second...",
		"Sorry to bother you but...",
		"Quick thing...",
		"Not sure if this is relevant but...",
		"I was just thinking...",
		"Don't know if you noticed but...",
		"Random thought...",
		"Might be nothing but...",
	],
	colleague: [
		"Quick thought—",
		"Oh hey, good timing—",
		"You'd appreciate this—",
		"FYI—",
		"Heads up—",
		"Just noticed—",
		"Worth mentioning—",
		"Thought you should know—",
		"Between us—",
		"Speaking of which—",
		"Oh, related to what you said—",
		"This might interest you—",
	],
	friend: [
		"Okay you're gonna love this—",
		"Don't judge me but—",
		"Remember what I said about—",
		"You won't believe this—",
		"Be honest with me—",
		"I need your opinion on something—",
		"Okay so hear me out—",
		"Real talk—",
		"Between you and me—",
		"You know how I feel about—",
		"Tell me I'm not crazy—",
		"Only telling you this because—",
	],
	"best-friend": [
		"You already know what I'm going to say—",
		"Same wavelength—",
		"Tell me you see it too—",
		"Okay so—",
		"Read my mind—",
		"You and I both know—",
		"I don't even have to explain—",
		"We were just talking about this—",
		"Jinx—",
		"Finish my sentence—",
		"You feel it too right?",
		"I was literally about to say—",
	],
};

export const TIER_SUFFIXES: Record<RelationshipTier, readonly string[]> = {
	rival: [
		"...but what would I know",
		"...unlike SOME people",
		"...not naming names",
		"...but sure, what do YOU think",
		"...shocking, I know",
		"...take it or leave it",
		"...but hey, I'm just the person who's right",
		"...but who am I to say",
		"...unfortunately",
		"...not that anyone asked",
		"...for what it's worth. Which is a lot",
		"...but go off",
	],
	acquaintance: [
		"...anyway!",
		"...just a thought",
		"...no worries if not",
		"...totally optional",
		"...feel free to ignore that",
		"...or not, up to you",
		"...just throwing it out there",
		"...sorry if that's obvious",
		"...I could be wrong though",
		"...but what do I know, ha",
		"...don't mind me",
		"...if that makes sense",
	],
	colleague: [
		"...worth a look",
		"...what do you think?",
		"...you've probably seen this before",
		"...might be useful",
		"...let me know your thoughts",
		"...just flagging it",
		"...curious what you'd do",
		"...food for thought",
		"...on your radar?",
		"...something to consider",
		"...thought you'd want to know",
		"...keep me posted",
	],
	friend: [
		"...you owe me one",
		"...classic us",
		"...and that's why we work",
		"...don't pretend you're surprised",
		"...but you already knew that",
		"...we've been here before",
		"...and I'd do it again",
		"...you get me",
		"...our little secret",
		"...that's the deal",
		"...partners in crime",
		"...you know the drill",
	],
	"best-friend": [
		"...like that time with the deploy",
		"...you get it",
		"...us against the codebase",
		"...say no more",
		"...I knew you'd understand",
		"...that's our thing",
		"...wouldn't want anyone else here",
		"...we've survived worse",
		"...ride or die",
		"...always",
		"...you know what I mean",
		"...we don't even need to say it",
	],
};
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/tier-modifiers.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/tier-modifiers.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/tier-modifiers.test.ts"
git commit -m "feat(talk): add tier-driven prefix/suffix modifier pools (150 fragments)"
```

---

### Task 7: ConversationEngine Core

**Files:**
- Create: `src/game/systems/talk/conversation-engine.ts`
- Test: `tests/game/systems/talk/conversation-engine.test.ts`

- [ ] **Step 1: Write failing tests for ConversationEngine**

Create `tests/game/systems/talk/conversation-engine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConversationEngine } from "../../../../src/game/systems/talk/conversation-engine.js";
import type { ConversationScript } from "../../../../src/game/systems/talk/conversation-types.js";

const TEST_SCRIPT: ConversationScript = {
	id: "test-greeting",
	tierRange: ["acquaintance", "best-friend"],
	domainFilter: null,
	trigger: "proximity",
	weight: 10,
	cooldownMs: 0,
	tags: [],
	turns: [
		{ speaker: "A", text: "Hey {agentB}!", delayMs: 0, kind: "speech" },
		{ speaker: "B", text: "Hi {agentA}!", delayMs: 1000, kind: "speech" },
	],
};

describe("ConversationEngine", () => {
	let showBubble: ReturnType<typeof vi.fn>;
	let getTier: ReturnType<typeof vi.fn>;
	let silenceTalk: ReturnType<typeof vi.fn>;
	let recordConversation: ReturnType<typeof vi.fn>;
	let engine: ConversationEngine;

	beforeEach(() => {
		showBubble = vi.fn();
		getTier = vi.fn(() => "colleague");
		silenceTalk = vi.fn();
		recordConversation = vi.fn();
		engine = new ConversationEngine({
			showBubble,
			getTier,
			silenceTalk,
			recordConversation,
		});
	});

	it("constructs without error", () => {
		expect(engine).toBeDefined();
	});

	it("registerScripts adds scripts to the pool", () => {
		engine.registerScripts([TEST_SCRIPT]);
		expect(engine.scriptCount).toBe(1);
	});

	it("tryScript returns true when a matching script is found", () => {
		engine.registerScripts([TEST_SCRIPT]);
		const result = engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(result).toBe(true);
	});

	it("tryScript fires first turn immediately via showBubble", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(showBubble).toHaveBeenCalledWith("Atlas", "speech", "Hey Rex!");
	});

	it("tryScript locks participants", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(engine.isLocked("Atlas")).toBe(true);
		expect(engine.isLocked("Rex")).toBe(true);
	});

	it("tryScript silences both agents in talk engine", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(silenceTalk).toHaveBeenCalledWith("Atlas");
		expect(silenceTalk).toHaveBeenCalledWith("Rex");
	});

	it("tryScript returns false if both agents are locked", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		const result = engine.tryScript("Atlas", "Sage", "proximity", {
			domainA: "engineering",
			domainB: "product",
		});
		expect(result).toBe(false);
	});

	it("tryScript returns false when tier is out of range", () => {
		getTier.mockReturnValue("rival");
		engine.registerScripts([TEST_SCRIPT]);
		const result = engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(result).toBe(false);
	});

	it("update advances turns and unlocks after final turn", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		// First turn fired immediately; advance past second turn delay
		engine.update(1500);
		expect(showBubble).toHaveBeenCalledWith("Rex", "speech", "Hi Atlas!");
		expect(engine.isLocked("Atlas")).toBe(false);
		expect(engine.isLocked("Rex")).toBe(false);
	});

	it("update records conversation after script completes", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		engine.update(1500);
		expect(recordConversation).toHaveBeenCalledWith("Atlas", "Rex");
	});

	it("cooldown prevents same script from replaying too soon", () => {
		vi.useFakeTimers();
		try {
			const cooldownScript: ConversationScript = {
				...TEST_SCRIPT,
				cooldownMs: 60000,
			};
			engine.registerScripts([cooldownScript]);
			engine.tryScript("Atlas", "Rex", "proximity", {
				domainA: "engineering",
				domainB: "design",
			});
			engine.update(1500); // complete script
			// Still within cooldown window
			const result = engine.tryScript("Atlas", "Rex", "proximity", {
				domainA: "engineering",
				domainB: "design",
			});
			expect(result).toBe(false);
			// Advance past cooldown
			vi.advanceTimersByTime(60001);
			const result2 = engine.tryScript("Atlas", "Rex", "proximity", {
				domainA: "engineering",
				domainB: "design",
			});
			expect(result2).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/conversation-engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ConversationEngine**

Create `src/game/systems/talk/conversation-engine.ts`:

```typescript
/**
 * conversation-engine.ts — Multi-turn scripted conversation system.
 *
 * Selects and plays conversation scripts between agent pairs based on
 * relationship tier, domains, and trigger events. Locks participants
 * during playback to prevent ambient chatter overlap.
 *
 * Integration: The collected-action processor routes social actions here
 * before falling back to one-liner talk engine phrases.
 */

import type {
	ConversationScript, ConversationTrigger, ConversationTurn, RunningJoke,
} from "./conversation-types.js";
import type { RelationshipTier } from "../relationship-system.js";

// ── Tier ordering for range checks ──────────────────────────────────

const TIER_ORDER: Record<RelationshipTier, number> = {
	rival: 0,
	acquaintance: 1,
	colleague: 2,
	friend: 3,
	"best-friend": 4,
};

function tierInRange(tier: RelationshipTier, range: readonly [RelationshipTier, RelationshipTier]): boolean {
	const val = TIER_ORDER[tier];
	return val >= TIER_ORDER[range[0]] && val <= TIER_ORDER[range[1]];
}

// ── Variable interpolation ──────────────────────────────────────────

const VAR_PATTERN = /\{(\w+)\}/g;

function interpolate(text: string, vars: Record<string, string>): string {
	return text.replace(VAR_PATTERN, (_m, key: string) => vars[key] ?? `{${key}}`);
}

// ── Callbacks ───────────────────────────────────────────────────────

export interface ConversationEngineCallbacks {
	readonly showBubble: (agentName: string, kind: string, text: string) => void;
	readonly getTier: (a: string, b: string) => RelationshipTier;
	readonly silenceTalk: (agentName: string) => void;
	readonly recordConversation: (a: string, b: string) => void;
}

// ── Active conversation state ───────────────────────────────────────

interface ActiveConversation {
	readonly scriptId: string;
	readonly agentA: string;
	readonly agentB: string;
	readonly pet?: string;
	readonly vars: Record<string, string>;
	readonly turns: readonly ConversationTurn[];
	currentTurn: number;
	timer: number;
}

// ── Try context ─────────────────────────────────────────────────────

export interface TryScriptContext {
	readonly domainA: string;
	readonly domainB: string;
	readonly pet?: string;
}

// ── Engine ───────────────────────────────────────────────────────────

export class ConversationEngine {
	private readonly callbacks: ConversationEngineCallbacks;
	private readonly scripts: ConversationScript[] = [];
	private readonly jokes: RunningJoke[] = [];
	private readonly locked = new Set<string>();
	private readonly active: ActiveConversation[] = [];
	private readonly cooldowns = new Map<string, number>();

	constructor(callbacks: ConversationEngineCallbacks) {
		this.callbacks = callbacks;
	}

	get scriptCount(): number {
		return this.scripts.length + this.jokes.length;
	}

	registerScripts(scripts: readonly ConversationScript[]): void {
		this.scripts.push(...scripts);
	}

	registerJokes(jokes: readonly RunningJoke[]): void {
		this.jokes.push(...jokes);
	}

	isLocked(name: string): boolean {
		return this.locked.has(name);
	}

	tryScript(agentA: string, agentB: string, trigger: ConversationTrigger, ctx: TryScriptContext): boolean {
		if (this.locked.has(agentA) || this.locked.has(agentB)) return false;

		const tier = this.callbacks.getTier(agentA, agentB);
		const now = performance.now();

		const eligible = this.scripts.filter((s) => {
			if (s.trigger !== trigger) return false;
			if (!tierInRange(tier, s.tierRange)) return false;
			if (s.domainFilter) {
				const pair = [ctx.domainA, ctx.domainB].sort();
				const filterPair = [...s.domainFilter].sort();
				if (pair[0] !== filterPair[0] || pair[1] !== filterPair[1]) return false;
			}
			const lastUsed = this.cooldowns.get(s.id) ?? 0;
			if (now - lastUsed < s.cooldownMs) return false;
			return true;
		});

		if (eligible.length === 0) return false;

		const script = this.weightedPick(eligible);
		if (!script) return false;

		const vars: Record<string, string> = {
			agentA,
			agentB,
			domain_a: ctx.domainA,
			domain_b: ctx.domainB,
			pet: ctx.pet ?? "",
		};

		this.startScript(script, agentA, agentB, vars, ctx.pet);
		return true;
	}

	update(deltaMs: number): void {
		const completed: number[] = [];

		for (let i = 0; i < this.active.length; i++) {
			const conv = this.active[i];
			conv.timer += deltaMs;

			const turn = conv.turns[conv.currentTurn];
			if (!turn || conv.timer < turn.delayMs) continue;

			conv.timer = 0;
			const speaker = turn.speaker === "A" ? conv.agentA
				: turn.speaker === "B" ? conv.agentB
				: conv.pet ?? conv.agentA;
			const text = interpolate(turn.text, conv.vars);
			this.callbacks.showBubble(speaker, turn.kind, text);

			conv.currentTurn++;
			if (conv.currentTurn >= conv.turns.length) {
				completed.push(i);
			}
		}

		// Remove completed conversations in reverse order
		for (let i = completed.length - 1; i >= 0; i--) {
			const conv = this.active[completed[i]];
			this.locked.delete(conv.agentA);
			this.locked.delete(conv.agentB);
			if (conv.pet) this.locked.delete(conv.pet);
			this.callbacks.recordConversation(conv.agentA, conv.agentB);
			this.active.splice(completed[i], 1);
		}
	}

	private startScript(script: ConversationScript, agentA: string, agentB: string, vars: Record<string, string>, pet?: string): void {
		this.locked.add(agentA);
		this.locked.add(agentB);
		if (pet) this.locked.add(pet);

		this.callbacks.silenceTalk(agentA);
		this.callbacks.silenceTalk(agentB);

		this.cooldowns.set(script.id, performance.now());

		const firstTurn = script.turns[0];
		if (firstTurn && firstTurn.delayMs === 0) {
			const speaker = firstTurn.speaker === "A" ? agentA
				: firstTurn.speaker === "B" ? agentB
				: pet ?? agentA;
			this.callbacks.showBubble(speaker, firstTurn.kind, interpolate(firstTurn.text, vars));

			this.active.push({
				scriptId: script.id,
				agentA,
				agentB,
				pet,
				vars,
				turns: script.turns,
				currentTurn: 1,
				timer: 0,
			});
		} else {
			this.active.push({
				scriptId: script.id,
				agentA,
				agentB,
				pet,
				vars,
				turns: script.turns,
				currentTurn: 0,
				timer: 0,
			});
		}
	}

	private weightedPick(scripts: readonly ConversationScript[]): ConversationScript | undefined {
		const totalWeight = scripts.reduce((sum, s) => sum + s.weight, 0);
		let roll = Math.random() * totalWeight;
		for (const s of scripts) {
			roll -= s.weight;
			if (roll <= 0) return s;
		}
		return scripts[scripts.length - 1];
	}
}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/conversation-engine.test.ts`
Expected: PASS — all 10 tests green

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS — no regressions

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/conversation-engine.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/conversation-engine.test.ts"
git commit -m "feat(talk): add ConversationEngine for multi-turn scripted exchanges"
```

---

### Task 8: Integrate New Resolution Steps into TalkEngine

**Files:**
- Modify: `src/game/systems/talk/talk-engine.ts`
- Modify: `tests/game/systems/talk/talk-engine.test.ts`

- [ ] **Step 1: Write failing tests for tier-modified and composed phrase resolution**

Add to `tests/game/systems/talk/talk-engine.test.ts`:

```typescript
import { FragmentComposer, type FragmentPool } from "../../../../src/game/systems/talk/fragment-composer.js";
import { TIER_PREFIXES, TIER_SUFFIXES } from "../../../../src/game/systems/talk/templates/tier-modifiers.js";
import type { RelationshipTier } from "../../../../src/game/systems/relationship-system.js";

	it("accepts a FragmentComposer for composed phrase resolution", () => {
		const pool: FragmentPool = {
			id: "test", slot: "core", filters: {},
			fragments: ["test phrase"],
		};
		const composer = new FragmentComposer([pool]);
		const getTier = vi.fn((): RelationshipTier => "colleague");
		const engine2 = new TalkEngine({ showBubble, isIdle }, { composer, getTier });
		engine2.register("Atlas", "engineering", [], 10);
		// Should not throw
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/talk-engine.test.ts`
Expected: FAIL — TalkEngine constructor doesn't accept second argument

- [ ] **Step 3: Add optional enrichment deps to TalkEngine constructor**

In `src/game/systems/talk/talk-engine.ts`:

Add imports:
```typescript
import type { FragmentComposer, ComposeContext } from "./fragment-composer.js";
import { TIER_PREFIXES, TIER_SUFFIXES } from "./templates/tier-modifiers.js";
import type { RelationshipTier } from "../relationship-system.js";
```

Add new constants:
```typescript
const TIER_MODIFIER_CHANCE = 0.15;
const COMPOSE_CHANCE = 0.25;
```

Add optional deps interface:
```typescript
export interface TalkEngineEnrichment {
	readonly composer?: FragmentComposer;
	readonly getTier?: (a: string, b: string) => RelationshipTier;
}
```

Update constructor:
```typescript
	private readonly enrichment: TalkEngineEnrichment;

	constructor(callbacks: TalkEngineCallbacks, enrichment?: TalkEngineEnrichment) {
		this.callbacks = callbacks;
		this.enrichment = enrichment ?? {};
	}
```

Add `resolveTierPhrase` helper function (outside class, after existing resolve helpers).

**IMPORTANT:** `ChatterEntry` does not store the agent name (it's the map key). The helper needs the agent name passed explicitly so `getTier` receives two agent names (not a domain string).

```typescript
function resolveTierPhrase(
	agentName: string,
	entry: ChatterEntry,
	getTier: (a: string, b: string) => RelationshipTier,
): string | null {
	if (!entry.vars.nearby_agent || Math.random() >= TIER_MODIFIER_CHANCE) return null;
	const tier = getTier(agentName, entry.vars.nearby_agent);
	const prefixes = TIER_PREFIXES[tier];
	const suffixes = TIER_SUFFIXES[tier];
	if (!prefixes || !suffixes) return null;

	// Pick a base phrase first (domain or core)
	const base = resolveDomainPhrase(entry) ?? resolveCorePhrase(entry);
	if (!base) return null;

	// 50/50 prefix vs suffix
	if (Math.random() < 0.5) {
		const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
		return interpolate(prefix, entry.vars) + " " + base;
	}
	const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
	return base + " " + suffix;
}
```

Add `resolveComposedPhrase` helper function:
```typescript
function resolveComposedPhrase(
	entry: ChatterEntry,
	composer: FragmentComposer,
	getTier?: (a: string, b: string) => RelationshipTier,
): string | null {
	if (Math.random() >= COMPOSE_CHANCE) return null;
	const context: ComposeContext = {
		mood: entry.vars.mood || undefined,
		domain: entry.domain,
		tier: entry.vars.nearby_agent && getTier
			? getTier(entry.vars.nearby_agent, entry.domain)
			: undefined,
	};
	return composer.compose(context, entry.recentlyUsed);
}
```

Update `resolvePhrase` to accept `agentName` and pass it to tier resolution. Change the private method signature and its call site in `fireChatter`:

```typescript
	// In fireChatter, change: const phrase = this.resolvePhrase(entry);
	// To: const phrase = this.resolvePhrase(name, entry);

	private resolvePhrase(agentName: string, entry: ChatterEntry): string {
		return resolveActivatedPhrase(entry)
			?? resolveMoodPhrase(entry)
			?? (this.enrichment.getTier
				? resolveTierPhrase(agentName, entry, this.enrichment.getTier)
				: null)
			?? (this.enrichment.composer
				? resolveComposedPhrase(entry, this.enrichment.composer, this.enrichment.getTier)
				: null)
			?? resolveCrossoverPhrase(entry)
			?? resolvePersonalityPhrase(entry)
			?? resolveSocialPhrase(entry)
			?? resolveDomainPhrase(entry)
			?? resolveCorePhrase(entry)
			?? "...";
	}
```

Update the JSDoc comment at the top of the file to reflect the new 10-step priority order.

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/talk-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS — existing callers that don't pass enrichment are unaffected

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/talk-engine.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/talk-engine.test.ts"
git commit -m "feat(talk): integrate tier-modified and composed phrase resolution into TalkEngine"
```

---

## Chunk 2: Content — Pet Phrases, Conversation Scripts, Running Jokes, Fragment Pools

All the actual dialogue content. Each task creates one or more content files. These are pure data — no logic changes.

---

### Task 9: Pet Inner Monologue Phrases

**Files:**
- Create: `src/game/systems/talk/templates/pet-phrases.ts`
- Test: `tests/game/systems/talk/pet-phrases.test.ts`

- [ ] **Step 1: Write content validation test**

Create `tests/game/systems/talk/pet-phrases.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
	PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS,
} from "../../../../src/game/systems/talk/templates/pet-phrases.js";

describe("pet-phrases", () => {
	it("instinct pool has at least 50 fragments", () => {
		expect(PET_INSTINCT_FRAGMENTS.length).toBeGreaterThanOrEqual(50);
	});

	it("eloquent pool has at least 50 fragments", () => {
		expect(PET_ELOQUENT_FRAGMENTS.length).toBeGreaterThanOrEqual(50);
	});

	it("gremlin pool has at least 50 fragments", () => {
		expect(PET_GREMLIN_FRAGMENTS.length).toBeGreaterThanOrEqual(50);
	});

	it("no duplicate phrases within a pool", () => {
		for (const pool of [PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS]) {
			const unique = new Set(pool);
			expect(unique.size, "duplicates found").toBe(pool.length);
		}
	});

	it("no empty strings", () => {
		for (const pool of [PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS]) {
			for (const phrase of pool) {
				expect(phrase.trim()).not.toBe("");
			}
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/pet-phrases.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create pet-phrases.ts with 150+ fragments across 3 voice pools**

Create `src/game/systems/talk/templates/pet-phrases.ts` with:
- `PET_INSTINCT_FRAGMENTS`: 50+ phrases — broken grammar, pure animal brain stream. Examples: `"food. FOOD. why empty. sad."`, `"warm spot. mine. do not move."`, `"leg tired. floor good. sleep now."`, `"noise? NOISE. ...nothing. false alarm."`, `"belly full. world good. sleep?"`, `"tail. my tail. must catch tail."`, `"door open? DOOR OPEN. go? no. stay. ...go?"`, `"small bug. watch bug. bug gone. sad."`, etc.
- `PET_ELOQUENT_FRAGMENTS`: 50+ phrases — dry wit, detached observer. Examples: `"They've been staring at the glowing rectangle for 47 minutes."`, `"Another argument about architecture. Neither can open a door handle."`, `"I observe the ritual of the morning standup. No one is standing."`, `"The tall one types furiously. I suspect it changes nothing."`, etc.
- `PET_GREMLIN_FRAGMENTS`: 50+ phrases — chaotic, dramatic overreaction. Examples: `"MISSION: steal the clicky thing. OBSTACLE: attached to desk."`, `"CRISIS: the red dot has returned. Deploying counter-measures."`, `"TACTICAL ASSESSMENT: jump onto keyboard during important meeting."`, `"Operation Steal Snack is GO. Repeat: GO."`, etc.

- [ ] **Step 4: Run test**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/pet-phrases.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/pet-phrases.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/pet-phrases.test.ts"
git commit -m "feat(talk): add 150+ pet inner monologue fragments (instinct, eloquent, gremlin)"
```

---

### Task 10: Pet Reactive Phrases & Pet Phrase Chains

**Files:**
- Create: `src/game/systems/talk/templates/pet-reactive-phrases.ts`
- Create: `src/game/systems/talk/templates/pet-phrase-chains.ts`
- Test: `tests/game/systems/talk/pet-reactive-phrases.test.ts`

- [ ] **Step 1: Write validation tests**

Create `tests/game/systems/talk/pet-reactive-phrases.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PET_REACTIVE_PHRASES } from "../../../../src/game/systems/talk/templates/pet-reactive-phrases.js";
import { PET_PHRASE_CHAINS } from "../../../../src/game/systems/talk/templates/pet-phrase-chains.js";

const PET_TRIGGERS = [
	"pet-hungry", "pet-sleepy", "pet-bored", "pet-startled",
	"pet-affectionate", "pet-jealous", "pet-zoomies",
] as const;

describe("pet-reactive-phrases", () => {
	it("every pet trigger has at least 8 phrases", () => {
		for (const trigger of PET_TRIGGERS) {
			expect(PET_REACTIVE_PHRASES[trigger].length, trigger).toBeGreaterThanOrEqual(8);
		}
	});

	it("all phrases have weight > 0", () => {
		for (const trigger of PET_TRIGGERS) {
			for (const t of PET_REACTIVE_PHRASES[trigger]) {
				expect(t.weight).toBeGreaterThan(0);
			}
		}
	});
});

describe("pet-phrase-chains", () => {
	it("has at least 15 chains", () => {
		expect(PET_PHRASE_CHAINS.length).toBeGreaterThanOrEqual(15);
	});

	it("each chain has at least 2 steps", () => {
		for (const chain of PET_PHRASE_CHAINS) {
			expect(chain.steps.length, chain.id).toBeGreaterThanOrEqual(2);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Create pet-reactive-phrases.ts**

Create `src/game/systems/talk/templates/pet-reactive-phrases.ts` with `PET_REACTIVE_PHRASES` — a record mapping each pet trigger to 8-10 `WeightedTemplate` entries. The phrases should match the voice modes: hungry phrases are instinct-voice, bored phrases are gremlin-voice, etc.

- [ ] **Step 4: Create pet-phrase-chains.ts**

Create `src/game/systems/talk/templates/pet-phrase-chains.ts` with `PET_PHRASE_CHAINS` — 15-20 `PhraseChain` entries. Examples:
- Bug investigation (insect): hunt → pounce → confusion
- Code judging (eloquent): observe → assess → verdict
- Nap cycle: sleep → wake → assess → sleep again
- Cursor hunt: spot → stalk → pounce → miss → dignity recovery
- Keyboard walk: approach → step → produce output → flee

- [ ] **Step 5: Run tests**

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/pet-reactive-phrases.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/pet-phrase-chains.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/pet-reactive-phrases.test.ts"
git commit -m "feat(talk): add pet reactive phrases (70+) and pet phrase chains (20)"
```

---

### Task 11: Conversation Scripts — Rival & Acquaintance Tiers

**Files:**
- Create: `src/game/systems/talk/templates/conversation-scripts-rival.ts`
- Create: `src/game/systems/talk/templates/conversation-scripts-acquaintance.ts`
- Test: `tests/game/systems/talk/conversation-scripts.test.ts`

- [ ] **Step 1: Write validation test framework**

Create `tests/game/systems/talk/conversation-scripts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { ConversationScript } from "../../../../src/game/systems/talk/conversation-types.js";

/**
 * Shared validation for any script collection.
 * IMPORTANT: Call this inside an explicit describe() block at the top level,
 * NOT as a standalone function. This registers it() calls directly into the
 * enclosing describe scope, which is reliable in Vitest's collection phase.
 */
export function validateScripts(scripts: readonly ConversationScript[]): void {
	it("has at least 10 scripts", () => {
		expect(scripts.length).toBeGreaterThanOrEqual(10);
	});

	it("all scripts have unique IDs", () => {
		const ids = scripts.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all scripts have at least 2 turns", () => {
		for (const s of scripts) {
			expect(s.turns.length, s.id).toBeGreaterThanOrEqual(2);
		}
	});

	it("all scripts have valid tier ranges", () => {
		for (const s of scripts) {
			expect(s.tierRange).toHaveLength(2);
		}
	});

	it("all scripts have positive weight", () => {
		for (const s of scripts) {
			expect(s.weight, s.id).toBeGreaterThan(0);
		}
	});
}
```

- [ ] **Step 2: Add rival and acquaintance script tests**

Append to the same file:

```typescript
import { RIVAL_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-rival.js";
import { ACQUAINTANCE_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-acquaintance.js";

describe("rival scripts", () => { validateScripts(RIVAL_SCRIPTS); });
describe("acquaintance scripts", () => { validateScripts(ACQUAINTANCE_SCRIPTS); });
```

- [ ] **Step 3: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 4: Create conversation-scripts-rival.ts**

25 scripts covering: professional tension (architecture disagreements, code review conflicts), sitcom rivalry (petty one-upmanship, performative outrage), passive-aggressive exchanges. Each script has 2-4 turns with delays.

- [ ] **Step 5: Create conversation-scripts-acquaintance.ts**

20 scripts covering: awkward small talk, surface-level politeness, warming-up exchanges, first real conversations. Each 2-3 turns.

- [ ] **Step 6: Run tests**

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/conversation-scripts-rival.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/conversation-scripts-acquaintance.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/conversation-scripts.test.ts"
git commit -m "feat(talk): add rival (25) and acquaintance (20) conversation scripts"
```

---

### Task 12: Conversation Scripts — Colleague, Friend, Best-Friend Tiers

**Files:**
- Create: `src/game/systems/talk/templates/conversation-scripts-colleague.ts`
- Create: `src/game/systems/talk/templates/conversation-scripts-friend.ts`
- Create: `src/game/systems/talk/templates/conversation-scripts-bestfriend.ts`
- Modify: `tests/game/systems/talk/conversation-scripts.test.ts`

- [ ] **Step 1: Add imports and validation calls to test file**

```typescript
import { COLLEAGUE_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-colleague.js";
import { FRIEND_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-friend.js";
import { BESTFRIEND_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-bestfriend.js";

describe("colleague scripts", () => { validateScripts(COLLEAGUE_SCRIPTS); });
describe("friend scripts", () => { validateScripts(FRIEND_SCRIPTS); });
describe("best-friend scripts", () => { validateScripts(BESTFRIEND_SCRIPTS); });
```

- [ ] **Step 2: Create the three script files**

- `conversation-scripts-colleague.ts`: 25 scripts — professional warmth, collaborative problem solving, sharing tips, light humor
- `conversation-scripts-friend.ts`: 30 scripts — inside jokes, genuine concern, teasing, casual deep talk, gossip
- `conversation-scripts-bestfriend.ts`: 25 scripts — finishing sentences, defending each other, shared history references, deep trust moments

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/conversation-scripts-colleague.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/conversation-scripts-friend.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/conversation-scripts-bestfriend.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/conversation-scripts.test.ts"
git commit -m "feat(talk): add colleague (25), friend (30), best-friend (25) conversation scripts"
```

---

### Task 13: Gossip & Drama Scripts

**Files:**
- Create: `src/game/systems/talk/templates/conversation-scripts-gossip.ts`
- Create: `src/game/systems/talk/templates/conversation-scripts-drama.ts`
- Modify: `tests/game/systems/talk/conversation-scripts.test.ts`

- [ ] **Step 1: Add validation calls**

```typescript
import { GOSSIP_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-gossip.js";
import { DRAMA_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-drama.js";

describe("gossip scripts", () => { validateScripts(GOSSIP_SCRIPTS); });
describe("drama scripts", () => { validateScripts(DRAMA_SCRIPTS); });
```

- [ ] **Step 2: Create gossip scripts**

20 scripts with `trigger: "gossip"` — three-agent gossip where `{agentC}` is the subject. Includes positive gossip ("Have you noticed {agentC} has been killing it lately?") and negative gossip ("Is it just me or has {agentC} been… off?").

- [ ] **Step 3: Create drama scripts**

15 scripts with `trigger: "tier-change"` — soap opera arcs for tier transitions. Reluctant truces, bonding moments, drifting apart, betrayal scenes.

- [ ] **Step 4: Run tests**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/conversation-scripts-gossip.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/conversation-scripts-drama.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/conversation-scripts.test.ts"
git commit -m "feat(talk): add gossip (20) and drama/tier-transition (15) conversation scripts"
```

---

### Task 14: Pet Catalyst Scripts

**Files:**
- Create: `src/game/systems/talk/templates/conversation-scripts-pet.ts`
- Modify: `tests/game/systems/talk/conversation-scripts.test.ts`

- [ ] **Step 1: Add validation**

```typescript
import { PET_CATALYST_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-pet.js";

describe("pet catalyst scripts", () => { validateScripts(PET_CATALYST_SCRIPTS); });
```

- [ ] **Step 2: Create pet catalyst scripts**

25 scripts with `trigger: "pet-catalyst"` covering all 6 catalyst types: DragToy, SitBetween, BringGift, StealSpotlight, ComfortSadAgent, PickSide. Each script uses the `"pet"` speaker role for pet thought bubbles.

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/conversation-scripts-pet.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/conversation-scripts.test.ts"
git commit -m "feat(talk): add 25 pet catalyst conversation scripts"
```

---

### Task 15: Running Jokes

**Files:**
- Create: `src/game/systems/talk/templates/running-jokes.ts`
- Test: `tests/game/systems/talk/running-jokes.test.ts`

- [ ] **Step 1: Write validation test**

Create `tests/game/systems/talk/running-jokes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { RUNNING_JOKES } from "../../../../src/game/systems/talk/templates/running-jokes.js";

describe("running-jokes", () => {
	it("has at least 12 jokes", () => {
		expect(RUNNING_JOKES.length).toBeGreaterThanOrEqual(12);
	});

	it("all jokes have unique IDs prefixed with joke:", () => {
		const ids = RUNNING_JOKES.map((j) => j.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toMatch(/^joke:/);
		}
	});

	it("all jokes have at least 2 variants", () => {
		for (const joke of RUNNING_JOKES) {
			expect(joke.variants.length, joke.id).toBeGreaterThanOrEqual(2);
		}
	});

	it("maxEscalation does not exceed variants length", () => {
		for (const joke of RUNNING_JOKES) {
			expect(joke.maxEscalation, joke.id).toBeLessThanOrEqual(joke.variants.length);
			expect(joke.maxEscalation, joke.id).toBeGreaterThan(0);
		}
	});

	it("all jokes have at least 1 callback line", () => {
		for (const joke of RUNNING_JOKES) {
			expect(joke.callbackLines.length, joke.id).toBeGreaterThanOrEqual(1);
		}
	});

	it("all jokes include running-joke tag", () => {
		for (const joke of RUNNING_JOKES) {
			expect(joke.tags, joke.id).toContain("running-joke");
		}
	});
});
```

- [ ] **Step 2: Create running-jokes.ts**

15 `RunningJoke` definitions (spec Section 6.3) — each with 3-5 `variants` (escalation levels) and 2-3 `callbackLines`. See spec for the full list of joke concepts.

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/running-jokes.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/running-jokes.test.ts"
git commit -m "feat(talk): add 15 running jokes with escalation variants and callbacks"
```

---

### Task 16: Composable Fragment Pools

**Files:**
- Create: `src/game/systems/talk/templates/fragment-pools.ts`
- Test: `tests/game/systems/talk/fragment-pools.test.ts`

- [ ] **Step 1: Write validation test**

Create `tests/game/systems/talk/fragment-pools.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ALL_FRAGMENT_POOLS } from "../../../../src/game/systems/talk/templates/fragment-pools.js";

describe("fragment-pools", () => {
	it("has at least 15 pools", () => {
		expect(ALL_FRAGMENT_POOLS.length).toBeGreaterThanOrEqual(15);
	});

	it("all pools have unique IDs", () => {
		const ids = ALL_FRAGMENT_POOLS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("covers all 5 slot types", () => {
		const slots = new Set(ALL_FRAGMENT_POOLS.map((p) => p.slot));
		expect(slots).toContain("opener");
		expect(slots).toContain("core");
		expect(slots).toContain("closer");
		expect(slots).toContain("qualifier");
		expect(slots).toContain("interjection");
	});

	it("opener pools have at least 60 total fragments", () => {
		const count = ALL_FRAGMENT_POOLS
			.filter((p) => p.slot === "opener")
			.reduce((sum, p) => sum + p.fragments.length, 0);
		expect(count).toBeGreaterThanOrEqual(60);
	});

	it("core pools have at least 200 total fragments", () => {
		const count = ALL_FRAGMENT_POOLS
			.filter((p) => p.slot === "core")
			.reduce((sum, p) => sum + p.fragments.length, 0);
		expect(count).toBeGreaterThanOrEqual(200);
	});

	it("closer pools have at least 80 total fragments", () => {
		const count = ALL_FRAGMENT_POOLS
			.filter((p) => p.slot === "closer")
			.reduce((sum, p) => sum + p.fragments.length, 0);
		expect(count).toBeGreaterThanOrEqual(80);
	});

	it("no empty fragments in any pool", () => {
		for (const pool of ALL_FRAGMENT_POOLS) {
			for (const f of pool.fragments) {
				expect(f.trim(), `empty in ${pool.id}`).not.toBe("");
			}
		}
	});
});
```

- [ ] **Step 2: Create fragment-pools.ts**

Export `ALL_FRAGMENT_POOLS: readonly FragmentPool[]` containing:
- **Openers** (60+): mood-filtered intros across neutral/excited/tired/frustrated moods
- **Core observations** (200+): domain-filtered observations for engineering, design, product, quality, operations, management + general-purpose
- **Closers** (80+): mood-filtered exits
- **Qualifiers** (60+): universal tone modifiers
- **Interjections** (40+): attention-getters

Total: ~500 fragments across 15+ pools.

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/fragment-pools.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/talk/fragment-pools.test.ts"
git commit -m "feat(talk): add 500+ composable fragment pools (openers, cores, closers, qualifiers, interjections)"
```

---

## Chunk 3: Integration — Wire Everything Together

Connect the new engines and content to the existing game loop.

---

### Task 17: Update Template Registry (index.ts)

**Files:**
- Modify: `src/game/systems/talk/templates/index.ts`

- [ ] **Step 1: Add exports for all new template sets**

In `src/game/systems/talk/templates/index.ts`, add after existing exports:

```typescript
// Conversation scripts
export { RIVAL_SCRIPTS } from "./conversation-scripts-rival.js";
export { ACQUAINTANCE_SCRIPTS } from "./conversation-scripts-acquaintance.js";
export { COLLEAGUE_SCRIPTS } from "./conversation-scripts-colleague.js";
export { FRIEND_SCRIPTS } from "./conversation-scripts-friend.js";
export { BESTFRIEND_SCRIPTS } from "./conversation-scripts-bestfriend.js";
export { GOSSIP_SCRIPTS } from "./conversation-scripts-gossip.js";
export { DRAMA_SCRIPTS } from "./conversation-scripts-drama.js";
export { PET_CATALYST_SCRIPTS } from "./conversation-scripts-pet.js";

// Running jokes
export { RUNNING_JOKES } from "./running-jokes.js";

// Pet phrases
export { PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS } from "./pet-phrases.js";
export { PET_REACTIVE_PHRASES } from "./pet-reactive-phrases.js";
export { PET_PHRASE_CHAINS } from "./pet-phrase-chains.js";

// Composable fragments
export { ALL_FRAGMENT_POOLS } from "./fragment-pools.js";

// Tier modifiers
export { TIER_PREFIXES, TIER_SUFFIXES } from "./tier-modifiers.js";
```

- [ ] **Step 2: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/index.ts"
git commit -m "feat(talk): register all new template sets in template index"
```

---

### Task 18: Wire ConversationEngine into Game Loop

**Files:**
- Modify: `src/game/engine-simulation.ts` (the action processor in `tickBehaviorTree` and the `tickSocial` function)

- [ ] **Step 1: Understand the integration point**

The action processor at `engine-simulation.ts:382-394` processes BT collected actions. Currently, `{ type: "speaking" }` actions show a bubble. We need to:

1. Add `ConversationEngine` to the `EngineContext.systems` (or a local variable initialized in engine setup)
2. In `tickBehaviorTree`, when processing `{ type: "speaking", data: { source: "social" } }` actions, try `conversationEngine.tryScript()` first
3. In `tickSocial`, call `conversationEngine.update(deltaMs)` to advance active conversations

**Note:** The exact integration depends on how `EngineContext` is structured. Read `engine.ts` and the context type to determine the correct injection point. The ConversationEngine instance should be created during engine initialization with callbacks that delegate to `sys.bubble.showBubble`, `sys.relationship.getTier`, `sys.talk.silence`, and `sys.relationship.recordConversation`.

- [ ] **Step 2: Modify Socialize() BT action to emit social metadata**

**CRITICAL:** The current `Socialize()` action in `bt-agent.ts` only collects `{ type: "speaking", data: { text } }`. The action processor needs `source`, `nearbyAgent`, `domain`, and `nearbyDomain` to route through ConversationEngine. Find the `Socialize()` function (likely in `bt-agent.ts` or the social subtree) and update the collected action to include these fields:

```typescript
collect("speaking", {
	text: phrase,
	source: "social",
	nearbyAgent: context.nearbyAgent,         // the other agent's name
	domain: context.domain,                    // this agent's domain
	nearbyDomain: context.nearbyAgentDomain,   // the other agent's domain
});
```

Read the actual `Socialize` implementation to determine the correct field names. The key requirement is that the action data includes `source: "social"` and the nearby agent's name and domain so the action processor can route to ConversationEngine.

- [ ] **Step 3: Add ConversationEngine to engine initialization**

This step requires reading the engine setup code to find where systems are created. Add `ConversationEngine` creation alongside other systems, register all script collections, and store the instance on the systems object.

- [ ] **Step 4: Route social collected actions through ConversationEngine**

In `tickBehaviorTree`, modify the action processing loop:

```typescript
	} else if (action.type === "speaking") {
		const source = String(action.data.source ?? "");
		const text = String(action.data.text ?? "");
		if (source === "social" && action.data.nearbyAgent) {
			// Try conversation script first
			const tried = sys.conversation.tryScript(
				action.agentName,
				String(action.data.nearbyAgent),
				"proximity",
				{
					domainA: String(action.data.domain ?? ""),
					domainB: String(action.data.nearbyDomain ?? ""),
				},
			);
			if (!tried && text) {
				sys.bubble.showBubble(action.agentName, "speech", text, ctx.engine.currentScene, ctx.lookups.findAgentActor, 4000);
			}
		} else if (text) {
			sys.bubble.showBubble(action.agentName, "speech", text, ctx.engine.currentScene, ctx.lookups.findAgentActor, 4000);
		}
	}
```

- [ ] **Step 5: Add ConversationEngine.update() to tickSocial**

In `tickSocial`, add after the talk engine update:

```typescript
	runTimedGameSystem(ctx, "conversation", () => {
		sys.conversation.update(state.deltaMs);
	});
```

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-agent.ts"
git commit -m "feat(talk): wire ConversationEngine into game loop action processing"
```

---

### Task 19: Wire FragmentComposer into TalkEngine Setup

**Files:**
- Modify: wherever TalkEngine is instantiated (likely `engine.ts` or an engine setup file)

- [ ] **Step 1: Find TalkEngine instantiation**

Search for `new TalkEngine(` in the codebase to find where it's created.

- [ ] **Step 2: Pass enrichment deps**

Update the TalkEngine constructor call to include the FragmentComposer and relationship system:

```typescript
const composer = new FragmentComposer(ALL_FRAGMENT_POOLS);
const talkEngine = new TalkEngine(callbacks, {
	composer,
	getTier: (a, b) => relationshipSystem.getTier(a, b),
});
```

- [ ] **Step 3: Register pet phrase chains in the PHRASE_CHAINS array**

Import `PET_PHRASE_CHAINS` and append them to the phrase chains registry.

- [ ] **Step 4: Populate pet reactive trigger arrays**

Import `PET_REACTIVE_PHRASES` and merge into `REACTIVE_TEMPLATES`:

```typescript
for (const [trigger, phrases] of Object.entries(PET_REACTIVE_PHRASES)) {
	const existing = REACTIVE_TEMPLATES[trigger as ReactiveTrigger];
	if (existing && Array.isArray(existing)) {
		(existing as WeightedTemplate[]).push(...phrases);
	}
}
```

Or alternatively, populate the empty arrays added in Task 4 at module level.

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/"
git commit -m "feat(talk): wire FragmentComposer and pet content into TalkEngine"
```

---

### Task 20: Pet Catalyst BT Actions

**Files:**
- Modify: `src/game/brain/behavior-tree/pet-bt.ts`
- Modify: `tests/game/brain/behavior-tree/pet-bt.test.ts`

- [ ] **Step 1: Write tests for new pet catalyst conditions and actions**

Add to `tests/game/brain/behavior-tree/pet-bt.test.ts`:

```typescript
	it("DragToy collects pet-drag-toy action", () => {
		const { agent } = createPetBT("cat-whiskers", 0.3, 100, 2);
		// Set up context for catalyst
		(agent.context as any).nearbyAgentCount = 2;
		const result = agent.DragToy();
		expect(agent.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-drag-toy" }),
		);
	});

	it("ComfortSadAgent collects pet-comfort action", () => {
		const { agent } = createPetBT("cat-whiskers", 0.3, 100, 2);
		(agent.context as any).nearbyAgentMorale = 20;
		const result = agent.ComfortSadAgent();
		expect(agent.collectedActions).toContainEqual(
			expect.objectContaining({ type: "pet-comfort" }),
		);
	});
```

- [ ] **Step 2: Add 6 catalyst actions to PetBTObject and implementation**

In `pet-bt.ts`:

Add to `PetBTContext`:
```typescript
	nearbyAgentCount?: number;
	nearbyAgents?: string[];
```

Add to `PetBTObject`:
```typescript
	HasNearbyAgents(): boolean;
	HasSadNearbyAgent(): boolean;
	DragToy(): State;
	SitBetween(): State;
	BringGift(): State;
	StealSpotlight(): State;
	ComfortSadAgent(): State;
	PickSide(): State;
```

Add conditions and action implementations that collect appropriate action types.

Add catalyst subtree to `PET_MASTER_MDSL` as a low-priority branch before the idle fallback:

```
		sequence {
			condition [HasNearbyAgents]
			selector {
				sequence {
					condition [HasSadNearbyAgent]
					action [ComfortSadAgent]
				}
				action [DragToy]
				action [BringGift]
				action [SitBetween]
			}
		}
```

- [ ] **Step 3: Run pet-bt tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/behavior-tree/pet-bt.test.ts`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/pet-bt.ts" \
       "01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/pet-bt.test.ts"
git commit -m "feat(pet-bt): add 6 social catalyst actions (DragToy, SitBetween, BringGift, StealSpotlight, ComfortSadAgent, PickSide)"
```

---

### Task 21: Pet Catalyst Action Processing in Engine

**Files:**
- Modify: `src/game/engine-simulation.ts` (in `tickPets` or the action processor)

- [ ] **Step 1: Add pet BT collected action iteration to tickPets**

**CRITICAL:** Pet BT `collectedActions` are NOT automatically iterated anywhere in `engine-simulation.ts`. Agent BT actions go through `sys.bt.update()` in `tickBehaviorTree`, but pet actors are separate. The pet BT's `collectedActions` array must be explicitly drained after each `pet.updateBehavior()` call.

In `tickPets`, after `pet.updateBehavior(ctx.state.deltaMs)`, add action processing:

```typescript
// Drain pet BT collected actions
const petBt = pet.getBT?.();  // or however the PetActor exposes its BT
if (petBt) {
	for (const action of petBt.agent.collectedActions) {
		const PET_CATALYST_TYPES = new Set([
			"pet-drag-toy", "pet-comfort", "pet-sit-between",
			"pet-bring-gift", "pet-steal-spotlight", "pet-pick-side",
		]);
		if (PET_CATALYST_TYPES.has(action.type)) {
			// Find nearby agents in same room
			const nearbyAgents = sys.needs.getAgentNames().filter((n) =>
				sys.registry.getEntityRoom(n) === petRoom,
			);
			if (nearbyAgents.length >= 2) {
				sys.conversation.tryScript(nearbyAgents[0], nearbyAgents[1], "pet-catalyst", {
					domainA: /* look up agent domain */,
					domainB: /* look up agent domain */,
					pet: pet.name,
				});
			}
		}
	}
	// Clear the collected actions for next tick
	petBt.agent.collectedActions.length = 0;
}
```

**Note:** Read `PetActor` to determine the correct API for accessing the pet's BT and its `collectedActions`. If `PetActor.updateBehavior()` internally ticks the BT, the actions will be populated after that call. The array must be cleared after processing to avoid re-processing on the next tick.

- [ ] **Step 2: Wire petAffinity updates into existing pet proximity reactions**

In `checkPetProximityReactions`, add after the existing needs effect application:

```typescript
sys.relationship.changePetAffinity(agentName, 1); // +1 per proximity interaction
```

In `checkPetShareInteraction`, add:

```typescript
sys.relationship.changePetAffinity(agentName, 3); // +3 for sharing food
```

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(engine): process pet catalyst actions and wire petAffinity updates"
```

---

### Task 22: Register Pets in TalkEngine

**Files:**
- Modify: wherever pets are initialized in the engine (likely `engine-lifecycle.ts` or `engine.ts`)

- [ ] **Step 1: Find pet initialization code**

Search for where `PetActor` instances are created and registered with the engine.

- [ ] **Step 2: Register each pet with the TalkEngine**

After pet creation:

```typescript
talkEngine.register(pet.name, "pet", [], 5);
talkEngine.updateVars(pet.name, {
	pet_name: pet.displayName,
	pet_type: pet.petType,
	hunger_level: String(pet.context.hunger),
});
```

- [ ] **Step 3: Update pet vars each tick**

In `tickPets` or `tickSocial`, update pet talk vars based on current state:

```typescript
for (const pet of ctx.pets) {
	sys.talk.updateVars(pet.name, {
		hunger_level: String(pet.getHunger()),
		nearby_agent_mood: /* nearest agent's mood */,
	});
}
```

- [ ] **Step 4: Run full test suite**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/"
git commit -m "feat(talk): register pets in TalkEngine with voice-switching vars"
```

---

### Task 23: Final Integration Test & Full Suite Verification

**Files:**
- Test: full suite

- [ ] **Step 1: Run the full plugin test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS — all existing + new tests green

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: No errors

- [ ] **Step 4: Build**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git commit -m "fix(talk): address lint/type issues from dialogue expansion integration"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| **Chunk 1: Foundation** | Tasks 1-8 | Types, RelationshipSystem extensions, FragmentComposer, ConversationEngine, tier modifiers, TalkEngine integration |
| **Chunk 2: Content** | Tasks 9-16 | 150 pet phrases, 70 pet reactive phrases, 20 pet chains, 185 conversation scripts, 15 running jokes, 500 fragment pools |
| **Chunk 3: Integration** | Tasks 17-23 | Template registry, game loop wiring, pet BT catalyst actions, pet TalkEngine registration, full verification |

**Total: 23 tasks across 3 chunks.**
