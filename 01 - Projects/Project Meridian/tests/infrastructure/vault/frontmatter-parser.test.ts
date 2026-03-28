import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../../../src/infrastructure/vault/frontmatter-parser.js';

describe('parseFrontmatter', () => {
	it('parses valid YAML frontmatter from markdown', () => {
		const md = '---\nid: agent-elena\nname: Elena\n---\nBody text here.';
		const result = parseFrontmatter(md);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe('agent-elena');
			expect(result.value.name).toBe('Elena');
		}
	});

	it('returns error for missing frontmatter delimiters', () => {
		const result = parseFrontmatter('No frontmatter here.');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('FRONTMATTER_MISSING');
	});

	it('returns error for malformed YAML', () => {
		const result = parseFrontmatter('---\n[unclosed: {bracket\n---\n');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('YAML_PARSE_ERROR');
	});

	it('handles empty frontmatter', () => {
		const result = parseFrontmatter('---\n---\nBody only.');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toEqual({});
	});

	it('handles CRLF line endings', () => {
		const md = '---\r\nid: agent-crlf\r\nname: CRLF Test\r\n---\r\nBody.';
		const result = parseFrontmatter(md);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe('agent-crlf');
		}
	});

	it('handles frontmatter with nested objects', () => {
		const md = '---\nattributes:\n  ST: 10\n  DX: 12\n---\n';
		const result = parseFrontmatter(md);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const attrs = result.value.attributes as Record<string, number>;
			expect(attrs.ST).toBe(10);
			expect(attrs.DX).toBe(12);
		}
	});
});
