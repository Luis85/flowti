/**
 * conversation-scripts-gossip.ts — Multi-turn gossip conversation scripts.
 *
 * Three-agent gossip: Agent A and B discuss absent Agent C. Mix of positive
 * ("have you noticed how well they've been doing?") and negative ("something
 * feels off lately") flavours, all requiring at least colleague-level trust.
 */

import type { ConversationScript } from "../conversation-types.js";

export const GOSSIP_SCRIPTS: readonly ConversationScript[] = [
	// ── Positive gossip ──────────────────────────────────────────────

	{
		id: "gossip-pos-killing-it",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 3,
		cooldownMs: 40000,
		tags: ["gossip", "positive"],
		turns: [
			{ speaker: "A", text: "Have you noticed {agentC} has been absolutely killing it lately?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I KNOW, right? Every ticket just... done. Zero drama. It's wild.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Honestly they're carrying this sprint and I don't think anyone's said it out loud yet.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Someone should. Actually, I might.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "gossip-pos-stepped-up",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 45000,
		tags: ["gossip", "positive"],
		turns: [
			{ speaker: "A", text: "{agentC} really stepped up in that last sprint review.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I noticed that too. The way they pushed back on scope creep — quietly but firmly.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That takes confidence. I respect it.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "They've grown a lot. Just quietly, without making a fuss.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "gossip-pos-everyone-notices",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 50000,
		tags: ["gossip", "positive"],
		turns: [
			{ speaker: "A", text: "I think everyone on the team has noticed {agentC}'s output this quarter.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The quality, not just the quantity. That's what gets me.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I heard the lead is going to say something publicly. I'm genuinely excited for them.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "So deserved. Can we be there when they find out?", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "gossip-pos-natural-leader",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 45000,
		tags: ["gossip", "positive"],
		turns: [
			{ speaker: "A", text: "Have you noticed how {agentC} kind of naturally takes charge when things get chaotic?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Without being loud about it. That's the impressive part.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Quiet leadership. The best kind.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "gossip-pos-behind-the-scenes",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 3,
		cooldownMs: 40000,
		tags: ["gossip", "positive"],
		turns: [
			{ speaker: "A", text: "Half of what {agentC} does nobody even sees. They just fix things quietly.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I KNOW. I inherited one of their modules and — okay, don't laugh — I said 'who wrote this' out loud. To nobody.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Was it clean?", delayMs: 1200, kind: "speech" },
			{ speaker: "B", text: "Spotless. I felt like I was reading a love letter to maintainability.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "gossip-pos-great-in-crisis",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 50000,
		tags: ["gossip", "positive"],
		turns: [
			{ speaker: "A", text: "I've never seen {agentC} panic. Not once, even in a full production incident.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It's almost eerie. Everyone else is spiralling and they're just... methodical.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I try to stand near them in those situations. It helps.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── Negative gossip ──────────────────────────────────────────────

	{
		id: "gossip-neg-been-off",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 3,
		cooldownMs: 40000,
		tags: ["gossip", "negative"],
		turns: [
			{ speaker: "A", text: "Is it just me or has {agentC} been... off lately?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I've noticed something. Slower reviews, shorter responses.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I hope they're okay. I'd ask but I don't know them that well.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "gossip-neg-missing-standups",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 45000,
		tags: ["gossip", "negative"],
		turns: [
			{ speaker: "A", text: "{agentC} has been missing standups. Not every day but... often.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Have they said anything to you?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "No. And I don't want to assume but it's noticeable.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Maybe someone should just check in. Not make it official.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "gossip-neg-dropped-the-ball",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 50000,
		tags: ["gossip", "negative"],
		turns: [
			{ speaker: "A", text: "{agentC} dropped the ball on that handoff and didn't say anything.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know. I only found out when the downstream team hit the gap.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "It's so unlike them. I'm trying not to read into it.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Yeah. We wait. See if it's a pattern or just a rough patch.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "gossip-neg-hard-to-reach",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 3,
		cooldownMs: 40000,
		tags: ["gossip", "negative"],
		turns: [
			{ speaker: "A", text: "I've been trying to get a response from {agentC} for three days.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Same. Not even a quick acknowledgement.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Something's going on. This isn't them.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "gossip-neg-mood-shifted",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 45000,
		tags: ["gossip", "negative"],
		turns: [
			{ speaker: "A", text: "Have you picked up a shift in {agentC}'s energy lately? They seem... withdrawn.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I thought I imagined it but you're right. Less present in meetings.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I really hope they're okay.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Me too. Some things you just can't see from the outside.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "gossip-neg-credit-issue",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 1,
		cooldownMs: 60000,
		tags: ["gossip", "negative"],
		turns: [
			{ speaker: "A", text: "Did {agentC} take credit for the performance fix in that all-hands?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I... think so? Though maybe they just worded it poorly.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Maybe. Giving the benefit of the doubt.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "It stings a bit though. Especially after the hours everyone put in.", delayMs: 2500, kind: "speech" },
		],
	},

	// ── Disagreement gossip ──────────────────────────────────────────

	{
		id: "gossip-disagree-struggling",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 50000,
		tags: ["gossip", "disagreement"],
		turns: [
			{ speaker: "A", text: "I think {agentC} is struggling. The last few PRs had a lot of issues.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I don't know. They just moved teams, right? New codebase, new patterns.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Maybe. But the test coverage was way below threshold.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Give it a sprint. I've seen them ramp before — they get there.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "gossip-disagree-impressed",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 2,
		cooldownMs: 50000,
		tags: ["gossip", "disagreement"],
		turns: [
			{ speaker: "A", text: "I'm really impressed with {agentC}'s architecture proposal. It's solid.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Eh. It looks good on paper but I've seen that pattern fail at scale.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "You don't think they've accounted for that?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "I think they'll find out in production. We all do eventually.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "gossip-disagree-leaving",
		tierRange: ["colleague", "best-friend"],
		trigger: "gossip",
		weight: 1,
		cooldownMs: 60000,
		tags: ["gossip", "disagreement"],
		turns: [
			{ speaker: "A", text: "I heard {agentC} might be leaving. Someone mentioned interviews.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "No way. They just got promoted.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "People leave after promotions all the time. Better leverage.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I don't buy it. They seemed genuinely happy last week.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I hope you're right.", delayMs: 1500, kind: "speech" },
		],
	},
];
