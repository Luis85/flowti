/**
 * world-config.ts — Tunable configuration for all Agent World game systems.
 *
 * WorldConfig groups settings by system (needs, director, sensors, groups,
 * engagement, tools). The DEFAULT_WORLD_CONFIG constant provides sensible
 * starting values. mergeWorldConfig performs a deep merge so callers only
 * need to supply overrides.
 */

/** Per-need decay rates under different conditions. */
export interface NeedDecay {
	/** Energy drain per second while working. */
	readonly working: number;
}

/** Social need decay rates. */
export interface SocialDecay {
	/** Social drain per second when alone. */
	readonly alone: number;
}

/** Focus need decay rates. */
export interface FocusDecay {
	/** Focus lost per interruption. */
	readonly perInterruption: number;
}

/** Morale need decay rates. */
export interface MoraleDecay {
	/** Morale lost per error event. */
	readonly perError: number;
}

/** Initial values and decay curves for the four agent needs. */
export interface NeedsConfig {
	readonly initial: {
		readonly energy: number;
		readonly social: number;
		readonly focus: number;
		readonly morale: number;
	};
	readonly decay: {
		readonly energy: NeedDecay;
		readonly social: SocialDecay;
		readonly focus: FocusDecay;
		readonly morale: MoraleDecay;
	};
	readonly hungerThreshold: number;
	readonly thirstThreshold: number;
	readonly hungerEnergyMult: number;
	readonly thirstEnergyMult: number;
	readonly hungerInitial: number;
	readonly thirstInitial: number;
}

/** Spatial awareness thresholds for the DirectorSystem. */
export interface DirectorAwareness {
	/** Radius in px within which the director notices an agent. */
	readonly noticeRadius: number;
	/** Radius in px within which the director greets an agent. */
	readonly greetRadius: number;
}

/** Configuration for the DirectorSystem. */
export interface DirectorConfig {
	readonly awareness: DirectorAwareness;
}

/** Per-rule override for a sensor, keyed by rule id. */
export interface SensorRuleOverride {
	readonly ruleId: string;
	readonly cooldownMs: number;
}

/** Configuration for the SensorSystem. */
export interface SensorsConfig {
	/** Global cooldown in ms between any two sensor fires. */
	readonly globalCooldown: number;
	/** Cooldown in ms between sensor fires targeting the same agent. */
	readonly perAgentCooldown: number;
	readonly overrides?: readonly SensorRuleOverride[];
	/**
	 * Maps domain names to file-path prefixes.
	 * Used by file-saved / file-opened rules to select the nearest-domain agent.
	 */
	readonly domainPaths?: Readonly<Record<string, string>>;
}

/** Configuration for group/cluster detection. */
export interface GroupsConfig {
	/** Minimum number of agents in proximity to form a cluster. */
	readonly clusterMinAgents: number;
	/** Max time in ms within which agents must be near each other to cluster. */
	readonly clusterProximityMs: number;
	/** Folder path where ritual YAML files are loaded from. */
	readonly ritualsFolder: string;
}

/** One engagement tier with idle interval and speech duration. */
export interface EngagementTier {
	/** How long (ms) to wait before triggering this tier. */
	readonly idleThresholdMs: number;
	/** How long (ms) the engagement bubble is visible. */
	readonly durationMs: number;
}

/** Configuration for the EngagementSystem. */
export interface EngagementConfig {
	readonly tiers: {
		readonly ambient: EngagementTier;
		readonly nudge: EngagementTier;
		readonly offer: EngagementTier;
	};
	/** How long (ms) an active engagement lasts before auto-dismissing. */
	readonly engagementDuration: number;
}

/** A single tool available to agents. */
export interface AgentTool {
	readonly id: string;
	readonly label: string;
	readonly command: string;
	/** Domains this tool is relevant for. */
	readonly domains: readonly string[];
	/** Conditions that trigger auto-suggestion of this tool. */
	readonly triggers: readonly string[];
	/** Cooldown in ms before this tool can be offered again. */
	readonly cooldownMs: number;
	/** Whether agent must request human approval before running. */
	readonly requiresApproval: boolean;
}

/** Configuration for tool execution. */
export interface ToolsConfig {
	/** Default execution timeout in ms. */
	readonly defaultTimeout: number;
}

/** Day cycle timing. */
export interface DayCycleConfig {
	readonly durationMs: number;
}

/** Weather cycling. */
export interface WeatherWorldConfig {
	readonly cycleLengthInDayCycles: number;
}

/** Relationship system tuning. */
export interface RelationshipsConfig {
	readonly affinityDecayPerCycle: number;
	readonly bickerChance: number;
	readonly maxSharedMemories: number;
}

/** Agent behavior tuning — movement pacing, idle rhythm, decision timing. */
export interface BehaviorConfig {
	/** Base idle time (ms) before wandering. Scaled by CON attribute. */
	readonly idleResistanceBase: number;
	/** Additional idle time (ms) scaled by CON/20. */
	readonly idleResistanceCONScale: number;
	/** Minimum BT tick interval (ms). */
	readonly btTickMinMs: number;
	/** Maximum BT tick interval (ms). */
	readonly btTickMaxMs: number;
	/** Minimum wander distance (px) from current position. */
	readonly minWanderDistance: number;
	/** Idle pose timer range per style (ms). */
	readonly idleTimers: {
		readonly fidgety: { readonly min: number; readonly max: number };
		readonly calm: { readonly min: number; readonly max: number };
		readonly restless: { readonly min: number; readonly max: number };
	};
	/** Movement speed multipliers by style. */
	readonly speedMap: {
		readonly deliberate: number;
		readonly brisk: number;
		readonly darting: number;
	};
}

/** Top-level configuration bag for all Agent World systems. */
export interface WorldConfig {
	readonly needs: NeedsConfig;
	readonly director: DirectorConfig;
	readonly sensors: SensorsConfig;
	readonly groups: GroupsConfig;
	readonly engagement: EngagementConfig;
	readonly tools: ToolsConfig;
	readonly dayCycle: DayCycleConfig;
	readonly weather: WeatherWorldConfig;
	readonly relationships: RelationshipsConfig;
	readonly behavior: BehaviorConfig;
}

/** Sensible defaults for all WorldConfig values. */
export const DEFAULT_WORLD_CONFIG: WorldConfig = {
	needs: {
		initial: {
			energy: 80,
			social: 60,
			focus: 70,
			morale: 75,
		},
		decay: {
			energy: { working: 3 },
			social: { alone: 2 },
			focus: { perInterruption: 4 },
			morale: { perError: 1 },
		},
		hungerThreshold: 40,
		thirstThreshold: 30,
		hungerEnergyMult: 1.5,
		thirstEnergyMult: 1.5,
		hungerInitial: 80,
		thirstInitial: 80,
	},
	director: {
		awareness: {
			noticeRadius: 60,
			greetRadius: 40,
		},
	},
	sensors: {
		globalCooldown: 10000,
		perAgentCooldown: 5000,
		domainPaths: {
			engineering: "src/",
			quality: "tests/",
			design: "design/",
			product: "docs/",
			operations: ".flowti/",
		},
	},
	groups: {
		clusterMinAgents: 3,
		clusterProximityMs: 6000,
		ritualsFolder: ".flowti/rituals/",
	},
	engagement: {
		tiers: {
			ambient: { idleThresholdMs: 30000, durationMs: 45000 },
			nudge:   { idleThresholdMs: 90000, durationMs: 90000 },
			offer:   { idleThresholdMs: 180000, durationMs: 180000 },
		},
		engagementDuration: 10000,
	},
	tools: {
		defaultTimeout: 30000,
	},
	dayCycle: {
		durationMs: 1_500_000,  // 25 minutes
	},
	weather: {
		cycleLengthInDayCycles: 2,
	},
	relationships: {
		affinityDecayPerCycle: 1,
		bickerChance: 0.3,
		maxSharedMemories: 5,
	},
	behavior: {
		idleResistanceBase: 8000,
		idleResistanceCONScale: 12000,
		btTickMinMs: 4000,
		btTickMaxMs: 6000,
		minWanderDistance: 150,
		idleTimers: {
			fidgety:  { min: 5000, max: 9000 },
			calm:     { min: 12000, max: 20000 },
			restless: { min: 8000, max: 14000 },
		},
		speedMap: {
			deliberate: 0.7,
			brisk: 1.0,
			darting: 1.4,
		},
	},
};

/** Merge needs config, including nested decay sub-objects. */
function mergeNeeds(overrides: DeepPartial<NeedsConfig> | undefined): NeedsConfig {
	const base = DEFAULT_WORLD_CONFIG.needs;
	const scalars = mergeNeedsScalars(base, overrides);
	return {
		initial: { ...base.initial, ...overrides?.initial },
		decay: {
			energy: { ...base.decay.energy, ...overrides?.decay?.energy },
			social: { ...base.decay.social, ...overrides?.decay?.social },
			focus:  { ...base.decay.focus,  ...overrides?.decay?.focus  },
			morale: { ...base.decay.morale, ...overrides?.decay?.morale },
		},
		...scalars,
	};
}

/** Merge the flat scalar fields of NeedsConfig using spread over defaults. */
function mergeNeedsScalars(
	base: NeedsConfig,
	overrides: DeepPartial<NeedsConfig> | undefined,
): Pick<NeedsConfig, 'hungerThreshold' | 'thirstThreshold' | 'hungerEnergyMult' | 'thirstEnergyMult' | 'hungerInitial' | 'thirstInitial'> {
	return {
		hungerThreshold:  overrides?.hungerThreshold  ?? base.hungerThreshold,
		thirstThreshold:  overrides?.thirstThreshold  ?? base.thirstThreshold,
		hungerEnergyMult: overrides?.hungerEnergyMult ?? base.hungerEnergyMult,
		thirstEnergyMult: overrides?.thirstEnergyMult ?? base.thirstEnergyMult,
		hungerInitial:    overrides?.hungerInitial    ?? base.hungerInitial,
		thirstInitial:    overrides?.thirstInitial    ?? base.thirstInitial,
	};
}

/** Merge engagement config, including nested tier sub-objects. */
function mergeEngagement(overrides: DeepPartial<EngagementConfig> | undefined): EngagementConfig {
	return {
		tiers: {
			ambient: { ...DEFAULT_WORLD_CONFIG.engagement.tiers.ambient, ...overrides?.tiers?.ambient },
			nudge:   { ...DEFAULT_WORLD_CONFIG.engagement.tiers.nudge,   ...overrides?.tiers?.nudge   },
			offer:   { ...DEFAULT_WORLD_CONFIG.engagement.tiers.offer,   ...overrides?.tiers?.offer   },
		},
		engagementDuration: overrides?.engagementDuration ?? DEFAULT_WORLD_CONFIG.engagement.engagementDuration,
	};
}

/**
 * Deep-merge a partial WorldConfig over the defaults.
 *
 * Only one level of nesting is merged; leaf objects are replaced, not
 * spread again. This keeps the merge predictable and avoids complex
 * recursive logic for a config that is intentionally flat.
 */
export function mergeWorldConfig(overrides: DeepPartial<WorldConfig>): WorldConfig {
	return {
		needs: mergeNeeds(overrides.needs),
		director: {
			awareness: { ...DEFAULT_WORLD_CONFIG.director.awareness, ...overrides.director?.awareness },
		},
		sensors: { ...DEFAULT_WORLD_CONFIG.sensors, ...overrides.sensors },
		groups: { ...DEFAULT_WORLD_CONFIG.groups, ...overrides.groups },
		engagement: mergeEngagement(overrides.engagement),
		tools: { ...DEFAULT_WORLD_CONFIG.tools, ...overrides.tools },
		dayCycle: { ...DEFAULT_WORLD_CONFIG.dayCycle, ...overrides.dayCycle },
		weather: { ...DEFAULT_WORLD_CONFIG.weather, ...overrides.weather },
		relationships: { ...DEFAULT_WORLD_CONFIG.relationships, ...overrides.relationships },
		behavior: mergeBehavior(overrides.behavior),
	};
}

function mergeBehavior(overrides: DeepPartial<BehaviorConfig> | undefined): BehaviorConfig {
	const base = DEFAULT_WORLD_CONFIG.behavior;
	return {
		idleResistanceBase: overrides?.idleResistanceBase ?? base.idleResistanceBase,
		idleResistanceCONScale: overrides?.idleResistanceCONScale ?? base.idleResistanceCONScale,
		btTickMinMs: overrides?.btTickMinMs ?? base.btTickMinMs,
		btTickMaxMs: overrides?.btTickMaxMs ?? base.btTickMaxMs,
		minWanderDistance: overrides?.minWanderDistance ?? base.minWanderDistance,
		idleTimers: {
			fidgety:  { ...base.idleTimers.fidgety,  ...overrides?.idleTimers?.fidgety },
			calm:     { ...base.idleTimers.calm,     ...overrides?.idleTimers?.calm },
			restless: { ...base.idleTimers.restless, ...overrides?.idleTimers?.restless },
		},
		speedMap: { ...base.speedMap, ...overrides?.speedMap },
	};
}

/**
 * Resolved config singleton — initialized from game-config.json at import time.
 * All game systems should read from this instead of DEFAULT_WORLD_CONFIG directly.
 */
import gameConfigJson from "../../../configs/game-config.json";
export const WORLD_CONFIG: WorldConfig = mergeWorldConfig(gameConfigJson);

/** Utility type for deep-partial WorldConfig overrides. */
type DeepPartial<T> = {
	readonly [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
