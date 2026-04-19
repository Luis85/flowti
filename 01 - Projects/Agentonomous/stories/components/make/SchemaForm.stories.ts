import type { Meta, StoryObj } from '@storybook/vue3-vite';
import SchemaForm from '../../../src/ui/components/make/SchemaForm.vue';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { FieldError } from '../../../src/domain/make/errors.js';

const meta: Meta<typeof SchemaForm> = {
	title: 'Components/Make/SchemaForm',
	component: SchemaForm,
};
export default meta;
type Story = StoryObj<typeof SchemaForm>;

const EMPTY_SCHEMA: TypeSchema = {
	id: 'empty',
	name: 'Empty',
	instancesFolder: 'Empty',
	titleFieldName: null,
	fields: [],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

const BOOK_SCHEMA: TypeSchema = {
	id: 'book',
	name: 'Book',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text',   name: 'title',  required: true,  label: 'Title' },
		{ kind: 'text',   name: 'author', required: false, label: 'Author' },
		{ kind: 'number', name: 'pages',  required: false, label: 'Pages' },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

const NOTE_SCHEMA: TypeSchema = {
	id: 'note',
	name: 'Note',
	instancesFolder: 'Notes',
	titleFieldName: null,
	fields: [
		{ kind: 'text',     name: 'body',   required: false, label: 'Body' },
		{ kind: 'list',     name: 'tags',   required: false, label: 'Tags' },
		{ kind: 'checkbox', name: 'pinned', required: false, label: 'Pinned' },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

const ERRORS: FieldError[] = [
	{ kind: 'invalid-text',   fieldName: 'author' },
	{ kind: 'invalid-number', fieldName: 'pages' },
];

export const Empty: Story = {
	args: { schema: EMPTY_SCHEMA },
};

export const WithTitleField: Story = {
	args: { schema: BOOK_SCHEMA },
};

export const ExplicitFilename: Story = {
	args: { schema: NOTE_SCHEMA },
};

export const WithErrors: Story = {
	args: { schema: BOOK_SCHEMA, serverErrors: ERRORS },
};

export const Submitting: Story = {
	args: { schema: BOOK_SCHEMA, submitting: true },
};
