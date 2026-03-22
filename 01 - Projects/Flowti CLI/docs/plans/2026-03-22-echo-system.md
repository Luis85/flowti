# Echo System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Echo System — an event-residue layer that creates emergent agent behavior through weighted preferences, cascading reactions, and system-wide integration.

**Architecture:** EchoStore (per-agent bounded preference storage) ← EchoProducer (event→echo mapper) → CascadeResolver (chain reactions). Consumers: BT, TalkEngine, RelationshipSystem, movement, narrative. All new code lives in `src/game/systems/echo/`. Persistence via `engine-state.ts` pattern.

**Tech Stack:** TypeScript (strict), Vitest, Obsidian Plugin (ExcaliburJS game engine), mistreevous BT library.

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-22-echo-system-design.md`

**Commands** (run from `cd "01 - Projects/Flowti Plugin"`):
```bash
# Run echo tests only
npx vitest run tests/game/systems/echo/

# Run all talk/relationship tests (integration check)
npx vitest run tests/game/systems/talk/ tests/game/systems/relationship-system/

# Type check
npx tsc --noEmit

# Lint echo files
npx eslint src/game/systems/echo/
```

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/game/systems/echo/echo-types.ts` | All type definitions: Echo, EchoKind, DialogueBias, EchoSummary, DecayResult, AddResult, CascadeChain, IEchoStore |
| `src/game/systems/echo/echo-store.ts` | EchoStore class: CRUD, merge-on-match, decay, eviction, serialization, cascade budget |
| `src/game/systems/echo/echo-producer.ts` | EchoProducer: event→echo mapping table, significance gate, per-source cooldowns |
| `src/game/systems/echo/cascade-resolver.ts` | CascadeResolver: threshold evaluation, probability roll, reaction selection, loop detection, queue |
| `src/game/systems/echo/index.ts` | Barrel export |
| `tests/game/systems/echo/echo-store.test.ts` | Store: add, merge, query, decay, evict, bounds, serialize, empty states |
| `tests/game/systems/echo/echo-producer.test.ts` | Producer: mapping, significance gate, cooldowns, merge forwarding |
| `tests/game/systems/echo/cascade-resolver.test.ts` | Resolver: threshold, probability, budget, depth limit, loop detection, dampening |

### Modified Files

| File | Change |
|------|--------|
| `src/game/engine-types.ts` | Add IEchoStore to EngineSystems |
| `src/game/engine-state.ts` | Add saveEchoes/restoreEchoes |
| `src/game/engine.ts` | Instantiate echo system, wire callbacks |
| `src/game/engine-simulation.ts` | Cycle boundary decay, cascade queue processing, echo producer wiring |
| `src/game/systems/talk/talk-engine.ts` | Extend enrichment with getEchoBias, apply bias before resolvePhrase |
| `src/game/brain/behavior-tree/bt-agent.ts` | EchoBiasedIdle action function |
| `src/game/brain/behavior-tree/subtrees/idle.ts` | Replace lotto MDSL with EchoBiasedIdle node |
| `src/game/brain/behavior-tree/bt-types.ts` | Add echoStore + currentRoom to BTAgentContext and PetBTContext |
| `src/game/brain/behavior-tree/pet-bt.ts` | Echo multiplier on chance-roll thresholds |
| `src/game/systems/relationship-system.ts` | Echo-driven affinity drift in onCycleEnd |

---

## Chunk 1: Core Domain (Types + EchoStore)

### Task 1: Echo Type Definitions

**Files:**
- Create: `src/game/systems/echo/echo-types.ts`

- [ ] **Step 1: Create echo-types.ts with all interfaces**

```typescript
// src/game/systems/echo/echo-types.ts

export type EchoKind =
	| "opinion"
	| "preference"
	| "aversion"
	| "memory"
	| "reputation"
	| "bond"
	| "mood-residue";

export interface Echo {
	readonly id: string;
	readonly kind: EchoKind;
	readonly source: string;
	readonly target?: string;
	readonly weight: number;
	readonly decay: number;
	readonly reinforcements: number;
	readonly lastReinforcedCycle: number;
	readonly tags: readonly string[];
	readonly cycleCreated: number;
}

export interface DialogueBias {
	readonly moodOverride?: string;
	readonly targetOpinions: ReadonlyMap<string, number>;
	readonly moodResidueWeight: number;
	readonly memoryBoosts: ReadonlyMap<string, number>;
}

export interface EchoSummary {
	readonly kind: EchoKind;
	readonly target: string;
	readonly weight: number;
	readonly direction: "warming" | "cooling" | "stable" | "fading" | "strong";
	readonly label: string;
	readonly reinforcements: number;
}

export interface DecayResult {
	readonly evicted: readonly Echo[];
	readonly thresholdsCrossed: readonly Echo[];
	readonly habitsFormed: readonly Echo[];
}

export interface AddResult {
	readonly merged: boolean;
	readonly echo: Echo;
	readonly cascadeTriggered: boolean;
}

export interface CascadeChain {
	readonly depth: number;
	readonly visited: Set<string>;
	readonly rootEchoId: string;
}

export type EchoInput = Omit<Echo, "id" | "cycleCreated" | "reinforcements">;

export interface IEchoStore {
	addEcho(agent: string, echo: EchoInput, cycle: number): AddResult;
	queryWeight(agent: string, kind: EchoKind, target?: string): number;
	getDialogueBias(agent: string): DialogueBias;
	getPreferences(agent: string): readonly EchoSummary[];
	getStrongest(agent: string, kind: EchoKind): Echo | undefined;
	decayAll(cycle: number): DecayResult;
	getCascadeBudget(): number;
	consumeCascade(): boolean;
	resetCascadeBudget(): void;
	serialize(): Record<string, Echo[]>;
	restore(data: Record<string, Echo[]>): void;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No new errors from echo-types.ts

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/echo/echo-types.ts"
git commit -m "feat(echo): add Echo System type definitions"
```

---

### Task 2: EchoStore — Add & Query

**Files:**
- Create: `src/game/systems/echo/echo-store.ts`
- Create: `tests/game/systems/echo/echo-store.test.ts`

- [ ] **Step 1: Write failing tests for addEcho and queryWeight**

```typescript
// tests/game/systems/echo/echo-store.test.ts
import { describe, it, expect } from "vitest";
import { EchoStore } from "../../../../src/game/systems/echo/echo-store.js";
import type { EchoInput } from "../../../../src/game/systems/echo/echo-types.js";

function opinion(target: string, weight: number): EchoInput {
	return { kind: "opinion", source: "conversation", target, weight, decay: 3, tags: ["social"] };
}

function preference(target: string, weight: number): EchoInput {
	return { kind: "preference", source: "task", target, weight, decay: 2, tags: ["work"] };
}

function bond(target: string, weight: number): EchoInput {
	return { kind: "bond", source: "pet-comfort", target, weight, decay: 1, tags: ["pet"] };
}

describe("EchoStore", () => {
	describe("addEcho", () => {
		it("creates a new echo with generated id and reinforcements=0", () => {
			const store = new EchoStore();
			const result = store.addEcho("nova", opinion("atlas", 5), 1);
			expect(result.merged).toBe(false);
			expect(result.echo.kind).toBe("opinion");
			expect(result.echo.target).toBe("atlas");
			expect(result.echo.weight).toBe(5);
			expect(result.echo.reinforcements).toBe(0);
			expect(result.echo.cycleCreated).toBe(1);
			expect(result.echo.id).toContain("echo:opinion");
		});

		it("merges matching kind+source+target, adding weight and incrementing reinforcements", () => {
			const store = new EchoStore();
			store.addEcho("nova", opinion("atlas", 5), 1);
			const result = store.addEcho("nova", opinion("atlas", 8), 2);
			expect(result.merged).toBe(true);
			expect(result.echo.weight).toBe(13);
			expect(result.echo.reinforcements).toBe(1);
		});

		it("caps weight at ±100", () => {
			const store = new EchoStore();
			store.addEcho("nova", opinion("atlas", 90), 1);
			const result = store.addEcho("nova", opinion("atlas", 20), 2);
			expect(result.echo.weight).toBe(100);
		});

		it("caps negative weight at -100", () => {
			const store = new EchoStore();
			store.addEcho("nova", opinion("atlas", -90), 1);
			const result = store.addEcho("nova", opinion("atlas", -20), 2);
			expect(result.echo.weight).toBe(-100);
		});

		it("evicts weakest echo when at 20 max", () => {
			const store = new EchoStore();
			for (let i = 0; i < 20; i++) {
				store.addEcho("nova", opinion(`agent-${i}`, 10 + i), 1);
			}
			// 21st echo should evict the weakest (agent-0 at weight 10)
			store.addEcho("nova", opinion("agent-new", 25), 1);
			expect(store.queryWeight("nova", "opinion", "agent-0")).toBe(0);
			expect(store.queryWeight("nova", "opinion", "agent-new")).toBe(25);
		});

		it("sets cascadeTriggered when |weight| crosses 15", () => {
			const store = new EchoStore();
			const r1 = store.addEcho("nova", opinion("atlas", 10), 1);
			expect(r1.cascadeTriggered).toBe(false);
			const r2 = store.addEcho("nova", opinion("atlas", 6), 2);
			expect(r2.cascadeTriggered).toBe(true); // 10+6=16, crossed 15
		});

		it("does not trigger cascade for echo already above threshold", () => {
			const store = new EchoStore();
			store.addEcho("nova", opinion("atlas", 20), 1);
			const r2 = store.addEcho("nova", opinion("atlas", 5), 2);
			expect(r2.cascadeTriggered).toBe(false); // was already above 15
		});
	});

	describe("queryWeight", () => {
		it("returns 0 for unknown agent", () => {
			const store = new EchoStore();
			expect(store.queryWeight("nobody", "opinion")).toBe(0);
		});

		it("returns 0 for no matching echoes", () => {
			const store = new EchoStore();
			store.addEcho("nova", opinion("atlas", 5), 1);
			expect(store.queryWeight("nova", "bond")).toBe(0);
		});

		it("returns weight for specific target", () => {
			const store = new EchoStore();
			store.addEcho("nova", opinion("atlas", 12), 1);
			store.addEcho("nova", opinion("orion", -8), 1);
			expect(store.queryWeight("nova", "opinion", "atlas")).toBe(12);
			expect(store.queryWeight("nova", "opinion", "orion")).toBe(-8);
		});

		it("returns sum of all echoes of a kind when no target specified", () => {
			const store = new EchoStore();
			store.addEcho("nova", opinion("atlas", 12), 1);
			store.addEcho("nova", opinion("orion", -8), 1);
			expect(store.queryWeight("nova", "opinion")).toBe(4);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/echo-store.test.ts`
Expected: FAIL — cannot find module echo-store

- [ ] **Step 3: Implement EchoStore (add + query)**

```typescript
// src/game/systems/echo/echo-store.ts
import type { Echo, EchoInput, EchoKind, AddResult, IEchoStore, DecayResult, DialogueBias, EchoSummary } from "./echo-types.js";

const MAX_ECHOES = 20;
const MAX_WEIGHT = 100;
const CASCADE_THRESHOLD = 15;
const EVICTION_THRESHOLD = 2;
const DISPLAY_THRESHOLD = 5;
const MAX_CASCADE_BUDGET = 5;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function echoKey(kind: EchoKind, source: string, target?: string): string {
	return `${kind}:${source}:${target ?? ""}`;
}

export class EchoStore implements IEchoStore {
	private agents = new Map<string, Echo[]>();
	private cascadeBudget = MAX_CASCADE_BUDGET;

	private pendingHabits: Echo[] = [];

	addEcho(agent: string, input: EchoInput, cycle: number): AddResult {
		const echoes = this.getOrCreateAgent(agent);
		const key = echoKey(input.kind, input.source, input.target);
		const existing = echoes.find((e) => echoKey(e.kind, e.source, e.target) === key);

		if (existing) {
			const prevAbove = Math.abs(existing.weight) >= CASCADE_THRESHOLD;
			const newWeight = clamp(existing.weight + input.weight, -MAX_WEIGHT, MAX_WEIGHT);
			const nowAbove = Math.abs(newWeight) >= CASCADE_THRESHOLD;
			const newReinforcements = existing.reinforcements + 1;
			const merged: Echo = {
				...existing,
				weight: newWeight,
				decay: input.decay,
				reinforcements: newReinforcements,
				lastReinforcedCycle: cycle,
			};
			if (newReinforcements === 3) {
				this.pendingHabits.push(merged);
			}
			const idx = echoes.indexOf(existing);
			echoes[idx] = merged;
			return { merged: true, echo: merged, cascadeTriggered: !prevAbove && nowAbove };
		}

		const echo: Echo = {
			id: `echo:${input.kind}:${input.target ?? "none"}:c${cycle}`,
			kind: input.kind,
			source: input.source,
			target: input.target,
			weight: clamp(input.weight, -MAX_WEIGHT, MAX_WEIGHT),
			decay: input.decay,
			reinforcements: 0,
			lastReinforcedCycle: cycle,
			tags: input.tags,
			cycleCreated: cycle,
		};

		if (echoes.length >= MAX_ECHOES) {
			const weakestIdx = echoes.reduce(
				(minIdx, e, i, arr) => (Math.abs(e.weight) < Math.abs(arr[minIdx].weight) ? i : minIdx),
				0,
			);
			echoes.splice(weakestIdx, 1);
		}

		echoes.push(echo);
		const cascadeTriggered = Math.abs(echo.weight) >= CASCADE_THRESHOLD;
		return { merged: false, echo, cascadeTriggered };
	}

	queryWeight(agent: string, kind: EchoKind, target?: string): number {
		const echoes = this.agents.get(agent);
		if (!echoes) return 0;
		let sum = 0;
		for (const e of echoes) {
			if (e.kind !== kind) continue;
			if (target !== undefined && e.target !== target) continue;
			sum += e.weight;
		}
		return sum;
	}

	getDialogueBias(agent: string): DialogueBias {
		const echoes = this.agents.get(agent);
		if (!echoes) {
			return {
				moodOverride: undefined,
				targetOpinions: new Map(),
				moodResidueWeight: 0,
				memoryBoosts: new Map(),
			};
		}
		const targetOpinions = new Map<string, number>();
		let moodResidueWeight = 0;
		const memoryBoosts = new Map<string, number>();
		for (const e of echoes) {
			if (e.kind === "opinion" && e.target) {
				targetOpinions.set(e.target, (targetOpinions.get(e.target) ?? 0) + e.weight);
			} else if (e.kind === "mood-residue") {
				moodResidueWeight += e.weight;
			} else if (e.kind === "memory" && e.target) {
				memoryBoosts.set(e.target, (memoryBoosts.get(e.target) ?? 0) + e.weight);
			}
		}
		let moodOverride: string | undefined;
		if (moodResidueWeight < -10) moodOverride = "tired";
		else if (moodResidueWeight > 10) moodOverride = "excited";
		return { moodOverride, targetOpinions, moodResidueWeight, memoryBoosts };
	}

	getPreferences(agent: string, cycle = 0): readonly EchoSummary[] {
		const echoes = this.agents.get(agent);
		if (!echoes) return [];
		return echoes
			.filter((e) => Math.abs(e.weight) >= DISPLAY_THRESHOLD)
			.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
			.map((e) => ({
				kind: e.kind,
				target: e.target ?? e.source,
				weight: e.weight,
				direction: this.computeDirection(e, cycle),
				label: e.target ?? e.source,
				reinforcements: e.reinforcements,
			}));
	}

	getStrongest(agent: string, kind: EchoKind): Echo | undefined {
		const echoes = this.agents.get(agent);
		if (!echoes) return undefined;
		let strongest: Echo | undefined;
		for (const e of echoes) {
			if (e.kind !== kind) continue;
			if (!strongest || Math.abs(e.weight) > Math.abs(strongest.weight)) {
				strongest = e;
			}
		}
		return strongest;
	}

	decayAll(cycle: number): DecayResult {
		const evicted: Echo[] = [];
		const thresholdsCrossed: Echo[] = [];

		for (const [agentName, echoes] of this.agents) {
			const kept: Echo[] = [];
			for (const e of echoes) {
				const wasAbove30 = Math.abs(e.weight) > 30;
				const decayed = e.weight > 0
					? Math.max(0, e.weight - e.decay)
					: Math.min(0, e.weight + e.decay);
				if (Math.abs(decayed) <= EVICTION_THRESHOLD) {
					evicted.push(e);
					continue;
				}
				const updated: Echo = { ...e, weight: decayed };
				const nowAbove30 = Math.abs(updated.weight) > 30;
				// Report echoes that are above 30 after decay (for narrative)
				if (nowAbove30 && !wasAbove30) {
					thresholdsCrossed.push(updated);
				}
				kept.push(updated);
			}
			this.agents.set(agentName, kept);
		}
		// Collect habits formed since last decay (tracked in addEcho)
		const habitsFormed = [...this.pendingHabits];
		this.pendingHabits = [];
		return { evicted, thresholdsCrossed, habitsFormed };
	}

	getCascadeBudget(): number {
		return this.cascadeBudget;
	}

	consumeCascade(): boolean {
		if (this.cascadeBudget <= 0) return false;
		this.cascadeBudget--;
		return true;
	}

	resetCascadeBudget(): void {
		this.cascadeBudget = MAX_CASCADE_BUDGET;
	}

	serialize(): Record<string, Echo[]> {
		const result: Record<string, Echo[]> = {};
		for (const [agent, echoes] of this.agents) {
			result[agent] = [...echoes];
		}
		return result;
	}

	restore(data: Record<string, Echo[]>): void {
		this.agents.clear();
		for (const [agent, echoes] of Object.entries(data)) {
			this.agents.set(agent, [...echoes]);
		}
	}

	private getOrCreateAgent(agent: string): Echo[] {
		let echoes = this.agents.get(agent);
		if (!echoes) {
			echoes = [];
			this.agents.set(agent, echoes);
		}
		return echoes;
	}

	private computeDirection(e: Echo, cycle: number): EchoSummary["direction"] {
		if (Math.abs(e.weight) > 50) return "strong";
		if (Math.abs(e.weight) < 10) return "fading";
		if (e.lastReinforcedCycle >= cycle - 1) return "warming";
		if (e.lastReinforcedCycle < cycle - 3) return "cooling";
		return "stable";
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/echo-store.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/echo/echo-store.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/echo/echo-store.test.ts"
git commit -m "feat(echo): implement EchoStore with add, merge, query, decay, eviction"
```

---

### Task 3: EchoStore — Decay, Serialize, DialogueBias, GetPreferences

**Files:**
- Modify: `tests/game/systems/echo/echo-store.test.ts`

- [ ] **Step 1: Write failing tests for decay, serialization, and dialogue bias**

Add to the existing test file:

```typescript
describe("decayAll", () => {
	it("reduces positive weights toward 0 by decay rate", () => {
		const store = new EchoStore();
		store.addEcho("nova", opinion("atlas", 10), 1);
		store.decayAll(2);
		expect(store.queryWeight("nova", "opinion", "atlas")).toBe(7); // 10 - 3
	});

	it("reduces negative weights toward 0 by decay rate", () => {
		const store = new EchoStore();
		store.addEcho("nova", opinion("atlas", -10), 1);
		store.decayAll(2);
		expect(store.queryWeight("nova", "opinion", "atlas")).toBe(-7);
	});

	it("evicts echoes at |weight| <= 2", () => {
		const store = new EchoStore();
		store.addEcho("nova", { kind: "opinion", source: "x", target: "atlas", weight: 4, decay: 3, tags: [] }, 1);
		const result = store.decayAll(2);
		expect(result.evicted).toHaveLength(1);
		expect(store.queryWeight("nova", "opinion", "atlas")).toBe(0);
	});

	it("reports threshold crossings when |weight| exceeds 30", () => {
		const store = new EchoStore();
		store.addEcho("nova", { kind: "preference", source: "conv", target: "village", weight: 29, decay: 0, tags: [] }, 1);
		// Reinforce past 30
		store.addEcho("nova", { kind: "preference", source: "conv", target: "village", weight: 5, decay: 0, tags: [] }, 2);
		// weight is now 34, run decay with 0 decay rate
		const result = store.decayAll(3);
		expect(result.thresholdsCrossed.length).toBeGreaterThanOrEqual(1);
	});
});

describe("serialize / restore", () => {
	it("round-trips echo data", () => {
		const store = new EchoStore();
		store.addEcho("nova", opinion("atlas", 15), 1);
		store.addEcho("orion", bond("cat-hub", 20), 1);
		const data = store.serialize();

		const store2 = new EchoStore();
		store2.restore(data);
		expect(store2.queryWeight("nova", "opinion", "atlas")).toBe(15);
		expect(store2.queryWeight("orion", "bond", "cat-hub")).toBe(20);
	});
});

describe("getDialogueBias", () => {
	it("returns empty bias for unknown agent", () => {
		const store = new EchoStore();
		const bias = store.getDialogueBias("nobody");
		expect(bias.moodOverride).toBeUndefined();
		expect(bias.moodResidueWeight).toBe(0);
		expect(bias.targetOpinions.size).toBe(0);
	});

	it("computes mood override from mood-residue", () => {
		const store = new EchoStore();
		store.addEcho("nova", { kind: "mood-residue", source: "morale", weight: -15, decay: 3, tags: [] }, 1);
		const bias = store.getDialogueBias("nova");
		expect(bias.moodOverride).toBe("tired");
		expect(bias.moodResidueWeight).toBe(-15);
	});

	it("aggregates opinion echoes into targetOpinions map", () => {
		const store = new EchoStore();
		store.addEcho("nova", opinion("atlas", 12), 1);
		store.addEcho("nova", opinion("orion", -8), 1);
		const bias = store.getDialogueBias("nova");
		expect(bias.targetOpinions.get("atlas")).toBe(12);
		expect(bias.targetOpinions.get("orion")).toBe(-8);
	});
});

describe("getPreferences", () => {
	it("returns empty array for unknown agent", () => {
		const store = new EchoStore();
		expect(store.getPreferences("nobody")).toEqual([]);
	});

	it("filters out echoes below display threshold (±5)", () => {
		const store = new EchoStore();
		store.addEcho("nova", opinion("atlas", 3), 1);
		store.addEcho("nova", opinion("orion", 10), 1);
		const prefs = store.getPreferences("nova");
		expect(prefs).toHaveLength(1);
		expect(prefs[0].target).toBe("orion");
	});

	it("sorts by absolute weight descending", () => {
		const store = new EchoStore();
		store.addEcho("nova", opinion("atlas", 10), 1);
		store.addEcho("nova", opinion("orion", -20), 1);
		store.addEcho("nova", bond("dog", 15), 1);
		const prefs = store.getPreferences("nova");
		expect(prefs[0].weight).toBe(-20);
		expect(prefs[1].weight).toBe(15);
		expect(prefs[2].weight).toBe(10);
	});
});

describe("cascade budget", () => {
	it("starts at 5", () => {
		const store = new EchoStore();
		expect(store.getCascadeBudget()).toBe(5);
	});

	it("decrements on consume and returns false when exhausted", () => {
		const store = new EchoStore();
		for (let i = 0; i < 5; i++) expect(store.consumeCascade()).toBe(true);
		expect(store.consumeCascade()).toBe(false);
		expect(store.getCascadeBudget()).toBe(0);
	});

	it("resets budget", () => {
		const store = new EchoStore();
		store.consumeCascade();
		store.resetCascadeBudget();
		expect(store.getCascadeBudget()).toBe(5);
	});
});
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/echo-store.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/tests/game/systems/echo/echo-store.test.ts"
git commit -m "test(echo): add decay, serialize, dialogueBias, getPreferences, cascade budget tests"
```

---

## Chunk 2: EchoProducer + CascadeResolver

### Task 4: EchoProducer

**Files:**
- Create: `src/game/systems/echo/echo-producer.ts`
- Create: `tests/game/systems/echo/echo-producer.test.ts`

- [ ] **Step 1: Write failing tests for EchoProducer**

```typescript
// tests/game/systems/echo/echo-producer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EchoProducer } from "../../../../src/game/systems/echo/echo-producer.js";
import { EchoStore } from "../../../../src/game/systems/echo/echo-store.js";

describe("EchoProducer", () => {
	let store: EchoStore;
	let producer: EchoProducer;

	beforeEach(() => {
		store = new EchoStore();
		producer = new EchoProducer(store);
	});

	describe("onConversation", () => {
		it("creates opinion echo for friend+ tier conversations", () => {
			producer.onConversation("nova", "atlas", "friend", 1);
			expect(store.queryWeight("nova", "opinion", "atlas")).toBe(5);
			expect(store.queryWeight("atlas", "opinion", "nova")).toBe(5);
		});

		it("ignores acquaintance tier conversations", () => {
			producer.onConversation("nova", "atlas", "acquaintance", 1);
			expect(store.queryWeight("nova", "opinion", "atlas")).toBe(0);
		});
	});

	describe("onTaskComplete", () => {
		it("creates preference echo on success", () => {
			producer.onTaskComplete("nova", "review", true, 1);
			expect(store.queryWeight("nova", "preference", "review")).toBe(10);
		});

		it("creates aversion echo on failure", () => {
			producer.onTaskComplete("nova", "deploy", false, 1);
			expect(store.queryWeight("nova", "aversion", "deploy")).toBe(-15);
		});
	});

	describe("onMorale", () => {
		it("creates negative mood-residue when morale drops below 20", () => {
			producer.onMorale("nova", 15, 1);
			expect(store.queryWeight("nova", "mood-residue")).toBe(-10);
		});

		it("creates positive mood-residue when morale exceeds 80", () => {
			producer.onMorale("nova", 85, 1);
			expect(store.queryWeight("nova", "mood-residue")).toBe(8);
		});

		it("ignores morale in normal range", () => {
			producer.onMorale("nova", 50, 1);
			expect(store.queryWeight("nova", "mood-residue")).toBe(0);
		});
	});

	describe("cooldown", () => {
		it("prevents same source from producing echoes twice in one cycle", () => {
			producer.onTaskComplete("nova", "review", true, 1);
			producer.onTaskComplete("nova", "review", true, 1); // same cycle
			expect(store.queryWeight("nova", "preference", "review")).toBe(10); // not 20
		});

		it("allows echo in next cycle", () => {
			producer.onTaskComplete("nova", "review", true, 1);
			producer.onTaskComplete("nova", "review", true, 2); // different cycle
			expect(store.queryWeight("nova", "preference", "review")).toBe(20);
		});
	});

	describe("onGossipHeard", () => {
		it("creates reputation echo on listener", () => {
			producer.onGossipHeard("nova", "atlas", "orion", 1);
			// nova hears gossip about orion from atlas
			expect(store.queryWeight("nova", "reputation", "orion")).not.toBe(0);
		});
	});

	describe("onPetComfort", () => {
		it("creates bond echo on both agent and pet", () => {
			producer.onPetComfort("nova", "cat-hub", 1);
			expect(store.queryWeight("nova", "bond", "cat-hub")).toBe(10);
		});
	});

	describe("onSnackStolen", () => {
		it("creates aversion echo toward the pet", () => {
			producer.onSnackStolen("nova", "cat-hub", 1);
			expect(store.queryWeight("nova", "aversion", "cat-hub")).toBe(-8);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/echo-producer.test.ts`
Expected: FAIL — cannot find module echo-producer

- [ ] **Step 3: Implement EchoProducer**

```typescript
// src/game/systems/echo/echo-producer.ts
import type { IEchoStore, EchoInput, AddResult } from "./echo-types.js";

type RelTier = "rival" | "acquaintance" | "colleague" | "friend" | "best-friend";

const FRIEND_PLUS: ReadonlySet<string> = new Set(["friend", "best-friend"]);

export class EchoProducer {
	private cooldowns = new Map<string, number>(); // "agent:source:target" → cycle
	private readonly store: IEchoStore;

	constructor(store: IEchoStore) {
		this.store = store;
	}

	onConversation(agentA: string, agentB: string, tier: RelTier, cycle: number): void {
		if (!FRIEND_PLUS.has(tier)) return;
		this.tryAdd(agentA, { kind: "opinion", source: "conversation", target: agentB, weight: 5, decay: 3, tags: ["social"] }, cycle);
		this.tryAdd(agentB, { kind: "opinion", source: "conversation", target: agentA, weight: 5, decay: 3, tags: ["social"] }, cycle);
	}

	onRivalConversation(agentA: string, agentB: string, cycle: number): void {
		this.tryAdd(agentA, { kind: "opinion", source: "rivalry", target: agentB, weight: -6, decay: 2, tags: ["social", "rivalry"] }, cycle);
		this.tryAdd(agentB, { kind: "opinion", source: "rivalry", target: agentA, weight: -6, decay: 2, tags: ["social", "rivalry"] }, cycle);
	}

	onDrama(agentA: string, agentB: string, positive: boolean, cycle: number): void {
		const weight = positive ? 15 : -15;
		this.tryAdd(agentA, { kind: "opinion", source: "drama", target: agentB, weight, decay: 1, tags: ["social", "drama"] }, cycle);
		this.tryAdd(agentB, { kind: "opinion", source: "drama", target: agentA, weight, decay: 1, tags: ["social", "drama"] }, cycle);
	}

	onTaskComplete(agent: string, taskType: string, success: boolean, cycle: number): void {
		if (success) {
			this.tryAdd(agent, { kind: "preference", source: "task", target: taskType, weight: 10, decay: 2, tags: ["work"] }, cycle);
		} else {
			this.tryAdd(agent, { kind: "aversion", source: "task-fail", target: taskType, weight: -15, decay: 2, tags: ["work", "failure"] }, cycle);
		}
	}

	onMorale(agent: string, morale: number, cycle: number): void {
		if (morale < 20) {
			this.tryAdd(agent, { kind: "mood-residue", source: "morale", weight: -10, decay: 3, tags: ["mood"] }, cycle);
		} else if (morale > 80) {
			this.tryAdd(agent, { kind: "mood-residue", source: "morale", weight: 8, decay: 4, tags: ["mood"] }, cycle);
		}
	}

	onGossipHeard(listener: string, gossiper: string, subject: string, cycle: number): void {
		this.tryAdd(listener, { kind: "reputation", source: `gossip:${gossiper}`, target: subject, weight: -8, decay: 2, tags: ["social", "gossip"] }, cycle);
	}

	onGossipOverheard(subject: string, gossiper: string, cycle: number): void {
		this.tryAdd(subject, { kind: "opinion", source: "overheard-gossip", target: gossiper, weight: -12, decay: 1, tags: ["social", "gossip"] }, cycle);
	}

	onPetComfort(agent: string, petId: string, cycle: number): void {
		this.tryAdd(agent, { kind: "bond", source: "pet-comfort", target: petId, weight: 10, decay: 1, tags: ["pet"] }, cycle);
	}

	onSnackStolen(agent: string, petId: string, cycle: number): void {
		this.tryAdd(agent, { kind: "aversion", source: "pet-steal", target: petId, weight: -8, decay: 4, tags: ["pet"] }, cycle);
	}

	onFedByDirector(agent: string, cycle: number): void {
		this.tryAdd(agent, { kind: "bond", source: "director-feed", target: "director", weight: 8, decay: 2, tags: ["care"] }, cycle);
	}

	onRunningJoke(agentA: string, agentB: string, jokeId: string, cycle: number): void {
		this.tryAdd(agentA, { kind: "memory", source: "joke", target: jokeId, weight: 4, decay: 5, tags: ["social", "joke"] }, cycle);
		this.tryAdd(agentB, { kind: "memory", source: "joke", target: jokeId, weight: 4, decay: 5, tags: ["social", "joke"] }, cycle);
	}

	onPairedWork(agentA: string, agentB: string, cycle: number): void {
		this.tryAdd(agentA, { kind: "preference", source: "paired-work", target: agentB, weight: 5, decay: 2, tags: ["work"] }, cycle);
		this.tryAdd(agentB, { kind: "preference", source: "paired-work", target: agentA, weight: 5, decay: 2, tags: ["work"] }, cycle);
	}

	onRitual(agent: string, ritualType: string, cycle: number): void {
		this.tryAdd(agent, { kind: "preference", source: "ritual", target: ritualType, weight: 3, decay: 4, tags: ["social", "ritual"] }, cycle);
	}

	onMerchantPurchase(agent: string, cycle: number): void {
		this.tryAdd(agent, { kind: "opinion", source: "merchant", target: "director", weight: 6, decay: 3, tags: ["economy"] }, cycle);
	}

	onNeedsNeglected(agent: string, cycle: number): void {
		this.tryAdd(agent, { kind: "aversion", source: "neglect", target: "needs", weight: -6, decay: 3, tags: ["care"] }, cycle);
	}

	onLevelUp(agent: string, cycle: number): void {
		this.tryAdd(agent, { kind: "mood-residue", source: "level-up", weight: 12, decay: 2, tags: ["economy", "milestone"] }, cycle);
	}

	onOfflineReturn(agent: string, cycle: number): void {
		this.tryAdd(agent, { kind: "mood-residue", source: "offline-return", weight: 5, decay: 4, tags: ["offline"] }, cycle);
	}

	private tryAdd(agent: string, echo: EchoInput, cycle: number): AddResult | undefined {
		const cooldownKey = `${agent}:${echo.source}:${echo.target ?? ""}`;
		const lastCycle = this.cooldowns.get(cooldownKey);
		if (lastCycle === cycle) return undefined;
		this.cooldowns.set(cooldownKey, cycle);
		return this.store.addEcho(agent, echo, cycle);
	}
}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/echo-producer.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/echo/echo-producer.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/echo/echo-producer.test.ts"
git commit -m "feat(echo): implement EchoProducer with event mapping, cooldowns, and significance gates"
```

---

### Task 5: CascadeResolver

**Files:**
- Create: `src/game/systems/echo/cascade-resolver.ts`
- Create: `tests/game/systems/echo/cascade-resolver.test.ts`

- [ ] **Step 1: Write failing tests for CascadeResolver**

```typescript
// tests/game/systems/echo/cascade-resolver.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CascadeResolver } from "../../../../src/game/systems/echo/cascade-resolver.js";
import { EchoStore } from "../../../../src/game/systems/echo/echo-store.js";
import type { Echo, CascadeChain } from "../../../../src/game/systems/echo/echo-types.js";

function makeEcho(overrides: Partial<Echo> = {}): Echo {
	return {
		id: "echo:opinion:atlas:c1",
		kind: "opinion",
		source: "conversation",
		target: "atlas",
		weight: -25,
		decay: 2,
		reinforcements: 0,
		tags: ["social"],
		cycleCreated: 1,
		...overrides,
	};
}

describe("CascadeResolver", () => {
	let store: EchoStore;
	let resolver: CascadeResolver;

	beforeEach(() => {
		store = new EchoStore();
		resolver = new CascadeResolver(store);
	});

	describe("shouldCascade", () => {
		it("returns false when budget exhausted", () => {
			for (let i = 0; i < 5; i++) store.consumeCascade();
			const echo = makeEcho({ weight: -25 });
			expect(resolver.shouldCascade("nova", echo)).toBe(false);
		});

		it("returns false when echo below cascade threshold", () => {
			const echo = makeEcho({ weight: -10 });
			expect(resolver.shouldCascade("nova", echo)).toBe(false);
		});

		it("returns true for echo above threshold with available budget", () => {
			const echo = makeEcho({ weight: -25 });
			// Note: shouldCascade uses probability, so we test with a seeded approach
			// For deterministic testing, we test the threshold logic separately
			expect(resolver.shouldCascade("nova", echo, 1.0)).toBe(true); // force probability
		});

		it("respects per-agent cooldown", () => {
			const echo = makeEcho({ weight: -25 });
			resolver.shouldCascade("nova", echo, 1.0); // first cascade
			resolver.recordAgentCascade("nova");
			expect(resolver.shouldCascade("nova", echo, 1.0)).toBe(false);
		});
	});

	describe("cascade probability", () => {
		it("computes min(0.6, 0.3 + |weight|/100)", () => {
			expect(resolver.computeProbability(15)).toBeCloseTo(0.45);
			expect(resolver.computeProbability(30)).toBeCloseTo(0.60);
			expect(resolver.computeProbability(100)).toBeCloseTo(0.60);
			expect(resolver.computeProbability(-20)).toBeCloseTo(0.50);
		});
	});

	describe("loop detection", () => {
		it("blocks cascade when visited set contains the key", () => {
			const chain: CascadeChain = {
				depth: 1,
				visited: new Set(["opinion:conversation:atlas"]),
				rootEchoId: "root",
			};
			const echo = makeEcho();
			expect(resolver.isLooping(echo, chain)).toBe(true);
		});

		it("allows cascade for unvisited key", () => {
			const chain: CascadeChain = {
				depth: 0,
				visited: new Set(),
				rootEchoId: "root",
			};
			const echo = makeEcho();
			expect(resolver.isLooping(echo, chain)).toBe(false);
		});
	});

	describe("depth limit", () => {
		it("blocks cascade at depth >= 3", () => {
			const chain: CascadeChain = { depth: 3, visited: new Set(), rootEchoId: "root" };
			expect(resolver.isAtMaxDepth(chain)).toBe(true);
		});

		it("allows cascade at depth < 3", () => {
			const chain: CascadeChain = { depth: 2, visited: new Set(), rootEchoId: "root" };
			expect(resolver.isAtMaxDepth(chain)).toBe(false);
		});
	});

	describe("dampening", () => {
		it("applies 0.6x weight per hop", () => {
			expect(resolver.dampen(20)).toBeCloseTo(12);
			expect(resolver.dampen(-10)).toBeCloseTo(-6);
		});
	});

	describe("selectReaction", () => {
		it("selects vent for opinion below -20", () => {
			const echo = makeEcho({ kind: "opinion", weight: -25 });
			const reaction = resolver.selectReaction("nova", echo);
			expect(reaction?.type).toBe("vent");
		});

		it("selects seek-proximity for bond above 25", () => {
			const echo = makeEcho({ kind: "bond", weight: 30, target: "atlas" });
			const reaction = resolver.selectReaction("nova", echo);
			expect(reaction?.type).toBe("seek-proximity");
		});

		it("selects force-break for mood-residue below -15", () => {
			const echo = makeEcho({ kind: "mood-residue", weight: -20 });
			const reaction = resolver.selectReaction("nova", echo);
			expect(reaction?.type).toBe("force-break");
		});

		it("returns undefined for echo not matching any reaction", () => {
			const echo = makeEcho({ kind: "preference", weight: 10 });
			const reaction = resolver.selectReaction("nova", echo);
			expect(reaction).toBeUndefined();
		});
	});

	describe("resetCycle", () => {
		it("clears per-agent cooldowns", () => {
			resolver.recordAgentCascade("nova");
			resolver.resetCycle();
			const echo = makeEcho({ weight: -25 });
			expect(resolver.shouldCascade("nova", echo, 1.0)).toBe(true);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/cascade-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement CascadeResolver**

```typescript
// src/game/systems/echo/cascade-resolver.ts
import type { Echo, CascadeChain, IEchoStore } from "./echo-types.js";

const CASCADE_THRESHOLD = 15;
const MAX_DEPTH = 3;
const DAMPEN_FACTOR = 0.6;

export interface CascadeReaction {
	readonly type: "vent" | "seek-proximity" | "force-break" | "avoid-room" | "adjust-opinion" | "gossip-forward";
	readonly agent: string;
	readonly target?: string;
	readonly weight: number;
}

export class CascadeResolver {
	private readonly store: IEchoStore;
	private agentCooldowns = new Set<string>();

	constructor(store: IEchoStore) {
		this.store = store;
	}

	shouldCascade(agent: string, echo: Echo, forceProbability?: number): boolean {
		if (this.store.getCascadeBudget() <= 0) return false;
		if (Math.abs(echo.weight) < CASCADE_THRESHOLD) return false;
		if (this.agentCooldowns.has(agent)) return false;
		const prob = forceProbability ?? this.computeProbability(echo.weight);
		return Math.random() < prob;
	}

	computeProbability(weight: number): number {
		return Math.min(0.6, 0.3 + Math.abs(weight) / 100);
	}

	isLooping(echo: Echo, chain: CascadeChain): boolean {
		const key = `${echo.kind}:${echo.source}:${echo.target ?? ""}`;
		return chain.visited.has(key);
	}

	isAtMaxDepth(chain: CascadeChain): boolean {
		return chain.depth >= MAX_DEPTH;
	}

	dampen(weight: number): number {
		return weight * DAMPEN_FACTOR;
	}

	selectReaction(agent: string, echo: Echo): CascadeReaction | undefined {
		if (echo.kind === "opinion" && echo.weight < -20) {
			return { type: "vent", agent, target: echo.target, weight: echo.weight };
		}
		if (echo.kind === "bond" && echo.weight > 25) {
			return { type: "seek-proximity", agent, target: echo.target, weight: echo.weight };
		}
		if (echo.kind === "mood-residue" && echo.weight < -15) {
			return { type: "force-break", agent, weight: echo.weight };
		}
		if (echo.kind === "aversion" && Math.abs(echo.weight) > 15) {
			return { type: "avoid-room", agent, target: echo.target, weight: echo.weight };
		}
		if (echo.kind === "reputation") {
			return { type: "adjust-opinion", agent, target: echo.target, weight: echo.weight * 0.5 };
		}
		return undefined;
	}

	recordAgentCascade(agent: string): void {
		this.agentCooldowns.add(agent);
	}

	resetCycle(): void {
		this.agentCooldowns.clear();
	}

	createChain(rootEchoId: string): CascadeChain {
		return { depth: 0, visited: new Set(), rootEchoId };
	}

	extendChain(chain: CascadeChain, echo: Echo): CascadeChain {
		const key = `${echo.kind}:${echo.source}:${echo.target ?? ""}`;
		const visited = new Set(chain.visited);
		visited.add(key);
		return { depth: chain.depth + 1, visited, rootEchoId: chain.rootEchoId };
	}
}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/cascade-resolver.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/echo/cascade-resolver.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/echo/cascade-resolver.test.ts"
git commit -m "feat(echo): implement CascadeResolver with probability, loop detection, dampening, reactions"
```

---

### Task 6: Barrel Export

**Files:**
- Create: `src/game/systems/echo/index.ts`

- [ ] **Step 1: Create barrel export**

```typescript
// src/game/systems/echo/index.ts
export { EchoStore } from "./echo-store.js";
export { EchoProducer } from "./echo-producer.js";
export { CascadeResolver } from "./cascade-resolver.js";
export type {
	Echo,
	EchoKind,
	EchoInput,
	DialogueBias,
	EchoSummary,
	DecayResult,
	AddResult,
	CascadeChain,
	IEchoStore,
} from "./echo-types.js";
export type { CascadeReaction } from "./cascade-resolver.js";
```

- [ ] **Step 2: Run all echo tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/`
Expected: All PASS

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "echo"`
Expected: No errors from echo files

- [ ] **Step 4: Lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/game/systems/echo/`
Expected: 0 errors, 0 warnings

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/echo/index.ts"
git commit -m "feat(echo): add barrel export for Echo System"
```

---

## Chunk 3: Engine Integration

### Task 7: Persistence (engine-state.ts)

**Files:**
- Modify: `src/game/engine-state.ts`

**Reference:** Read `src/game/engine-state.ts` first — find the existing `saveJson`/`loadJson`/`varDir` utilities and the `restoreWorldState`/`saveWorldState` functions. Add echo save/restore alongside existing patterns.

- [ ] **Step 1: Read engine-state.ts to find insertion points**

Read: `src/game/engine-state.ts`
Note the pattern for `world-memory.json`, `world-relationships.json` — follow the same structure.

- [ ] **Step 2: Add saveEchoes and restoreEchoes functions**

Add after the existing save/restore functions:

```typescript
import type { IEchoStore, Echo } from "./systems/echo/echo-types.js";

export function saveEchoes(echoStore: IEchoStore, vaultPath: string): void {
	saveJson(join(varDir(vaultPath), "world-echoes.json"), echoStore.serialize());
}

export function restoreEchoes(echoStore: IEchoStore, vaultPath: string): void {
	const data = loadJson(join(varDir(vaultPath), "world-echoes.json"));
	if (data) echoStore.restore(data as Record<string, Echo[]>);
}
```

- [ ] **Step 3: Add echo save to existing saveWorldState function**

Find the `saveWorldState` function and add `saveEchoes(ctx.echoes, vaultPath)` alongside the existing saves. If the function takes a `StateSystems` context, add `echoes: IEchoStore` to the type.

- [ ] **Step 4: Add echo restore to existing restoreWorldState function**

Find the `restoreWorldState` function and add the restore call.

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "echo\|engine-state"`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-state.ts"
git commit -m "feat(echo): add echo persistence to engine-state (save/restore)"
```

---

### Task 8: Engine Types (IEchoStore in EngineSystems)

**Files:**
- Modify: `src/game/engine-types.ts`

- [ ] **Step 1: Read engine-types.ts to find EngineSystems interface**

Read: `src/game/engine-types.ts`
Find the `EngineSystems` interface (or equivalent) that holds references to all game systems.

- [ ] **Step 2: Add IEchoStore to the systems interface**

Add the import and field:

```typescript
import type { IEchoStore } from "./systems/echo/echo-types.js";

// In EngineSystems (or equivalent interface):
echo: IEchoStore;
```

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "engine-types"`
Expected: Errors from engine.ts (not yet providing `echo` field) — this is expected until Task 9.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-types.ts"
git commit -m "feat(echo): add IEchoStore to EngineSystems interface"
```

---

### Task 9: Engine Bootstrap (engine.ts)

**Files:**
- Modify: `src/game/engine.ts`

**Reference:** Read `src/game/engine.ts` — find where other systems are instantiated (TalkEngine, ConversationEngine, RelationshipSystem). Add EchoStore + EchoProducer + CascadeResolver instantiation alongside them.

- [ ] **Step 1: Read engine.ts to find instantiation section**

Read: `src/game/engine.ts` (lines 240-300 approximately — where TalkEngine and ConversationEngine are constructed)

- [ ] **Step 2: Import and instantiate echo system**

```typescript
import { EchoStore, EchoProducer, CascadeResolver } from "./systems/echo/index.js";

// After relationship system construction:
const echoStore = new EchoStore();
const echoProducer = new EchoProducer(echoStore);
const cascadeResolver = new CascadeResolver(echoStore);
```

- [ ] **Step 3: Wire getEchoBias into TalkEngine enrichment**

Find the existing TalkEngine construction (the enrichment is the second argument). **Do not reconstruct** — add `getEchoBias` to the existing enrichment object literal:

```typescript
// Find the existing enrichment object and add getEchoBias to it:
{
	composer: fragmentComposer,
	getTier: (a, b) => relationshipSystem.getTier(a, b),
	getEchoBias: (agent) => echoStore.getDialogueBias(agent), // ADD THIS LINE
}
```

- [ ] **Step 4: Add echoStore to the systems object passed to simulation**

Find where the systems object is assembled (the `sys` or `systems` variable) and add `echo: echoStore`.

- [ ] **Step 5: Wire save/restore calls**

Find where `saveWorldState` / `restoreWorldState` are called and add the echo store to the context.

- [ ] **Step 6: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -E "echo|engine\.ts"`
Expected: May still have errors from engine-simulation.ts — expected until Task 10.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(echo): wire EchoStore, EchoProducer, CascadeResolver into engine bootstrap"
```

---

### Task 10: Engine Simulation Integration

**Files:**
- Modify: `src/game/engine-simulation.ts`

**Reference:** Read `src/game/engine-simulation.ts` — find:
- `tickClock` (cycle boundary logic, ~line 100-130)
- `tickBehaviorTree` (BT action processing, ~line 430-475)
- `tickSocial` (conversation calls, ~line 528-560)
- The conversation `recordConversation` callback wiring

- [ ] **Step 1: Read engine-simulation.ts to find insertion points**

Read the relevant sections — cycle boundary, BT processing, social tick.

- [ ] **Step 2: Add echo decay at cycle boundary**

In `tickClock` where cycle boundary logic runs (near `onCycleEnd`):

```typescript
// At cycle boundary:
const decayResult = sys.echo.decayAll(currentCycle);
sys.echo.resetCascadeBudget();
cascadeResolver.resetCycle();
// Route narrative beats (when narrative system is available):
// decayResult.evicted → resolution beats
// decayResult.thresholdsCrossed → threshold beats
// decayResult.habitsFormed → habit beats
```

- [ ] **Step 3: Wire EchoProducer to existing conversation callbacks**

Where `conversation.recordConversation` is called or where `tryScript` returns true, add echo producer calls:

```typescript
// After successful conversation:
echoProducer.onConversation(agentA, agentB, tier, currentCycle);

// In gossip trigger:
echoProducer.onGossipHeard(listener, gossiper, subject, currentCycle);
```

- [ ] **Step 4: Wire morale-based echo production in tickNeeds**

Find where morale is updated and add:

```typescript
if (moraleChanged) {
	echoProducer.onMorale(agentName, newMorale, currentCycle);
}
```

- [ ] **Step 5: Run all tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/ tests/game/systems/talk/ tests/game/systems/relationship-system/`
Expected: All echo tests pass. Existing talk/relationship tests still pass.

- [ ] **Step 6: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "echo\|simulation"`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(echo): wire echo decay, producer callbacks, and cascade reset into simulation loop"
```

---

## Chunk 4: System Integration

### Task 11: TalkEngine Dialogue Bias

**Files:**
- Modify: `src/game/systems/talk/talk-engine.ts`

**Reference:** Read `src/game/systems/talk/talk-engine.ts` — find `TalkEngineEnrichment` interface and the `update()` / `resolvePhrase()` method. Note: `resolvePhrase()` is a null-coalescing chain expression (`??`), so echo bias is applied **before** calling `resolvePhrase()` — by mutating `entry.vars` in the `update()` method where per-agent vars are already being set.

- [ ] **Step 1: Read talk-engine.ts**

Find: `TalkEngineEnrichment` interface, the `update()` method that calls `resolvePhrase()`, and the point where `entry.vars` is updated before phrase resolution.

- [ ] **Step 2: Extend TalkEngineEnrichment**

```typescript
import type { DialogueBias } from "./echo/echo-types.js";

// Add to existing interface:
export interface TalkEngineEnrichment {
	readonly composer?: FragmentComposer;
	readonly getTier?: (a: string, b: string) => RelationshipTier;
	readonly getEchoBias?: (agent: string) => DialogueBias; // NEW
}
```

Note: import path may need adjustment based on actual file structure (echo-types may be at `../echo/echo-types.js`).

- [ ] **Step 3: Apply echo bias before resolvePhrase()**

In the `update()` method, **before** calling `resolvePhrase()`, add echo bias var mutation:

```typescript
// Before resolvePhrase call — apply echo mood override
if (this.enrichment?.getEchoBias) {
	const bias = this.enrichment.getEchoBias(agentName);
	if (bias.moodOverride) {
		entry.vars = {
			...entry.vars,
			mood: bias.moodOverride,
			mood_adj: bias.moodOverride === "tired" ? "drained" : "energized",
		};
	}
}
```

This works because `resolvePhrase()` reads from `entry.vars` — overriding mood before the call ensures the chain expression picks mood-appropriate templates.

- [ ] **Step 4: Run talk engine tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/talk-engine.test.ts`
Expected: All existing tests still PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/talk-engine.ts"
git commit -m "feat(echo): integrate dialogue bias into TalkEngine via mood override before resolvePhrase"
```

---

### Task 12: BT Context Types + Agent EchoBiasedIdle

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-types.ts` (add echoStore, currentRoom to BTAgentContext and PetBTContext)
- Modify: `src/game/brain/behavior-tree/bt-agent.ts` (add EchoBiasedIdle action function)
- Modify: `src/game/brain/behavior-tree/subtrees/idle.ts` (replace lotto MDSL with EchoBiasedIdle)

**Reference:** Read `bt-types.ts` to find `BTAgentContext` interface (uses `name` field, not `agentName`). Read `subtrees/idle.ts` for the `lotto [1,1,1]` MDSL that needs replacing. Read `bt-agent.ts` for the Wander/Emote/Chatter action functions.

- [ ] **Step 1: Read bt-types.ts, subtrees/idle.ts, and bt-agent.ts**

Find `BTAgentContext` interface in bt-types.ts (note: uses `name` field).
Find the `lotto [1,1,1]` in subtrees/idle.ts.
Find the Wander/Emote/Chatter action functions in bt-agent.ts.

- [ ] **Step 2: Add echoStore and currentRoom to BT context types**

In `bt-types.ts`, add to the `BTAgentContext` interface:

```typescript
import type { IEchoStore } from "../systems/echo/echo-types.js";

// Add to BTAgentContext:
echoStore?: IEchoStore;
currentRoom?: string;
```

Also add to `PetBTContext` (for Task 13):

```typescript
// Add to PetBTContext:
echoStore?: IEchoStore;
```

- [ ] **Step 3: Add EchoBiasedIdle action to bt-agent.ts**

```typescript
function echoBiasedWeightedRandom(weights: number[]): number {
	const total = weights.reduce((s, w) => s + w, 0);
	let roll = Math.random() * total;
	for (let i = 0; i < weights.length; i++) {
		roll -= weights[i];
		if (roll <= 0) return i;
	}
	return weights.length - 1;
}

function EchoBiasedIdle(): State {
	const bondBias = context.echoStore
		? context.echoStore.queryWeight(context.name, "bond") : 0;
	const prefBias = context.echoStore
		? context.echoStore.queryWeight(context.name, "preference", context.currentRoom ?? "") : 0;
	const clampedBond = Math.max(-50, Math.min(50, bondBias));
	const clampedPref = Math.max(-50, Math.min(50, prefBias));
	const wanderWeight = 1 + clampedPref / 100;
	const socialWeight = 1 + clampedBond / 100;
	const pick = echoBiasedWeightedRandom([wanderWeight, 1, socialWeight]);
	if (pick === 2) {
		collect("speaking", { text: "", source: "chatter" });
	} else {
		collect("idle", {});
	}
	return fromNodeState("succeeded");
}
```

- [ ] **Step 4: Replace lotto in subtrees/idle.ts with EchoBiasedIdle**

Replace the `lotto [1,1,1] { action [Wander] action [Emote] action [Chatter] }` node with `action [EchoBiasedIdle]`.

- [ ] **Step 5: Inject echoStore into agent BT context construction**

Find where BTAgentContext is created (in engine.ts or engine-simulation.ts) and pass `echoStore` and `currentRoom`.

- [ ] **Step 6: Run agent BT tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/`
Expected: All PASS (adjust tests that reference the old lotto structure)

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-agent.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/idle.ts"
git commit -m "feat(echo): add BT context types and EchoBiasedIdle replacing static idle lotto"
```

---

### Task 13: Pet BT — Echo Multipliers

**Files:**
- Modify: `src/game/brain/behavior-tree/pet-bt.ts`

**Reference:** Read `pet-bt.ts` — find `CatalystChanceRoll` and `SleepChanceRoll` functions.

- [ ] **Step 1: Read pet-bt.ts chance-roll functions**

Find the exact functions and their current thresholds.

- [ ] **Step 2: Add echo multiplier to CatalystChanceRoll**

```typescript
function CatalystChanceRoll(): boolean {
	const bondBias = context.echoStore
		? context.echoStore.queryWeight(context.entityId, "bond") : 0;
	const multiplier = 1 + Math.max(-50, Math.min(50, bondBias)) / 100;
	return context.state === "idle" && Math.random() < 0.02 * multiplier;
}
```

- [ ] **Step 3: Inject echoStore into pet BT context**

Find where the pet BT context is constructed and pass `echoStore`. The `PetBTContext` was already extended in Task 12 Step 2.

- [ ] **Step 4: Run pet BT tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/pet-bt.ts"
git commit -m "feat(echo): add echo bond multiplier to pet catalyst chance roll"
```

---

### Task 14: Relationship Drift

**Files:**
- Modify: `src/game/systems/relationship-system.ts`

**Reference:** Read `relationship-system.ts` — find `onCycleEnd()`.

- [ ] **Step 1: Read relationship-system.ts**

Find the `onCycleEnd()` method and understand how it currently processes pairs.

- [ ] **Step 2: Add echo-driven affinity drift parameter**

Modify `onCycleEnd()` to accept an optional `echoStore` parameter (or a callback):

```typescript
onCycleEnd(echoStore?: IEchoStore): void {
	// Existing decay logic...

	// Echo-driven drift
	if (echoStore) {
		for (const [key, entry] of this.relationships) {
			const [a, b] = key.split("::");
			const opinionAtoB = echoStore.queryWeight(a, "opinion", b);
			const opinionBtoA = echoStore.queryWeight(b, "opinion", a);
			const netOpinion = opinionAtoB + opinionBtoA;
			if (netOpinion > 0) {
				entry.affinity = Math.min(100, entry.affinity + 1);
			} else if (netOpinion < 0) {
				entry.affinity = Math.max(-100, entry.affinity - 1);
			}
		}
	}
}
```

- [ ] **Step 3: Run relationship tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/relationship-system/`
Expected: All existing tests still PASS (echoStore param is optional)

- [ ] **Step 4: Wire echoStore in the engine simulation cycle boundary call**

Find where `onCycleEnd()` is called in engine-simulation.ts and pass the echoStore.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/relationship-system.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(echo): add echo-driven affinity drift to relationship system cycle boundary"
```

---

### Task 15: Cascade Queue Processing in Simulation

**Files:**
- Modify: `src/game/engine-simulation.ts`

**Reference:** The spec says cascade reactions are queued and processed at the start of `tickBehaviorTree`. This task implements the queue consumption loop and reaction-to-game-action translation.

- [ ] **Step 1: Read engine-simulation.ts tickBehaviorTree section**

Find where BT actions are processed (around line 430-475).

- [ ] **Step 2: Add cascade reaction queue to the simulation context**

Add a `cascadeQueue` array to the simulation state or closure:

```typescript
interface CascadeQueueEntry {
	agent: string;
	reaction: CascadeReaction;
	chain: CascadeChain;
}
const cascadeQueue: CascadeQueueEntry[] = [];
```

- [ ] **Step 3: Wire EchoProducer addEcho results to cascade queue**

Where `echoProducer.tryAdd` returns a result, check if cascade was triggered:

```typescript
// In EchoProducer.tryAdd or after each producer call in simulation:
// The cascade check happens inside engine-simulation where we have access to both
// echoProducer callbacks and cascadeResolver:
function onEchoAdded(agent: string, result: AddResult): void {
	if (!result.cascadeTriggered) return;
	if (!cascadeResolver.shouldCascade(agent, result.echo)) return;
	if (!store.consumeCascade()) return;
	const reaction = cascadeResolver.selectReaction(agent, result.echo);
	if (!reaction) return;
	const chain = cascadeResolver.createChain(result.echo.id);
	cascadeQueue.push({ agent, reaction, chain });
	cascadeResolver.recordAgentCascade(agent);
}
```

- [ ] **Step 4: Process cascade queue at start of tickBehaviorTree**

At the top of `tickBehaviorTree`, before normal BT evaluation:

```typescript
// Process cascade reactions (max one pass per frame)
while (cascadeQueue.length > 0) {
	const entry = cascadeQueue.shift()!;
	const { reaction, chain } = entry;
	if (cascadeResolver.isAtMaxDepth(chain)) continue;

	switch (reaction.type) {
		case "vent": {
			// Try to start a frustrated conversation with nearest friend
			if (reaction.target) {
				sys.conversation.tryScript(reaction.agent, findNearestFriend(reaction.agent), "proximity", {
					domainA: getDomain(reaction.agent), domainB: getDomain(findNearestFriend(reaction.agent)),
				});
			}
			break;
		}
		case "seek-proximity": {
			// Try to start a conversation with bond target
			if (reaction.target) {
				sys.conversation.tryScript(reaction.agent, reaction.target, "proximity", {
					domainA: getDomain(reaction.agent), domainB: getDomain(reaction.target),
				});
			}
			break;
		}
		case "force-break": {
			sys.brain.forceState(reaction.agent, "on-break");
			break;
		}
		case "adjust-opinion": {
			if (reaction.target) {
				const dampened = cascadeResolver.dampen(reaction.weight);
				const echoKey = { kind: "opinion" as const, source: "reputation", target: reaction.target } as Echo;
				if (!cascadeResolver.isLooping(echoKey, chain)) {
					const extendedChain = cascadeResolver.extendChain(chain, echoKey);
					const result = sys.echo.addEcho(reaction.agent, {
						kind: "opinion", source: "reputation", target: reaction.target,
						weight: dampened, decay: 2, tags: ["social", "gossip"],
					}, currentCycle);
					// If this echo itself triggers a cascade, queue it with the extended chain
					if (result.cascadeTriggered && cascadeResolver.shouldCascade(reaction.agent, result.echo)) {
						const nextReaction = cascadeResolver.selectReaction(reaction.agent, result.echo);
						if (nextReaction && store.consumeCascade()) {
							cascadeQueue.push({ agent: reaction.agent, reaction: nextReaction, chain: extendedChain });
						}
					}
				}
			}
			break;
		}
		case "avoid-room":
			// Handled passively by echo preferences in pickWanderTarget
			break;
	}
}
```

- [ ] **Step 5: Type check and run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "simulation"`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(echo): implement cascade queue processing in tickBehaviorTree"
```

---

### Task 16: Spatial Preferences (pickWanderTarget)

**Files:**
- Modify: `src/game/engine-simulation.ts` (or wherever agent idle movement target is determined)

**Reference:** The spec (Section 4d) describes biasing wander targets based on echo preferences. The `Wander` BT action is a stub that collects `"idle"` — target selection happens at the movement/brain system level.

- [ ] **Step 1: Find where agent idle movement target is selected**

Read `engine-simulation.ts` — find where BT `"idle"` actions are processed and where the agent's wander target position is picked.

- [ ] **Step 2: Add echo-biased wander target selection**

Where idle actions result in movement, add echo bias:

```typescript
function pickEchoBiasedTarget(agentName: string, currentRoom: string, sys: EngineSystems): Vec2 | undefined {
	// Bond bias — 40% chance to gravitate toward bonded agent
	const bondTarget = sys.echo.getStrongest(agentName, "bond");
	if (bondTarget?.target && Math.random() < 0.4) {
		const targetActor = findActorByName(bondTarget.target);
		if (targetActor) {
			return { x: targetActor.pos.x + (Math.random() - 0.5) * 60, y: targetActor.pos.y + (Math.random() - 0.5) * 60 };
		}
	}
	return undefined; // fallback to existing random wander
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(echo): add echo-biased wander target selection for spatial preferences"
```

---

### Task 17: Mood-Residue Break Threshold

**Files:**
- Modify: `src/game/engine-simulation.ts` (in tickNeeds or the BT break condition)

**Reference:** The spec (Section 4a) says negative mood-residue lowers the break-seeking threshold so agents seek breaks earlier.

- [ ] **Step 1: Find break threshold logic**

Read `engine-simulation.ts` — find where the agent's break/rest threshold is evaluated (in tickNeeds or tickBehaviorTree).

- [ ] **Step 2: Add mood-residue modifier to break threshold**

```typescript
// Where break threshold is checked:
const BASE_BREAK_THRESHOLD = 30; // existing threshold value
const moodResidueWeight = sys.echo.queryWeight(agentName, "mood-residue");
const adjustedThreshold = BASE_BREAK_THRESHOLD + Math.max(-20, Math.min(0, moodResidueWeight));
// Negative residue → lower threshold → seeks breaks earlier
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(echo): add mood-residue modifier to agent break-seeking threshold"
```

---

### Task 18: Final Quality Gate & Integration Test

**Files:** None (verification) + optional `tests/game/systems/echo/echo-integration.test.ts`

- [ ] **Step 1: Run all echo tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/echo/`
Expected: All PASS

- [ ] **Step 2: Run all talk + relationship tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/ tests/game/systems/relationship-system/ tests/game/brain/`
Expected: All PASS — no regressions

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v node_modules`
Expected: Only pre-existing errors (economy-visuals, http-project-service, vault-project-service, test mocks)

- [ ] **Step 4: Lint echo files**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/game/systems/echo/`
Expected: 0 errors, 0 warnings. All files under 400 lines.

- [ ] **Step 5: Commit any final fixes**

If any quality gate failures were found and fixed, commit them.

```bash
git commit -m "fix(echo): resolve quality gate issues"
```
