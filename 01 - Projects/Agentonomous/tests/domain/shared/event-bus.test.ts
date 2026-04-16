import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../../src/domain/shared/event-bus.js';

describe('EventBus', () => {
	it('on() receives emitted events on the correct channel', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		bus.on('core', listener);
		bus.emit('core', { phase: 'ready' });
		expect(listener).toHaveBeenCalledOnce();
		expect(listener.mock.calls[0][0].payload).toEqual({ phase: 'ready' });
	});

	it('on() does not fire for other channels', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		bus.on('core', listener);
		bus.emit('log', { level: 'info', source: 'test', message: 'hi' });
		expect(listener).not.toHaveBeenCalled();
	});

	it('emit() returns an EventEnvelope with traceId and eventId', () => {
		const bus = createEventBus();
		const envelope = bus.emit('core', { phase: 'initializing' });
		expect(envelope.channel).toBe('core');
		expect(envelope.traceId).toBeTruthy();
		expect(envelope.eventId).toBeTruthy();
		expect(envelope.timestamp).toBeGreaterThan(0);
		expect(envelope.parentId).toBeUndefined();
	});

	it('emit() with parentId reuses the parent traceId', () => {
		const bus = createEventBus();
		const parent = bus.emit('core', { phase: 'initializing' });
		const child = bus.emit('log', { level: 'info', source: 'test', message: 'started' }, { parentId: parent.eventId });
		expect(child.traceId).toBe(parent.traceId);
		expect(child.parentId).toBe(parent.eventId);
	});

	it('emit() without parentId starts a new trace', () => {
		const bus = createEventBus();
		const a = bus.emit('core', { phase: 'initializing' });
		const b = bus.emit('core', { phase: 'ready' });
		expect(a.traceId).not.toBe(b.traceId);
	});

	it('onAny() receives events from all channels', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		bus.onAny(listener);
		bus.emit('core', { phase: 'ready' });
		bus.emit('log', { level: 'info', source: 'x', message: 'y' });
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener.mock.calls[0][0].channel).toBe('core');
		expect(listener.mock.calls[1][0].channel).toBe('log');
	});

	it('unsubscribe removes the listener', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		const unsub = bus.on('core', listener);
		unsub();
		bus.emit('core', { phase: 'ready' });
		expect(listener).not.toHaveBeenCalled();
	});

	it('onAny unsubscribe works', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		const unsub = bus.onAny(listener);
		unsub();
		bus.emit('core', { phase: 'ready' });
		expect(listener).not.toHaveBeenCalled();
	});

	it('listeners fire synchronously in registration order', () => {
		const bus = createEventBus();
		const order: number[] = [];
		bus.on('core', () => { order.push(1); });
		bus.on('core', () => { order.push(2); });
		bus.emit('core', { phase: 'ready' });
		expect(order).toEqual([1, 2]);
	});

	it('envelope contains correct channel and payload types', () => {
		const bus = createEventBus();
		const listener = vi.fn();
		bus.on('error', listener);
		bus.emit('error', { code: 'TEST', message: 'fail', source: 'unit', severity: 'system' });
		const env = listener.mock.calls[0][0];
		expect(env.channel).toBe('error');
		expect(env.payload.severity).toBe('system');
	});
});

describe('listener priority', () => {
	it('higher priority fires first', () => {
		const bus = createEventBus();
		const order: string[] = [];
		bus.on('core', () => { order.push('default'); });
		bus.on('core', () => { order.push('high'); }, { priority: 100 });
		bus.on('core', () => { order.push('low'); }, { priority: -100 });
		bus.emit('core', { phase: 'ready' });
		expect(order).toEqual(['high', 'default', 'low']);
	});

	it('same priority preserves registration order', () => {
		const bus = createEventBus();
		const order: number[] = [];
		bus.on('core', () => { order.push(1); }, { priority: 0 });
		bus.on('core', () => { order.push(2); }, { priority: 0 });
		bus.emit('core', { phase: 'ready' });
		expect(order).toEqual([1, 2]);
	});
});

describe('snapshot dispatch', () => {
	it('unsubscribing during emit does not skip listeners', () => {
		const bus = createEventBus();
		const calls: string[] = [];
		const unsub = bus.on('core', () => {
			calls.push('first');
			unsub();
		});
		bus.on('core', () => { calls.push('second'); });
		bus.emit('core', { phase: 'ready' });
		expect(calls).toEqual(['first', 'second']);
	});

	it('subscribing during emit does not fire new listener in current dispatch', () => {
		const bus = createEventBus();
		const calls: string[] = [];
		bus.on('core', () => {
			calls.push('original');
			bus.on('core', () => { calls.push('added-during-emit'); });
		});
		bus.emit('core', { phase: 'ready' });
		expect(calls).toEqual(['original']);
	});
});

describe('emitAsync', () => {
	it('awaits all listener Promises before resolving', async () => {
		const bus = createEventBus();
		const order: string[] = [];
		bus.on('core', async () => {
			await new Promise((r) => { setTimeout(r, 10); });
			order.push('async-listener');
		});
		bus.on('core', () => { order.push('sync-listener'); });
		await bus.emitAsync('core', { phase: 'ready' });
		expect(order).toContain('async-listener');
		expect(order).toContain('sync-listener');
	});

	it('returns the EventEnvelope', async () => {
		const bus = createEventBus();
		const env = await bus.emitAsync('core', { phase: 'ready' });
		expect(env.channel).toBe('core');
		expect(env.eventId).toBeTruthy();
	});

	it('snapshots listeners before dispatching', async () => {
		const bus = createEventBus();
		const calls: string[] = [];
		bus.on('core', async () => {
			calls.push('original');
			bus.on('core', () => { calls.push('added-during-async'); });
		});
		await bus.emitAsync('core', { phase: 'ready' });
		expect(calls).toEqual(['original']);
	});
});

describe('emitAsync backpressure', () => {
	it('limits concurrent listeners with maxConcurrency', async () => {
		const bus = createEventBus();
		let concurrent = 0;
		let maxConcurrent = 0;
		for (let i = 0; i < 5; i++) {
			bus.on('core', async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => { setTimeout(r, 10); });
				concurrent--;
			});
		}
		await bus.emitAsync('core', { phase: 'ready' }, { maxConcurrency: 2 });
		expect(maxConcurrent).toBe(2);
	});

	it('defaults to Infinity (all concurrent)', async () => {
		const bus = createEventBus();
		let concurrent = 0;
		let maxConcurrent = 0;
		for (let i = 0; i < 3; i++) {
			bus.on('core', async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => { setTimeout(r, 10); });
				concurrent--;
			});
		}
		await bus.emitAsync('core', { phase: 'ready' });
		expect(maxConcurrent).toBe(3);
	});
});

describe('listenerCount', () => {
	it('returns 0 for empty bus', () => {
		const bus = createEventBus();
		expect(bus.listenerCount()).toBe(0);
	});

	it('counts channel listeners', () => {
		const bus = createEventBus();
		bus.on('core', () => {});
		bus.on('core', () => {});
		bus.on('log', () => {});
		expect(bus.listenerCount('core')).toBe(2);
		expect(bus.listenerCount('log')).toBe(1);
		expect(bus.listenerCount()).toBe(3);
	});

	it('includes onAny listeners in total', () => {
		const bus = createEventBus();
		bus.on('core', () => {});
		bus.onAny(() => {});
		expect(bus.listenerCount()).toBe(2);
	});

	it('decreases after unsubscribe', () => {
		const bus = createEventBus();
		const unsub = bus.on('core', () => {});
		expect(bus.listenerCount('core')).toBe(1);
		unsub();
		expect(bus.listenerCount('core')).toBe(0);
	});
});

describe('traceMap eviction', () => {
	it('keeps traceMap bounded when maxTraceEntries is exceeded', () => {
		const bus = createEventBus({ maxTraceEntries: 100 });
		for (let i = 0; i < 150; i++) {
			bus.emit('core', { phase: 'ready' });
		}
		// Verify bus still works (traceId is valid)
		const env = bus.emit('core', { phase: 'ready' });
		expect(env.traceId).toBeTruthy();
		expect(env.eventId).toBeTruthy();
	});
});
