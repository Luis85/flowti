import { describe, it, expect } from 'vitest';
import { validateInstanceValues, renderInstanceContent, resolveInstancePath } from '../../../src/domain/make/instance-ops.js';
import type { TypeSchema, FieldValue } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book',
	name: 'Book',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title', required: true },
		{ kind: 'number', name: 'pages', required: false },
		{ kind: 'checkbox', name: 'read', required: false },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

describe('validateInstanceValues', () => {
	it('produces ordered FieldValue[] for valid input', () => {
		const result = validateInstanceValues(BOOK, { title: 'Dune', pages: 688, read: true });
		expect(result).toEqual({ kind: 'ok', value: [
			{ kind: 'text', value: 'Dune' },
			{ kind: 'number', value: 688 },
			{ kind: 'checkbox', value: true },
		]});
	});
	it('collects all errors', () => {
		const result = validateInstanceValues(BOOK, { pages: 'nope' });
		expect(result.kind).toBe('err');
		if (result.kind === 'err') {
			const kinds = result.error.map((e: { kind: string }) => e.kind);
			expect(kinds).toContain('required-missing'); // title missing
			expect(kinds).toContain('invalid-number');
		}
	});
});

describe('renderInstanceContent', () => {
	it('emits frontmatter + type/type-id stamps', () => {
		const values: readonly FieldValue[] = [
			{ kind: 'text', value: 'Dune' },
			{ kind: 'number', value: 688 },
			{ kind: 'checkbox', value: true },
		];
		const out = renderInstanceContent(BOOK, values);
		expect(out.fullMarkdown).toMatch(/^---\n/);
		expect(out.fullMarkdown).toContain('type: "Book"');
		expect(out.fullMarkdown).toContain('type-id: "book"');
		expect(out.fullMarkdown).toContain('title: "Dune"');
		expect(out.fullMarkdown).toContain('pages: 688');
		expect(out.fullMarkdown).toContain('read: true');
		expect(out.fullMarkdown).toMatch(/\n---\n\n$/);
	});
});

describe('resolveInstancePath', () => {
	const values: readonly FieldValue[] = [
		{ kind: 'text', value: 'Some / Book' },
		{ kind: 'number', value: 0 },
		{ kind: 'checkbox', value: false },
	];
	it('uses the title field (hostile chars stripped, whitespace collapsed)', () => {
		// Input 'Some / Book' → strip '/' → 'Some  Book' → collapse spaces → 'Some Book'.
		expect(resolveInstancePath(BOOK, values, null)).toEqual({ kind: 'ok', value: 'Books/Some Book.md' });
	});
	it('falls back to explicit filename when titleFieldName is null', () => {
		const NOTITLE: TypeSchema = { ...BOOK, titleFieldName: null };
		expect(resolveInstancePath(NOTITLE, values, 'Custom Name')).toEqual({ kind: 'ok', value: 'Books/Custom Name.md' });
	});
	it('returns invalid-filename when title field value is empty after sanitization', () => {
		const bad: readonly FieldValue[] = [{ kind: 'text', value: '///' }, { kind: 'number', value: 0 }, { kind: 'checkbox', value: false }];
		expect(resolveInstancePath(BOOK, bad, null)).toEqual({ kind: 'err', error: 'invalid-filename' });
	});
	it('returns no-title-field-and-no-filename when both missing', () => {
		const NOTITLE: TypeSchema = { ...BOOK, titleFieldName: null };
		expect(resolveInstancePath(NOTITLE, values, null)).toEqual({ kind: 'err', error: 'no-title-field-and-no-filename' });
	});
});
