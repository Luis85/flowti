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
			{ speaker: "B", text: "...I was not expecting that.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Don't make it weird. I'm being professional.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Okay. Thank you. Genuinely.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I hate that you're right.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Temporary truce?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Temporary truce.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "B", text: "You've been staring at that stack trace for two hours.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "I'm handling it.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Your null check is in the wrong branch. Line 94.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "...how did you—", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "I made that same mistake six months ago. You're welcome.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "That's accurate.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "But every time you push back on my ideas... you're usually not wrong.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "I could say the same about you. Reluctantly.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "I don't think I'd have made it through last month without you.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You would have. But I'm glad I was there.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "The 2am call. The fix. The terrible vending machine coffee at 4am.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "That was the night I realised you were my person on this team.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "B", text: "There's something I haven't told anyone here. But I think I can tell you.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "I'm listening. No judgment.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I almost quit last year. I had an offer. I turned it down and I don't fully know why.", delayMs: 3500, kind: "speech" },
			{ speaker: "A", text: "I'm glad you stayed. More than I know how to say.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "Good. Really good. And my first thought was to tell you.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "That's... that means a lot to me, actually.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "You were right. They were being unfair.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Still. You didn't hesitate.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I never would. That's just how it is now.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "We used to actually talk. Like properly. What happened?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Life, I think. Things got busier. We stopped making the effort.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I miss it.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "So do I. I don't know if we can get it back though.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "I feel like we're working toward completely different things now.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah. Our priorities diverged somewhere and I'm not sure when.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "It's not anyone's fault, I think. Just... different chapters.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Maybe. Doesn't make it less strange.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "You referred to me as 'a colleague' in that email.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "It was a formal email. To the whole department.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I know. It just landed strangely.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I'm sorry. I didn't mean anything by it.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "That's not the point. The point is you said something.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "I know. I don't have an excuse. I'm genuinely sorry.", delayMs: 2500, kind: "speech" },
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
			{ speaker: "A", text: "You applied for the role. The one we talked about together.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know how that looks.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I'm not angry you applied. I'm angry you didn't say anything.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "I was scared of this conversation. That's not okay. I know.", delayMs: 3000, kind: "speech" },
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
			{ speaker: "B", text: "Can we talk? Actually talk. It feels like things haven't been right between us.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "I've been trying to work out how to say this. Something shifted.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Since the incident at the offsite?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Yeah. I think so. I need more time before I know what I feel about it.", delayMs: 3000, kind: "speech" },
		],
	},
];
