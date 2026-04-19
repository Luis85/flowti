import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createI18n, useI18n } from 'vue-i18n';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import enMessages from '../../../../src/modules/make/locales/en.json' with { type: 'json' };
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import { useMakeTypeDraft } from '../../../../src/ui/pages/make/use-make-type-draft.js';
import { useMakeTypeSaveFlow } from '../../../../src/ui/pages/make/use-make-type-save-flow.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';

// Suppress unused import warning — useI18n needed only for type inference in tests
void useI18n;

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', description: 'Reading log', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

function makeTFn(): (key: string, values?: Record<string, unknown>) => string {
	const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en: enMessages } });
	// Cast to access the t function from the global scope
	return (key: string, values?: Record<string, unknown>) =>
		(i18n.global.t as (k: string, v?: Record<string, unknown>) => string)(key, values);
}

// Per-test service spies — created fresh in beforeEach.
let createTypeSpy: ReturnType<typeof vi.fn>;
let updateTypeSpy: ReturnType<typeof vi.fn>;
let regenerateBaseFileSpy: ReturnType<typeof vi.fn>;
let listTypesSpy: ReturnType<typeof vi.fn>;

async function setupEditFlow(path = '/make/types/book') {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/make/types/:typeId', component: { template: '<div />' } }],
	});
	await router.push(path);
	await router.isReady();

	const ctx = createFakeMakeContext({
		service: fakeMakeService({
			createType: createTypeSpy,
			updateType: updateTypeSpy,
			regenerateBaseFile: regenerateBaseFileSpy,
			listTypes: listTypesSpy,
		}),
	});

	const t = makeTFn();
	let capturedStore!: ReturnType<typeof useMakeStore>;
	let capturedDraftState!: ReturnType<typeof useMakeTypeDraft>;
	let capturedFlow!: ReturnType<typeof useMakeTypeSaveFlow>;

	const TestComp = defineComponent({
		setup() {
			capturedStore = useMakeStore();
			capturedStore.types = [BOOK];
			capturedStore.typesLoaded = true;
			capturedDraftState = useMakeTypeDraft(router.currentRoute.value, capturedStore);
			capturedFlow = useMakeTypeSaveFlow(capturedStore, capturedDraftState, router, t, undefined);
			return () => h('div');
		},
	});

	mount(TestComp, {
		global: {
			plugins: [router, createPinia()],
			provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		},
	});

	return { router, store: capturedStore, draftState: capturedDraftState, flow: capturedFlow };
}

describe('useMakeTypeSaveFlow', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		createTypeSpy        = vi.fn();
		updateTypeSpy        = vi.fn();
		regenerateBaseFileSpy = vi.fn();
		listTypesSpy         = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
	});

	it('onSave in edit-mode calls updateType and calls applyResult on success', async () => {
		const updated: TypeSchema = { ...BOOK, name: 'Book Updated' };
		updateTypeSpy.mockResolvedValue({ kind: 'ok', value: { schema: updated } });
		const { flow, draftState } = await setupEditFlow();
		await flow.onSave();
		expect(updateTypeSpy).toHaveBeenCalledWith('book', expect.objectContaining({ name: 'Book' }), undefined);
		// After applyResult, draft matches the saved schema
		expect(draftState.draft.value.name).toBe('Book Updated');
	});

	it('duplicate-name error populates schemaErrors.name', async () => {
		updateTypeSpy.mockResolvedValue({ kind: 'err', error: { kind: 'duplicate-name', name: 'Book' } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		expect(flow.schemaErrors.value.name).toContain('Book');
	});

	it('field-rename-warning opens renameWarningOpen', async () => {
		updateTypeSpy.mockResolvedValue({
			kind: 'err',
			error: {
				kind: 'invalid-schema',
				issues: [{ kind: 'field-rename-warning', renames: [{ oldName: 'title', newName: 'heading', position: 0 }], affectedCount: 2 }],
			},
		});
		const { flow } = await setupEditFlow();
		await flow.onSave();
		expect(flow.renameWarningOpen.value).toBe(true);
		expect(flow.renameWarningBody.value).toContain('title');
		expect(flow.renameWarningBody.value).toContain('heading');
	});

	it('onRenameAcknowledge cancel does NOT call updateType again', async () => {
		updateTypeSpy.mockResolvedValue({
			kind: 'err',
			error: {
				kind: 'invalid-schema',
				issues: [{ kind: 'field-rename-warning', renames: [{ oldName: 'a', newName: 'b', position: 0 }], affectedCount: 1 }],
			},
		});
		const { flow } = await setupEditFlow();
		await flow.onSave();
		const callsBefore = updateTypeSpy.mock.calls.length;
		await flow.onRenameAcknowledge('cancel');
		expect(updateTypeSpy.mock.calls.length).toBe(callsBefore);
		expect(flow.renameWarningOpen.value).toBe(false);
	});

	it('onRenameAcknowledge confirm re-calls updateType with acknowledgeRenames', async () => {
		updateTypeSpy
			.mockResolvedValueOnce({
				kind: 'err',
				error: {
					kind: 'invalid-schema',
					issues: [{ kind: 'field-rename-warning', renames: [{ oldName: 'a', newName: 'b', position: 0 }], affectedCount: 1 }],
				},
			})
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: BOOK } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onRenameAcknowledge('confirm');
		expect(updateTypeSpy).toHaveBeenCalledTimes(2);
		expect(updateTypeSpy).toHaveBeenLastCalledWith('book', expect.any(Object), { acknowledgeRenames: true });
	});

	it('user-edited regenerate error sets overwriteWarningOpen', async () => {
		regenerateBaseFileSpy.mockResolvedValue({
			kind: 'err',
			error: { kind: 'base-generation-failed', cause: 'user-edited' },
		});
		const { flow } = await setupEditFlow();
		await flow.onRegenerate();
		expect(flow.overwriteWarningOpen.value).toBe(true);
	});

	it('onOverwriteConfirm confirm re-calls onRegenerate with force=true', async () => {
		regenerateBaseFileSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'base-generation-failed', cause: 'user-edited' } })
			.mockResolvedValueOnce({ kind: 'ok', value: 'Make/Bases/book.md' });
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { flow } = await setupEditFlow();
		await flow.onRegenerate();
		await flow.onOverwriteConfirm('confirm');
		expect(regenerateBaseFileSpy).toHaveBeenCalledTimes(2);
		expect(regenerateBaseFileSpy).toHaveBeenLastCalledWith('book', { force: true });
	});

	it('onOverwriteConfirm cancel does NOT re-call regenerate', async () => {
		regenerateBaseFileSpy.mockResolvedValue({
			kind: 'err', error: { kind: 'base-generation-failed', cause: 'user-edited' },
		});
		const { flow } = await setupEditFlow();
		await flow.onRegenerate();
		const callsBefore = regenerateBaseFileSpy.mock.calls.length;
		await flow.onOverwriteConfirm('cancel');
		expect(regenerateBaseFileSpy.mock.calls.length).toBe(callsBefore);
	});

	// --- Slice J: move-confirm dialog ---

	it('instances-move-required opens moveInstancesDialogOpen with count+folders', async () => {
		updateTypeSpy.mockResolvedValueOnce({
			kind: 'err',
			error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 3 },
		});
		const { flow } = await setupEditFlow();
		await flow.onSave();
		expect(flow.moveInstancesDialogOpen?.value).toBe(true);
		expect(flow.moveInstancesDialogBody?.value).toContain('3');
		expect(flow.moveInstancesDialogBody?.value).toContain('NewBooks');
	});

	it('onMoveInstancesConfirm re-calls updateType with moveInstances:true', async () => {
		const moveReport = { oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 3, failedMoves: [] };
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 3 } })
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: BOOK, moveReport } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		expect(updateTypeSpy).toHaveBeenCalledTimes(2);
		expect(updateTypeSpy).toHaveBeenLastCalledWith('book', expect.any(Object), { moveInstances: true });
	});

	it('partial-move after confirm leaves moveInstancesDialogOpen=false and does not crash', async () => {
		const moveReport = { oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 2, failedMoves: [{ path: 'Books/Dune.md', cause: 'locked' }] };
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 3 } })
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'partial-move', moveReport } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		expect(flow.moveInstancesDialogOpen?.value).toBe(false);
	});

	it('onMoveInstancesConfirm cancel does NOT re-call updateType', async () => {
		updateTypeSpy.mockResolvedValueOnce({
			kind: 'err',
			error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 3 },
		});
		const { flow } = await setupEditFlow();
		await flow.onSave();
		const before = updateTypeSpy.mock.calls.length;
		await flow.onMoveInstancesConfirm?.('cancel');
		expect(updateTypeSpy.mock.calls.length).toBe(before);
		expect(flow.moveInstancesDialogOpen?.value).toBe(false);
	});
});
