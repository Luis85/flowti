import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/infrastructure/event-bus.js';
import type { GameEvent } from '../../src/domain/core/events.js';

describe('EventBus', () => {
	it('emits and receives a typed event', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on('TestEvent', handler);

		const event: GameEvent = {
			type: 'TestEvent',
			tick: 1,
			wallClock: Date.now(),
			source: 'TestSystem',
			payload: { value: 42 },
		};
		bus.emit(event);

		expect(handler).toHaveBeenCalledWith(event);
	});

	it('supports priority ordering (lower = first)', () => {
		const bus = createEventBus();
		const order: number[] = [];

		bus.on('PriorityTest', () => order.push(200), 200);
		bus.on('PriorityTest', () => order.push(0), 0);
		bus.on('PriorityTest', () => order.push(100), 100);

		bus.emit({ type: 'PriorityTest', tick: 1, wallClock: Date.now(), source: 'test', payload: {} });

		expect(order).toEqual([0, 100, 200]);
	});

	it('stores event history and supports querying', () => {
		const bus = createEventBus();

		bus.emit({ type: 'A', tick: 1, wallClock: Date.now(), source: 'sys1', payload: {} });
		bus.emit({ type: 'B', tick: 2, wallClock: Date.now(), source: 'sys2', payload: {} });
		bus.emit({ type: 'A', tick: 3, wallClock: Date.now(), source: 'sys1', payload: {} });

		const allA = bus.history({ type: 'A' });
		expect(allA).toHaveLength(2);

		const fromSys2 = bus.history({ source: 'sys2' });
		expect(fromSys2).toHaveLength(1);

		const limited = bus.history({ limit: 1 });
		expect(limited).toHaveLength(1);
	});

	it('supports onAny to capture all events', () => {
		const bus = createEventBus();
		const events: GameEvent[] = [];

		bus.onAny((e) => events.push(e));
		bus.emit({ type: 'X', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		bus.emit({ type: 'Y', tick: 2, wallClock: Date.now(), source: 's', payload: {} });

		expect(events).toHaveLength(2);
	});

	it('supports unsubscribe', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		const unsub = bus.on('Test', handler);

		bus.emit({ type: 'Test', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);

		unsub();
		bus.emit({ type: 'Test', tick: 2, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('removes handler via off()', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on('Test', handler);

		bus.emit({ type: 'Test', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);

		bus.off('Test', handler);
		bus.emit({ type: 'Test', tick: 2, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('history limit returns the last N events', () => {
		const bus = createEventBus();
		for (let i = 1; i <= 5; i++) {
			bus.emit({ type: 'Seq', tick: i, wallClock: Date.now(), source: 's', payload: { i } });
		}
		const last2 = bus.history({ limit: 2 });
		expect(last2).toHaveLength(2);
		expect(last2[0]?.payload.i).toBe(4);
		expect(last2[1]?.payload.i).toBe(5);
	});

	it('does not throw when emitting with no handlers', () => {
		const bus = createEventBus();
		expect(() => {
			bus.emit({ type: 'Nobody', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		}).not.toThrow();
	});

	it('supports onAny unsubscribe', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		const unsub = bus.onAny(handler);

		bus.emit({ type: 'A', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);

		unsub();
		bus.emit({ type: 'B', tick: 2, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('supports filter unsubscribe', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		const unsub = bus.filter(() => true, handler);

		bus.emit({ type: 'A', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);

		unsub();
		bus.emit({ type: 'B', tick: 2, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('returns all events when history() called with no filter', () => {
		const bus = createEventBus();
		bus.emit({ type: 'A', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		bus.emit({ type: 'B', tick: 2, wallClock: Date.now(), source: 's', payload: {} });
		expect(bus.history()).toHaveLength(2);
	});

	it('caps history at 500 entries', () => {
		const bus = createEventBus();
		for (let i = 0; i < 510; i++) {
			bus.emit({ type: 'Flood', tick: i, wallClock: Date.now(), source: 's', payload: {} });
		}
		const all = bus.history();
		expect(all).toHaveLength(500);
		expect(all[0]?.tick).toBe(10);
	});

	it('supports filter-based subscription', () => {
		const bus = createEventBus();
		const handler = vi.fn();

		bus.filter((e) => e.payload.agentId === 'elena', handler);

		bus.emit({ type: 'A', tick: 1, wallClock: Date.now(), source: 's', payload: { agentId: 'elena' } });
		bus.emit({ type: 'B', tick: 2, wallClock: Date.now(), source: 's', payload: { agentId: 'marcus' } });

		expect(handler).toHaveBeenCalledTimes(1);
	});
});

describe('EventBus batching', () => {
	it('queues events during batch mode instead of dispatching', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on('Test', handler);

		bus.beginBatch();
		bus.emit({ type: 'Test', tick: 1, wallClock: Date.now(), source: 's', payload: {} });

		expect(handler).not.toHaveBeenCalled();
	});

	it('delivers all queued events on flushBatch in order', () => {
		const bus = createEventBus();
		const received: number[] = [];
		bus.on('Seq', (e) => received.push(e.tick));

		bus.beginBatch();
		bus.emit({ type: 'Seq', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		bus.emit({ type: 'Seq', tick: 2, wallClock: Date.now(), source: 's', payload: {} });
		bus.emit({ type: 'Seq', tick: 3, wallClock: Date.now(), source: 's', payload: {} });
		bus.flushBatch();

		expect(received).toEqual([1, 2, 3]);
	});

	it('dispatches immediately when not in batch mode (regression)', () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on('Test', handler);

		bus.emit({ type: 'Test', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		expect(handler).toHaveBeenCalledOnce();
	});

	it('events emitted during flushBatch handler execute immediately', () => {
		const bus = createEventBus();
		const order: string[] = [];

		bus.on('First', () => {
			order.push('first-handler');
			bus.emit({ type: 'Reactive', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		});
		bus.on('Reactive', () => order.push('reactive-handler'));

		bus.beginBatch();
		bus.emit({ type: 'First', tick: 1, wallClock: Date.now(), source: 's', payload: {} });
		bus.flushBatch();

		expect(order).toEqual(['first-handler', 'reactive-handler']);
	});

	it('beginBatch + flushBatch with no events is a no-op', () => {
		const bus = createEventBus();
		expect(() => {
			bus.beginBatch();
			bus.flushBatch();
		}).not.toThrow();
	});
});
