import type { PlatformPort } from '../../domain/shared/platform-port.js';

function momentLocale(): string | null {
	// Access window.moment via unknown to handle environments where it may not exist
	const win = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
	if (win === null) return null;
	const momentLib = win['moment'];
	if (typeof momentLib !== 'object' || momentLib === null || !('locale' in momentLib)) return null;
	const localeGetter = (momentLib as Record<string, unknown>)['locale'];
	if (typeof localeGetter !== 'function') return null;
	const result: unknown = (localeGetter as () => unknown)();
	return typeof result === 'string' && result.length > 0 ? result : null;
}

function navigatorLocale(): string | null {
	if (typeof navigator === 'undefined') return null;
	const lang = navigator.language;
	if (typeof lang !== 'string' || lang.length === 0) return null;
	return lang.split('-')[0] ?? 'en';
}

export class ObsidianPlatformAdapter implements PlatformPort {
	get locale(): string {
		return momentLocale() ?? navigatorLocale() ?? 'en';
	}
}
