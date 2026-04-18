import { describe, it, expect } from 'vitest';
import { DATE_FIELD_KIND } from '../../../../src/domain/make/field-kinds/date.js';
import type { Field } from '../../../../src/domain/make/type-schema.js';

const FIELD: Extract<Field, { kind: 'date' }> = { kind: 'date', name: 'published', required: true };

describe('DATE_FIELD_KIND', () => {
	it('defaultField', () => {
		expect(DATE_FIELD_KIND.defaultField('published')).toEqual({ kind: 'date', name: 'published', required: false });
	});
	it('accepts a YYYY-MM-DD string', () => {
		const result = DATE_FIELD_KIND.validateValue(FIELD, '2026-04-18');
		expect(result.kind).toBe('ok');
		if (result.kind === 'ok') {
			expect(result.value.kind).toBe('date');
			expect(result.value.value.getFullYear()).toBe(2026);
			expect(result.value.value.getMonth()).toBe(3);
			expect(result.value.value.getDate()).toBe(18);
		}
	});
	it('accepts a Date object', () => {
		const d = new Date(2026, 3, 18);
		const result = DATE_FIELD_KIND.validateValue(FIELD, d);
		expect(result.kind).toBe('ok');
	});
	it('rejects non-date strings', () => {
		expect(DATE_FIELD_KIND.validateValue(FIELD, 'tomorrow')).toMatchObject({ kind: 'err', error: { kind: 'invalid-date' } });
		expect(DATE_FIELD_KIND.validateValue(FIELD, '2026-13-01')).toMatchObject({ kind: 'err', error: { kind: 'invalid-date' } });
	});
	it('toFrontmatter emits YYYY-MM-DD in local time', () => {
		const d = new Date(2026, 3, 18, 12, 34);
		expect(DATE_FIELD_KIND.toFrontmatter({ kind: 'date', value: d })).toBe('2026-04-18');
	});
	it('rejects undefined when required', () => {
		expect(DATE_FIELD_KIND.validateValue(FIELD, undefined)).toMatchObject({ kind: 'err', error: { kind: 'required-missing' } });
	});
});
