/**
 * conversation-scripts-offline.ts \u2014 Offline-return conversation scripts for Merchant NPC.
 *
 * Single-speaker monologues delivered by the Merchant when the Director returns
 * after being away. Scripts are categorised by absence duration:
 *   - Short  (< 1 hour)
 *   - Medium (1-8 hours)
 *   - Long   (> 8 hours)
 *   - Level-up highlight
 *
 * The caller passes the Merchant as agentA. All dialogue is self-contained
 * and uses only the standard variables provided by ConversationEngine.buildVars()
 * ({agentA}, {agentB}, {domain_a}, {domain_b}, {pet}, {agentC}).
 */

import type { ConversationScript } from "../conversation-types.js";

export const OFFLINE_RETURN_SCRIPTS: readonly ConversationScript[] = [
	// \u2500\u2500 Short absence (< 1 hour) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

	{
		id: "off-short-casual",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 3,
		cooldownMs: 60000,
		tags: ["offline-return", "short-absence"],
		turns: [
			{ speaker: "A", text: "Back already, Director? Not much happened while you stepped out.", delayMs: 0, kind: "speech" },
		],
	},

	{
		id: "off-short-quiet",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 2,
		cooldownMs: 60000,
		tags: ["offline-return", "short-absence"],
		turns: [
			{ speaker: "A", text: "Quick break? Good. The team barely noticed you were gone.", delayMs: 0, kind: "speech" },
		],
	},

	// \u2500\u2500 Medium absence (1-8 hours) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

	{
		id: "off-medium-summary",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 3,
		cooldownMs: 120000,
		tags: ["offline-return", "medium-absence", "summary"],
		turns: [
			{ speaker: "A", text: "Welcome back. The crew was productive while you were out.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "Nothing caught fire while you were away. Always a good sign.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "off-medium-stats",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 2,
		cooldownMs: 120000,
		tags: ["offline-return", "medium-absence", "stats"],
		turns: [
			{ speaker: "A", text: "The team kept busy while you were gone. Solid output all around.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "Not bad for unsupervised work, if I do say so myself.", delayMs: 2000, kind: "speech" },
		],
	},

	// \u2500\u2500 Long absence (> 8 hours) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

	{
		id: "off-long-rested",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 3,
		cooldownMs: 180000,
		tags: ["offline-return", "long-absence", "warmth"],
		turns: [
			{ speaker: "A", text: "Good to see you, Director. The team took some downtime \u2014 everyone's well-rested.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "Morale is up. Turns out rest actually works. Who knew.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "off-long-highlight",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 2,
		cooldownMs: 180000,
		tags: ["offline-return", "long-absence", "highlight"],
		turns: [
			{ speaker: "A", text: "While you were away, one of your agents made great progress. Impressive stuff.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "The rest of the crew kept pace too. Solid progress all around.", delayMs: 2500, kind: "speech" },
		],
	},

	// \u2500\u2500 Level-up highlight \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

	{
		id: "off-levelup-news",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 4,
		cooldownMs: 300000,
		tags: ["offline-return", "level-up", "highlight"],
		turns: [
			{ speaker: "A", text: "Big news \u2014 someone on the team leveled up while you were out. About time, if you ask me.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "You might want to check in with them. A little recognition goes a long way.", delayMs: 3000, kind: "speech" },
		],
	},
];
