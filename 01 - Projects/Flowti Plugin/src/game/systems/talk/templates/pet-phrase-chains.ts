/**
 * pet-phrase-chains.ts — Multi-step thought sequences for pets.
 *
 * These create little narrative moments as pets experience events.
 */

import type { PhraseChain } from "./phrase-chains.js";

export const PET_PHRASE_CHAINS: readonly PhraseChain[] = [
	{
		id: "pet-bug-investigation",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "something... moving...", delayMs: 2000, kind: "thought" },
			{ text: "POUNCE", delayMs: 1500, kind: "speech" },
			{ text: "...it was a shadow. play it cool.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-code-judge",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "observing the screen...", delayMs: 3000, kind: "thought" },
			{ text: "that's a lot of red squiggles", delayMs: 2500, kind: "thought" },
			{ text: "I could do better. if I had thumbs.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-nap-cycle",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "zzz...", delayMs: 4000, kind: "thought" },
			{ text: "...what year is it", delayMs: 2000, kind: "thought" },
			{ text: "false alarm. back to sleep.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-cursor-hunt",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "the arrow moves...", delayMs: 2000, kind: "thought" },
			{ text: "tracking target...", delayMs: 2000, kind: "thought" },
			{ text: "CONTACT", delayMs: 1500, kind: "speech" },
			{ text: "...it's under my paw now", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-keyboard-walk",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "what's this surface...", delayMs: 2000, kind: "thought" },
			{ text: "ooh keys", delayMs: 1500, kind: "thought" },
			{ text: "hgsdjfk", delayMs: 2000, kind: "speech" },
			{ text: "that was art", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-box-discovery",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "a box!", delayMs: 1500, kind: "speech" },
			{ text: "must investigate...", delayMs: 2500, kind: "thought" },
			{ text: "I fit. therefore I sit.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-food-bowl-check",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "checking the bowl...", delayMs: 2000, kind: "thought" },
			{ text: "still empty", delayMs: 2000, kind: "thought" },
			{ text: "will check again in 30 seconds", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-window-bird",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "bird...", delayMs: 1500, kind: "thought" },
			{ text: "BIRD!", delayMs: 1000, kind: "speech" },
			{ text: "chattering intensifies", delayMs: 3000, kind: "thought" },
			{ text: "it left. I am bereft.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-lap-quest",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "lap detected...", delayMs: 2000, kind: "thought" },
			{ text: "approaching...", delayMs: 2500, kind: "thought" },
			{ text: "the lap has been claimed. this is law.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-midnight-zoomies",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "energy levels rising...", delayMs: 2000, kind: "thought" },
			{ text: "cannot contain...", delayMs: 1500, kind: "thought" },
			{ text: "ZOOM", delayMs: 2000, kind: "speech" },
			{ text: "ok done. nap time.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-treat-negotiation",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "deploying sad eyes...", delayMs: 2500, kind: "thought" },
			{ text: "increasing intensity...", delayMs: 3000, kind: "thought" },
			{ text: "TREATS ACQUIRED. strategy: effective.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-new-object-assessment",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "new thing in room.", delayMs: 2000, kind: "thought" },
			{ text: "suspicious.", delayMs: 2000, kind: "thought" },
			{ text: "must sniff.", delayMs: 1500, kind: "thought" },
			{ text: "acceptable. barely.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-sunbeam-discovery",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "warmth...", delayMs: 2000, kind: "thought" },
			{ text: "the golden patch...", delayMs: 2000, kind: "thought" },
			{ text: "I have found paradise", delayMs: 2000, kind: "thought" },
			{ text: "don't move. ever.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-paper-bag-adventure",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "entering the bag...", delayMs: 2500, kind: "thought" },
			{ text: "this is my domain now", delayMs: 2000, kind: "thought" },
			{ text: "CRINKLE", delayMs: 1500, kind: "speech" },
			{ text: "I have alerted everyone. mission success.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-existential-moment",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "why do they stare at the box all day", delayMs: 3000, kind: "thought" },
			{ text: "what do they see", delayMs: 3000, kind: "thought" },
			{ text: "I see nothing. I understand everything.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-sock-investigation",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "a sock.", delayMs: 1500, kind: "thought" },
			{ text: "...a SECOND sock.", delayMs: 2000, kind: "thought" },
			{ text: "acquiring both. reasons: mine.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-meeting-judgement",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "they are doing the talking thing again.", delayMs: 3000, kind: "thought" },
			{ text: "many words. zero snacks.", delayMs: 2500, kind: "thought" },
			{ text: "I have walked through. meeting improved.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-tail-chase",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "wait. something is following me.", delayMs: 2000, kind: "thought" },
			{ text: "IT IS MY OWN TAIL", delayMs: 1500, kind: "speech" },
			{ text: "pursuing. cannot stop. will not stop.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-plant-temptation",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "the plant. green and alive.", delayMs: 2000, kind: "thought" },
			{ text: "perhaps just a small bite.", delayMs: 2500, kind: "thought" },
			{ text: "worth it. absolutely worth it.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-lap-abandonment",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "the human stands up.", delayMs: 1500, kind: "thought" },
			{ text: "they have DISTURBED the lap.", delayMs: 2000, kind: "thought" },
			{ text: "this will be noted. and remembered.", delayMs: 0, kind: "thought" },
		],
	},
];
