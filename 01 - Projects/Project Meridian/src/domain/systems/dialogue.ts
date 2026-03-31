import type { GameRNG } from '../core/game-rng.js';

export interface DialogueInput {
	agentKind: string;
	agentName: string;
	agentMoodBucket: string;
	partnerKind: string;
	partnerName: string;
	partnerMoodBucket: string;
	disposition: number;
	partnerDisposition: number;
	familiarity: number;
	gossipFamiliarityThreshold: number;
	rng: GameRNG;
}

export interface DialogueResult {
	agentLine: string;
	partnerLine: string;
	tone: 'positive' | 'negative' | 'neutral';
	dispositionChange: number;
	shouldExchangeGossip: boolean;
}

const POSITIVE_MOODS = new Set(['elated', 'content']);
const NEGATIVE_MOODS = new Set(['distressed', 'breakdown']);

/**
 * Dialogue template lines keyed by `{kind}:{moodBucket}`.
 * 4 agent kinds x 5 mood buckets = 20 entries + 5 default fallback entries.
 */
export const DIALOGUE_TEMPLATES: Record<string, string[]> = {
	// ── Merchant ──────────────────────────────────────────
	'merchant:elated': [
		'Business is booming! Can I interest you in something special today?',
		'What a wonderful day for trade! Everything is half-price... in spirit!',
		'I just closed the best deal of my career. Let me share the joy!',
	],
	'merchant:content': [
		'Good day! Take a look at my wares if you have a moment.',
		'Fair prices for fair folk — that is my motto.',
		'Trade has been steady. No complaints on my end.',
	],
	'merchant:stressed': [
		'Supplies are running thin. I hope the next shipment arrives soon.',
		'Prices keep climbing... it is not easy to stay competitive.',
		'I could use a break, but the stall will not run itself.',
	],
	'merchant:distressed': [
		'I cannot keep the shelves stocked at these prices.',
		'If things do not improve, I may have to close the stall.',
		'Nobody is buying. I do not know how much longer I can hold on.',
	],
	'merchant:breakdown': [
		'Everything is gone. The stock, the savings... all of it.',
		'I should have never become a merchant. What was I thinking?',
		'Leave me alone. I have nothing left to sell, nothing left to give.',
	],

	// ── Guard ─────────────────────────────────────────────
	'guard:elated': [
		'The streets have been peaceful lately. A fine time to be on patrol!',
		'All quiet on the watch. Makes a guard feel proud.',
		'I caught a pickpocket yesterday — the townsfolk cheered!',
	],
	'guard:content': [
		'Stay out of trouble and we will get along just fine.',
		'Another shift, another round. Duty calls.',
		'The walls are secure. Nothing to worry about.',
	],
	'guard:stressed': [
		'Too many reports coming in. I cannot be everywhere at once.',
		'Keep your eyes open. Something does not feel right.',
		'I have been pulling double shifts. My feet are killing me.',
	],
	'guard:distressed': [
		'Crime is rising faster than we can handle.',
		'The captain has us stretched thin. Morale is crumbling.',
		'I am starting to wonder if any of this even matters.',
	],
	'guard:breakdown': [
		'I failed them. The people I swore to protect.',
		'What is the point of standing guard when everything falls apart?',
		'Hand me my resignation. I am done.',
	],

	// ── Artisan ───────────────────────────────────────────
	'artisan:elated': [
		'I just finished my finest piece yet! Come, let me show you!',
		'The muse is with me today. Every stroke feels effortless!',
		'Craftsmanship is its own reward — but compliments help too!',
	],
	'artisan:content': [
		'Working on a new commission. Steady hands, steady progress.',
		'Good materials make good work. I am fortunate today.',
		'Another day at the forge. There is comfort in routine.',
	],
	'artisan:stressed': [
		'This commission is behind schedule. I need more hours in the day.',
		'The materials I ordered never arrived. Improvising again.',
		'My tools are wearing out faster than I can replace them.',
	],
	'artisan:distressed': [
		'Nothing I make turns out right anymore.',
		'My hands shake when I try to work. It is unbearable.',
		'The workshop feels like a prison. I dread each morning.',
	],
	'artisan:breakdown': [
		'I smashed my latest creation. It was worthless. Like everything else.',
		'The fire in the forge has gone out. So has mine.',
		'Do not ask me to build anything. I have forgotten how.',
	],

	// ── Scholar ───────────────────────────────────────────
	'scholar:elated': [
		'I made a breakthrough in my research today! Fascinating results!',
		'Knowledge is the greatest treasure. And today I am rich!',
		'The stars aligned — literally! My astronomical predictions were correct!',
	],
	'scholar:content': [
		'I have been reading a most interesting treatise. Care to discuss?',
		'Research proceeds at a comfortable pace. No rush, no pressure.',
		'The library is well-stocked. A scholar could not ask for more.',
	],
	'scholar:stressed': [
		'My hypothesis is not holding up. Back to the drawing board.',
		'Too many distractions. I need quiet to think properly.',
		'The deadline for my paper is approaching far too quickly.',
	],
	'scholar:distressed': [
		'Years of research, and nothing to show for it.',
		'My peers dismiss my theories. Perhaps they are right.',
		'I can barely focus on the page anymore. The words blur together.',
	],
	'scholar:breakdown': [
		'All my manuscripts are wrong. Every last one of them.',
		'I have wasted my life chasing answers that do not exist.',
		'Burn the books. Burn them all. What good are they?',
	],

	// ── Default (fallback for unknown kinds) ──────────────
	'default:elated': [
		'What a beautiful day! Everything feels right with the world!',
		'I cannot stop smiling. Life is truly good!',
		'The sun is shining and so am I!',
	],
	'default:content': [
		'Just going about my day. Nothing special, nothing wrong.',
		'A pleasant day, all things considered.',
		'I have no complaints. How about you?',
	],
	'default:stressed': [
		'Things have been difficult lately, but I am managing.',
		'I have a lot on my mind. Forgive me if I seem distracted.',
		'One thing after another... when does it let up?',
	],
	'default:distressed': [
		'I do not want to talk about it.',
		'Everything feels like it is falling apart.',
		'Please, just... leave me be for a while.',
	],
	'default:breakdown': [
		'I cannot do this anymore.',
		'There is no point to any of this.',
		'Just go away. Please.',
	],
};

function determineTone(
	agentMood: string,
	partnerMood: string,
	minDisposition: number,
): 'positive' | 'negative' | 'neutral' {
	if (POSITIVE_MOODS.has(agentMood) && POSITIVE_MOODS.has(partnerMood) && minDisposition >= 0) {
		return 'positive';
	}
	if (NEGATIVE_MOODS.has(agentMood) || NEGATIVE_MOODS.has(partnerMood) || minDisposition <= -20) {
		return 'negative';
	}
	return 'neutral';
}

function pickLine(templates: string[], rng: GameRNG): string {
	const index = Math.floor(rng.range(0, templates.length));
	return templates[index] ?? templates[0]!;
}

function getTemplates(kind: string, moodBucket: string): string[] {
	const key = `${kind}:${moodBucket}`;
	const templates = DIALOGUE_TEMPLATES[key];
	if (templates !== undefined) return templates;

	const fallbackKey = `default:${moodBucket}`;
	const fallback = DIALOGUE_TEMPLATES[fallbackKey];
	if (fallback !== undefined) return fallback;

	// Last resort — should never happen with well-formed data
	return ['...'];
}

export function selectDialogue(input: DialogueInput): DialogueResult {
	const agentTemplates = getTemplates(input.agentKind, input.agentMoodBucket);
	const partnerTemplates = getTemplates(input.partnerKind, input.partnerMoodBucket);

	const agentLine = pickLine(agentTemplates, input.rng);
	const partnerLine = pickLine(partnerTemplates, input.rng);

	const minDisposition = Math.min(input.disposition, input.partnerDisposition);
	const tone = determineTone(input.agentMoodBucket, input.partnerMoodBucket, minDisposition);

	const dispositionChange = tone === 'positive' ? 1 : tone === 'negative' ? -1 : 0;
	const shouldExchangeGossip = input.familiarity >= input.gossipFamiliarityThreshold;

	return {
		agentLine,
		partnerLine,
		tone,
		dispositionChange,
		shouldExchangeGossip,
	};
}
