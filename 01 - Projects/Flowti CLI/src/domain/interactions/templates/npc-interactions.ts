import type { InteractionTemplate } from "../interaction-types.js";

export const NPC_INTERACTION_TEMPLATES: readonly InteractionTemplate[] = [
	{
		id: "merchant-pitch",
		category: "commerce",
		action: "merchant-pitch",
		cardinality: "one-to-one",
		initiatorTypes: ["npc"],
		targetTypes: ["agent"],
		prerequisites: [
			{ type: "proximity", maxDistance: 3 },
		],
		weight: 1,
		tags: ["commerce", "merchant"],
		priority: 55,
		cooldownMs: 60000,
		duration: 8000,
		effects: [
			{ type: "bubble", target: "initiator", bubbleKind: "speech", phrasePool: "merchant-pitch" },
		],
	},
	{
		id: "merchant-idle-grumble",
		category: "reactive",
		action: "merchant-idle-grumble",
		cardinality: "entity-to-environment",
		initiatorTypes: ["npc"],
		targetTypes: ["room"],
		prerequisites: [],
		weight: 1,
		tags: ["reactive", "idle", "merchant"],
		priority: 10,
		cooldownMs: 45000,
		duration: 5000,
		effects: [
			{ type: "bubble", target: "initiator", bubbleKind: "thought", phrasePool: "merchant-idle-grumble" },
		],
	},
	{
		id: "merchant-comment-on-pair",
		category: "social",
		action: "merchant-comment-on-pair",
		cardinality: "one-to-many",
		initiatorTypes: ["npc"],
		targetTypes: ["agent"],
		prerequisites: [
			{ type: "proximity", maxDistance: 4 },
		],
		weight: 1,
		tags: ["social", "merchant", "observation"],
		priority: 15,
		cooldownMs: 90000,
		duration: 6000,
		effects: [
			{ type: "bubble", target: "initiator", bubbleKind: "speech", phrasePool: "merchant-comment-on-pair" },
		],
	},
] as const;
