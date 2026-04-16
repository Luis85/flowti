import { describe, expect, it } from 'vitest';
import { extractFrontmatter } from '../../../src/infrastructure/vault/extract-frontmatter.js';

describe('extractFrontmatter', () => {
	it('extracts flat key-value pairs', () => {
		const content = '---\ntitle: Hello\ntags: test\n---\nBody content';
		const fm = extractFrontmatter(content);
		expect(fm['title']).toBe('Hello');
		expect(fm['tags']).toBe('test');
	});

	it('returns empty object when no frontmatter', () => {
		expect(extractFrontmatter('Just body')).toEqual({});
	});

	it('returns empty object for empty frontmatter block', () => {
		expect(extractFrontmatter('---\n---\nBody')).toEqual({});
	});

	it('handles colons in values (splits on first colon-space only)', () => {
		const content = '---\ntitle: My Project: Phase 1\n---\n';
		expect(extractFrontmatter(content)['title']).toBe('My Project: Phase 1');
	});

	it('trims whitespace from values', () => {
		const content = '---\ntitle:   spaced   \n---\n';
		expect(extractFrontmatter(content)['title']).toBe('spaced');
	});

	it('handles numeric values as strings', () => {
		const content = '---\ncount: 42\n---\n';
		expect(extractFrontmatter(content)['count']).toBe('42');
	});
});
