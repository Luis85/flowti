import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import { useCreateInstanceFlow } from '../../../../src/ui/pages/make/use-create-instance-flow.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import { ok, err } from '../../../../src/domain/shared/result.js';
import type { InstanceRef, TypeId } from '../../../../src/domain/make/types.js';

const SAMPLE_INSTANCE_REF: InstanceRef = {
	typeId: 'book',
	path: 'Books/Dune.md',
	title: 'Dune',
	createdAt: '2026-04-19T00:00:00.000Z',
	updatedAt: '2026-04-19T00:00:00.000Z',
};

let createInstanceSpy: ReturnType<typeof vi.fn>;

function setupFlow(typeId: TypeId = 'book') {
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ createInstance: createInstanceSpy }),
	});

	let capturedStore!: ReturnType<typeof useMakeStore>;
	let capturedFlow!: ReturnType<typeof useCreateInstanceFlow>;

	const TestComp = defineComponent({
		setup() {
			capturedStore = useMakeStore();
			const typeIdRef = ref<TypeId>(typeId);
			capturedFlow = useCreateInstanceFlow(typeIdRef, capturedStore);
			return () => h('div');
		},
	});

	mount(TestComp, {
		global: {
			plugins: [createPinia()],
			provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		},
	});

	return { store: capturedStore, flow: capturedFlow };
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
});
