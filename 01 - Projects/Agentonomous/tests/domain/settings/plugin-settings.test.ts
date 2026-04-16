import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, validateSettings } from '../../../src/domain/settings/plugin-settings.js';
import { isErr, isOk } from '../../../src/domain/shared/result.js';

describe('validateSettings', () => {
	it('accepts default settings', () => {
		const r = validateSettings(DEFAULT_SETTINGS);
		expect(isOk(r)).toBe(true);
	});

	it('accepts raw JSON matching the schema', () => {
		const r = validateSettings({ showRibbonIcon: false, defaultView: 'home', logLevel: 'info' });
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value.showRibbonIcon).toBe(false);
	});

	it('rejects a non-object', () => {
		expect(isErr(validateSettings(null))).toBe(true);
		expect(isErr(validateSettings('nope'))).toBe(true);
		expect(isErr(validateSettings(42))).toBe(true);
	});

	it('rejects a missing showRibbonIcon', () => {
		const r = validateSettings({ defaultView: 'home', logLevel: 'info' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects a wrong-type showRibbonIcon', () => {
		const r = validateSettings({ showRibbonIcon: 'yes', defaultView: 'home', logLevel: 'info' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects an unknown defaultView value', () => {
		const r = validateSettings({ showRibbonIcon: true, defaultView: 'not-a-view', logLevel: 'info' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects a missing logLevel', () => {
		const r = validateSettings({ showRibbonIcon: true, defaultView: 'home' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects an unknown logLevel value', () => {
		const r = validateSettings({ showRibbonIcon: true, defaultView: 'home', logLevel: 'verbose' });
		expect(isErr(r)).toBe(true);
	});

	it('DEFAULT_SETTINGS has showRibbonIcon = true, defaultView = home, logLevel = info', () => {
		expect(DEFAULT_SETTINGS.showRibbonIcon).toBe(true);
		expect(DEFAULT_SETTINGS.defaultView).toBe('home');
		expect(DEFAULT_SETTINGS.logLevel).toBe('info');
	});
});
