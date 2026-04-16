import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useEventInspectorStore } from '../../../src/modules/event-inspector/event-inspector-store.js';
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
});
