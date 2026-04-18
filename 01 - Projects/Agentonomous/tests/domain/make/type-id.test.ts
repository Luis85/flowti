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
