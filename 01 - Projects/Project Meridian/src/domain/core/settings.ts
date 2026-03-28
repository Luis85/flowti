import type { LogLevel } from './logger.js';

/** Plugin settings — persisted via Obsidian loadData/saveData */
export interface MeridianSettings {
	/** Minimum log level displayed in console. Default: 'info' */
	logLevel: LogLevel;
	/** Enable debug mode (overlays, performance panel, verbose logging). Default: false */
	debugMode: boolean;
	/** Enable performance tracking (system timing per tick). Default: false */
	performanceTracking: boolean;
}

export const DEFAULT_SETTINGS: MeridianSettings = {
	logLevel: 'info',
	debugMode: false,
	performanceTracking: false,
};
