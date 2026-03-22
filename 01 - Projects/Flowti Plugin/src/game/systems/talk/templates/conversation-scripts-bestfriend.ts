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
			{ speaker: "A", text: "...yes. How do you do that?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "We've been finishing each other's technical thoughts for two years, {agentA}.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "The one with the other thing.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Oh I'll fix it tonight.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "A", text: "Do you remember the first project we worked on together?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The disaster with the nested callbacks? How could I forget.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I was so embarrassed about my code and you just... helped, no judgment.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "Your code was fine. You were learning. That's the whole point.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "The pizza was transcendent. I don't know if it was the hunger or if it was genuinely great.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "Both. Definitely both.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "That presentation is with the same client who gave you the impossible feedback last year.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know. I've been dreading it.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I'll be in the room. You won't have to handle it alone this time.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "I really needed to hear that.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "I didn't. I told them it was taken out of context and walked them through it.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "You didn't have to do that. But thank you. Really.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "B", text: "I felt it. When you said 'I think {agentB} raises a good point' — that shifted the room.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "You were right. Someone had to say it.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I don't think I'm actually happy in this role anymore. I haven't been for months.", delayMs: 3500, kind: "speech" },
			{ speaker: "B", text: "Thank you for trusting me with that. What do you need right now?", delayMs: 3000, kind: "speech" },
		],
	},

	{
		id: "bff-no-judgment-zone",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["deep-trust", "humor"],
		turns: [
			{ speaker: "A", text: "I forgot how Git rebase works again.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "No judgment. Every single time?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Every. Single. Time.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Okay. Sit down. I'm making you a laminated card.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "No. I feel like I should have done more this quarter.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "You shipped three features, unblocked two teams, and mentored a junior. I would literally list those.", delayMs: 3500, kind: "speech" },
			{ speaker: "B", text: "You remembered all that?", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "If this goes badly, I want you to know — it was my plan, not yours.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It was our plan. I agreed to it. We go down together or not at all.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "You're going to regret saying that.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Probably. Let's do it.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "bff-first-call",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["ride-or-die", "warmth"],
		turns: [
			{ speaker: "A", text: "If I ever get offered something big — a real opportunity — you're the first person I'm calling.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Before or after your family?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "...okay, after. But immediately after.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I'll accept that position in your hierarchy.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "You're tapping your foot and you've reread the same line four times. What happened?", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "I know. I'll frame it as a question if the room gets defensive.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "You already planned for that?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I saw your face during the briefing. I've been your support crew for two years. Of course I did.", delayMs: 3000, kind: "speech" },
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
			{ speaker: "A", text: "Hey. Just wanted to see your face.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Long morning?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Endless. This helped.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Yeah. Me too.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "B", text: "You said that before the launch demo too. And the rewrite. And the architecture presentation.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "And?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "And you were magnificent every single time. Now go.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "bff-dont-need-words",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["nonverbal", "connection"],
		turns: [
			{ speaker: "A", text: "...", delayMs: 0, kind: "thought" },
			{ speaker: "B", text: "I know.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "Yeah.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I needed to hear that, even though I didn't want to.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I only say the hard things because I think you can do something about them.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "That might be the nicest thing anyone's ever said to me, framed as criticism.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "You're welcome. Buy me lunch and we're square.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "bff-no-reason-check",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["warmth", "shorthand"],
		turns: [
			{ speaker: "A", text: "You good?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I'm good. You good?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Yeah.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "A", text: "Why does the coffee machine do that thing where it pauses for no reason?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I KNOW. I've been saying this for months.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "It's like it's judging your order.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "It absolutely is. That pause is personal.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "bff-absurd-in-joke",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["humor", "in-joke"],
		turns: [
			{ speaker: "A", text: "You know what, {agentB}? Seventeen.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Ha! Seventeen. Classic.", delayMs: 1200, kind: "speech" },
			{ speaker: "A", text: "Gets me every time.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "bff-comfortable-silence",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["humor", "nonverbal"],
		turns: [
			{ speaker: "A", text: "...", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "...", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Good talk.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Best one yet.", delayMs: 1200, kind: "speech" },
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

	{
		id: "bff-guilty-pleasure",
		tierRange: ["best-friend", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["humor", "confession"],
		turns: [
			{ speaker: "A", text: "Don't tell anyone but I still use console.log for debugging.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "...same.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "The printer is making that noise again.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The judgmental one or the dying one?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "New noise. I think it's plotting something.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "I've always said that printer has an agenda.", delayMs: 1500, kind: "speech" },
		],
	},
];
