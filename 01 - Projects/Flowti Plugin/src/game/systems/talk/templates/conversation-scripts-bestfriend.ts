/**
 * conversation-scripts-bestfriend.ts — Multi-turn conversation scripts for best-friend tier.
 *
 * The language of people who have been through it together. Shorthand, shared history,
 * finishing each other's sentences, defending each other instinctively, and the deep
 * trust that only comes from time and consistent showing up.
 */

import type { ConversationScript } from "../conversation-types.js";

export const BESTFRIEND_SCRIPTS: readonly ConversationScript[] = [
	// ── Finishing sentences / shorthand ─────────────────────────────

	{
		id: "bff-the-look",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["shorthand", "nonverbal"],
		turns: [
			{ speaker: "A", text: "Did you see—", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yes.", delayMs: 800, kind: "speech" },
			{ speaker: "A", text: "And the way he just—", delayMs: 1000, kind: "speech" },
			{ speaker: "B", text: "I know.", delayMs: 800, kind: "speech" },
			{ speaker: "A", text: "We don't even need full sentences anymore.", delayMs: 1200, kind: "thought" },
		],
	},

	{
		id: "bff-mind-read",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["shorthand", "connection"],
		turns: [
			{ speaker: "A", text: "I was just thinking—", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "That we should refactor the resolver before adding new fields?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "...how do you DO that?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "We've been finishing each other's technical thoughts for two years. I'd be worried if I couldn't.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "bff-one-word-full-meaning",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["shorthand", "humor"],
		turns: [
			{ speaker: "A", text: "The thing.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The thing from the thing?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "The one with the other thing. Near the stuff.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Oh THAT thing. I'll fix it tonight.", delayMs: 1000, kind: "speech" },
		],
	},

	// ── Shared history ───────────────────────────────────────────────

	{
		id: "bff-the-origin-story",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["shared-history", "warmth"],
		turns: [
			{ speaker: "A", text: "Remember the first project we worked on together? The disaster with the nested callbacks?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You tried to refactor it at 6pm on a Thursday. I thought you were going to cry.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I was SO embarrassed. And you just sat down and helped. No judgment, no 'well actually.'", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "Your code was fine. You were learning. That's the whole point of this.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "bff-legendary-night",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["shared-history", "humor"],
		turns: [
			{ speaker: "A", text: "Today marks exactly one year since the all-nighter.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I commemorate it annually in my heart. Six hours, four bugs, one legendary pizza.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "That pizza was transcendent. I genuinely can't tell if it was actually good or if it was the hunger talking.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "Both. Definitely both. I've tried to recreate that experience and it's impossible.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "bff-inside-knowledge",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["shared-history", "support"],
		turns: [
			{ speaker: "A", text: "That presentation tomorrow — it's with the same client who gave you the impossible feedback last year.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "...I know. I've been dreading it all week.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I'll be in the room. You won't have to handle it alone this time.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "You remembered.", delayMs: 1500, kind: "speech" },
		],
	},

	// ── Defending each other ─────────────────────────────────────────

	{
		id: "bff-public-defense",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["loyalty", "support"],
		turns: [
			{ speaker: "A", text: "I heard what {third} said about your code in the review.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I was going to let it go.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Well, I didn't. Walked them through the context they'd conveniently ignored.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "You didn't have to do that.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Yes I did.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "bff-quiet-backing",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["loyalty", "shorthand"],
		turns: [
			{ speaker: "A", text: "In the meeting just now — when you pushed back on the scope — I had your back.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I felt it. When you said 'I think {agentB} raises a good point' — the whole room shifted.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "You were right. Someone had to back you up.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── Deep trust ──────────────────────────────────────────────────

	{
		id: "bff-real-talk",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["deep-trust", "honest"],
		turns: [
			{ speaker: "A", text: "I'm going to tell you something and I need you to just receive it, not fix it.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Okay. I'm here.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I don't think I'm happy in this role anymore. I haven't been for months. And I keep wondering if everyone can tell.", delayMs: 4000, kind: "speech" },
			{ speaker: "B", text: "Thank you for trusting me with that. What do you need right now?", delayMs: 3000, kind: "speech" },
		],
	},

	{
		id: "bff-imposter-moment",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["deep-trust", "vulnerability"],
		turns: [
			{ speaker: "A", text: "Everyone in that meeting understood the proposal except me. And I nodded along like I got it.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I also didn't fully get it.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Wait, really?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Really. I think half the room was nodding along too. You're not the fraud you think you are.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "bff-pre-big-moment",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["deep-trust", "support"],
		turns: [
			{ speaker: "A", text: "You ready for the performance review?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "No. I feel like I should have done more.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "You shipped three features, unblocked two teams, and mentored a junior. I would literally list those. Out loud. To their face.", delayMs: 3500, kind: "speech" },
			{ speaker: "B", text: "...you remembered all of that?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Someone has to, since you won't.", delayMs: 1500, kind: "speech" },
		],
	},

	// ── Ride-or-die energy ──────────────────────────────────────────

	{
		id: "bff-unconditional",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["ride-or-die", "loyalty"],
		turns: [
			{ speaker: "A", text: "If this goes badly, I want you to know — it was my plan, not yours. Take the exit.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It was OUR plan. I agreed to it. We go down together or not at all.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "You're going to regret saying that.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Probably. Let's do it anyway.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "bff-knows-your-tells",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["shorthand", "connection"],
		turns: [
			{ speaker: "A", text: "I'm fine.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You're tapping your foot and you've reread the same line four times.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I hate that you know me this well.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "No you don't. Talk to me.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "bff-in-sync-on-hard-call",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["deep-trust", "loyalty"],
		turns: [
			{ speaker: "A", text: "I'm going to push back on this decision in the meeting.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know. I'll reframe it as a question if the room gets defensive.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "You already planned for that?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I saw your face during the briefing. Two years of support crew duty. Of course I did.", delayMs: 3000, kind: "speech" },
		],
	},

	{
		id: "bff-just-checking",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["warmth", "connection"],
		turns: [
			{ speaker: "A", text: "Hey. Just wanted to see your face for a second.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Long morning?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Endless. This helped though.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "bff-the-pep-talk",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["ride-or-die", "support"],
		turns: [
			{ speaker: "A", text: "I don't think I can do this.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You said that before the launch demo. And the rewrite. And the architecture presentation.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "And?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "And you were magnificent every time. Now go.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "bff-comfortable-silence",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["nonverbal", "connection"],
		turns: [
			{ speaker: "A", text: "...", delayMs: 0, kind: "thought" },
			{ speaker: "B", text: "...", delayMs: 3000, kind: "thought" },
			{ speaker: "A", text: "Good talk.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Best one we've had all week.", delayMs: 1200, kind: "speech" },
		],
	},

	{
		id: "bff-post-hard-conversation",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["deep-trust", "honest"],
		turns: [
			{ speaker: "A", text: "I needed to hear that, even though I really didn't want to.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I only say the hard things because I think you can actually do something about them.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "That might be the nicest thing anyone's ever said to me. Framed entirely as criticism.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "That's my love language. Buy me lunch and we're square.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── Light-hearted / comfortable nonsense ────────────────────────

	{
		id: "bff-petty-complaint",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["humor", "petty"],
		turns: [
			{ speaker: "A", text: "Why does the coffee machine pause like that? Like it's making a DECISION.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I'VE BEEN SAYING THIS. It's judging your order.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "That pause is absolutely personal. It knows.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "I switched to tea for a week and when I came back the pause was LONGER.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "bff-guilty-pleasure",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["humor", "confession"],
		turns: [
			{ speaker: "A", text: "Don't tell anyone but I still use console.log for debugging. Exclusively.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "...", delayMs: 2000, kind: "thought" },
			{ speaker: "B", text: "Same.", delayMs: 1000, kind: "speech" },
			{ speaker: "A", text: "We never speak of this.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Speak of what?", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "bff-shared-enemy",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["humor", "petty"],
		turns: [
			{ speaker: "A", text: "The printer is making a new noise.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The judgmental one or the dying one?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Neither. New. I think it's evolving.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "I have always said that printer has an agenda and I will not be gaslit about this.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "bff-competitive-loving",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["humor", "competition"],
		turns: [
			{ speaker: "A", text: "Bet I can fix this faster than you.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You're on. Loser buys lunch.", delayMs: 1200, kind: "speech" },
			{ speaker: "A", text: "You're going to lose so bad.", delayMs: 1200, kind: "speech" },
			{ speaker: "B", text: "I'm already halfway done.", delayMs: 1000, kind: "speech" },
			{ speaker: "A", text: "You are NOT.", delayMs: 800, kind: "speech" },
		],
	},
];
