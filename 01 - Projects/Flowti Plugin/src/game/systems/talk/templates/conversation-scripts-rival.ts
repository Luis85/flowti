/**
 * conversation-scripts-rival.ts — Multi-turn conversation scripts for rival tier.
 *
 * Professional tension, sitcom rivalry, and passive-aggressive exchanges between
 * agents who cannot stand each other but must remain professionally civil.
 */

import type { ConversationScript } from "../conversation-types.js";

export const RIVAL_SCRIPTS: readonly ConversationScript[] = [
	// ── Professional tension ────────────────────────────────────────

	{
		id: "rival-code-review",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["tension", "code-review"],
		turns: [
			{ speaker: "A", text: "I reviewed your PR, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "...and?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I left 47 comments.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "On a 12-line file?", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "rival-architecture-disagreement",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 60000,
		tags: ["tension", "architecture"],
		turns: [
			{ speaker: "A", text: "Your approach is... interesting, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Thanks. I worked hard on it.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I didn't mean it as a compliment.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I knew exactly what you meant.", delayMs: 1000, kind: "thought" },
		],
	},

	{
		id: "rival-standup-competition",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 50000,
		tags: ["tension", "sitcom"],
		turns: [
			{ speaker: "A", text: "I closed 9 tickets yesterday.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I closed 11.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Mine were harder.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Mine had more edge cases.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Mine required deep architectural knowledge.", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "rival-naming-convention",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["tension", "passive-aggressive"],
		turns: [
			{ speaker: "A", text: "{agentB}, why is this variable named 'data2'?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Because 'data' was taken.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "By what?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "'data'.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "rival-deployment-blame",
		tierRange: ["rival", "rival"],
		trigger: "work-finished",
		weight: 1,
		cooldownMs: 60000,
		tags: ["tension", "blame"],
		turns: [
			{ speaker: "A", text: "The build broke again.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Not my commit.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "No one ever says it was their commit.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "And yet, statistically, it was yours.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── Sitcom rivalry ──────────────────────────────────────────────

	{
		id: "rival-coffee-territory",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["sitcom", "petty"],
		turns: [
			{ speaker: "A", text: "{agentB}, that's my mug.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It was in the communal area.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "My name is on it.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "...oh. It says 'World's Okayest Developer.'", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "And it fits you so well.", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "rival-desk-space",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 45000,
		tags: ["sitcom", "petty"],
		turns: [
			{ speaker: "A", text: "Your cable is on my side of the desk.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "We don't have designated desk sides.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "We do now. I'm designating them.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "rival-keyboard-sounds",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["sitcom", "passive-aggressive"],
		turns: [
			{ speaker: "A", text: "{agentB}, your keyboard is very... loud.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I type with passion.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "You sound like you're typing with malice.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Potato, potato.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "rival-meeting-scheduling",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 55000,
		tags: ["sitcom", "tension"],
		turns: [
			{ speaker: "A", text: "You scheduled a meeting over my lunch block, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You have a lunch block?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I do now. Retroactively.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "rival-compliment-trap",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 50000,
		tags: ["passive-aggressive", "sitcom"],
		turns: [
			{ speaker: "A", text: "That solution was surprisingly clever, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Surprisingly?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I phrased that wrong. It was... adequately clever.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "You're getting worse at this, you know.", delayMs: 1500, kind: "speech" },
		],
	},

	// ── Passive-aggressive ──────────────────────────────────────────

	{
		id: "rival-backhanded-praise",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 45000,
		tags: ["passive-aggressive", "fake-nice"],
		turns: [
			{ speaker: "A", text: "Your code is very... readable for someone at your level, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "What does 'at my level' mean?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "It means readable! Readable is a compliment!", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I can hear the air quotes.", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "rival-documentation-critique",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 55000,
		tags: ["passive-aggressive", "tension"],
		turns: [
			{ speaker: "A", text: "Your docs are very... concise, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Thanks, I worked hard on them.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "One sentence per module is... a choice.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "You're welcome to contribute.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "rival-silent-competition",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 60000,
		tags: ["passive-aggressive", "tension"],
		turns: [
			{ speaker: "A", text: "Just wanted to say I saw your demo, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh? What did you think?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I thought it was fine.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "'Fine.' Right.", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "rival-acquaintance-crossover",
		tierRange: ["rival", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["tension", "passive-aggressive"],
		turns: [
			{ speaker: "A", text: "Hey {agentB}. Just passing through.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You live here.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Figuratively. Passing through figuratively.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "rival-test-coverage-war",
		tierRange: ["rival", "rival"],
		trigger: "work-finished",
		weight: 2,
		cooldownMs: 50000,
		tags: ["tension", "code-review"],
		turns: [
			{ speaker: "A", text: "{agentB}, your test coverage is at 78%.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The threshold is 70%.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "My threshold is higher.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Then write the tests yourself.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Maybe I will.", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "rival-meeting-opinions",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 40000,
		tags: ["tension", "passive-aggressive"],
		turns: [
			{ speaker: "A", text: "Nice point in the meeting, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Thanks, I thought of it on the spot.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "It showed.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Was that a compliment or—", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Yes.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "rival-performance-review",
		tierRange: ["rival", "rival"],
		trigger: "mood-event",
		weight: 1,
		cooldownMs: 60000,
		tags: ["tension", "passive-aggressive"],
		turns: [
			{ speaker: "A", text: "Performance reviews next week.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know. I'm ready.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I'm sure you are.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "That was ominous.", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "rival-commit-message-drama",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["tension", "sitcom"],
		turns: [
			{ speaker: "A", text: "{agentB}, 'fix stuff' is not a valid commit message.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It accurately describes what I did.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "You fixed 'stuff'. Which stuff? All of it? Some of it?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "The relevant stuff.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "rival-conference-talk-comparison",
		tierRange: ["rival", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 55000,
		tags: ["tension", "passive-aggressive", "fake-nice"],
		turns: [
			{ speaker: "A", text: "I heard you're speaking at the conference, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah! Really excited about it.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Great. I spoke there last year, it's a nice crowd.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "What is happening right now.", delayMs: 2000, kind: "thought" },
		],
	},

	{
		id: "rival-refactoring-ownership",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 50000,
		tags: ["tension", "sitcom"],
		turns: [
			{ speaker: "A", text: "I refactored that module, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "That was my module.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Was. Past tense.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "You can't just take people's modules.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "And yet.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "rival-design-pattern-argument",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 60000,
		tags: ["tension", "architecture"],
		turns: [
			{ speaker: "A", text: "A singleton? Really, {agentB}?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It made sense for this use case.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "It never makes sense. It's a global variable in a fancy coat.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "It's a pattern! Recognized by the Gang of Four!", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "They also had regrets.", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "rival-feature-stealing",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 55000,
		tags: ["tension", "sitcom"],
		turns: [
			{ speaker: "A", text: "That feature you shipped... I had the same idea last month.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Did you write it down?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Well, no.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Then you had a passing thought. I shipped a feature.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "rival-overly-nice-greeting",
		tierRange: ["rival", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["passive-aggressive", "fake-nice"],
		turns: [
			{ speaker: "A", text: "Good morning, {agentB}! Love the energy today.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Thank you? You're being very... warm.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Just a great day to be alive and productive!", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "They want something.", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "rival-meeting-talk-time",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 50000,
		tags: ["tension", "passive-aggressive"],
		turns: [
			{ speaker: "A", text: "{agentB}, you talked for 22 minutes in that meeting.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I had a lot to say.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "The meeting was scheduled for 30.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "...so did everyone else get to go?", delayMs: 2000, kind: "speech" },
		],
	},
];
