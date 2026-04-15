import { err, ok, type Result } from '../shared/result.js';

export const KNOWN_DEFAULT_VIEWS = ['home'] as const;
export type DefaultViewName = (typeof KNOWN_DEFAULT_VIEWS)[number];

export type PluginSettings = {
	readonly showRibbonIcon: boolean;
	readonly defaultView: DefaultViewName;
};

export const DEFAULT_SETTINGS: PluginSettings = {
	showRibbonIcon: true,
	defaultView: 'home',
};

export function isDefaultViewName(value: string): value is DefaultViewName {
	return (KNOWN_DEFAULT_VIEWS as readonly string[]).includes(value);
}

function isObject(x: unknown): x is Record<string, unknown> {
	return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function validateSettings(raw: unknown): Result<PluginSettings, string> {
	if (!isObject(raw)) return err('settings must be an object');
	const { showRibbonIcon, defaultView } = raw;
	if (typeof showRibbonIcon !== 'boolean') return err('showRibbonIcon must be boolean');
	if (typeof defaultView !== 'string') return err('defaultView must be string');
	if (!isDefaultViewName(defaultView)) {
		return err(`defaultView must be one of: ${KNOWN_DEFAULT_VIEWS.join(', ')}`);
	}
	return ok({ showRibbonIcon, defaultView });
}
