/**
 * conversation-scripts-drama.ts — Soap-opera tier-transition drama scripts.
 *
 * Emotional arcs tied to relationship tier changes:
 *   - Truce: rival → acquaintance (reluctant peace)
 *   - Bonding: friend → best-friend (the moment it deepens)
 *   - Decay: friend → colleague (drifting apart)
 *   - Betrayal: best-friend → friend (something broke the trust)
 */

import type { ConversationScript } from "../conversation-types.js";

export const DRAMA_SCRIPTS: readonly ConversationScript[] = [
	// ── Truce: rival → acquaintance ─────────────────────────────────

	{
		id: "drama-truce-unexpected-agreement",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "tier-change",
		weight: 3,
		cooldownMs: 60000,
		tags: ["drama", "tier-transition", "truce"],
		turns: [
			{ speaker: "A", text: "I don't like admitting this. But your approach to the caching layer was correct.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "...I genuinely don't know what to do with that.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Don't make it weird. I spent two days trying to prove you wrong and I couldn't.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "That might be the most honest thing you've ever said to me.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Don't get used to it.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "drama-truce-shared-enemy",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 70000,
		tags: ["drama", "tier-transition", "truce"],
		turns: [
			{ speaker: "A", text: "We got handed the same impossible deadline.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know. We'll both fail independently or survive together.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I can't believe I'm about to say this.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Temporary truce?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Temporary truce. And we never speak of this again.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "drama-truce-unsolicited-help",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 65000,
		tags: ["drama", "tier-transition", "truce"],
		turns: [
			{ speaker: "B", text: "You've been staring at that stack trace for two hours. I wasn't going to say anything.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "Then don't.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Your null check is in the wrong branch. Line 94. I made the same mistake six months ago.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "...", delayMs: 3000, kind: "thought" },
			{ speaker: "A", text: "Why would you help me?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Because watching someone suffer through something I already solved felt worse than talking to you.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "drama-truce-mutual-respect-earned",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 60000,
		tags: ["drama", "tier-transition", "truce"],
		turns: [
			{ speaker: "A", text: "I've been thinking. We disagree on almost everything.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "That's putting it mildly.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "But every time you push back on my ideas... I go home and the pushback is right. Every time.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "I could say the same about you. And I really didn't want to.", delayMs: 2500, kind: "speech" },
		],
	},

	// ── Bonding: friend → best-friend ───────────────────────────────

	{
		id: "drama-bond-the-crisis-night",
		tierRange: ["best-friend", "best-friend"],
		trigger: "tier-change",
		weight: 3,
		cooldownMs: 60000,
		tags: ["drama", "tier-transition", "bonding"],
		turns: [
			{ speaker: "A", text: "I don't think I'd have made it through last month without you. I need you to know that.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You would have. But I'm really glad I was there.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "The 2am call. The fix. The terrible vending machine coffee at 4am. The silence in the car park after.", delayMs: 3500, kind: "speech" },
			{ speaker: "B", text: "That was the night I stopped thinking of you as a colleague.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "drama-bond-told-you-everything",
		tierRange: ["best-friend", "best-friend"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 70000,
		tags: ["drama", "tier-transition", "bonding"],
		turns: [
			{ speaker: "B", text: "There's something I haven't told anyone here. I didn't say anything because I didn't want to be the one who made it real by saying it out loud.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "Whatever it is. I'm listening.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "I almost quit last year. I had an offer, a good one. I turned it down and I still don't fully know why.", delayMs: 3500, kind: "speech" },
			{ speaker: "A", text: "...", delayMs: 2000, kind: "thought" },
			{ speaker: "A", text: "I'm glad you stayed. I don't have better words than that. I'm just glad.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "drama-bond-first-instinct",
		tierRange: ["best-friend", "best-friend"],
		trigger: "tier-change",
		weight: 3,
		cooldownMs: 55000,
		tags: ["drama", "tier-transition", "bonding"],
		turns: [
			{ speaker: "A", text: "Something big just happened at home. I can't say what yet.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Good big or bad big?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Good. Really good. And my first thought — before anyone else — was to tell you.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "...that's the nicest thing anyone's said to me in years.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "drama-bond-defend-without-asking",
		tierRange: ["best-friend", "best-friend"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 60000,
		tags: ["drama", "tier-transition", "bonding"],
		turns: [
			{ speaker: "B", text: "You defended me in that meeting before I even had a chance to speak.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "You were right. They were being unfair. I wasn't going to sit there.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Still. You didn't hesitate. Not even for a second.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Of course I didn't. That's just how it is now.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── Decay: friend → colleague ────────────────────────────────────

	{
		id: "drama-decay-used-to-talk",
		tierRange: ["colleague", "colleague"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 65000,
		tags: ["drama", "tier-transition", "decay"],
		turns: [
			{ speaker: "A", text: "We used to actually talk. Like properly. Not just Slack threads and ticket comments.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know. I noticed it happening but I didn't know how to say 'hey, are we drifting?' without it being weird.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "It's already weird. It's been weird for weeks.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I miss it. I don't know if we can get it back. But I miss it.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "drama-decay-different-tracks",
		tierRange: ["colleague", "colleague"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 60000,
		tags: ["drama", "tier-transition", "decay"],
		turns: [
			{ speaker: "A", text: "I feel like we're working toward completely different things now. And I don't know when that started.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I think it started the day we stopped eating lunch together. Everything else followed.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "It's not anyone's fault. Just... different chapters.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Yeah. Doesn't make it less sad though.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "drama-decay-formal-now",
		tierRange: ["colleague", "colleague"],
		trigger: "tier-change",
		weight: 3,
		cooldownMs: 55000,
		tags: ["drama", "tier-transition", "decay"],
		turns: [
			{ speaker: "B", text: "You referred to me as 'a colleague' in that email. To the whole department.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "It was a formal email. I didn't mean—", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I know you didn't mean anything by it. That's kind of the problem.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "...", delayMs: 2000, kind: "thought" },
			{ speaker: "A", text: "I'm sorry.", delayMs: 1500, kind: "speech" },
		],
	},

	// ── Betrayal: best-friend → friend ──────────────────────────────

	{
		id: "drama-betray-told-the-secret",
		tierRange: ["friend", "friend"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 70000,
		tags: ["drama", "tier-transition", "betrayal"],
		turns: [
			{ speaker: "A", text: "You told them what I said. I told you that in confidence.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I didn't think it would get back to you. I'm sorry.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That's exactly the point. You didn't think about me at all. You just... said something.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "I don't have an excuse. I was careless with something that mattered and I know that.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "I need some time.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "drama-betray-took-the-opportunity",
		tierRange: ["friend", "friend"],
		trigger: "tier-change",
		weight: 1,
		cooldownMs: 80000,
		tags: ["drama", "tier-transition", "betrayal"],
		turns: [
			{ speaker: "A", text: "You applied for the role. The one we talked about. The one you knew I wanted.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know how that looks.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I'm not even angry you applied. I'm angry you didn't say anything. I had to find out from the posting.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "I was scared of this exact conversation. That's not okay. I know that. But it's the truth.", delayMs: 3000, kind: "speech" },
			{ speaker: "A", text: "The truth would have been a lot easier a week ago.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "drama-betray-not-the-same",
		tierRange: ["friend", "friend"],
		trigger: "tier-change",
		weight: 2,
		cooldownMs: 65000,
		tags: ["drama", "tier-transition", "betrayal"],
		turns: [
			{ speaker: "B", text: "Can we talk? Actually talk. Because pretending things are fine is exhausting.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "I've been trying to work out how to say this. Something shifted between us and I feel it every day.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "Since the offsite?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Yeah. I think so. I don't want to say something I can't take back, so I need more time.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "Okay. I'll be here when you're ready. I owe you that much.", delayMs: 2500, kind: "speech" },
		],
	},
];
