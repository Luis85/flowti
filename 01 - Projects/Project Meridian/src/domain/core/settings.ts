import type { LogLevel } from './logger.js';

/** Plugin settings — persisted via Obsidian loadData/saveData */
export interface MeridianSettings {
	/** Minimum log level displayed in console. Default: 'info' */
	logLevel: LogLevel;
	/** Enable debug mode (overlays, performance panel, verbose logging). Default: false */
	debugMode: boolean;
	/** Enable performance tracking (system timing per tick). Default: false */
	performanceTracking: boolean;
	/** Game speed multiplier (1 = normal, 2 = double speed, etc.). Default: 1 */
	gameSpeed: number;
	/** Hunger decay rate multiplier (1 = normal). Default: 1 */
	hungerRate: number;
	/** Thirst decay rate multiplier (1 = normal). Default: 1 */
	thirstRate: number;
	/** Energy decay rate multiplier (1 = normal). Default: 1 */
	energyRate: number;
	/** Food price override (0 = use config default). Default: 0 */
	foodPrice: number;
}

export const DEFAULT_SETTINGS: MeridianSettings = {
	logLevel: 'info',
	debugMode: false,
	performanceTracking: false,
	gameSpeed: 1,
	hungerRate: 1,
	thirstRate: 1,
	energyRate: 1,
	foodPrice: 0,
};
