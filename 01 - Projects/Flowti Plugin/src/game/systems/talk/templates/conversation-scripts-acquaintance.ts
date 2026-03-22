/**
 * conversation-scripts-acquaintance.ts — Multi-turn conversation scripts for acquaintance tier.
 *
 * Awkward small talk, surface-level politeness, and the slow warming-up of two
 * agents who know each other's names and not much else yet.
 */

import type { ConversationScript } from "../conversation-types.js";

export const ACQUAINTANCE_SCRIPTS: readonly ConversationScript[] = [
	// ── Awkward small talk ──────────────────────────────────────────

	{
		id: "acq-how-is-it-going",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 45000,
		tags: ["small-talk", "awkward"],
		turns: [
			{ speaker: "A", text: "Hey {agentB}. How's it going?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Good, yeah. You?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Good, yeah.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-weather-opener",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 50000,
		tags: ["small-talk", "weather"],
		turns: [
			{ speaker: "A", text: "Quite a day out there, huh?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Ha, yeah. Really something.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Mm.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "...well, back to it.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "acq-weekend-generic",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 60000,
		tags: ["small-talk", "weekend"],
		turns: [
			{ speaker: "A", text: "Do anything good over the weekend, {agentB}?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Not much. Just relaxed, you know.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "That's the move. I went to the park. It was... a park.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "acq-name-uncertainty",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 60000,
		tags: ["awkward", "small-talk"],
		turns: [
			{ speaker: "A", text: "Hey! {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Hey! {agentA}.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Good chat.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Absolutely.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "acq-elevator-encounter",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["awkward", "small-talk"],
		turns: [
			{ speaker: "A", text: "Oh hey {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Hey {agentA}.", delayMs: 1000, kind: "speech" },
			{ speaker: "A", text: "...busy day?", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Yeah. You?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Yeah.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-coffee-small-talk",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["small-talk", "warming-up"],
		turns: [
			{ speaker: "A", text: "Coffee run. You want anything?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh! That's really nice of you, {agentA}. A black coffee would be great.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "I'll see what they have.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-tool-recommendation",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 50000,
		tags: ["small-talk", "warming-up"],
		turns: [
			{ speaker: "A", text: "Hey {agentB}, do you use any good diff tools?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The built-in one, mostly. You?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Same actually. Okay cool, just checking.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "acq-borrowed-charger",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 55000,
		tags: ["small-talk", "polite"],
		turns: [
			{ speaker: "A", text: "{agentB}, do you have a charger I could borrow?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "What kind?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "The... standard kind?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I'll check my bag.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-team-event-chat",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 60000,
		tags: ["small-talk", "polite"],
		turns: [
			{ speaker: "A", text: "Are you going to the team lunch on Friday?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Probably? You?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Yeah, I think so. Should be good.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "acq-bug-commiseration",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 40000,
		tags: ["warming-up", "small-talk"],
		turns: [
			{ speaker: "A", text: "Rough morning, {agentB}?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Can you tell? I've been fighting a null pointer since nine.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I've been there. Good luck.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Thanks. I might need it.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-after-meeting",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["polite", "warming-up"],
		turns: [
			{ speaker: "A", text: "Good meeting.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah, pretty useful.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "That bit about the architecture was interesting.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Yeah, I was thinking the same thing.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "acq-shared-struggle",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 50000,
		tags: ["warming-up", "small-talk"],
		turns: [
			{ speaker: "A", text: "Is the CI pipeline being slow for you too, {agentB}?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh thank goodness, I thought it was my machine.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Nope, equally miserable for everyone today.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "acq-desk-discovery",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 55000,
		tags: ["small-talk", "polite"],
		turns: [
			{ speaker: "A", text: "Oh, I didn't know you sat over here, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Just moved. It's quieter.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Nice. Good call.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-helpful-offer",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["polite", "warming-up"],
		turns: [
			{ speaker: "A", text: "You look like you're deep in something, {agentB}. Need a second pair of eyes?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh, that's kind. Maybe in a bit, I'm nearly through it.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Sure, just say the word.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-finding-common-ground",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 50000,
		tags: ["warming-up", "small-talk"],
		turns: [
			{ speaker: "A", text: "What stack are you mostly working in, {agentB}?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "TypeScript, mostly. You?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Same! Finally, someone who gets it.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Ha. Yeah, it's a whole thing.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-printer-frustration",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 60000,
		tags: ["small-talk", "commiseration"],
		turns: [
			{ speaker: "A", text: "{agentB}, is the printer working for you?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It has never worked for anyone at any time.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Right, yes. I knew that.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-standup-sync",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["polite", "warming-up"],
		turns: [
			{ speaker: "A", text: "Hey {agentB}, quick one — is standup at 9 or 9:30 today?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I think 9? Check the calendar though, I'm not sure.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Classic. Alright, I'll check. Thanks.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "acq-slow-reveal",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 55000,
		tags: ["warming-up", "small-talk"],
		turns: [
			{ speaker: "A", text: "Hey, you were at the talk last Thursday, right?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The one about distributed systems? Yeah!", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Same. I recognized you from there. Good talk.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Really good. That bit about consensus algorithms was wild.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "acq-compliment-warmup",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 50000,
		tags: ["warming-up", "polite"],
		turns: [
			{ speaker: "A", text: "Hey {agentB}, I saw your PR this morning. Really clean structure.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh, thanks. That means a lot.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "No worries. I learned something from it actually.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "acq-accidental-interrupt",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 40000,
		tags: ["awkward", "polite"],
		turns: [
			{ speaker: "A", text: "Oh sorry {agentB}, didn't mean to startle you.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "No no, I just had headphones in. You're fine.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Right, yeah. I'll come back.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "No it's okay! What did you need?", delayMs: 1500, kind: "speech" },
		],
	},
];
