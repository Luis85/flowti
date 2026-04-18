import { describe, it, expect } from 'vitest';
import { parseTypeSchema, serializeTypeSchema } from '../../../src/domain/make/type-schema-codec.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book',
	name: 'Book',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title', required: true },
		{ kind: 'number', name: 'pages', required: false },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

describe('parseTypeSchema / serializeTypeSchema', () => {
	it('roundtrips a schema', () => {
		const json = serializeTypeSchema(BOOK);
		const parsed = parseTypeSchema(JSON.parse(json));
		expect(parsed).toEqual({ kind: 'ok', value: BOOK });
	});
	it('parses from an unknown object', () => {
		const raw = JSON.parse(serializeTypeSchema(BOOK));
		const result = parseTypeSchema(raw);
		expect(result.kind).toBe('ok');
	});
	it('rejects non-object input', () => {
		expect(parseTypeSchema('nope')).toMatchObject({ kind: 'err', error: { kind: 'invalid-json' } });
		expect(parseTypeSchema(null)).toMatchObject({ kind: 'err', error: { kind: 'invalid-json' } });
		expect(parseTypeSchema([])).toMatchObject({ kind: 'err', error: { kind: 'invalid-json' } });
	});
	it('rejects missing required keys', () => {
		const { id: _, ...rest } = BOOK;
		expect(parseTypeSchema(rest)).toMatchObject({ kind: 'err', error: { kind: 'missing-required-key', key: 'id' } });
	});
	it('rejects unknown field kinds', () => {
		const raw = { ...BOOK, fields: [{ kind: 'colour', name: 'hue', required: false }] };
		expect(parseTypeSchema(raw)).toMatchObject({ kind: 'err', error: { kind: 'invalid-field-kind', received: 'colour' } });
	});
	it('rejects duplicate field names', () => {
		const raw = { ...BOOK, fields: [{ kind: 'text', name: 'title', required: true }, { kind: 'text', name: 'title', required: false }] };
		expect(parseTypeSchema(raw)).toMatchObject({ kind: 'err', error: { kind: 'duplicate-field-name', name: 'title' } });
	});
	it('rejects title field referencing a missing field', () => {
		const raw = { ...BOOK, titleFieldName: 'nonexistent' };
		expect(parseTypeSchema(raw)).toMatchObject({ kind: 'err', error: { kind: 'title-field-missing' } });
	});
	it('rejects title field referencing a non-text field', () => {
		const raw = { ...BOOK, titleFieldName: 'pages' };
		expect(parseTypeSchema(raw)).toMatchObject({ kind: 'err', error: { kind: 'title-field-not-text' } });
	});
	it('serializes with stable key order', () => {
		const a = serializeTypeSchema(BOOK);
		const b = serializeTypeSchema({ ...BOOK, description: 'Reading log' });
		expect(a.startsWith('{\n  "id"')).toBe(true);
		expect(b.startsWith('{\n  "id"')).toBe(true);
	});
});
