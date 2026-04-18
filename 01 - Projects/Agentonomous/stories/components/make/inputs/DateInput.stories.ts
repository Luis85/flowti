import type { Meta, StoryObj } from '@storybook/vue3-vite';
import DateInput from '../../../../src/ui/components/make/inputs/DateInput.vue';

const meta: Meta<typeof DateInput> = {
	title: 'Make/Inputs/DateInput',
	component: DateInput,
	args: { field: { kind: 'date', name: 'releaseDate', required: false }, modelValue: null },
};
export default meta;
type Story = StoryObj<typeof DateInput>;

export const Default: Story = {};
export const Required: Story = { args: { field: { kind: 'date', name: 'releaseDate', required: true } } };
export const Prefilled: Story = { args: { modelValue: new Date(1965, 7, 1) } };
export const WithError: Story = { args: { error: 'Release date is required' } };
export const WithDescription: Story = { args: { field: { kind: 'date', name: 'releaseDate', required: true, description: 'Original publication date' } } };
