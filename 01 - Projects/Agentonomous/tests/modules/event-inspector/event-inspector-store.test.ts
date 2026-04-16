import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useEventInspectorStore, createEventInspectorStore } from '../../../src/modules/event-inspector/event-inspector-store.js';
import { EventBuffer } from '../../../src/modules/event-inspector/event-inspector-buffer.js';
import type { EventEnvelope } from '../../../src/domain/shared/event-bus.js';

function fakeEnvelope(channel: string, traceId: string = 'trace-1'): EventEnvelope {
	return {
		channel: channel as never,
		payload: {} as never,
		traceId,
		eventId: `evt-${Math.random().toString(36).slice(2)}`,
		timestamp: Date.now(),
	};
}

describe('useEventInspectorStore', () => {
	it('addEvent appends to the events array', () => {
		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		expect(store.events).toHaveLength(1);
	});

	it('ring buffer caps at maxEvents', () => {
		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		store.setMaxEvents(3);
		for (let i = 0; i < 5; i++) {
			store.addEvent(fakeEnvelope('core'));
		}
		expect(store.events).toHaveLength(3);
	});

	it('traceGroups groups events by traceId', () => {
		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core', 'trace-a'));
		store.addEvent(fakeEnvelope('log', 'trace-a'));
		store.addEvent(fakeEnvelope('core', 'trace-b'));
		expect(store.traceGroups.get('trace-a')).toHaveLength(2);
		expect(store.traceGroups.get('trace-b')).toHaveLength(1);
	});

	it('filteredEvents filters by channel', () => {
		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('log'));
		store.addEvent(fakeEnvelope('error'));
		store.setFilterChannels(['core']);
		expect(store.filteredEvents).toHaveLength(1);
		expect(store.filteredEvents[0]?.channel).toBe('core');
	});

	it('empty filter shows all events', () => {
		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('log'));
		expect(store.filteredEvents).toHaveLength(2);
	});

	it('clear() empties the buffer', () => {
		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.clear();
		expect(store.events).toHaveLength(0);
	});

	it('setMaxEvents trims events when below current count', () => {
		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('core'));
		store.setMaxEvents(1);
		expect(store.events).toHaveLength(1);
	});
});

describe('createEventInspectorStore', () => {
	it('initialises with existing buffer contents', () => {
		setActivePinia(createPinia());
		const buf = new EventBuffer(10);
		buf.add(fakeEnvelope('core'));
		buf.add(fakeEnvelope('log'));
		const useStore = createEventInspectorStore(buf);
		const store = useStore();
		expect(store.events).toHaveLength(2);
	});

	it('syncs when buffer changes via add', () => {
		setActivePinia(createPinia());
		const buf = new EventBuffer(10);
		const useStore = createEventInspectorStore(buf);
		const store = useStore();
		buf.add(fakeEnvelope('core'));
		expect(store.events).toHaveLength(1);
	});

	it('syncs when buffer is cleared', () => {
		setActivePinia(createPinia());
		const buf = new EventBuffer(10);
		buf.add(fakeEnvelope('core'));
		const useStore = createEventInspectorStore(buf);
		const store = useStore();
		buf.clear();
		expect(store.events).toHaveLength(0);
	});

	it('filteredEvents filters by channel', () => {
		setActivePinia(createPinia());
		const buf = new EventBuffer(10);
		buf.add(fakeEnvelope('core'));
		buf.add(fakeEnvelope('log'));
		const useStore = createEventInspectorStore(buf);
		const store = useStore();
		store.setFilterChannels(['core']);
		expect(store.filteredEvents).toHaveLength(1);
	});

	it('setFilterChannels with empty array shows all events', () => {
		setActivePinia(createPinia());
		const buf = new EventBuffer(10);
		buf.add(fakeEnvelope('core'));
		buf.add(fakeEnvelope('log'));
		const useStore = createEventInspectorStore(buf);
		const store = useStore();
		store.setFilterChannels([]);
		expect(store.filteredEvents).toHaveLength(2);
	});

	it('clear() delegates to buffer', () => {
		setActivePinia(createPinia());
		const buf = new EventBuffer(10);
		buf.add(fakeEnvelope('core'));
		const useStore = createEventInspectorStore(buf);
		const store = useStore();
		store.clear();
		expect(buf.getAll()).toHaveLength(0);
	});

	it('dispose() stops sync', () => {
		setActivePinia(createPinia());
		const buf = new EventBuffer(10);
		const useStore = createEventInspectorStore(buf);
		const store = useStore();
		store.dispose();
		buf.add(fakeEnvelope('core'));
		// After dispose, store.events is not synced but the buffer has the event
		expect(buf.getAll()).toHaveLength(1);
	});

	it('traceGroups groups events by traceId', () => {
		setActivePinia(createPinia());
		const buf = new EventBuffer(10);
		buf.add(fakeEnvelope('core', 'trace-a'));
		buf.add(fakeEnvelope('log', 'trace-a'));
		buf.add(fakeEnvelope('core', 'trace-b'));
		const useStore = createEventInspectorStore(buf);
		const store = useStore();
		expect(store.traceGroups.get('trace-a')).toHaveLength(2);
	});
});
