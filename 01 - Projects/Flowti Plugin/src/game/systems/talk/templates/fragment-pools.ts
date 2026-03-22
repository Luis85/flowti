/**
 * fragment-pools.ts — Openers, closers, qualifiers, interjections + re-export
 * of domain-specific core pools from ./fragment-pools-cores.ts.
 *
 * Slot types:  opener | core | closer | qualifier | interjection
 * Filter keys: mood, domain
 */

import type { FragmentPool } from "../fragment-composer.js";
import {
	GENERAL_CORES,
	ENGINEERING_CORES,
	DESIGN_CORES,
	PRODUCT_CORES,
	QUALITY_CORES,
	OPERATIONS_CORES,
	MANAGEMENT_CORES,
} from "./fragment-pools-cores.js";

// ── Openers ───────────────────────────────────────────────────────────

const NEUTRAL_OPENERS: FragmentPool = {
	id: "neutral-openers",
	slot: "opener",
	filters: {},
	fragments: [
		"Hmm,",
		"So,",
		"Well,",
		"Get this,",
		"Right,",
		"Anyway,",
		"Thing is,",
		"Look,",
		"Honestly,",
		"Listen,",
		"Here's the thing,",
		"Y'know,",
		"I mean,",
		"Fun fact:",
		"No but seriously,",
		"Hear me out,",
		"Not gonna lie,",
		"The thing about this is,",
		"Straight up,",
		"From what I can tell,",
		"For the record,",
		"Worth mentioning —",
		"Side note,",
		"Quick note:",
		"Side observation:",
	],
};

const EXCITED_OPENERS: FragmentPool = {
	id: "excited-openers",
	slot: "opener",
	filters: { mood: ["excited"] },
	fragments: [
		"YES!",
		"Oh wow!",
		"This is great—",
		"I'm pumped—",
		"Get this—",
		"Wait till you hear—",
		"Best news—",
		"Okay I'm excited—",
		"You're gonna love this—",
		"Guess what—",
		"FINALLY!",
		"This is it—",
		"I can't believe—",
		"Hold on—",
		"This changes everything—",
		"Oh my gosh,",
		"You have to hear this—",
		"I'm not even joking—",
	],
};

const TIRED_OPENERS: FragmentPool = {
	id: "tired-openers",
	slot: "opener",
	filters: { mood: ["tired"] },
	fragments: [
		"Ugh,",
		"So tired...",
		"I can't even...",
		"Brain fog...",
		"Why am I still here...",
		"Just...",
		"I have no words.",
		"Send coffee.",
		"My eyes...",
		"Is it Friday yet?",
		"Everything hurts.",
		"I'm running on fumes.",
		"Zero energy left.",
		"One more hour...",
		"Can't think straight.",
		"Barely functional,",
		"On autopilot,",
	],
};

const FRUSTRATED_OPENERS: FragmentPool = {
	id: "frustrated-openers",
	slot: "opener",
	filters: { mood: ["frustrated"] },
	fragments: [
		"Are you kidding me?",
		"Again?!",
		"Seriously?",
		"This is—",
		"I can't—",
		"WHY.",
		"No. Just no.",
		"That's it.",
		"I'm done.",
		"How hard can it be?",
		"Of course.",
		"Classic.",
		"Unbelievable.",
		"For the THIRD time—",
		"You know what—",
		"I give up trying to understand this.",
		"Not this again.",
	],
};

// ── Closers — general ────────────────────────────────────────────────

const GENERAL_CLOSERS: FragmentPool = {
	id: "general-closers",
	slot: "closer",
	filters: {},
	fragments: [
		"...probably fine",
		"...I think",
		"...maybe",
		"...we'll see",
		"...let's not talk about it",
		"...noted",
		"...right?",
		"...or not",
		"...whatever works",
		"...that's a tomorrow problem",
		"...hopefully",
		"...fingers crossed",
		"...in theory",
		"...famous last words",
		"...what could go wrong",
		"...on second thought",
		"...I'll figure it out",
		"...eventually",
		"...it is what it is",
		"...but don't quote me",
		"...allegedly",
		"...somehow",
		"...not my finest moment",
		"...could be worse",
		"...I've been wrong before",
		"...unclear, will update",
		"...asking for a friend",
		"...results may vary",
		"...terms and conditions apply",
		"...moving on",
		"...this is fine",
		"...we do what we can",
		"...that tracks",
		"...more details to follow",
		"...good enough for now",
		"...not ideal",
		"...ship it",
		"...TBD",
		"...per my last message",
		"...live and learn",
		"...at least it compiles",
	],
};

// ── Closers — frustrated ─────────────────────────────────────────────

const FRUSTRATED_CLOSERS: FragmentPool = {
	id: "frustrated-closers",
	slot: "closer",
	filters: { mood: ["frustrated"] },
	fragments: [
		"...I give up",
		"...send help",
		"...everything is on fire",
		"...I need a break",
		"...why do I do this",
		"...not okay",
		"...this is beyond me",
		"...I'll deal with it later",
		"...just WHY",
		"...cool cool cool",
		"...totally fine",
		"...no big deal",
		"...definitely not screaming inside",
		"...perfect, this is perfect",
		"...it's someone else's problem now",
		"...I need to walk away",
		"...I won't say what I'm thinking",
		"...deep breaths",
		"...clock is ticking",
		"...this has cost me years",
		"...thanks for nothing, documentation",
	],
};

// ── Closers — tired ──────────────────────────────────────────────────

const TIRED_CLOSERS: FragmentPool = {
	id: "tired-closers",
	slot: "closer",
	filters: { mood: ["tired"] },
	fragments: [
		"...need sleep",
		"...coffee isn't working",
		"...eyes closing",
		"...five more minutes",
		"...where was I",
		"...tomorrow brain will understand this",
		"...can't focus",
		"...too tired to care",
		"...just one more thing",
		"...done for today",
		"...shutdown initiated",
		"...if I could just nap for twelve minutes",
		"...not retaining anything I read",
		"...writing comments for future-me to understand",
		"...my notes from earlier make no sense",
		"...going through motions",
		"...at least it's quiet",
		"...almost human again after coffee",
		"...shouldn't be coding this tired",
		"...committed and logging off",
	],
};

// ── Qualifiers — general ─────────────────────────────────────────────

const GENERAL_QUALIFIERS: FragmentPool = {
	id: "general-qualifiers",
	slot: "qualifier",
	filters: {},
	fragments: [
		"...but I'm just guessing",
		"...hypothetically",
		"...at least in my experience",
		"...or so I'm told",
		"...not that it matters",
		"...but I could be wrong",
		"...take that with a grain of salt",
		"...take it as you will",
		"...just my two cents",
		"...supposedly",
		"...technically speaking",
		"...from where I'm standing",
		"...if I had to guess",
		"...by my estimation",
		"...without all the context",
		"...ignoring the obvious caveats",
		"...this is a preliminary view",
		"...I haven't tested this exhaustively",
		"...your mileage may vary",
		"...that's the charitable interpretation",
		"...the data suggests",
		"...loosely",
		"...for some definition of 'works'",
		"...barring any surprises",
		"...assuming the docs are accurate",
		"...pending a closer look",
		"...on the surface at least",
		"...by most reasonable measures",
		"...based on incomplete information",
		"...I reserve the right to be wrong",
		"...in a best-case scenario",
	],
};

// ── Qualifiers — confident (excited mood) ────────────────────────────

const CONFIDENT_QUALIFIERS: FragmentPool = {
	id: "confident-qualifiers",
	slot: "qualifier",
	filters: { mood: ["excited"] },
	fragments: [
		"...and I'm right about this",
		"...trust me on this",
		"...I know what I'm talking about",
		"...I checked twice",
		"...this is solid",
		"...no caveats needed",
		"...the data backs this up",
		"...I'd stake my reputation on it",
		"...this is the move",
		"...I've never been more certain",
		"...this is the way",
		"...verified and confirmed",
		"...no doubts here",
		"...100% on this one",
		"...absolutely certain",
		"...I've thought this through",
	],
};

// ── Interjections — general ──────────────────────────────────────────

const GENERAL_INTERJECTIONS: FragmentPool = {
	id: "general-interjections",
	slot: "interjection",
	filters: {},
	fragments: [
		"Wait—",
		"Oh—",
		"Huh.",
		"Actually—",
		"Hold on—",
		"Oh no—",
		"Interesting—",
		"Okay so—",
		"Ha—",
		"Whoa—",
		"Hmm—",
		"Oh boy—",
		"Yikes—",
		"Right—",
		"No way—",
		"Oh wow—",
		"Okay wait—",
		"Huh, okay—",
		"Oh that's—",
		"Wait wait wait—",
		"Oh interesting—",
		"Uh—",
		"So—",
		"Actually, hold on—",
		"Nope—",
	],
};

// ── Interjections — surprised (excited mood) ─────────────────────────

const SURPRISED_INTERJECTIONS: FragmentPool = {
	id: "surprised-interjections",
	slot: "interjection",
	filters: { mood: ["excited"] },
	fragments: [
		"OH WAIT—",
		"NO WAY—",
		"WHAT—",
		"OH MY—",
		"Are you SERIOUS—",
		"I can't believe—",
		"THIS IS—",
		"Okay WOW—",
		"Stop EVERYTHING—",
		"Hold up HOLD UP—",
		"I was NOT expecting—",
		"FINALLY—",
		"OH WOW—",
		"You won't believe—",
		"THE BEST THING JUST—",
		"I need everyone to see—",
	],
};

// ── Export ────────────────────────────────────────────────────────────

export const ALL_FRAGMENT_POOLS: readonly FragmentPool[] = [
	// Openers
	NEUTRAL_OPENERS,
	EXCITED_OPENERS,
	TIRED_OPENERS,
	FRUSTRATED_OPENERS,
	// Cores
	GENERAL_CORES,
	ENGINEERING_CORES,
	DESIGN_CORES,
	PRODUCT_CORES,
	QUALITY_CORES,
	OPERATIONS_CORES,
	MANAGEMENT_CORES,
	// Closers
	GENERAL_CLOSERS,
	FRUSTRATED_CLOSERS,
	TIRED_CLOSERS,
	// Qualifiers
	GENERAL_QUALIFIERS,
	CONFIDENT_QUALIFIERS,
	// Interjections
	GENERAL_INTERJECTIONS,
	SURPRISED_INTERJECTIONS,
];
