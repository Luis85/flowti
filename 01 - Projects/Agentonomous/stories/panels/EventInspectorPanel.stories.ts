import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import { expect, within, userEvent, waitFor } from 'storybook/test';
import EventInspectorPanel from '../../src/ui/panels/EventInspectorPanel.vue';
import { useEventInspectorStore } from '../../src/ui/stores/event-inspector-store.js';
import type { EventEnvelope } from '../../src/domain/shared/event-bus.js';
import { sampleEvents } from '../__fixtures__/events.js';

const withEvents: Decorator = () => ({
	setup() {
		const store = useEventInspectorStore();
		store.clear();
		store.setFilterChannels([]);
		store.setSearchQuery('');
		store.setGroupByTrace(false);
		if (store.paused) store.togglePause();
		for (const event of sampleEvents) {
			store.addEvent(event);
		}
		return {};
	},
	template: '<story />',
});

const meta: Meta<typeof EventInspectorPanel> = {
	title: 'Panels/EventInspectorPanel',
	component: EventInspectorPanel,
};
export default meta;

type Story = StoryObj<typeof EventInspectorPanel>;

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

export const ChannelFilter: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('type channel filter to narrow events', async () => {
			const input = canvas.getByTestId('event-filter');
			await userEvent.type(input, 'settings:changed');
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('2 event(s)');
		});

		await step('clearing the filter restores full list', async () => {
			const input = canvas.getByTestId('event-filter');
			await userEvent.clear(input);
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('5 event(s)');
		});
	},
};

export const SearchInteraction: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('search narrows to events whose payload matches', async () => {
			const search = canvas.getByTestId('event-search');
			await userEvent.type(search, 'theme');
			// Only one sample event's payload is `{ key: 'theme' }`
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('1 event(s)');
		});

		await step('search also matches against the channel name', async () => {
			const search = canvas.getByTestId('event-search');
			await userEvent.clear(search);
			await userEvent.type(search, 'lifecycle');
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('1 event(s)');
		});

		await step('empty search restores the full list', async () => {
			const search = canvas.getByTestId('event-search');
			await userEvent.clear(search);
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('5 event(s)');
		});
	},
};

export const PauseResume: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const store = useEventInspectorStore();

		await step('pause button shows "Pause" initially', async () => {
			await expect(canvas.getByTestId('event-pause')).toHaveTextContent('Pause');
		});

		await step('clicking pause flips the label', async () => {
			await userEvent.click(canvas.getByTestId('event-pause'));
			await expect(canvas.getByTestId('event-pause')).toHaveTextContent('Resume');
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('(paused)');
		});

		await step('events added while paused show as a +N badge, not the count', async () => {
			const newEvent: EventEnvelope = {
				channel: 'log' as never,
				payload: { message: 'arrived while paused' } as never,
				traceId: 'p1',
				eventId: 'evt-paused-1',
				timestamp: Date.now(),
			};
			store.addEvent(newEvent);
			// Reactivity + render is microtask-driven; wait for the badge to appear.
			await waitFor(() => expect(canvas.getByTestId('event-pause')).toHaveTextContent('+1'));
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('5 event(s)');
		});

		await step('resume flushes pending events into the visible list', async () => {
			await userEvent.click(canvas.getByTestId('event-pause'));
			await waitFor(() => expect(canvas.getByTestId('event-pause')).toHaveTextContent('Pause'));
			await expect(canvas.getByTestId('event-count')).toHaveTextContent('6 event(s)');
		});
	},
};

export const GroupByTrace: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('flat list is rendered by default', async () => {
			await expect(canvas.getByTestId('event-list')).toBeVisible();
			await expect(canvas.queryByTestId('event-trace-list')).toBeNull();
		});

		await step('toggling group-by-trace swaps to the grouped list', async () => {
			await userEvent.click(canvas.getByTestId('event-group-toggle'));
			await expect(canvas.getByTestId('event-trace-list')).toBeVisible();
			await expect(canvas.queryByTestId('event-list')).toBeNull();
		});

		await step('trace groups are rendered', async () => {
			const groups = canvas.getAllByTestId('event-trace-group');
			// The fixture has 4 distinct traceIds
			await expect(groups.length).toBeGreaterThanOrEqual(4);
		});

		await step('toggling off returns to the flat list', async () => {
			await userEvent.click(canvas.getByTestId('event-group-toggle'));
			await expect(canvas.getByTestId('event-list')).toBeVisible();
			await expect(canvas.queryByTestId('event-trace-list')).toBeNull();
		});
	},
};

export const ExpandRow: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('rows are collapsed initially — no detail panel', async () => {
			await expect(canvas.queryByTestId('event-detail')).toBeNull();
		});

		await step('clicking a row expands it to reveal the detail panel', async () => {
			const rows = canvas.getAllByTestId('event-row');
			const firstRow = rows[0];
			if (firstRow === undefined) throw new Error('no rows rendered');
			await userEvent.click(firstRow);
			const detail = canvas.getByTestId('event-detail');
			await expect(detail).toBeVisible();
			// Detail must include eventId, traceId, and payload sections
			await expect(detail).toHaveTextContent('eventId');
			await expect(detail).toHaveTextContent('traceId');
			await expect(detail).toHaveTextContent('payload');
		});

		await step('clicking the same row again collapses it', async () => {
			const rows = canvas.getAllByTestId('event-row');
			const firstRow = rows[0];
			if (firstRow === undefined) throw new Error('no rows rendered');
			await userEvent.click(firstRow);
			await expect(canvas.queryByTestId('event-detail')).toBeNull();
		});
	},
};

export const KeyboardExpand: Story = {
	decorators: [withEvents],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('focusing a row and pressing Enter expands it', async () => {
			const rows = canvas.getAllByTestId('event-row');
			const firstRow = rows[0];
			if (firstRow === undefined) throw new Error('no rows rendered');
			firstRow.focus();
			await userEvent.keyboard('{Enter}');
			await expect(canvas.getByTestId('event-detail')).toBeVisible();
		});

		await step('pressing Space on a focused row toggles it back', async () => {
			const rows = canvas.getAllByTestId('event-row');
			const firstRow = rows[0];
			if (firstRow === undefined) throw new Error('no rows rendered');
			firstRow.focus();
			await userEvent.keyboard(' ');
			await expect(canvas.queryByTestId('event-detail')).toBeNull();
		});
	},
};
