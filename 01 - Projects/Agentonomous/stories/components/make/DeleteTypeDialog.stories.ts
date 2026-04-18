import type { Meta, StoryObj } from '@storybook/vue3-vite';
import DeleteTypeDialog from '../../../src/ui/components/make/DeleteTypeDialog.vue';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const meta: Meta<typeof DeleteTypeDialog> = {
	title: 'Components/Make/DeleteTypeDialog',
	component: DeleteTypeDialog,
};
export default meta;
type Story = StoryObj<typeof DeleteTypeDialog>;

const baseType: TypeSchema = {
	id: 'book',
	name: 'Book',
	instancesFolder: 'references/books',
	titleFieldName: 'title',
	fields: [],
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z',
	baseFile: { path: 'Make/Bases/Book.md', generatedAt: '2026-01-01T00:00:00Z' },
};

export const Default_HasInstances: Story = {
	args: {
		open: true,
		type: baseType,
		instanceCount: 7,
		isDeleting: false,
	},
};

export const Default_NoInstances: Story = {
	args: {
		open: true,
		type: baseType,
		instanceCount: 0,
		isDeleting: false,
	},
};

export const Checking: Story = {
	args: {
		open: true,
		type: baseType,
		instanceCount: null,
		isDeleting: false,
	},
};

export const NoBaseFile_CheckboxDisabled: Story = {
	args: {
		open: true,
		type: { ...baseType, baseFile: undefined },
		instanceCount: 3,
		isDeleting: false,
	},
};

export const IsDeleting: Story = {
	args: {
		open: true,
		type: baseType,
		instanceCount: 2,
		isDeleting: true,
	},
};
