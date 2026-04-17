import { describe, expect, it, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useEventInspectorStore, pushEvent, clearPending, setMaxBufferSize } from '../../../src/modules/event-inspector/event-inspector-store.js';
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
	beforeEach(() => {
		clearPending();
		setActivePinia(createPinia());
	});

	it('addEvent appends to the events array', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		expect(store.events).toHaveLength(1);
	});

	it('ring buffer caps at maxEvents', () => {
		const store = useEventInspectorStore();
		store.setMaxEvents(3);
		for (let i = 0; i < 5; i++) {
			store.addEvent(fakeEnvelope('core'));
		}
		expect(store.events).toHaveLength(3);
	});

	it('traceGroups groups events by traceId', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core', 'trace-a'));
		store.addEvent(fakeEnvelope('log', 'trace-a'));
		store.addEvent(fakeEnvelope('core', 'trace-b'));
		expect(store.traceGroups.get('trace-a')).toHaveLength(2);
		expect(store.traceGroups.get('trace-b')).toHaveLength(1);
	});

	it('filteredEvents filters by channel', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('log'));
		store.addEvent(fakeEnvelope('error'));
		store.setFilterChannels(['core']);
		expect(store.filteredEvents).toHaveLength(1);
		expect(store.filteredEvents[0]?.channel).toBe('core');
	});

	it('empty filter shows all events', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('log'));
		expect(store.filteredEvents).toHaveLength(2);
	});

	it('clear() empties events', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.clear();
		expect(store.events).toHaveLength(0);
	});

	it('setMaxEvents trims events when below current count', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('core'));
		store.setMaxEvents(1);
		expect(store.events).toHaveLength(1);
	});
});

describe('pushEvent (pre-mount buffer)', () => {
	beforeEach(() => {
		clearPending();
	});

	it('buffers events before store is created', () => {
		pushEvent(fakeEnvelope('core'));
		pushEvent(fakeEnvelope('log'));

		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		expect(store.events).toHaveLength(2);
	});

	it('respects max buffer size', () => {
		setMaxBufferSize(3);
		for (let i = 0; i < 5; i++) {
			pushEvent(fakeEnvelope('core'));
		}

		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		expect(store.events).toHaveLength(3);
	});

	it('clearPending() empties the buffer', () => {
		pushEvent(fakeEnvelope('core'));
		clearPending();

		setActivePinia(createPinia());
		const store = useEventInspectorStore();
		expect(store.events).toHaveLength(0);
	});
});
