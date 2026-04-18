import { describe, it, expect } from 'vitest';
import { MAKE_DEFAULTS, validateMakeSettings } from '../../../src/modules/make/make-settings.js';

describe('validateMakeSettings', () => {
	it('accepts the defaults', () => {
		expect(validateMakeSettings(MAKE_DEFAULTS)).toEqual({ kind: 'ok', value: MAKE_DEFAULTS });
	});
	it('rejects non-object input', () => {
		expect(validateMakeSettings('nope')).toMatchObject({ kind: 'err' });
	});
	it('coerces missing favorites to empty array', () => {
		const { favorites: _, ...rest } = MAKE_DEFAULTS;
		const r = validateMakeSettings(rest);
		expect(r).toMatchObject({ kind: 'ok' });
		if (r.kind === 'ok') expect(r.value.favorites).toEqual([]);
	});
	it('rejects non-string typesFolder', () => {
		expect(validateMakeSettings({ ...MAKE_DEFAULTS, typesFolder: 123 })).toMatchObject({ kind: 'err' });
	});
});
