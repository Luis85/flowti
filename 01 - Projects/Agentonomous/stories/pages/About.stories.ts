import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { createPinia } from 'pinia';
import { expect } from 'vitest';
import About from '../../src/ui/pages/About.vue';
import { AboutPage } from '../../src/ui/pages/About.po.js';
import { withRouter } from '../decorators/with-router.js';

const meta: Meta<typeof About> = {
	title: 'Pages/About',
	component: About,
	decorators: [withRouter],
};
export default meta;

type Story = StoryObj<typeof About>;

export const Default: Story = {
	render: () => ({
		components: { About },
		template: '<About />',
		global: { plugins: [createPinia()] },
	}),
};

export const RendersTitle: Story = {
	render: () => ({
		components: { About },
		template: '<About />',
		global: { plugins: [createPinia()] },
	}),
	play: async ({ canvasElement }) => {
		const page = new AboutPage(canvasElement as HTMLElement);
		expect(page.title).toBe('Agentonomous');
		expect(page.homeLink).not.toBeNull();
	},
};
