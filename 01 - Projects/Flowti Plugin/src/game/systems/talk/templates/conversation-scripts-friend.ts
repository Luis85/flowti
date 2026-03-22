/**
 * conversation-scripts-friend.ts — Multi-turn conversation scripts for friend tier.
 *
 * Inside jokes, genuine concern, comfortable teasing, casual deep talk, and the
 * easy warmth of people who have chosen each other — not just been placed together.
 */

import type { ConversationScript } from "../conversation-types.js";

export const FRIEND_SCRIPTS: readonly ConversationScript[] = [
	// ── Inside jokes ────────────────────────────────────────────────

	{
		id: "frd-the-great-migration",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["inside-joke", "humor"],
		turns: [
			{ speaker: "A", text: "Don't look now but someone's opening the database migration tool.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Already texting in case I need to be somewhere else.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Same. We move as one.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "frd-cursed-ticket",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["inside-joke", "humor"],
		turns: [
			{ speaker: "A", text: "FEAT-419 is back from the dead.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It always comes back. It will outlive us all.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I should name it. Formally.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Call it Lazarus. Give it the respect it's earned.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "frd-cursed-variable",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["inside-joke", "humor"],
		turns: [
			{ speaker: "A", text: "The variable is still named 'foo2'.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "In production.", delayMs: 1000, kind: "speech" },
			{ speaker: "A", text: "In production.", delayMs: 1000, kind: "speech" },
		],
	},

	// ── Genuine concern ──────────────────────────────────────────────

	{
		id: "frd-checking-in-real",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["concern", "emotional-support"],
		turns: [
			{ speaker: "A", text: "Hey. How are you actually doing? Not the 'fine' answer.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Honestly? A bit burnt out. This sprint has been relentless.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Yeah. I see it. We should get lunch, proper catch-up.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I'd actually really like that.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "frd-noticed-the-effort",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["concern", "recognition"],
		turns: [
			{ speaker: "A", text: "You've been here really early all week, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Trying to get ahead of it before things get loud.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Just don't forget to actually leave at a reasonable time.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "I will. Thanks for noticing.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "frd-after-bad-day",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["concern", "emotional-support"],
		turns: [
			{ speaker: "A", text: "Yesterday looked rough. You okay?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I'm okay. I was in my head about it but slept it off.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Good. The feedback in that review was unnecessarily harsh.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I thought so too but wasn't sure if I was being sensitive.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── Comfortable teasing ─────────────────────────────────────────

	{
		id: "frd-predictable-opinion",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["teasing", "humor"],
		turns: [
			{ speaker: "A", text: "Tabs or spaces?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Tabs. Obviously. We've had this conversation, {agentA}.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I know. I just like watching you commit.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "frd-overconfidence-check",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["teasing", "humor"],
		turns: [
			{ speaker: "A", text: "I'm going to finish this whole feature by lunch.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You said that on Tuesday.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "And I was directionally correct.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "It's Friday, {agentA}.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "frd-coffee-dependence",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["teasing", "humor"],
		turns: [
			{ speaker: "A", text: "You've had three coffees and it's 10am.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The fourth one is for personality.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "That tracks.", delayMs: 1000, kind: "speech" },
		],
	},

	// ── Casual deep talk ─────────────────────────────────────────────

	{
		id: "frd-why-we-do-this",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["deep-talk", "reflection"],
		turns: [
			{ speaker: "A", text: "Do you ever think about what it actually means to build good software?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Sometimes. I think it means leaving less mess than you found.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That's a really humble way to put it.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I've been humbled a lot recently.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "frd-career-trajectory",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 45000,
		tags: ["deep-talk", "personal"],
		turns: [
			{ speaker: "A", text: "Do you see yourself doing this in ten years?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Some version of it. More building, less firefighting hopefully.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That's the dream.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "frd-what-you-like-about-it",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["deep-talk", "reflection"],
		turns: [
			{ speaker: "A", text: "What do you actually enjoy about the work?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "When something clicks — like a refactor that makes a messy system suddenly make sense.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "Yes. That moment is worth every frustrating hour before it.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Exactly.", delayMs: 1000, kind: "speech" },
		],
	},

	// ── Mentoring ────────────────────────────────────────────────────

	{
		id: "frd-honest-feedback",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["mentoring", "honest"],
		turns: [
			{ speaker: "A", text: "Can I give you some honest feedback about the proposal?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "From you? Yes. Please.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "The what is solid. The why needs more work. Why should they care?", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Okay. That's exactly the question I was avoiding.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "frd-passing-knowledge",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["mentoring", "helpful"],
		turns: [
			{ speaker: "A", text: "The way you handled that conflict in the design meeting — that was skilled.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I just asked everyone what they actually needed vs what they wanted.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Most people never learn that distinction. I'm serious, remember that move.", delayMs: 2500, kind: "speech" },
		],
	},

	// ── Celebrating wins ─────────────────────────────────────────────

	{
		id: "frd-big-win-celebration",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["celebration", "warmth"],
		turns: [
			{ speaker: "A", text: "The feature shipped. It's live. It's actually live!", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I SAW THE DEPLOY LOG. We did it!", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Three weeks of hell and it just... works.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Tonight we eat. I'm buying.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "frd-small-win-shared",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["celebration", "warmth"],
		turns: [
			{ speaker: "A", text: "I refactored that god-object and it's under 200 lines now.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "From 900-something? {agentA}. That's enormous.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I just needed you to know. Nobody else would understand.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I understand. I'm proud of you.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "frd-recognition-shared",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["celebration", "recognition"],
		turns: [
			{ speaker: "A", text: "They mentioned your name in the all-hands today.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "What? Seriously?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Yeah. Called out the performance work specifically. Deserved.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I... wow. Okay. I wasn't expecting that.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "frd-plan-making",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 30000,
		tags: ["personal", "warmth"],
		turns: [
			{ speaker: "A", text: "We should actually do that hiking thing we've been saying we'd do.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Pick a date. I will actually show up.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "First Saturday of next month. I'm putting it in the calendar right now.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Done. No takesies-backsies.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "frd-remember-when",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["inside-joke", "nostalgia"],
		turns: [
			{ speaker: "A", text: "Remember when we deployed to production on a Friday afternoon?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I've tried very hard to forget that.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "The hotfix at 11pm. The slack messages.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "We have both grown so much since then.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "frd-you-were-right",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["honest", "warmth"],
		turns: [
			{ speaker: "A", text: "You were right. I should have used a state machine from the start.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh, I know I was. I wasn't going to bring it up though.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I appreciate the restraint.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "I save 'I told you so' for the really big ones.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "frd-vent-session",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["emotional-support", "honest"],
		turns: [
			{ speaker: "A", text: "I just need to vent for 60 seconds and then I'll be okay.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Clock starts now. Go.", delayMs: 1000, kind: "speech" },
			{ speaker: "A", text: "The requirements changed AGAIN and nobody told anyone and the ticket is still marked complete and I—", delayMs: 4000, kind: "speech" },
			{ speaker: "B", text: "Time. Better?", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "frd-covering-each-other",
		tierRange: ["friend", "friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["warmth", "support"],
		turns: [
			{ speaker: "A", text: "I've got your back if they ask about the timeline delay.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You don't have to do that.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I know. The delay is half my fault anyway. We're in this together.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Thank you. Genuinely.", delayMs: 1500, kind: "speech" },
		],
	},
];
