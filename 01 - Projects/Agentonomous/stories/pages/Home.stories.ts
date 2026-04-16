import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { createPinia } from 'pinia';
import { expect } from 'vitest';
import Home from '../../src/ui/pages/Home.vue';
import { HomePage } from '../../src/ui/pages/Home.po.js';
import { withRouter } from '../decorators/with-router.js';

const meta: Meta<typeof Home> = {
	title: 'Pages/Home',
	component: Home,
	decorators: [withRouter],
};
export default meta;

type Story = StoryObj<typeof Home>;

export const Default: Story = {
	render: () => ({
		components: { Home },
		template: '<Home />',
		global: { plugins: [createPinia()] },
	}),
};

export const RendersGreeting: Story = {
	render: () => ({
		components: { Home },
		template: '<Home />',
		global: { plugins: [createPinia()] },
	}),
	play: async ({ canvasElement }) => {
		const page = new HomePage(canvasElement as HTMLElement);
		expect(page.greeting).toContain('Agentonomous');
		expect(page.aboutLink).not.toBeNull();
	},
};
