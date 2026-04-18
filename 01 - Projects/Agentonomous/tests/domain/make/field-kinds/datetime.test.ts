import { describe, it, expect } from 'vitest';
import { DATETIME_FIELD_KIND } from '../../../../src/domain/make/field-kinds/datetime.js';
import type { Field } from '../../../../src/domain/make/type-schema.js';

const FIELD: Extract<Field, { kind: 'datetime' }> = { kind: 'datetime', name: 'publishedAt', required: true };

describe('DATETIME_FIELD_KIND', () => {
	it('accepts ISO 8601 strings', () => {
		const r = DATETIME_FIELD_KIND.validateValue(FIELD, '2026-04-18T12:34:56Z');
		expect(r.kind).toBe('ok');
	});
	it('accepts ISO 8601 with offset', () => {
		const r = DATETIME_FIELD_KIND.validateValue(FIELD, '2026-04-18T12:34:56+02:00');
		expect(r.kind).toBe('ok');
	});
	it('accepts Date instances', () => {
		const r = DATETIME_FIELD_KIND.validateValue(FIELD, new Date());
		expect(r.kind).toBe('ok');
	});
	it('rejects bad strings', () => {
		expect(DATETIME_FIELD_KIND.validateValue(FIELD, 'yesterday at noon')).toMatchObject({ kind: 'err', error: { kind: 'invalid-datetime' } });
	});
	it('toFrontmatter emits ISO 8601', () => {
		const d = new Date(Date.UTC(2026, 3, 18, 12, 34, 56));
		const out = DATETIME_FIELD_KIND.toFrontmatter({ kind: 'datetime', value: d });
		expect(typeof out).toBe('string');
		expect((out as string)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/);
	});
});
