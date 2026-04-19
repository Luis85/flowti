import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakeService } from '../../../src/modules/make/make-service.js';
import { createPerTypeQueue } from '../../../src/modules/make/per-type-queue.js';
import { MAKE_DEFAULTS } from '../../../src/modules/make/make-settings.js';
import { fakeModulePorts, fakeVault } from '../../__fakes__/fake-ports.js';
import { createEventBus, type EventBus } from '../../../src/domain/shared/event-bus.js';
import type { BulkDeleteReport } from '../../../src/domain/make/types.js';

type CapturedEvent = { readonly channel: string; readonly payload: unknown };

function captureEvents(bus: EventBus): CapturedEvent[] {
	const events: CapturedEvent[] = [];
	bus.on('make:instances-deleted-batch', (e) => { events.push({ channel: 'make:instances-deleted-batch', payload: e.payload }); });
	bus.on('make:instance-deleted',        (e) => { events.push({ channel: 'make:instance-deleted',        payload: e.payload }); });
	bus.on('make:orphan-deleted',          (e) => { events.push({ channel: 'make:orphan-deleted',          payload: e.payload }); });
	return events;
}

describe('service.deleteInstances', () => {
	let vault: ReturnType<typeof fakeVault>;
	let bus:   EventBus;
	let events: CapturedEvent[];
	let svc:   ReturnType<typeof createMakeService>;

	beforeEach(() => {
		vault = fakeVault();
		bus   = createEventBus();
		events = captureEvents(bus);
		svc   = createMakeService(fakeModulePorts({ vault, eventBus: bus }), () => MAKE_DEFAULTS);
	});

	it('all-success: returns deletedPaths=paths and emits one batch event', async () => {
		const deleteSpy = vi.fn(async () => ({ kind: 'ok' as const, value: undefined }));
		vault.delete = deleteSpy as typeof vault.delete;
		const paths = ['Books/Dune.md', 'Books/Foundation.md'];
		const result = await svc.deleteInstances('book', paths);
		expect(result).toEqual({ kind: 'ok', value: { deletedPaths: paths, failures: [] } });
		expect(deleteSpy).toHaveBeenCalledTimes(2);
		expect(deleteSpy).toHaveBeenNthCalledWith(1, 'Books/Dune.md');
		expect(deleteSpy).toHaveBeenNthCalledWith(2, 'Books/Foundation.md');
		const batch = events.filter((e) => e.channel === 'make:instances-deleted-batch');
		expect(batch).toHaveLength(1);
		expect(batch[0]!.payload).toEqual({ typeId: 'book', deletedPaths: paths, failures: [] });
		expect(events.some((e) => e.channel === 'make:instance-deleted')).toBe(false);
		expect(events.some((e) => e.channel === 'make:orphan-deleted')).toBe(false);
	});

	it('mixed: collects per-path failures, never short-circuits, still emits one batch event', async () => {
		vault.delete = vi.fn(async (p: string) =>
			p === 'Books/Foundation.md'
				? { kind: 'err' as const, error: 'locked' }
				: { kind: 'ok' as const, value: undefined },
		) as typeof vault.delete;
		const paths = ['Books/Dune.md', 'Books/Foundation.md', 'Books/Neuromancer.md'];
		const result = await svc.deleteInstances('book', paths);
		expect(result.kind).toBe('ok');
		const report = (result as { kind: 'ok'; value: BulkDeleteReport }).value;
		expect(report.deletedPaths).toEqual(['Books/Dune.md', 'Books/Neuromancer.md']);
		expect(report.failures).toEqual([{ path: 'Books/Foundation.md', error: 'locked' }]);
		const batch = events.filter((e) => e.channel === 'make:instances-deleted-batch');
		expect(batch).toHaveLength(1);
		expect(batch[0]!.payload).toEqual({
			typeId: 'book',
			deletedPaths: ['Books/Dune.md', 'Books/Neuromancer.md'],
			failures:     [{ path: 'Books/Foundation.md', error: 'locked' }],
		});
	});

	it('empty paths: returns ok with empty arrays and emits NO event', async () => {
		const deleteSpy = vi.fn(async () => ({ kind: 'ok' as const, value: undefined }));
		vault.delete = deleteSpy as typeof vault.delete;
		const result = await svc.deleteInstances('book', []);
		expect(result).toEqual({ kind: 'ok', value: { deletedPaths: [], failures: [] } });
		expect(deleteSpy).not.toHaveBeenCalled();
		expect(events.some((e) => e.channel === 'make:instances-deleted-batch')).toBe(false);
	});

	it('sequential ordering: vault.delete is called once per path in input order', async () => {
		const order: string[] = [];
		vault.delete = vi.fn(async (p: string) => { order.push(p); return { kind: 'ok' as const, value: undefined }; }) as typeof vault.delete;
		await svc.deleteInstances('book', ['a.md', 'b.md', 'c.md']);
		expect(order).toEqual(['a.md', 'b.md', 'c.md']);
	});

	it('runs inside the per-type-queue: a follow-up enqueue on the same typeId waits for the batch event', async () => {
		const queue = createPerTypeQueue();
		const localVault = fakeVault();
		const localBus   = createEventBus();
		const localSvc   = createMakeService(fakeModulePorts({ vault: localVault, eventBus: localBus }), () => MAKE_DEFAULTS, queue);
		localVault.delete = vi.fn(async () => {
			await new Promise((r) => setTimeout(r, 30));
			return { kind: 'ok' as const, value: undefined };
		}) as typeof localVault.delete;
		// Push a marker from INSIDE the batch-event listener — that fires synchronously
		// inside the work body via ports.eventBus.emit, before the work promise resolves
		// and any .then() chains observe completion. This avoids racing the caller's
		// .then(...) against the queue's internal .catch(...) chain, and directly proves
		// the follow-up enqueue waits for the batch work (including its emit) to finish.
		const order: string[] = [];
		localBus.on('make:instances-deleted-batch', () => { order.push('batch-event'); });
		const bulk  = localSvc.deleteInstances('book', ['a.md', 'b.md']);
		const after = queue.enqueue('book', async () => { order.push('after'); });
		await Promise.all([bulk, after]);
		expect(order).toEqual(['batch-event', 'after']);
	});
});
