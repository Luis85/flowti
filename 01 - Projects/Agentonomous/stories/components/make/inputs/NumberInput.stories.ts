import type { Meta, StoryObj } from '@storybook/vue3-vite';
import NumberInput from '../../../../src/ui/components/make/inputs/NumberInput.vue';

const meta: Meta<typeof NumberInput> = {
	title: 'Make/Inputs/NumberInput',
	component: NumberInput,
	args: { field: { kind: 'number', name: 'pages', required: false }, modelValue: null },
};
export default meta;
type Story = StoryObj<typeof NumberInput>;

export const Default: Story = {};
export const Required: Story = { args: { field: { kind: 'number', name: 'pages', required: true } } };
export const Prefilled: Story = { args: { modelValue: 412 } };
export const WithError: Story = { args: { error: 'Pages must be greater than zero' } };
export const WithDescription: Story = { args: { field: { kind: 'number', name: 'pages', required: true, description: 'Total page count' } } };
