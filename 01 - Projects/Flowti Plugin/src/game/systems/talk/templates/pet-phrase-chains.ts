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
			{ text: "something... moving... on the screen...", delayMs: 2000, kind: "thought" },
			{ text: "it's small. it's fast. it MOCKS me.", delayMs: 2000, kind: "thought" },
			{ text: "POUNCE", delayMs: 1500, kind: "speech" },
			{ text: "...it was the cursor. I regret nothing.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-code-judge",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "observing the screen...", delayMs: 3000, kind: "thought" },
			{ text: "that's a lot of red squiggles. more than yesterday.", delayMs: 2500, kind: "thought" },
			{ text: "I could do better. if I had thumbs. and literacy.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-nap-cycle",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "zzz...", delayMs: 4000, kind: "thought" },
			{ text: "...dreaming of a world where the bowl is always full...", delayMs: 3000, kind: "thought" },
			{ text: "...what year is it", delayMs: 2000, kind: "thought" },
			{ text: "doesn't matter. back to sleep.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-cursor-hunt",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "the arrow moves...", delayMs: 2000, kind: "thought" },
			{ text: "tracking... tracking... steady now...", delayMs: 2000, kind: "thought" },
			{ text: "CONTACT", delayMs: 1000, kind: "speech" },
			{ text: "it's under my paw. I am the apex predator.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-keyboard-walk",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "what's this warm flat surface...", delayMs: 2000, kind: "thought" },
			{ text: "ooh it clicks when I step", delayMs: 1500, kind: "thought" },
			{ text: "asdfjkl;qwerty", delayMs: 1500, kind: "speech" },
			{ text: "the human is screaming. my work here is done.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-box-discovery",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "a box!", delayMs: 1500, kind: "speech" },
			{ text: "it is too small. I am too large. these are facts.", delayMs: 2500, kind: "thought" },
			{ text: "facts are irrelevant. I fit. because I MUST fit.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-food-bowl-check",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "checking the bowl...", delayMs: 2000, kind: "thought" },
			{ text: "I can see the bottom. the BOTTOM. of MY bowl.", delayMs: 2000, kind: "thought" },
			{ text: "this is starvation. I will check again in 30 seconds.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-window-bird",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "bird...", delayMs: 1500, kind: "thought" },
			{ text: "BIRD!", delayMs: 1000, kind: "speech" },
			{ text: "ek ek ek ek ek ek", delayMs: 2000, kind: "speech" },
			{ text: "it left. I scared it away with my power.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-lap-quest",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "lap detected. range: 2 meters.", delayMs: 2000, kind: "thought" },
			{ text: "approaching casually. I am not desperate. I am strategic.", delayMs: 2500, kind: "thought" },
			{ text: "the lap has been claimed. do not stand up. EVER.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-midnight-zoomies",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "something is building inside me...", delayMs: 2000, kind: "thought" },
			{ text: "the ancient call... the primal urge...", delayMs: 1500, kind: "thought" },
			{ text: "ZOOM ZOOM ZOOM", delayMs: 1500, kind: "speech" },
			{ text: "why did I do that. doesn't matter. nap time.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-treat-negotiation",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "deploying sad eyes... 40% power...", delayMs: 2500, kind: "thought" },
			{ text: "no response. increasing to 80%... adding head tilt...", delayMs: 3000, kind: "thought" },
			{ text: "TREAT ACQUIRED. emotional manipulation: still undefeated.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-new-object-assessment",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "new thing appeared in room. was NOT here yesterday.", delayMs: 2000, kind: "thought" },
			{ text: "approaching from downwind. sniffing perimeter.", delayMs: 2000, kind: "thought" },
			{ text: "must touch with one paw. THE BRAVEST PAW.", delayMs: 1500, kind: "thought" },
			{ text: "acceptable. barely. I will allow it to remain.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-sunbeam-discovery",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "warmth on the floor... is it...?", delayMs: 2000, kind: "thought" },
			{ text: "THE GOLDEN PATCH HAS RETURNED", delayMs: 2000, kind: "thought" },
			{ text: "lying in it. becoming one with the sun.", delayMs: 2000, kind: "thought" },
			{ text: "it moved. I must follow. this is my life now.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-paper-bag-adventure",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "entering the bag... for science...", delayMs: 2500, kind: "thought" },
			{ text: "I am inside. it is dark. it is MAGNIFICENT.", delayMs: 2000, kind: "thought" },
			{ text: "CRINKLE CRINKLE CRINKLE", delayMs: 1500, kind: "speech" },
			{ text: "everyone is looking. good. witness me.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-existential-moment",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "why do they stare at the glowing rectangle all day", delayMs: 3000, kind: "thought" },
			{ text: "sometimes the rectangle makes them happy. sometimes angry.", delayMs: 3000, kind: "thought" },
			{ text: "I understand nothing. and yet I understand everything.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-sock-investigation",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "a sock. unattended. this is an invitation.", delayMs: 1500, kind: "thought" },
			{ text: "...a SECOND sock. it's a PAIR. jackpot.", delayMs: 2000, kind: "thought" },
			{ text: "acquiring both. hiding separately. maximum chaos.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-meeting-judgement",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "they are doing the talking-at-screens thing again.", delayMs: 3000, kind: "thought" },
			{ text: "many words. zero treats. zero belly rubs. pointless.", delayMs: 2500, kind: "thought" },
			{ text: "walked across the keyboard mid-call. meeting improved 300%.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-tail-chase",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "wait. something behind me. following me.", delayMs: 2000, kind: "thought" },
			{ text: "IT IS MY OWN TAIL. THE BETRAYAL.", delayMs: 1500, kind: "speech" },
			{ text: "three laps. still can't catch it. it's too good.", delayMs: 2000, kind: "thought" },
			{ text: "we will meet again, tail. this isn't over.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-plant-temptation",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "the plant. green. alive. taunting me.", delayMs: 2000, kind: "thought" },
			{ text: "perhaps just a small bite. for research.", delayMs: 2500, kind: "thought" },
			{ text: "eaten. immediately regretted. would do again tomorrow.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-lap-abandonment",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "the human is shifting. no. NO.", delayMs: 1500, kind: "thought" },
			{ text: "they stood up. they ABANDONED the lap. with me ON it.", delayMs: 2000, kind: "thought" },
			{ text: "this betrayal will echo through generations.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-desk-clearing",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "pen on desk. right on the edge.", delayMs: 2000, kind: "thought" },
			{ text: "extending paw... slowly... carefully...", delayMs: 2000, kind: "thought" },
			{ text: "*tap*", delayMs: 1000, kind: "speech" },
			{ text: "it fell. gravity works. science is beautiful.", delayMs: 2000, kind: "thought" },
			{ text: "there's another pen. commencing phase two.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-deploy-observer",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "the humans are very tense right now.", delayMs: 3000, kind: "thought" },
			{ text: "they keep saying 'deploying' and 'please work'", delayMs: 2500, kind: "thought" },
			{ text: "sat on the keyboard to help. they did NOT appreciate it.", delayMs: 2000, kind: "thought" },
			{ text: "apparently I 'cancelled the pipeline.' you're welcome.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "pet-cursor-obsession",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "the tiny arrow. it moves. it stops. it moves again.", delayMs: 2000, kind: "thought" },
			{ text: "I have been watching for eleven minutes. I cannot look away.", delayMs: 3000, kind: "thought" },
			{ text: "it went behind a window. WHERE DID IT GO.", delayMs: 2000, kind: "speech" },
			{ text: "...it came back. I am exhausted.", delayMs: 0, kind: "thought" },
		],
	},
];
