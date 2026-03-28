import type { LogLevel } from './logger.js';

/** Plugin settings — persisted via Obsidian loadData/saveData */
export interface MeridianSettings {
	/** Minimum log level displayed in console. Default: 'info' */
	logLevel: LogLevel;
	/** Enable debug mode (overlays, performance panel, verbose logging). Default: false */
	debugMode: boolean;
	/** Enable performance tracking (system timing per tick). Default: false */
	performanceTracking: boolean;
	/** Target ticks per second. Default: 60 */
	tickRate: number;
	/** Seconds per full day/night cycle. Default: 120 */
	dayCycleDuration: number;
	/** Base perception radius multiplier. Default: 150 */
	perceptionRadius: number;
}

export const DEFAULT_SETTINGS: MeridianSettings = {
	logLevel: 'info',
	debugMode: false,
	performanceTracking: false,
	tickRate: 60,
	dayCycleDuration: 120,
	perceptionRadius: 150,
};
