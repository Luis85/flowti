# Living World Phase C — Social Depth Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the social depth layer — evolving relationships with affinity tiers, an opinion system that drives agreement/bickering, and tier-specific conversation templates that make agent interactions feel personal.

**Architecture:** `RelationshipSystem` tracks pairwise affinity (-100 to 100) across 5 tiers (Rival → Best Friend). `OpinionTopics` assigns 2-3 opinions per agent, driving agreement bonuses and bicker chances. Tier-specific template pools (bickering, inside jokes, finishing sentences) are selected by the relationship tier during conversations. The engine wires relationship events inside existing SocialSystem callbacks. Full persistence to `.flowti/var/world-relationships.json`.

**Tech Stack:** TypeScript, vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-20-living-world-design.md` (System 5)

**Depends on:** Phase A (MemorySystem) + Phase B (QuirkSystem) — already on master.

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/game/data/opinion-topics.ts` | 15 opinion topics with sides A/B, assignment function |
| `src/game/data/relationship-templates.ts` | Tier-specific conversation templates (bicker, inside joke, best friend, colleague) |
| `src/game/systems/relationship-system.ts` | Affinity tracking, tier computation, opinion clash detection, persistence |
| `tests/game/data/opinion-topics.test.ts` | Opinion topic validation + assignment tests |
| `tests/game/systems/relationship-system.test.ts` | Affinity changes, tier transitions, bicker detection, persistence tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/game/data/world-config.ts` | Add RelationshipsConfig to WorldConfig interface + defaults |
| `src/game/engine.ts` | Wire RelationshipSystem into social callbacks, cycle-end decay, persistence |
| `src/game/store/dashboard-store.ts` | Expose relationship data for UI |
| `tests/game/engine.test.ts` | Add mocks for RelationshipSystem |

---

## Chunk 1: Opinion Topics + Relationship Templates

### Task 1: Opinion topics data

**Files:**
- Create: `src/game/data/opinion-topics.ts`
- Create: `tests/game/data/opinion-topics.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { OPINION_TOPICS, assignOpinions, checkOpinionClash } from "../../../src/game/data/opinion-topics.js";

describe("opinion-topics", () => {
	it("has 15 topics", () => {
		expect(OPINION_TOPICS).toHaveLength(15);
	});

	it("every topic has unique id, sideA, sideB", () => {
		const ids = OPINION_TOPICS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const t of OPINION_TOPICS) {
			expect(t.sideA).toBeTruthy();
			expect(t.sideB).toBeTruthy();
			expect(t.sideA).not.toBe(t.sideB);
		}
	});

	it("assignOpinions returns 2-3 opinions", () => {
		const opinions = assignOpinions();
		expect(opinions.length).toBeGreaterThanOrEqual(2);
		expect(opinions.length).toBeLessThanOrEqual(3);
	});

	it("assignOpinions returns opinions with valid topic ids", () => {
		const opinions = assignOpinions();
		const validIds = new Set(OPINION_TOPICS.map((t) => t.id));
		for (const o of opinions) {
			expect(validIds.has(o.topic)).toBe(true);
			expect(o.side === "A" || o.side === "B").toBe(true);
		}
	});

	it("checkOpinionClash detects opposing opinions", () => {
		const a = [{ topic: "tabs-vs-spaces", side: "A" as const }];
		const b = [{ topic: "tabs-vs-spaces", side: "B" as const }];
		expect(checkOpinionClash(a, b)).toBe(true);
	});

	it("checkOpinionClash returns false for same side", () => {
		const a = [{ topic: "tabs-vs-spaces", side: "A" as const }];
		const b = [{ topic: "tabs-vs-spaces", side: "A" as const }];
		expect(checkOpinionClash(a, b)).toBe(false);
	});

	it("checkOpinionClash returns false for no shared topics", () => {
		const a = [{ topic: "tabs-vs-spaces", side: "A" as const }];
		const b = [{ topic: "coffee-vs-tea", side: "B" as const }];
		expect(checkOpinionClash(a, b)).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/data/opinion-topics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement opinion-topics.ts**

```typescript
/**
 * opinion-topics.ts — 15 debate topics agents hold opinions on.
 *
 * Each agent gets 2-3 opinions assigned at registration. When two agents
 * share a topic but hold opposing sides, conversations may trigger bickering.
 * Same-side opinions grant an affinity bonus on discovery.
 */

export interface OpinionTopic {
	readonly id: string;
	readonly sideA: string;
	readonly sideB: string;
}

export interface AgentOpinion {
	readonly topic: string;
	readonly side: "A" | "B";
}

export const OPINION_TOPICS: readonly OpinionTopic[] = [
	{ id: "tabs-vs-spaces",           sideA: "Tabs",           sideB: "Spaces" },
	{ id: "tdd-vs-write-after",       sideA: "TDD",            sideB: "Write after" },
	{ id: "react-vs-svelte",          sideA: "React",          sideB: "Svelte" },
	{ id: "vim-vs-vscode",            sideA: "Vim",            sideB: "VS Code" },
	{ id: "dark-vs-light-mode",       sideA: "Dark mode",      sideB: "Light mode" },
	{ id: "meetings-vs-async",        sideA: "Meetings",       sideB: "Async" },
	{ id: "monolith-vs-microservices", sideA: "Monolith",      sideB: "Microservices" },
	{ id: "coffee-vs-tea",            sideA: "Coffee",         sideB: "Tea" },
	{ id: "early-vs-late",            sideA: "Early bird",     sideB: "Night owl" },
	{ id: "docs-vs-code-speaks",      sideA: "Write docs",     sideB: "Code speaks" },
	{ id: "rebase-vs-merge",          sideA: "Rebase",         sideB: "Merge" },
	{ id: "types-vs-dynamic",         sideA: "Static types",   sideB: "Dynamic" },
	{ id: "css-vs-tailwind",          sideA: "Plain CSS",      sideB: "Tailwind" },
	{ id: "agile-vs-kanban",          sideA: "Scrum",          sideB: "Kanban" },
	{ id: "deploy-friday-vs-never",   sideA: "Deploy Friday",  sideB: "Never Friday" },
];

/** Assign 2-3 random opinions to an agent. */
export function assignOpinions(): AgentOpinion[] {
	const count = 2 + (Math.random() < 0.5 ? 1 : 0);
	const shuffled = [...OPINION_TOPICS].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count).map((t) => ({
		topic: t.id,
		side: Math.random() < 0.5 ? "A" : "B",
	}));
}

/** Check if two agents have opposing opinions on any shared topic. */
export function checkOpinionClash(
	opinionsA: readonly AgentOpinion[],
	opinionsB: readonly AgentOpinion[],
): boolean {
	for (const a of opinionsA) {
		const match = opinionsB.find((b) => b.topic === a.topic);
		if (match && match.side !== a.side) return true;
	}
	return false;
}

/** Check if two agents agree on any shared topic. */
export function checkOpinionAgreement(
	opinionsA: readonly AgentOpinion[],
	opinionsB: readonly AgentOpinion[],
): boolean {
	for (const a of opinionsA) {
		const match = opinionsB.find((b) => b.topic === a.topic);
		if (match && match.side === a.side) return true;
	}
	return false;
}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/data/opinion-topics.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/opinion-topics.ts" \
       "01 - Projects/Flowti Plugin/tests/game/data/opinion-topics.test.ts"
git commit -m "feat(world): opinion topics — 15 debate topics with clash/agreement detection"
```

### Task 2: Relationship conversation templates

**Files:**
- Create: `src/game/data/relationship-templates.ts`

- [ ] **Step 1: Implement tier-specific templates**

```typescript
/**
 * relationship-templates.ts — Conversation templates per relationship tier.
 *
 * Each tier unlocks additional template pools that overlay the generic social pool.
 * Rival templates replace 30% of normal conversations with bickering.
 */

export interface RelationshipLine {
	readonly text: string;
	readonly weight: number;
}

export const BICKER_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Oh, you're a {opinionB} person? Interesting choice...", weight: 2 },
	{ text: "We are NOT having this debate again", weight: 2 },
	{ text: "I respect your opinion. I just think it's wrong", weight: 2 },
	{ text: "Agree to disagree. Heavily disagree", weight: 1 },
	{ text: "You say {opinionB}, I say {opinionA}. Let's call the whole thing off", weight: 1 },
	{ text: "I knew you'd say that", weight: 1 },
	{ text: "This is our hill and we're both dying on it", weight: 2 },
	{ text: "I've heard your argument. It's still wrong", weight: 1 },
	{ text: "You know what, let's talk about literally anything else", weight: 1 },
	{ text: "One day you'll see the light. Today is not that day", weight: 2 },
	{ text: "Can someone else weigh in? I need backup", weight: 1 },
	{ text: "The audacity of {opinionB}. The absolute audacity", weight: 2 },
];

export const COLLEAGUE_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Good working with you on that", weight: 1 },
	{ text: "Your {domain} perspective always helps", weight: 2 },
	{ text: "We make a solid team on {domain} stuff", weight: 1 },
	{ text: "I've learned a lot working alongside you", weight: 1 },
	{ text: "Your approach to {domain} is really effective", weight: 2 },
	{ text: "Glad we're on the same project", weight: 1 },
	{ text: "We should collaborate more often", weight: 1 },
	{ text: "You always bring good energy to the work", weight: 2 },
];

export const FRIEND_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Remember when we fixed that impossible bug together?", weight: 2 },
	{ text: "You're one of the good ones, you know that?", weight: 2 },
	{ text: "Lunch? Same spot?", weight: 1 },
	{ text: "I saved you a seat", weight: 1 },
	{ text: "You look like you need a break. Coffee's on me", weight: 2 },
	{ text: "Nobody gets my jokes like you do", weight: 1 },
	{ text: "We've been through some builds together", weight: 2 },
	{ text: "If I had to be stuck in a war room, I'd want you there", weight: 2 },
	{ text: "That inside joke from last week? Still funny", weight: 1 },
	{ text: "You and me vs the backlog. Let's go", weight: 1 },
	{ text: "Thanks for having my back in that meeting", weight: 2 },
	{ text: "I trust your judgment more than most", weight: 1 },
];

export const BEST_FRIEND_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "I was literally about to say the same thing", weight: 2 },
	{ text: "You finish my sentences and I'm not even mad", weight: 2 },
	{ text: "Ride or die, build or crash", weight: 2 },
	{ text: "I'd take a bullet for you. A metaphorical, code-related bullet", weight: 2 },
	{ text: "No one else would understand why that's funny", weight: 1 },
	{ text: "We don't even need to talk. We just know", weight: 1 },
	{ text: "Best partner in code I've ever had", weight: 2 },
	{ text: "If they ever split us up I'm quitting", weight: 2 },
	{ text: "Our vibe is immaculate and I will not apologize", weight: 1 },
	{ text: "Telepathic debugging session?", weight: 1 },
];

export const AGREEMENT_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Finally, someone with taste! {opinionA} all the way", weight: 2 },
	{ text: "You're a {opinionA} person too? Instant respect", weight: 2 },
	{ text: "I knew I liked you. {opinionA} is clearly the right choice", weight: 1 },
	{ text: "See? Great minds think alike. {opinionA} forever", weight: 1 },
	{ text: "{opinionA} gang rise up", weight: 2 },
	{ text: "We're on the same side and that matters", weight: 1 },
];

/** Get templates for a relationship tier. */
export function getTemplatesForTier(tier: string): readonly RelationshipLine[] {
	switch (tier) {
		case "rival": return BICKER_TEMPLATES;
		case "colleague": return COLLEAGUE_TEMPLATES;
		case "friend": return FRIEND_TEMPLATES;
		case "best-friend": return BEST_FRIEND_TEMPLATES;
		default: return [];
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/relationship-templates.ts"
git commit -m "feat(world): relationship templates — bicker, colleague, friend, best friend pools"
```

---

## Chunk 2: RelationshipSystem

### Task 3: RelationshipSystem tests

**Files:**
- Create: `tests/game/systems/relationship-system.test.ts`

- [ ] **Step 1: Write comprehensive tests**

```typescript
import { describe, it, expect } from "vitest";
import { RelationshipSystem } from "../../../src/game/systems/relationship-system.js";

describe("RelationshipSystem", () => {
	describe("registration", () => {
		it("registers agents with opinions", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", [{ topic: "tabs-vs-spaces", side: "A" }]);
			sys.register("Rex", [{ topic: "tabs-vs-spaces", side: "B" }]);
			expect(sys.getOpinions("Atlas")).toHaveLength(1);
		});
	});

	describe("affinity", () => {
		it("starts at 0 for new pairs", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			expect(sys.getAffinity("Atlas", "Rex")).toBe(0);
		});

		it("recordConversation increases affinity by 2", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordConversation("Atlas", "Rex");
			expect(sys.getAffinity("Atlas", "Rex")).toBe(2);
		});

		it("recordCluster increases affinity by 1 for each pair", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.register("Sage", []);
			sys.recordCluster(["Atlas", "Rex", "Sage"]);
			expect(sys.getAffinity("Atlas", "Rex")).toBe(1);
			expect(sys.getAffinity("Atlas", "Sage")).toBe(1);
			expect(sys.getAffinity("Rex", "Sage")).toBe(1);
		});

		it("clamps affinity to -100..100", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			// Force high affinity
			for (let i = 0; i < 60; i++) sys.recordConversation("Atlas", "Rex");
			expect(sys.getAffinity("Atlas", "Rex")).toBeLessThanOrEqual(100);
		});

		it("is symmetric — A→B equals B→A", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordConversation("Atlas", "Rex");
			expect(sys.getAffinity("Rex", "Atlas")).toBe(2);
		});
	});

	describe("tiers", () => {
		it("returns acquaintance for affinity 0-15", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			expect(sys.getTier("Atlas", "Rex")).toBe("acquaintance");
		});

		it("returns colleague for affinity 16-50", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 9; i++) sys.recordConversation("Atlas", "Rex"); // 18
			expect(sys.getTier("Atlas", "Rex")).toBe("colleague");
		});

		it("returns friend for affinity 51-80", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 26; i++) sys.recordConversation("Atlas", "Rex"); // 52
			expect(sys.getTier("Atlas", "Rex")).toBe("friend");
		});

		it("returns best-friend for affinity 81+", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 41; i++) sys.recordConversation("Atlas", "Rex"); // 82
			expect(sys.getTier("Atlas", "Rex")).toBe("best-friend");
		});
	});

	describe("opinion clashes", () => {
		it("shouldBicker returns true when agents have opposing opinions", () => {
			const sys = new RelationshipSystem(1.0); // 100% bicker chance
			sys.register("Atlas", [{ topic: "tabs-vs-spaces", side: "A" }]);
			sys.register("Rex", [{ topic: "tabs-vs-spaces", side: "B" }]);
			expect(sys.shouldBicker("Atlas", "Rex")).toBe(true);
		});

		it("shouldBicker returns false when no opinion clash", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", [{ topic: "tabs-vs-spaces", side: "A" }]);
			sys.register("Rex", [{ topic: "tabs-vs-spaces", side: "A" }]);
			expect(sys.shouldBicker("Atlas", "Rex")).toBe(false);
		});

		it("recordBicker decreases affinity by 3", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordBicker("Atlas", "Rex");
			expect(sys.getAffinity("Atlas", "Rex")).toBe(-3);
		});
	});

	describe("shared memories", () => {
		it("records shared memories up to max 5", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 7; i++) {
				sys.addSharedMemory("Atlas", "Rex", `Event ${i}`);
			}
			const entry = sys.getRelationship("Atlas", "Rex");
			expect(entry!.sharedMemories).toHaveLength(5);
			expect(entry!.sharedMemories[4]).toBe("Event 6");
		});
	});

	describe("cycle decay", () => {
		it("decays affinity toward 0 for inactive pairs", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 5; i++) sys.recordConversation("Atlas", "Rex"); // 10
			sys.onCycleEnd();
			expect(sys.getAffinity("Atlas", "Rex")).toBe(9); // -1 decay
		});

		it("does not decay below 0 for positive affinity", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordConversation("Atlas", "Rex"); // 2
			sys.onCycleEnd(); // 1
			sys.onCycleEnd(); // 0
			sys.onCycleEnd(); // still 0
			expect(sys.getAffinity("Atlas", "Rex")).toBe(0);
		});

		it("does not decay above 0 for negative affinity", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordBicker("Atlas", "Rex"); // -3
			sys.onCycleEnd(); // -2
			sys.onCycleEnd(); // -1
			sys.onCycleEnd(); // 0
			sys.onCycleEnd(); // still 0
			expect(sys.getAffinity("Atlas", "Rex")).toBe(0);
		});
	});

	describe("persistence", () => {
		it("serialize and restore preserves state", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", [{ topic: "tabs-vs-spaces", side: "A" }]);
			sys.register("Rex", [{ topic: "tabs-vs-spaces", side: "B" }]);
			sys.recordConversation("Atlas", "Rex");
			sys.addSharedMemory("Atlas", "Rex", "Fixed a bug together");
			const data = sys.serialize();

			const sys2 = new RelationshipSystem();
			sys2.restore(data);
			expect(sys2.getAffinity("Atlas", "Rex")).toBe(2);
			expect(sys2.getRelationship("Atlas", "Rex")!.sharedMemories).toContain("Fixed a bug together");
			expect(sys2.getOpinions("Atlas")).toHaveLength(1);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/relationship-system.test.ts`
Expected: FAIL — module not found

### Task 4: RelationshipSystem implementation

**Files:**
- Create: `src/game/systems/relationship-system.ts`

- [ ] **Step 1: Implement RelationshipSystem**

```typescript
/**
 * relationship-system.ts — Tracks evolving pairwise relationships between agents.
 *
 * Affinity ranges from -100 (rival) to 100 (best friend). Changes accumulate
 * through conversations, clusters, bickering, and shared experiences. Affinity
 * decays toward 0 by 1 per cycle for inactive pairs.
 */

import { checkOpinionClash, type AgentOpinion } from "../data/opinion-topics.js";

// ── Types ────────────────────────────────────────────────────────────

export interface RelationshipEntry {
	agentA: string;
	agentB: string;
	affinity: number;
	interactionCount: number;
	lastInteraction: number;
	sharedMemories: string[];
	opinion: string | null;
}

export type RelationshipTier = "rival" | "acquaintance" | "colleague" | "friend" | "best-friend";

interface PersistenceData {
	relationships: RelationshipEntry[];
	opinions: Record<string, AgentOpinion[]>;
}

// ── Constants ────────────────────────────────────────────────────────

const MAX_SHARED_MEMORIES = 5;
const DEFAULT_BICKER_CHANCE = 0.3;

// ── System ───────────────────────────────────────────────────────────

export class RelationshipSystem {
	private readonly relationships = new Map<string, RelationshipEntry>();
	private readonly agentOpinions = new Map<string, AgentOpinion[]>();
	private readonly bickerChance: number;
	private readonly tierCallbacks: Array<(agentA: string, agentB: string, tier: RelationshipTier) => void> = [];
	private interactedThisCycle = new Set<string>();

	constructor(bickerChance = DEFAULT_BICKER_CHANCE) {
		this.bickerChance = bickerChance;
	}

	// ── Registration ─────────────────────────────────────────────

	register(name: string, opinions: AgentOpinion[]): void {
		this.agentOpinions.set(name, opinions);
	}

	getOpinions(name: string): AgentOpinion[] {
		return this.agentOpinions.get(name) ?? [];
	}

	// ── Affinity queries ─────────────────────────────────────────

	getAffinity(a: string, b: string): number {
		return this.getOrCreate(a, b).affinity;
	}

	getTier(a: string, b: string): RelationshipTier {
		const affinity = this.getAffinity(a, b);
		if (affinity <= -30) return "rival";
		if (affinity <= 15) return "acquaintance";
		if (affinity <= 50) return "colleague";
		if (affinity <= 80) return "friend";
		return "best-friend";
	}

	getRelationship(a: string, b: string): RelationshipEntry | null {
		return this.relationships.get(this.pairKey(a, b)) ?? null;
	}

	onTierChange(cb: (agentA: string, agentB: string, tier: RelationshipTier) => void): void {
		this.tierCallbacks.push(cb);
	}

	// ── Affinity changes ─────────────────────────────────────────

	recordConversation(a: string, b: string): void {
		this.changeAffinity(a, b, 2);
		const entry = this.getOrCreate(a, b);
		entry.interactionCount++;
		entry.lastInteraction = Date.now();
		this.interactedThisCycle.add(this.pairKey(a, b));
	}

	recordCluster(members: string[]): void {
		for (let i = 0; i < members.length; i++) {
			for (let j = i + 1; j < members.length; j++) {
				this.changeAffinity(members[i], members[j], 1);
				this.interactedThisCycle.add(this.pairKey(members[i], members[j]));
			}
		}
	}

	recordBicker(a: string, b: string): void {
		this.changeAffinity(a, b, -3);
		this.interactedThisCycle.add(this.pairKey(a, b));
	}

	addSharedMemory(a: string, b: string, memory: string): void {
		const entry = this.getOrCreate(a, b);
		entry.sharedMemories.push(memory);
		if (entry.sharedMemories.length > MAX_SHARED_MEMORIES) {
			entry.sharedMemories.splice(0, entry.sharedMemories.length - MAX_SHARED_MEMORIES);
		}
	}

	// ── Opinion checks ───────────────────────────────────────────

	shouldBicker(a: string, b: string): boolean {
		const opsA = this.agentOpinions.get(a) ?? [];
		const opsB = this.agentOpinions.get(b) ?? [];
		if (!checkOpinionClash(opsA, opsB)) return false;
		return Math.random() < this.bickerChance;
	}

	// ── Cycle end ────────────────────────────────────────────────

	onCycleEnd(): void {
		for (const [key, entry] of this.relationships) {
			if (this.interactedThisCycle.has(key)) continue;
			// Decay toward 0
			if (entry.affinity > 0) {
				entry.affinity = Math.max(0, entry.affinity - 1);
			} else if (entry.affinity < 0) {
				entry.affinity = Math.min(0, entry.affinity + 1);
			}
		}
		this.interactedThisCycle.clear();
	}

	// ── Persistence ──────────────────────────────────────────────

	serialize(): PersistenceData {
		const relationships: RelationshipEntry[] = [];
		for (const entry of this.relationships.values()) {
			relationships.push({ ...entry, sharedMemories: [...entry.sharedMemories] });
		}
		const opinions: Record<string, AgentOpinion[]> = {};
		for (const [name, ops] of this.agentOpinions) {
			opinions[name] = [...ops];
		}
		return { relationships, opinions };
	}

	restore(data: PersistenceData): void {
		for (const entry of data.relationships) {
			this.relationships.set(this.pairKey(entry.agentA, entry.agentB), { ...entry });
		}
		for (const [name, ops] of Object.entries(data.opinions)) {
			this.agentOpinions.set(name, ops);
		}
	}

	// ── Private ──────────────────────────────────────────────────

	private pairKey(a: string, b: string): string {
		return a < b ? `${a}::${b}` : `${b}::${a}`;
	}

	private getOrCreate(a: string, b: string): RelationshipEntry {
		const key = this.pairKey(a, b);
		let entry = this.relationships.get(key);
		if (!entry) {
			entry = {
				agentA: a < b ? a : b,
				agentB: a < b ? b : a,
				affinity: 0,
				interactionCount: 0,
				lastInteraction: 0,
				sharedMemories: [],
				opinion: null,
			};
			this.relationships.set(key, entry);
		}
		return entry;
	}

	private changeAffinity(a: string, b: string, delta: number): void {
		const entry = this.getOrCreate(a, b);
		const prevTier = this.tierFromAffinity(entry.affinity);
		entry.affinity = Math.max(-100, Math.min(100, entry.affinity + delta));
		const newTier = this.tierFromAffinity(entry.affinity);
		if (newTier !== prevTier) {
			this.updateOpinion(entry, newTier);
			for (const cb of this.tierCallbacks) cb(entry.agentA, entry.agentB, newTier);
		}
	}

	private tierFromAffinity(affinity: number): RelationshipTier {
		if (affinity <= -30) return "rival";
		if (affinity <= 15) return "acquaintance";
		if (affinity <= 50) return "colleague";
		if (affinity <= 80) return "friend";
		return "best-friend";
	}

	private updateOpinion(entry: RelationshipEntry, tier: RelationshipTier): void {
		const templates: Record<RelationshipTier, string> = {
			"rival": `can't stand ${entry.agentB}'s taste`,
			"acquaintance": null as unknown as string,
			"colleague": `respects ${entry.agentB}'s work`,
			"friend": `thinks ${entry.agentB} is great to work with`,
			"best-friend": `considers ${entry.agentB} their closest ally`,
		};
		entry.opinion = templates[tier] ?? null;
	}
}
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/relationship-system.test.ts`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/relationship-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/relationship-system.test.ts"
git commit -m "feat(world): RelationshipSystem — affinity tiers, opinion clashes, decay, persistence"
```

---

## Chunk 3: WorldConfig Extension + Engine Wiring

### Task 5: Add RelationshipsConfig to WorldConfig

**Files:**
- Modify: `src/game/data/world-config.ts`

- [ ] **Step 1: Add config**

Add `RelationshipsConfig` interface and add it to `WorldConfig`:

```typescript
export interface RelationshipsConfig {
	readonly affinityDecayPerCycle: number;
	readonly bickerChance: number;
	readonly maxSharedMemories: number;
}
```

Add to `WorldConfig` interface: `readonly relationships: RelationshipsConfig;`

Add defaults: `relationships: { affinityDecayPerCycle: 1, bickerChance: 0.3, maxSharedMemories: 5 }`

Update `mergeWorldConfig`.

- [ ] **Step 2: Run all game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/world-config.ts"
git commit -m "feat(config): add RelationshipsConfig to WorldConfig"
```

### Task 6: Wire RelationshipSystem into engine

**Files:**
- Modify: `src/game/engine.ts`
- Modify: `src/game/store/dashboard-store.ts`
- Modify: `tests/game/engine.test.ts`

- [ ] **Step 1: Add imports**

```typescript
import { RelationshipSystem } from "./systems/relationship-system.js";
import { assignOpinions } from "./data/opinion-topics.js";
```

- [ ] **Step 2: Instantiate**

After `worldEventScheduler`:

```typescript
const relationshipSystem = new RelationshipSystem(DEFAULT_WORLD_CONFIG.relationships.bickerChance);
```

- [ ] **Step 3: Register agents with opinions**

In `registerAgents`, after quirk registration:

```typescript
// Relationship opinions — restore from memory or assign new
const savedOpinions = memorySystem.getMemory(agent.name).opinions;
const opinions = savedOpinions.length > 0 ? savedOpinions : assignOpinions();
if (savedOpinions.length === 0) {
	memorySystem.getMemory(agent.name).opinions = opinions;
}
relationshipSystem.register(agent.name, opinions);
```

- [ ] **Step 4: Wire into socialSystem.onConversation**

In the existing `socialSystem.onConversation` callback, after conversation counting, add:

```typescript
// Relationship tracking
relationshipSystem.recordConversation(nameA, nameB);
// Check for bickering
if (relationshipSystem.shouldBicker(nameA, nameB)) {
	relationshipSystem.recordBicker(nameA, nameB);
	// Replace the normal conversation with bickering bubbles
	setTimeout(() => {
		bubbleSystem.showBubble(nameA, "speech", "We are NOT having this debate again", engine.currentScene, findAgentActor, 3000);
	}, 500);
	setTimeout(() => {
		bubbleSystem.showBubble(nameB, "speech", "I respect your opinion. I just think it's wrong", engine.currentScene, findAgentActor, 3000);
	}, 2000);
}
```

- [ ] **Step 5: Wire into socialSystem.onCluster**

In the existing `socialSystem.onCluster` callback, add:

```typescript
relationshipSystem.recordCluster(members);
```

- [ ] **Step 6: Wire cycle-end decay**

In the cycle-end block (where `prevCycleCount` increments), add:

```typescript
relationshipSystem.onCycleEnd();
```

- [ ] **Step 7: Wire persistence**

In the dispose flush block, add:

```typescript
writeFileSync(join(varDir, "world-relationships.json"), JSON.stringify(relationshipSystem.serialize(), null, "\t"), "utf-8");
```

In the start restore block, add:

```typescript
const relPath = join(varDir, "world-relationships.json");
if (existsSync(relPath)) relationshipSystem.restore(JSON.parse(readFileSync(relPath, "utf-8")));
```

- [ ] **Step 8: Update engine test mocks**

Add mock for RelationshipSystem and opinion-topics:

```typescript
vi.mock("../../src/game/systems/relationship-system.js", () => {
	function MockRelationshipSystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.recordConversation = vi.fn();
		self.recordCluster = vi.fn();
		self.recordBicker = vi.fn();
		self.shouldBicker = vi.fn(() => false);
		self.getAffinity = vi.fn(() => 0);
		self.getTier = vi.fn(() => "acquaintance");
		self.onCycleEnd = vi.fn();
		self.onTierChange = vi.fn();
		self.addSharedMemory = vi.fn();
		self.serialize = vi.fn(() => ({ relationships: [], opinions: {} }));
		self.restore = vi.fn();
	}
	return { RelationshipSystem: MockRelationshipSystem };
});

vi.mock("../../src/game/data/opinion-topics.js", () => ({
	assignOpinions: vi.fn(() => []),
	checkOpinionClash: vi.fn(() => false),
	checkOpinionAgreement: vi.fn(() => false),
	OPINION_TOPICS: [],
}));
```

Update the world-config mock to include relationships:

```typescript
relationships: { affinityDecayPerCycle: 1, bickerChance: 0.3, maxSharedMemories: 5 },
```

- [ ] **Step 9: Run all game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass

- [ ] **Step 10: Run tsc**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" \
       "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" \
       "01 - Projects/Flowti Plugin/tests/game/engine.test.ts"
git commit -m "feat(engine): wire RelationshipSystem — conversations, bickering, decay, persistence"
```

---

## Chunk 4: Final Verification

### Task 7: Full verification

- [ ] **Step 1: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 2: Lint new files**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/game/systems/relationship-system.ts src/game/data/opinion-topics.ts src/game/data/relationship-templates.ts 2>&1`
Expected: No errors

- [ ] **Step 3: All game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass (397 + ~20 new)

- [ ] **Step 4: Full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: All pass (8680+)

- [ ] **Step 5: Build**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build passes
