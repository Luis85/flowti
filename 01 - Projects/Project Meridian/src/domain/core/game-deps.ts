import type { Logger } from './logger.js';
import type { EventBus } from './events.js';
import type { GameConfig } from '../schemas/game-config-schema.js';
import type { PerformanceTracker } from './performance.js';

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
}
