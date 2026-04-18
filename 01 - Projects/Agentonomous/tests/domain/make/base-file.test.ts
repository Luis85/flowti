import { describe, it, expect } from 'vitest';
import { generateBaseYaml } from '../../../src/domain/make/base-file.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book',
	name: 'Book',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title', label: 'Title', required: true },
		{ kind: 'text', name: 'author', required: true },
		{ kind: 'number', name: 'pages', required: false },
		{ kind: 'checkbox', name: 'read', required: false },
		{ kind: 'date', name: 'published', required: false },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

describe('generateBaseYaml', () => {
	it('produces deterministic YAML for a Book schema', () => {
		const yaml = generateBaseYaml(BOOK);
		expect(yaml).toBe([
			'filters:',
			'  and:',
			'    - file.ext == "md"',
			'    - type == "Book"',
			'',
			'formulas: {}',
			'',
			'properties:',
			'  title:',
			'    displayName: "Title"',
			'  author:',
			'    displayName: "author"',
			'  pages:',
			'    displayName: "pages"',
			'  read:',
			'    displayName: "read"',
			'  published:',
			'    displayName: "published"',
			'',
			'views:',
			'  - type: table',
			'    name: "All Book"',
			'    order:',
			'      - file.name',
			'      - title',
			'      - author',
			'      - pages',
			'      - read',
			'      - published',
			'',
		].join('\n'));
	});
	it('escapes double-quotes in names', () => {
		const schema: TypeSchema = { ...BOOK, name: 'Book "Special"' };
		const yaml = generateBaseYaml(schema);
		expect(yaml).toContain('type == "Book \\"Special\\""');
	});
});
