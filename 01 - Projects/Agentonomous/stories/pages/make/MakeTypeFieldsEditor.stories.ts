import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MakeTypeFieldsEditor from '../../../src/ui/pages/make/MakeTypeFieldsEditor.vue';
import type { Draft } from '../../../src/domain/make/draft-equality.js';
import type { FieldError } from '../../../src/domain/make/errors.js';
import type { Field } from '../../../src/domain/make/type-schema.js';

const meta: Meta<typeof MakeTypeFieldsEditor> = {
	title: 'Pages/Make/MakeTypeFieldsEditor',
	component: MakeTypeFieldsEditor,
};
export default meta;
type Story = StoryObj<typeof MakeTypeFieldsEditor>;

const baseDraft: Draft = {
	name: 'Book',
	description: 'A book reference',
	instancesFolder: 'references/books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title', required: true, label: 'Title' },
		{ kind: 'text', name: 'author', required: true, label: 'Author' },
		{ kind: 'number', name: 'year', required: false, label: 'Year' },
	] as Field[],
};

export const NewMode: Story = {
	args: {
		draft: { ...baseDraft, name: '' },
		mode: 'new',
		isDirty: true,
		isSaving: false,
		serviceError: null,
		hasExistingInstances: false,
		fieldErrors: new Map<string, FieldError[]>(),
		schemaErrors: {},
	},
};

export const EditMode_Pristine: Story = {
	args: {
		draft: baseDraft,
		mode: 'edit',
		isDirty: false,
		isSaving: false,
		serviceError: null,
		hasExistingInstances: false,
		fieldErrors: new Map<string, FieldError[]>(),
		schemaErrors: {},
	},
};

export const EditMode_Dirty: Story = {
	args: {
		draft: { ...baseDraft, name: 'Book (edited)' },
		mode: 'edit',
		isDirty: true,
		isSaving: false,
		serviceError: null,
		hasExistingInstances: true,
		originalFolder: 'references/books',
		fieldErrors: new Map<string, FieldError[]>(),
		schemaErrors: {},
	},
};

export const Saving: Story = {
	args: {
		draft: baseDraft,
		mode: 'edit',
		isDirty: true,
		isSaving: true,
		serviceError: null,
		hasExistingInstances: false,
		fieldErrors: new Map<string, FieldError[]>(),
		schemaErrors: {},
	},
};

export const WithServiceError: Story = {
	args: {
		draft: baseDraft,
		mode: 'edit',
		isDirty: true,
		isSaving: false,
		serviceError: 'Save failed: vault write error',
		hasExistingInstances: false,
		fieldErrors: new Map<string, FieldError[]>(),
		schemaErrors: {},
	},
};

export const WithFieldErrors: Story = {
	args: {
		draft: { ...baseDraft, fields: [{ kind: 'text', name: '', required: false }] as Field[] },
		mode: 'edit',
		isDirty: true,
		isSaving: false,
		serviceError: null,
		hasExistingInstances: false,
		fieldErrors: new Map<string, FieldError[]>([['', [{ kind: 'required-missing', fieldName: '' }]]]),
		schemaErrors: { name: 'Name is required' },
	},
};
