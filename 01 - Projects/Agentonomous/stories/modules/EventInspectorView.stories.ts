import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import { expect, within, userEvent } from 'storybook/test';
import EventInspectorView from '../../src/modules/event-inspector/views/EventInspectorView.vue';
import { useEventInspectorStore } from '../../src/modules/event-inspector/event-inspector-store.js';
import { sampleEvents } from '../__fixtures__/events.js';

const withEvents: Decorator = () => ({
	setup() {
		const store = useEventInspectorStore();
		store.clear();
		for (const event of sampleEvents) {
			store.addEvent(event);
		}
		return {};
	},
	template: '<story />',
});

const meta: Meta<typeof EventInspectorView> = {
	title: 'Modules/EventInspectorView',
	component: EventInspectorView,
};
export default meta;

type Story = StoryObj<typeof EventInspectorView>;

export const Empty: Story = {
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('renders panel header', async () => {
			await expect(canvas.getByTestId('panel-header')).toHaveTextContent('Event Inspector');
		});

		await step('shows empty state message', async () => {
			await expect(canvas.getByTestId('event-empty')).toHaveTextContent('No events captured yet.');
		});

		await step('shows zero event count', async () => {
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('0 event(s)');
		});
	},
};

export const WithEvents: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('shows correct event count', async () => {
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('5 event(s)');
		});

		await step('renders all event items', async () => {
			const items = canvas.getAllByTestId('event-item');
			await expect(items).toHaveLength(5);
		});

		await step('displays channel names', async () => {
			const list = canvas.getByTestId('event-list');
			await expect(list).toHaveTextContent('settings:changed');
			await expect(list).toHaveTextContent('module:ready');
			await expect(list).toHaveTextContent('lifecycle:started');
		});

		await step('hides empty state', async () => {
			await expect(canvas.queryByTestId('event-empty')).toBeNull();
		});
	},
};

export const ClearEvents: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('starts with events', async () => {
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('5 event(s)');
		});

		await step('click clear removes all events', async () => {
			await userEvent.click(canvas.getByTestId('event-clear'));
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('0 event(s)');
			await expect(canvas.getByTestId('event-empty')).toBeVisible();
		});
	},
};

export const FilterInteraction: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('type filter to narrow events', async () => {
			const input = canvas.getByTestId('event-filter');
			await userEvent.type(input, 'settings:changed');
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('2 event(s)');
		});
	},
};
