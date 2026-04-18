import { describe, it, expect } from 'vitest';
import { TEXT_FIELD_KIND } from '../../../../src/domain/make/field-kinds/text.js';
import type { Field, FieldValue } from '../../../../src/domain/make/type-schema.js';

const TEXT_FIELD: Extract<Field, { kind: 'text' }> = { kind: 'text', name: 'title', required: true };

describe('TEXT_FIELD_KIND', () => {
	it('defaultField produces a valid Field with the given name', () => {
		const f = TEXT_FIELD_KIND.defaultField('title');
		expect(f).toEqual({ kind: 'text', name: 'title', required: false });
	});
	it('validateField returns empty for a valid field', () => {
		expect(TEXT_FIELD_KIND.validateField(TEXT_FIELD)).toEqual([]);
	});
	it('validateValue accepts strings', () => {
		expect(TEXT_FIELD_KIND.validateValue(TEXT_FIELD, 'hello')).toEqual({ kind: 'ok', value: { kind: 'text', value: 'hello' } });
	});
	it('validateValue rejects non-strings when required', () => {
		expect(TEXT_FIELD_KIND.validateValue(TEXT_FIELD, 42)).toMatchObject({ kind: 'err', error: { kind: 'invalid-text' } });
	});
	it('validateValue rejects empty when required', () => {
		expect(TEXT_FIELD_KIND.validateValue(TEXT_FIELD, '')).toMatchObject({ kind: 'err', error: { kind: 'required-missing' } });
	});
	it('validateValue accepts empty when not required', () => {
		const opt: Extract<Field, { kind: 'text' }> = { kind: 'text', name: 'bio', required: false };
		expect(TEXT_FIELD_KIND.validateValue(opt, '')).toEqual({ kind: 'ok', value: { kind: 'text', value: '' } });
	});
	it('toFrontmatter returns the string', () => {
		const v: Extract<FieldValue, { kind: 'text' }> = { kind: 'text', value: 'Dune' };
		expect(TEXT_FIELD_KIND.toFrontmatter(v)).toBe('Dune');
	});
	it('fromFrontmatter accepts strings', () => {
		expect(TEXT_FIELD_KIND.fromFrontmatter(TEXT_FIELD, 'Dune')).toEqual({ kind: 'ok', value: { kind: 'text', value: 'Dune' } });
	});
	it('fromFrontmatter rejects non-strings', () => {
		expect(TEXT_FIELD_KIND.fromFrontmatter(TEXT_FIELD, 42)).toMatchObject({ kind: 'err', error: { kind: 'invalid-text' } });
	});
	it('treats undefined as required-missing when required', () => {
		expect(TEXT_FIELD_KIND.validateValue(TEXT_FIELD, undefined)).toMatchObject({ kind: 'err', error: { kind: 'required-missing' } });
	});
	it('coerces undefined to empty when not required', () => {
		const opt: Extract<Field, { kind: 'text' }> = { kind: 'text', name: 'bio', required: false };
		expect(TEXT_FIELD_KIND.validateValue(opt, undefined)).toEqual({ kind: 'ok', value: { kind: 'text', value: '' } });
	});
});
