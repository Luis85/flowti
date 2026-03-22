import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NPCInteractionRule } from "../../../../../Flowti CLI/src/domain/interactions/intent-resolver-types.js";
import { createNPCIntentResolver } from "../../../../src/game/systems/interaction/npc-intent-resolver.js";
import type { NPCResolverConfig } from "../../../../src/game/systems/interaction/npc-intent-resolver.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeRule(overrides: Partial<NPCInteractionRule> = {}): NPCInteractionRule {
	return {
		npcRole: "merchant",
		trigger: "proximity",
		conditions: [],
		interaction: {
			category: "commerce",
			action: "offer-trade",
			cardinality: "one-to-one",
			effects: [{ type: "economy-transaction", target: "initiator", currency: "coin", amount: 5 }],
			cooldownMs: 10000,
		},
		weight: 50,
		cooldownMs: 10000,
		...overrides,
	};
}

function makeConfig(overrides: Partial<NPCResolverConfig> = {}): NPCResolverConfig {
	return {
		npcId: "npc-merchant-01",
		npcRole: "merchant",
		rules: [makeRule()],
		getNearby: () => [{ id: "agent-alpha", entityType: "agent", distance: 3 }],
		getCooldown: () => 0,
		now: () => 1000,
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("createNPCIntentResolver", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("fires proximity rule when agent is nearby", () => {
		const resolver = createNPCIntentResolver(makeConfig());

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("offer-trade");
		expect(result[0].initiator).toEqual({ id: "npc-merchant-01", entityType: "npc" });
		expect(result[0].targets).toEqual([{ id: "agent-alpha", entityType: "agent" }]);
	});

	it("fires idle-timeout rule when no agents are nearby", () => {
		const idleRule = makeRule({
			trigger: "idle-timeout",
			interaction: {
				category: "reactive",
				action: "idle-wander",
				cardinality: "entity-to-environment",
				effects: [],
				cooldownMs: 5000,
			},
			weight: 30,
		});
		const resolver = createNPCIntentResolver(makeConfig({
			rules: [idleRule],
			getNearby: () => [],
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("idle-wander");
	});

	it("respects cooldown — skips rule if not expired", () => {
		const resolver = createNPCIntentResolver(makeConfig({
			getCooldown: () => 2000,
			now: () => 1000,
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("fires rule when cooldown has expired", () => {
		const resolver = createNPCIntentResolver(makeConfig({
			getCooldown: () => 500,
			now: () => 1000,
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("offer-trade");
	});

	it("higher weight rules are checked first", () => {
		const lowWeightRule = makeRule({
			weight: 10,
			interaction: {
				category: "social",
				action: "wave",
				cardinality: "one-to-one",
				effects: [],
				cooldownMs: 3000,
			},
		});
		const highWeightRule = makeRule({
			weight: 90,
			interaction: {
				category: "commerce",
				action: "special-offer",
				cardinality: "one-to-one",
				effects: [],
				cooldownMs: 8000,
			},
		});

		const resolver = createNPCIntentResolver(makeConfig({
			rules: [lowWeightRule, highWeightRule],
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("special-offer");
	});

	it("schedule trigger always passes", () => {
		const scheduleRule = makeRule({
			trigger: "schedule",
			interaction: {
				category: "directive",
				action: "announce",
				cardinality: "one-to-many",
				effects: [],
				cooldownMs: 30000,
			},
		});
		const resolver = createNPCIntentResolver(makeConfig({
			rules: [scheduleRule],
			getNearby: () => [],
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("announce");
	});

	it("event trigger always passes", () => {
		const eventRule = makeRule({
			trigger: "event",
			interaction: {
				category: "reactive",
				action: "react-to-event",
				cardinality: "one-to-one",
				effects: [],
				cooldownMs: 5000,
			},
		});
		const resolver = createNPCIntentResolver(makeConfig({
			rules: [eventRule],
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("react-to-event");
	});

	it("returns empty when proximity trigger has no nearby entities", () => {
		const resolver = createNPCIntentResolver(makeConfig({
			getNearby: () => [],
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("returns empty when idle-timeout trigger has nearby entities", () => {
		const idleRule = makeRule({
			trigger: "idle-timeout",
			interaction: {
				category: "reactive",
				action: "idle-wander",
				cardinality: "entity-to-environment",
				effects: [],
				cooldownMs: 5000,
			},
		});
		const resolver = createNPCIntentResolver(makeConfig({
			rules: [idleRule],
			getNearby: () => [{ id: "agent-alpha", entityType: "agent", distance: 3 }],
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("sets entityType to npc", () => {
		const resolver = createNPCIntentResolver(makeConfig());
		expect(resolver.entityType).toBe("npc");
	});
});
