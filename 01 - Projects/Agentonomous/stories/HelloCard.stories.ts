import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect } from 'vitest';
import HelloCard from '../src/ui/components/HelloCard.vue';

const meta: Meta<typeof HelloCard> = {
	title: 'Components/HelloCard',
	component: HelloCard,
	args: { title: 'Hi', message: 'Welcome to Agentonomous.' },
};

export default meta;
type Story = StoryObj<typeof HelloCard>;

export const Default: Story = {};

export const LongMessage: Story = {
	args: {
		title: 'Introduction',
		message: 'Agentonomous is an autonomous agents sandbox that runs entirely inside your Obsidian vault. This is a longer message to validate wrapping behavior.',
	},
};

export const RendersTitleAndMessage: Story = {
	args: { title: 'Interaction test', message: 'Visible to the user.' },
	play: async ({ canvasElement }) => {
		await expect(canvasElement.textContent ?? '').toContain('Interaction test');
		await expect(canvasElement.textContent ?? '').toContain('Visible to the user.');
	},
};
