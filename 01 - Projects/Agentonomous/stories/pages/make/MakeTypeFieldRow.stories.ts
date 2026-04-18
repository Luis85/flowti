import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MakeTypeFieldRow from '../../../src/ui/pages/make/MakeTypeFieldRow.vue';
import type { FieldError } from '../../../src/domain/make/errors.js';

const meta: Meta<typeof MakeTypeFieldRow> = {
	title: 'Pages/Make/MakeTypeFieldRow',
	component: MakeTypeFieldRow,
};
export default meta;
type Story = StoryObj<typeof MakeTypeFieldRow>;

export const Default: Story = {
	args: {
		field: { kind: 'text', name: 'title', required: false },
		index: 0,
		isFirst: false,
		isLast: false,
		isOnly: false,
		isTitleField: false,
		errors: [] as FieldError[],
	},
};

export const TitleField: Story = {
	args: {
		field: { kind: 'text', name: 'title', required: true, label: 'Title', description: 'The main title' },
		index: 0,
		isFirst: true,
		isLast: false,
		isOnly: false,
		isTitleField: true,
		errors: [] as FieldError[],
	},
};

export const WithError: Story = {
	args: {
		field: { kind: 'text', name: 'slug', required: true },
		index: 1,
		isFirst: false,
		isLast: false,
		isOnly: false,
		isTitleField: false,
		errors: [{ kind: 'required-missing', fieldName: 'slug' }] as FieldError[],
	},
};

export const OnlyField_RemoveDisabled: Story = {
	args: {
		field: { kind: 'text', name: 'title', required: false },
		index: 0,
		isFirst: true,
		isLast: true,
		isOnly: true,
		isTitleField: false,
		errors: [] as FieldError[],
	},
};

export const FirstField_MoveUpDisabled: Story = {
	args: {
		field: { kind: 'number', name: 'year', required: false },
		index: 0,
		isFirst: true,
		isLast: false,
		isOnly: false,
		isTitleField: false,
		errors: [] as FieldError[],
	},
};

export const LastField_MoveDownDisabled: Story = {
	args: {
		field: { kind: 'checkbox', name: 'published', required: false },
		index: 2,
		isFirst: false,
		isLast: true,
		isOnly: false,
		isTitleField: false,
		errors: [] as FieldError[],
	},
};
