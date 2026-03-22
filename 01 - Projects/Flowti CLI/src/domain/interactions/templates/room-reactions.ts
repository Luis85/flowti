import type { InteractionTemplate } from "../interaction-types.js";

export const ROOM_REACTION_TEMPLATES: readonly InteractionTemplate[] = [
	{
		id: "crunch-time-pressure",
		category: "environmental",
		action: "crunch-time-pressure",
		cardinality: "one-to-many",
		initiatorTypes: ["room"],
		targetTypes: ["agent"],
		prerequisites: [
			{ type: "phase", phases: ["afternoon-slump"] },
		],
		weight: 1,
		tags: ["environmental", "stress"],
		priority: 60,
		cooldownMs: 300000,
		duration: 0,
		effects: [
			{ type: "need-change", target: "targets", need: "focus", amount: -3 },
			{ type: "room-mood-shift", mood: "tense", amount: -2 },
		],
	},
	{
		id: "celebration-vibe",
		category: "reactive",
		action: "celebration-vibe",
		cardinality: "one-to-many",
		initiatorTypes: ["room"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 1,
		tags: ["reactive", "celebration"],
		priority: 50,
		cooldownMs: 600000,
		duration: 0,
		effects: [
			{ type: "need-change", target: "targets", need: "morale", amount: 5 },
			{ type: "room-mood-shift", mood: "festive", amount: 3 },
		],
	},
	{
		id: "quiet-focus",
		category: "environmental",
		action: "quiet-focus",
		cardinality: "one-to-many",
		initiatorTypes: ["room"],
		targetTypes: ["agent"],
		prerequisites: [
			{ type: "phase", phases: ["productive-morning"] },
		],
		weight: 1,
		tags: ["environmental", "focus"],
		priority: 15,
		cooldownMs: 240000,
		duration: 0,
		effects: [
			{ type: "need-change", target: "targets", need: "focus", amount: 3 },
		],
	},
] as const;
