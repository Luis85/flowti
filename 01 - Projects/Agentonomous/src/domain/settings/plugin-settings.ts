import { err, ok, type Result } from '../shared/result.js';
import { isOneOf } from '../shared/utils/is-one-of.js';
import type { LogLevel } from '../shared/logger-port.js';

export const KNOWN_DEFAULT_VIEWS = ['home'] as const;
export type DefaultViewName = (typeof KNOWN_DEFAULT_VIEWS)[number];

export const KNOWN_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type CoreSettings = {
	readonly showRibbonIcon: boolean;
	readonly defaultView: DefaultViewName;
	readonly logLevel: LogLevel;
	/** Plugin display language. Absent = auto from Obsidian. */
	readonly locale?: string;
};

export const CORE_SETTINGS_DEFAULTS: CoreSettings = {
	showRibbonIcon: true,
	defaultView: 'home',
	logLevel: 'info',
	// locale intentionally absent — auto from Obsidian
};

export function isDefaultViewName(value: string): value is DefaultViewName {
	return isOneOf(value, KNOWN_DEFAULT_VIEWS);
}

function validateLocale(raw: Record<string, unknown>): Result<string | undefined, string> {
	if (!('locale' in raw)) return ok(undefined);
	if (typeof raw['locale'] !== 'string') return err('locale must be a string');
	return ok(raw['locale']);
}

function validateCoreFields(rec: Record<string, unknown>): Result<{ showRibbonIcon: boolean; defaultView: DefaultViewName; logLevel: LogLevel }, string> {
	const { showRibbonIcon, defaultView, logLevel } = rec;
	if (typeof showRibbonIcon !== 'boolean') return err('showRibbonIcon must be boolean');
	if (typeof defaultView !== 'string') return err('defaultView must be string');
	if (!isDefaultViewName(defaultView)) return err(`defaultView must be one of: ${KNOWN_DEFAULT_VIEWS.join(', ')}`);
	if (typeof logLevel !== 'string') return err('logLevel must be string');
	if (!isOneOf(logLevel, KNOWN_LOG_LEVELS)) return err(`logLevel must be one of: ${KNOWN_LOG_LEVELS.join(', ')}`);
	return ok({ showRibbonIcon, defaultView, logLevel });
}

export function validateCoreSettings(raw: unknown): Result<CoreSettings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return err('settings must be an object');
	}
	const rec = raw as Record<string, unknown>;
	const fieldsResult = validateCoreFields(rec);
	if (fieldsResult.kind === 'err') return fieldsResult;
	const { showRibbonIcon, defaultView, logLevel } = fieldsResult.value;
	const localeResult = validateLocale(rec);
	if (localeResult.kind === 'err') return localeResult;
	const locale = localeResult.value;
	if (locale !== undefined) return ok({ showRibbonIcon, defaultView, logLevel, locale });
	return ok({ showRibbonIcon, defaultView, logLevel });
}
