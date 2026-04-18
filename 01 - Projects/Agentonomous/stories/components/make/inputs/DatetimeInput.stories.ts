import type { Meta, StoryObj } from '@storybook/vue3-vite';
import DatetimeInput from '../../../../src/ui/components/make/inputs/DatetimeInput.vue';

const meta: Meta<typeof DatetimeInput> = {
	title: 'Make/Inputs/DatetimeInput',
	component: DatetimeInput,
	args: { field: { kind: 'datetime', name: 'scheduledAt', required: false }, modelValue: null },
};
export default meta;
type Story = StoryObj<typeof DatetimeInput>;

export const Default: Story = {};
export const Required: Story = { args: { field: { kind: 'datetime', name: 'scheduledAt', required: true } } };
export const Prefilled: Story = { args: { modelValue: new Date(2026, 3, 18, 14, 30) } };
export const WithError: Story = { args: { error: 'Scheduled time is required' } };
export const WithDescription: Story = { args: { field: { kind: 'datetime', name: 'scheduledAt', required: true, description: 'When to run this session' } } };
