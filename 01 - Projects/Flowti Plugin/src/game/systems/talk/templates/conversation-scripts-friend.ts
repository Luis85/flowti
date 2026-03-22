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
			{ speaker: "B", text: "Already composing my 'working from home' message. We move as one.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Last time this happened we lost a Friday. I'm not losing another Friday.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Of course it is. It will outlive us, our children, and the heat death of the universe.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I should name it. Formally. It's earned personhood at this point.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Call it Lazarus. Light a candle. Show it the respect it demands.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "In production. Serving real customers. With their real money.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "And nobody's going to touch it because last time someone tried, it all fell down.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Hey. How are you actually doing? Not the 'fine' answer. The real one.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Honestly? I'm running on fumes. This sprint broke something in me.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Yeah. I see it. Let's get out of this building and eat something that isn't from a vending machine.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "I'd really like that. Thanks for asking properly.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "You've been here really early all week, {agentB}. Like, before-the-lights-are-on early.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Trying to get ahead of it before things get loud.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Just don't forget to actually leave at a reasonable time. Nobody's handing out medals for burnout.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "I know. Thanks for noticing. Most people don't.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Yesterday looked rough. I wanted to check — you okay?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I'm okay now. I was in my head about it all night but I slept it off.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Good. For what it's worth, the feedback in that review was unnecessarily harsh.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I thought so too. I kept wondering if I was being too sensitive.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "You weren't. I'd have been upset too.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Tabs. Obviously. We've had this conversation twelve times, {agentA}.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I know. I just like hearing the passion in your voice when you commit to it.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "It's Friday, {agentA}. The direction was 'later.'", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "The first two were structural. The third is for personality.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "That tracks. You were unbearable before the second one.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Sometimes. I think it means leaving things a little less broken than you found them.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That's a really humble way to put it.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I've been humbled a lot recently. It changes your definition of 'good.'", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "Some version of it. More building things I care about, less firefighting. Hopefully.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That's the dream, isn't it. More signal, less noise.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Ask me again in five years. I might have a different answer.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "What do you actually enjoy about the work? Like, the thing that keeps you here.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "When something clicks — a refactor that makes a messy system suddenly make sense. That moment.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "Yes. That moment is worth every frustrating hour before it.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Exactly. You can't explain it to people who don't do this.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "From you? Always. Go.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "The what is solid. The why needs work. Why should anyone care?", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "...that's the exact question I've been avoiding. Okay. Back to the drawing board.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "The way you handled that conflict in the design meeting — that was really skilled.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I just asked everyone what they actually needed versus what they wanted.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Most people never learn that distinction. I'm serious — remember that move. It's rare.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "The feature shipped. It's live. It's ACTUALLY live!", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I SAW THE DEPLOY LOG. WE DID IT.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Three weeks of hell and it just... works. In production. With real users.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Tonight we eat real food. My treat. No arguments.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "I refactored that god-object. Under 200 lines now.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "From 900-something? {agentA}. That's enormous.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I just needed someone to tell. Nobody else would understand why that matters.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I understand. I'm genuinely proud of you.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Wait. What? Seriously?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Called out the performance work specifically. It was deserved and everyone knew it.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I... didn't know. Okay. I don't know what to do with my face right now.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "We should actually do that hiking thing we keep saying we'll do.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Pick a date. I will genuinely, actually, no-excuses show up.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "First Saturday of next month. It's in the calendar. It's real now.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Done. If I bail, you have permission to bring it up in every conversation forever.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "I have tried very hard to bury that memory.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "The hotfix at 11pm. The Slack messages. Your typo in the rollback script.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "We have both grown so much since then. Please never mention the typo again.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "Oh, I know I was right. I've been sitting on this for a week.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I appreciate the restraint. Truly.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "I save the 'I told you so' energy for the really catastrophic ones. This was only medium.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I just need to vent for 60 seconds and then I'll be fine.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Clock starts now. Go.", delayMs: 1000, kind: "speech" },
			{ speaker: "A", text: "The requirements changed AGAIN and nobody told anyone and the ticket is still marked complete and I found out from a COMMENT—", delayMs: 4000, kind: "speech" },
			{ speaker: "B", text: "Time. Feel better?", delayMs: 1200, kind: "speech" },
			{ speaker: "A", text: "...yeah, actually. Thanks.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "If they ask about the timeline delay, I've got your back.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You don't have to do that.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I know. But the delay was half my fault anyway. We're in this together.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Thank you. Genuinely. I won't forget this.", delayMs: 1500, kind: "speech" },
		],
	},
];
