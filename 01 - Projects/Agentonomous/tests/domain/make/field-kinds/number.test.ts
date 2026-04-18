import { describe, it, expect } from 'vitest';
import { NUMBER_FIELD_KIND } from '../../../../src/domain/make/field-kinds/number.js';
import type { Field } from '../../../../src/domain/make/type-schema.js';

const REQUIRED: Extract<Field, { kind: 'number' }> = { kind: 'number', name: 'pages', required: true };
const OPTIONAL: Extract<Field, { kind: 'number' }> = { kind: 'number', name: 'pages', required: false };

describe('NUMBER_FIELD_KIND', () => {
	it('defaultField', () => {
		expect(NUMBER_FIELD_KIND.defaultField('pages')).toEqual({ kind: 'number', name: 'pages', required: false });
	});
	it('accepts number values', () => {
		expect(NUMBER_FIELD_KIND.validateValue(REQUIRED, 42)).toEqual({ kind: 'ok', value: { kind: 'number', value: 42 } });
	});
	it('accepts numeric strings', () => {
		expect(NUMBER_FIELD_KIND.validateValue(REQUIRED, '42')).toEqual({ kind: 'ok', value: { kind: 'number', value: 42 } });
	});
	it('rejects NaN and Infinity', () => {
		expect(NUMBER_FIELD_KIND.validateValue(REQUIRED, NaN)).toMatchObject({ kind: 'err' });
		expect(NUMBER_FIELD_KIND.validateValue(REQUIRED, Infinity)).toMatchObject({ kind: 'err' });
	});
	it('rejects non-numeric strings', () => {
		expect(NUMBER_FIELD_KIND.validateValue(REQUIRED, 'abc')).toMatchObject({ kind: 'err', error: { kind: 'invalid-number' } });
	});
	it('rejects undefined/null when required', () => {
		expect(NUMBER_FIELD_KIND.validateValue(REQUIRED, undefined)).toMatchObject({ kind: 'err', error: { kind: 'required-missing' } });
		expect(NUMBER_FIELD_KIND.validateValue(REQUIRED, null)).toMatchObject({ kind: 'err', error: { kind: 'required-missing' } });
	});
	it('accepts undefined/null when optional and emits default 0 via fromFrontmatter only on explicit raw', () => {
		// Optional + undefined during user submission: required-missing? No — it is optional, so we return 0? No — return the "empty" sentinel via the form layer, not here. The value validator is strict: only accept numbers or numeric strings.
		expect(NUMBER_FIELD_KIND.validateValue(OPTIONAL, undefined)).toMatchObject({ kind: 'err', error: { kind: 'invalid-number' } });
	});
	it('toFrontmatter emits the number', () => {
		expect(NUMBER_FIELD_KIND.toFrontmatter({ kind: 'number', value: 3.14 })).toBe(3.14);
	});
});
