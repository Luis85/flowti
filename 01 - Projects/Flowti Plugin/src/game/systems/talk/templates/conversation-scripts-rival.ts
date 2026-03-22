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
			{ speaker: "A", text: "Some lines needed multiple comments.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "And yet I'm choosing to take it as one. You're welcome.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Mine were harder.", delayMs: 1200, kind: "speech" },
			{ speaker: "B", text: "Mine had more edge cases.", delayMs: 1200, kind: "speech" },
			{ speaker: "A", text: "Mine required deep architectural knowledge.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Are we really doing this in front of everyone?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "You started it.", delayMs: 800, kind: "speech" },
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
			{ speaker: "A", text: "Taken by what?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "'data'. Keep up.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "A", text: "Nobody's ever the one who broke the build. And yet.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Statistically? It's you about 60% of the time. I've been tracking.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "You've been TRACKING?", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "My name is literally on it.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "...it says 'World's Okayest Developer.'", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Exactly. Custom made. Hand me my mug.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "We do now. I'm designating them. This tape line is legally binding.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "That's painter's tape.", delayMs: 1200, kind: "speech" },
			{ speaker: "A", text: "Legally. Binding.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "A", text: "{agentB}, your keyboard is very... percussive today.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I type with conviction.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "You type like you're punishing the keys for something they did in a past life.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Maybe I am.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "I do now. Retroactively. And you're in violation of it.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "That solution was... actually not terrible, {agentB}. Don't let it go to your head.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "'Not terrible.' Be still my heart.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "That's the highest praise I'm prepared to give. Take it or leave it.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I'm framing it. 'Not Terrible — {agentA}, 2026.'", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Your code is very... readable. For someone at your experience level, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "What does 'experience level' mean in this context.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "It means readable! That's a compliment!", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I can hear the quotation marks, {agentA}.", delayMs: 1500, kind: "thought" },
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
			{ speaker: "A", text: "Your docs are very... efficient, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Thanks, brevity is a skill.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "One sentence per module is certainly... brave.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "You're welcome to contribute. Unless writing is outside your experience level.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I saw your demo, {agentB}. Just wanted you to know.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh? What did you think?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I thought it was fine.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "...'fine' is doing a lot of heavy lifting in that sentence.", delayMs: 2000, kind: "thought" },
		],
	},

	{
		id: "rival-grudging-respect",
		tierRange: ["rival", "rival"],
		trigger: "work-finished",
		weight: 2,
		cooldownMs: 50000,
		tags: ["tension", "respect"],
		turns: [
			{ speaker: "A", text: "I hate that you're right about the indexing strategy.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I'm sorry, can you say that again? Louder? Maybe into a microphone?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I said what I said. Don't make me repeat it. This changes nothing between us.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "It changes a little bit.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "It changes nothing.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "B", text: "You sit three desks away.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Figuratively passing through. Emotionally.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "The threshold is 70.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "MY threshold is 95.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Then write the tests yourself.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Maybe I will. And they'll be better.", delayMs: 1500, kind: "thought" },
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
		id: "rival-commit-message-drama",
		tierRange: ["rival", "rival"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["tension", "sitcom"],
		turns: [
			{ speaker: "A", text: "{agentB}, 'fix stuff' is not a commit message. It's a cry for help.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It accurately describes what I did. I fixed stuff.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Which stuff? All stuff? Some stuff? Stuff in general?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "The relevant stuff. If you need more context, read the diff. That's what it's for.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I heard you're speaking at the conference, {agentB}. That's great.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah! Really excited about it.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Great. I spoke there last year. It's a nice crowd. Very forgiving.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "...'forgiving'?", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "That was MY module.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Was. Past tense. It's been liberated.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "You can't just annex people's modules.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "And yet, here we are.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "A", text: "It never makes sense. It's a global variable wearing a tuxedo.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "It's a pattern! Recognised by the Gang of Four!", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "They had regrets. I've read the interviews.", delayMs: 1500, kind: "thought" },
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
			{ speaker: "A", text: "That feature you shipped... I had that same idea last month.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Did you write it down?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Well, no, but I was thinking about—", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Then you had a vibe. I shipped a feature. Different things.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "B", text: "Okay. What do you need.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Can't a person just be genuinely nice?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "A person can. You specifically? I have questions.", delayMs: 1500, kind: "thought" },
		],
	},
];
