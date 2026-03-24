import { describe, it, expect, beforeEach } from "vitest";
import { CascadeResolver } from "../../../../src/game/systems/echo/cascade-resolver.js";
import type { Echo, IEchoStore } from "../../../../src/game/systems/echo/echo-types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeEcho(overrides: Partial<Echo> = {}): Echo {
	return {
		id: "echo:opinion:atlas:c1",
		kind: "opinion",
		source: "conversation",
		target: "atlas",
		weight: -25,
		decay: 2,
		reinforcements: 0,
		lastReinforcedCycle: 1,
		tags: ["social"],
		cycleCreated: 1,
		...overrides,
	};
}

function makeStore(budget = 5): IEchoStore {
	return {
		getCascadeBudget: () => budget,
		consumeCascade: () => budget > 0,
		resetCascadeBudget: () => undefined,
		addEcho: () => ({ merged: false, echo: makeEcho(), cascadeTriggered: false }),
		queryWeight: () => 0,
		getDialogueBias: () => ({
			targetOpinions: new Map(),
			moodResidueWeight: 0,
			memoryBoosts: new Map(),
		}),
		getPreferences: () => [],
		getStrongest: () => undefined,
		decayAll: () => ({ evicted: [], thresholdsCrossed: [], habitsFormed: [] }),
		serialize: () => ({}),
		restore: () => undefined,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("CascadeResolver", () => {
	let resolver: CascadeResolver;

	beforeEach(() => {
		resolver = new CascadeResolver(makeStore());
	});

	// ── shouldCascade ───────────────────────────────────────────────

	describe("shouldCascade", () => {
		it("returns false when budget exhausted", () => {
			const exhausted = new CascadeResolver(makeStore(0));
			const echo = makeEcho({ weight: -30 });
			expect(exhausted.shouldCascade("atlas", echo, 1.0)).toBe(false);
		});

		it("returns false when |weight| < 10", () => {
			const echo = makeEcho({ weight: 8 });
			expect(resolver.shouldCascade("atlas", echo, 1.0)).toBe(false);
		});

		it("returns true for strong echo with budget", () => {
			const echo = makeEcho({ weight: -30 });
			expect(resolver.shouldCascade("atlas", echo, 1.0)).toBe(true);
		});

		it("respects per-agent cooldown", () => {
			const echo = makeEcho({ weight: -30 });
			resolver.recordAgentCascade("atlas");
			expect(resolver.shouldCascade("atlas", echo, 1.0)).toBe(false);
		});
	});

	// ── computeProbability ──────────────────────────────────────────

	describe("computeProbability", () => {
		it("returns 0.55 at weight 15", () => {
			expect(resolver.computeProbability(15)).toBeCloseTo(0.55);
		});

		it("caps at 0.60 for weight 30", () => {
			expect(resolver.computeProbability(30)).toBeCloseTo(0.60);
		});

		it("caps at 0.60 for weight 100", () => {
			expect(resolver.computeProbability(100)).toBeCloseTo(0.60);
		});

		it("handles negative weight -20 as 0.60", () => {
			expect(resolver.computeProbability(-20)).toBeCloseTo(0.60);
		});
	});

	// ── isLooping ───────────────────────────────────────────────────

	describe("isLooping", () => {
		it("blocks visited key", () => {
			const echo = makeEcho();
			const chain = resolver.createChain("root-1");
			const extended = resolver.extendChain(chain, echo);
			expect(resolver.isLooping(echo, extended)).toBe(true);
		});

		it("allows unvisited key", () => {
			const echo = makeEcho();
			const chain = resolver.createChain("root-1");
			expect(resolver.isLooping(echo, chain)).toBe(false);
		});
	});

	// ── isAtMaxDepth ────────────────────────────────────────────────

	describe("isAtMaxDepth", () => {
		it("returns true at depth 3", () => {
			const chain = { depth: 3, visited: new Set<string>(), rootEchoId: "r" };
			expect(resolver.isAtMaxDepth(chain)).toBe(true);
		});

		it("returns false at depth 2", () => {
			const chain = { depth: 2, visited: new Set<string>(), rootEchoId: "r" };
			expect(resolver.isAtMaxDepth(chain)).toBe(false);
		});
	});

	// ── dampen ──────────────────────────────────────────────────────

	describe("dampen", () => {
		it("dampens 20 to 12", () => {
			expect(resolver.dampen(20)).toBeCloseTo(12);
		});

		it("dampens -10 to -6", () => {
			expect(resolver.dampen(-10)).toBeCloseTo(-6);
		});
	});

	// ── selectReaction ──────────────────────────────────────────────

	describe("selectReaction", () => {
		it("returns vent for opinion < -20", () => {
			const echo = makeEcho({ kind: "opinion", weight: -25 });
			const reaction = resolver.selectReaction("atlas", echo);
			expect(reaction).toBeDefined();
			expect(reaction!.type).toBe("vent");
			expect(reaction!.agent).toBe("atlas");
		});

		it("returns seek-proximity for bond > 25", () => {
			const echo = makeEcho({ kind: "bond", weight: 30 });
			const reaction = resolver.selectReaction("atlas", echo);
			expect(reaction).toBeDefined();
			expect(reaction!.type).toBe("seek-proximity");
		});

		it("returns force-break for mood-residue < -15", () => {
			const echo = makeEcho({ kind: "mood-residue", weight: -20 });
			const reaction = resolver.selectReaction("atlas", echo);
			expect(reaction).toBeDefined();
			expect(reaction!.type).toBe("force-break");
		});

		it("returns undefined for weak preference", () => {
			const echo = makeEcho({ kind: "preference", weight: 5 });
			const reaction = resolver.selectReaction("atlas", echo);
			expect(reaction).toBeUndefined();
		});

		it("selects adjust-opinion for reputation echo", () => {
			const echo = makeEcho({ kind: "reputation", weight: -20, target: "nova" });
			const reaction = resolver.selectReaction("atlas", echo);
			expect(reaction?.type).toBe("adjust-opinion");
			expect(reaction?.weight).toBeCloseTo(-10); // 0.5x multiplier
		});
	});

	// ── adjust-opinion reaction (reputation echo) ─────────────────

	describe("adjust-opinion reaction", () => {
		it("applies 0.5x weight multiplier for reputation echo", () => {
			const echo = makeEcho({ kind: "reputation", weight: -20, target: "nova" });
			const reaction = resolver.selectReaction("atlas", echo);

			expect(reaction).toBeDefined();
			expect(reaction!.type).toBe("adjust-opinion");
			expect(reaction!.weight).toBeCloseTo(-10);
		});
	});

	// ── createChain / extendChain ──────────────────────────────────

	describe("createChain and extendChain", () => {
		it("createChain starts at depth 0 with empty visited set", () => {
			const chain = resolver.createChain("root-1");

			expect(chain.depth).toBe(0);
			expect(chain.visited.size).toBe(0);
			expect(chain.rootEchoId).toBe("root-1");
		});

		it("extendChain increments depth by 1", () => {
			const chain = resolver.createChain("root-1");
			const echo = makeEcho();
			const extended = resolver.extendChain(chain, echo);

			expect(extended.depth).toBe(1);
		});

		it("extendChain grows visited set with echo key", () => {
			const chain = resolver.createChain("root-1");
			const echo = makeEcho({ kind: "opinion", source: "conversation", target: "atlas" });
			const extended = resolver.extendChain(chain, echo);

			expect(extended.visited.size).toBe(1);
			expect(extended.visited.has("opinion:conversation:atlas")).toBe(true);
		});

		it("extendChain preserves rootEchoId from original chain", () => {
			const chain = resolver.createChain("root-1");
			const echo = makeEcho();
			const extended = resolver.extendChain(chain, echo);

			expect(extended.rootEchoId).toBe("root-1");
		});

		it("sequential extends accumulate visited entries", () => {
			const chain = resolver.createChain("root-1");
			const echoA = makeEcho({ kind: "opinion", source: "a", target: "x" });
			const echoB = makeEcho({ kind: "bond", source: "b", target: "y" });

			const ext1 = resolver.extendChain(chain, echoA);
			const ext2 = resolver.extendChain(ext1, echoB);

			expect(ext2.depth).toBe(2);
			expect(ext2.visited.size).toBe(2);
		});
	});

	// ── gossip forwarding ──────────────────────────────────────────

	describe("gossip forwarding", () => {
		it("shouldForwardGossip returns true ~50% of the time", () => {
			let forwards = 0;
			for (let i = 0; i < 1000; i++) {
				if (resolver.shouldForwardGossip()) forwards++;
			}
			expect(forwards).toBeGreaterThan(400); // ~50% - margin
			expect(forwards).toBeLessThan(600);    // ~50% + margin
		});
	});

	// ── resetCycle ──────────────────────────────────────────────────

	describe("resetCycle", () => {
		it("clears cooldowns so agent can cascade again", () => {
			const echo = makeEcho({ weight: -30 });
			resolver.recordAgentCascade("atlas");
			expect(resolver.shouldCascade("atlas", echo, 1.0)).toBe(false);

			resolver.resetCycle();
			expect(resolver.shouldCascade("atlas", echo, 1.0)).toBe(true);
		});
	});
});
