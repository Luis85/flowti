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
			{ speaker: "A", text: "Do anything fun this weekend, {agentB}?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Not really. Cleaned the apartment. Exciting stuff.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Hey, a clean apartment is underrated. I went to a park. It was... a park.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Parks are good.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Hey! ...{agentB}, right?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah! And you're {agentA}.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "That's me. Cool. Good talk.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "...yep.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Oh! That's really nice. Um, black coffee? If it's not too much trouble.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "No trouble. Be right back.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Thanks, {agentA}. I owe you one.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Hey {agentB}, random question — do you use any good diff tools?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The built-in one, mostly. Why, is there something better?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I don't know, I was hoping you'd tell me. Same here actually.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Ha. Well. At least we're consistent.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Sorry to bother you — {agentB}, right? Do you have a charger I could borrow?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "What kind do you need?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Um. The... I actually don't know what kind mine is. The normal one?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Let me check my bag. I think I have a spare.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Are you going to the team thing on Friday?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Probably? I wasn't sure if it was optional or 'optional.'", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I'm going with 'show my face for thirty minutes' energy.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Solid strategy. I might steal that.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "That obvious? I've been fighting a null pointer since nine.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Oof. Those ones are personal. Good luck with it.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Thanks. I'll need every bit of it.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Well. That was a meeting.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It sure was.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "That bit about the architecture was interesting though.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Yeah, I had the same thought. Didn't want to say it in the room though.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Nope, equally miserable for everyone.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Weirdly comforting.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Just moved last week. It's quieter on this side.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Smart. I'm next to the kitchen. I hear every microwave beep.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "Oh, that's kind of you. Maybe in a bit? I'm... almost through it. I think.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Sure thing. I'll be around.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Same! Oh nice. How long have you been using it?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Long enough to have opinions. Not long enough to be right about them.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "Bold of you to assume the printer has ever worked.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Fair. I'll email it instead.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "I want to say 9? But I've been wrong before.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Same. I'll check the calendar. Thanks.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "If you find out, let me know too.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Hey, were you at the talk last Thursday?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The distributed systems one? Yeah, I was in the back.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I thought I saw you. That bit about consensus algorithms was intense.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Right? I'm still thinking about it honestly.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Hey {agentB}, I glanced at your PR this morning. Really clean stuff.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh wow, thanks. I wasn't sure anyone actually looked at those.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I learned something from it, actually. The way you handled the — anyway. It was good.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "No no, I just had headphones in. I didn't hear you coming.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I'll come back, it's not urgent—", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "No stay, what's up? I needed a break from this anyway.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "acq-lunch-proximity",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 50000,
		tags: ["awkward", "warming-up"],
		turns: [
			{ speaker: "A", text: "Oh, same lunch spot. We have taste.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Ha. Or we both just defaulted to the closest option.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "That's... also taste. Of a kind.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "acq-joke-test",
		tierRange: ["acquaintance", "acquaintance"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 55000,
		tags: ["awkward", "warming-up"],
		turns: [
			{ speaker: "A", text: "They should call it a 'standup' because that's what my back does after sitting all day.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "...", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Tough crowd.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "No, I was — that was funny. Sorry. I'm on a two second delay today.", delayMs: 2000, kind: "speech" },
		],
	},
];
