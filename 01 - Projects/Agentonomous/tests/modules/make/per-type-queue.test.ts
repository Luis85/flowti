import { describe, expect, it } from 'vitest';
import { createPerTypeQueue } from '../../../src/modules/make/per-type-queue.js';

describe('createPerTypeQueue', () => {
	it('runs work and returns its result', async () => {
		const q = createPerTypeQueue();
		const out = await q.enqueue('t1', async () => 42);
		expect(out).toBe(42);
	});

	it('serializes two enqueues for the same typeId (FIFO)', async () => {
		const q = createPerTypeQueue();
		const order: string[] = [];
		const a = q.enqueue('t1', async () => {
			await new Promise((r) => setTimeout(r, 30));
			order.push('a');
			return 'a';
		});
		const b = q.enqueue('t1', async () => {
			order.push('b');
			return 'b';
		});
		await Promise.all([a, b]);
		expect(order).toEqual(['a', 'b']);
	});

	it('runs enqueues for different typeIds concurrently', async () => {
		const q = createPerTypeQueue();
		const order: string[] = [];
		const a = q.enqueue('t1', async () => {
			await new Promise((r) => setTimeout(r, 30));
			order.push('a');
		});
		const b = q.enqueue('t2', async () => {
			order.push('b');
		});
		await Promise.all([a, b]);
		expect(order).toEqual(['b', 'a']);
	});

	it('does not break the chain when a prior work rejects', async () => {
		const q = createPerTypeQueue();
		const a = q.enqueue('t1', async () => { throw new Error('boom'); });
		await expect(a).rejects.toThrow('boom');
		const b = await q.enqueue('t1', async () => 'ok-after-reject');
		expect(b).toBe('ok-after-reject');
	});

	it('propagates synchronous throws inside work as rejections', async () => {
		const q = createPerTypeQueue();
		const a = q.enqueue('t1', () => { throw new Error('sync'); });
		await expect(a).rejects.toThrow('sync');
	});
});
