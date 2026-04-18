import { describe, it, expect } from 'vitest';
import { LIST_FIELD_KIND } from '../../../../src/domain/make/field-kinds/list.js';
import type { Field } from '../../../../src/domain/make/type-schema.js';

const REQUIRED: Extract<Field, { kind: 'list' }> = { kind: 'list', name: 'tags', required: true };
const OPTIONAL: Extract<Field, { kind: 'list' }> = { kind: 'list', name: 'tags', required: false };

describe('LIST_FIELD_KIND', () => {
	it('defaultField', () => {
		expect(LIST_FIELD_KIND.defaultField('tags')).toEqual({ kind: 'list', name: 'tags', required: false });
	});
	it('accepts arrays of strings', () => {
		expect(LIST_FIELD_KIND.validateValue(OPTIONAL, ['a', 'b'])).toEqual({ kind: 'ok', value: { kind: 'list', value: ['a', 'b'] } });
	});
	it('rejects empty arrays when required', () => {
		expect(LIST_FIELD_KIND.validateValue(REQUIRED, [])).toMatchObject({ kind: 'err', error: { kind: 'required-missing' } });
	});
	it('rejects arrays containing non-strings', () => {
		expect(LIST_FIELD_KIND.validateValue(OPTIONAL, ['a', 42])).toMatchObject({ kind: 'err', error: { kind: 'invalid-list' } });
	});
	it('coerces undefined to empty array when optional', () => {
		expect(LIST_FIELD_KIND.validateValue(OPTIONAL, undefined)).toEqual({ kind: 'ok', value: { kind: 'list', value: [] } });
	});
	it('rejects non-arrays', () => {
		expect(LIST_FIELD_KIND.validateValue(OPTIONAL, 'a,b')).toMatchObject({ kind: 'err', error: { kind: 'invalid-list' } });
	});
});
