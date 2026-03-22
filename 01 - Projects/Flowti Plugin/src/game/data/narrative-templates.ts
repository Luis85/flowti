/**
 * narrative-templates.ts — Story narrative templates for the merchant narrative system.
 *
 * Templates are grouped by event category and significance level.
 * Variable interpolation uses ${variable} syntax at runtime.
 * This is a pure data file — no logic, no external imports.
 */

import type { DayPhase } from "./day-phase-config.js";

// ── Types ───────────────────────────────────────────────────────────

export interface NarrativeTemplate {
	readonly category: string;
	readonly event: string;
	readonly significance: "headline" | "detail" | "color";
	readonly templates: readonly string[];
}

export interface TransitionTemplate {
	readonly phase: string;
	readonly templates: readonly string[];
}

// ── Narrative Templates ─────────────────────────────────────────────

export const NARRATIVE_TEMPLATES: readonly NarrativeTemplate[] = [
	// ── Task events (detail) ────────────────────────────────────────
	{
		category: "task",
		event: "task-completed",
		significance: "detail",
		templates: [
			"${agent} finished work on ${domain} — another one off the board.",
			"${agent} wrapped up a ${domain} task and pushed the results.",
			"${agent} quietly closed out the ${domain} work. ${count} task${plural} done today.",
		],
	},
	{
		category: "task",
		event: "task-assigned",
		significance: "detail",
		templates: [
			"${agent} picked up a new ${domain} task and got started.",
			"A fresh ${domain} assignment landed on ${agent}'s desk.",
		],
	},

	// ── Economy events ──────────────────────────────────────────────
	{
		category: "economy",
		event: "level-up",
		significance: "headline",
		templates: [
			"${agent} leveled up to ${level}! The team gathered to celebrate.",
			"Level ${level} — ${agent} earned it with ${xp} XP of hard work.",
			"${agent} hit level ${level}. Even the pets noticed.",
		],
	},
	{
		category: "economy",
		event: "trust-promoted",
		significance: "headline",
		templates: [
			"${agent} earned the title of ${title}. Trust well placed.",
			"Promotion! ${agent} is now a ${title} — new permissions unlocked.",
		],
	},
	{
		category: "economy",
		event: "merchant-purchase",
		significance: "detail",
		templates: [
			"${agent} bought ${item} from the merchant for ${cost} coin.",
			"${agent} stopped by the shop and picked up ${item}.",
		],
	},
	{
		category: "economy",
		event: "reward-earned",
		significance: "detail",
		templates: [
			"${agent} earned ${coin} coin and ${xp} XP for ${reason}.",
			"Nice work — ${agent} pocketed ${coin} coin from ${reason}.",
		],
	},

	// ── Social events (color) ───────────────────────────────────────
	{
		category: "social",
		event: "conversation",
		significance: "color",
		templates: [
			"${agent1} and ${agent2} chatted near ${location} for a while.",
			"${agent1} pulled ${agent2} aside for a quick word about ${domain}.",
		],
	},
	{
		category: "social",
		event: "running-joke",
		significance: "color",
		templates: [
			"${agent1} brought up ${joke} again. ${agent2} groaned.",
			"The old ${joke} bit resurfaced — ${agent1} can't let it go.",
		],
	},

	// ── Need events (color) ─────────────────────────────────────────
	{
		category: "need",
		event: "need-critical",
		significance: "color",
		templates: [
			"${agent} is running low on ${need} — starting to slow down.",
			"${agent} really needs ${need}. Productivity is taking a hit.",
		],
	},

	// ── Pet events (color) ──────────────────────────────────────────
	{
		category: "pet",
		event: "steal-food",
		significance: "color",
		templates: [
			"${pet} swiped ${agent}'s lunch when nobody was looking.",
			"${pet} made off with food from ${agent}'s desk. Classic ${pet}.",
		],
	},
	{
		category: "pet",
		event: "bonding",
		significance: "color",
		templates: [
			"${agent} took a break to hang out with ${pet}.",
			"${pet} curled up next to ${agent} during a coding session.",
		],
	},
	{
		category: "pet",
		event: "share-food",
		significance: "color",
		templates: [
			"${agent} shared a snack with ${pet}. Morale restored.",
			"${pet} got a treat from ${agent} — tail wagging ensued.",
		],
	},

	// ── Ritual events ───────────────────────────────────────────────
	{
		category: "ritual",
		event: "standup-completed",
		significance: "detail",
		templates: [
			"The team wrapped up standup. ${count} update${plural} shared.",
			"Standup done — everyone synced in ${count} minute${plural}.",
		],
	},
	{
		category: "ritual",
		event: "celebration",
		significance: "headline",
		templates: [
			"The team celebrated ${reason}! Confetti optional but encouraged.",
		],
	},
];

// ── Phase Transitions ───────────────────────────────────────────────

export const PHASE_TRANSITIONS: readonly TransitionTemplate[] = [
	{
		phase: "Morning",
		templates: [
			"The office lights flicker on. A new day begins.",
			"Morning coffee aroma fills the workspace as agents settle in.",
			"Early light streams through the windows — time to get started.",
		],
	},
	{
		phase: "Lunch",
		templates: [
			"The lunch bell rings. Keyboards go quiet for a bit.",
			"Midday break — agents scatter for food and fresh air.",
		],
	},
	{
		phase: "Afternoon",
		templates: [
			"Back from lunch. The afternoon stretch begins.",
			"Post-lunch focus kicks in — heads down, code flowing.",
			"The afternoon sun warms the workspace as work resumes.",
		],
	},
	{
		phase: "Wind-Down",
		templates: [
			"The day is winding down. Final commits trickling in.",
			"Wrapping up loose ends before the evening settles.",
		],
	},
	{
		phase: "Evening",
		templates: [
			"The office empties out. Another productive day in the books.",
			"Lights dim as the last agents head home.",
			"Evening quiet descends. The codebase rests.",
		],
	},
];

// ── Day Phase to Narrative Phase Mapping ────────────────────────────

export const DAY_PHASE_TO_NARRATIVE: Record<DayPhase, string> = {
	"morning-arrival": "Morning",
	"productive-morning": "Morning",
	"lunch": "Lunch",
	"afternoon": "Afternoon",
	"afternoon-slump": "Afternoon",
	"wind-down": "Wind-Down",
	"evening-departure": "Evening",
};

// ── Offline Templates ───────────────────────────────────────────────

export const OFFLINE_TEMPLATES = {
	condensed: [
		"While you were away, ${count} cycle${plural} passed. The team kept busy.",
		"${count} cycle${plural} elapsed offline. Here's the summary.",
	] as readonly string[],
	highlight: [
		"${agent} stood out — ${operation} during the downtime.",
		"${agent} made notable progress on ${domain} while offline.",
	] as readonly string[],
	rested: [
		"The team is well-rested after ${count} hours away. Morale boosted.",
		"Long break detected — everyone returns refreshed and ready.",
	] as readonly string[],
} as const;
