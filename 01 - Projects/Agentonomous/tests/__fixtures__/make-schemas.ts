import type { TypeSchema } from '../../src/domain/make/type-schema.js';

export const BOOK_SCHEMA_WITH_TITLE: TypeSchema = {
	id: 'book',
	name: 'Book',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title',  required: true },
		{ kind: 'text', name: 'author', required: false },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

export const BOOK_SCHEMA_WITH_REQUIRED: TypeSchema = {
	id: 'book',
	name: 'Book',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title',  required: true },
		{ kind: 'text', name: 'author', required: true },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

export const SCHEMA_WITH_ALL_KINDS: TypeSchema = {
	id: 'kitchen-sink',
	name: 'Kitchen Sink',
	instancesFolder: 'KitchenSink',
	titleFieldName: null,
	fields: [
		{ kind: 'text',     name: 'note',     required: false },
		{ kind: 'list',     name: 'tags',     required: false },
		{ kind: 'number',   name: 'rating',   required: false },
		{ kind: 'checkbox', name: 'archived', required: false },
		{ kind: 'date',     name: 'due',      required: false },
		{ kind: 'datetime', name: 'seenAt',   required: false },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};
