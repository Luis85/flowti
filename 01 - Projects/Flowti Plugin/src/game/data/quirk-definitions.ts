/**
 * quirk-definitions.ts — 15 agent quirks with attribute filters, overrides, and phrase pools.
 */

export interface QuirkOverrides {
	readonly socialRadiusMultiplier?: number;
	readonly idleResistanceMultiplier?: number;
	readonly moveSpeedMultiplier?: number;
	readonly coffeeAttractionMultiplier?: number;
	readonly conversationRateMultiplier?: number;
}

export interface QuirkDefinition {
	readonly id: string;
	readonly label: string;
	readonly filter: (attrs: Record<string, number>, domain: string) => boolean;
	readonly overrides: QuirkOverrides;
	readonly phrases: readonly string[];
}

export const QUIRK_DEFINITIONS: readonly QuirkDefinition[] = [
	{
		id: "pacer", label: "Pacer",
		filter: (a) => (a.dex ?? 0) > 13,
		overrides: { moveSpeedMultiplier: 1.2 },
		phrases: ["Can't sit still when I'm thinking", "Pacing helps me process", "Walking loop number... I've lost count", "My step counter loves me", "Ideas flow better when my feet move"],
	},
	{
		id: "doodler", label: "Doodler",
		filter: (a, d) => (a.cha ?? 0) > 12 && (d === "design" || d === "product"),
		overrides: {},
		phrases: ["Let me sketch this out", "Doodles are just ideas in disguise", "My whiteboard time is sacred", "Drawing helps me think", "Another masterpiece on the whiteboard"],
	},
	{
		id: "coffee-addict", label: "Coffee Addict",
		filter: (a) => (a.con ?? 0) < 8,
		overrides: { coffeeAttractionMultiplier: 2.0 },
		phrases: ["Coffee. Now.", "I run on caffeine and deadlines", "Third cup and counting", "Decaf is a lie", "The coffee machine is my best friend", "Just one more cup"],
	},
	{
		id: "early-bird", label: "Early Bird",
		filter: (a) => (a.wis ?? 0) > 14,
		overrides: {},
		phrases: ["First one in, best parking spot", "Morning is my superpower", "Love the quiet before everyone arrives", "Early start, early finish", "The dawn shift hits different"],
	},
	{
		id: "night-owl", label: "Night Owl",
		filter: (a) => (a.int ?? 0) > 14,
		overrides: {},
		phrases: ["Just getting warmed up", "The best code is written after dark", "Everyone's leaving already?", "Quiet office, peak productivity", "Night shift energy"],
	},
	{
		id: "neat-freak", label: "Neat Freak",
		filter: (a, d) => (a.wis ?? 0) > 12 && d === "quality",
		overrides: {},
		phrases: ["This desk needs organizing", "Everything in its place", "A clean workspace is a clean mind", "Who left this mess?", "Tidying up before I can focus"],
	},
	{
		id: "fidgeter", label: "Fidgeter",
		filter: (a) => (a.dex ?? 0) > 14 && (a.con ?? 0) < 10,
		overrides: { idleResistanceMultiplier: 0.6 },
		phrases: ["Can't. Stay. Still.", "Restless energy today", "My leg has a mind of its own", "Fidgeting is thinking in motion", "Sorry, just restless"],
	},
	{
		id: "snacker", label: "Snacker",
		filter: () => true,
		overrides: {},
		phrases: ["Snack break!", "Is it too early for snacks? Never", "Thinking is hungry work", "The snack table is calling me", "Brain food is still food"],
	},
	{
		id: "social-butterfly", label: "Social Butterfly",
		filter: (a) => (a.cha ?? 0) > 15,
		overrides: { socialRadiusMultiplier: 1.5, conversationRateMultiplier: 2.0 },
		phrases: ["Hey, what's everyone up to?", "Let's chat!", "I know everyone here", "Networking is just making friends", "The more the merrier", "Who wants to grab coffee?"],
	},
	{
		id: "hermit", label: "Hermit",
		filter: (a) => (a.cha ?? 0) < 7,
		overrides: { socialRadiusMultiplier: 0.7, conversationRateMultiplier: 0.5 },
		phrases: ["Need some space", "Headphones on means leave me alone", "Quiet corner, please", "Socializing is exhausting", "Alone time is productive time"],
	},
	{
		id: "rubber-ducker", label: "Rubber Ducker",
		filter: (a, d) => (a.int ?? 0) > 12 && d === "engineering",
		overrides: {},
		phrases: ["Okay, let me explain this to myself", "So the problem is... wait, I get it now", "Talking it through... almost there", "Dear rubber duck, consider the following", "If I explain it out loud, I'll find the bug"],
	},
	{
		id: "music-lover", label: "Music Lover",
		filter: () => true,
		overrides: {},
		phrases: ["This playlist is fire", "Music makes the code flow", "Need new song recommendations", "Headphones are my productivity tool", "The right beat for the right task"],
	},
	{
		id: "plant-parent", label: "Plant Parent",
		filter: () => true,
		overrides: {},
		phrases: ["How's my little green friend today?", "Plants make everything better", "Time to check on my desk plant", "Growing code and growing plants", "This one's looking healthy"],
	},
	{
		id: "whiteboard-warrior", label: "Whiteboard Warrior",
		filter: (a, d) => (a.cha ?? 0) > 12 && (d === "management" || d === "orchestration"),
		overrides: {},
		phrases: ["To the whiteboard!", "Let me draw this out for everyone", "Whiteboard sessions are my cardio", "The diagram will make it clear", "This calls for a visual"],
	},
	{
		id: "stretcher", label: "Stretcher",
		filter: (a) => (a.con ?? 0) > 12,
		overrides: {},
		phrases: ["Time to stretch", "My back will thank me later", "Stand up, stretch, sit back down", "Ergonomics are self-care", "Quick stretch break"],
	},
];

/** Random assignment probabilities for always-eligible quirks. */
const RANDOM_QUIRK_CHANCE: Record<string, number> = {
	snacker: 0.20,
	"music-lover": 0.25,
	"plant-parent": 0.15,
};

/** Get quirks an agent qualifies for based on attributes and domain. */
export function getEligibleQuirks(attrs: Record<string, number>, domain: string): QuirkDefinition[] {
	return QUIRK_DEFINITIONS.filter((q) => q.filter(attrs, domain));
}

/** Roll quirks for an agent. Returns 2-3 quirk IDs. */
export function rollQuirks(attrs: Record<string, number>, domain: string): string[] {
	const eligible = getEligibleQuirks(attrs, domain);
	const gated = eligible.filter((q) => !RANDOM_QUIRK_CHANCE[q.id]);
	const random = eligible.filter((q) => RANDOM_QUIRK_CHANCE[q.id]);

	const picked: string[] = [];

	// Pick 1-2 from attribute-gated (if available)
	const shuffledGated = [...gated].sort(() => Math.random() - 0.5);
	for (const q of shuffledGated) {
		if (picked.length >= 2) break;
		picked.push(q.id);
	}

	// Roll random quirks
	for (const q of random) {
		if (picked.length >= 3) break;
		if (Math.random() < (RANDOM_QUIRK_CHANCE[q.id] ?? 0)) {
			picked.push(q.id);
		}
	}

	// Ensure at least 2
	if (picked.length < 2) {
		const remaining = eligible.filter((q) => !picked.includes(q.id));
		const shuffled = [...remaining].sort(() => Math.random() - 0.5);
		for (const q of shuffled) {
			if (picked.length >= 2) break;
			picked.push(q.id);
		}
	}

	return picked.slice(0, 3);
}
