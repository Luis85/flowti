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
