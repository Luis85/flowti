import type { Logger } from './logger.js';
import type { EventBus } from './events.js';
import type { GameConfig } from '../schemas/game-config-schema.js';
import type { PerformanceTracker } from './performance.js';

export interface GameCoreDeps {
	readonly logger: Logger;
	readonly eventBus: EventBus;
	readonly config: GameConfig;
	readonly performanceTracker: PerformanceTracker;
	/** Current tick number — set by the tick runner before system execution each tick */
	tickCount: number;
}
