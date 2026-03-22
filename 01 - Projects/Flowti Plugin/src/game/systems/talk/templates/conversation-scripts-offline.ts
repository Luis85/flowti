/**
 * conversation-scripts-offline.ts — Offline-return conversation scripts for Merchant NPC.
 *
 * Single-speaker monologues delivered by the Merchant when the Director returns
 * after being away. Scripts are categorised by absence duration:
 *   - Short  (< 1 hour)
 *   - Medium (1-8 hours)
 *   - Long   (> 8 hours)
 *   - Level-up highlight
 *
 * The caller passes the Merchant as agentA. Variable interpolation uses {var}
 * syntax handled by the ConversationEngine.
 */

import type { ConversationScript } from "../conversation-types.js";

export const OFFLINE_RETURN_SCRIPTS: readonly ConversationScript[] = [
	// ── Short absence (< 1 hour) ────────────────────────────────────

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

	// ── Medium absence (1-8 hours) ──────────────────────────────────

	{
		id: "off-medium-summary",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 3,
		cooldownMs: 120000,
		tags: ["offline-return", "medium-absence", "summary"],
		turns: [
			{ speaker: "A", text: "Welcome back. {highlight_agent} was particularly productive \u2014 {tasks_completed} tasks handled.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "Nothing caught fire while you were out. Always a good sign.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "The team knocked out {tasks_completed} tasks. {total_xp} XP earned across the board.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "Not bad for unsupervised work, if I do say so myself.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── Long absence (> 8 hours) ────────────────────────────────────

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
			{ speaker: "A", text: "While you were away, {highlight_agent} hit Level {highlight_level}. {highlight_title} \u2014 not bad.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "The rest of the crew kept pace too. Solid progress all around.", delayMs: 2500, kind: "speech" },
		],
	},

	// ── Level-up highlight ──────────────────────────────────────────

	{
		id: "off-levelup-news",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "offline-return",
		weight: 4,
		cooldownMs: 300000,
		tags: ["offline-return", "level-up", "highlight"],
		turns: [
			{ speaker: "A", text: "Big news \u2014 {highlight_agent} reached {highlight_title}. About time, if you ask me.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "You might want to check in with them. A little recognition goes a long way.", delayMs: 3000, kind: "speech" },
		],
	},
];
