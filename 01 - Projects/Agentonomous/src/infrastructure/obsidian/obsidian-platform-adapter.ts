import type { PlatformPort } from '../../domain/shared/platform-port.js';

export class ObsidianPlatformAdapter implements PlatformPort {
	get locale(): string {
		if (typeof window !== 'undefined' && typeof window.moment?.locale === 'function') {
			const momentLocale = window.moment.locale();
			if (typeof momentLocale === 'string' && momentLocale.length > 0) {
				return momentLocale;
			}
		}
		if (typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.length > 0) {
			return navigator.language.split('-')[0] ?? 'en';
		}
		return 'en';
	}
}
