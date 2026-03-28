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
	NEEDS_DECAY: 1,
	MOOD: 2,
	PERCEPTION: 3,
	MEMORY: 4,
	BEHAVIOR_TREE: 5,
	MOVEMENT: 5.5,
	JOB: 6,
	QUEST_EVALUATION: 7,
	OBJECT_INTERACTION: 8,
	TOOL_EXECUTION: 9,
	CONSTRUCTION: 10,
	TRADE: 11,
	DIALOGUE: 12,
	PROGRESSION: 13,
	RELATIONSHIP: 14,
	MORTALITY_CHECK: 14.5,
	ITEM_DURABILITY: 15,
	ECONOMY: 16,
	WORLD_EVENT: 17,
	SEASON: 17.5,
	NOTIFICATION: 18,
	CHRONICLER: 18.5,
	SCENARIO: 18.7,
	ABANDONMENT: 18.8,
	VAULT_SYNC: 19,
	UI_BRIDGE: 20,
} as const;
