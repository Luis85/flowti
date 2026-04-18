import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MakeTypeSchemaDetails from '../../../src/ui/pages/make/MakeTypeSchemaDetails.vue';

const meta: Meta<typeof MakeTypeSchemaDetails> = {
	title: 'Pages/Make/MakeTypeSchemaDetails',
	component: MakeTypeSchemaDetails,
};
export default meta;
type Story = StoryObj<typeof MakeTypeSchemaDetails>;

const baseDraft = {
	name: 'Book',
	description: 'A book reference',
	instancesFolder: 'references/books',
	titleFieldName: null,
};

export const NewMode: Story = {
	args: {
		draft: baseDraft,
		fieldNames: ['title', 'author'],
		errors: {},
		hasExistingInstances: false,
		mode: 'new',
	},
};

export const EditMode_Collapsed: Story = {
	args: {
		draft: baseDraft,
		fieldNames: ['title', 'author'],
		errors: {},
		hasExistingInstances: false,
		mode: 'edit',
	},
};

export const EditMode_WithErrors: Story = {
	args: {
		draft: { ...baseDraft, name: '', instancesFolder: '' },
		fieldNames: [],
		errors: { name: 'Name is required', folder: 'Folder path is required' },
		hasExistingInstances: false,
		mode: 'edit',
	},
};

export const EditMode_FolderOrphanWarning: Story = {
	args: {
		draft: { ...baseDraft, instancesFolder: 'references/books-new' },
		fieldNames: ['title'],
		errors: {},
		hasExistingInstances: true,
		originalFolder: 'references/books',
		mode: 'edit',
	},
};
