import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import { useCreateInstanceFlow } from '../../../../src/ui/pages/make/use-create-instance-flow.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import { fakeNotifications } from '../../../__fakes__/fake-ports.js';
import { ok, err } from '../../../../src/domain/shared/result.js';
import type { InstanceRef, TypeId } from '../../../../src/domain/make/types.js';
import type { Result } from '../../../../src/domain/shared/result.js';
import type { MakeError } from '../../../../src/domain/make/errors.js';

const SAMPLE_INSTANCE_REF: InstanceRef = {
	typeId: 'book',
	path: 'Books/Dune.md',
	title: 'Dune',
	createdAt: '2026-04-19T00:00:00.000Z',
	updatedAt: '2026-04-19T00:00:00.000Z',
};

let createInstanceSpy: ReturnType<typeof vi.fn>;

function setupFlow(
	typeId: TypeId = 'book',
	opts: { notifications?: ReturnType<typeof fakeNotifications> } = {},
) {
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ createInstance: createInstanceSpy }),
	});

	const notifications = opts.notifications;
	const t = (key: string) => key;

	let capturedStore!: ReturnType<typeof useMakeStore>;
	let capturedFlow!: ReturnType<typeof useCreateInstanceFlow>;

	const TestComp = defineComponent({
		setup() {
			capturedStore = useMakeStore();
			const typeIdRef = ref<TypeId>(typeId);
			capturedFlow = useCreateInstanceFlow(typeIdRef, capturedStore, notifications, t);
			return () => h('div');
		},
	});

	mount(TestComp, {
		global: {
			plugins: [createPinia()],
			provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		},
	});

	return { store: capturedStore, flow: capturedFlow, notifications };
}

describe('useCreateInstanceFlow', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
	});

	it('submit calls store.createInstance and resets serverErrors/overwriteDialog on success', async () => {
		createInstanceSpy.mockResolvedValue(ok(SAMPLE_INSTANCE_REF));
		const { flow, store } = setupFlow();
		const spy = vi.spyOn(store, 'createInstance');
		await flow.submit({ raw: { title: 'Dune' }, explicitFilename: null });
		expect(spy).toHaveBeenCalledWith('book', { title: 'Dune' }, null);
		expect(flow.serverErrors.value).toEqual([]);
		expect(flow.overwriteDialog.value).toBeNull();
	});

	it('surfaces invalid-values as serverErrors', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'invalid-values', issues: [{ kind: 'required-missing', fieldName: 'author' }] }));
		const { flow } = setupFlow();
		await flow.submit({ raw: {}, explicitFilename: null });
		expect(flow.serverErrors.value).toHaveLength(1);
		expect(flow.serverErrors.value[0]?.fieldName).toBe('author');
		expect(flow.overwriteDialog.value).toBeNull();
	});

	it('opens overwrite dialog on instance-exists with pending payload', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'instance-exists', path: 'Books/Dune.md' }));
		const { flow } = setupFlow();
		await flow.submit({ raw: { title: 'Dune' }, explicitFilename: null });
		expect(flow.overwriteDialog.value).not.toBeNull();
		expect(flow.overwriteDialog.value?.path).toBe('Books/Dune.md');
		expect(flow.overwriteDialog.value?.raw).toEqual({ title: 'Dune' });
		expect(flow.overwriteDialog.value?.explicitFilename).toBeNull();
	});

	it('confirmOverwrite re-calls createInstance with overwrite: true and clears the dialog', async () => {
		createInstanceSpy
			.mockResolvedValueOnce(err({ kind: 'instance-exists', path: 'Books/Dune.md' }))
			.mockResolvedValueOnce(ok(SAMPLE_INSTANCE_REF));
		const { flow, store } = setupFlow();
		const spy = vi.spyOn(store, 'createInstance');
		await flow.submit({ raw: { title: 'Dune' }, explicitFilename: null });
		await flow.confirmOverwrite();
		expect(spy).toHaveBeenLastCalledWith('book', { title: 'Dune' }, null, { overwrite: true });
		expect(flow.overwriteDialog.value).toBeNull();
	});

	it('vault-error fires an error notification', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'vault-error', cause: 'EIO' }));
		const notifications = fakeNotifications();
		const { flow } = setupFlow('book', { notifications });
		await flow.submit({ raw: { title: 'Dune' }, explicitFilename: null });
		expect(notifications.events).toHaveLength(1);
		expect(notifications.events[0]?.severity).toBe('error');
		expect(notifications.events[0]?.message).toBe('make.error.vault');
		expect(flow.serverErrors.value).toEqual([]);
		expect(flow.overwriteDialog.value).toBeNull();
	});

	it('no-title-field fires an error notification', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'no-title-field' }));
		const notifications = fakeNotifications();
		const { flow } = setupFlow('book', { notifications });
		await flow.submit({ raw: {}, explicitFilename: null });
		expect(notifications.events).toHaveLength(1);
		expect(notifications.events[0]?.severity).toBe('error');
		expect(notifications.events[0]?.message).toBe('make.error.noTitleField');
	});

	it('does NOT notify on invalid-values (handled inline)', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'invalid-values', issues: [{ kind: 'required-missing', fieldName: 'author' }] }));
		const notifications = fakeNotifications();
		const { flow } = setupFlow('book', { notifications });
		await flow.submit({ raw: {}, explicitFilename: null });
		expect(notifications.events).toHaveLength(0);
		expect(flow.serverErrors.value).toHaveLength(1);
	});

	it('does NOT notify on instance-exists (handled via dialog)', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'instance-exists', path: 'Books/Dune.md' }));
		const notifications = fakeNotifications();
		const { flow } = setupFlow('book', { notifications });
		await flow.submit({ raw: { title: 'Dune' }, explicitFilename: null });
		expect(notifications.events).toHaveLength(0);
		expect(flow.overwriteDialog.value).not.toBeNull();
	});

	it('confirmOverwrite surfaces vault-error via notification', async () => {
		createInstanceSpy
			.mockResolvedValueOnce(err({ kind: 'instance-exists', path: 'Books/Dune.md' }))
			.mockResolvedValueOnce(err({ kind: 'vault-error', cause: 'EIO' }));
		const notifications = fakeNotifications();
		const { flow } = setupFlow('book', { notifications });
		await flow.submit({ raw: { title: 'Dune' }, explicitFilename: null });
		expect(notifications.events).toHaveLength(0);
		await flow.confirmOverwrite();
		expect(notifications.events).toHaveLength(1);
		expect(notifications.events[0]?.message).toBe('make.error.vault');
	});

	it('ignores re-entrant submit while already submitting', async () => {
		const { flow, store } = setupFlow();
		let resolveFirst!: (r: Result<InstanceRef, MakeError>) => void;
		const spy = vi.spyOn(store, 'createInstance')
			.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
		const first = flow.submit({ raw: { title: 'A' }, explicitFilename: null });
		const second = flow.submit({ raw: { title: 'B' }, explicitFilename: null });
		expect(spy).toHaveBeenCalledTimes(1);
		resolveFirst(ok(SAMPLE_INSTANCE_REF));
		await first;
		await second;
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('ignores re-entrant confirmOverwrite while already submitting', async () => {
		createInstanceSpy.mockResolvedValueOnce(err({ kind: 'instance-exists', path: 'Books/Dune.md' }));
		const { flow, store } = setupFlow();
		await flow.submit({ raw: { title: 'A' }, explicitFilename: null });
		expect(flow.overwriteDialog.value).not.toBeNull();
		let resolveFirst!: (r: Result<InstanceRef, MakeError>) => void;
		const spy = vi.spyOn(store, 'createInstance')
			.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
		const first = flow.confirmOverwrite();
		const second = flow.confirmOverwrite();
		expect(spy).toHaveBeenCalledTimes(1);
		resolveFirst(ok(SAMPLE_INSTANCE_REF));
		await first;
		await second;
		expect(spy).toHaveBeenCalledTimes(1);
	});
});
