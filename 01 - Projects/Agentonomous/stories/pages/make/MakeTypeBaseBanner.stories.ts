import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MakeTypeBaseBanner from '../../../src/ui/pages/make/MakeTypeBaseBanner.vue';

const meta: Meta<typeof MakeTypeBaseBanner> = {
	title: 'Pages/Make/MakeTypeBaseBanner',
	component: MakeTypeBaseBanner,
};
export default meta;
type Story = StoryObj<typeof MakeTypeBaseBanner>;

export const Missing: Story = {
	args: {
		state: 'missing',
		regenerateLoading: false,
		regenerateError: null,
	},
};

export const Stale: Story = {
	args: {
		state: 'stale',
		generatedAt: '2026-04-01T00:00:00.000Z',
		regenerateLoading: false,
		regenerateError: null,
	},
};

export const Regenerating: Story = {
	args: {
		state: 'stale',
		generatedAt: '2026-04-01T00:00:00.000Z',
		regenerateLoading: true,
		regenerateError: null,
	},
};

export const WithError: Story = {
	args: {
		state: 'missing',
		regenerateLoading: false,
		regenerateError: 'Regenerate failed: vault error',
	},
};
