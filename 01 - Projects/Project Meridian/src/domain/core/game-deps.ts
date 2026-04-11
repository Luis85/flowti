import type { Logger } from './logger.js';
import type { EventBus } from './events.js';
import type { GameConfig } from '../schemas/game-config-schema.js';
import type { PerformanceTracker } from './performance.js';
import type { FacilityType } from '../schemas/facility-type-schema.js';
import type { Recipe } from '../schemas/recipe-schema.js';

export interface GameCoreDeps {
	/** Hot-swappable — plugin.applySettings() replaces on settings change */
	logger: Logger;
	readonly eventBus: EventBus;
	readonly config: GameConfig;
	/** Hot-swappable — plugin.applySettings() replaces on settings change */
	performanceTracker: PerformanceTracker;
	/** Current tick number — set by the tick runner before system execution each tick */
	tickCount: number;
	/** Vault file writer — null in tests, real adapter in production */
	writeFile: ((path: string, content: string) => Promise<void>) | null;
	/** Root path for data files — set dynamically after vault probe in game-view */
	dataRoot: string;
	/** Recipe registry — populated at boot in Chunk 3 Task 3.1. Empty Map during Phase 1. */
	readonly getRecipeRegistry: () => Map<string, Recipe>;
	/** Facility type registry — populated at boot in Chunk 3 Task 3.1. Empty Map during Phase 1. */
	readonly getFacilityTypeRegistry: () => Map<string, FacilityType>;
}
