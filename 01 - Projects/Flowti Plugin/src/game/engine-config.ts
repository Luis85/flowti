/**
 * engine-config.ts — All hardcoded constants and configuration data
 * extracted from engine.ts.
 *
 * Grouped by category: dimensions, colors, positions, emojis, mood texts,
 * object attraction rules, social conversation strings, room offsets,
 * pet room assignments, and timing/threshold constants.
 */

import type { AgentNeeds } from "./systems/needs-system.js";

// ── Engine dimensions ────────────────────────────────────────────────

export const ENGINE_WIDTH = 800;
export const ENGINE_HEIGHT = 500;

// ── Domain particle colors ───────────────────────────────────────────

export const DOMAIN_PARTICLE_COLORS: Record<string, string> = {
	engineering: "#3b82f6",
	design: "#a855f7",
	product: "#f59e0b",
	management: "#10b981",
	quality: "#ef4444",
	operations: "#06b6d4",
};

// ── Default particle color (used when agent domain is unknown) ───────

export const DEFAULT_PARTICLE_COLOR = "#64748b";

// ── Lighting ─────────────────────────────────────────────────────────

/** Per-millisecond lerp factor for day/night lighting transitions. */
export const LIGHT_LERP_SPEED = 0.0015;

// ── Environmental object positions ───────────────────────────────────

export const OBJECT_POSITIONS = {
	coffeeMachine: { x: 680, y: 120 },
	whiteboard: { x: 400, y: 60 },
	snackTable: { x: 400, y: 380 },
	waterCooler: { x: 600, y: 380 },
	couch: { x: 400, y: 380 },
	plant: { x: 100, y: 60 },
	noticeBoard: { x: 680, y: 60 },
	foodBowlHub: { x: 200, y: 380 },
	foodBowlVillage: { x: 250, y: 350 },
	waterBowlOffice: { x: 580, y: 120 },
	waterBowlStation: { x: 550, y: 350 },
} as const;

// ── Object-to-scene assignments ──────────────────────────────────────

export const OBJECT_SCENE_ASSIGNMENTS = {
	coffeeMachine: "office",
	whiteboard: "office",
	snackTable: "village",
	waterCooler: "village",
	couch: "station",
	plant: "hub",
	noticeBoard: "hub",
	foodBowlHub: "hub",
	foodBowlVillage: "village",
	waterBowlOffice: "office",
	waterBowlStation: "station",
} as const;

// ── Pet positions and room assignments ───────────────────────────────

export const PET_SPAWN_CONFIGS = [
	{ type: "cat", x: 300, y: 250, entityId: "cat-hub", room: "hub" },
	{ type: "cat", x: 350, y: 300, entityId: "cat-office", room: "office" },
	{ type: "cat", x: 400, y: 280, entityId: "cat-village", room: "village" },
	{ type: "dog", x: 500, y: 350, entityId: "dog-office", room: "office" },
	{ type: "dog", x: 300, y: 200, entityId: "dog-village", room: "village" },
	{ type: "dog", x: 450, y: 300, entityId: "dog-station", room: "station" },
	{ type: "bird", x: 200, y: 80, entityId: "bird-village", room: "village" },
	{ type: "fish", x: 680, y: 380, entityId: "fish-station", room: "station" },
] as const;

/** Default room for each pet entity, used when restoring positions. */
export const DEFAULT_PET_ROOMS: Record<string, string> = {
	"cat-hub": "hub",
	"cat-office": "office",
	"cat-village": "village",
	"dog-office": "office",
	"dog-village": "village",
	"dog-station": "station",
	"bird-village": "village",
	"fish-station": "station",
};

// ── Room offsets for social isolation ─────────────────────────────────

/** Large positional offsets so agents in different rooms never appear "nearby". */
export const ROOM_OFFSETS: Record<string, number> = {
	hub: 0,
	office: 10000,
	village: 20000,
	station: 30000,
};

/** Offset for unknown rooms — ensures they are distant from all known rooms. */
export const UNKNOWN_ROOM_OFFSET = 30000;

// ── Social emoji arrays ──────────────────────────────────────────────

export const SOCIAL_EMOJIS = [
	"\u{1F44B}", "\u{1F60A}", "\u{1F4AC}", "\u{2728}", "\u{1F91D}", "\u{1F4A1}", "\u{1F44D}", "\u{1F914}",
	"\u{1F60E}", "\u{1F525}", "\u{1F389}", "\u{1F64C}", "\u{1F4AA}", "\u{1F942}", "\u{2615}", "\u{1F31F}",
	"\u{1F44F}", "\u{1F60D}", "\u{1F929}", "\u{1F4AF}", "\u{1F680}", "\u{1F3AF}", "\u{2764}\uFE0F", "\u{1F917}",
];

export const REACTION_EMOJIS = [
	"\u{1F44D}", "\u{1F60A}", "\u{2728}", "\u{1F4AF}", "\u{1F44F}", "\u{1F64C}", "\u{2764}\uFE0F", "\u{1F525}",
];

// ── Mood texts (used by emote callback) ──────────────────────────────

export const MOOD_TEXTS: Record<string, string[]> = {
	happy: [
		"\u{1F60A} Life is good.", "\u{2728} Feeling great!", "\u{1F389} Yes!",
		"\u{1F31F} What a day!", "\u{1F44D} Love it.", "\u{1F60E} Smooth sailing.",
		"\u{1F496} Grateful for this team.", "\u{1F3B5} Humming along.",
	],
	enthusiastic: [
		"\u{1F525} Let's go!", "\u{1F680} Launching!", "\u{1F4AA} Pumped!",
		"\u{26A1} Energy!", "\u{1F3AF} Locked in!", "\u{1F4A5} Boom!",
	],
	frustrated: [
		"\u{1F914} Hmm...", "\u{1F615} This is tricky.", "\u{1F62E}\u200D\u{1F4A8} Come on...",
		"\u{1F9D0} Let me look at this differently.", "\u{1F616} Stuck for a moment.",
		"\u{1F612} Not clicking yet.", "\u{1F4AD} There's gotta be a way...",
	],
	focused: [
		"\u{1F9D0} Deep in thought...", "\u{1F3AF} Concentrating...", "\u{1F4A1} Almost got it.",
		"\u{1F52C} Zooming in.", "\u{1F9E0} Brain at full capacity.", "\u{1F4DD} Taking notes.",
		"\u{23F3} Just need a bit more time.", "\u{1F50D} Investigating.",
	],
	neutral: [
		"\u{1F4AD} ...", "\u{1F914} Hmm.", "\u{2615} Sip.",
		"\u{1F440} Looking around.", "\u{1F6B6} Just vibing.", "\u{1F324}\uFE0F Nice day.",
	],
	contemplative: [
		"\u{1F30C} Big picture thinking.", "\u{1F4AD} What if...", "\u{1F52D} Seeing patterns.",
		"\u{1F9D8} Reflecting.", "\u{1F31F} There's something here.",
	],
	empathetic: [
		"\u{1F49B} I understand.", "\u{1F917} How are you?", "\u{1F64F} I appreciate you.",
		"\u{1F4AC} Tell me more.", "\u{1F91D} We're in this together.",
		"\u{2764}\uFE0F The team matters.", "\u{1F60C} Take your time.",
	],
	inspired: [
		"\u{1F4A1} I have an idea!", "\u{2728} What if...", "\u{1F680} This could be big!",
		"\u{1F31F} Eureka moment.", "\u{1F525} The spark is there!",
		"\u{1F3A8} Creative juices flowing.", "\u{1F4AB} Breakthrough incoming.",
	],
	aesthetic: [
		"\u{2728} Beautiful.", "\u{1F3A8} So elegant.", "\u{1F308} Harmony.",
		"\u{1F338} Clean and refined.", "\u{1F5BC}\uFE0F Art.", "\u{1F48E} Polished.",
	],
	playful: [
		"\u{1F604} Hehe.", "\u{1F389} Fun times!", "\u{1F60E} Cool cool cool.",
		"\u{1F3AE} Game on.", "\u{1F938} Plot twist!", "\u{1F47E} Beep boop.",
		"\u{1F609} You know it.", "\u{1F942} Cheers!",
	],
	skeptical: [
		"\u{1F928} Really though?", "\u{1F9D0} Let me verify.", "\u{1F914} Show me the data.",
		"\u{1F50D} Prove it.", "\u{1F4CA} Numbers don't lie.", "\u{2753} But why?",
	],
};

// ── Follow-up strings for social conversations ──────────────────────

export const FOLLOW_UP_STRINGS = [
	"Totally.", "Right?", "Exactly.", "Ha, yeah.", "For sure.",
	"Good point.", "Agreed.", "Makes sense.", "Love that.",
	"Same here.", "You said it.", "100%.", "Can't argue with that.",
];

// ── Object attraction rules ──────────────────────────────────────────

export interface ObjectAttractionRule {
	readonly objectKey: string;
	readonly phases: readonly string[];
	readonly needCheck: (needs: AgentNeeds) => boolean;
	readonly chance: number;
}

/**
 * Attraction rule definitions — the actual InteractableActor references
 * must be resolved at runtime by the consumer via objectKey lookup.
 */
export const OBJECT_ATTRACTION_RULES: readonly ObjectAttractionRule[] = [
	{
		objectKey: "coffeeMachine",
		phases: ["morning-arrival", "afternoon-slump"],
		needCheck: (n) => n.energy < 40 || n.thirst < 40,
		chance: 0.002,
	},
	{
		objectKey: "snackTable",
		phases: ["lunch", "afternoon-slump"],
		needCheck: (n) => n.hunger < 40,
		chance: 0.002,
	},
	{
		objectKey: "waterCooler",
		phases: ["afternoon", "afternoon-slump"],
		needCheck: (n) => n.social < 30 || n.thirst < 30,
		chance: 0.001,
	},
	{
		objectKey: "couch",
		phases: ["afternoon-slump", "wind-down"],
		needCheck: () => false,
		chance: 0.001,
	},
	{
		objectKey: "foodBowlHub",
		phases: ["lunch"],
		needCheck: (n) => n.hunger < 25,
		chance: 0.002,
	},
	{
		objectKey: "foodBowlVillage",
		phases: ["lunch"],
		needCheck: (n) => n.hunger < 25,
		chance: 0.002,
	},
	{
		objectKey: "waterBowlOffice",
		phases: ["morning-arrival", "morning-focus", "lunch", "afternoon", "afternoon-slump", "wind-down"],
		needCheck: (n) => n.thirst < 20,
		chance: 0.002,
	},
	{
		objectKey: "waterBowlStation",
		phases: ["morning-arrival", "morning-focus", "lunch", "afternoon", "afternoon-slump", "wind-down"],
		needCheck: (n) => n.thirst < 20,
		chance: 0.002,
	},
];

// ── Timing and threshold constants ───────────────────────────────────

/** Interval between position flushes to disk (ms). */
export const POSITION_FLUSH_INTERVAL = 5_000;

/** Delay before waking agent LLM process after selection (ms). */
export const AGENT_WAKE_DELAY = 600;

/** Duration of scene transition fade (ms). */
export const SCENE_TRANSITION_DURATION = 300;

/** Loading overlay fade-out duration (ms). */
export const LOADING_FADE_DURATION = 600;

/** Action dedup TTL — how long an action ID is remembered (ms). */
export const ACTION_DEDUP_TTL = 5000;

/** Pet proximity reaction cooldown (ms). */
export const PET_REACTION_COOLDOWN = 30000;

/** Minimum distance squared for particle trail emission. */
export const TRAIL_DISTANCE_SQ = 64;

/** Vertical offset for particle trails below agent sprite. */
export const TRAIL_Y_OFFSET = 28;

/** Social conversation follow-up chance (0-1). */
export const FOLLOW_UP_CHANCE = 0.3;

/** Social emoji prefix chance (0-1). */
export const SOCIAL_EMOJI_CHANCE = 0.5;

/** Emoji reaction chance after Agent B responds (0-1). */
export const EMOJI_REACTION_CHANCE = 0.5;

/** Weather particle spawn chance per frame (0-1). */
export const WEATHER_PARTICLE_CHANCE = 0.3;

/** Weather particle lifetime (ms). */
export const WEATHER_PARTICLE_LIFETIME = 1500;

/** Weather particle base opacity. */
export const WEATHER_PARTICLE_OPACITY = 0.4;

/** Dog follow chance per frame when idle (0-1). */
export const DOG_FOLLOW_CHANCE = 0.001;

/** Cat follow-stressed-agent chance per frame when idle (0-1). */
export const CAT_FOLLOW_STRESSED_CHANCE = 0.0005;

/** Cat stress threshold — morale below this triggers cat following. */
export const CAT_STRESS_MORALE_THRESHOLD = 30;

/** Object attraction arrival delay before applying effects (ms). */
export const OBJECT_EFFECT_DELAY = 5000;

/** Pet share cooldown — how long before the same agent-pet pair can share again (ms). */
export const PET_SHARE_COOLDOWN = 30000;

/** Multiplier for pet share — pet gets this fraction of the station's effects. */
export const PET_SHARE_EFFECT_RATIO = 0.5;

/** Social bonus an agent gets when sharing food/drink with a pet. */
export const PET_SHARE_SOCIAL_BONUS = 3;

/** Object types that are food or drink stations (eligible for pet sharing). */
export const FOOD_DRINK_OBJECT_TYPES = new Set(["food", "drink", "appliance"]);

/** BrainSystem bounds configuration. */
export const BRAIN_BOUNDS = {
	minX: 80,
	maxX: ENGINE_WIDTH - 80,
	minY: 80,
	maxY: ENGINE_HEIGHT - 60,
} as const;

/** Particle pool max capacity. */
export const PARTICLE_POOL_SIZE = 200;

// ── Reactive trigger thresholds ──────────────────────────────────────

export const REACTIVE_THRESHOLDS = {
	energyCritical: 20,
	energyRestored: 60,
	focusDeep: 80,
	focusLost: 30,
	moraleBoost: 75,
} as const;
