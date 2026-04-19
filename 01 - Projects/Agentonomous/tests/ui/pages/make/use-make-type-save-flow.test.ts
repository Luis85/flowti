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
import type { PluginContext } from '../../../../src/plugin.js';

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
let retryFailedMovesSpy: ReturnType<typeof vi.fn>;
let regenerateBaseFileSpy: ReturnType<typeof vi.fn>;
let listTypesSpy: ReturnType<typeof vi.fn>;
let notificationsSpy: {
	success: ReturnType<typeof vi.fn>;
	warn:    ReturnType<typeof vi.fn>;
	info:    ReturnType<typeof vi.fn>;
	error:   ReturnType<typeof vi.fn>;
};

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
			retryFailedMoves: retryFailedMovesSpy,
			regenerateBaseFile: regenerateBaseFileSpy,
			listTypes: listTypesSpy,
		}),
	});

	const t = makeTFn();
	let capturedStore!: ReturnType<typeof useMakeStore>;
	let capturedDraftState!: ReturnType<typeof useMakeTypeDraft>;
	let capturedFlow!: ReturnType<typeof useMakeTypeSaveFlow>;

	const pluginCtx = { notifications: notificationsSpy } as unknown as PluginContext;
	const TestComp = defineComponent({
		setup() {
			capturedStore = useMakeStore();
			capturedStore.types = [BOOK];
			capturedStore.typesLoaded = true;
			capturedDraftState = useMakeTypeDraft(router.currentRoute.value, capturedStore);
			capturedFlow = useMakeTypeSaveFlow(capturedStore, capturedDraftState, router, t, pluginCtx);
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
		retryFailedMovesSpy  = vi.fn();
		regenerateBaseFileSpy = vi.fn();
		listTypesSpy         = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		notificationsSpy     = { success: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() };
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
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: BOOK, moveReport } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		expect(flow.moveInstancesDialogOpen?.value).toBe(false);
	});

	it('onMoveInstancesConfirm sets moveInstancesDialogBusy=true during flight, clears after', async () => {
		const moveReport = { oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 3, failedMoves: [] };
		let resolveUpdate!: (v: { kind: 'ok'; value: { schema: TypeSchema; moveReport: typeof moveReport } }) => void;
		const updatePromise = new Promise<{ kind: 'ok'; value: { schema: TypeSchema; moveReport: typeof moveReport } }>((r) => { resolveUpdate = r; });
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 3 } })
			.mockReturnValueOnce(updatePromise);
		const { flow } = await setupEditFlow();
		await flow.onSave();
		expect(flow.moveInstancesDialogBusy?.value).toBe(false);
		const confirmPromise = flow.onMoveInstancesConfirm?.('confirm');
		expect(flow.moveInstancesDialogBusy?.value).toBe(true);
		resolveUpdate({ kind: 'ok', value: { schema: BOOK, moveReport } });
		await confirmPromise;
		expect(flow.moveInstancesDialogBusy?.value).toBe(false);
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

	it('successful update fires notifications.success with make.notify.typeUpdated', async () => {
		const updated: TypeSchema = { ...BOOK, name: 'Book Updated' };
		updateTypeSpy.mockResolvedValue({ kind: 'ok', value: { schema: updated } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		expect(notificationsSpy.success).toHaveBeenCalledWith(expect.stringContaining('updated'));
		expect(notificationsSpy.warn).not.toHaveBeenCalled();
	});

	it('full-success move fires notifications.info move-report AND success update', async () => {
		const moveReport = { oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 3, failedMoves: [] };
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 3 } })
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: BOOK, moveReport } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		expect(notificationsSpy.success).toHaveBeenCalledTimes(1);
		expect(notificationsSpy.info).toHaveBeenCalledTimes(1);
		expect(notificationsSpy.info).toHaveBeenCalledWith(expect.stringContaining('NewBooks'));
		expect(notificationsSpy.warn).not.toHaveBeenCalled();
	});

	it('partial-move opens the move-report dialog and does NOT fire success notification', async () => {
		const moveReport = {
			oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 2,
			failedMoves: [{ path: 'Books/Dune.md', cause: 'locked' }],
		};
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 3 } })
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: BOOK, moveReport } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		expect(flow.moveReportDialogOpen?.value).toBe(true);
		expect(flow.moveReportDialogBody?.value).toContain('Dune');
		expect(notificationsSpy.success).not.toHaveBeenCalled();
		expect(notificationsSpy.warn).not.toHaveBeenCalled();
		expect(notificationsSpy.info).not.toHaveBeenCalled();
	});

	it('onRetryFailedMoves cancel closes dialog without calling the service', async () => {
		const moveReport = {
			oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 1,
			failedMoves: [{ path: 'Books/Dune.md', cause: 'locked' }],
		};
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 2 } })
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: BOOK, moveReport } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		expect(flow.moveReportDialogOpen?.value).toBe(true);
		await flow.onRetryFailedMoves?.('cancel');
		expect(flow.moveReportDialogOpen?.value).toBe(false);
		expect(retryFailedMovesSpy).not.toHaveBeenCalled();
	});

	it('onRetryFailedMoves confirm with full success closes dialog and fires success', async () => {
		const initialReport = {
			oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 1,
			failedMoves: [{ path: 'Books/Dune.md', cause: 'locked' }],
		};
		const retriedReport = { oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 1, failedMoves: [] };
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 2 } })
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: BOOK, moveReport: initialReport } });
		retryFailedMovesSpy.mockResolvedValue({ kind: 'ok', value: retriedReport });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		await flow.onRetryFailedMoves?.('confirm');
		expect(retryFailedMovesSpy).toHaveBeenCalledWith('book', ['Books/Dune.md']);
		expect(flow.moveReportDialogOpen?.value).toBe(false);
		expect(notificationsSpy.success).toHaveBeenCalledWith(expect.stringContaining('NewBooks'));
	});

	it('onRetryFailedMoves confirm with still-failing keeps dialog open with new report', async () => {
		const initialReport = {
			oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 0,
			failedMoves: [{ path: 'Books/Dune.md', cause: 'locked' }, { path: 'Books/Neuromancer.md', cause: 'locked' }],
		};
		const retriedReport = {
			oldFolder: 'NewBooks', newFolder: 'NewBooks', movedCount: 1,
			failedMoves: [{ path: 'Books/Dune.md', cause: 'still-locked' }],
		};
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 2 } })
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: BOOK, moveReport: initialReport } });
		retryFailedMovesSpy.mockResolvedValue({ kind: 'ok', value: retriedReport });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		const bodyBefore = flow.moveReportDialogBody?.value;
		await flow.onRetryFailedMoves?.('confirm');
		expect(flow.moveReportDialogOpen?.value).toBe(true);
		expect(flow.moveReportDialogBody?.value).not.toBe(bodyBefore);
		expect(flow.moveReportDialogBody?.value).toContain('Dune');
		expect(notificationsSpy.success).not.toHaveBeenCalled();
	});

	it('partial-move applyResult is called so draft reflects on-disk schema', async () => {
		const updated: TypeSchema = { ...BOOK, name: 'Book Updated', instancesFolder: 'NewBooks' };
		const moveReport = {
			oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 1,
			failedMoves: [{ path: 'Books/Dune.md', cause: 'locked' }],
		};
		updateTypeSpy
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 2 } })
			.mockResolvedValueOnce({ kind: 'ok', value: { schema: updated, moveReport } });
		const { flow, draftState } = await setupEditFlow();
		await flow.onSave();
		await flow.onMoveInstancesConfirm?.('confirm');
		expect(draftState.draft.value.name).toBe('Book Updated');
		expect(draftState.draft.value.instancesFolder).toBe('NewBooks');
	});
});
