import { describe, expect, it, vi } from 'vitest';
import { EventBuffer } from '../../../src/modules/event-inspector/event-inspector-buffer.js';
import type { EventEnvelope } from '../../../src/domain/shared/event-bus.js';

function makeEnvelope(channel: string): EventEnvelope {
	return { channel, payload: {}, timestamp: Date.now() } as EventEnvelope;
}

describe('EventBuffer', () => {
	it('starts empty', () => {
		const buf = new EventBuffer(10);
		expect(buf.getAll()).toHaveLength(0);
	});

	it('add() stores an envelope', () => {
		const buf = new EventBuffer(10);
		buf.add(makeEnvelope('core'));
		expect(buf.getAll()).toHaveLength(1);
	});

	it('add() trims buffer when max is exceeded', () => {
		const buf = new EventBuffer(3);
		buf.add(makeEnvelope('a'));
		buf.add(makeEnvelope('b'));
		buf.add(makeEnvelope('c'));
		buf.add(makeEnvelope('d'));
		expect(buf.getAll()).toHaveLength(3);
		expect(buf.getAll()[0]?.channel).toBe('b');
	});

	it('clear() empties the buffer', () => {
		const buf = new EventBuffer(10);
		buf.add(makeEnvelope('x'));
		buf.clear();
		expect(buf.getAll()).toHaveLength(0);
	});

	it('setMaxEvents() trims existing items if needed', () => {
		const buf = new EventBuffer(10);
		buf.add(makeEnvelope('a'));
		buf.add(makeEnvelope('b'));
		buf.add(makeEnvelope('c'));
		buf.setMaxEvents(2);
		expect(buf.getAll()).toHaveLength(2);
	});

	it('onChange() notifies listeners on add', () => {
		const buf = new EventBuffer(10);
		const listener = vi.fn();
		buf.onChange(listener);
		buf.add(makeEnvelope('core'));
		expect(listener).toHaveBeenCalledOnce();
	});

	it('onChange() notifies listeners on clear', () => {
		const buf = new EventBuffer(10);
		const listener = vi.fn();
		buf.onChange(listener);
		buf.clear();
		expect(listener).toHaveBeenCalledOnce();
	});

	it('onChange() unsubscribes via returned function', () => {
		const buf = new EventBuffer(10);
		const listener = vi.fn();
		const unsub = buf.onChange(listener);
		unsub();
		buf.add(makeEnvelope('core'));
		expect(listener).not.toHaveBeenCalled();
	});

	it('setMaxEvents() does not trim when buffer is within new max', () => {
		const buf = new EventBuffer(10);
		buf.add(makeEnvelope('a'));
		buf.setMaxEvents(5);
		expect(buf.getAll()).toHaveLength(1);
	});
});
