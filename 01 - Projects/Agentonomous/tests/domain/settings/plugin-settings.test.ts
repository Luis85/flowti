import { describe, expect, it } from 'vitest';
import { CORE_SETTINGS_DEFAULTS, validateCoreSettings } from '../../../src/domain/settings/plugin-settings.js';
import { isErr, isOk } from '../../../src/domain/shared/result.js';

describe('validateCoreSettings', () => {
	it('accepts default settings', () => {
		const r = validateCoreSettings(CORE_SETTINGS_DEFAULTS);
		expect(isOk(r)).toBe(true);
	});

	it('accepts raw JSON matching the schema', () => {
		const r = validateCoreSettings({ showRibbonIcon: false, defaultView: 'home', logLevel: 'info' });
		expect(isOk(r)).toBe(true);
		if (isOk(r)) expect(r.value.showRibbonIcon).toBe(false);
	});

	it('rejects a non-object', () => {
		expect(isErr(validateCoreSettings(null))).toBe(true);
		expect(isErr(validateCoreSettings('nope'))).toBe(true);
		expect(isErr(validateCoreSettings(42))).toBe(true);
	});

	it('rejects a missing showRibbonIcon', () => {
		const r = validateCoreSettings({ defaultView: 'home', logLevel: 'info' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects a wrong-type showRibbonIcon', () => {
		const r = validateCoreSettings({ showRibbonIcon: 'yes', defaultView: 'home', logLevel: 'info' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects an unknown defaultView value', () => {
		const r = validateCoreSettings({ showRibbonIcon: true, defaultView: 'not-a-view', logLevel: 'info' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects a missing logLevel', () => {
		const r = validateCoreSettings({ showRibbonIcon: true, defaultView: 'home' });
		expect(isErr(r)).toBe(true);
	});

	it('rejects an unknown logLevel value', () => {
		const r = validateCoreSettings({ showRibbonIcon: true, defaultView: 'home', logLevel: 'verbose' });
		expect(isErr(r)).toBe(true);
	});

	it('CORE_SETTINGS_DEFAULTS has showRibbonIcon = true, defaultView = home, logLevel = info', () => {
		expect(CORE_SETTINGS_DEFAULTS.showRibbonIcon).toBe(true);
		expect(CORE_SETTINGS_DEFAULTS.defaultView).toBe('home');
		expect(CORE_SETTINGS_DEFAULTS.logLevel).toBe('info');
	});
});
