import type { InteractionTemplate } from "../interaction-types.js";

export const PET_SOCIAL_TEMPLATES: readonly InteractionTemplate[] = [
	{
		id: "zoomies-disruption",
		category: "playful",
		action: "zoomies-disruption",
		cardinality: "one-to-many",
		initiatorTypes: ["pet"],
		targetTypes: ["agent"],
		prerequisites: [
			{ type: "need-threshold", need: "energy", op: ">", value: 80 },
		],
		weight: 2,
		tags: ["playful", "pet", "disruption"],
		priority: 30,
		cooldownMs: 120000,
		duration: 6000,
		effects: [
			{ type: "bubble", target: "initiator", bubbleKind: "thought", phrasePool: "reactive:zoomies" },
			{ type: "need-change", target: "targets", need: "social", amount: 5 },
		],
		chainTemplates: ["chase-sequence"],
		chainChance: 0.15,
	},
	{
		id: "sit-between",
		category: "social",
		action: "sit-between",
		cardinality: "one-to-many",
		initiatorTypes: ["pet"],
		targetTypes: ["agent"],
		prerequisites: [
			{ type: "proximity", maxDistance: 4 },
		],
		weight: 1,
		tags: ["social", "pet", "comfort"],
		priority: 40,
		cooldownMs: 180000,
		duration: 8000,
		effects: [
			{ type: "bubble", target: "initiator", bubbleKind: "emote", phrasePool: "reactive:comfort" },
			{ type: "need-change", target: "targets", need: "morale", amount: 3 },
		],
	},
	{
		id: "comfort-sad-agent",
		category: "care",
		action: "comfort-sad-agent",
		cardinality: "one-to-one",
		initiatorTypes: ["pet"],
		targetTypes: ["agent"],
		prerequisites: [
			{ type: "need-threshold", need: "morale", op: "<", value: 20 },
		],
		weight: 3,
		tags: ["care", "pet", "empathy"],
		priority: 50,
		cooldownMs: 60000,
		duration: 10000,
		effects: [
			{ type: "bubble", target: "initiator", bubbleKind: "emote", phrasePool: "reactive:comfort" },
			{ type: "need-change", target: "targets", need: "morale", amount: 8 },
			{ type: "affinity-change", target: "targets", amount: 3 },
		],
	},
] as const;
