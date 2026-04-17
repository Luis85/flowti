import { describe, expect, it, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useEventInspectorStore } from '../../../src/ui/stores/event-inspector-store.js';
import type { EventEnvelope } from '../../../src/domain/shared/event-bus.js';

function fakeEnvelope(channel: string, traceId: string = 'trace-1', payload: unknown = {}): EventEnvelope {
	return {
		channel: channel as never,
		payload: payload as never,
		traceId,
		eventId: `evt-${Math.random().toString(36).slice(2)}`,
		timestamp: Date.now(),
	};
}

describe('useEventInspectorStore', () => {
	beforeEach(() => {
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

describe('useEventInspectorStore — search', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('filters by substring match against summary', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('log', 't1', { message: 'hello world' }));
		store.addEvent(fakeEnvelope('log', 't2', { message: 'nothing here' }));
		store.setSearchQuery('hello');
		expect(store.filteredEvents).toHaveLength(1);
	});

	it('matches against the channel name', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('settings'));
		store.setSearchQuery('sett');
		expect(store.filteredEvents).toHaveLength(1);
		expect(String(store.filteredEvents[0]?.channel)).toBe('settings');
	});

	it('matches against payload field values', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('x', 't1', { level: 'info', foo: 'alpha' }));
		store.addEvent(fakeEnvelope('x', 't2', { level: 'info', foo: 'beta' }));
		store.setSearchQuery('alpha');
		expect(store.filteredEvents).toHaveLength(1);
	});

	it('empty query returns everything', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('log'));
		store.setSearchQuery('');
		expect(store.filteredEvents).toHaveLength(2);
	});

	it('search composes with channel filter', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('log', 't1', { message: 'hello' }));
		store.addEvent(fakeEnvelope('core', 't2', { message: 'hello' }));
		store.setSearchQuery('hello');
		store.setFilterChannels(['core']);
		expect(store.filteredEvents).toHaveLength(1);
		expect(String(store.filteredEvents[0]?.channel)).toBe('core');
	});
});

describe('useEventInspectorStore — pause / resume', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('paused starts false', () => {
		const store = useEventInspectorStore();
		expect(store.paused).toBe(false);
	});

	it('togglePause flips the flag', () => {
		const store = useEventInspectorStore();
		store.togglePause();
		expect(store.paused).toBe(true);
		store.togglePause();
		expect(store.paused).toBe(false);
	});

	it('addEvent while paused goes to pending, not events', () => {
		const store = useEventInspectorStore();
		store.togglePause();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('log'));
		expect(store.events).toHaveLength(0);
		expect(store.pendingCount).toBe(2);
	});

	it('resume flushes pending into events', () => {
		const store = useEventInspectorStore();
		store.togglePause();
		store.addEvent(fakeEnvelope('core'));
		store.addEvent(fakeEnvelope('log'));
		store.togglePause();
		expect(store.events).toHaveLength(2);
		expect(store.pendingCount).toBe(0);
	});

	it('clear() drops pending as well', () => {
		const store = useEventInspectorStore();
		store.togglePause();
		store.addEvent(fakeEnvelope('core'));
		store.clear();
		expect(store.pendingCount).toBe(0);
	});
});

describe('useEventInspectorStore — trace grouping', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('filteredTraceGroups returns only groups with visible events', () => {
		const store = useEventInspectorStore();
		store.addEvent(fakeEnvelope('core', 'trace-a'));
		store.addEvent(fakeEnvelope('log', 'trace-a'));
		store.addEvent(fakeEnvelope('settings', 'trace-b'));
		store.setFilterChannels(['core', 'log']);
		const groups = store.filteredTraceGroups;
		expect(groups.map(([id]) => id)).toEqual(['trace-a']);
		expect(groups[0]?.[1]).toHaveLength(2);
	});

	it('setGroupByTrace flips the toggle', () => {
		const store = useEventInspectorStore();
		expect(store.groupByTrace).toBe(false);
		store.setGroupByTrace(true);
		expect(store.groupByTrace).toBe(true);
	});
});
