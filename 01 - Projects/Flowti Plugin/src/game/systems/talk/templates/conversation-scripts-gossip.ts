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
			{ speaker: "A", text: "Okay I'm not trying to start anything but — have you noticed {agentC} lately?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The output? Yes. Every ticket, just done. No drama, no blockers. It's almost unsettling.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "They're carrying this sprint and I don't think anyone's said it out loud yet. Which feels wrong.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Someone should. Actually — I might. They deserve to hear it.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "{agentC} really stepped up in that sprint review. Did you see that?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The way they pushed back on scope creep? Quietly, no ego, just... firm.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That takes real confidence. The kind you can't fake.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "They've grown so much and I don't think they even realise it.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I think everyone on the team has noticed {agentC} this quarter. Not just me, right?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It's the quality, not just the speed. That's what gets me.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I heard the lead might say something publicly. I shouldn't know that but... I'm excited for them.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "So deserved. Can we be nearby when they find out? I want to see their face.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "I'm not saying {agentC} should be leading the team, but... no, actually, I am saying that.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The way they just naturally take charge when things get chaotic? Without being loud about it?", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Quiet leadership. The kind nobody resents.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Half of what {agentC} does nobody even sees. They just fix things and never mention it.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I inherited one of their modules last week and — okay, don't laugh — I said 'who WROTE this' out loud. To nobody. In an empty room.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "Was it clean?", delayMs: 1200, kind: "speech" },
			{ speaker: "B", text: "It was a love letter to maintainability. I felt personally attacked by how good it was.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I've never seen {agentC} panic. Not once. Full production incident and they're just... methodical.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It's almost eerie. Everyone's spiralling and they're there like a surgeon.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I'm not saying I stand near them in those situations on purpose, but I'm not NOT saying that.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Is it just me or has {agentC} been... I don't know. Off.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I've noticed something. Slower reviews. Shorter responses. Less of them in the room, if that makes sense.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I feel bad even saying this but I'd ask if I knew them better.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Maybe someone closer to them should. Just... gently.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "{agentC} has been missing standups. Not every day but... often enough that I noticed.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Have they said anything to you?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "No. And I don't want to assume anything, I'm not trying to be... you know.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I know. Maybe someone should just check in. Casually. Not make it a thing.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I feel weird bringing this up but... {agentC} dropped the ball on that handoff and didn't say a word.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I only found out when the downstream team hit the gap. It's so unlike them.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "That's what worries me. This isn't a performance thing. Something else is going on.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Yeah. We wait. See if it's a one-off or if it's a pattern.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I've been trying to get a response from {agentC} for three days. Not even a 'seen it, will reply later.'", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Same. And I'm not someone who chases, but this is getting noticeable.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "This isn't them. Something's going on and I don't know if it's our place to ask.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Have you picked up a shift in {agentC}'s energy? I keep going back and forth on whether I'm imagining it.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You're not. Less present in meetings. Quieter in chat. Just... withdrawn.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I really hope they're okay. I feel guilty even talking about it behind their back.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Me too. But sometimes noticing is the first step toward helping.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Okay I'm going to say this and then I'm going to feel bad. Did {agentC} take credit for the performance fix?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "In the all-hands? I... thought so. But maybe they just worded it poorly?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I want to give the benefit of the doubt. I'm trying to.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "It stings though. Especially after the hours everyone else put in. I'm not over it yet.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "I think {agentC} is struggling. The last few PRs had a lot of issues. I'm not being harsh, just... observing.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "They just moved teams though. New codebase, new patterns — I'd be messy too.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Maybe. But the test coverage was way below threshold.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Give it a sprint. I've seen them ramp before — they always get there.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I'm really impressed with {agentC}'s architecture proposal. Like, genuinely.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Eh. It looks good on paper but I've seen that pattern fail at scale. I'm not saying they're wrong, I'm saying I've been burned.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "I heard — and I don't know if this is true — that {agentC} might be interviewing somewhere.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "No way. They just got promoted.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "People leave after promotions all the time. Better leverage, higher floor.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I don't buy it. They seemed genuinely happy last week. Like, not performing it.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I hope you're right. I really do.", delayMs: 1500, kind: "speech" },
		],
	},
];
