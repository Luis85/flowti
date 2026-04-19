import { describe, it, expect } from 'vitest';
import { slugifyTypeName, uniqueTypeId } from '../../../src/domain/make/type-id.js';

describe('slugifyTypeName', () => {
	it('kebab-cases simple names', () => {
		expect(slugifyTypeName('Book')).toBe('book');
		expect(slugifyTypeName('My Custom Type')).toBe('my-custom-type');
	});
	it('strips diacritics and unicode', () => {
		expect(slugifyTypeName('Café Récipé')).toBe('cafe-recipe');
	});
	it('collapses non-alphanumeric to single dashes', () => {
		expect(slugifyTypeName('a!b?c')).toBe('a-b-c');
	});
	it('trims edge dashes', () => {
		expect(slugifyTypeName('!Hello!')).toBe('hello');
	});
	it('returns a fallback for empty-after-slug input', () => {
		expect(slugifyTypeName('!!!')).toBe('type');
	});
});

describe('uniqueTypeId', () => {
	it('returns the base slug when not taken', () => {
		expect(uniqueTypeId('Book', new Set())).toBe('book');
	});
	it('appends a suffix on collision', () => {
		expect(uniqueTypeId('Book', new Set(['book']))).toBe('book-2');
		expect(uniqueTypeId('Book', new Set(['book', 'book-2']))).toBe('book-3');
	});
});

describe('slugifyTypeName cross-platform edge cases', () => {
	it.each([
		['emoji-only',     '📚',            'type'],
		['CJK-only',       '書籍',          'type'],
		['cyrillic-only',  'Книга',         'type'],
		['mixed latin + emoji', '📚 Library',  'library'],
		['mixed diacritics',    'Jürgen Müller', 'jurgen-muller'],
		['trailing punctuation','Book!!!',      'book'],
		['consecutive spaces',  'My   Type',    'my-type'],
		['underscores',         'my_custom_type', 'my-custom-type'],
		['numbers preserved',   'v2 Books',     'v2-books'],
	])('slugifies %s: %j → %j', (_label, input, expected) => {
		expect(slugifyTypeName(input)).toBe(expected);
	});

	it('case-insensitive slugs collide (Book and book produce the same id)', () => {
		// This is load-bearing for duplicate-name detection across case variants —
		// updateType's duplicate-name check compares toLowerCase(), matching the slug.
		expect(slugifyTypeName('Book')).toBe(slugifyTypeName('book'));
		expect(slugifyTypeName('BOOK')).toBe(slugifyTypeName('book'));
	});

	it('case-only variations collapse identically after NFKD + lowercase', () => {
		expect(slugifyTypeName('Café')).toBe(slugifyTypeName('CAFÉ'));
		expect(slugifyTypeName('café')).toBe('cafe');
	});
});
