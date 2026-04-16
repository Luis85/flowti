import { err, ok, type Result } from '../shared/result.js';
import { isOneOf } from '../shared/utils/is-one-of.js';
import type { LogLevel } from '../shared/logger-port.js';

export const KNOWN_DEFAULT_VIEWS = ['home'] as const;
export type DefaultViewName = (typeof KNOWN_DEFAULT_VIEWS)[number];

export const KNOWN_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type PluginSettings = {
	readonly showRibbonIcon: boolean;
	readonly defaultView: DefaultViewName;
	readonly logLevel: LogLevel;
};

export const DEFAULT_SETTINGS: PluginSettings = {
	showRibbonIcon: true,
	defaultView: 'home',
	logLevel: 'info',
};

export function isDefaultViewName(value: string): value is DefaultViewName {
	return isOneOf(value, KNOWN_DEFAULT_VIEWS);
}

export function validateSettings(raw: unknown): Result<PluginSettings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return err('settings must be an object');
	}
	const { showRibbonIcon, defaultView, logLevel } = raw as Record<string, unknown>;
	if (typeof showRibbonIcon !== 'boolean') return err('showRibbonIcon must be boolean');
	if (typeof defaultView !== 'string') return err('defaultView must be string');
	if (!isDefaultViewName(defaultView)) {
		return err(`defaultView must be one of: ${KNOWN_DEFAULT_VIEWS.join(', ')}`);
	}
	if (typeof logLevel !== 'string') return err('logLevel must be string');
	if (!isOneOf(logLevel, KNOWN_LOG_LEVELS)) {
		return err(`logLevel must be one of: ${KNOWN_LOG_LEVELS.join(', ')}`);
	}
	return ok({ showRibbonIcon, defaultView, logLevel });
}
