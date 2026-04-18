import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import HelloCard from '../../src/ui/components/HelloCard.vue';

const meta: Meta<typeof HelloCard> = {
	title: 'Components/HelloCard',
	component: HelloCard,
	args: { title: 'Hi', message: 'Welcome to Agentonomous.' },
};

export default meta;
type Story = StoryObj<typeof HelloCard>;

export const Default: Story = {
	parameters: {
		docs: {
			description: {
				story: 'Baseline rendering with the meta-level `title` / `message` args. Use this as the visual reference for layout and spacing.',
			},
		},
	},
};

export const LongMessage: Story = {
	args: {
		title: 'Introduction',
		message: 'Agentonomous is an autonomous agents sandbox that runs entirely inside your Obsidian vault. This is a longer message to validate wrapping behavior.',
	},
};

export const RendersContent: Story = {
	args: { title: 'Test', message: 'Hello' },
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('displays title and message from props', async () => {
			await expect(canvas.getByTestId('card-title')).toHaveTextContent('Test');
			await expect(canvas.getByTestId('card-message')).toHaveTextContent('Hello');
		});
	},
};
