import type { GameCoreDeps } from './game-deps.js';

export interface GameSystem {
	readonly name: string;
	readonly priority: number;
	execute(deps: GameCoreDeps): void;
}

export interface TickScheduler {
	register(system: GameSystem): void;
	tick(deps: GameCoreDeps): void;
	readonly tickCount: number;
}

export const SystemPriority = {
	TRAIT_RESOLVER: 0.5,
	DAY_NIGHT: 0.7,
	WELFARE: 0.8,
	STIPEND: 0.81,
	SUBSIDY: 0.82,
	EQUIPMENT_DECAY: 0.83,
	FACILITY_MAINTENANCE: 0.835,
	DAILY_REPORT: 0.84,
	NEEDS_DECAY: 1,
	MOOD: 2,
	PERCEPTION: 3,
	MEMORY: 4,
	BEHAVIOR_TREE: 5,
	MOVEMENT: 5.5,
	JOB: 5.8,
	FACILITY: 6,
	REST: 6.5,
	FEED: 6.6,
	SOCIALIZE: 6.7,
	LEISURE: 6.75,
	QUEST_EVALUATION: 7,
	QUEST_GENERATION: 7.1,
	OBJECT_INTERACTION: 8,
	TOOL_EXECUTION: 9,
	CONSTRUCTION: 10,
	TRADE: 11,
	DIALOGUE: 12,
	GOSSIP: 12.5,
	PROGRESSION: 13,
	RELATIONSHIP: 14,
	ITEM_DURABILITY: 15,
	ECONOMY: 16,
	MONETARY_POLICY: 16.5,
	WORLD_EVENT: 17,
	SEASON: 17.5,
	NOTIFICATION: 18,
	CHRONICLER: 18.5,
	SCENARIO: 18.7,
	ABANDONMENT: 18.8,
	VAULT_SYNC: 19,
	UI_BRIDGE: 20,
} as const;
