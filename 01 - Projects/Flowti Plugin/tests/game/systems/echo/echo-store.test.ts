import { describe, it, expect, beforeEach } from "vitest";
import { EchoStore } from "../../../../src/game/systems/echo/echo-store.js";
import type { EchoInput } from "../../../../src/game/systems/echo/echo-types.js";

// ── Test Helpers ────────────────────────────────────────────────────

function opinion(target: string, weight: number): EchoInput {
	return { kind: "opinion", source: "conversation", target, weight, decay: 3, tags: ["social"] };
}

function bond(target: string, weight: number): EchoInput {
	return { kind: "bond", source: "pet-comfort", target, weight, decay: 1, tags: ["pet"] };
}

function mood(weight: number): EchoInput {
	return { kind: "mood-residue", source: "ambient", weight, decay: 2, tags: ["mood"] };
}

function memory(target: string, weight: number): EchoInput {
	return { kind: "memory", source: "event", target, weight, decay: 1, tags: ["recall"] };
}

function preference(target: string, weight: number): EchoInput {
	return { kind: "preference", source: "habit", target, weight, decay: 1, tags: ["pref"] };
}

function aversion(target: string, weight: number): EchoInput {
	return { kind: "aversion", source: "event", target, weight, decay: 2, tags: ["avoid"] };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("EchoStore", () => {
	let store: EchoStore;

	beforeEach(() => {
		store = new EchoStore();
	});

	// ── addEcho ─────────────────────────────────────────────────────

	describe("addEcho", () => {
		it("creates a new echo for a fresh agent", () => {
			const result = store.addEcho("Atlas", opinion("Rex", 10), 1);
			expect(result.merged).toBe(false);
			expect(result.echo.kind).toBe("opinion");
			expect(result.echo.target).toBe("Rex");
			expect(result.echo.weight).toBe(10);
			expect(result.echo.reinforcements).toBe(1);
			expect(result.echo.lastReinforcedCycle).toBe(1);
			expect(result.echo.cycleCreated).toBe(1);
		});

		it("merges when matching kind+source+target exists", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			const result = store.addEcho("Atlas", opinion("Rex", 5), 3);

			expect(result.merged).toBe(true);
			expect(result.echo.weight).toBe(15);
			expect(result.echo.reinforcements).toBe(2);
			expect(result.echo.lastReinforcedCycle).toBe(3);
		});

		it("increments reinforcements on each merge", () => {
			store.addEcho("Atlas", opinion("Rex", 5), 1);
			store.addEcho("Atlas", opinion("Rex", 5), 2);
			const result = store.addEcho("Atlas", opinion("Rex", 5), 3);

			expect(result.echo.reinforcements).toBe(3);
		});

		it("caps weight at +100", () => {
			const result = store.addEcho("Atlas", opinion("Rex", 120), 1);
			expect(result.echo.weight).toBe(100);
		});

		it("caps weight at -100", () => {
			const result = store.addEcho("Atlas", opinion("Rex", -120), 1);
			expect(result.echo.weight).toBe(-100);
		});

		it("caps merged weight at +100", () => {
			store.addEcho("Atlas", opinion("Rex", 80), 1);
			const result = store.addEcho("Atlas", opinion("Rex", 50), 2);
			expect(result.echo.weight).toBe(100);
		});

		it("evicts weakest echo when at 20 max", () => {
			for (let i = 0; i < 20; i++) {
				store.addEcho("Atlas", {
					kind: "opinion",
					source: `src-${i}`,
					target: `t-${i}`,
					weight: 10 + i,
					decay: 1,
					tags: [],
				}, 1);
			}

			const result = store.addEcho("Atlas", opinion("NewTarget", 50), 2);
			expect(result.merged).toBe(false);

			const prefs = store.getPreferences("Atlas", 2);
			expect(prefs.length).toBeLessThanOrEqual(20);

			const weights = prefs.map((p) => Math.abs(p.weight));
			expect(weights).not.toContain(10);
		});

		it("sets cascadeTriggered when |weight| crosses 15 threshold", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			const result = store.addEcho("Atlas", opinion("Rex", 6), 2);

			expect(result.cascadeTriggered).toBe(true);
		});

		it("does not cascade if already above threshold", () => {
			store.addEcho("Atlas", opinion("Rex", 20), 1);
			const result = store.addEcho("Atlas", opinion("Rex", 5), 2);

			expect(result.cascadeTriggered).toBe(false);
		});

		it("cascades on new echo when |weight| >= 15", () => {
			const result = store.addEcho("Atlas", opinion("Rex", 15), 1);
			expect(result.cascadeTriggered).toBe(true);
		});

		it("does not cascade on new echo when |weight| < 15", () => {
			const result = store.addEcho("Atlas", opinion("Rex", 10), 1);
			expect(result.cascadeTriggered).toBe(false);
		});

		it("does not merge echoes with different targets", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			const result = store.addEcho("Atlas", opinion("Chip", 10), 1);

			expect(result.merged).toBe(false);
		});

		it("does not merge echoes with different sources", () => {
			store.addEcho("Atlas", { kind: "opinion", source: "a", target: "Rex", weight: 10, decay: 1, tags: [] }, 1);
			const result = store.addEcho("Atlas", { kind: "opinion", source: "b", target: "Rex", weight: 10, decay: 1, tags: [] }, 1);

			expect(result.merged).toBe(false);
		});
	});

	// ── queryWeight ─────────────────────────────────────────────────

	describe("queryWeight", () => {
		it("returns 0 for unknown agent", () => {
			expect(store.queryWeight("nobody", "opinion")).toBe(0);
		});

		it("returns 0 when no echoes match kind", () => {
			store.addEcho("Atlas", bond("Rex", 20), 1);
			expect(store.queryWeight("Atlas", "opinion")).toBe(0);
		});

		it("returns weight for specific target", () => {
			store.addEcho("Atlas", opinion("Rex", 15), 1);
			store.addEcho("Atlas", opinion("Chip", 10), 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(15);
		});

		it("sums all echoes of a kind when no target specified", () => {
			store.addEcho("Atlas", { kind: "opinion", source: "a", target: "Rex", weight: 10, decay: 1, tags: [] }, 1);
			store.addEcho("Atlas", { kind: "opinion", source: "b", target: "Chip", weight: 20, decay: 1, tags: [] }, 1);

			expect(store.queryWeight("Atlas", "opinion")).toBe(30);
		});

		it("handles negative weights", () => {
			store.addEcho("Atlas", opinion("Rex", -15), 1);
			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(-15);
		});
	});

	// ── decayAll ────────────────────────────────────────────────────

	describe("decayAll", () => {
		it("reduces positive weight toward zero", () => {
			store.addEcho("Atlas", opinion("Rex", 20), 1);
			store.decayAll(2);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(17);
		});

		it("reduces negative weight toward zero", () => {
			store.addEcho("Atlas", opinion("Rex", -20), 1);
			store.decayAll(2);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(-17);
		});

		it("evicts echoes at weight <= 2 (eviction threshold)", () => {
			store.addEcho("Atlas", opinion("Rex", 5), 1);
			store.decayAll(2);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(0);
		});

		it("returns evicted echoes in result", () => {
			store.addEcho("Atlas", opinion("Rex", 4), 1);
			const result = store.decayAll(2);

			expect(result.evicted.length).toBeGreaterThan(0);
			expect(result.evicted[0].target).toBe("Rex");
		});

		it("reports threshold crossing at |30| boundary", () => {
			store.addEcho("Atlas", opinion("Rex", 33), 1);
			const result = store.decayAll(2);

			expect(result.thresholdsCrossed.length).toBe(1);
			expect(result.thresholdsCrossed[0].weight).toBe(30);
		});

		it("does not report threshold crossing when not crossing 30", () => {
			store.addEcho("Atlas", opinion("Rex", 50), 1);
			const result = store.decayAll(2);

			expect(result.thresholdsCrossed.length).toBe(0);
		});

		it("reports habits formed at reinforcements = 3", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			store.addEcho("Atlas", opinion("Rex", 10), 2);
			store.addEcho("Atlas", opinion("Rex", 10), 3);

			const result = store.decayAll(4);
			expect(result.habitsFormed.length).toBe(1);
			expect(result.habitsFormed[0].target).toBe("Rex");
		});

		it("clears pending habits after decay", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			store.addEcho("Atlas", opinion("Rex", 10), 2);
			store.addEcho("Atlas", opinion("Rex", 10), 3);

			store.decayAll(4);
			const result = store.decayAll(5);
			expect(result.habitsFormed.length).toBe(0);
		});

		it("handles weight decaying to exactly zero", () => {
			store.addEcho("Atlas", { kind: "opinion", source: "a", target: "Rex", weight: 3, decay: 3, tags: [] }, 1);
			const result = store.decayAll(2);

			expect(result.evicted.length).toBe(1);
		});
	});

	// ── serialize / restore ─────────────────────────────────────────

	describe("serialize / restore", () => {
		it("round-trips echo data", () => {
			store.addEcho("Atlas", opinion("Rex", 25), 1);
			store.addEcho("Atlas", bond("Chip", 40), 1);
			store.addEcho("Rex", opinion("Atlas", -10), 2);

			const data = store.serialize();
			const store2 = new EchoStore();
			store2.restore(data);

			expect(store2.queryWeight("Atlas", "opinion", "Rex")).toBe(25);
			expect(store2.queryWeight("Atlas", "bond", "Chip")).toBe(40);
			expect(store2.queryWeight("Rex", "opinion", "Atlas")).toBe(-10);
		});

		it("serializes to plain Record<string, Echo[]>", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			const data = store.serialize();

			expect(typeof data).toBe("object");
			expect(Array.isArray(data["Atlas"])).toBe(true);
			expect(data["Atlas"][0].kind).toBe("opinion");
		});

		it("restore clears previous state", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			store.restore({});

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(0);
		});
	});

	// ── getDialogueBias ─────────────────────────────────────────────

	describe("getDialogueBias", () => {
		it("returns empty defaults for unknown agent", () => {
			const bias = store.getDialogueBias("nobody");

			expect(bias.targetOpinions.size).toBe(0);
			expect(bias.moodResidueWeight).toBe(0);
			expect(bias.memoryBoosts.size).toBe(0);
			expect(bias.moodOverride).toBeUndefined();
		});

		it("sets mood override to tired when mood-residue < -10", () => {
			store.addEcho("Atlas", mood(-15), 1);
			const bias = store.getDialogueBias("Atlas");

			expect(bias.moodOverride).toBe("tired");
		});

		it("sets mood override to excited when mood-residue > 10", () => {
			store.addEcho("Atlas", mood(15), 1);
			const bias = store.getDialogueBias("Atlas");

			expect(bias.moodOverride).toBe("excited");
		});

		it("no mood override when mood-residue is moderate", () => {
			store.addEcho("Atlas", mood(5), 1);
			const bias = store.getDialogueBias("Atlas");

			expect(bias.moodOverride).toBeUndefined();
		});

		it("populates targetOpinions map from opinion echoes", () => {
			store.addEcho("Atlas", opinion("Rex", 20), 1);
			store.addEcho("Atlas", opinion("Chip", -10), 1);
			const bias = store.getDialogueBias("Atlas");

			expect(bias.targetOpinions.get("Rex")).toBe(20);
			expect(bias.targetOpinions.get("Chip")).toBe(-10);
		});

		it("aggregates multiple opinions for same target", () => {
			store.addEcho("Atlas", { kind: "opinion", source: "a", target: "Rex", weight: 10, decay: 1, tags: [] }, 1);
			store.addEcho("Atlas", { kind: "opinion", source: "b", target: "Rex", weight: 15, decay: 1, tags: [] }, 1);
			const bias = store.getDialogueBias("Atlas");

			expect(bias.targetOpinions.get("Rex")).toBe(25);
		});

		it("populates memoryBoosts from memory echoes", () => {
			store.addEcho("Atlas", memory("big-heist", 30), 1);
			const bias = store.getDialogueBias("Atlas");

			expect(bias.memoryBoosts.get("big-heist")).toBe(30);
		});
	});

	// ── getPreferences ──────────────────────────────────────────────

	describe("getPreferences", () => {
		it("returns empty for unknown agent", () => {
			expect(store.getPreferences("nobody")).toEqual([]);
		});

		it("filters out echoes with |weight| < 5", () => {
			store.addEcho("Atlas", opinion("Rex", 3), 1);
			store.addEcho("Atlas", bond("Chip", 4), 1);

			const prefs = store.getPreferences("Atlas", 1);
			expect(prefs.length).toBe(0);
		});

		it("includes echoes with |weight| >= 5", () => {
			store.addEcho("Atlas", opinion("Rex", 5), 1);
			const prefs = store.getPreferences("Atlas", 1);

			expect(prefs.length).toBe(1);
			expect(prefs[0].target).toBe("Rex");
		});

		it("sorts by |weight| descending", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			store.addEcho("Atlas", bond("Chip", 30), 1);
			store.addEcho("Atlas", preference("coffee", -20), 1);

			const prefs = store.getPreferences("Atlas", 1);

			expect(prefs[0].weight).toBe(30);
			expect(Math.abs(prefs[1].weight)).toBe(20);
			expect(prefs[2].weight).toBe(10);
		});

		it("computes direction correctly", () => {
			store.addEcho("Atlas", opinion("Rex", 60), 1);
			const prefs = store.getPreferences("Atlas", 1);

			expect(prefs[0].direction).toBe("strong");
		});

		it("includes label with kind, target, and weight", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			const prefs = store.getPreferences("Atlas", 1);

			expect(prefs[0].label).toContain("opinion");
			expect(prefs[0].label).toContain("Rex");
		});
	});

	// ── getStrongest ────────────────────────────────────────────────

	describe("getStrongest", () => {
		it("returns undefined for unknown agent", () => {
			expect(store.getStrongest("nobody", "opinion")).toBeUndefined();
		});

		it("returns strongest echo of given kind", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			store.addEcho("Atlas", opinion("Chip", 30), 1);

			const strongest = store.getStrongest("Atlas", "opinion");
			expect(strongest?.target).toBe("Chip");
			expect(strongest?.weight).toBe(30);
		});

		it("returns undefined when no echoes of kind exist", () => {
			store.addEcho("Atlas", opinion("Rex", 10), 1);
			expect(store.getStrongest("Atlas", "bond")).toBeUndefined();
		});

		it("considers absolute value for negative weights", () => {
			store.addEcho("Atlas", opinion("Rex", -50), 1);
			store.addEcho("Atlas", opinion("Chip", 30), 1);

			const strongest = store.getStrongest("Atlas", "opinion");
			expect(strongest?.target).toBe("Rex");
		});
	});

	// ── cascade budget ──────────────────────────────────────────────

	describe("cascade budget", () => {
		it("starts at 5", () => {
			expect(store.getCascadeBudget()).toBe(5);
		});

		it("decrements on consume", () => {
			store.consumeCascade();
			expect(store.getCascadeBudget()).toBe(4);
		});

		it("returns true when budget available", () => {
			expect(store.consumeCascade()).toBe(true);
		});

		it("returns false when exhausted", () => {
			for (let i = 0; i < 5; i++) store.consumeCascade();
			expect(store.consumeCascade()).toBe(false);
			expect(store.getCascadeBudget()).toBe(0);
		});

		it("resets budget to 5", () => {
			for (let i = 0; i < 5; i++) store.consumeCascade();
			store.resetCascadeBudget();
			expect(store.getCascadeBudget()).toBe(5);
		});
	});

	// ── computeDirection (via getPreferences) ───────────────────────

	describe("direction computation", () => {
		it("returns strong when |weight| > 50", () => {
			store.addEcho("Atlas", opinion("Rex", 60), 1);
			const prefs = store.getPreferences("Atlas", 10);
			expect(prefs[0].direction).toBe("strong");
		});

		it("returns fading when |weight| < 10", () => {
			store.addEcho("Atlas", opinion("Rex", 8), 1);
			const prefs = store.getPreferences("Atlas", 10);
			expect(prefs[0].direction).toBe("fading");
		});

		it("returns warming when recently reinforced", () => {
			store.addEcho("Atlas", opinion("Rex", 20), 5);
			const prefs = store.getPreferences("Atlas", 5);
			expect(prefs[0].direction).toBe("warming");
		});

		it("returns cooling when not reinforced for > 3 cycles", () => {
			store.addEcho("Atlas", opinion("Rex", 20), 1);
			const prefs = store.getPreferences("Atlas", 10);
			expect(prefs[0].direction).toBe("cooling");
		});

		it("returns stable for moderate weight within reinforcement window", () => {
			store.addEcho("Atlas", opinion("Rex", 20), 5);
			const prefs = store.getPreferences("Atlas", 7);
			expect(prefs[0].direction).toBe("stable");
		});
	});
});
