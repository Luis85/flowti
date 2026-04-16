import { err, ok, type Result } from '../shared/result.js';
import { isOneOf } from '../shared/utils/is-one-of.js';

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
	return isOneOf(value, KNOWN_DEFAULT_VIEWS);
}

export function validateSettings(raw: unknown): Result<PluginSettings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return err('settings must be an object');
	}
	const { showRibbonIcon, defaultView } = raw as Record<string, unknown>;
	if (typeof showRibbonIcon !== 'boolean') return err('showRibbonIcon must be boolean');
	if (typeof defaultView !== 'string') return err('defaultView must be string');
	if (!isDefaultViewName(defaultView)) {
		return err(`defaultView must be one of: ${KNOWN_DEFAULT_VIEWS.join(', ')}`);
	}
	return ok({ showRibbonIcon, defaultView });
}
