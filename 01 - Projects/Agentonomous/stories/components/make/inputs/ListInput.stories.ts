import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ListInput from '../../../../src/ui/components/make/inputs/ListInput.vue';

const meta: Meta<typeof ListInput> = {
	title: 'Make/Inputs/ListInput',
	component: ListInput,
	args: { field: { kind: 'list', name: 'tags', required: false }, modelValue: [] },
};
export default meta;
type Story = StoryObj<typeof ListInput>;

export const Default: Story = {};
export const Required: Story = { args: { field: { kind: 'list', name: 'tags', required: true } } };
export const Prefilled: Story = { args: { modelValue: ['fiction', 'sci-fi', 'classic'] } };
export const WithError: Story = { args: { error: 'At least one tag is required' } };
export const WithDescription: Story = { args: { field: { kind: 'list', name: 'tags', required: true, description: 'Press Enter or comma to add a tag' } } };
