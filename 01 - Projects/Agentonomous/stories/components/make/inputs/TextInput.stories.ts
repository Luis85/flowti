import type { Meta, StoryObj } from '@storybook/vue3-vite';
import TextInput from '../../../../src/ui/components/make/inputs/TextInput.vue';

const meta: Meta<typeof TextInput> = {
	title: 'Make/Inputs/TextInput',
	component: TextInput,
	args: { field: { kind: 'text', name: 'title', required: false }, modelValue: '' },
};
export default meta;
type Story = StoryObj<typeof TextInput>;

export const Default: Story = {};
export const Required: Story = { args: { field: { kind: 'text', name: 'title', required: true } } };
export const Prefilled: Story = { args: { modelValue: 'Dune' } };
export const WithError: Story = { args: { error: 'Title is required' } };
export const WithDescription: Story = { args: { field: { kind: 'text', name: 'title', required: true, description: 'The book\'s display title' } } };
