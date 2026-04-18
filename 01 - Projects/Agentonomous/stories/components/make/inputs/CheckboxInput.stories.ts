import type { Meta, StoryObj } from '@storybook/vue3-vite';
import CheckboxInput from '../../../../src/ui/components/make/inputs/CheckboxInput.vue';

const meta: Meta<typeof CheckboxInput> = {
	title: 'Make/Inputs/CheckboxInput',
	component: CheckboxInput,
	args: { field: { kind: 'checkbox', name: 'inStock', required: false }, modelValue: false },
};
export default meta;
type Story = StoryObj<typeof CheckboxInput>;

export const Default: Story = {};
export const Required: Story = { args: { field: { kind: 'checkbox', name: 'inStock', required: true } } };
export const Prefilled: Story = { args: { modelValue: true } };
export const WithError: Story = { args: { error: 'Please confirm availability' } };
export const WithDescription: Story = { args: { field: { kind: 'checkbox', name: 'inStock', required: false, description: 'Whether this item is currently in stock' } } };
