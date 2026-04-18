import { describe, it, expect } from 'vitest';
import { CHECKBOX_FIELD_KIND } from '../../../../src/domain/make/field-kinds/checkbox.js';
import type { Field } from '../../../../src/domain/make/type-schema.js';

const FIELD: Extract<Field, { kind: 'checkbox' }> = { kind: 'checkbox', name: 'read', required: false };

describe('CHECKBOX_FIELD_KIND', () => {
	it('defaultField', () => {
		expect(CHECKBOX_FIELD_KIND.defaultField('read')).toEqual({ kind: 'checkbox', name: 'read', required: false });
	});
	it('accepts booleans', () => {
		expect(CHECKBOX_FIELD_KIND.validateValue(FIELD, true)).toEqual({ kind: 'ok', value: { kind: 'checkbox', value: true } });
		expect(CHECKBOX_FIELD_KIND.validateValue(FIELD, false)).toEqual({ kind: 'ok', value: { kind: 'checkbox', value: false } });
	});
	it('coerces undefined to false', () => {
		expect(CHECKBOX_FIELD_KIND.validateValue(FIELD, undefined)).toEqual({ kind: 'ok', value: { kind: 'checkbox', value: false } });
	});
	it('rejects non-booleans', () => {
		expect(CHECKBOX_FIELD_KIND.validateValue(FIELD, 'true')).toMatchObject({ kind: 'err', error: { kind: 'invalid-boolean' } });
		expect(CHECKBOX_FIELD_KIND.validateValue(FIELD, 1)).toMatchObject({ kind: 'err', error: { kind: 'invalid-boolean' } });
	});
	it('toFrontmatter emits the boolean', () => {
		expect(CHECKBOX_FIELD_KIND.toFrontmatter({ kind: 'checkbox', value: true })).toBe(true);
	});
});
